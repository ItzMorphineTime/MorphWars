// Spatial Grid for optimized pathfinding collision detection

class SpatialGrid {
    constructor(map, cellSize = 10) {
        this.map = map;
        this.cellSize = cellSize;
        this.grid = new Map(); // Key: "x,y" string, Value: array of blocked tile positions
        this.dirty = true; // Flag to rebuild grid when map changes
        this.buildGrid();
    }
    
    buildGrid() {
        this.grid.clear();
        
        // Pre-calculate blocked tiles by cell
        // Note: We only cache static obstacles (terrain, buildings)
        // Units are checked dynamically in isTileBlocked() since they move
        for (let y = 0; y < this.map.height; y++) {
            for (let x = 0; x < this.map.width; x++) {
                const tile = this.map.getTile(x, y);
                if (!tile) continue;
                
                // Check if tile is blocked by terrain or building (static obstacles)
                // Don't include units in the grid cache since they move
                if (tile.blocked || (tile.building && !tile.building.stats.allowsUnitsOnTop)) {
                    const cellX = Math.floor(x / this.cellSize);
                    const cellY = Math.floor(y / this.cellSize);
                    const key = `${cellX},${cellY}`;
                    
                    if (!this.grid.has(key)) {
                        this.grid.set(key, []);
                    }
                    this.grid.get(key).push({x, y});
                }
            }
        }
        
        this.dirty = false;
    }
    
    // Get blocked tiles in a specific area (for pathfinding)
    getBlockedTilesInArea(centerX, centerY, radius) {
        if (this.dirty) {
            this.buildGrid();
        }
        
        const blockedTiles = new Set();
        const startCellX = Math.floor((centerX - radius) / this.cellSize);
        const endCellX = Math.floor((centerX + radius) / this.cellSize);
        const startCellY = Math.floor((centerY - radius) / this.cellSize);
        const endCellY = Math.floor((centerY + radius) / this.cellSize);
        
        // Check all cells that might contain blocked tiles in the area
        for (let cellY = startCellY; cellY <= endCellY; cellY++) {
            for (let cellX = startCellX; cellX <= endCellX; cellX++) {
                const key = `${cellX},${cellY}`;
                const tiles = this.grid.get(key);
                
                if (tiles) {
                    for (const tile of tiles) {
                        const dist = Math.sqrt((tile.x - centerX) ** 2 + (tile.y - centerY) ** 2);
                        if (dist <= radius) {
                            blockedTiles.add(`${tile.x},${tile.y}`);
                        }
                    }
                }
            }
        }
        
        return blockedTiles;
    }
    
    // Check if a specific tile is blocked (fast lookup)
    isTileBlocked(x, y, size = 1, isHarvester = false, isNaval = false, isAir = false) {
        if (this.dirty) {
            this.buildGrid();
        }
        
        // For units with size > 1, check if the unit can fit in the area
        // A size 2 unit needs a 2x2 area, size 3 needs 3x3, etc.
        const unitSize = Math.ceil(size);
        
        for (let dy = 0; dy < unitSize; dy++) {
            for (let dx = 0; dx < unitSize; dx++) {
                const checkX = x + dx;
                const checkY = y + dy;
                
                if (checkX < 0 || checkY < 0 || checkX >= this.map.width || checkY >= this.map.height) {
                    return true; // Out of bounds
                }
                
                const tile = this.map.getTile(checkX, checkY);
                if (!tile) {
                    return true; // Invalid tile
                }
                
                // Naval units can move on water or within 1 tile of land
                if (isNaval && !this.map.isNavalValid(checkX, checkY)) {
                    return true;
                }
                
                // Non-naval, non-air units cannot move on water (air units fly over)
                if (!isNaval && !isAir && this.map.isWater(checkX, checkY)) {
                    return true;
                }
                
                // Check if blocked by terrain or building
                // For naval units, water tiles are valid even if marked as blocked
                if (isNaval && this.map.isWater(checkX, checkY)) {
                    // Water tiles are valid for naval units even if blocked
                    // Only check building collision
                    if (tile.building && !tile.building.stats.allowsUnitsOnTop) {
                        return true;
                    }
                } else if (tile.blocked || (tile.building && !tile.building.stats.allowsUnitsOnTop)) {
                    return true;
                }
                
                // Check if blocked by unit (if unit size >= our size)
                // Harvesters can pass through other harvesters
                // Naval units can pass through other naval units
                if (tile.unit && tile.unit.size >= size) {
                    // If requesting unit is a harvester, ignore other harvesters
                    if (isHarvester && tile.unit.isHarvester) {
                        continue; // Allow harvester to pass through other harvesters
                    }
                    // If requesting unit is naval, ignore other naval units
                    if (isNaval && tile.unit.isNaval) {
                        continue; // Allow naval unit to pass through other naval units
                    }
                    return true; // Blocked by unit
                }
            }
        }
        
        return false;
    }
    
    // Mark grid as dirty (call when map changes)
    markDirty() {
        this.dirty = true;
    }
    
    // Update grid for a specific area (incremental update)
    updateArea(x, y, width, height) {
        // For now, just mark as dirty and rebuild
        // Could be optimized to only update affected cells
        this.markDirty();
    }
}
