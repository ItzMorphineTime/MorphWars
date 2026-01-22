// Save/Load system for game state persistence

class SaveLoadManager {
    constructor(game) {
        this.game = game;
        this.storageKey = 'rts_game_saves';
        this.maxSaves = 10;
    }

    saveGame(saveName = null) {
        try {
            const gameState = this.serializeGameState();
            const timestamp = Date.now();
            const saveData = {
                name: saveName || `Save ${new Date().toLocaleString()}`,
                timestamp: timestamp,
                version: '1.0',
                gameState: gameState,
            };

            // Get existing saves
            const saves = this.getSaveList();
            
            // Remove old save with same name if exists
            const existingIndex = saves.findIndex(s => s.name === saveData.name);
            if (existingIndex !== -1) {
                saves.splice(existingIndex, 1);
            }

            // Add new save
            saves.unshift(saveData);

            // Limit number of saves
            if (saves.length > this.maxSaves) {
                saves.splice(this.maxSaves);
            }

            // Store saves
            localStorage.setItem(this.storageKey, JSON.stringify(saves));

            showNotification(`Game saved: ${saveData.name}`);
            return true;
        } catch (error) {
            console.error('Error saving game:', error);
            showNotification('Failed to save game');
            return false;
        }
    }

    loadGame(saveName) {
        try {
            const saves = this.getSaveList();
            const saveData = saves.find(s => s.name === saveName);

            if (!saveData) {
                showNotification('Save file not found');
                return false;
            }

            this.deserializeGameState(saveData.gameState);
            showNotification(`Game loaded: ${saveData.name}`);
            return true;
        } catch (error) {
            console.error('Error loading game:', error);
            showNotification('Failed to load game');
            return false;
        }
    }

    deleteSave(saveName) {
        try {
            const saves = this.getSaveList();
            const filtered = saves.filter(s => s.name !== saveName);
            localStorage.setItem(this.storageKey, JSON.stringify(filtered));
            showNotification(`Save deleted: ${saveName}`);
            return true;
        } catch (error) {
            console.error('Error deleting save:', error);
            return false;
        }
    }

