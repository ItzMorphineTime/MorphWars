// AI Controller

class AIController {
    constructor(player, difficulty, game) {
        this.player = player;
        this.difficulty = difficulty;
        this.game = game;
        this.config = AI_CONFIG[difficulty];

        this.lastUpdate = 0;
        this.lastScout = 0;
        this.lastExpansion = 0;
        this.lastSpread = 0;
        this.lastMassAttack = 0;          // Track when mass attack was last initiated
        this.massAttackInitiated = false; // Track if mass attack has been launched

        this.economyTargets = {
            harvesters: 3,
            refineries: 2,
            powerPlants: 2,
        };

        this.militaryTargets = {
            infantry: 5,
            vehicles: 8,
            defenses: 3,
        };

        this.buildOrder = this.generateBuildOrder();
        this.buildOrderIndex = 0;
        this.state = 'build'; // build, expand, attack, defend, mass_attack
        this.scoutTargets = []; // Track where scouts have been
    }

    update(deltaTime) {
        const now = Date.now();

        if (now - this.lastUpdate < this.config.updateInterval) {
            return;
        }

        this.lastUpdate = now;

        const owned = this.player.getOwnedEntities(this.game.units, this.game.buildings);

        // Update power and tech
        this.player.updatePower(this.game.buildings);
        this.player.updateTechTree(this.game.buildings);

        // Check for mass attack threshold FIRST (performance critical)
        const totalCombatUnits = owned.units.filter(u => u.stats.damage && !u.isHarvester).length;

        // Check if we should END mass attack state (unit count fell below threshold)
        if (this.state === 'mass_attack' && totalCombatUnits < AI_BEHAVIOR.MASS_ATTACK_END_THRESHOLD) {
            if (DEBUG_LOGGING.AI_ATTACKING) {
                console.log(`[AI ${this.difficulty}] Mass attack ended - unit count fell to ${totalCombatUnits}`);
            }
            this.state = 'build';
            this.massAttackInitiated = false;
            this.lastMassAttack = now; // Prevent immediate re-trigger
        }

        // Check if we should START mass attack (reached unit limit)
        // Add cooldown: don't re-trigger mass attack within cooldown period
        const canStartMassAttack = totalCombatUnits >= this.config.maxUnitLimit &&
                                   !this.massAttackInitiated &&
                                   (now - this.lastMassAttack > AI_BEHAVIOR.MASS_ATTACK_COOLDOWN);

        if (canStartMassAttack) {
            if (DEBUG_LOGGING.AI_ATTACKING) {
                console.log(`[AI ${this.difficulty}] INITIATING MASS ATTACK - Unit limit reached (${totalCombatUnits}/${this.config.maxUnitLimit})`);
            }
            this.state = 'mass_attack';
            this.massAttackInitiated = true;
            this.lastMassAttack = now;
            this.launchMassAttack(owned);
            return; // Skip other logic during initial mass attack launch
        }

        // If in mass attack state, periodically send idle units to rejoin attack
        if (this.state === 'mass_attack' && now - this.lastMassAttack > AI_BEHAVIOR.MASS_ATTACK_REJOIN_INTERVAL) {
            this.rejoinMassAttack(owned);
            this.lastMassAttack = now;
            return; // Skip other logic during mass attack
        }

        // Skip normal logic if in mass attack state
        if (this.state === 'mass_attack') {
            return;
        }

        // Execute AI logic
        this.manageEconomy(owned);
        this.manageProduction(owned);
        this.manageMilitary(owned);
        this.manageDefense(owned);

        // Periodic tasks
        if (now - this.lastScout > this.config.scoutInterval) {
            this.sendScouts(owned);
            this.lastScout = now;
        }

        if (now - this.lastSpread > this.config.spreadInterval) {
            this.spreadUnits(owned);
            this.lastSpread = now;
        }

        if (now - this.lastExpansion > this.config.expansionDelay) {
            this.considerExpansion(owned);
            this.lastExpansion = now;
        }
    }

