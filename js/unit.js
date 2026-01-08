// Unit class and behaviors

class Unit extends Entity {
    constructor(x, y, type, stats, owner) {
        super(x, y, type, stats, owner);

        this.targetX = x;
        this.targetY = y;
        this.path = null;
        this.pathIndex = 0;
        this.targetEnemy = null;
        this.attackCooldown = 0;
        this.stance = 'aggressive'; // aggressive, defensive, hold

        // Harvester specific
        this.isHarvester = stats.isHarvester || false;
        this.cargo = 0;
        this.targetResource = null;
        this.targetRefinery = null;
        this.homeRefinery = null;  // Assigned refinery
        this.harvestState = 'idle'; // idle, moving_to_resource, harvesting, returning

        // Stuck detection
        this.lastMovementCheck = Date.now();
        this.lastKnownPosition = { x, y };
        this.stuckCounter = 0;

        // Repath tracking
        this.repathAttempts = 0;
        this.lastRepathTime = 0;
        this.lastCombatPathTime = 0; // Track last time we pathed in combat
        this.lastTargetSearchTime = 0; // Track last enemy search

        // Collision tracking for ground units
        this.collisionCount = 0;
        this.lastCollisionTime = 0;
        this.collisionCooldown = 0;
        this.destinationChangeCount = 0;
        this.originalDestination = null;

        // Helicopter specific
        this.ammo = stats.maxAmmo || 0;
        this.maxAmmo = stats.maxAmmo || 0;
        this.needsReload = false;

        // Builder specific
        this.isBuilder = stats.isBuilder || false;
        this.buildTarget = null;
    }

    moveTo(x, y, game) {
        this.targetX = x;
        this.targetY = y;
        this.targetEnemy = null;

        const currentTile = worldToTile(this.x, this.y);
        const targetTile = worldToTile(x, y);

        const ownerType = this.owner.isAI ? 'AI' : 'Player';
        const shouldLog = ownerType === 'AI' ? DEBUG_LOGGING.AI_MOVEMENT : DEBUG_LOGGING.PLAYER_MOVEMENT;

        // Track original destination for ground units - only set if NEW move command
        if (!this.originalDestination || !this.path) {
            this.originalDestination = {x: targetTile.x, y: targetTile.y};
            this.destinationChangeCount = 0;
            this.collisionCount = 0;
            if (shouldLog) {
                console.log(`[${ownerType} ${this.type}] New destination set: (${targetTile.x}, ${targetTile.y})`);
            }
        }

        this.path = findPath(game.map, currentTile.x, currentTile.y, targetTile.x, targetTile.y, this.stats.size);
        this.pathIndex = 0;

        // Debug: Log if pathfinding failed
        if (shouldLog && !this.path) {
            console.log(`[${ownerType} ${this.type}] PATHFINDING FAILED from (${currentTile.x}, ${currentTile.y}) to (${targetTile.x}, ${targetTile.y})`);
        } else if (shouldLog && this.path) {
            console.log(`[${ownerType} ${this.type}] Path found with ${this.path.length} steps`);
        }
    }

    attackMove(x, y, game) {
        this.moveTo(x, y, game);
        this.stance = 'aggressive';
    }

    attackTarget(target) {
        this.targetEnemy = target;
        this.path = null;
    }

    stop() {
        this.path = null;
        this.targetEnemy = null;
        this.targetX = this.x;
        this.targetY = this.y;
    }

    update(deltaTime, game) {
        if (!this.isAlive()) return;

        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime;
        }

        // Stuck detection for harvesters
        if (this.isHarvester) {
            this.checkIfStuck();
        }

        // Harvester behavior
        if (this.isHarvester) {
            this.updateHarvester(deltaTime, game);
            return;
        }

        // Helicopter reload behavior
        if (this.needsReload && this.maxAmmo > 0) {
            this.updateReload(deltaTime, game);
            return;
        }

