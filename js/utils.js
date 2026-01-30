// Utility functions

function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

function distanceTiles(tile1, tile2) {
    return distance(tile1.x, tile1.y, tile2.x, tile2.y);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function normalizeVector(dx, dy) {
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x: 0, y: 0 };
    return { x: dx / len, y: dy / len };
}

function pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

function rectIntersect(r1x, r1y, r1w, r1h, r2x, r2y, r2w, r2h) {
    return !(r1x + r1w < r2x || r2x + r2w < r1x || r1y + r1h < r2y || r2y + r2h < r1y);
}

function worldToTile(worldX, worldY) {
    return {
        x: Math.floor(worldX / TILE_SIZE),
        y: Math.floor(worldY / TILE_SIZE),
    };
}

function tileToWorld(tileX, tileY) {
    return {
        x: tileX * TILE_SIZE + TILE_SIZE / 2,
        y: tileY * TILE_SIZE + TILE_SIZE / 2,
    };
}

function canPlaceBuilding(map, x, y, width, height, player, game, allowWater = false) {
    if (x < 0 || y < 0 || x + width > map.width || y + height > map.height) {
        return false;
    }

    for (let ty = y; ty < y + height; ty++) {
        for (let tx = x; tx < x + width; tx++) {
            const tile = map.getTile(tx, ty);
            if (!tile) return false;
            
            // PORT buildings can be placed on water or land, and don't check blocked/terrain
            if (allowWater) {
                // Only check for existing buildings
                if (tile.building) {
                    return false;
                }
            } else {
                // Other buildings cannot be placed on blocked terrain or water, or where buildings exist
                if (tile.blocked || tile.building || tile.terrain === 'water') {
                    return false;
                }
            }
        }
    }

    // AI-specific: Enforce 1-tile gap around buildings
    if (player && player.isAI && game && game.buildings) {
        // Check 1-tile perimeter around the building
        for (let ty = y - 1; ty < y + height + 1; ty++) {
            for (let tx = x - 1; tx < x + width + 1; tx++) {
                // Skip the building itself
                if (tx >= x && tx < x + width && ty >= y && ty < y + height) {
                    continue;
                }
                const tile = map.getTile(tx, ty);
                if (tile && tile.building) {
                    return false;
                }
            }
        }
    }

    // Check if within 8 tiles of any player building (skip for first HQ)
    if (player && game && game.buildings) {
        const playerBuildings = game.buildings.filter(b => b.owner === player && b.isAlive());

        // Allow first building without radius restriction
        if (playerBuildings.length === 0) {
            return true;
        }

        const PLACEMENT_RADIUS = 8;
        let withinRange = false;

        for (const building of playerBuildings) {
            const buildingCenterX = building.tileX + building.stats.width / 2;
            const buildingCenterY = building.tileY + building.stats.height / 2;
            const placementCenterX = x + width / 2;
            const placementCenterY = y + height / 2;

            const dist = distance(placementCenterX, placementCenterY, buildingCenterX, buildingCenterY);

            if (dist <= PLACEMENT_RADIUS) {
                withinRange = true;
                break;
            }
        }

        if (!withinRange) {
            return false;
        }
    }

    return true;
}

function findPath(map, startX, startY, endX, endY, size = 1, isHarvester = false, isNaval = false) {
    // Validate inputs
    if (!validateMapCoordinates(map, startX, startY) || !validateMapCoordinates(map, endX, endY)) {
        return null;
    }
    
    // For naval units, validate that start and destination are valid for naval movement
    // (water or within 1 tile of land)
    if (isNaval) {
        if (!map.isNavalValid(startX, startY)) {
            return null; // Cannot pathfind from invalid start
        }
        if (!map.isNavalValid(endX, endY)) {
            return null; // Cannot pathfind to invalid destination
        }
    }
    
    // For non-naval units, validate that destination is not water
    if (!isNaval && map.isWater(endX, endY)) {
        return null; // Cannot pathfind to water destination
    }

    // Check cache first (harvester status not included in cache key for now)
    const cached = getCachedPath(startX, startY, endX, endY, size);
    if (cached !== null) {
        return cached;
    }

    // Profile pathfinding (check if profiler exists)
    if (typeof profiler !== 'undefined' && profiler && profiler.enabled) {
        profiler.startProfile('pathfinding');
    }

    let result;
    // Use hierarchical pathfinding for long distances
    const distanceTiles = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
    if (distanceTiles > PATHFINDING.HIERARCHICAL_THRESHOLD) {
        result = findPathHierarchical(map, startX, startY, endX, endY, size, isHarvester, isNaval);
    } else {
        result = findPathDirect(map, startX, startY, endX, endY, size, isHarvester, isNaval);
    }

    if (typeof profiler !== 'undefined' && profiler && profiler.enabled) {
        profiler.endProfile('pathfinding');
    }

    return result;
}