    generateBuildOrder() {
        return [
            'POWER_PLANT',
            'REFINERY',
            'BARRACKS',
            'POWER_PLANT',
            'WAR_FACTORY',
            'TECH_CENTER',
        ];
    }

    manageEconomy(owned) {
        const harvesters = owned.units.filter(u => u.isHarvester).length;
        const refineries = owned.buildings.filter(b => b.stats.isRefinery).length;
        const powerPlants = owned.buildings.filter(b => b.stats.powerGenerate > 0).length;

        // Build power if needed
        if (this.player.hasLowPower() && powerPlants < this.economyTargets.powerPlants + 2) {
            this.tryBuildBuilding('POWER_PLANT', owned);
        }

        // Build refineries
        if (refineries < this.economyTargets.refineries && this.player.credits > 2000) {
            this.tryBuildBuilding('REFINERY', owned);
        }

        // Build harvesters
        if (harvesters < this.economyTargets.harvesters * refineries) {
            this.tryTrainUnit('HARVESTER', owned);
        }

        // Execute build order
        if (this.buildOrderIndex < this.buildOrder.length) {
            const buildingType = this.buildOrder[this.buildOrderIndex];
            const stats = BUILDING_TYPES[buildingType];

            if (this.player.canAfford(stats.cost)) {
                if (this.tryBuildBuilding(buildingType, owned)) {
                    this.buildOrderIndex++;
                }
            }
        }
    }

    manageProduction(owned) {
        const barracks = owned.buildings.filter(b => b.type === 'BARRACKS' && b.isAlive());
        const factories = owned.buildings.filter(b => b.type === 'WAR_FACTORY' && b.isAlive());
        const airfields = owned.buildings.filter(b => b.type === 'AIRFIELD' && b.isAlive());

        const infantry = owned.units.filter(u => u.stats.category === 'infantry').length;
        const vehicles = owned.units.filter(u => u.stats.category === 'vehicle' && !u.isHarvester).length;
        const air = owned.units.filter(u => u.stats.category === 'air').length;

        // Produce infantry
        if (infantry < this.militaryTargets.infantry) {
            for (const building of barracks) {
                if (building.productionQueue.length === 0 && !building.currentProduction) {
                    const unitType = this.player.unlockedTiers.includes(2) ? 'ROCKET_SOLDIER' : 'RIFLEMAN';
                    const stats = UNIT_TYPES[unitType];

                    if (this.player.canAfford(stats.cost)) {
                        this.player.spend(stats.cost);
                        building.addToQueue(unitType, stats);
                        break;
                    }
                }
            }
        }

        // Produce vehicles
        if (vehicles < this.militaryTargets.vehicles) {
            for (const building of factories) {
                if (building.productionQueue.length === 0 && !building.currentProduction) {
                    let unitType = 'LIGHT_TANK';

                    if (this.player.unlockedTiers.includes(3)) {
                        unitType = Math.random() > 0.5 ? 'HEAVY_TANK' : 'ARTILLERY';
                    } else if (this.player.unlockedTiers.includes(2)) {
                        unitType = 'MEDIUM_TANK';
                    }

                    const stats = UNIT_TYPES[unitType];

                    if (this.player.canAfford(stats.cost)) {
                        this.player.spend(stats.cost);
                        building.addToQueue(unitType, stats);
                        break;
                    }
                }
            }
        }

        // Produce air units
        if (air < 3 && airfields.length > 0) {
            for (const building of airfields) {
                if (building.productionQueue.length === 0 && !building.currentProduction) {
                    const stats = UNIT_TYPES['HELICOPTER'];

                    if (this.player.canAfford(stats.cost)) {
                        this.player.spend(stats.cost);
                        building.addToQueue('HELICOPTER', stats);
                        break;
                    }
                }
            }
        }
    }