        // Medic healing behavior
        if (this.stats.isMedic) {
            this.updateMedic(deltaTime, game);
        }

        // Movement (always process if path exists)
        if (this.path && this.path.length > 0) {
            this.updateMovement(deltaTime, game);
        }

        // Combat behavior (can occur simultaneously with movement)
        if (this.stats.damage && this.stance !== 'hold') {
            this.updateCombat(deltaTime, game);
        }
    }

    checkIfStuck() {
        const now = Date.now();
        if (now - this.lastMovementCheck > 5000) {  // Check every 5 seconds
            const movedDistance = distance(this.x, this.y, this.lastKnownPosition.x, this.lastKnownPosition.y);

            if (movedDistance < 10) {  // Hasn't moved significantly
                this.stuckCounter++;
                if (this.stuckCounter >= 2) {  // Stuck for 10+ seconds
                    // Find alternative instead of retrying same action
                    if (this.harvestState === 'moving_to_resource' || this.harvestState === 'harvesting') {
                        // Try a different resource (exclude current one)
                        const oldResource = this.targetResource;
                        this.targetResource = null;
                        this.harvestState = 'idle';
                        this.path = null;
                        // Mark old resource as problematic (will try others first)
                        this.avoidResource = oldResource;
                    } else if (this.harvestState === 'returning') {
                        // Try a different refinery if possible
                        const oldRefinery = this.targetRefinery;
                        this.targetRefinery = null;
                        this.harvestState = 'idle';
                        this.path = null;
                        this.avoidRefinery = oldRefinery;
                    } else {
                        // General unstuck
                        this.harvestState = 'idle';
                        this.path = null;
                        this.targetResource = null;
                    }
                    this.stuckCounter = 0;
                }
            } else {
                this.stuckCounter = 0;
                // Clear avoidance when successfully moving
                this.avoidResource = null;
                this.avoidRefinery = null;
            }

            this.lastKnownPosition = { x: this.x, y: this.y };
            this.lastMovementCheck = now;
        }
    }

    updateMovement(deltaTime, game) {
        if (!this.path || this.pathIndex >= this.path.length) {
            // Check if we reached our destination successfully
            if (this.originalDestination && this.path === null) {
                const currentTile = worldToTile(this.x, this.y);
                const distToDest = distance(currentTile.x, currentTile.y, this.originalDestination.x, this.originalDestination.y);
                if (distToDest < 1) {
                    // Successfully reached destination - reset counters
                    const ownerType = this.owner.isAI ? 'AI' : 'Player';
                    console.log(`[${ownerType} ${this.type}] Reached destination successfully`);
                    this.destinationChangeCount = 0;
                    this.collisionCount = 0;
                    this.originalDestination = null;
                }
            }
            this.path = null;
            return;
        }

        const currentTile = this.path[this.pathIndex];
        const targetPos = tileToWorld(currentTile.x, currentTile.y);

        const dx = targetPos.x - this.x;
        const dy = targetPos.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 5) {
            this.pathIndex++;
            if (this.pathIndex >= this.path.length) {
                this.path = null;
                this.x = targetPos.x;
                this.y = targetPos.y;
                this.repathAttempts = 0;
            }
        } else {
            const speed = this.stats.speed * (deltaTime / 16);
            const norm = normalizeVector(dx, dy);

            const oldTile = worldToTile(this.x, this.y);
            const newX = this.x + norm.x * speed;
            const newY = this.y + norm.y * speed;
            const newTile = worldToTile(newX, newY);

            // Check if new tile is available
            const targetTile = game.map.getTile(newTile.x, newTile.y);
            const ignoresCollision = this.stats.ignoresCollision;

            let canMove;
            if (ignoresCollision) {
                // Helicopters check terrain and other helicopters only
                const otherHelicopter = targetTile && targetTile.unit && targetTile.unit !== this && targetTile.unit.stats.category === 'air';
                canMove = targetTile && !targetTile.blocked && !otherHelicopter;
            } else if (this.isHarvester) {
                // Harvesters ONLY check other harvesters - ignore terrain/buildings/units
                if (!targetTile) {
                    canMove = false;
                } else {
                    const otherHarvester = targetTile.unit && targetTile.unit !== this && targetTile.unit.isHarvester;
                    canMove = !otherHarvester;
                }
            } else {
                // Ground units: NEW collision system
                if (this.collisionCooldown > 0) {
                    this.collisionCooldown -= deltaTime;
                    return; // Pause movement during cooldown
                }

                // Check if tile is blocked
                // Allow movement if: tile exists AND (not blocked OR building allows units on top) AND no other unit
                const buildingAllowsUnits = targetTile && targetTile.building && targetTile.building.stats.allowsUnitsOnTop;
                const tileIsPassable = targetTile && (!targetTile.blocked || buildingAllowsUnits);
                const noOtherUnit = !targetTile || !targetTile.unit || targetTile.unit === this;

                if (tileIsPassable && noOtherUnit) {
                    canMove = true;
                } else {
                    // Collision detected!
                    this.collisionCount++;
                    const ownerType = this.owner.isAI ? 'AI' : 'Player';
                    const shouldLog = ownerType === 'AI' ? DEBUG_LOGGING.AI_MOVEMENT : DEBUG_LOGGING.PLAYER_MOVEMENT;

                    if (shouldLog) {
                        console.log(`[${ownerType} ${this.type}] Collision #${this.collisionCount} at (${newTile.x}, ${newTile.y})`);
                    }

                    if (this.collisionCount >= COLLISION_CONFIG.MAX_COLLISIONS) {
                        if (shouldLog) {
                            console.log(`[${ownerType} ${this.type}] Stopped after ${COLLISION_CONFIG.MAX_COLLISIONS} collisions`);
                        }
                        this.path = null;
                        this.collisionCount = 0;
                        this.originalDestination = null;
                        return;
                    }

                    // Set collision cooldown
                    this.collisionCooldown = COLLISION_CONFIG.COOLDOWN_MS;
                    if (shouldLog) {
                        console.log(`[${ownerType} ${this.type}] Cooldown activated for ${COLLISION_CONFIG.COOLDOWN_MS}ms`);
                    }

                    // Check if final destination is blocked
                    if (this.originalDestination) {
                        const destTile = game.map.getTile(this.originalDestination.x, this.originalDestination.y);
                        if (destTile && (destTile.unit || destTile.building)) {
                            // Destination is blocked - find new destination near ORIGINAL target
                            if (this.destinationChangeCount >= COLLISION_CONFIG.MAX_DESTINATION_CHANGES) {
                                if (shouldLog) {
                                    console.log(`[${ownerType} ${this.type}] Stopped after ${COLLISION_CONFIG.MAX_DESTINATION_CHANGES} destination changes`);
                                }
                                this.path = null;
                                this.originalDestination = null;
                                this.destinationChangeCount = 0;
                                return;
                            }

                            const emptyTile = this.findNearestEmptyTile(game, this.originalDestination.x, this.originalDestination.y);
                            if (emptyTile) {
                                this.destinationChangeCount++;
                                this.collisionCount = 0; // Reset collision count on destination change
                                if (shouldLog) {
                                    console.log(`[${ownerType} ${this.type}] Destination change #${this.destinationChangeCount}: new target (${emptyTile.x}, ${emptyTile.y}) - collision count reset`);
                                }
                                const worldPos = tileToWorld(emptyTile.x, emptyTile.y);
                                this.targetX = worldPos.x;
                                this.targetY = worldPos.y;
                                this.path = findPath(game.map, oldTile.x, oldTile.y, emptyTile.x, emptyTile.y, this.stats.size);
                                this.pathIndex = 0;
                            }
                        }
                    }
                    return; // Don't move this frame
                }
            }

            if (canMove) {
                // Harvesters push non-harvester ground units out of the way
                if (this.isHarvester && targetTile.unit && targetTile.unit !== this && !targetTile.unit.isHarvester) {
                    const blockedUnit = targetTile.unit;
                    const emptyTile = this.findAdjacentEmptyTile(game, newTile.x, newTile.y);
                    if (emptyTile) {
                        const blockedOldTile = worldToTile(blockedUnit.x, blockedUnit.y);
                        game.map.clearUnit(blockedOldTile.x, blockedOldTile.y);
                        const emptyWorldPos = tileToWorld(emptyTile.x, emptyTile.y);
                        blockedUnit.x = emptyWorldPos.x;
                        blockedUnit.y = emptyWorldPos.y;
                        game.map.setUnit(emptyTile.x, emptyTile.y, blockedUnit);
                    }
                }

                this.x = newX;
                this.y = newY;

                // Update map (ground units and harvesters)
                if (!ignoresCollision && (oldTile.x !== newTile.x || oldTile.y !== newTile.y)) {
                    game.map.clearUnit(oldTile.x, oldTile.y);
                    game.map.setUnit(newTile.x, newTile.y, this);
                } else if (this.isHarvester && (oldTile.x !== newTile.x || oldTile.y !== newTile.y)) {
                    game.map.clearUnit(oldTile.x, oldTile.y);
                    game.map.setUnit(newTile.x, newTile.y, this);
                }
            } else if (ignoresCollision || this.isHarvester) {
                // Helicopters and harvesters repath when truly blocked
                const now = Date.now();
                if (now - this.lastRepathTime > 1000) {
                    this.repathAttempts++;
                    this.lastRepathTime = now;

                    if (this.repathAttempts < 10) {
                        const destTile = this.path[this.path.length - 1];
                        this.path = findPath(game.map, oldTile.x, oldTile.y, destTile.x, destTile.y, this.stats.size);
                        this.pathIndex = 0;
                    } else {
                        this.path = null;
                        this.repathAttempts = 0;
                    }
                }
            }
        }
    }

    updateCombat(deltaTime, game) {
        // If unit has a movement path (player-issued move command), allow movement to override combat
        // Only auto-engage if unit doesn't have an active movement path
        if (this.path && this.path.length > 0 && !this.targetEnemy) {
            // Unit is moving somewhere (not chasing enemy) - don't auto-acquire targets
            return;
        }

        // Find target if we don't have one
        if (!this.targetEnemy || !this.targetEnemy.isAlive() || this.targetEnemy.owner === this.owner) {
            // Only auto-acquire if aggressive stance (already the default)
            // Throttle target searches to reduce performance impact
            const now = Date.now();
            const canSearchForTarget = now - this.lastTargetSearchTime > UNIT_BEHAVIOR.TARGET_SEARCH_COOLDOWN;

            if (this.stance === 'aggressive' && !this.path && canSearchForTarget) {
                this.targetEnemy = this.findNearestEnemy(game);
                this.lastTargetSearchTime = now;
            }

            if (!this.targetEnemy) {
                return;
            }
        }

        const dist = distance(this.x, this.y, this.targetEnemy.x, this.targetEnemy.y);
        const range = (this.stats.range || 1) * TILE_SIZE;

        // Move towards enemy if out of range
        if (dist > range) {
            // Only recalculate path if we don't have one AND enough time has passed (throttle pathfinding)
            const now = Date.now();
            const needsNewPath = !this.path || this.pathIndex >= this.path.length;
            const cooldownExpired = now - this.lastCombatPathTime > UNIT_BEHAVIOR.COMBAT_PATH_COOLDOWN;

            if (needsNewPath && cooldownExpired) {
                const currentTile = worldToTile(this.x, this.y);
                const targetTile = worldToTile(this.targetEnemy.x, this.targetEnemy.y);
                this.path = findPath(game.map, currentTile.x, currentTile.y, targetTile.x, targetTile.y, this.stats.size);
                this.pathIndex = 0;
                this.lastCombatPathTime = now;
            }

            if (this.path) {
                this.updateMovement(deltaTime, game);
            }
        } else {
            // In range, attack
            this.path = null;

            if (this.attackCooldown <= 0) {
                this.performAttack(this.targetEnemy, game);
                this.attackCooldown = (this.stats.attackSpeed || 1) * 1000;
            }
        }
    }

    performAttack(target, game) {
        if (!target || !target.isAlive()) return;

        // Check ammo for helicopters
        if (this.maxAmmo > 0) {
            if (this.ammo <= 0) {
                this.needsReload = true;
                return;
            }
            this.ammo--;
            if (this.ammo === 0) {
                this.needsReload = true;
            }
        }

        // Calculate damage
        let damage = this.stats.damage || 0;

        // Apply damage multipliers
        const damageType = this.stats.damageType || 'bullet';
        const armorType = target.stats.armor || 'none';

        if (DAMAGE_MULTIPLIERS[damageType] && DAMAGE_MULTIPLIERS[damageType][armorType]) {
            damage *= DAMAGE_MULTIPLIERS[damageType][armorType];
        }

        // Air units can only be hit by AA
        if (target.stats.category === 'air' && damageType !== 'aa' && damageType !== 'rocket') {
            damage *= 0.3;
        }

        damage = Math.floor(damage);

        // Grenadier splash damage
        if (this.stats.splashRadius && this.stats.splashRadius > 0) {
            this.applySplashDamage(target, damage, game);
            return;
        }

        const destroyed = target.takeDamage(damage);

        if (destroyed) {
            this.gainExperience();
            this.targetEnemy = null;

            // Remove from game
            if (target instanceof Unit) {
                const tile = worldToTile(target.x, target.y);
                game.map.clearUnit(tile.x, tile.y);
                const index = game.units.indexOf(target);
                if (index !== -1) {
                    game.units.splice(index, 1);
                }
            } else if (target instanceof Building) {
                game.map.clearBuilding(target.tileX, target.tileY, target.stats.width, target.stats.height);
                const index = game.buildings.indexOf(target);
                if (index !== -1) {
                    game.buildings.splice(index, 1);
                }

                // Check for HQ destruction
                if (target.stats.isHQ) {
                    game.checkVictoryCondition();
                }
            }
        }
    }

    findNearestEnemy(game) {
        let nearest = null;
        let nearestDist = Infinity;
        const searchRadius = (this.stats.sight || SIGHT_RANGE) * TILE_SIZE;

        // Check units
        for (const unit of game.units) {
            if (unit.owner === this.owner || !unit.isAlive()) continue;

            const dist = distance(this.x, this.y, unit.x, unit.y);
            if (dist < searchRadius && dist < nearestDist) {
                nearest = unit;
                nearestDist = dist;
            }
        }

        // Check buildings
        for (const building of game.buildings) {
            if (building.owner === this.owner || !building.isAlive()) continue;

            const dist = distance(this.x, this.y, building.x, building.y);
            if (dist < searchRadius && dist < nearestDist) {
                nearest = building;
                nearestDist = dist;
            }
        }

        return nearest;
    }

    updateHarvester(deltaTime, game) {
        switch (this.harvestState) {
            case 'idle':
                // Find nearest resource node
                this.targetResource = this.findNearestResource(game);
                if (this.targetResource) {
                    this.harvestState = 'moving_to_resource';
                    const resourcePos = tileToWorld(this.targetResource.x, this.targetResource.y);
                    this.moveTo(resourcePos.x, resourcePos.y, game);
                }
                break;

            case 'moving_to_resource':
                this.updateMovement(deltaTime, game);
                if (!this.path && this.targetResource) {
                    const dist = distance(this.x, this.y,
                        this.targetResource.x * TILE_SIZE,
                        this.targetResource.y * TILE_SIZE);
                    if (dist < TILE_SIZE * 2) {
                        this.harvestState = 'harvesting';
                    }
                }
                break;

            case 'harvesting':
                if (!this.targetResource || this.targetResource.resources <= 0) {
                    this.harvestState = 'idle';
                    this.targetResource = null;
                } else {
                    const harvested = game.map.harvestResource(this.targetResource, RESOURCE_CONFIG.HARVESTING_RATE);
                    this.cargo += harvested;

                    if (this.cargo >= this.stats.maxCargo) {
                        this.harvestState = 'returning';
                        this.targetRefinery = this.findNearestRefinery(game);
                        if (this.targetRefinery) {
                            this.moveTo(this.targetRefinery.x, this.targetRefinery.y, game);
                        } else {
                            this.harvestState = 'idle';
                        }
                    }
                }
                break;

            case 'returning':
                this.updateMovement(deltaTime, game);
                if (!this.path && this.targetRefinery) {
                    const dist = distance(this.x, this.y, this.targetRefinery.x, this.targetRefinery.y);
                    if (dist < TILE_SIZE * 3) {
                        // Apply resource value multiplier based on resource type
                        const valueMultiplier = this.targetResource ? this.targetResource.valueMultiplier : 1;
                        this.owner.credits += this.cargo * valueMultiplier;
                        this.cargo = 0;
                        this.harvestState = 'idle';
                        this.targetRefinery = null;
                    }
                }
                break;
        }
    }

    findNearestResource(game) {
        let nearest = null;
        let nearestDist = Infinity;

        for (const node of game.map.resourceNodes) {
            if (node.resources <= 0) continue;
            if (this.avoidResource && node === this.avoidResource) continue;  // Skip problematic resource

            const dist = distance(
                this.x / TILE_SIZE, this.y / TILE_SIZE,
                node.x, node.y
            );

            if (dist < nearestDist) {
                nearest = node;
                nearestDist = dist;
            }
        }

        // If no alternative found, clear avoidance and try again
        if (!nearest && this.avoidResource) {
            this.avoidResource = null;
            return this.findNearestResource(game);
        }

        return nearest;
    }

    findNearestRefinery(game) {
        let nearest = null;
        let nearestDist = Infinity;

        // Prefer homeRefinery if set
        if (this.homeRefinery && this.homeRefinery.isAlive() && this.homeRefinery !== this.avoidRefinery) {
            return this.homeRefinery;
        }

        for (const building of game.buildings) {
            if (building.owner !== this.owner || !building.stats.isRefinery) continue;
            if (this.avoidRefinery && building === this.avoidRefinery) continue;  // Skip problematic refinery

            const dist = distance(this.x, this.y, building.x, building.y);
            if (dist < nearestDist) {
                nearest = building;
                nearestDist = dist;
            }
        }

        return nearest;
    }

    updateReload(deltaTime, game) {
        // Find nearest airfield
        if (!this.path || this.pathIndex >= this.path.length) {
            const airfield = this.findNearestAirfield(game);

            if (!airfield) {
                // No airfield available, just wait
                return;
            }

            // Check if already at airfield
            const dist = distance(this.x, this.y, airfield.x, airfield.y);
            if (dist < TILE_SIZE * 3) {
                // Reload complete
                this.ammo = this.maxAmmo;
                this.needsReload = false;
                return;
            }

            // Move to airfield
            this.moveTo(airfield.x, airfield.y, game);
        } else {
            // Continue moving to airfield
            this.updateMovement(deltaTime, game);
        }
    }

    findNearestAirfield(game) {
        let nearest = null;
        let nearestDist = Infinity;

        for (const building of game.buildings) {
            if (building.owner !== this.owner || building.type !== 'AIRFIELD') continue;
            if (!building.isAlive()) continue;

            const dist = distance(this.x, this.y, building.x, building.y);
            if (dist < nearestDist) {
                nearest = building;
                nearestDist = dist;
            }
        }

        return nearest;
    }

    findAdjacentEmptyTile(game, centerX, centerY) {
        // Check 8 surrounding tiles
        const offsets = [
            {x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1},
            {x: 1, y: 1}, {x: 1, y: -1}, {x: -1, y: 1}, {x: -1, y: -1}
        ];

        for (const offset of offsets) {
            const tx = centerX + offset.x;
            const ty = centerY + offset.y;
            const tile = game.map.getTile(tx, ty);

            if (tile && !tile.blocked && !tile.unit && !tile.building) {
                return {x: tx, y: ty};
            }
        }

        return null;
    }

    findNearestEmptyTile(game, centerX, centerY) {
        // Spiral search for closest empty tile
        for (let radius = 1; radius <= COLLISION_CONFIG.SEARCH_RADIUS; radius++) {
            for (let angle = 0; angle < Math.PI * 2; angle += 0.5) {
                const tx = Math.floor(centerX + Math.cos(angle) * radius);
                const ty = Math.floor(centerY + Math.sin(angle) * radius);
                const tile = game.map.getTile(tx, ty);

                if (tile && !tile.blocked && !tile.unit && !tile.building) {
                    return {x: tx, y: ty};
                }
            }
        }

        return null;
    }

    updateMedic(deltaTime, game) {
        // Find nearby wounded infantry
        const healRange = (this.stats.healRange || 2) * TILE_SIZE;
        const healRate = this.stats.healRate || 10;

        for (const unit of game.units) {
            if (unit.owner !== this.owner || !unit.isAlive()) continue;
            if (unit.stats.category !== 'infantry') continue;
            if (unit.getHealthPercent() >= 1.0) continue;

            const dist = distance(this.x, this.y, unit.x, unit.y);
            if (dist <= healRange) {
                unit.heal(healRate * (deltaTime / 1000));
                break; // Heal one unit at a time
            }
        }
    }

    applySplashDamage(primaryTarget, baseDamage, game) {
        const splashRadius = this.stats.splashRadius * TILE_SIZE;
        const friendlyFire = this.stats.friendlyFire || false;

        // Damage all entities in splash radius
        const targets = [];

        // Check units
        for (const unit of game.units) {
            if (!unit.isAlive()) continue;
            if (!friendlyFire && unit.owner === this.owner) continue;

            const dist = distance(primaryTarget.x, primaryTarget.y, unit.x, unit.y);
            if (dist <= splashRadius) {
                targets.push(unit);
            }
        }

        // Check buildings
        for (const building of game.buildings) {
            if (!building.isAlive()) continue;
            if (!friendlyFire && building.owner === this.owner) continue;

            const dist = distance(primaryTarget.x, primaryTarget.y, building.x, building.y);
            if (dist <= splashRadius) {
                targets.push(building);
            }
        }

        // Apply damage to all targets
        for (const target of targets) {
            const dist = distance(primaryTarget.x, primaryTarget.y, target.x, target.y);
            const damageMultiplier = 1.0 - (dist / splashRadius) * 0.5; // 50-100% damage based on distance
            const actualDamage = Math.floor(baseDamage * damageMultiplier);

            const destroyed = target.takeDamage(actualDamage);

            if (destroyed) {
                if (target === primaryTarget) {
                    this.gainExperience();
                    this.targetEnemy = null;
                }

                // Remove destroyed entities
                if (target instanceof Unit) {
                    const tile = worldToTile(target.x, target.y);
                    game.map.clearUnit(tile.x, tile.y);
                    const index = game.units.indexOf(target);
                    if (index !== -1) {
                        game.units.splice(index, 1);
                    }
                } else if (target instanceof Building) {
                    game.map.clearBuilding(target.tileX, target.tileY, target.stats.width, target.stats.height);
                    const index = game.buildings.indexOf(target);
                    if (index !== -1) {
                        game.buildings.splice(index, 1);
                    }

                    if (target.stats.isHQ) {
                        game.checkVictoryCondition();
                    }
                }
            }
        }
    }
}