// Hierarchical pathfinding for long distances
function findPathHierarchical(map, startX, startY, endX, endY, size = 1, isHarvester = false, isNaval = false) {
    const distanceTiles = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
    const waypointDistance = PATHFINDING.WAYPOINT_DISTANCE;
    
    // Calculate number of waypoints needed
    const numWaypoints = Math.ceil(distanceTiles / waypointDistance);
    
    if (numWaypoints <= 1) {
        // Short path, use regular pathfinding
        return findPathDirect(map, startX, startY, endX, endY, size, isHarvester, isNaval);
    }

    // Generate waypoints along the direct line
    const waypoints = [];
    for (let i = 1; i < numWaypoints; i++) {
        const t = i / numWaypoints;
        const wx = Math.floor(startX + (endX - startX) * t);
        const wy = Math.floor(startY + (endY - startY) * t);
        
        // Find nearest valid tile for waypoint (consider naval units need water)
        const validWaypoint = findNearestValidTile(map, wx, wy, size, isNaval ? 10 : 5, isNaval);
        if (validWaypoint) {
            // For naval units, ensure waypoint is on water
            if (isNaval && !map.isWater(validWaypoint.x, validWaypoint.y)) {
                continue; // Skip this waypoint if not water
            }
            waypoints.push(validWaypoint);
        }
    }

    // Build path through waypoints
    const fullPath = [];
    let currentX = startX;
    let currentY = startY;

    for (const waypoint of waypoints) {
        const segmentPath = findPathDirect(map, currentX, currentY, waypoint.x, waypoint.y, size, isHarvester, isNaval);
        if (segmentPath && segmentPath.length > 0) {
            // Add segment path (skip first point to avoid duplicates)
            for (let i = 1; i < segmentPath.length; i++) {
                fullPath.push(segmentPath[i]);
            }
            currentX = waypoint.x;
            currentY = waypoint.y;
        } else {
            // If waypoint fails, try direct path
            const directPath = findPathDirect(map, currentX, currentY, endX, endY, size, isHarvester, isNaval);
            if (directPath) {
                return directPath;
            }
            break;
        }
    }

    // Final segment to destination
    const finalSegment = findPathDirect(map, currentX, currentY, endX, endY, size, isHarvester, isNaval);
    if (finalSegment && finalSegment.length > 0) {
        for (let i = 1; i < finalSegment.length; i++) {
            fullPath.push(finalSegment[i]);
        }
    }

    if (fullPath.length > 0) {
        // Add start point
        fullPath.unshift({ x: startX, y: startY });
        cachePath(startX, startY, endX, endY, fullPath, size);
        return fullPath;
    }

    // Fallback to direct pathfinding
    return findPathDirect(map, startX, startY, endX, endY, size, isHarvester, isNaval);
}

