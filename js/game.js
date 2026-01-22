// Main game class

class Game {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.minimapCanvas = document.getElementById('minimap');

        this.map = null;
        this.players = [];
        this.humanPlayer = null;
        this.units = [];
        this.buildings = [];
        this.aiControllers = [];

        this.selectedEntities = [];
        this.camera = { x: 0, y: 0 };

        this.placingBuilding = null;
        this.activePower = null;
        this.attackMoveMode = false;
        
        // Formation management
        this.activeFormations = new Map(); // Map of formation ID to Formation object
        this.nextFormationId = 1;

        this.gameTime = 0;
        this.lastFrameTime = 0;

        // Game statistics tracking
        this.stats = {
            unitsBuilt: 0,
            unitsBuiltByType: {},
            unitsKilled: 0,
            enemiesKilled: 0,
            enemiesKilledByType: {},
            playerUnitsLost: 0,
            playerUnitsLostByType: {},
            moneyEarned: 0,
            moneySpent: 0,
            buildingsBuilt: 0,
            buildingsBuiltByType: {},
            buildingsDestroyed: 0,
        };

        // Game pause state
        this.isPaused = false;

        // Airplanes for special powers (air drop, airstrike, recon sweep)
        this.airplanes = []; // Array of airplane objects

        this.renderer = new Renderer(this, this.canvas, this.minimapCanvas);
        this.input = new InputHandler(this, this.canvas);
        this.ui = new UIController(this);
        
        // Performance profiling
        this.profiler = profiler;
        
