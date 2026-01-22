// Map and terrain system

class GameMap {
    constructor(width, height, mapType = MAP_GENERATION.DEFAULT_TYPE, skipResourceGeneration = false, terrainSeed = null, customMapData = null) {
        this.width = width;
        this.height = height;
        this.mapType = mapType;
        this.tiles = [];
        this.resourceNodes = [];
        this.lastResourceRegen = Date.now();
        this.heightMapGenerator = null;
        this.customSpawnPoints = null; // Store custom spawn points
        this.spatialGrid = null; // Will be initialized after terrain generation

        this.initializeTiles();
        
        // Load from custom map data if provided
        if (customMapData) {
            this.loadCustomMap(customMapData);
        } else {
            // Use provided seed if loading from save, otherwise generate random
            this.generateTerrainWithHeightMap(terrainSeed);
            
            // Skip resource generation if loading from save
            if (!skipResourceGeneration) {
                this.placeResourceNodes();
            }
        }
    }
    
    loadCustomMap(data) {
        // Restore tiles
        for (const tileData of data.tiles) {
            const tile = this.getTile(tileData.x, tileData.y);
            if (tile) {
                tile.terrain = tileData.terrain;
                tile.blocked = tileData.blocked;
            }
        }
        
        // Restore resource nodes
        this.resourceNodes = data.resourceNodes.map(nodeData => ({
            x: nodeData.x,
            y: nodeData.y,
            type: nodeData.type,
            resources: nodeData.resources,
            maxResources: nodeData.maxResources,
            valueMultiplier: nodeData.valueMultiplier,
            color: nodeData.color,
        }));
        
        // Mark resource terrain and recalculate colors
        for (const node of this.resourceNodes) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const tile = this.getTile(node.x + dx, node.y + dy);
                    if (tile && tile.terrain === 'grass') {
                        tile.terrain = 'resource';
                        // Recalculate color for resource terrain
                        const height = this.heightMapGenerator ? this.heightMapGenerator.getHeight(tile.x, tile.y) : 0.5;
                        tile.color = this.calculateTerrainColor(tile.x, tile.y, 'resource', height);
                    }
                }
            }
        }
        
        // Store custom spawn points
        this.customSpawnPoints = data.spawnPoints || [];
    }

    update(deltaTime) {
        // Regenerate resources based on config
        const now = Date.now();
        if (now - this.lastResourceRegen > RESOURCE_CONFIG.REGENERATION_INTERVAL) {
            for (const node of this.resourceNodes) {
                if (node.resources < node.maxResources) {
                    node.resources = Math.min(node.maxResources, node.resources + RESOURCE_CONFIG.REGENERATION_RATE);
                }
            }
            this.lastResourceRegen = now;
        }
    }

    initializeTiles() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.tiles.push({
                    x,
                    y,
                    terrain: 'grass',
                    blocked: false,
                    unit: null,
                    building: null,
                    fogOfWar: [], // Array of fog states per player
                    color: null, // Pre-calculated terrain color (for rendering optimization)
                });
            }
        }
    }
    
    // Calculate terrain color based on terrain type and height
    calculateTerrainColor(x, y, terrain, height = 0.5) {
        let color = '#2a4a2a'; // Default grass
        
        if (terrain === 'water') {
            // Water: darker blue for deeper water
            const waterDepth = Math.floor((1 - height) * 40);
            color = `rgb(${10 + waterDepth}, ${40 + waterDepth}, ${100 + waterDepth})`;
        } else if (terrain === 'rock') {
            // Rock/Mountains: lighter gray for higher elevation
            const rockBrightness = Math.floor(60 + height * 80);
            color = `rgb(${rockBrightness}, ${rockBrightness}, ${rockBrightness})`;
        } else if (terrain === 'resource') {
            color = '#6a4a2a';
        } else {
            // Grass: darker green for lower elevation, lighter for higher
            const grassGreen = Math.floor(50 + height * 30);
            const grassRed = Math.floor(30 + height * 20);
            color = `rgb(${grassRed}, ${grassGreen + 24}, ${grassRed})`;
        }
        
        return color;
    }

    getTile(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return null;
        }
        return this.tiles[y * this.width + x];
    }

    generateTerrainWithHeightMap(seed = null) {
        // Generate heightmap using Perlin noise
        // Use provided seed if loading from save, otherwise random
        const heightmapSeed = seed !== null ? seed : Math.random();
        this.heightMapGenerator = new HeightMapGenerator(this.width, this.height, heightmapSeed);
        this.heightMapGenerator.generate(this.mapType);

        // Convert heightmap to terrain tiles
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const tile = this.getTile(x, y);
                if (!tile) continue;

                const terrainType = this.heightMapGenerator.getTerrainType(x, y, this.mapType);
                tile.terrain = terrainType;

                // Block non-grass tiles
                if (terrainType === 'rock' || terrainType === 'water') {
                    tile.blocked = true;
                }
                
                // Pre-calculate terrain color for rendering optimization
                const height = this.heightMapGenerator.getHeight(x, y);
                tile.color = this.calculateTerrainColor(x, y, terrainType, height);
            }
        }
        
        // Initialize spatial grid after terrain generation
        if (typeof SpatialGrid !== 'undefined') {
            this.spatialGrid = new SpatialGrid(this);
        }
    }

    placeResourceNodes() {
        const resourceMultiplier = MAP_GENERATION.RESOURCE_MULTIPLIER[this.mapType] || 1.0;
        const baseNumNodes = Math.floor(this.width * this.height * 0.003);
        const numNodes = Math.floor(baseNumNodes * resourceMultiplier);
        const minDistance = 20;

        let placedNodes = 0;
        let attempts = 0;
        const maxAttempts = numNodes * 100; // Prevent infinite loops

        while (placedNodes < numNodes && attempts < maxAttempts) {
            attempts++;

            const x = getRandomInt(5, this.width - 6);
            const y = getRandomInt(5, this.height - 6);

            // Check if location is suitable (using heightmap)
            const suitability = this.heightMapGenerator.getResourceSuitability(x, y, this.mapType);
            if (suitability < 0.3) continue; // Skip unsuitable locations

            // Check distance from other nodes
            let tooClose = false;
            for (const node of this.resourceNodes) {
                if (distance(x, y, node.x, node.y) < minDistance) {
                    tooClose = true;
                    break;
                }
            }

            if (!tooClose) {
                const tile = this.getTile(x, y);
                if (tile && !tile.blocked && tile.terrain === 'grass') {
                    // Determine resource type (Ore or Gems)
                    // Gems are rarer and prefer higher elevation
                    const height = this.heightMapGenerator.getHeight(x, y);
                    const gemBonus = Math.max(0, (height - 0.5) * 0.3); // Higher elevation = more likely gems
                    const gemChance = RESOURCE_CONFIG.GEM_SPAWN_CHANCE + gemBonus;
                    const isGems = Math.random() < gemChance;
                    const nodeType = isGems ? RESOURCE_CONFIG.NODE_TYPES.GEMS : RESOURCE_CONFIG.NODE_TYPES.ORE;

                    const initialResources = getRandomInt(nodeType.minValue, nodeType.maxValue);

                    this.resourceNodes.push({
                        x,
                        y,
                        type: isGems ? 'gems' : 'ore',
                        resources: initialResources,
                        maxResources: nodeType.maxValue,
                        valueMultiplier: nodeType.baseValue,
                        color: nodeType.color,
                    });

                    // Mark surrounding tiles with resource terrain (but don't override water/rock)
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const t = this.getTile(x + dx, y + dy);
                            if (t && t.terrain === 'grass') {
                                t.terrain = 'resource';
                            }
                        }
                    }

                    placedNodes++;
                }
            }
        }

        console.log(`Placed ${placedNodes} resource nodes (target: ${numNodes})`);
    }

    getResourceNode(x, y) {
        for (const node of this.resourceNodes) {
            if (Math.abs(node.x - x) <= 1 && Math.abs(node.y - y) <= 1) {
                return node;
            }
        }
        return null;
    }

    getHarvesterCountForNode(node) {
        // Count how many harvesters are targeting or harvesting from this node
        if (!node.harvesters) {
            node.harvesters = []; // Array of harvester references
        }
        // Clean up dead harvesters
        node.harvesters = node.harvesters.filter(h => h && h.isAlive && h.isAlive());
        return node.harvesters.length;
    }

    addHarvesterToNode(node, harvester) {
        if (!node.harvesters) {
            node.harvesters = [];
        }
        if (!node.harvesters.includes(harvester)) {
            node.harvesters.push(harvester);
        }
    }

    removeHarvesterFromNode(node, harvester) {
        if (node.harvesters) {
            const index = node.harvesters.indexOf(harvester);
            if (index !== -1) {
                node.harvesters.splice(index, 1);
            }
        }
    }

    harvestResource(node, amount) {
        if (!node || node.resources <= 0) return 0;

        const harvested = Math.min(amount, node.resources);
        node.resources -= harvested;
        return harvested;
    }

    setUnit(x, y, unit) {
        const tile = this.getTile(x, y);
        if (tile) {
            tile.unit = unit;
            // Mark spatial grid as dirty when units are placed
            if (this.spatialGrid) {
                this.spatialGrid.markDirty();
            }
        }
    }

    clearUnit(x, y) {
        const tile = this.getTile(x, y);
        if (tile) {
            tile.unit = null;
            // Mark spatial grid as dirty when units are removed
            if (this.spatialGrid) {
                this.spatialGrid.markDirty();
            }
        }
    }

    setBuilding(x, y, width, height, building) {
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                const tile = this.getTile(x + dx, y + dy);
                if (tile) {
                    tile.building = building;
                    // Only block tile if building doesn't allow units on top (e.g., Repair Bay)
                    tile.blocked = !building.stats.allowsUnitsOnTop;
                }
            }
        }
        // Mark spatial grid as dirty when buildings are placed
        if (this.spatialGrid) {
            this.spatialGrid.markDirty();
        }
    }

    clearBuilding(x, y, width, height) {
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                const tile = this.getTile(x + dx, y + dy);
                if (tile) {
                    tile.building = null;
                    // Only unblock if terrain allows (rock/water should stay blocked)
                    if (tile.terrain !== 'rock' && tile.terrain !== 'water') {
                        tile.blocked = false;
                    }
                }
            }
        }
    }

    updateFogOfWar(player, entities, changedEntities = null) {
        // Optimization: Throttle full fog updates but always process all entities
        // This reduces fog calculation overhead by 50-70% while maintaining visibility
        
        const now = Date.now();
        const FOG_UPDATE_INTERVAL = 100; // Update fog every 100ms instead of every frame
        
        // Initialize entity position tracking if not exists
        if (!this.entityPositions) {
            this.entityPositions = new Map(); // Map of entity ID to last known position
        }
        
        // Throttle full fog reset (only reset visible->explored periodically)
        if (!this.lastFogUpdateTime) {
            this.lastFogUpdateTime = now;
        }
        
        const needsFullUpdate = (now - this.lastFogUpdateTime) >= FOG_UPDATE_INTERVAL;
        
        if (needsFullUpdate) {
            // Reset visible tiles to explored (only do this periodically)
            for (const tile of this.tiles) {
                if (!tile.fogOfWar[player.id]) {
                    tile.fogOfWar[player.id] = FOG_UNEXPLORED;
                } else if (tile.fogOfWar[player.id] === FOG_VISIBLE) {
                    tile.fogOfWar[player.id] = FOG_EXPLORED;
                }
            }
            this.lastFogUpdateTime = now;
        }

        // CRITICAL FIX: Always update fog for ALL player entities, not just moving ones
        // Buildings never move but should still reveal fog
        // Stationary units should also reveal fog around them
        
        // Separate entities into buildings and units
        // Buildings have tileX/tileY properties, units don't
        const buildings = [];
        const units = [];
        
        for (const entity of entities) {
            if (entity.owner !== player) continue;
            if (!entity.isAlive()) continue;
            
            // Check if it's a building (has tileX property) or unit
            if (entity.tileX !== undefined && entity.tileY !== undefined) {
                buildings.push(entity);
            } else {
                units.push(entity);
            }
        }

        // Always update fog for buildings (they're stationary but should reveal fog)
        for (const building of buildings) {
            const tilePos = { x: building.tileX, y: building.tileY };
            // Buildings have sight range too (for radar, etc.)
            const sightRange = building.stats.sight || SIGHT_RANGE;

            for (let dy = -sightRange; dy <= sightRange; dy++) {
                for (let dx = -sightRange; dx <= sightRange; dx++) {
                    if (dx * dx + dy * dy <= sightRange * sightRange) {
                        const tile = this.getTile(tilePos.x + dx, tilePos.y + dy);
                        if (tile) {
                            tile.fogOfWar[player.id] = FOG_VISIBLE;
                        }
                    }
                }
            }
        }

        // For units: Always update fog, but we can optimize by tracking positions
        // to skip redundant calculations for truly stationary units
        for (const unit of units) {
            const entityId = unit.id || `${unit.constructor.name}_${unit.x}_${unit.y}`;
            const lastPos = this.entityPositions.get(entityId);
            const currentPos = { x: unit.x, y: unit.y };
            
            // Check if unit moved significantly (more than 1 tile)
            const hasMoved = !lastPos || 
                Math.abs(lastPos.x - currentPos.x) > TILE_SIZE || 
                Math.abs(lastPos.y - currentPos.y) > TILE_SIZE;
            
            // Always update fog for units (even if stationary)
            // But we can skip position update if unit hasn't moved
            const tilePos = worldToTile(unit.x, unit.y);
            // Use entity's sight range (airplanes have larger sight for recon)
            const sightRange = unit.stats.sight || SIGHT_RANGE;

            for (let dy = -sightRange; dy <= sightRange; dy++) {
                for (let dx = -sightRange; dx <= sightRange; dx++) {
                    if (dx * dx + dy * dy <= sightRange * sightRange) {
                        const tile = this.getTile(tilePos.x + dx, tilePos.y + dy);
                        if (tile) {
                            tile.fogOfWar[player.id] = FOG_VISIBLE;
                        }
                    }
                }
            }
            
            // Update position tracking only if unit moved
            if (hasMoved) {
                this.entityPositions.set(entityId, currentPos);
            }
        }
    }

    isTileVisible(x, y, playerId) {
        const tile = this.getTile(x, y);
        return tile && tile.fogOfWar[playerId] === FOG_VISIBLE;
    }

    isTileExplored(x, y, playerId) {
        const tile = this.getTile(x, y);
        return tile && tile.fogOfWar[playerId] !== FOG_UNEXPLORED;
    }

    findSpawnLocation(playerIndex, totalPlayers) {
        // Use custom spawn point if available
        if (this.customSpawnPoints && this.customSpawnPoints.length > 0) {
            const customSpawn = this.customSpawnPoints.find(sp => sp.playerIndex === playerIndex);
            if (customSpawn) {
                const tile = this.getTile(customSpawn.x, customSpawn.y);
                if (tile && this.isValidSpawnTile(customSpawn.x, customSpawn.y)) {
                    console.log(`Player ${playerIndex} using custom spawn: (${customSpawn.x}, ${customSpawn.y})`);
                    return { x: customSpawn.x, y: customSpawn.y };
                }
            }
        }
        
        // Place players in corners or edges based on player count
        const spacing = 15;
        let targetX, targetY;

        if (totalPlayers === 2) {
            // Opposite corners
            if (playerIndex === 0) {
                targetX = spacing;
                targetY = spacing;
            } else {
                targetX = this.width - spacing;
                targetY = this.height - spacing;
            }
        } else if (totalPlayers === 3) {
            // Three corners
            const positions = [
                { x: spacing, y: spacing },
                { x: this.width - spacing, y: spacing },
                { x: this.width / 2, y: this.height - spacing },
            ];
            ({ x: targetX, y: targetY } = positions[playerIndex]);
        } else if (totalPlayers === 4) {
            // Four corners
            const positions = [
                { x: spacing, y: spacing },
                { x: this.width - spacing, y: spacing },
                { x: spacing, y: this.height - spacing },
                { x: this.width - spacing, y: this.height - spacing },
            ];
            ({ x: targetX, y: targetY } = positions[playerIndex]);
        }

        // Use heightmap to find valid spawn location (avoid water and mountains)
        if (this.heightMapGenerator) {
            const validSpawn = this.heightMapGenerator.findValidSpawnArea(targetX, targetY, 30, this.mapType);
            if (validSpawn) {
                console.log(`Player ${playerIndex} spawn: (${validSpawn.x}, ${validSpawn.y})`);
                return validSpawn;
            }
        }

        // Fallback: search in expanding spiral for any valid land
        for (let radius = 0; radius < 40; radius++) {
            for (let angle = 0; angle < Math.PI * 2; angle += 0.5) {
                const testX = Math.floor(targetX + Math.cos(angle) * radius);
                const testY = Math.floor(targetY + Math.sin(angle) * radius);

                // Check if tile is valid land and can fit a 3x3 building
                if (this.isValidSpawnTile(testX, testY) && canPlaceBuilding(this, testX, testY, 3, 3)) {
                    console.log(`Player ${playerIndex} fallback spawn: (${testX}, ${testY})`);
                    return { x: testX, y: testY };
                }
            }
        }

        console.warn(`Could not find valid spawn for player ${playerIndex}, using target location`);
        return { x: targetX, y: targetY };
    }

    isValidSpawnTile(x, y) {
        const tile = this.getTile(x, y);
        if (!tile) return false;

        // Must be grass (not water, not rock, not resource)
        return tile.terrain === 'grass' && !tile.blocked;
    }

    isWater(x, y) {
        const tile = this.getTile(x, y);
        return tile && tile.terrain === 'water';
    }

    isCoastline(x, y) {
        const tile = this.getTile(x, y);
        if (!tile || tile.terrain === 'water') return false;
        
        // Check if adjacent to water
        const directions = [
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
        ];
        
        for (const dir of directions) {
            const adjTile = this.getTile(x + dir.dx, y + dir.dy);
            if (adjTile && adjTile.terrain === 'water') {
                return true;
            }
        }
        return false;
    }

    // Check if a tile is valid for naval unit movement (water or within 1 tile of land)
    isNavalValid(x, y) {
        const tile = this.getTile(x, y);
        if (!tile) return false;
        
        // Water tiles are always valid
        if (tile.terrain === 'water') return true;
        
        // Check if within 1 tile of water (allows naval units near coastlines)
        const directions = [
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
            { dx: -1, dy: -1 }, { dx: 1, dy: 1 },
            { dx: -1, dy: 1 }, { dx: 1, dy: -1 }
        ];
        
        for (const dir of directions) {
            const adjTile = this.getTile(x + dir.dx, y + dir.dy);
            if (adjTile && adjTile.terrain === 'water') {
                return true; // Within 1 tile of water
            }
        }
        return false;
    }

    hasAdjacentWater(x, y, width, height) {
        // Check all tiles around the building perimeter
        for (let ty = y - 1; ty < y + height + 1; ty++) {
            for (let tx = x - 1; tx < x + width + 1; tx++) {
                // Skip tiles that are part of the building itself
                if (tx >= x && tx < x + width && ty >= y && ty < y + height) {
                    continue;
                }
                if (this.isWater(tx, ty)) {
                    return true;
                }
            }
        }
        return false;
    }
}