function findPathDirect(map, startX, startY, endX, endY, size = 1, isHarvester = false, isNaval = false) {
    // This is the original findPath logic without hierarchical check
    const openSet = new Map();
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const startKey = `${startX},${startY}`;
    openSet.set(startKey, { x: startX, y: startY });
    gScore.set(startKey, 0);
    fScore.set(startKey, distance(startX, startY, endX, endY));

    let iterations = 0;
    const maxIterations = PATHFINDING.MAX_ITERATIONS;

    while (openSet.size > 0) {
        let current = null;
        let currentKey = null;
        let lowestF = Infinity;

        for (const [key, node] of openSet) {
            const f = fScore.get(key) || Infinity;
            if (f < lowestF) {
                lowestF = f;
                current = node;
                currentKey = key;
            }
        }

        if (!current) break;

        if (current.x === endX && current.y === endY) {
            const path = [];
            let node = current;
            while (node) {
                path.unshift(node);
                const key = `${node.x},${node.y}`;
                node = cameFrom.get(key);
            }
            return path;
        }

        openSet.delete(currentKey);
        closedSet.add(currentKey);

        const neighbors = PATHFINDING.CARDINAL_ONLY ? [
            { x: current.x + 1, y: current.y },
            { x: current.x - 1, y: current.y },
            { x: current.x, y: current.y + 1 },
            { x: current.x, y: current.y - 1 },
        ] : [
            { x: current.x + 1, y: current.y },
            { x: current.x - 1, y: current.y },
            { x: current.x, y: current.y + 1 },
            { x: current.x, y: current.y - 1 },
            { x: current.x + 1, y: current.y + 1 },
            { x: current.x - 1, y: current.y - 1 },
            { x: current.x + 1, y: current.y - 1 },
            { x: current.x - 1, y: current.y + 1 },
        ];

        for (const neighbor of neighbors) {
            const neighborKey = `${neighbor.x},${neighbor.y}`;

            if (closedSet.has(neighborKey)) continue;
            if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= map.width || neighbor.y >= map.height) continue;

            // Check water requirement for naval units (water or within 1 tile of land)
            if (isNaval) {
                if (!map.isNavalValid(neighbor.x, neighbor.y)) {
                    continue; // Naval units can only move on water or near coastlines
                }
            }

            // Use spatial grid for faster collision detection if available
            if (map.spatialGrid) {
                const isDestination = neighbor.x === endX && neighbor.y === endY;
                // For destination, only check if it's valid for naval/non-naval movement
                if (isDestination) {
                    if (isNaval && !map.isNavalValid(neighbor.x, neighbor.y)) {
                        continue; // Naval units must end on water or near coastlines
                    }
                    if (!isNaval && map.isWater(neighbor.x, neighbor.y)) {
                        continue; // Non-naval units cannot end on water
                    }
                    // Destination is valid terrain-wise, allow it (even if blocked by units/buildings)
                } else {
                    // For naval units, water tiles are valid even if marked as blocked
                    if (isNaval && map.isWater(neighbor.x, neighbor.y)) {
                        // Water tile - check building collision only
                        const tile = map.getTile(neighbor.x, neighbor.y);
                        if (tile && tile.building && !tile.building.stats.allowsUnitsOnTop) {
                            continue; // Blocked by building
                        }
                        // Water tile is valid for naval units, continue to next check
                    } else if (map.spatialGrid.isTileBlocked(neighbor.x, neighbor.y, size, isHarvester, isNaval)) {
                        continue;
                    }
                }
            } else {
                // Fallback to original method
                const tile = map.getTile(neighbor.x, neighbor.y);
                if (!tile) continue;

                const isDestination = neighbor.x === endX && neighbor.y === endY;
                const buildingAllowsUnits = tile.building && tile.building.stats.allowsUnitsOnTop;

                // For size > 1 units, check if the unit can fit (check the area the unit occupies)
                if (size > 1 && !isDestination) {
                    let canFit = true;
                    for (let dy = 0; dy < size && canFit; dy++) {
                        for (let dx = 0; dx < size && canFit; dx++) {
                            const checkX = neighbor.x + dx;
                            const checkY = neighbor.y + dy;
                            if (checkX >= map.width || checkY >= map.height) {
                                canFit = false;
                                break;
                            }
                            const checkTile = map.getTile(checkX, checkY);
                            if (!checkTile) {
                                canFit = false;
                                break;
                            }
                            // Check terrain requirements for naval units
                            if (isNaval && checkTile.terrain !== 'water') {
                                canFit = false;
                                break;
                            }
                            if (!isNaval && checkTile.terrain === 'water') {
                                canFit = false;
                                break;
                            }
                            
                            // For pathfinding, be more lenient - only block on buildings that don't allow units on top
                            // Units can push through other units during pathfinding (handled in movement)
                            // Allow harvesters to pass through other harvesters
                            // Allow naval units to pass through other naval units
                            const hasBlockingUnit = checkTile.unit && checkTile.unit.size >= size && 
                                !(checkTile.unit.isHarvester && isHarvester) && 
                                !(checkTile.unit.isNaval && isNaval);
                            
                            // Only block on terrain obstacles and buildings that don't allow units
                            // Don't block on units during pathfinding (they can move)
                            if (checkTile.blocked || (checkTile.building && !checkTile.building.stats.allowsUnitsOnTop)) {
                                canFit = false;
                            }
                            // Note: We don't block on units during pathfinding - they can move out of the way
                        }
                    }
                    if (!canFit) {
                        continue;
                    }
                } else {
                    // Size 1 or destination - use original logic
                    if (isDestination) {
                        // Destination is allowed even if blocked (units can push through)
                        // But check terrain requirements
                        if (isNaval && !map.isNavalValid(neighbor.x, neighbor.y)) {
                            continue; // Naval units must end on water or near coastlines
                        }
                        if (!isNaval && map.isWater(neighbor.x, neighbor.y)) {
                            continue; // Non-naval units cannot end on water
                        }
                    } else if ((tile.blocked || (tile.unit && tile.unit.size >= size && !tile.unit.isHarvester)) && !buildingAllowsUnits) {
                        continue;
                    }
                }
            }

            const isDiagonal = neighbor.x !== current.x && neighbor.y !== current.y;
            const movementCost = isDiagonal ? 1.414 : 1;
            const tentativeG = (gScore.get(currentKey) ?? Infinity) + movementCost;

            const currentG = gScore.get(neighborKey) ?? Infinity;

            if (tentativeG < currentG) {
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeG);
                fScore.set(neighborKey, tentativeG + distance(neighbor.x, neighbor.y, endX, endY));

                if (!openSet.has(neighborKey)) {
                    openSet.set(neighborKey, neighbor);
                }
            }
        }

        iterations++;
        if (iterations > maxIterations) {
            return null;
        }
    }

    return null;
}