        // Save/Load system
        this.saveLoadManager = new SaveLoadManager(this);
    }

    init(mapSize, mapType, aiCount, aiDifficulty, startingCredits = 5000, startingInfantry = 3) {
        // Create map
        const sizes = {
            small: 100,
            medium: 150,
            large: 200,
        };

        const size = sizes[mapSize] || 150;
        this.map = new GameMap(size, size, mapType);

        // Create players
        const totalPlayers = aiCount + 1;

        for (let i = 0; i < totalPlayers; i++) {
            const isAI = i > 0;
            const player = new Player(
                i,
                isAI ? `AI ${i}` : 'Player',
                PLAYER_COLORS[i],
                isAI
            );

            // Set starting credits
            player.credits = startingCredits;

            this.players.push(player);

            if (!isAI) {
                this.humanPlayer = player;
            }
        }

        // Initialize fog of war for all players
        for (const tile of this.map.tiles) {
            tile.fogOfWar = new Array(totalPlayers).fill(FOG_UNEXPLORED);
        }

        // Spawn starting units and buildings
        for (let i = 0; i < this.players.length; i++) {
            this.spawnStartingBase(this.players[i], i, totalPlayers, startingInfantry);
        }

        // Create AI controllers
        for (const player of this.players) {
            if (player.isAI) {
                this.aiControllers.push(new AIController(player, aiDifficulty, this));
            }
        }

        // Center camera on player base
        if (this.humanPlayer) {
            const hq = this.buildings.find(b => b.owner === this.humanPlayer && b.stats.isHQ);
            if (hq) {
                this.camera.x = hq.x - this.canvas.width / 2;
                this.camera.y = hq.y - this.canvas.height / 2;
            }
        }

        // Start game loop
        this.lastFrameTime = performance.now();
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    spawnStartingBase(player, playerIndex, totalPlayers, startingInfantry = 3) {
        const spawnLoc = this.map.findSpawnLocation(playerIndex, totalPlayers);

        // AI players start with HQ deployed, human player must deploy MCV
        if (player.isAI) {
            // Place HQ
            const hqStats = BUILDING_TYPES['HQ'];
            const hq = new Building(spawnLoc.x, spawnLoc.y, 'HQ', hqStats, player);
            this.buildings.push(hq);
            this.map.setBuilding(spawnLoc.x, spawnLoc.y, hqStats.width, hqStats.height, hq);
        }

        // Spawn MCV
        const mcvStats = UNIT_TYPES['MCV'];
        const mcvPos = tileToWorld(spawnLoc.x + 1, spawnLoc.y + 1);
        const mcv = new Unit(mcvPos.x, mcvPos.y, 'MCV', mcvStats, player);
        this.units.push(mcv);
        this.map.setUnit(spawnLoc.x + 1, spawnLoc.y + 1, mcv);

        // Spawn starting units based on configuration
        if (startingInfantry > 0) {
            const riflemanStats = UNIT_TYPES['RIFLEMAN'];
            const unitsPerRow = Math.min(startingInfantry, 5);
            const rows = Math.ceil(startingInfantry / unitsPerRow);

            let unitCount = 0;
            for (let row = 0; row < rows && unitCount < startingInfantry; row++) {
                for (let col = 0; col < unitsPerRow && unitCount < startingInfantry; col++) {
                    const unitPos = tileToWorld(spawnLoc.x - 2 + col, spawnLoc.y + 3 + row);
                    const unit = new Unit(unitPos.x, unitPos.y, 'RIFLEMAN', riflemanStats, player);
                    this.units.push(unit);
                    this.map.setUnit(spawnLoc.x - 2 + col, spawnLoc.y + 3 + row, unit);
                    unitCount++;
                }
            }
        }
    }

    gameLoop(currentTime) {
        this.profiler.startFrame();
        
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        // Skip update if game is paused
        if (!this.isPaused) {
            this.profiler.startProfile('update');
            this.update(deltaTime);
            this.profiler.endProfile('update');
        }

        this.profiler.startProfile('render');
        this.renderer.render();
        this.profiler.endProfile('render');

        this.profiler.endFrame();

        requestAnimationFrame((time) => this.gameLoop(time));
    }

    update(deltaTime) {
        if (!deltaTime || deltaTime <= 0 || !isFinite(deltaTime)) {
            console.warn('Invalid deltaTime:', deltaTime);
            return;
        }

        this.gameTime += deltaTime;

        // Update map (resource regeneration)
        if (this.map) {
            safeCall(this.map.update, this.map, deltaTime);
        }

        // Update units with error handling
        const unitsToRemove = [];
        for (let i = 0; i < this.units.length; i++) {
            const unit = this.units[i];
            if (!validateEntity(unit, 'Unit') || !unit.isAlive()) {
                unitsToRemove.push(i);
                continue;
            }
            safeCall(unit.update, unit, deltaTime, this);
            // Check again after update (airplanes might have been destroyed)
            if (!unit.isAlive()) {
                unitsToRemove.push(i);
            }
        }
        // Remove invalid/dead units in reverse order
        for (let i = unitsToRemove.length - 1; i >= 0; i--) {
            const unit = this.units[unitsToRemove[i]];
            if (unit) {
                // Clear from map
                const tile = worldToTile(unit.x, unit.y);
                this.map.clearUnit(tile.x, tile.y);
                // Remove from formations
                this.removeUnitFromFormation(unit);
            }
            this.units.splice(unitsToRemove[i], 1);
        }

        // Update buildings with error handling
        const buildingsToRemove = [];
        for (let i = 0; i < this.buildings.length; i++) {
            const building = this.buildings[i];
            if (!validateEntity(building, 'Building')) {
                buildingsToRemove.push(i);
                continue;
            }
            safeCall(building.update, building, deltaTime, this);
        }
        // Remove invalid buildings in reverse order
        for (let i = buildingsToRemove.length - 1; i >= 0; i--) {
            this.buildings.splice(buildingsToRemove[i], 1);
        }

        // Update players
        for (const player of this.players) {
            if (!player) continue;
            safeCall(player.updatePower, player, this.buildings);
            safeCall(player.updateTechTree, player, this.buildings);
            safeCall(player.updatePowerCooldowns, player, deltaTime);
        }

        // Airplanes are now regular units, updated in update() method

        // Update AI
        this.profiler.startProfile('ai');
        for (const ai of this.aiControllers) {
            if (!ai) continue;
            safeCall(ai.update, ai, deltaTime);
        }
        this.profiler.endProfile('ai');

        // Update fog of war
        const allEntities = [...this.units, ...this.buildings];
        for (const player of this.players) {
            if (!player || !this.map) continue;
            // Airplanes are now regular units, so they reveal fog automatically
            safeCall(this.map.updateFogOfWar, this.map, player, allEntities, null);
        }

        // Update formations
        this.updateFormations(deltaTime);

        // Update UI
        if (this.ui) {
            safeCall(this.ui.update, this.ui);
        }

        // Constrain camera
        this.constrainCamera();
    }

    constrainCamera() {
        const maxX = this.map.width * TILE_SIZE - this.canvas.width;
        const maxY = this.map.height * TILE_SIZE - this.canvas.height;

        this.camera.x = clamp(this.camera.x, 0, Math.max(0, maxX));
        this.camera.y = clamp(this.camera.y, 0, Math.max(0, maxY));
    }

    startBuildingPlacement(buildingType) {
        if (this.placingBuilding) {
            this.cancelBuildingPlacement();
        }

        const stats = BUILDING_TYPES[buildingType];

        // Check specific restrictions
        if (!this.humanPlayer.unlockedTiers.includes(stats.tier)) {
            showNotification('Cannot build: technology not unlocked');
            return;
        }

        if (!this.humanPlayer.canAfford(stats.cost)) {
            showNotification('Cannot build: insufficient credits');
            return;
        }

        if (stats.powerConsume > 0 && this.humanPlayer.hasLowPower()) {
            showNotification('Cannot build: insufficient power - build more Power Plants');
            return;
        }

        this.placingBuilding = buildingType;
        this.canvas.style.cursor = 'crosshair';
    }

    confirmBuildingPlacement() {
        if (!this.placingBuilding) return;
        if (!this.humanPlayer) {
            console.error('No human player available');
            return;
        }
        if (!this.map) {
            console.error('Map not initialized');
            return;
        }

        const mouseWorldX = this.input.mouseWorldX;
        const mouseWorldY = this.input.mouseWorldY;
        const mouseTile = worldToTile(mouseWorldX, mouseWorldY);

        const stats = BUILDING_TYPES[this.placingBuilding];
        if (!stats) {
            console.error('Invalid building type:', this.placingBuilding);
            this.cancelBuildingPlacement();
            return;
        }

        // Validate coordinates
        if (!validateMapCoordinates(this.map, mouseTile.x, mouseTile.y)) {
            showNotification('Cannot place building: invalid location');
            return;
        }

        if (!canPlaceBuilding(this.map, mouseTile.x, mouseTile.y, stats.width, stats.height, this.humanPlayer, this)) {
            showNotification('Cannot place building here or too far from base');
            return;
        }

        if (!this.humanPlayer.spend(stats.cost)) {
            showNotification('Insufficient funds');
            return;
        }

        try {
            const building = new Building(mouseTile.x, mouseTile.y, this.placingBuilding, stats, this.humanPlayer);
            
            // Track stats
            if (this.stats) {
                this.stats.buildingsBuilt++;
                this.stats.buildingsBuiltByType[this.placingBuilding] = (this.stats.buildingsBuiltByType[this.placingBuilding] || 0) + 1;
                this.stats.moneySpent += stats.cost;
            }
            this.buildings.push(building);
            this.map.setBuilding(mouseTile.x, mouseTile.y, stats.width, stats.height, building);

            showNotification(`${stats.name} construction started`);

            this.cancelBuildingPlacement();

            // Force UI update to refresh building menu
            if (this.ui) {
                this.ui.lastBuildingCount = -1; // Force rebuild menu update
            }
        } catch (error) {
            console.error('Error placing building:', error);
            showNotification('Error placing building');
            // Refund the cost
            this.humanPlayer.earnCredits(stats.cost);
        }
    }

    cancelBuildingPlacement() {
        this.placingBuilding = null;
        this.canvas.style.cursor = 'crosshair';
    }

    deployMCV(mcv) {
        if (!mcv || !mcv.stats.isBuilder) return;

        const tile = worldToTile(mcv.x, mcv.y);
        const stats = BUILDING_TYPES['HQ'];

        // Check if can place HQ (skip radius check for HQ deployment)
        if (!canPlaceBuilding(this.map, tile.x, tile.y, stats.width, stats.height, null, null)) {
            showNotification('Cannot deploy here - need clear space');
            return;
        }

        // Create HQ
        const hq = new Building(tile.x, tile.y, 'HQ', stats, mcv.owner);
        this.buildings.push(hq);
        this.map.setBuilding(tile.x, tile.y, stats.width, stats.height, hq);

        // Remove MCV
        this.map.clearUnit(tile.x, tile.y);
        const index = this.units.indexOf(mcv);
        if (index !== -1) {
            this.units.splice(index, 1);
        }

        // Select the newly created HQ
        hq.selected = true;
        this.selectedEntities = [hq];

        showNotification('HQ deployed successfully! Build menu now available.');
    }

    activateSpecialPower(powerType) {
        if (!this.humanPlayer) return; // Safety check
        
        if (!this.humanPlayer.canUsePower(powerType)) {
            const power = this.humanPlayer.specialPowers[powerType];
            if (!power || !power.available) {
                showNotification('Power not unlocked');
            } else if (power.cooldown > 0) {
                showNotification(`Cooldown: ${formatTime(power.cooldown)}`);
            } else {
                showNotification('Insufficient funds');
            }
            return;
        }

        this.activePower = powerType;
        this.canvas.style.cursor = 'crosshair';
        showNotification(`Select target location for ${SPECIAL_POWERS[powerType].name}`);
    }

    useSpecialPowerAt(worldX, worldY) {
        if (!this.activePower) return;

        const powerType = this.activePower;
        const config = SPECIAL_POWERS[powerType];

        if (!this.humanPlayer.usePower(powerType)) {
            return;
        }

        showNotification(`${config.name} activated!`);

        switch (powerType) {
            case 'recon':
                this.useReconSweep(worldX, worldY, config);
                break;

            case 'airstrike':
                this.useAirstrike(worldX, worldY, config);
                break;

            case 'airdrop':
                this.useAirDrop(worldX, worldY, config);
                break;

            case 'superweapon':
                this.useSuperweapon(worldX, worldY, config);
                break;
        }

        this.activePower = null;
        // Update cursor via input handler if available
        if (this.input && this.input.updateCursor) {
            this.input.updateCursor();
        } else {
            this.canvas.style.cursor = 'default';
        }
    }

    // Helper function to spawn airplane unit from random map edge
    spawnAirplaneUnitFromEdge(targetX, targetY, type = 'recon') {
        if (!this.map) return null;

        // Choose random edge (0=top, 1=right, 2=bottom, 3=left)
        const edge = Math.floor(Math.random() * 4);
        const mapWidth = this.map.width * TILE_SIZE;
        const mapHeight = this.map.height * TILE_SIZE;
        
        let startX, startY;
        switch (edge) {
            case 0: // Top
                startX = Math.random() * mapWidth;
                startY = -500;
                break;
            case 1: // Right
                startX = mapWidth + 500;
                startY = Math.random() * mapHeight;
                break;
            case 2: // Bottom
                startX = Math.random() * mapWidth;
                startY = mapHeight + 500;
                break;
            case 3: // Left
                startX = -500;
                startY = Math.random() * mapHeight;
                break;
        }

        // Create airplane unit
        const stats = UNIT_TYPES.AIRPLANE;
        const airplane = new Unit(startX, startY, 'AIRPLANE', stats, this.humanPlayer);
        
        // Set special power type and behavior
        airplane.specialPowerType = type; // 'recon', 'airstrike', 'airdrop'
        airplane.specialPowerTarget = { x: targetX, y: targetY };
        airplane.flyByState = 'approaching';
        airplane.targetX = targetX;
        airplane.targetY = targetY;
        
        // Set angle towards target
        const dx = targetX - startX;
        const dy = targetY - startY;
        airplane.angle = Math.atan2(dy, dx);
        
        // Adjust sight range for recon
        if (type === 'recon') {
            airplane.stats.sight = 15;
        }

        // Add to units array
        this.units.push(airplane);
        const startTile = worldToTile(startX, startY);
        this.map.setUnit(startTile.x, startTile.y, airplane);
        
        return airplane;
    }

    // Airplanes are now regular units, no separate update needed

    useReconSweep(worldX, worldY, config) {
        showNotification('Recon sweep inbound...');

        // Spawn airplane unit from random edge
        const airplane = this.spawnAirplaneUnitFromEdge(worldX, worldY, 'recon');
        if (!airplane) return;

        // Airplane will reveal fog as it flies and remove itself when done
        // The airplane unit handles its own lifecycle
    }

    useAirDrop(worldX, worldY, config) {
        // Get random infantry unit types
        const infantryTypes = Object.keys(UNIT_TYPES).filter(type => {
            const stats = UNIT_TYPES[type];
            return stats.category === 'infantry';
        });

        if (infantryTypes.length === 0) {
            showNotification('No infantry units available for air drop');
            return;
        }

        showNotification('Air drop inbound...');

        // Spawn airplane unit from random edge
        const airplane = this.spawnAirplaneUnitFromEdge(worldX, worldY, 'airdrop');
        if (!airplane) return;

        // Store drop data on airplane
        airplane.airdropUnits = config.units;
        airplane.airdropInfantryTypes = infantryTypes;
        airplane.airdropTargetX = worldX;
        airplane.airdropTargetY = worldY;
    }

    useAirstrike(worldX, worldY, config) {
        showNotification('Airstrike inbound...');

        // Spawn airplane unit from random edge
        const airplane = this.spawnAirplaneUnitFromEdge(worldX, worldY, 'airstrike');
        if (!airplane) return;

        // Store strike data on airplane
        airplane.strikeX = worldX;
        airplane.strikeY = worldY;
        airplane.strikeDamage = config.damage;
        airplane.strikeRadius = config.radius;
    }

    useSuperweapon(worldX, worldY, config) {
        const centerTile = worldToTile(worldX, worldY);
        const radius = config.radius;

        showNotification('Ion Cannon charging...');

        // Delay for charging animation
        setTimeout(() => {
            showNotification('Ion Cannon strike!');

            // Massive damage in radius
            for (const unit of this.units) {
                if (unit.owner === this.humanPlayer) continue;

                const dist = distance(worldX, worldY, unit.x, unit.y);
                if (dist <= radius * TILE_SIZE) {
                    const destroyed = unit.takeDamage(config.damage);
                    if (destroyed) {
                        const tile = worldToTile(unit.x, unit.y);
                        this.map.clearUnit(tile.x, tile.y);
                    }
                }
            }

            for (const building of this.buildings) {
                if (building.owner === this.humanPlayer) continue;

                const dist = distance(worldX, worldY, building.x, building.y);
                if (dist <= radius * TILE_SIZE) {
                    const destroyed = building.takeDamage(config.damage);
                    if (destroyed) {
                        this.map.clearBuilding(building.tileX, building.tileY, building.stats.width, building.stats.height);
                    }
                }
            }

            // Remove destroyed entities
            this.units = this.units.filter(u => u.isAlive());
            this.buildings = this.buildings.filter(b => b.isAlive());

            this.checkVictoryCondition();
        }, config.chargeTime);
    }

    checkVictoryCondition() {
        const playersAlive = this.players.filter(p => {
            return this.buildings.some(b => b.owner === p && b.stats.isHQ && b.isAlive());
        });

        if (playersAlive.length === 1) {
            const winner = playersAlive[0];
            this.isPaused = true; // Pause game on victory
            this.ui.showVictoryScreen(winner);
        } else if (playersAlive.length === 0) {
            this.isPaused = true; // Pause game on defeat
            this.ui.showVictoryScreen(null);
        }
    }

    deleteSelected() {
        // Only allow deleting own buildings
        for (const entity of this.selectedEntities) {
            if (entity.owner !== this.humanPlayer) continue;

            if (entity instanceof Building) {
                const index = this.buildings.indexOf(entity);
                if (index !== -1) {
                    this.buildings.splice(index, 1);
                    this.map.clearBuilding(entity.tileX, entity.tileY, entity.stats.width, entity.stats.height);
                }
            }
        }

        this.selectedEntities = [];
    }

    createFormationForSelected(formationType, targetX, targetY) {
        const selectedUnits = this.selectedEntities.filter(e => e instanceof Unit && !e.isHarvester);
        if (selectedUnits.length < 2) return null; // Need at least 2 units for formation

        const formation = createFormation(selectedUnits, formationType, targetX, targetY);
        if (!formation) return null;

        formation.id = this.nextFormationId++;
        this.activeFormations.set(formation.id, formation);

        // Assign formation positions to units
        for (let i = 0; i < formation.units.length; i++) {
            const unit = formation.units[i];
            const pos = formation.getPositionForUnit(i);
            unit.formationId = formation.id;
            unit.formationIndex = i;
            unit.moveTo(pos.x, pos.y, this);
        }

        return formation;
    }

    updateFormations(deltaTime) {
        // Throttle formation updates to reduce wandering
        const now = Date.now();
        if (!this.lastFormationUpdate) {
            this.lastFormationUpdate = now;
        }
        const FORMATION_UPDATE_INTERVAL = 2000; // Update every 2 seconds instead of every frame
        
        if (now - this.lastFormationUpdate < FORMATION_UPDATE_INTERVAL) {
            return;
        }
        this.lastFormationUpdate = now;

        // Clean up invalid formations
        for (const [id, formation] of this.activeFormations.entries()) {
            if (!formation.isValid()) {
                this.activeFormations.delete(id);
                continue;
            }

            // Only update formation positions for units that are idle or very far
            for (let i = 0; i < formation.units.length; i++) {
                const unit = formation.units[i];
                if (!unit || !unit.isAlive()) {
                    formation.removeUnit(unit);
                    continue;
                }

                // CRITICAL: If unit has an active path from a user command, don't override it
                // Check if unit has a recent movement command (within last 10 seconds)
                const hasActivePath = unit.path && unit.path.length > 0;
                const hasTargetEnemy = unit.targetEnemy !== null;
                const hasOriginalDestination = unit.originalDestination !== null;
                const recentUserCommand = unit.userCommandTime && (Date.now() - unit.userCommandTime) < 10000; // 10 seconds
                
                // If unit is actively moving, fighting, has a user-issued destination, or had a recent user command, don't reposition it
                if (hasActivePath || hasTargetEnemy || hasOriginalDestination || recentUserCommand) {
                    continue;
                }

                const targetPos = formation.getPositionForUnit(i);
                const dist = distance(unit.x, unit.y, targetPos.x, targetPos.y);

                // Only reposition if unit is truly idle AND very far from formation position
                // Use a larger threshold to prevent constant repositioning
                const isVeryFar = dist > FORMATION_CONFIG.MAINTAIN_DISTANCE * TILE_SIZE * 3; // Triple the threshold
                
                if (isVeryFar) {
                    // Only move if unit is truly idle (no path, no enemy target, no user command)
                    unit.moveTo(targetPos.x, targetPos.y, this);
                }
            }
        }
    }

    removeUnitFromFormation(unit) {
        if (unit.formationId) {
            const formation = this.activeFormations.get(unit.formationId);
            if (formation) {
                formation.removeUnit(unit);
                if (formation.units.length < 2) {
                    this.activeFormations.delete(unit.formationId);
                }
            }
            unit.formationId = null;
            unit.formationIndex = null;
        }
    }
}
