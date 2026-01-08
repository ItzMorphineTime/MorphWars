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

        this.gameTime = 0;
        this.lastFrameTime = 0;

        this.renderer = new Renderer(this, this.canvas, this.minimapCanvas);
        this.input = new InputHandler(this, this.canvas);
        this.ui = new UIController(this);
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
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        this.update(deltaTime);
        this.renderer.render();

        requestAnimationFrame((time) => this.gameLoop(time));
    }

    update(deltaTime) {
        this.gameTime += deltaTime;

        // Update map (resource regeneration)
        this.map.update(deltaTime);

        // Update units
        for (const unit of this.units) {
            unit.update(deltaTime, this);
        }

        // Update buildings
        for (const building of this.buildings) {
            building.update(deltaTime, this);
        }

        // Update players
        for (const player of this.players) {
            player.updatePower(this.buildings);
            player.updateTechTree(this.buildings);
            player.updatePowerCooldowns(deltaTime);
        }

        // Update AI
        for (const ai of this.aiControllers) {
            ai.update(deltaTime);
        }

        // Update fog of war
        const allEntities = [...this.units, ...this.buildings];
        for (const player of this.players) {
            this.map.updateFogOfWar(player, allEntities);
        }

        // Update UI
        this.ui.update();

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

        const mouseWorldX = this.input.mouseWorldX;
        const mouseWorldY = this.input.mouseWorldY;
        const mouseTile = worldToTile(mouseWorldX, mouseWorldY);

        const stats = BUILDING_TYPES[this.placingBuilding];

        if (!canPlaceBuilding(this.map, mouseTile.x, mouseTile.y, stats.width, stats.height, this.humanPlayer, this)) {
            showNotification('Cannot place building here or too far from base');
            return;
        }

        if (!this.humanPlayer.spend(stats.cost)) {
            showNotification('Insufficient funds');
            return;
        }

        const building = new Building(mouseTile.x, mouseTile.y, this.placingBuilding, stats, this.humanPlayer);
        this.buildings.push(building);
        this.map.setBuilding(mouseTile.x, mouseTile.y, stats.width, stats.height, building);

        showNotification(`${stats.name} construction started`);

        this.cancelBuildingPlacement();

        // Force UI update to refresh building menu
        if (this.ui) {
            this.ui.lastBuildingCount = -1; // Force rebuild menu update
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
        if (!this.humanPlayer.canUsePower(powerType)) {
            const power = this.humanPlayer.specialPowers[powerType];
            if (!power.available) {
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

            case 'superweapon':
                this.useSuperweapon(worldX, worldY, config);
                break;
        }

        this.activePower = null;
        this.canvas.style.cursor = 'crosshair';
    }

    useReconSweep(worldX, worldY, config) {
        const centerTile = worldToTile(worldX, worldY);
        const radius = config.revealRadius;

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy <= radius * radius) {
                    const tile = this.map.getTile(centerTile.x + dx, centerTile.y + dy);
                    if (tile) {
                        tile.fogOfWar[this.humanPlayer.id] = FOG_VISIBLE;
                    }
                }
            }
        }
    }

    useAirstrike(worldX, worldY, config) {
        const centerTile = worldToTile(worldX, worldY);
        const radius = config.radius;

        // Damage units and buildings in radius
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
                building.takeDamage(config.damage);
            }
        }

        // Remove destroyed units
        this.units = this.units.filter(u => u.isAlive());
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
            this.ui.showVictoryScreen(winner);
        } else if (playersAlive.length === 0) {
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
}