function findNearestValidTile(map, x, y, size = 1, searchRadius = 5, requireWater = false) {
    for (let r = 0; r <= searchRadius; r++) {
        for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
                if (Math.abs(dx) + Math.abs(dy) !== r) continue; // Only check perimeter
                
                const tx = x + dx;
                const ty = y + dy;
                const tile = map.getTile(tx, ty);
                
                if (tile && !tile.blocked && !tile.building) {
                    // Check if unit can fit
                    let canFit = true;
                    for (let sy = 0; sy < size && canFit; sy++) {
                        for (let sx = 0; sx < size && canFit; sx++) {
                            const checkTile = map.getTile(tx + sx, ty + sy);
                            if (!checkTile || checkTile.blocked || checkTile.building) {
                                canFit = false;
                            }
                        }
                    }
                    if (canFit) {
                        return { x: tx, y: ty };
                    }
                }
            }
        }
    }
    return null;
}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Enhanced Notification System
class NotificationManager {
    constructor(game) {
        this.game = game;
        this.container = document.getElementById('notifications');
        this.activeNotifications = [];
        
        // Per-type throttling to prevent spam
        this.lastNotificationByType = new Map();
        this.groupedNotifications = new Map(); // Group similar notifications
        
        // Configuration (from constants)
        this.config = typeof NOTIFICATION_CONFIG !== 'undefined' ? NOTIFICATION_CONFIG : {
            cooldown: { power: 10000, attack: 3000, unitLost: 2000, buildingDestroyed: 3000, default: 500 },
            duration: { power: 5000, attack: 4000, unitLost: 4000, buildingDestroyed: 5000, default: 3000 },
            maxGrouped: 5,
            groupWindow: 2000
        };
    }
    
