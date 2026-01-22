// Map and terrain system

class GameMap {
    constructor(width, height, mapType = MAP_GENERATION.DEFAULT_TYPE, skipResourceGeneration = false, terrainSeed = null) {
        this.width = width;
        this.height = height;
        this.mapType = mapType;
        this.tiles = [];
        this.resourceNodes = [];
        this.lastResourceRegen = Date.now();
        this.heightMapGenerator = null;

        this.initializeTiles();
        // Use provided seed if loading from save, otherwise generate random
        this.generateTerrainWithHeightMap(terrainSeed);
        
        // Skip resource generation if loading from save
        if (!skipResourceGeneration) {
            this.placeResourceNodes();
        }
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
                });
            }
        }
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
            }
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
        }
    }

    clearUnit(x, y) {
        const tile = this.getTile(x, y);
        if (tile) {
            tile.unit = null;
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

    updateFogOfWar(player, entities, airplanes = null) {
        // Reset all tiles to explored
        for (const tile of this.tiles) {
            if (!tile.fogOfWar[player.id]) {
                tile.fogOfWar[player.id] = FOG_UNEXPLORED;
            } else if (tile.fogOfWar[player.id] === FOG_VISIBLE) {
                tile.fogOfWar[player.id] = FOG_EXPLORED;
            }
        }

        // Update visible tiles based on player entities (including airplane units)
        for (const entity of entities) {
            if (entity.owner !== player) continue;

            const tilePos = worldToTile(entity.x, entity.y);
            // Use entity's sight range (airplanes have larger sight for recon)
            const sightRange = entity.stats.sight || SIGHT_RANGE;

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
}