    manageMilitary(owned) {
        const combatUnits = owned.units.filter(u => u.stats.damage && !u.isHarvester);

        if (combatUnits.length >= this.config.attackThreshold) {
            this.state = 'attack';
            if (DEBUG_LOGGING.AI_ATTACKING) {
                console.log(`[AI ${this.difficulty}] Attack threshold reached (${combatUnits.length}/${this.config.attackThreshold}) - launching attack`);
            }
            this.launchAttack(combatUnits);
        } else {
            // Defensive posture
            this.state = 'defend';

            for (const unit of combatUnits) {
                if (!unit.targetEnemy && !unit.path) {
                    const hq = owned.buildings.find(b => b.stats.isHQ);
                    if (hq) {
                        const defendPos = this.getDefendPosition(hq);
                        unit.moveTo(defendPos.x, defendPos.y, this.game);
                    }
                }
            }
        }
    }

    launchAttack(combatUnits) {
        // Find enemy base
        const enemyHQ = this.findEnemyHQ();
        if (!enemyHQ) return;

        const rallyPoint = this.getRallyPoint(enemyHQ);

        for (const unit of combatUnits) {
            if (!unit.targetEnemy) {
                // Add some randomness to attack positions
                const offset = 5;
                const attackX = rallyPoint.x + getRandomInt(-offset, offset) * TILE_SIZE;
                const attackY = rallyPoint.y + getRandomInt(-offset, offset) * TILE_SIZE;

                unit.attackMove(attackX, attackY, this.game);
            }
        }
    }

    manageDefense(owned) {
        const defenses = owned.buildings.filter(b => b.stats.isDefense).length;

        if (defenses < this.militaryTargets.defenses) {
            if (Math.random() > 0.5) {
                this.tryBuildBuilding('GUN_TURRET', owned);
            } else if (this.player.unlockedTiers.includes(2)) {
                this.tryBuildBuilding('AA_TURRET', owned);
            }
        }

        // Build advanced structures
        if (this.player.credits > AI_BEHAVIOR.EXPANSION_CREDIT_THRESHOLD && this.player.unlockedTiers.includes(2)) {
            const hasAirfield = owned.buildings.some(b => b.type === 'AIRFIELD');
            const hasAdvancedTech = owned.buildings.some(b => b.type === 'ADVANCED_TECH');

            if (!hasAirfield) {
                this.tryBuildBuilding('AIRFIELD', owned);
            } else if (!hasAdvancedTech) {
                this.tryBuildBuilding('ADVANCED_TECH', owned);
            }
        }

        // Build superweapon
        if (this.player.credits > AI_BEHAVIOR.SUPERWEAPON_CREDIT_THRESHOLD && this.player.unlockedTiers.includes(3)) {
            const hasSuperweapon = owned.buildings.some(b => b.stats.isSuperweapon);
            if (!hasSuperweapon) {
                this.tryBuildBuilding('SUPERWEAPON', owned);
            }
        }
    }

    sendScouts(owned) {
        // Send 1-2 light units to explore the map
        const availableScouts = owned.units.filter(u =>
            (u.stats.category === 'infantry' || u.stats.category === 'vehicle') &&
            !u.path &&
            !u.targetEnemy
        ).slice(0, 2);

        if (availableScouts.length === 0) return;

        if (DEBUG_LOGGING.AI_SCOUTING) {
            console.log(`[AI ${this.difficulty}] Sending ${availableScouts.length} scouts to explore map`);
        }

        for (const scout of availableScouts) {
            const currentPos = worldToTile(scout.x, scout.y);
            const scoutPos = this.getScoutLocation();
            const scoutTile = worldToTile(scoutPos.x, scoutPos.y);
            const distanceToTarget = distance(currentPos.x, currentPos.y, scoutTile.x, scoutTile.y);

            if (DEBUG_LOGGING.AI_SCOUTING) {
                console.log(`[AI ${this.difficulty}] Scout ${scout.type} from (${currentPos.x}, ${currentPos.y}) → (${scoutTile.x}, ${scoutTile.y}) [${Math.floor(distanceToTarget)} tiles away]`);
            }

            scout.moveTo(scoutPos.x, scoutPos.y, this.game);
            this.scoutTargets.push(scoutPos);
        }

        // Clear old scout targets (keep last 5)
        if (this.scoutTargets.length > 5) {
            this.scoutTargets = this.scoutTargets.slice(-5);
        }
    }