    show(type, message, options = {}) {
        const now = Date.now();
        const cooldown = this.config.cooldown[type] || this.config.cooldown.default;
        const duration = options.duration || this.config.duration[type] || this.config.duration.default;
        const location = options.location; // {x, y} world coordinates
        const entity = options.entity; // Entity reference for click-to-navigate
        
        // Check cooldown for this notification type
        const lastTime = this.lastNotificationByType.get(type);
        if (lastTime && (now - lastTime) < cooldown) {
            // Still in cooldown - try to group with existing notification
            if (this.groupedNotifications.has(type)) {
                const group = this.groupedNotifications.get(type);
                if (now - group.time < this.config.groupWindow) {
                    group.count++;
                    group.locations.push(location || (entity ? {x: entity.x, y: entity.y} : null));
                    // Update existing notification
                    this.updateGroupedNotification(type, group);
                    return;
                }
            }
            return; // Skip if in cooldown and can't group
        }
        
        // Check if we should group with existing notification
        if (this.groupedNotifications.has(type)) {
            const group = this.groupedNotifications.get(type);
            if (now - group.time < this.config.groupWindow) {
                group.count++;
                group.locations.push(location || (entity ? {x: entity.x, y: entity.y} : null));
                this.updateGroupedNotification(type, group);
                return;
            }
        }
        
        // Create new notification
        this.lastNotificationByType.set(type, now);
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // Make clickable if location is provided
        if (location || entity) {
            notification.classList.add('notification-clickable');
            notification.style.cursor = 'pointer';
            notification.title = 'Click to navigate to location';
            
            const targetLocation = location || {x: entity.x, y: entity.y};
            notification.addEventListener('click', () => {
                this.navigateToLocation(targetLocation);
            });
        }
        
        notification.textContent = message;
        this.container.appendChild(notification);
        this.activeNotifications.push({element: notification, type, time: now});
        
        // Initialize grouping if this is a groupable type
        if (['attack', 'unitLost', 'buildingDestroyed'].includes(type)) {
            this.groupedNotifications.set(type, {
                count: 1,
                time: now,
                locations: [location || (entity ? {x: entity.x, y: entity.y} : null)],
                element: notification
            });
        }
        
        // Auto-remove after duration
        setTimeout(() => {
            notification.remove();
            this.activeNotifications = this.activeNotifications.filter(n => n.element !== notification);
            
            // Clear grouping if this was the grouped notification
            if (this.groupedNotifications.has(type)) {
                const group = this.groupedNotifications.get(type);
                if (group.element === notification) {
                    this.groupedNotifications.delete(type);
                }
            }
        }, duration);
    }
    
    updateGroupedNotification(type, group) {
        if (!group.element || !group.element.parentNode) return;
        
        const count = Math.min(group.count, this.config.maxGrouped);
        const entityName = type === 'unitLost' ? 'unit' : type === 'buildingDestroyed' ? 'building' : 'entity';
        const plural = count > 1 ? 's' : '';
        
        let message;
        if (type === 'attack') {
            message = `${count} ${entityName}${plural} under attack!`;
        } else if (type === 'unitLost') {
            message = `${count} unit${plural} lost!`;
        } else if (type === 'buildingDestroyed') {
            message = `${count} building${plural} destroyed!`;
        } else {
            message = `${count} ${entityName}${plural} affected`;
        }
        
        if (group.count > this.config.maxGrouped) {
            message += ` (+${group.count - this.config.maxGrouped} more)`;
        }
        
        group.element.textContent = message;
        
        // Update click handler to navigate to first location
        if (group.locations.length > 0 && group.locations[0]) {
            const firstLocation = group.locations[0];
            group.element.onclick = () => {
                this.navigateToLocation(firstLocation);
            };
        }
    }
    
    navigateToLocation(location) {
        if (!location || !this.game) return;
        
        // Center camera on location
        this.game.camera.x = location.x - this.game.canvas.width / 2;
        this.game.camera.y = location.y - this.game.canvas.height / 2;
        this.game.constrainCamera();
    }
    
    // Convenience methods
    showPowerWarning(ratio) {
        const percentage = Math.floor(ratio * 100);
        let message;
        if (ratio < 0.5) {
            message = `⚠️ CRITICAL: Power at ${percentage}% - Build more Power Plants!`;
        } else if (ratio < 0.75) {
            message = `⚠️ Warning: Power at ${percentage}% - Low power!`;
        } else {
            message = `Power at ${percentage}%`;
        }
        const duration = this.config.duration.power;
        this.show('power', message, { duration });
    }
    
    showUnitAttacked(unit) {
        if (!unit || !unit.owner || unit.owner.isAI) return;
        const name = unit.stats?.name || unit.type || 'Unit';
        const duration = this.config.duration.attack;
        this.show('attack', `${name} under attack!`, {
            entity: unit,
            location: {x: unit.x, y: unit.y},
            duration
        });
    }
    
    showBuildingAttacked(building) {
        if (!building || !building.owner || building.owner.isAI) return;
        const name = building.stats?.name || building.type || 'Building';
        const duration = this.config.duration.attack;
        this.show('attack', `${name} under attack!`, {
            entity: building,
            location: {x: building.x, y: building.y},
            duration
        });
    }
    
