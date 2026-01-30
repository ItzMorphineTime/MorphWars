// UI Controller

class UIController {
    constructor(game) {
        this.game = game;
        this.setupElements();

        // Track state to avoid unnecessary updates
        this.lastSelectedEntity = null;
        this.lastBuildingCount = 0;
        this.lastCredits = 0;
        this.lastPowerRatio = 1;
        this.currentMenuType = null; // 'deploy', 'buildings', 'production', 'empty'
        this.lastQueueState = null; // Track queue state to avoid redrawing
        this.lastSelectionInfo = null; // Track selection info to avoid redrawing
        this.queueEventDelegate = null; // Event delegation for queue buttons
    }

    setupElements() {
        this.creditsEl = document.getElementById('credits');
        this.powerUsedEl = document.getElementById('powerUsed');
        this.powerTotalEl = document.getElementById('powerTotal');
        this.powerFillEl = document.getElementById('powerFill');
        this.selectionInfoEl = document.getElementById('selectionInfo');
        
        // Set up event delegation for pause button and disembark button (prevents losing listeners on redraw)
        if (this.selectionInfoEl) {
            this.selectionInfoEl.addEventListener('click', (e) => {
                // Handle disembark button
                const disembarkBtn = e.target.closest('#disembarkBtn');
                if (disembarkBtn) {
                    e.stopPropagation();
                    const selected = this.game.selectedEntities[0];
                    if (selected && selected instanceof Unit && selected.isTransport && selected.embarkedUnits.length > 0) {
                        let disembarkedCount = 0;
                        const unitsToDisembark = [...selected.embarkedUnits];
                        for (const unit of unitsToDisembark) {
                            if (selected.disembarkUnit(unit, this.game)) {
                                disembarkedCount++;
                            }
                        }
                        if (disembarkedCount > 0) {
                            showNotification(`${disembarkedCount} unit(s) disembarked`);
                            this.updateSelection(); // Refresh UI
                        }
                    }
                    return;
                }
                
                // Handle pause button
                const pauseBtn = e.target.closest('#pauseProductionBtn');
                if (!pauseBtn) return;
                
                e.stopPropagation();
                const selectedBuilding = this.game.selectedEntities[0];
                if (!selectedBuilding || !(selectedBuilding instanceof Building) || !selectedBuilding.stats.produces) {
                    return;
                }
                
                const isPaused = selectedBuilding.toggleProduction();
                this.updateSelection(); // Force update to refresh button
                showNotification(isPaused ? 'Production paused' : 'Production resumed');
            });
        }
        
        this.buildMenuEl = document.getElementById('buildMenu');
        this.buildQueueEl = document.getElementById('buildQueue');
        
        // Set up event delegation for queue cancel buttons (prevents losing listeners on redraw)
        if (this.buildQueueEl) {
            this.buildQueueEl.addEventListener('click', (e) => {
                const cancelBtn = e.target.closest('.queue-cancel');
                if (!cancelBtn) return;
                
                e.stopPropagation();
                e.preventDefault();
                
                const index = parseInt(cancelBtn.dataset.index);
                const selectedBuilding = this.game.selectedEntities[0];
                if (!selectedBuilding || !(selectedBuilding instanceof Building)) {
                    return;
                }
                
                selectedBuilding.cancelProduction(index);
                this.updateProductionQueue(selectedBuilding, true); // Force update
                this.updateBuildMenu(this.game.humanPlayer, this.game.selectedEntities);
            });
        }
        
        this.saveGameBtn = document.getElementById('saveGameBtn');
        this.loadGameBtn = document.getElementById('loadGameBtn');
        this.newGameBtn = document.getElementById('newGameBtn');
        this.surrenderBtn = document.getElementById('surrenderBtn');
        this.saveListEl = document.getElementById('saveList');
        this.settingsBtn = document.getElementById('settingsBtn');

        this.powerButtons = {
            recon: document.getElementById('powerRecon'),
            airstrike: document.getElementById('powerAirstrike'),
            airdrop: document.getElementById('powerAirdrop'),
            superweapon: document.getElementById('powerSuperweapon'),
        };

        // Setup power button click handlers
        for (const [powerType, button] of Object.entries(this.powerButtons)) {
            button.addEventListener('click', () => {
                this.game.activateSpecialPower(powerType);
            });
        }

        // Use event delegation for build menu buttons
        this.buildMenuEl.addEventListener('click', (e) => {
            const button = e.target.closest('.build-button');
            if (!button || button.disabled) return;

            if (button.dataset.deploy) {
                // Deploy MCV
                const selected = this.game.selectedEntities[0];
                if (selected && selected.stats.isBuilder) {
                    this.game.deployMCV(selected);
                }
            } else if (button.dataset.building) {
                // Place building - check if game is ready
                if (!this.game.humanPlayer) {
                    // Game not fully initialized yet
                    return;
                }
                this.game.startBuildingPlacement(button.dataset.building);
            } else if (button.dataset.unit) {
                // Train unit - add to queue (credits charged when unit finishes)
                const selected = this.game.selectedEntities[0];
                if (selected instanceof Building) {
                    const stats = UNIT_TYPES[button.dataset.unit];
                    // Only check if can afford, don't charge yet
                    if (this.game.humanPlayer.canAfford(stats.cost)) {
                        selected.addToQueue(button.dataset.unit, stats);
                        // Update queue display immediately
                        this.updateProductionQueue(selected, true);
                        // Also update selection info if this building is selected
                        if (this.game.selectedEntities[0] === selected) {
                            this.updateSelection();
                        }
                    }
                }
            }
        });

        // Settings button (new modal approach)
        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', () => {
                this.showSettingsModal();
            });
        }

        // Legacy Save/Load buttons (if they still exist in HTML)
        if (this.saveGameBtn) {
            this.saveGameBtn.addEventListener('click', () => {
                const saveName = prompt('Enter save name:', `Save ${new Date().toLocaleString()}`);
                if (saveName) {
                    this.game.saveLoadManager.saveGame(saveName);
                    this.updateSaveList();
                }
            });
        }

        if (this.loadGameBtn) {
            this.loadGameBtn.addEventListener('click', () => {
                this.showLoadMenu();
            });
        }

        if (this.newGameBtn) {
            this.newGameBtn.addEventListener('click', () => {
                if (confirm('Start a new game? Current progress will be lost.')) {
                    if (this.game.newGame) {
                        this.game.newGame();
                    } else {
                        location.reload();
                    }
                }
            });
        }

        if (this.surrenderBtn) {
            this.surrenderBtn.addEventListener('click', () => {
                if (confirm('Surrender? This will end the current game.')) {
                    if (this.game.surrender) {
                        this.game.surrender();
                    } else {
                        this.game.humanPlayer.defeated = true;
                        // Destroy all player buildings to trigger defeat
                        for (const building of this.game.buildings) {
                            if (building.owner === this.game.humanPlayer) {
                                building.hp = 0;
                            }
                        }
                        this.game.checkVictoryCondition();
                    }
                }
            });
        }

        // Update save list periodically
        setInterval(() => this.updateSaveList(), 5000);
    }

    update() {
        const player = this.game.humanPlayer;
        if (!player) return;

        this.updateResources(player);
        this.updateSelection();
        this.updateBuildMenu();
        this.updatePowerButtons(player);
        this.updateSaveList();
    }

    updateResources(player) {
        this.creditsEl.textContent = Math.floor(player.credits);
        this.powerUsedEl.textContent = player.powerConsumed;
        this.powerTotalEl.textContent = player.powerGenerated;

        // Calculate power percentage: consumed / generated * 100
        // Maximum power is powerGenerated, so we show what percentage is being used
        const maxPower = player.powerGenerated;
        let powerPercentage = 0;
        
        if (maxPower > 0) {
            powerPercentage = (player.powerConsumed / maxPower) * 100;
        } else if (player.powerConsumed > 0) {
            // If we have consumption but no generation, show 100% (overloaded)
            powerPercentage = 100;
        }
        
        // Cap visual width at 100% but show percentage
        this.powerFillEl.style.width = `${Math.min(powerPercentage, 100)}%`;

        // Red if over 100% (consumption exceeds generation), green-to-yellow otherwise
        if (powerPercentage > 100) {
            this.powerFillEl.classList.add('power-low');
            // Red gradient is applied via CSS .power-low class
        } else {
            this.powerFillEl.classList.remove('power-low');
            // Remove any inline background to use CSS default (green to yellow gradient)
            this.powerFillEl.style.background = '';
        }
        
        // Track power ratio for notifications (ratio = generated / consumed)
        const powerRatio = player.getPowerRatio();
        const lastRatio = this.lastPowerRatio;
        this.lastPowerRatio = powerRatio;
        
        // Show power warning notifications
        if (notificationManager) {
            // Always notify if power is out (ratio < 1)
            if (powerRatio < 1) {
                // Check if we should notify (either first time or significant change)
                const shouldNotify = lastRatio === undefined || 
                    (lastRatio >= 1 && powerRatio < 1) || // Just ran out of power
                    (powerRatio < 0.5 && (lastRatio === undefined || lastRatio >= 0.5)) || // Just dropped to critical
                    (powerRatio < 0.75 && (lastRatio === undefined || lastRatio >= 0.75)); // Just dropped below 75%
                
                if (shouldNotify) {
                    notificationManager.showPowerWarning(powerRatio);
                }
            }
        }
    }

    updateSelection() {
        const selected = this.game.selectedEntities;

        if (selected.length === 0) {
            if (this.lastSelectionInfo !== 'empty') {
                this.selectionInfoEl.innerHTML = '<div class="sidebar-header">Selection</div><div class="unit-info">No units selected</div>';
                this.lastSelectionInfo = 'empty';
            }
            return;
        }

        // Create selection state signature
        const entity = selected.length === 1 ? selected[0] : null;
        const selectionState = entity ? JSON.stringify({
            type: entity.type,
            id: entity.id || entity.x + entity.y, // Use position as ID if no ID
            hp: Math.floor(entity.hp),
            maxHp: entity.maxHp,
            paused: entity instanceof Building ? entity.productionPaused : null,
            queue: entity instanceof Building ? entity.productionQueue.length : null,
            current: entity instanceof Building && entity.currentProduction ? entity.currentProduction.type : null,
        }) : `multiple_${selected.length}`;

        // Only redraw if selection changed
        if (this.lastSelectionInfo === selectionState) {
            // Just update HP and ammo display if single entity
            if (entity && selected.length === 1) {
                this.updateSelectionHP(entity);
                // Update ammo if unit has ammo
                if (entity instanceof Unit && entity.maxAmmo > 0) {
                    this.updateSelectionAmmo(entity);
                }
                // Also update building queue info if it's a building
                if (entity instanceof Building) {
                    this.updateSelectionBuildingInfo(entity, false); // Pass false to prevent recursion
                }
            }
            return;
        }

        this.lastSelectionInfo = selectionState;

        let html = '<div class="sidebar-header">Selection</div>';

        if (selected.length === 1) {
            html += `<div class="unit-info">`;
            html += `<strong>${entity.stats.name || entity.type}</strong><br>`;
            html += `<span class="selection-hp">HP: ${Math.floor(entity.hp)}/${entity.maxHp}</span><br>`;

            if (entity.veterancy > 0) {
                html += `Rank: ${'★'.repeat(entity.veterancy)}<br>`;
            }

            if (entity instanceof Unit) {
                if (entity.isHarvester) {
                    html += `Cargo: ${Math.floor(entity.cargo)}/${entity.stats.maxCargo}<br>`;
                }
                if (entity.isTransport) {
                    const embarkedCount = entity.getEmbarkedCount();
                    const capacity = entity.getTransportCapacity();
                    html += `<span style="color: #0f0;">Transport: ${embarkedCount}/${capacity}</span><br>`;
                    if (embarkedCount > 0) {
                        html += `<button class="build-button" id="disembarkBtn" style="grid-column: 1 / -1; margin-top: 5px; border-color: #0f0;">`;
                        html += `🚢 DISEMBARK ALL (${embarkedCount})`;
                        html += `</button>`;
                    }
                }
                if (entity.maxAmmo > 0) {
                    html += `<span class="selection-ammo">Ammo: ${entity.ammo}/${entity.maxAmmo}</span><br>`;
                    if (entity.needsReload) {
                        html += `<span style="color: #ff0;">RELOADING</span><br>`;
                    }
                }
            }

            if (entity instanceof Building) {
                if (entity.stats.produces) {
                    // Add pause/unpause button for production buildings
                    const paused = entity.productionPaused || false;
                    html += `<br>`;
                    html += `<button class="build-button" id="pauseProductionBtn" style="grid-column: 1 / -1; margin-top: 5px; ${paused ? 'background: #0f0;' : 'background: #f00;'}">`;
                    html += paused ? '▶ RESUME PRODUCTION' : '⏸ PAUSE PRODUCTION';
                    html += `</button>`;
                }
                if (entity.currentProduction) {
                    const progress = (entity.getProductionProgress() * 100).toFixed(0);
                    html += `<br>Building: ${entity.currentProduction.stats.name}<br>`;
                    html += `<span class="building-progress">Progress: ${progress}%</span><br>`;
                }
                if (entity.productionQueue.length > 0) {
                    html += `<span class="building-queue">Queue: ${entity.productionQueue.length}</span><br>`;
                }
            }

            html += `</div>`;
            html += `<div class="health-bar"><div class="health-fill" style="width: ${entity.getHealthPercent() * 100}%"></div></div>`;
            
            this.selectionInfoEl.innerHTML = html;
            
            // Use event delegation for pause button and disembark button (prevents losing listener on redraw)
            if (entity instanceof Building && entity.stats.produces) {
                // Store building reference in data attribute for event delegation
                this.selectionInfoEl.setAttribute('data-building-id', entity.id || `${entity.x}-${entity.y}`);
            }
            if (entity instanceof Unit && entity.isTransport) {
                // Store transport reference for disembark button
                this.selectionInfoEl.setAttribute('data-transport-id', entity.id || `${entity.x}-${entity.y}`);
            }
        } else {
            html += `<div class="unit-info">`;
            html += `<strong>${selected.length} units selected</strong><br>`;
            html += `<span style="opacity: 0.8; font-size: 12px;">Click a unit twice to select all of that type</span><br><br>`;

            const types = {};
            for (const entity of selected) {
                const name = entity.stats.name || entity.type;
                types[name] = (types[name] || 0) + 1;
            }

            for (const [name, count] of Object.entries(types)) {
                html += `${count}x ${name}<br>`;
            }

            html += `</div>`;
        }

        this.selectionInfoEl.innerHTML = html;
    }

    updateSelectionHP(entity) {
        // Only update HP display without redrawing entire selection
        const hpEl = this.selectionInfoEl.querySelector('.selection-hp');
        if (hpEl) {
            hpEl.textContent = `HP: ${Math.floor(entity.hp)}/${entity.maxHp}`;
        }
        const healthFill = this.selectionInfoEl.querySelector('.health-fill');
        if (healthFill) {
            healthFill.style.width = `${entity.getHealthPercent() * 100}%`;
        }
    }

    updateSelectionAmmo(entity) {
        // Update ammo display without redrawing entire selection
        const ammoEl = this.selectionInfoEl.querySelector('.selection-ammo');
        if (ammoEl) {
            ammoEl.textContent = `Ammo: ${entity.ammo}/${entity.maxAmmo}`;
        }
    }

    updateSelectionBuildingInfo(building, allowRedraw = true) {
        // Update building production info without full redraw
        if (building.currentProduction) {
            const progressEl = this.selectionInfoEl.querySelector('.building-progress');
            if (progressEl) {
                const progress = (building.getProductionProgress() * 100).toFixed(0);
                progressEl.textContent = `Progress: ${progress}%`;
            }
        }
        const queueEl = this.selectionInfoEl.querySelector('.building-queue');
        if (queueEl) {
            queueEl.textContent = `Queue: ${building.productionQueue.length}`;
        } else if (allowRedraw && (building.productionQueue.length > 0 || building.currentProduction)) {
            // Queue/progress elements don't exist, need to redraw - but prevent infinite loop
            // Force update by clearing lastSelectionInfo so it redraws, but don't call updateSelectionBuildingInfo again
            this.lastSelectionInfo = null;
            // Update selection state signature to include queue info
            const entity = this.game.selectedEntities[0];
            if (entity) {
                const selectionState = JSON.stringify({
                    type: entity.type,
                    id: entity.id || entity.x + entity.y,
                    hp: Math.floor(entity.hp),
                    maxHp: entity.maxHp,
                    paused: entity.productionPaused || null,
                    queue: building.productionQueue.length,
                    current: building.currentProduction ? building.currentProduction.type : null,
                });
                this.lastSelectionInfo = selectionState;
            }
            this.updateSelection();
        }
    }

    updateBuildMenu() {
        const selected = this.game.selectedEntities;
        const player = this.game.humanPlayer;
        const hasHQ = this.game.buildings.some(b => b.owner === player && b.stats.isHQ && b.isAlive());
        const buildingCount = this.game.buildings.filter(b => b.owner === player).length;

        // Check if we need to update
        const currentEntity = selected.length === 1 ? selected[0] : null;
        const selectionChanged = currentEntity !== this.lastSelectedEntity;
        const buildingsChanged = buildingCount !== this.lastBuildingCount;
        const creditsChanged = Math.floor(player.credits) !== this.lastCredits;
        const powerRatio = player.getPowerRatio();
        const powerChanged = Math.abs(powerRatio - this.lastPowerRatio) > 0.01;

        // Update button states even if menu doesn't rebuild
        if (!selectionChanged && !buildingsChanged && !creditsChanged && !powerChanged) {
            // Only update production queue progress if showing production menu (don't redraw HTML)
            if (currentEntity instanceof Building && currentEntity.stats.produces) {
                this.updateProductionQueueProgress(currentEntity);
            }
            // Update button disabled states without rebuilding menu
            this.updateBuildButtonStates(player);
            return;
        }

        this.lastSelectedEntity = currentEntity;
        this.lastBuildingCount = buildingCount;
        this.lastCredits = Math.floor(player.credits);
        this.lastPowerRatio = powerRatio;

        // Priority 1: If production building selected, show its production menu
        if (selected.length === 1 && currentEntity instanceof Building && currentEntity.stats.produces) {
            this.showProductionMenu(currentEntity);
            return;
        }

        // Priority 2: If MCV selected without HQ, show deploy button
        if (selected.length === 1 && currentEntity instanceof Unit && currentEntity.stats.isBuilder && !hasHQ) {
            this.showDeployMenu();
            return;
        }

        // Priority 3: If HQ exists, always show base building menu
        if (hasHQ) {
            this.showBuildingMenu();
            return;
        }

        // Priority 4: If MCV selected with HQ, show building menu
        if (selected.length === 1 && currentEntity instanceof Unit && currentEntity.stats.isBuilder && hasHQ) {
            this.showBuildingMenu();
            return;
        }

        // Default: Show empty state
        this.showEmptyMenu();
    }

    showDeployMenu() {
        if (this.currentMenuType === 'deploy') return;
        this.currentMenuType = 'deploy';

        let html = '';
        html += `<button class="build-button" data-deploy="true" style="grid-column: 1 / -1;">`;
        html += `DEPLOY TO HQ<br>`;
        html += `<span class="build-cost">Creates base</span>`;
        html += `</button>`;

        this.buildMenuEl.innerHTML = html;
        this.buildQueueEl.innerHTML = '';
    }

    showBuildingMenu() {
        if (this.currentMenuType === 'buildings') return;
        this.currentMenuType = 'buildings';

        const player = this.game.humanPlayer;
        let html = '';

        // Show building menu
        for (const [buildingType, stats] of Object.entries(BUILDING_TYPES)) {
            if (buildingType === 'HQ') continue;

            const canBuild = player.canBuild(buildingType, false);
            const disabled = !canBuild ? 'disabled' : '';

            html += `<button class="build-button" data-building="${buildingType}" ${disabled}>`;
            html += `${stats.name}<br>`;
            html += `<span class="build-cost">$${stats.cost}</span>`;
            html += `</button>`;
        }

        this.buildMenuEl.innerHTML = html;
        this.buildQueueEl.innerHTML = '';
    }

    showEmptyMenu() {
        if (this.currentMenuType === 'empty') return;
        this.currentMenuType = 'empty';

        this.buildMenuEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #0f0; opacity: 0.5;">Deploy MCV to begin</div>';
        this.buildQueueEl.innerHTML = '';
    }

    showProductionMenu(building) {
        // Always update production menu since it changes frequently with queue
        this.currentMenuType = 'production';

        const player = this.game.humanPlayer;
        let html = '';

        for (const [unitType, stats] of Object.entries(UNIT_TYPES)) {
            if (!building.canProduce(unitType)) continue;

            // Check airplane limit (1 per airfield)
            let canBuild = player.canBuild(unitType, true);
            if (unitType === 'AIRPLANE' && building.type === 'AIRFIELD') {
                const existingAirplane = this.game.units.find(u => 
                    u.isAirplane && u.homeAirfield === building && u.isAlive()
                );
                if (existingAirplane) {
                    canBuild = false;
                }
            }

            const disabled = !canBuild ? 'disabled' : '';

            html += `<button class="build-button" data-unit="${unitType}" ${disabled}>`;
            html += `${stats.name}<br>`;
            html += `<span class="build-cost">$${stats.cost}</span>`;
            html += `</button>`;
        }

        this.buildMenuEl.innerHTML = html;

        // Show production queue
        this.updateProductionQueue(building);
    }

    updateProductionQueue(building, forceUpdate = false) {
        // Create queue state signature to detect changes
        const queueState = JSON.stringify({
            current: building.currentProduction ? building.currentProduction.type : null,
            queue: building.productionQueue.map(item => item.type),
            paused: building.productionPaused || false,
        });

        // Only redraw if queue state changed or forced
        if (!forceUpdate && this.lastQueueState === queueState) {
            // Just update progress bar if building is producing
            if (building.currentProduction) {
                this.updateProductionQueueProgress(building);
            }
            return;
        }

        this.lastQueueState = queueState;

        let html = '';

        if (building.currentProduction) {
            const progress = (building.getProductionProgress() * 100).toFixed(0);
            html += `<div class="queue-item">`;
            html += `<span>${building.currentProduction.stats.name}</span>`;
            html += `<button class="queue-cancel" data-index="-1" title="Cancel">×</button>`;
            html += `<div class="queue-progress" style="width: ${progress}%"></div>`;
            html += `</div>`;
        }

        for (let i = 0; i < building.productionQueue.length; i++) {
            const item = building.productionQueue[i];
            html += `<div class="queue-item">`;
            html += `<span>${item.stats.name}</span>`;
            html += `<button class="queue-cancel" data-index="${i}" title="Cancel">×</button>`;
            html += `</div>`;
        }

        // Show pause indicator if paused
        if (building.productionPaused && (building.currentProduction || building.productionQueue.length > 0)) {
            html += `<div style="padding: 5px; text-align: center; color: #ff0; font-size: 11px;">⏸ PAUSED</div>`;
        }

        this.buildQueueEl.innerHTML = html;
    }

    updateProductionQueueProgress(building) {
        // Only update progress bar without redrawing entire queue
        if (!building.currentProduction) return;
        
        const progressBar = this.buildQueueEl.querySelector('.queue-progress');
        if (progressBar) {
            const progress = (building.getProductionProgress() * 100).toFixed(0);
            progressBar.style.width = `${progress}%`;
        }
    }

    updatePowerButtons(player) {
        for (const [powerType, button] of Object.entries(this.powerButtons)) {
            const power = player.specialPowers[powerType];
            const config = SPECIAL_POWERS[powerType];

            button.disabled = !player.canUsePower(powerType);

            // Update cooldown display
            if (power.cooldown > 0) {
                const cooldownBar = button.querySelector('.power-cooldown');
                const percent = (power.cooldown / config.cooldown) * 100;
                cooldownBar.style.width = `${percent}%`;
            } else {
                const cooldownBar = button.querySelector('.power-cooldown');
                cooldownBar.style.width = '0%';
            }
        }
    }

    updateBuildButtonStates(player) {
        // Update disabled state of all build buttons based on current resources
        const buttons = this.buildMenuEl.querySelectorAll('.build-button');

        for (const button of buttons) {
            if (button.dataset.building) {
                const canBuild = player.canBuild(button.dataset.building, false);
                button.disabled = !canBuild;
            } else if (button.dataset.unit) {
                const canBuild = player.canBuild(button.dataset.unit, true);
                button.disabled = !canBuild;
            }
        }
    }

    showVictoryScreen(winner) {
        const gameMenu = document.getElementById('gameMenu');
        const message = winner === this.game.humanPlayer ? 'VICTORY!' : 'DEFEAT';
        
        const perfStats = this.game.profiler.getStats();
        const gameStats = this.game.stats || {};

        let statsHtml = '<div style="margin: 15px 0; font-size: 12px; color: #0f0; border: 1px solid #0f0; padding: 10px;">';
        statsHtml += '<div style="font-weight: bold; margin-bottom: 10px; color: #0f0;">GAME STATISTICS</div>';
        
        // Units
        statsHtml += `<div style="margin-bottom: 5px;"><strong>Units Built:</strong> ${gameStats.unitsBuilt || 0}</div>`;
        if (gameStats.unitsBuiltByType && Object.keys(gameStats.unitsBuiltByType).length > 0) {
            statsHtml += '<div style="margin-left: 10px; font-size: 11px; opacity: 0.8;">';
            for (const [type, count] of Object.entries(gameStats.unitsBuiltByType)) {
                const unitName = UNIT_TYPES[type]?.name || type;
                statsHtml += `${unitName}: ${count}<br>`;
            }
            statsHtml += '</div>';
        }
        
        // Kills
        statsHtml += `<div style="margin-top: 10px; margin-bottom: 5px;"><strong>Enemies Killed:</strong> ${gameStats.enemiesKilled || 0}</div>`;
        if (gameStats.enemiesKilledByType && Object.keys(gameStats.enemiesKilledByType).length > 0) {
            statsHtml += '<div style="margin-left: 10px; font-size: 11px; opacity: 0.8;">';
            for (const [type, count] of Object.entries(gameStats.enemiesKilledByType)) {
                const unitName = UNIT_TYPES[type]?.name || type;
                statsHtml += `${unitName}: ${count}<br>`;
            }
            statsHtml += '</div>';
        }
        statsHtml += `<div style="margin-top: 10px; margin-bottom: 5px;"><strong>Player Units Lost:</strong> ${gameStats.playerUnitsLost || 0}</div>`;
        if (gameStats.playerUnitsLostByType && Object.keys(gameStats.playerUnitsLostByType).length > 0) {
            statsHtml += '<div style="margin-left: 10px; font-size: 11px; opacity: 0.8;">';
            for (const [type, count] of Object.entries(gameStats.playerUnitsLostByType)) {
                const unitName = UNIT_TYPES[type]?.name || type;
                statsHtml += `${unitName}: ${count}<br>`;
            }
            statsHtml += '</div>';
        }
        statsHtml += `<div style="margin-bottom: 5px;"><strong>Total Units Killed:</strong> ${gameStats.unitsKilled || 0}</div>`;
        
        // Buildings
        statsHtml += `<div style="margin-top: 10px; margin-bottom: 5px;"><strong>Buildings Built:</strong> ${gameStats.buildingsBuilt || 0}</div>`;
        if (gameStats.buildingsBuiltByType && Object.keys(gameStats.buildingsBuiltByType).length > 0) {
            statsHtml += '<div style="margin-left: 10px; font-size: 11px; opacity: 0.8;">';
            for (const [type, count] of Object.entries(gameStats.buildingsBuiltByType)) {
                const buildingName = BUILDING_TYPES[type]?.name || type;
                statsHtml += `${buildingName}: ${count}<br>`;
            }
            statsHtml += '</div>';
        }
        statsHtml += `<div style="margin-bottom: 5px;"><strong>Buildings Destroyed:</strong> ${gameStats.buildingsDestroyed || 0}</div>`;
        
        // Money
        statsHtml += `<div style="margin-top: 10px; margin-bottom: 5px;"><strong>Money Earned:</strong> $${Math.floor(gameStats.moneyEarned || 0)}</div>`;
        statsHtml += `<div style="margin-bottom: 5px;"><strong>Money Spent:</strong> $${Math.floor(gameStats.moneySpent || 0)}</div>`;
        statsHtml += `<div style="margin-bottom: 5px;"><strong>Net Profit:</strong> $${Math.floor((gameStats.moneyEarned || 0) - (gameStats.moneySpent || 0))}</div>`;
        
        statsHtml += '</div>';
        
        // Performance stats
        statsHtml += '<div style="margin: 15px 0; font-size: 12px; color: #0f0;">';
        statsHtml += '<div style="font-weight: bold; margin-bottom: 5px;">PERFORMANCE</div>';
        statsHtml += `<div>Average FPS: ${perfStats.fps}</div>`;
        statsHtml += `<div>Avg Frame Time: ${perfStats.avgFrameTime}ms</div>`;
        statsHtml += '</div>';

        gameMenu.innerHTML = `
            <div class="menu-title">${message}</div>
            <div style="text-align: center; margin: 20px 0;">
                ${winner === this.game.humanPlayer ?
                    'You have destroyed all enemy forces!' :
                    'Your base has been destroyed!'}
            </div>
            ${statsHtml}
            <button class="menu-button" onclick="location.reload()">PLAY AGAIN</button>
        `;

        gameMenu.classList.remove('hidden');
    }

    renderPerformanceStats() {
        if (!this.game.profiler.enabled) return;
        
        const stats = this.game.profiler.getStats();
        const ctx = this.game.renderer.ctx;
        
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 200, 120);
        
        ctx.fillStyle = '#0f0';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        
        let y = 25;
        ctx.fillText(`FPS: ${stats.fps}`, 15, y);
        y += 15;
        ctx.fillText(`Frame: ${stats.avgFrameTime}ms`, 15, y);
        y += 15;
        ctx.fillText(`Update: ${stats.profiles.update.avg}ms`, 15, y);
        y += 15;
        ctx.fillText(`Render: ${stats.profiles.render.avg}ms`, 15, y);
        y += 15;
        ctx.fillText(`AI: ${stats.profiles.ai.avg}ms`, 15, y);
        y += 15;
        ctx.fillText(`Pathfind: ${stats.profiles.pathfinding.avg}ms`, 15, y);
        
        ctx.restore();
    }

    updateSaveList() {
        if (!this.saveListEl) return;
        
        const saves = this.game.saveLoadManager.getSaveList();
        let html = '';
        
        if (saves.length === 0) {
            html = '<div style="padding: 10px; text-align: center; color: #0f0; opacity: 0.5; font-size: 11px;">No saves</div>';
        } else {
            for (let i = 0; i < saves.length; i++) {
                const save = saves[i];
                const date = new Date(save.timestamp).toLocaleString();
                const saveNameEscaped = save.name.replace(/'/g, "&#39;").replace(/"/g, "&quot;");
                html += `<div class="save-item" data-save-index="${i}" style="padding: 5px; margin: 3px 0; background: #333; border: 1px solid #0f0; cursor: pointer; font-size: 10px;">
                    <div style="font-weight: bold;">${saveNameEscaped}</div>
                    <div style="opacity: 0.7; font-size: 9px;">${date}</div>
                    <button class="delete-save-btn" data-save-index="${i}" style="margin-top: 3px; padding: 2px 5px; background: #f00; border: 1px solid #a00; color: #fff; cursor: pointer; font-size: 8px;">Delete</button>
                </div>`;
            }
        }
        
        this.saveListEl.innerHTML = html;
        
        // Add event listeners
        const saveItems = this.saveListEl.querySelectorAll('.save-item');
        saveItems.forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-save-btn')) return;
                const index = parseInt(item.dataset.saveIndex);
                const save = saves[index];
                if (save) {
                    this.game.saveLoadManager.loadGame(save.name);
                }
            });
        });
        
        const deleteBtns = this.saveListEl.querySelectorAll('.delete-save-btn');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.saveIndex);
                const save = saves[index];
                if (save) {
                    this.game.saveLoadManager.deleteSave(save.name);
                    this.updateSaveList();
                }
            });
        });
    }

    showLoadMenu() {
        const saves = this.game.saveLoadManager.getSaveList();
        if (saves.length === 0) {
            showNotification('No save files found');
            return;
        }
        
        // Show modal with save list
        const modal = document.createElement('div');
        modal.id = 'loadGameModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 2000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: #222;
            border: 3px solid #0f0;
            padding: 20px;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            width: 90%;
        `;
        
        let html = '<div class="sidebar-header" style="margin-bottom: 15px;">LOAD GAME</div>';
        html += '<div style="max-height: 400px; overflow-y: auto;">';
        
        for (const save of saves) {
            const date = new Date(save.timestamp).toLocaleString();
            const saveNameEscaped = save.name.replace(/'/g, "&#39;").replace(/"/g, "&quot;");
            html += `<div style="padding: 10px; margin: 5px 0; background: #333; border: 1px solid #0f0; position: relative;">
                <div style="cursor: pointer; padding-right: 60px;" 
                    onmouseover="this.parentElement.style.background='#444'" 
                    onmouseout="this.parentElement.style.background='#333'"
                    onclick="game.saveLoadManager.loadGame('${save.name.replace(/'/g, "\\'")}'); const modal = document.getElementById('loadGameModal'); if(modal) { modal.remove(); } game.isPaused = false;">
                    <div style="font-weight: bold; color: #0f0;">${saveNameEscaped}</div>
                    <div style="opacity: 0.7; font-size: 12px; margin-top: 5px;">${date}</div>
                </div>
                <button style="position: absolute; top: 10px; right: 10px; padding: 5px 10px; background: #f00; border: 1px solid #a00; color: #fff; cursor: pointer; font-size: 10px;"
                    onclick="if(confirm('Delete save: ${saveNameEscaped.replace(/'/g, "\\'")}?')) { game.saveLoadManager.deleteSave('${save.name.replace(/'/g, "\\'")}'); const modal = document.getElementById('loadGameModal'); if(modal) { modal.remove(); } game.ui.showLoadMenu(); }">DELETE</button>
            </div>`;
        }
        
        html += '</div>';
        html += '<button class="menu-button" style="margin-top: 15px; width: 100%;" onclick="const modal = document.getElementById(\'loadGameModal\'); if(modal) { modal.remove(); } game.isPaused = false;">CANCEL</button>';
        
        content.innerHTML = html;
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                this.game.isPaused = false;
            }
        });
    }

    showSettingsModal() {
        // Check if modal already exists
        const existingModal = document.getElementById('settingsModal');
        if (existingModal) {
            return; // Don't create duplicate
        }

        // Pause game
        this.game.isPaused = true;

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'settingsModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 2000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: #222;
            border: 3px solid #0f0;
            padding: 20px;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            width: 90%;
        `;
        
        let html = '<div class="sidebar-header" style="margin-bottom: 15px; font-size: 18px;">⚙️ GAME SETTINGS</div>';
        html += '<div style="display: flex; flex-direction: column; gap: 10px;">';
        
        // Sprite toggle
        html += '<div style="padding: 10px; background: #1a1a1a; border: 1px solid #0f0; display: flex; align-items: center; justify-content: space-between;">';
        html += '<label style="color: #0f0; cursor: pointer; display: flex; align-items: center; gap: 10px;">';
        html += `<input type="checkbox" id="settingsUseSprites" ${this.game.settings.useSprites ? 'checked' : ''} style="width: auto; cursor: pointer;" onchange="game.setUseSprites(this.checked);">`;
        html += '<span>Use Sprites</span>';
        html += '</label>';
        html += '</div>';
        
        // Save Game button
        html += '<button class="menu-button" onclick="const name = prompt(\'Enter save name:\', \'Save \' + new Date().toLocaleString()); if(name) { game.saveLoadManager.saveGame(name); showNotification(\'Game saved!\'); const settingsModal = document.getElementById(\'settingsModal\'); if(settingsModal) { settingsModal.remove(); } game.isPaused = false; }">💾 SAVE GAME</button>';
        
        // Load Game button
        html += '<button class="menu-button" onclick="const settingsModal = document.getElementById(\'settingsModal\'); if(settingsModal) { settingsModal.remove(); } game.ui.showLoadMenu();">📂 LOAD GAME</button>';
        
        // Controls button
        html += '<button class="menu-button" onclick="const settingsModal = document.getElementById(\'settingsModal\'); if(settingsModal) { settingsModal.remove(); } game.ui.showControlsModal();">🎮 CONTROLS</button>';
        
        // New Game button
        html += '<button class="menu-button" style="background: #333; border-color: #0f0;" onclick="if(confirm(\'Start a new game? Current progress will be lost.\')) { const settingsModal = document.getElementById(\'settingsModal\'); if(settingsModal) { settingsModal.remove(); } game.isPaused = false; if(game.newGame) { game.newGame(); } else { location.reload(); } }">🆕 NEW GAME</button>';
        
        // Surrender button
        html += '<button class="menu-button" style="background: #333; border-color: #f00; color: #f00;" onclick="if(confirm(\'Surrender? This will end the current game.\')) { const settingsModal = document.getElementById(\'settingsModal\'); if(settingsModal) { settingsModal.remove(); } game.isPaused = false; if(game.surrender) { game.surrender(); } else { game.humanPlayer.defeated = true; for(const b of game.buildings) { if(b.owner === game.humanPlayer) b.hp = 0; } game.checkVictoryCondition(); } }">🏳️ SURRENDER</button>';
        
        html += '</div>';
        html += '<button class="menu-button" style="margin-top: 15px; width: 100%;" onclick="const modal = document.getElementById(\'settingsModal\'); if(modal) { modal.remove(); } game.isPaused = false;">CLOSE</button>';
        
        content.innerHTML = html;
        modal.appendChild(content);
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                this.game.isPaused = false;
            }
        });
        
        document.body.appendChild(modal);
    }

    showControlsModal() {
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'controlsModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 2000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: #222;
            border: 3px solid #0f0;
            padding: 20px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            width: 90%;
        `;
        
        let html = '<div class="sidebar-header" style="margin-bottom: 15px; font-size: 18px;">🎮 GAME CONTROLS</div>';
        html += '<div style="font-size: 12px; line-height: 1.6;">';
        
        html += '<div style="margin-bottom: 15px;"><strong style="color: #0f0;">MOUSE CONTROLS</strong></div>';
        html += '<div style="margin-left: 10px; margin-bottom: 10px;">';
        html += '<div><strong>Left Click:</strong> Select units/buildings</div>';
        html += '<div><strong>Left Click + Drag:</strong> Select multiple units (selection box)</div>';
        html += '<div><strong>Right Click:</strong> Move selected units / Attack target</div>';
        html += '<div><strong>Right Click (on ground):</strong> Move to location</div>';
        html += '<div><strong>Right Click (on enemy):</strong> Attack target</div>';
        html += '</div>';
        
        html += '<div style="margin-bottom: 15px;"><strong style="color: #0f0;">KEYBOARD SHORTCUTS</strong></div>';
        html += '<div style="margin-left: 10px; margin-bottom: 10px;">';
        html += '<div><strong>WASD / Arrow Keys:</strong> Move camera</div>';
        html += '<div><strong>Space:</strong> Center camera on selected units</div>';
        html += '<div><strong>Delete:</strong> Delete selected buildings</div>';
        html += '<div><strong>Ctrl+A:</strong> Select all units</div>';
        html += '<div><strong>Double-Click Unit:</strong> Select all units of same type</div>';
        html += '<div><strong>S:</strong> Stop selected units</div>';
        html += '<div><strong>A + Right Click:</strong> Attack move</div>';
        html += '<div><strong>F3:</strong> Toggle Performance Profiler</div>';
        html += '<div><strong>ESC:</strong> Cancel building placement / Deselect</div>';
        html += '</div>';
        
        html += '<div style="margin-bottom: 15px;"><strong style="color: #0f0;">CONTROL GROUPS</strong></div>';
        html += '<div style="margin-left: 10px; margin-bottom: 10px;">';
        html += '<div><strong>Ctrl+Shift+1-9:</strong> Assign selected units to control group</div>';
        html += '<div><strong>Alt+1-9:</strong> Select control group</div>';
        html += '<div style="margin-top: 5px; opacity: 0.8;">Select units first, then press Ctrl+Shift+number to assign them to a control group. Press Alt+number to quickly select that group later.</div>';
        html += '</div>';
        
        html += '<div style="margin-bottom: 15px;"><strong style="color: #0f0;">CAMERA PRESETS</strong></div>';
        html += '<div style="margin-left: 10px; margin-bottom: 10px;">';
        html += '<div><strong>Ctrl+F1-F4:</strong> Jump to saved camera position</div>';
        html += '<div><strong>Shift+Ctrl+F1-F4:</strong> Save current camera position</div>';
        html += '<div>Useful for quickly jumping between key locations</div>';
        html += '</div>';
        
        html += '<div style="margin-bottom: 15px;"><strong style="color: #0f0;">UNIT FORMATIONS</strong></div>';
        html += '<div style="margin-left: 10px; margin-bottom: 10px;">';
        html += '<div><strong>1:</strong> Create Line Formation</div>';
        html += '<div><strong>2:</strong> Create Box Formation</div>';
        html += '<div><strong>3:</strong> Create Wedge Formation</div>';
        html += '<div><strong>4:</strong> Create Column Formation</div>';
        html += '<div>Select multiple units first, then press formation key</div>';
        html += '</div>';
        
        html += '<div style="margin-bottom: 15px;"><strong style="color: #0f0;">BUILDING HOTKEYS</strong></div>';
        html += '<div style="margin-bottom: 8px;"><strong>P</strong> - Power Plant</div>';
        html += '<div style="margin-bottom: 8px;"><strong>R</strong> - Refinery</div>';
        html += '<div style="margin-bottom: 8px;"><strong>B</strong> - Barracks</div>';
        html += '<div style="margin-bottom: 8px;"><strong>W</strong> - War Factory</div>';
        html += '<div style="margin-bottom: 8px;"><strong>A</strong> - Airfield</div>';
        html += '<div style="margin-bottom: 8px;"><strong>G</strong> - Gun Turret</div>';
        html += '<div style="margin-bottom: 15px;"><strong>T</strong> - AA Turret</div>';
        html += '<div style="margin-bottom: 15px; color: #aaa; font-size: 12px;">Press hotkey to start building placement. Press again to cancel.</div>';
        html += '<div style="margin-bottom: 15px;"><strong style="color: #0f0;">BUILDING CONTROLS</strong></div>';
        html += '<div style="margin-left: 10px; margin-bottom: 10px;">';
        html += '<div><strong>Select Building:</strong> View production queue</div>';
        html += '<div><strong>Click Unit in Build Menu:</strong> Add to production queue</div>';
        html += '<div><strong>Click × on Queue Item:</strong> Cancel production</div>';
        html += '<div><strong>Pause/Resume Button:</strong> Pause/resume production</div>';
        html += '<div><strong>Right Click (while placing):</strong> Cancel placement</div>';
        html += '</div>';
        
        html += '<div style="margin-bottom: 15px;"><strong style="color: #0f0;">SPECIAL POWERS</strong></div>';
        html += '<div style="margin-left: 10px; margin-bottom: 10px;">';
        html += '<div><strong>Recon Sweep:</strong> Reveal area of map (always available)</div>';
        html += '<div><strong>Airstrike:</strong> Requires Airfield (unlocks with air units)</div>';
        html += '<div><strong>Ion Cannon:</strong> Requires Superweapon building</div>';
        html += '</div>';
        
        html += '<div style="margin-bottom: 15px;"><strong style="color: #0f0;">CAMERA CONTROLS</strong></div>';
        html += '<div style="margin-left: 10px; margin-bottom: 10px;">';
        html += '<div><strong>Middle Mouse Drag:</strong> Pan camera</div>';
        html += '<div><strong>Mouse Edge Scrolling:</strong> Move camera when mouse near screen edge</div>';
        html += '<div><strong>Click Minimap:</strong> Jump camera to clicked location</div>';
        html += '</div>';
        
        html += '<div style="margin-bottom: 15px;"><strong style="color: #0f0;">GAME MECHANICS</strong></div>';
        html += '<div style="margin-left: 10px; margin-bottom: 10px;">';
        html += '<div><strong>Credits:</strong> Earned from harvesting resources</div>';
        html += '<div><strong>Power:</strong> Generated by Power Plants, consumed by buildings</div>';
        html += '<div><strong>Low Power:</strong> Slows construction and production</div>';
        html += '<div><strong>Tech Tiers:</strong> Unlock by building Tech Center / Advanced Tech Center</div>';
        html += '<div><strong>Fog of War:</strong> Unexplored areas are hidden</div>';
        html += '<div><strong>Radar:</strong> Reveals map when Radar Dome is built</div>';
        html += '</div>';
        
        html += '</div>';
        html += '<button class="menu-button" style="margin-top: 15px; width: 100%;" onclick="const modal = document.getElementById(\'controlsModal\'); if(modal) { modal.remove(); } game.isPaused = false;">CLOSE</button>';
        
        content.innerHTML = html;
        modal.appendChild(content);
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                this.game.isPaused = false;
            }
        });
        
        document.body.appendChild(modal);
    }
}