    spreadUnits(owned) {
        // Spread ALL idle combat units around base perimeter to prevent bunching
        const idleUnits = owned.units.filter(u =>
            u.stats.damage &&
            !u.isHarvester &&
            !u.path &&
            !u.targetEnemy &&
            this.state !== 'attack' &&
            this.state !== 'mass_attack'
        );

        if (idleUnits.length === 0) return;

        const hq = owned.buildings.find(b => b.stats.isHQ);
        if (!hq) return;

        if (DEBUG_LOGGING.AI_SPREADING) {
            console.log(`[AI ${this.difficulty}] Spreading ${idleUnits.length} idle units around perimeter`);
        }

        // Distribute ALL units in a larger circle around HQ
        const spreadRadius = 18; // tiles from HQ (increased from 12)
        const angleStep = (Math.PI * 2) / idleUnits.length; // Divide evenly

        for (let i = 0; i < idleUnits.length; i++) {
            const angle = i * angleStep;
            // Add some randomness to radius for natural positioning
            const randomOffset = getRandomInt(-3, 3);
            const finalRadius = (spreadRadius + randomOffset) * TILE_SIZE;
            const spreadX = hq.x + Math.cos(angle) * finalRadius;
            const spreadY = hq.y + Math.sin(angle) * finalRadius;

            idleUnits[i].moveTo(spreadX, spreadY, this.game);
        }
    }

    launchMassAttack(owned) {
        // Full assault - send ALL combat units to attack
        const allCombatUnits = owned.units.filter(u => u.stats.damage && !u.isHarvester);

        const enemyHQ = this.findEnemyHQ();
        if (!enemyHQ) {
            if (DEBUG_LOGGING.AI_ATTACKING) {
                console.log(`[AI ${this.difficulty}] No enemy target found for mass attack`);
            }
            return;
        }

        if (DEBUG_LOGGING.AI_ATTACKING) {
            console.log(`[AI ${this.difficulty}] Mass attack: sending ${allCombatUnits.length} units to enemy HQ`);
        }

        // Attack in waves from different angles
        const waveCount = 3;
        const unitsPerWave = Math.ceil(allCombatUnits.length / waveCount);

        for (let wave = 0; wave < waveCount; wave++) {
            const waveUnits = allCombatUnits.slice(wave * unitsPerWave, (wave + 1) * unitsPerWave);
            const waveAngle = (wave / waveCount) * Math.PI * 2;
            const offset = 20;

            for (const unit of waveUnits) {
                const attackX = enemyHQ.x + Math.cos(waveAngle) * offset * TILE_SIZE + getRandomInt(-5, 5) * TILE_SIZE;
                const attackY = enemyHQ.y + Math.sin(waveAngle) * offset * TILE_SIZE + getRandomInt(-5, 5) * TILE_SIZE;
                unit.attackMove(attackX, attackY, this.game);
            }
        }
    }

    rejoinMassAttack(owned) {
        // Send idle units to rejoin the mass attack
        const idleUnits = owned.units.filter(u =>
            u.stats.damage &&
            !u.isHarvester &&
            !u.path &&
            !u.targetEnemy
        );

        if (idleUnits.length === 0) return;

        const enemyHQ = this.findEnemyHQ();
        if (!enemyHQ) return;

        if (DEBUG_LOGGING.AI_ATTACKING) {
            console.log(`[AI ${this.difficulty}] Rejoining mass attack: sending ${idleUnits.length} idle units`);
        }

        // Send idle units to attack enemy HQ
        for (const unit of idleUnits) {
            const attackX = enemyHQ.x + getRandomInt(-10, 10) * TILE_SIZE;
            const attackY = enemyHQ.y + getRandomInt(-10, 10) * TILE_SIZE;
            unit.attackMove(attackX, attackY, this.game);
        }
    }

