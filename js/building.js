// Building class and production

class Building extends Entity {
    constructor(tileX, tileY, type, stats, owner) {
        const worldPos = tileToWorld(tileX + stats.width / 2, tileY + stats.height / 2);
        super(worldPos.x, worldPos.y, type, stats, owner);

        this.tileX = tileX;
        this.tileY = tileY;
        this.productionQueue = [];
        this.currentProduction = null;
        this.productionProgress = 0;
        this.rallyPoint = { x: worldPos.x, y: worldPos.y + stats.height * TILE_SIZE };
        this.lastAttack = 0;
        this.hasSpawnedHarvester = false;  // For refineries

        // Construction system
        this.isUnderConstruction = stats.buildTime > 0;  // Buildings with buildTime > 0 need construction
        this.constructionProgress = 0;
        this.constructionTime = stats.buildTime || 0;
        this.isOperational = !this.isUnderConstruction;  // Operational when construction complete
    }

    update(deltaTime, game) {
        if (!this.isAlive()) return;

        // Handle construction
        if (this.isUnderConstruction) {
            this.updateConstruction(deltaTime, game);
            return;  // Don't update other systems while under construction
        }

        // Refinery auto-spawn harvester when built
        if (this.stats.isRefinery && !this.hasSpawnedHarvester && this.getHealthPercent() >= 1.0) {
            this.spawnHarvester(game);
            this.hasSpawnedHarvester = true;
        }

        // Update production (only if operational)
        if (this.stats.produces && this.isOperational) {
            this.updateProduction(deltaTime, game);
        }

        // Defense buildings attack (only if operational)
        if (this.stats.isDefense && this.stats.damage && this.isOperational) {
            this.updateDefense(deltaTime, game);
        }

        // Repair Bay repairs vehicles/air units (only if operational)
        if (this.stats.isRepairBay && this.isOperational) {
            this.updateRepairBay(deltaTime, game);
        }
    }

    updateConstruction(deltaTime, game) {
        // Calculate construction speed based on power
        const powerRatio = this.owner.getPowerRatio();
        let constructionSpeed = CONSTRUCTION_CONFIG.BASE_SPEED;

        if (powerRatio < 1.0) {
            // Low power penalty
            constructionSpeed = CONSTRUCTION_CONFIG.LOW_POWER_PENALTY;
        } else if (powerRatio > 1.5) {
            // High power bonus
            constructionSpeed = CONSTRUCTION_CONFIG.HIGH_POWER_BONUS;
        }

        // Update construction progress
        this.constructionProgress += (deltaTime / 1000) * constructionSpeed;

        if (this.constructionProgress >= this.constructionTime) {
            // Construction complete
            this.isUnderConstruction = false;
            this.isOperational = true;
            this.constructionProgress = this.constructionTime;
        }
    }

    getConstructionPercent() {
        if (!this.isUnderConstruction) return 1.0;
        return this.constructionProgress / this.constructionTime;
    }

    updateProduction(deltaTime, game) {
        if (!this.currentProduction && this.productionQueue.length > 0) {
            this.currentProduction = this.productionQueue.shift();
            this.productionProgress = 0;
        }

        if (this.currentProduction) {
            // Check if spawn location is available - pause if blocked
            const spawnAvailable = this.findSpawnLocation(game) !== null;
            if (!spawnAvailable) {
                // Pause production - don't increment progress
                return;
            }

            // Check power - significantly slow down if low power
            const powerRatio = this.owner.getPowerRatio();
            const productionSpeed = powerRatio >= 1 ? 1 : powerRatio * 0.25; // 25% speed when low power

            this.productionProgress += (deltaTime / 1000) * productionSpeed;

            const buildTime = this.currentProduction.stats.buildTime;
            if (this.productionProgress >= buildTime) {
                this.spawnUnit(this.currentProduction, game);
                this.currentProduction = null;
                this.productionProgress = 0;
            }
        }
    }

    spawnUnit(unitData, game) {
        // Find spawn location near building
        const spawnTile = this.findSpawnLocation(game);
        if (!spawnTile) {
            // Re-queue if no space
            this.productionQueue.unshift(unitData);
            this.currentProduction = null;
            return;
        }

        const spawnPos = tileToWorld(spawnTile.x, spawnTile.y);
        const unit = new Unit(spawnPos.x, spawnPos.y, unitData.type, unitData.stats, this.owner);

        // Move to rally point
        unit.moveTo(this.rallyPoint.x, this.rallyPoint.y, game);

        game.units.push(unit);
        game.map.setUnit(spawnTile.x, spawnTile.y, unit);
    }