    getSaveList() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error reading saves:', error);
            return [];
        }
    }

    serializeGameState() {
        const game = this.game;
        
        return {
            // Map state
            map: {
                width: game.map.width,
                height: game.map.height,
                mapType: game.map.mapType,
                // Save heightmap seed for terrain regeneration (if available)
                heightmapSeed: game.map.heightMapGenerator && game.map.heightMapGenerator.seed ? game.map.heightMapGenerator.seed : null,
                resourceNodes: game.map.resourceNodes.map(node => ({
                    x: node.x,
                    y: node.y,
                    type: node.type,
                    resources: node.resources,
                    maxResources: node.maxResources,
                    valueMultiplier: node.valueMultiplier,
                    color: node.color,
                })),
            },

            // Players
            players: game.players.map(player => ({
                id: player.id,
                name: player.name,
                color: player.color,
                isAI: player.isAI,
                credits: player.credits,
                powerGenerated: player.powerGenerated,
                powerConsumed: player.powerConsumed,
                unlockedTiers: [...player.unlockedTiers],
                specialPowers: JSON.parse(JSON.stringify(player.specialPowers)),
            })),

            // Units
            units: game.units.map(unit => {
                const baseData = {
                    type: unit.type,
                    x: unit.x,
                    y: unit.y,
                    hp: unit.hp,
                    maxHp: unit.maxHp,
                    ownerId: unit.owner.id,
                    veterancy: unit.veterancy || 0,
                    cargo: unit.cargo || 0,
                    ammo: unit.ammo || 0,
                    formationId: unit.formationId || null,
                    formationIndex: unit.formationIndex || null,
                };
                
                // Add airplane-specific properties
                if (unit.isAirplane) {
                    baseData.isAirplane = true;
                    baseData.landed = unit.landed || false;
                    baseData.flyByState = unit.flyByState || 'idle';
                    baseData.angle = unit.angle || 0;
                    baseData.velocity = unit.velocity ? { x: unit.velocity.x, y: unit.velocity.y } : { x: 0, y: 0 };
                    // Save homeAirfield reference by building index
                    if (unit.homeAirfield) {
                        const airfieldIndex = game.buildings.indexOf(unit.homeAirfield);
                        baseData.homeAirfieldIndex = airfieldIndex >= 0 ? airfieldIndex : null;
                    }
                }
                
                return baseData;
            }),

            // Buildings
            buildings: game.buildings.map(building => ({
                type: building.type,
                tileX: building.tileX,
                tileY: building.tileY,
                hp: building.hp,
                maxHp: building.maxHp,
                ownerId: building.owner.id,
                isUnderConstruction: building.isUnderConstruction,
                constructionProgress: building.constructionProgress,
                productionQueue: building.productionQueue.map(item => ({
                    type: item.type,
                    // Store type only, stats will be reconstructed from UNIT_TYPES
                })),
                currentProduction: building.currentProduction ? {
                    type: building.currentProduction.type,
                    // Store type only, stats will be reconstructed from UNIT_TYPES
                } : null,
                productionProgress: building.productionProgress || 0,
                productionPaused: building.productionPaused || false,
                rallyPoint: building.rallyPoint,
                hasSpawnedHarvester: building.hasSpawnedHarvester || false,
            })),

            // Game state
            gameTime: game.gameTime,
            camera: { x: game.camera.x, y: game.camera.y },
            stats: game.stats ? JSON.parse(JSON.stringify(game.stats)) : null,
            nextFormationId: game.nextFormationId || 0,
        };
    }

    deserializeGameState(state) {
        const game = this.game;

        // Clear existing game state
        game.units = [];
        game.buildings = [];
        game.selectedEntities = [];
        game.activeFormations.clear();

        // Recreate map with saved dimensions and type, using saved seed for terrain
        // Use saved heightmap seed if available to regenerate same terrain
        const heightmapSeed = state.map.heightmapSeed || null;
        game.map = new GameMap(state.map.width, state.map.height, state.map.mapType, true, heightmapSeed);
        
        // Restore resource nodes from save
        game.map.resourceNodes = state.map.resourceNodes.map(nodeData => ({
            x: nodeData.x,
            y: nodeData.y,
            type: nodeData.type,
            resources: nodeData.resources,
            maxResources: nodeData.maxResources,
            valueMultiplier: nodeData.valueMultiplier,
            color: nodeData.color,
        }));
        
        // Update terrain tiles to mark resource areas (important for rendering and pathfinding)
        for (const node of game.map.resourceNodes) {
            // Mark surrounding tiles with resource terrain
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const tile = game.map.getTile(node.x + dx, node.y + dy);
                    if (tile && tile.terrain === 'grass') {
                        tile.terrain = 'resource';
                    }
                }
            }
        }
        
        // Reinitialize fog of war for all players
        const totalPlayers = state.players.length;
        for (const tile of game.map.tiles) {
            tile.fogOfWar = new Array(totalPlayers).fill(FOG_UNEXPLORED);
        }
        
        // Restore players
        game.players = [];
        game.humanPlayer = null;
        for (const playerData of state.players) {
            const player = new Player(
                playerData.id,
                playerData.name,
                playerData.color,
                playerData.isAI
            );
            player.credits = playerData.credits;
            player.powerGenerated = playerData.powerGenerated;
            player.powerConsumed = playerData.powerConsumed;
            player.unlockedTiers = playerData.unlockedTiers;
            player.specialPowers = playerData.specialPowers;
            game.players.push(player);
            
            if (!player.isAI) {
                game.humanPlayer = player;
            }
        }

        // Restore buildings
        for (const buildingData of state.buildings) {
            const owner = game.players.find(p => p.id === buildingData.ownerId);
            if (!owner) continue;

            const stats = BUILDING_TYPES[buildingData.type];
            if (!stats) continue;

            const building = new Building(
                buildingData.tileX,
                buildingData.tileY,
                buildingData.type,
                stats,
                owner
            );
            building.hp = buildingData.hp;
            building.maxHp = buildingData.maxHp;
            building.isUnderConstruction = buildingData.isUnderConstruction;
            building.constructionProgress = buildingData.constructionProgress;
            // CRITICAL: Ensure isOperational is set correctly based on construction state
            building.isOperational = !building.isUnderConstruction;
            // Reconstruct production queue with stats from UNIT_TYPES
            building.productionQueue = buildingData.productionQueue.map(item => {
                const unitStats = UNIT_TYPES[item.type];
                if (!unitStats) return null;
                return {
                    type: item.type,
                    stats: unitStats,
                };
            }).filter(item => item !== null);
            // Reconstruct current production with stats from UNIT_TYPES
            building.currentProduction = buildingData.currentProduction ? (() => {
                const unitStats = UNIT_TYPES[buildingData.currentProduction.type];
                if (!unitStats) return null;
                return {
                    type: buildingData.currentProduction.type,
                    stats: unitStats,
                };
            })() : null;
            building.productionProgress = buildingData.productionProgress || 0;
            building.productionPaused = buildingData.productionPaused || false; // Restore pause state
            building.rallyPoint = buildingData.rallyPoint;
            building.hasSpawnedHarvester = buildingData.hasSpawnedHarvester || false;

            game.buildings.push(building);
            game.map.setBuilding(buildingData.tileX, buildingData.tileY, stats.width, stats.height, building);
        }

        // Restore units
        for (const unitData of state.units) {
            const owner = game.players.find(p => p.id === unitData.ownerId);
            if (!owner) continue;

            const stats = UNIT_TYPES[unitData.type];
            if (!stats) continue;

            const unit = new Unit(unitData.x, unitData.y, unitData.type, stats, owner);
            unit.hp = unitData.hp;
            unit.maxHp = unitData.maxHp;
            unit.veterancy = unitData.veterancy || 0;
            unit.cargo = unitData.cargo || 0;
            unit.ammo = unitData.ammo || 0;
            unit.formationId = unitData.formationId;
            unit.formationIndex = unitData.formationIndex;

            // Restore airplane-specific properties
            if (unit.isAirplane && unitData.isAirplane) {
                unit.landed = unitData.landed || false;
                unit.flyByState = unitData.flyByState || 'idle';
                unit.angle = unitData.angle || 0;
                unit.velocity = unitData.velocity ? { x: unitData.velocity.x, y: unitData.velocity.y } : { x: 0, y: 0 };
                // Restore homeAirfield reference
                if (unitData.homeAirfieldIndex !== undefined && unitData.homeAirfieldIndex !== null) {
                    const airfield = game.buildings[unitData.homeAirfieldIndex];
                    if (airfield && airfield.type === 'AIRFIELD') {
                        unit.homeAirfield = airfield;
                    }
                }
            }

            game.units.push(unit);
            const tile = worldToTile(unitData.x, unitData.y);
            game.map.setUnit(tile.x, tile.y, unit);
        }

        // Restore formations
        const formationGroups = new Map();
        for (const unit of game.units) {
            if (unit.formationId) {
                if (!formationGroups.has(unit.formationId)) {
                    formationGroups.set(unit.formationId, []);
                }
                formationGroups.get(unit.formationId).push(unit);
            }
        }

        for (const [formationId, units] of formationGroups.entries()) {
            if (units.length < 2) continue;

            // Calculate center
            let centerX = 0, centerY = 0;
            for (const unit of units) {
                centerX += unit.x;
                centerY += unit.y;
            }
            centerX /= units.length;
            centerY /= units.length;

            const formation = createFormation(units, FORMATION_CONFIG.TYPES.BOX, centerX, centerY);
            if (formation) {
                formation.id = formationId;
                game.activeFormations.set(formationId, formation);
            }
        }

        // Restore camera
        game.camera.x = state.camera.x;
        game.camera.y = state.camera.y;

        // Restore game time
        game.gameTime = state.gameTime || 0;

        // Restore nextFormationId
        game.nextFormationId = state.nextFormationId || 1;

        // Restore stats
        if (state.stats && game.stats) {
            game.stats = JSON.parse(JSON.stringify(state.stats));
        }

        // Recreate AI controllers
        game.aiControllers = [];
        for (const player of game.players) {
            if (player.isAI) {
                // Note: AI difficulty is not saved, will use default
                game.aiControllers.push(new AIController(player, 'medium', game));
            }
        }

        // Clear pathfinding cache (map has changed, old paths are invalid)
        clearPathfindingCache();

        // Update fog of war
        const allEntities = [...game.units, ...game.buildings];
        for (const player of game.players) {
            // Pass airplanes (they're not saved/loaded, so pass null)
            game.map.updateFogOfWar(player, allEntities, null);
        }

        // CRITICAL: Recalculate tech tree and power based on operational buildings
        for (const player of game.players) {
            player.updateTechTree(game.buildings);
            player.updatePower(game.buildings);
        }

        // Start game loop if not already running (lastFrameTime is 0 when game is first created)
        // Use setTimeout to ensure canvas is visible and ready
        setTimeout(() => {
            if (game.lastFrameTime === 0 || !game.lastFrameTime) {
                game.lastFrameTime = performance.now();
                requestAnimationFrame((time) => game.gameLoop(time));
            }
        }, 100);
    }
}