    showUnitLost(unit) {
        if (!unit || !unit.owner || unit.owner.isAI) return;
        const name = unit.stats?.name || unit.type || 'Unit';
        const duration = this.config.duration.unitLost;
        this.show('unitLost', `${name} lost!`, {
            entity: unit,
            location: {x: unit.x, y: unit.y},
            duration
        });
    }
    
    showBuildingDestroyed(building) {
        if (!building || !building.owner || building.owner.isAI) return;
        const name = building.stats?.name || building.type || 'Building';
        const duration = this.config.duration.buildingDestroyed;
        this.show('buildingDestroyed', `${name} destroyed!`, {
            entity: building,
            location: {x: building.x, y: building.y},
            duration
        });
    }
}

// Global notification manager instance (will be initialized by Game)
let notificationManager = null;

// Legacy function for backward compatibility
function showNotification(message, duration = 3000) {
    if (notificationManager) {
        notificationManager.show('default', message, {duration});
    } else {
        // Fallback if notification manager not initialized
        const container = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        container.appendChild(notification);
        setTimeout(() => notification.remove(), duration);
    }
}

function playSound(type) {
    // Placeholder for sound effects
    // Could be extended with Web Audio API
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

// Error handling and validation utilities
function validateEntity(entity, entityType = 'Entity') {
    if (!entity) {
        console.warn(`${entityType} is null or undefined`);
        return false;
    }
    if (!entity.isAlive || typeof entity.isAlive !== 'function') {
        console.warn(`${entityType} missing isAlive method`);
        return false;
    }
    if (typeof entity.x !== 'number' || typeof entity.y !== 'number') {
        console.warn(`${entityType} has invalid position`);
        return false;
    }
    return true;
}

function safeCall(func, context, ...args) {
    try {
        return func.apply(context, args);
    } catch (error) {
        console.error(`Error in ${func.name || 'anonymous function'}:`, error);
        return null;
    }
}

function validateMapCoordinates(map, x, y) {
    if (!map) {
        console.warn('Map is null or undefined');
        return false;
    }
    if (typeof x !== 'number' || typeof y !== 'number') {
        console.warn('Invalid coordinates:', x, y);
        return false;
    }
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
        return false;
    }
    return true;
}

// Performance optimization: Pathfinding cache
const pathfindingCache = new Map();
const CACHE_SIZE_LIMIT = 1000;
const CACHE_TTL = 5000; // 5 seconds

function getCachedPath(startX, startY, endX, endY, size = 1) {
    // Include size in cache key to prevent incorrect cache hits
    const key = `${startX},${startY},${endX},${endY},${size}`;
    const cached = pathfindingCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.path;
    }
    return null;
}