    findSpawnLocation(game) {
        // Check 1-tile perimeter around building footprint
        const tiles = [];

        // Top and bottom edges
        for (let x = this.tileX - 1; x <= this.tileX + this.stats.width; x++) {
            tiles.push({ x, y: this.tileY - 1 }); // Top
            tiles.push({ x, y: this.tileY + this.stats.height }); // Bottom
        }

        // Left and right edges (excluding corners already added)
        for (let y = this.tileY; y < this.tileY + this.stats.height; y++) {
            tiles.push({ x: this.tileX - 1, y }); // Left
            tiles.push({ x: this.tileX + this.stats.width, y }); // Right
        }

        // Check each perimeter tile
        for (const pos of tiles) {
            const tile = game.map.getTile(pos.x, pos.y);
            if (tile && !tile.blocked && !tile.unit) {
                return { x: pos.x, y: pos.y };
            }
        }

        return null;
    }

    addToQueue(unitType, unitStats) {
        this.productionQueue.push({
            type: unitType,
            stats: unitStats,
        });
    }

    cancelProduction(index) {
        if (index === -1 && this.currentProduction) {
            // Cancel current production
            this.owner.credits += Math.floor(this.currentProduction.stats.cost * 0.8);
            this.currentProduction = null;
            this.productionProgress = 0;
        } else if (index >= 0 && index < this.productionQueue.length) {
            // Cancel queued item
            const item = this.productionQueue.splice(index, 1)[0];
            this.owner.credits += item.stats.cost;
        }
    }

    setRallyPoint(x, y) {
        this.rallyPoint = { x, y };
    }

    updateDefense(deltaTime, game) {
        const now = Date.now();
        const attackSpeed = (this.stats.attackSpeed || 1) * 1000;

        if (now - this.lastAttack < attackSpeed) {
            return;
        }

        const target = this.findTarget(game);
        if (target) {
            this.performAttack(target, game);
            this.lastAttack = now;
        }
    }

    findTarget(game) {
        const range = (this.stats.range || 5) * TILE_SIZE;
        let nearest = null;
        let nearestDist = Infinity;

        for (const unit of game.units) {
            if (unit.owner === this.owner || !unit.isAlive()) continue;

            const dist = distance(this.x, this.y, unit.x, unit.y);
            if (dist <= range && dist < nearestDist) {
                // AA turrets prioritize air units
                if (this.stats.damageType === 'aa') {
                    if (unit.stats.category === 'air') {
                        nearest = unit;
                        nearestDist = dist;
                    }
                } else {
                    nearest = unit;
                    nearestDist = dist;
                }
            }
        }

        return nearest;
    }

    performAttack(target, game) {
        if (!target || !target.isAlive()) return;

        let damage = this.stats.damage || 0;

        const damageType = this.stats.damageType || 'shell';
        const armorType = target.stats.armor || 'none';

        if (DAMAGE_MULTIPLIERS[damageType] && DAMAGE_MULTIPLIERS[damageType][armorType]) {
            damage *= DAMAGE_MULTIPLIERS[damageType][armorType];
        }

        damage = Math.floor(damage);

        const destroyed = target.takeDamage(damage);

        if (destroyed) {
            const tile = worldToTile(target.x, target.y);
            game.map.clearUnit(tile.x, tile.y);
            const index = game.units.indexOf(target);
            if (index !== -1) {
                game.units.splice(index, 1);
            }
        }
    }

    canProduce(unitType) {
        if (!this.stats.produces) return false;

        const unitStats = UNIT_TYPES[unitType];
        if (!unitStats) return false;

        // Check if building produces this category
        return this.stats.produces.includes(unitStats.category);
    }

    getProductionProgress() {
        if (!this.currentProduction) return 0;
        return this.productionProgress / this.currentProduction.stats.buildTime;
    }

    spawnHarvester(game) {
        if (!UNIT_TYPES['HARVESTER']) return;

        const harvesterStats = UNIT_TYPES['HARVESTER'];
        const spawnTile = this.findSpawnLocation(game);

        if (!spawnTile) return;  // No space to spawn

        const spawnPos = tileToWorld(spawnTile.x, spawnTile.y);
        const harvester = new Unit(spawnPos.x, spawnPos.y, 'HARVESTER', harvesterStats, this.owner);
        harvester.homeRefinery = this;  // Assign to this refinery

        game.units.push(harvester);
        game.map.setUnit(spawnTile.x, spawnTile.y, harvester);

        if (!this.owner.isAI) {
            showNotification('Harvester deployed from Refinery');
        }
    }

    updateRepairBay(deltaTime, game) {
        const repairRange = (this.stats.repairRange || 3) * TILE_SIZE;
        const repairRate = this.stats.repairRate || 5;

        // Find nearby damaged vehicles/air units
        for (const unit of game.units) {
            if (unit.owner !== this.owner || !unit.isAlive()) continue;
            if (unit.stats.category !== 'vehicle' && unit.stats.category !== 'air') continue;
            if (unit.getHealthPercent() >= 1.0) continue;

            const dist = distance(this.x, this.y, unit.x, unit.y);
            if (dist <= repairRange) {
                unit.heal(repairRate * (deltaTime / 1000));
                break; // Repair one unit at a time
            }
        }
    }
}
