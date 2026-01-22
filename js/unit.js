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

        // Airplane specific
        this.isAirplane = stats.isAirplane || false;
        this.homeAirfield = null; // Assigned airfield
        this.flyByTarget = null; // Target for fly-by attacks
        this.flyByState = 'idle'; // idle, approaching, attacking, looping, returning
        this.lastAttackTime = 0;
        this.flyByPasses = 0; // Number of passes made
        this.angle = 0; // Current facing angle (for rendering and steering)
        this.velocity = { x: 0, y: 0 }; // Current velocity vector
        this.maxTurnRate = 0.05; // Radians per frame (smooth turning)
        this.acceleration = 0.3; // Acceleration rate
        this.landed = false; // Whether airplane is landed on airfield

        // Builder specific
        this.isBuilder = stats.isBuilder || false;
        this.buildTarget = null;

        // Formation specific
        this.formationId = null;
        this.formationIndex = null;
        this.userCommandTime = 0; // Track when user gave a command (to prevent formation override)
    }

    moveTo(x, y, game) {
        this.targetX = x;
        this.targetY = y;
        this.targetEnemy = null;

        const currentTile = worldToTile(this.x, this.y);
        const targetTile = worldToTile(x, y);

        const ownerType = this.owner.isAI ? 'AI' : 'Player';
        const shouldLog = ownerType === 'AI' ? DEBUG_LOGGING.AI_MOVEMENT : DEBUG_LOGGING.PLAYER_MOVEMENT;

        // Track original destination for ground units - always set on new move command
        // This helps prevent formation updates from overriding user commands
        this.originalDestination = {x: targetTile.x, y: targetTile.y};
        this.destinationChangeCount = 0;
        this.collisionCount = 0;
        
        // Mark this as a user command (if not AI) to prevent formation override
        if (!this.owner.isAI) {
            this.userCommandTime = Date.now();
        }
        
        if (shouldLog) {
            console.log(`[${ownerType} ${this.type}] New destination set: (${targetTile.x}, ${targetTile.y})`);
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
        // Mark as user command
        if (!this.owner.isAI) {
            this.userCommandTime = Date.now();
        }
    }

    attackTarget(target) {
        // Focus fire - set this unit's target to the specified target
        if (this.isAirplane) {
            // Check if airplane has ammo
            if (this.ammo <= 0) {
                showNotification('Airplane out of ammo - returning to base');
                this.flyByState = 'returning';
                this.flyByTarget = null;
                return;
            }
            // Airplanes can only attack (fly-by), not move
            this.flyByTarget = target; // Store attack target for fly-by
            this.flyByState = 'approaching';
            this.flyByPasses = 0;
            // Set target location for fly-by
            this.targetX = target.x;
            this.targetY = target.y;
            // Take off from airfield
            this.landed = false;
        } else {
            this.targetEnemy = target;
            this.path = null; // Clear movement path to engage immediately
        }
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

        // Airplane-specific behavior
        if (this.isAirplane) {
            this.updateAirplane(deltaTime, game);
            return;
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
                
                // Special handling for formation units - allow passing through units in same formation
                let noOtherUnit = true;
                if (targetTile && targetTile.unit && targetTile.unit !== this) {
                    // Check if the other unit is in the same formation
                    if (this.formationId && targetTile.unit.formationId === this.formationId) {
                        // Same formation - allow passing through (formation units can overlap slightly)
                        noOtherUnit = true;
                    } else {
                        // Different unit or no formation - normal collision
                        noOtherUnit = false;
                    }
                }

                if (tileIsPassable && noOtherUnit) {
                    canMove = true;
                } else {
                    // Collision detected!
                    // For formation units, be more lenient with collisions
                    const isFormationUnit = this.formationId !== null;
                    const collisionThreshold = isFormationUnit ? COLLISION_CONFIG.MAX_COLLISIONS * 2 : COLLISION_CONFIG.MAX_COLLISIONS;
                    const cooldownTime = isFormationUnit ? COLLISION_CONFIG.COOLDOWN_MS * 0.5 : COLLISION_CONFIG.COOLDOWN_MS;
                    
                    this.collisionCount++;
                    const ownerType = this.owner.isAI ? 'AI' : 'Player';
                    const shouldLog = ownerType === 'AI' ? DEBUG_LOGGING.AI_MOVEMENT : DEBUG_LOGGING.PLAYER_MOVEMENT;

                    if (shouldLog && !isFormationUnit) {
                        console.log(`[${ownerType} ${this.type}] Collision #${this.collisionCount} at (${newTile.x}, ${newTile.y})`);
                    }

                    if (this.collisionCount >= collisionThreshold) {
                        if (shouldLog) {
                            console.log(`[${ownerType} ${this.type}] Stopped after ${collisionThreshold} collisions`);
                        }
                        this.path = null;
                        this.collisionCount = 0;
                        this.originalDestination = null;
                        return;
                    }

                    // Set collision cooldown (shorter for formation units)
                    this.collisionCooldown = cooldownTime;
                    if (shouldLog && !isFormationUnit) {
                        console.log(`[${ownerType} ${this.type}] Cooldown activated for ${cooldownTime}ms`);
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

        // Check if target is an airplane (air drop)
        if (target.hp !== undefined && target.startTime !== undefined && target.flightTime !== undefined) {
            // It's an airplane - apply damage directly
            const damage = this.stats.damage || 0;
            target.hp = (target.hp || 100) - damage;
            
            if (target.hp <= 0) {
                target.active = false;
                this.targetEnemy = null;
                showNotification('Air drop airplane shot down!');
            }
            return;
        }

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

            // Track stats
            if (game.stats) {
                if (target instanceof Unit) {
                    game.stats.unitsKilled++;
                    if (target.owner && target.owner.isAI) {
                        // Enemy unit killed
                        if (this.owner === game.humanPlayer) {
                            game.stats.enemiesKilled++;
                            game.stats.enemiesKilledByType[target.type] = (game.stats.enemiesKilledByType[target.type] || 0) + 1;
                        }
                    } else if (target.owner === game.humanPlayer && this.owner && this.owner.isAI) {
                        // Player unit lost
                        game.stats.playerUnitsLost++;
                        game.stats.playerUnitsLostByType[target.type] = (game.stats.playerUnitsLostByType[target.type] || 0) + 1;
                    }
                } else if (target instanceof Building) {
                    if (this.owner === game.humanPlayer) {
                        game.stats.buildingsDestroyed++;
                    }
                }
            }

            // Remove from game
            if (target instanceof Unit) {
                // Remove from formation if in one
                game.removeUnitFromFormation(target);
                
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

        // Check if unit can attack air (only ROCKET_SOLDIER can attack airplanes)
        const canAttackAir = this.type === 'ROCKET_SOLDIER' && this.stats.damageType === 'rocket';

        // Check airplane units first if unit can attack air
        if (canAttackAir) {
            for (const unit of game.units) {
                if (!unit.isAirplane || unit.owner === this.owner || !unit.isAlive()) continue;
                const dist = distance(this.x, this.y, unit.x, unit.y);
                const range = (this.stats.range || 1) * TILE_SIZE;
                if (dist <= range && dist < nearestDist) {
                    nearest = unit;
                    nearestDist = dist;
                }
            }
        }

        // Check units (exclude airplanes unless this unit can attack air)
        for (const unit of game.units) {
            if (unit.owner === this.owner || !unit.isAlive()) continue;
            // Skip airplanes unless this unit can attack them
            if (unit.isAirplane && !canAttackAir) continue;

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
                        const earned = this.cargo * valueMultiplier;
                        this.owner.credits += earned;
                        
                        // Track money earned for human player
                        if (this.owner === game.humanPlayer && game.stats) {
                            game.stats.moneyEarned += earned;
                        }
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
            
            // Track stats
            if (destroyed && game.stats) {
                if (target instanceof Unit) {
                    game.stats.unitsKilled++;
                    if (target.owner && target.owner.isAI) {
                        // Enemy unit killed
                        if (this.owner === game.humanPlayer) {
                            game.stats.enemiesKilled++;
                            game.stats.enemiesKilledByType[target.type] = (game.stats.enemiesKilledByType[target.type] || 0) + 1;
                        }
                    } else if (target.owner === game.humanPlayer && this.owner && this.owner.isAI) {
                        // Player unit lost
                        game.stats.playerUnitsLost++;
                        game.stats.playerUnitsLostByType[target.type] = (game.stats.playerUnitsLostByType[target.type] || 0) + 1;
                    }
                } else if (target instanceof Building) {
                    if (this.owner === game.humanPlayer) {
                        game.stats.buildingsDestroyed++;
                    }
                }
            }

            if (destroyed) {
                if (target === primaryTarget) {
                    this.gainExperience();
                    this.targetEnemy = null;
                }

                // Remove destroyed entities
                if (target instanceof Unit) {
                    // Remove from formation if in one
                    game.removeUnitFromFormation(target);
                    
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

    updateAirplane(deltaTime, game) {
        // If landed, don't update movement
        if (this.landed) {
            // Reload and heal at airfield
            if (this.ammo < this.maxAmmo) {
                this.ammo = this.maxAmmo;
            }
            if (this.hp < this.maxHp) {
                this.hp = Math.min(this.maxHp, this.hp + deltaTime * 0.1); // Slow heal
            }
            // Ensure position is on airfield
            if (this.homeAirfield && this.homeAirfield.isAlive()) {
                this.x = this.homeAirfield.x;
                this.y = this.homeAirfield.y;
                this.velocity.x = 0;
                this.velocity.y = 0;
            }
            return;
        }
        
        // Smooth airplane movement with steering (no grid pathfinding)
        this.updateAirplaneMovement(deltaTime, game);
    }

    updateAirplaneMovement(deltaTime, game) {
        const speed = this.stats.speed * (deltaTime / 16);
        let targetAngle = this.angle;
        let targetX = this.x;
        let targetY = this.y;

        // Determine target based on state
        switch (this.flyByState) {
            case 'idle':
                // Land on airfield
                if (this.homeAirfield && this.homeAirfield.isAlive()) {
                    const dist = distance(this.x, this.y, this.homeAirfield.x, this.homeAirfield.y);
                    if (dist > 30) {
                        // Move back to airfield
                        targetX = this.homeAirfield.x;
                        targetY = this.homeAirfield.y;
                        targetAngle = Math.atan2(targetY - this.y, targetX - this.x);
                    } else {
                        // Land on airfield
                        this.landed = true;
                        this.x = this.homeAirfield.x;
                        this.y = this.homeAirfield.y;
                        this.velocity.x = 0;
                        this.velocity.y = 0;
                    }
                }
                break;

            case 'approaching':
                // Handle special power airplanes or regular attack targets
                if (this.specialPowerType) {
                    // Special power airplane (recon, airstrike, airdrop)
                    const dist = distance(this.x, this.y, this.specialPowerTarget.x, this.specialPowerTarget.y);
                    
                    if (dist < 50) {
                        // Reached target - execute special power
                        if (this.specialPowerType === 'recon') {
                            // Recon complete - remove airplane
                            showNotification('Recon sweep complete');
                            this.takeDamage(this.hp); // Destroy to remove
                        } else if (this.specialPowerType === 'airstrike') {
                            // Execute airstrike
                            this.executeAirstrike(game);
                            this.takeDamage(this.hp); // Destroy after strike
                        } else if (this.specialPowerType === 'airdrop') {
                            // Execute airdrop
                            this.executeAirdrop(game);
                            this.takeDamage(this.hp); // Destroy after drop
                        }
                        break;
                    }
                    
                    // Fly towards special power target
                    targetX = this.specialPowerTarget.x;
                    targetY = this.specialPowerTarget.y;
                    targetAngle = Math.atan2(targetY - this.y, targetX - this.x);
                } else if (this.flyByTarget) {
                    // Regular attack target
                    if (!this.flyByTarget.isAlive()) {
                        this.flyByState = 'returning';
                        this.flyByTarget = null;
                        break;
                    }

                    // Check if out of ammo - return to base
                    if (this.ammo <= 0) {
                        this.flyByState = 'returning';
                        this.flyByTarget = null;
                        break;
                    }

                    // Move towards target
                    const dist = distance(this.x, this.y, this.flyByTarget.x, this.flyByTarget.y);
                    const attackRange = (this.stats.range || 6) * TILE_SIZE;

                    if (dist <= attackRange && this.ammo > 0) {
                        // In range - perform fly-by attack
                        this.performFlyByAttack(this.flyByTarget, game);
                        this.flyByPasses++;
                        this.lastAttackTime = game.gameTime || Date.now();

                        if (this.ammo > 0) {
                            // Still have ammo - loop around for another pass
                            this.flyByState = 'looping';
                            // Set waypoint behind target for loop
                            const dx = this.flyByTarget.x - this.x;
                            const dy = this.flyByTarget.y - this.y;
                            const norm = Math.sqrt(dx * dx + dy * dy);
                            const loopDistance = attackRange * 2;
                            this.targetX = this.flyByTarget.x + (dx / norm) * loopDistance;
                            this.targetY = this.flyByTarget.y + (dy / norm) * loopDistance;
                        } else {
                            // Out of ammo - return to base
                            this.flyByState = 'returning';
                        }
                    } else {
                        // Still approaching - fly towards target
                        targetX = this.flyByTarget.x;
                        targetY = this.flyByTarget.y;
                        targetAngle = Math.atan2(targetY - this.y, targetX - this.x);
                    }
                } else {
                    // No target - return to base
                    this.flyByState = 'returning';
                }
                break;

            case 'looping':
                // Looping around for another pass
                const loopDist = distance(this.x, this.y, this.targetX, this.targetY);
                if (loopDist < 50) {
                    // Reached loop waypoint - approach target again
                    this.flyByState = 'approaching';
                } else {
                    // Continue to loop waypoint
                    targetX = this.targetX;
                    targetY = this.targetY;
                    targetAngle = Math.atan2(targetY - this.y, targetX - this.x);
                }
                break;

            case 'returning':
                // Returning to airfield
                if (!this.homeAirfield || !this.homeAirfield.isAlive()) {
                    // No airfield - just idle
                    this.flyByState = 'idle';
                    break;
                }

                const returnDist = distance(this.x, this.y, this.homeAirfield.x, this.homeAirfield.y);
                if (returnDist < 30) {
                    // Reached airfield - land
                    this.flyByState = 'idle';
                    this.flyByTarget = null;
                    this.landed = true;
                    this.x = this.homeAirfield.x;
                    this.y = this.homeAirfield.y;
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                } else {
                    // Move to airfield
                    targetX = this.homeAirfield.x;
                    targetY = this.homeAirfield.y;
                    targetAngle = Math.atan2(targetY - this.y, targetX - this.x);
                }
                break;
        }

        // Smooth steering: gradually turn towards target angle
        let angleDiff = targetAngle - this.angle;
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        // Turn at max turn rate
        const maxTurn = this.maxTurnRate * deltaTime;
        if (Math.abs(angleDiff) > maxTurn) {
            this.angle += Math.sign(angleDiff) * maxTurn;
        } else {
            this.angle = targetAngle;
        }

        // Normalize angle
        while (this.angle > Math.PI) this.angle -= 2 * Math.PI;
        while (this.angle < -Math.PI) this.angle += 2 * Math.PI;

        // Accelerate in direction of travel
        const desiredVelocity = {
            x: Math.cos(this.angle) * speed,
            y: Math.sin(this.angle) * speed
        };

        // Smooth acceleration
        this.velocity.x = lerp(this.velocity.x, desiredVelocity.x, this.acceleration);
        this.velocity.y = lerp(this.velocity.y, desiredVelocity.y, this.acceleration);

        // Update position
        this.x += this.velocity.x;
        this.y += this.velocity.y;

        // Update map position for fog of war
        const oldTile = worldToTile(this.x - this.velocity.x, this.y - this.velocity.y);
        const newTile = worldToTile(this.x, this.y);
        if (oldTile.x !== newTile.x || oldTile.y !== newTile.y) {
            game.map.clearUnit(oldTile.x, oldTile.y);
            game.map.setUnit(newTile.x, newTile.y, this);
        }
    }

    performFlyByAttack(target, game) {
        if (!target || !target.isAlive() || this.ammo <= 0) return;

        // Use ammo
        this.ammo--;

        // Apply explosive damage
        const baseDamage = this.stats.damage || 150;
        const splashRadius = (this.stats.range || 6) * TILE_SIZE * 0.5; // Smaller splash for fly-by

        // Find all targets in splash radius
        const targets = [target];

        // Check units
        for (const unit of game.units) {
            if (!unit.isAlive()) continue;
            if (unit === target) continue;
            if (unit.owner === this.owner) continue;

            const dist = distance(target.x, target.y, unit.x, unit.y);
            if (dist <= splashRadius) {
                targets.push(unit);
            }
        }

        // Check buildings
        for (const building of game.buildings) {
            if (!building.isAlive()) continue;
            if (building === target) continue;
            if (building.owner === this.owner) continue;

            const dist = distance(target.x, target.y, building.x, building.y);
            if (dist <= splashRadius) {
                targets.push(building);
            }
        }

        // Apply damage to all targets
        for (const t of targets) {
            const dist = distance(target.x, target.y, t.x, t.y);
            const damageMultiplier = 1.0 - (dist / splashRadius) * 0.5;
            const actualDamage = Math.floor(baseDamage * damageMultiplier);

            const destroyed = t.takeDamage(actualDamage);

            // Track stats
            if (destroyed && game.stats) {
                if (t instanceof Unit) {
                    game.stats.unitsKilled++;
                    if (t.owner && t.owner.isAI) {
                        if (this.owner === game.humanPlayer) {
                            game.stats.enemiesKilled++;
                            game.stats.enemiesKilledByType[t.type] = (game.stats.enemiesKilledByType[t.type] || 0) + 1;
                        }
                    }
                }
            }
        }

        showNotification(`Airplane fly-by attack! ${this.ammo} ammo remaining`);
    }

    executeAirstrike(game) {
        if (!this.strikeX || !this.strikeY) return;

        showNotification('Airstrike!');

        const radius = this.strikeRadius * TILE_SIZE;

        // Damage units and buildings in radius
        for (const unit of game.units) {
            if (unit.owner === this.owner) continue;
            if (!unit.isAlive()) continue;

            const dist = distance(this.strikeX, this.strikeY, unit.x, unit.y);
            if (dist <= radius) {
                const destroyed = unit.takeDamage(this.strikeDamage);
                if (destroyed) {
                    const tile = worldToTile(unit.x, unit.y);
                    game.map.clearUnit(tile.x, tile.y);
                }
            }
        }

        for (const building of game.buildings) {
            if (building.owner === this.owner) continue;
            if (!building.isAlive()) continue;

            const dist = distance(this.strikeX, this.strikeY, building.x, building.y);
            if (dist <= radius) {
                building.takeDamage(this.strikeDamage);
            }
        }

        // Remove destroyed units
        game.units = game.units.filter(u => u.isAlive());
    }

    executeAirdrop(game) {
        if (!this.airdropUnits || !this.airdropInfantryTypes) return;

        // Drop units
        const dropRadius = 2; // Tiles
        const centerTile = worldToTile(this.airdropTargetX, this.airdropTargetY);
        const dropPositions = [];

        // Generate drop positions in a circle
        for (let i = 0; i < this.airdropUnits; i++) {
            const angle = (i / this.airdropUnits) * Math.PI * 2;
            const offsetX = Math.cos(angle) * dropRadius;
            const offsetY = Math.sin(angle) * dropRadius;
            const dropTile = { x: centerTile.x + Math.round(offsetX), y: centerTile.y + Math.round(offsetY) };
            dropPositions.push(dropTile);
        }

        // Spawn random infantry units
        for (const dropPos of dropPositions) {
            const randomType = this.airdropInfantryTypes[Math.floor(Math.random() * this.airdropInfantryTypes.length)];
            const stats = UNIT_TYPES[randomType];
            const worldPos = tileToWorld(dropPos.x, dropPos.y);
            const unit = new Unit(worldPos.x, worldPos.y, randomType, stats, this.owner);

            game.units.push(unit);
            game.map.setUnit(dropPos.x, dropPos.y, unit);

            // Track stats
            if (game.stats) {
                game.stats.unitsBuilt++;
                game.stats.unitsBuiltByType[randomType] = (game.stats.unitsBuiltByType[randomType] || 0) + 1;
            }
        }

        showNotification(`Air drop complete - ${this.airdropUnits} units deployed`);
    }
}
