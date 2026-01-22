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
        this.productionPaused = false;  // Allow pausing production
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
        // Don't update if paused
        if (this.productionPaused) return;

        if (!this.currentProduction && this.productionQueue.length > 0) {
            // Check airplane limit before starting production
            const nextItem = this.productionQueue[0];
            if (nextItem && nextItem.type === 'AIRPLANE' && this.type === 'AIRFIELD') {
                const existingAirplane = game.units.find(u => 
                    u.isAirplane && u.homeAirfield === this && u.isAlive()
                );
                if (existingAirplane) {
                    // Remove from queue if limit reached
                    this.productionQueue.shift();
                    if (!this.owner.isAI) {
                        showNotification('Airfield can only support 1 airplane');
                    }
                    return;
                }
            }
            
            this.currentProduction = this.productionQueue.shift();
            this.productionProgress = 0;
        }

        if (this.currentProduction) {
            // Check if spawn location is available - pause if blocked
            // For PORT buildings producing naval units, check water spawn location
            let spawnAvailable = false;
            if (this.type === 'PORT' && this.currentProduction.stats.category === 'naval') {
                spawnAvailable = this.findWaterSpawnLocation(game) !== null;
            } else {
                spawnAvailable = this.findSpawnLocation(game) !== null;
            }
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

    toggleProduction() {
        this.productionPaused = !this.productionPaused;
        return this.productionPaused;
    }

    spawnUnit(unitData, game) {
        // For PORT buildings producing naval units, use findWaterSpawnLocation
        // For other buildings, use findSpawnLocation
        let spawnTile = null;
        if (this.type === 'PORT' && unitData.stats.category === 'naval') {
            spawnTile = this.findWaterSpawnLocation(game);
        } else {
            spawnTile = this.findSpawnLocation(game);
        }
        
        if (!spawnTile) {
            // Re-queue if no space
            this.productionQueue.unshift(unitData);
            this.currentProduction = null;
            return;
        }

        // Charge credits when unit finishes building
        if (!this.owner.spend(unitData.stats.cost)) {
            // Can't afford - re-queue
            this.productionQueue.unshift(unitData);
            this.currentProduction = null;
            if (!this.owner.isAI) {
                showNotification('Insufficient credits to complete unit');
            }
            return;
        }

        // For naval units, spawn on water if PORT
        let spawnPos;
        let spawnTileForNaval = null;
        if (this.type === 'PORT' && unitData.stats.category === 'naval') {
            // Find water tile adjacent to port or on port itself
            const waterTile = this.findWaterSpawnLocation(game);
            if (waterTile) {
                spawnPos = tileToWorld(waterTile.x, waterTile.y);
                spawnTileForNaval = waterTile;
            } else {
                // No water tile found - this shouldn't happen for PORT, but fallback
                spawnPos = tileToWorld(spawnTile.x, spawnTile.y);
                spawnTileForNaval = spawnTile;
            }
        } else {
            spawnPos = tileToWorld(spawnTile.x, spawnTile.y);
        }
        
        const unit = new Unit(spawnPos.x, spawnPos.y, unitData.type, unitData.stats, this.owner);

        // Airplane-specific: assign home airfield and check limit
        if (unit.isAirplane) {
            // Check if airfield already has an airplane
            const existingAirplane = game.units.find(u => 
                u.isAirplane && u.homeAirfield === this && u.isAlive()
            );
            if (existingAirplane) {
                // Already has an airplane - re-queue
                this.productionQueue.unshift(unitData);
                this.currentProduction = null;
                if (!this.owner.isAI) {
                    showNotification('Airfield can only support 1 airplane');
                }
                return;
            }
            unit.homeAirfield = this;
            unit.flyByState = 'idle';
            // Spawn airplane on top of airfield in landed state
            unit.x = this.x;
            unit.y = this.y;
            unit.landed = true;
            unit.velocity.x = 0;
            unit.velocity.y = 0;
            // Update map position for airplane
            const airfieldTile = worldToTile(this.x, this.y);
            game.map.setUnit(airfieldTile.x, airfieldTile.y, unit);
        } else {
            // Move to rally point
            unit.moveTo(this.rallyPoint.x, this.rallyPoint.y, game);
        }

        game.units.push(unit);
        
        // Set unit on map - naval units need to be placed on water tiles
        if (unit.isAirplane) {
            // Already set above
        } else if (unit.stats.category === 'naval') {
            // Naval units: use the water tile we found, or find nearest water tile
            if (spawnTileForNaval && game.map.isWater(spawnTileForNaval.x, spawnTileForNaval.y)) {
                game.map.setUnit(spawnTileForNaval.x, spawnTileForNaval.y, unit);
            } else {
                // Fallback: find nearest water tile
                const finalSpawnTile = worldToTile(unit.x, unit.y);
                if (game.map.isWater(finalSpawnTile.x, finalSpawnTile.y)) {
                    game.map.setUnit(finalSpawnTile.x, finalSpawnTile.y, unit);
                } else {
                    // Find nearest water tile
                    const waterTile = this.findWaterSpawnLocation(game);
                    if (waterTile) {
                        unit.x = tileToWorld(waterTile.x, waterTile.y).x;
                        unit.y = tileToWorld(waterTile.x, waterTile.y).y;
                        game.map.setUnit(waterTile.x, waterTile.y, unit);
                    }
                }
            }
        } else {
            // Non-naval units
            const finalSpawnTile = worldToTile(unit.x, unit.y);
            game.map.setUnit(finalSpawnTile.x, finalSpawnTile.y, unit);
        }

        // Track stats for human player
        if (this.owner === game.humanPlayer && game.stats) {
            game.stats.unitsBuilt++;
            game.stats.unitsBuiltByType[unitData.type] = (game.stats.unitsBuiltByType[unitData.type] || 0) + 1;
            game.stats.moneySpent += unitData.stats.cost;
        }
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

    findWaterSpawnLocation(game) {
        // For PORT, find water tile adjacent to building or on building itself (since PORT allows units on top)
        const tiles = [];
        
        // First, check if PORT itself is on water tiles (if built on water)
        for (let x = this.tileX; x < this.tileX + this.stats.width; x++) {
            for (let y = this.tileY; y < this.tileY + this.stats.height; y++) {
                if (game.map.isWater(x, y)) {
                    // Check if tile is free (no unit)
                    const tile = game.map.getTile(x, y);
                    if (tile && !tile.unit) {
                        tiles.push({ x, y });
                    }
                }
            }
        }
        
        // Also check perimeter for water tiles
        for (let x = this.tileX - 2; x <= this.tileX + this.stats.width + 1; x++) {
            for (let y = this.tileY - 2; y <= this.tileY + this.stats.height + 1; y++) {
                // Skip tiles that are part of the building (already checked above)
                if (x >= this.tileX && x < this.tileX + this.stats.width && 
                    y >= this.tileY && y < this.tileY + this.stats.height) {
                    continue;
                }
                if (game.map.isWater(x, y)) {
                    const tile = game.map.getTile(x, y);
                    if (tile && !tile.unit) {
                        tiles.push({ x, y });
                    }
                }
            }
        }
        
        // Return nearest water tile
        if (tiles.length > 0) {
            const centerX = this.tileX + this.stats.width / 2;
            const centerY = this.tileY + this.stats.height / 2;
            tiles.sort((a, b) => {
                const distA = Math.abs(a.x - centerX) + Math.abs(a.y - centerY);
                const distB = Math.abs(b.x - centerX) + Math.abs(b.y - centerY);
                return distA - distB;
            });
            return tiles[0];
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
            // Cancel current production - refund partial cost based on progress
            const progress = this.getProductionProgress();
            const refund = Math.floor(this.currentProduction.stats.cost * (1 - progress * 0.5)); // 50-100% refund
            this.owner.credits += refund;
            this.currentProduction = null;
            this.productionProgress = 0;
        } else if (index >= 0 && index < this.productionQueue.length) {
            // Cancel queued item - full refund (no credits charged yet)
            const item = this.productionQueue.splice(index, 1)[0];
            // No refund needed - credits weren't charged when queued
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

        // Check if building can attack air (only AA turrets can attack airplanes)
        const canAttackAir = this.stats.damageType === 'aa';

        for (const unit of game.units) {
            if (unit.owner === this.owner || !unit.isAlive()) continue;

            // Skip airplanes unless this building is an AA turret
            if (unit.isAirplane && !canAttackAir) continue;

            const dist = distance(this.x, this.y, unit.x, unit.y);
            if (dist <= range && dist < nearestDist) {
                // AA turrets prioritize air units
                if (canAttackAir) {
                    if (unit.stats.category === 'air' || unit.isAirplane) {
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

        const destroyed = target.takeDamage(damage, game);

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