function cachePath(startX, startY, endX, endY, path, size = 1) {
    if (pathfindingCache.size >= CACHE_SIZE_LIMIT) {
        // Remove oldest entries (LRU eviction)
        const entries = Array.from(pathfindingCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = Math.floor(CACHE_SIZE_LIMIT * 0.2); // Remove 20%
        for (let i = 0; i < toRemove; i++) {
            pathfindingCache.delete(entries[i][0]);
        }
    }
    
    // Include size in cache key
    const key = `${startX},${startY},${endX},${endY},${size}`;
    pathfindingCache.set(key, {
        path: path,
        timestamp: Date.now()
    });
}

function clearPathfindingCache() {
    pathfindingCache.clear();
}

// Formation utilities
class Formation {
    constructor(id, units, formationType, centerX, centerY, facing = 0) {
        this.id = id;
        this.units = units; // Array of unit references
        this.type = formationType || FORMATION_CONFIG.TYPES.BOX;
        this.centerX = centerX;
        this.centerY = centerY;
        this.facing = facing; // Angle in radians (0 = right, PI/2 = down)
        this.positions = []; // Calculated positions for each unit
        this.calculatePositions();
    }

    calculatePositions() {
        this.positions = [];
        const count = this.units.length;
        if (count === 0) return;

        const spacing = FORMATION_CONFIG.SPACING * TILE_SIZE;
        const cos = Math.cos(this.facing);
        const sin = Math.sin(this.facing);

        switch (this.type) {
            case FORMATION_CONFIG.TYPES.LINE: {
                // Horizontal line
                const lineWidth = (count - 1) * spacing;
                for (let i = 0; i < count; i++) {
                    const offsetX = (i - (count - 1) / 2) * spacing;
                    const rotatedX = this.centerX + offsetX * cos - 0 * sin;
                    const rotatedY = this.centerY + offsetX * sin + 0 * cos;
                    this.positions.push({ x: rotatedX, y: rotatedY });
                }
                break;
            }

            case FORMATION_CONFIG.TYPES.COLUMN: {
                // Vertical column
                const columnHeight = (count - 1) * spacing;
                for (let i = 0; i < count; i++) {
                    const offsetY = (i - (count - 1) / 2) * spacing;
                    const rotatedX = this.centerX + 0 * cos - offsetY * sin;
                    const rotatedY = this.centerY + 0 * sin + offsetY * cos;
                    this.positions.push({ x: rotatedX, y: rotatedY });
                }
                break;
            }

            case FORMATION_CONFIG.TYPES.WEDGE: {
                // V-shaped formation
                const rows = Math.ceil(Math.sqrt(count));
                let unitIndex = 0;
                for (let row = 0; row < rows && unitIndex < count; row++) {
                    const unitsInRow = Math.min(row + 1, count - unitIndex);
                    const rowWidth = (unitsInRow - 1) * spacing;
                    for (let col = 0; col < unitsInRow && unitIndex < count; col++) {
                        const offsetX = (col - (unitsInRow - 1) / 2) * spacing;
                        const offsetY = row * spacing * 0.8;
                        const rotatedX = this.centerX + offsetX * cos - offsetY * sin;
                        const rotatedY = this.centerY + offsetX * sin + offsetY * cos;
                        this.positions.push({ x: rotatedX, y: rotatedY });
                        unitIndex++;
                    }
                }
                break;
            }

            case FORMATION_CONFIG.TYPES.BOX:
            default: {
                // Square box formation
                const cols = Math.ceil(Math.sqrt(count));
                const rows = Math.ceil(count / cols);
                let index = 0;
                for (let row = 0; row < rows && index < count; row++) {
                    for (let col = 0; col < cols && index < count; col++) {
                        const offsetX = (col - (cols - 1) / 2) * spacing;
                        const offsetY = (row - (rows - 1) / 2) * spacing;
                        const rotatedX = this.centerX + offsetX * cos - offsetY * sin;
                        const rotatedY = this.centerY + offsetX * sin + offsetY * cos;
                        this.positions.push({ x: rotatedX, y: rotatedY });
                        index++;
                    }
                }
                break;
            }
        }
    }

    updateCenter(x, y) {
        this.centerX = x;
        this.centerY = y;
        this.calculatePositions();
    }

    updateFacing(angle) {
        this.facing = angle;
        this.calculatePositions();
    }

    getPositionForUnit(unitIndex) {
        if (unitIndex >= 0 && unitIndex < this.positions.length) {
            return this.positions[unitIndex];
        }
        return { x: this.centerX, y: this.centerY };
    }

    removeUnit(unit) {
        const index = this.units.indexOf(unit);
        if (index !== -1) {
            this.units.splice(index, 1);
            this.positions.splice(index, 1);
            this.calculatePositions(); // Recalculate with remaining units
        }
    }

    isValid() {
        return this.units.length > 0 && this.units.every(u => u && u.isAlive && u.isAlive());
    }
}

function createFormation(units, formationType, centerX, centerY, facing = 0) {
    if (!units || units.length === 0) return null;
    
    // Filter out invalid units
    const validUnits = units.filter(u => u && u.isAlive && u.isAlive());
    if (validUnits.length === 0) return null;

    // Calculate facing angle if not provided
    if (facing === 0 && validUnits.length > 0) {
        // Face towards average direction of movement if units are moving
        let avgDx = 0, avgDy = 0;
        let movingCount = 0;
        for (const unit of validUnits) {
            if (unit.path && unit.path.length > 0) {
                const nextNode = unit.path[Math.min(unit.pathIndex, unit.path.length - 1)];
                if (nextNode) {
                    const worldPos = tileToWorld(nextNode.x, nextNode.y);
                    avgDx += worldPos.x - unit.x;
                    avgDy += worldPos.y - unit.y;
                    movingCount++;
                }
            }
        }
        if (movingCount > 0) {
            facing = Math.atan2(avgDy / movingCount, avgDx / movingCount);
        }
    }

    return new Formation(null, validUnits, formationType, centerX, centerY, facing);
}
