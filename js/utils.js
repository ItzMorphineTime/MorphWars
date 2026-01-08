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
    // Optimized A* pathfinding with reduced iterations and better data structures
    const openSet = new Map(); // Use Map for O(1) lookup by key
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const startKey = `${startX},${startY}`;
    const endKey = `${endX},${endY}`;

    openSet.set(startKey, { x: startX, y: startY });
    gScore.set(startKey, 0);
    fScore.set(startKey, distance(startX, startY, endX, endY));

    let iterations = 0;
    const maxIterations = PATHFINDING.MAX_ITERATIONS;

    while (openSet.size > 0) {
        // Find node with lowest fScore - more efficient than sorting entire array
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
            // Reconstruct path
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

        // Check neighbors (cardinal only or with diagonals based on config)
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

            // Check if building allows units on top (e.g., Repair Bay)
            const buildingAllowsUnits = tile.building && tile.building.stats.allowsUnitsOnTop;

            if (!isDestination && (tile.blocked || (tile.unit && tile.unit.size >= size)) && !buildingAllowsUnits) {
                continue;
            }

            // Calculate movement cost (diagonal = 1.414, cardinal = 1)
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

        // Limit pathfinding iterations
        iterations++;
        if (iterations > maxIterations) {
            return null;
        }
    }

    return null; // No path found
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
