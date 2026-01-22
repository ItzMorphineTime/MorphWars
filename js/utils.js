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

function canPlaceBuilding(map, x, y, width, height, player, game) {
    if (x < 0 || y < 0 || x + width > map.width || y + height > map.height) {
        return false;
    }

    for (let ty = y; ty < y + height; ty++) {
        for (let tx = x; tx < x + width; tx++) {
            const tile = map.getTile(tx, ty);
            if (tile.blocked || tile.building) {
                return false;
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

function findPath(map, startX, startY, endX, endY, size = 1) {
    // Validate inputs
    if (!validateMapCoordinates(map, startX, startY) || !validateMapCoordinates(map, endX, endY)) {
        return null;
    }

    // Check cache first
    const cached = getCachedPath(startX, startY, endX, endY);
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
        result = findPathHierarchical(map, startX, startY, endX, endY, size);
    } else {
        result = findPathDirect(map, startX, startY, endX, endY, size);
    }

    if (typeof profiler !== 'undefined' && profiler && profiler.enabled) {
        profiler.endProfile('pathfinding');
    }

    return result;
}

// Hierarchical pathfinding for long distances
function findPathHierarchical(map, startX, startY, endX, endY, size = 1) {
    const distanceTiles = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
    const waypointDistance = PATHFINDING.WAYPOINT_DISTANCE;
    
    // Calculate number of waypoints needed
    const numWaypoints = Math.ceil(distanceTiles / waypointDistance);
    
    if (numWaypoints <= 1) {
        // Short path, use regular pathfinding
        return findPathDirect(map, startX, startY, endX, endY, size);
    }

    // Generate waypoints along the direct line
    const waypoints = [];
    for (let i = 1; i < numWaypoints; i++) {
        const t = i / numWaypoints;
        const wx = Math.floor(startX + (endX - startX) * t);
        const wy = Math.floor(startY + (endY - startY) * t);
        
        // Find nearest valid tile for waypoint
        const validWaypoint = findNearestValidTile(map, wx, wy, size);
        if (validWaypoint) {
            waypoints.push(validWaypoint);
        }
    }

    // Build path through waypoints
    const fullPath = [];
    let currentX = startX;
    let currentY = startY;

    for (const waypoint of waypoints) {
        const segmentPath = findPathDirect(map, currentX, currentY, waypoint.x, waypoint.y, size);
        if (segmentPath && segmentPath.length > 0) {
            // Add segment path (skip first point to avoid duplicates)
            for (let i = 1; i < segmentPath.length; i++) {
                fullPath.push(segmentPath[i]);
            }
            currentX = waypoint.x;
            currentY = waypoint.y;
        } else {
            // If waypoint fails, try direct path
            const directPath = findPathDirect(map, currentX, currentY, endX, endY, size);
            if (directPath) {
                return directPath;
            }
            break;
        }
    }

    // Final segment to destination
    const finalSegment = findPathDirect(map, currentX, currentY, endX, endY, size);
    if (finalSegment && finalSegment.length > 0) {
        for (let i = 1; i < finalSegment.length; i++) {
            fullPath.push(finalSegment[i]);
        }
    }

    if (fullPath.length > 0) {
        // Add start point
        fullPath.unshift({ x: startX, y: startY });
        cachePath(startX, startY, endX, endY, fullPath);
        return fullPath;
    }

    // Fallback to direct pathfinding
    return findPathDirect(map, startX, startY, endX, endY, size);
}

function findPathDirect(map, startX, startY, endX, endY, size = 1) {
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

            const tile = map.getTile(neighbor.x, neighbor.y);
            if (!tile) continue;

            const isDestination = neighbor.x === endX && neighbor.y === endY;
            const buildingAllowsUnits = tile.building && tile.building.stats.allowsUnitsOnTop;

            if (!isDestination && (tile.blocked || (tile.unit && tile.unit.size >= size)) && !buildingAllowsUnits) {
                continue;
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

function findNearestValidTile(map, x, y, size = 1, searchRadius = 5) {
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

function showNotification(message, duration = 3000) {
    const container = document.getElementById('notifications');
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    container.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, duration);
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

function getCachedPath(startX, startY, endX, endY) {
    const key = `${startX},${startY},${endX},${endY}`;
    const cached = pathfindingCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.path;
    }
    return null;
}

function cachePath(startX, startY, endX, endY, path) {
    if (pathfindingCache.size >= CACHE_SIZE_LIMIT) {
        // Remove oldest entries
        const entries = Array.from(pathfindingCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = Math.floor(CACHE_SIZE_LIMIT * 0.2); // Remove 20%
        for (let i = 0; i < toRemove; i++) {
            pathfindingCache.delete(entries[i][0]);
        }
    }
    
    const key = `${startX},${startY},${endX},${endY}`;
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