    considerExpansion(owned) {
        const refineries = owned.buildings.filter(b => b.stats.isRefinery).length;

        if (this.player.credits > AI_BEHAVIOR.EXPANSION_CREDIT_THRESHOLD && refineries < 3) {
            this.tryBuildBuilding('REFINERY', owned);
        }
    }

    tryBuildBuilding(buildingType, owned) {
        const stats = BUILDING_TYPES[buildingType];

        if (!this.player.canBuild(buildingType, false)) {
            return false;
        }

        // Find MCV or use HQ location
        let baseX, baseY;
        const hq = owned.buildings.find(b => b.stats.isHQ);

        if (hq) {
            baseX = hq.tileX;
            baseY = hq.tileY;
        } else {
            return false;
        }

        // Find build location near base
        const location = this.findBuildLocation(baseX, baseY, stats.width, stats.height);
        if (!location) return false;

        // Build it
        if (this.player.spend(stats.cost)) {
            const building = new Building(location.x, location.y, buildingType, stats, this.player);
            this.game.buildings.push(building);
            this.game.map.setBuilding(location.x, location.y, stats.width, stats.height, building);
            return true;
        }

        return false;
    }

    tryTrainUnit(unitType, owned) {
        const stats = UNIT_TYPES[unitType];

        if (!this.player.canAfford(stats.cost)) return false;

        // Find appropriate production building
        let productionBuilding = null;

        if (unitType === 'HARVESTER') {
            const refineries = owned.buildings.filter(b => b.stats.isRefinery && b.isAlive());
            productionBuilding = refineries.find(b => b.productionQueue.length === 0 && !b.currentProduction);
        }

        if (productionBuilding && this.player.spend(stats.cost)) {
            productionBuilding.addToQueue(unitType, stats);
            return true;
        }

        return false;
    }

    findBuildLocation(baseX, baseY, width, height) {
        const searchRadius = 15;

        for (let r = 3; r < searchRadius; r++) {
            for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
                const x = Math.floor(baseX + Math.cos(angle) * r);
                const y = Math.floor(baseY + Math.sin(angle) * r);

                if (canPlaceBuilding(this.game.map, x, y, width, height, this.player, this.game)) {
                    return { x, y };
                }
            }
        }

        return null;
    }

    getDefendPosition(hq) {
        const offset = 10;
        return {
            x: hq.x + getRandomInt(-offset, offset) * TILE_SIZE,
            y: hq.y + getRandomInt(-offset, offset) * TILE_SIZE,
        };
    }

    getRallyPoint(target) {
        const offset = 15;
        return {
            x: target.x + getRandomInt(-offset, offset) * TILE_SIZE,
            y: target.y + getRandomInt(-offset, offset) * TILE_SIZE,
        };
    }

    findEnemyHQ() {
        for (const building of this.game.buildings) {
            if (building.owner !== this.player && building.stats.isHQ && building.isAlive()) {
                return building;
            }
        }

        // If no HQ, find any enemy building
        for (const building of this.game.buildings) {
            if (building.owner !== this.player && building.isAlive()) {
                return building;
            }
        }

        return null;
    }

    getScoutLocation() {
        // Try to find unexplored areas
        const mapWidth = this.game.map.width;
        const mapHeight = this.game.map.height;
        const margin = 10;

        let attempts = 0;
        let scoutPos;

        while (attempts < 10) {
            scoutPos = {
                x: getRandomInt(margin, mapWidth - margin) * TILE_SIZE,
                y: getRandomInt(margin, mapHeight - margin) * TILE_SIZE,
            };

            // Check if this area has been scouted recently
            const tooClose = this.scoutTargets.some(target => {
                const dist = distance(scoutPos.x, scoutPos.y, target.x, target.y);
                return dist < 20 * TILE_SIZE; // Avoid scouting same area
            });

            if (!tooClose) {
                return scoutPos;
            }

            attempts++;
        }

        // If can't find new area, just return random location
        return scoutPos;
    }
}
