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
    }

    setupElements() {
        this.creditsEl = document.getElementById('credits');
        this.powerUsedEl = document.getElementById('powerUsed');
        this.powerTotalEl = document.getElementById('powerTotal');
        this.powerFillEl = document.getElementById('powerFill');
        this.selectionInfoEl = document.getElementById('selectionInfo');
        this.buildMenuEl = document.getElementById('buildMenu');
        this.buildQueueEl = document.getElementById('buildQueue');

        this.powerButtons = {
            recon: document.getElementById('powerRecon'),
            airstrike: document.getElementById('powerAirstrike'),
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
                // Place building
                this.game.startBuildingPlacement(button.dataset.building);
            } else if (button.dataset.unit) {
                // Train unit
                const selected = this.game.selectedEntities[0];
                if (selected instanceof Building) {
                    const stats = UNIT_TYPES[button.dataset.unit];
                    if (this.game.humanPlayer.spend(stats.cost)) {
                        selected.addToQueue(button.dataset.unit, stats);
                    }
                }
            }
        });
    }

    update() {
        const player = this.game.humanPlayer;
        if (!player) return;

        this.updateResources(player);
        this.updateSelection();
        this.updateBuildMenu();
        this.updatePowerButtons(player);
    }

    updateResources(player) {
        this.creditsEl.textContent = Math.floor(player.credits);
        this.powerUsedEl.textContent = player.powerConsumed;
        this.powerTotalEl.textContent = player.powerGenerated;

        const ratio = player.getPowerRatio();
        this.powerFillEl.style.width = `${Math.min(ratio * 100, 100)}%`;

        if (ratio < 1) {
            this.powerFillEl.classList.add('power-low');
            this.powerFillEl.style.backgroundColor = '#ff0000'; // Red when low
        } else {
            this.powerFillEl.classList.remove('power-low');
            this.powerFillEl.style.backgroundColor = '#ffff00'; // Yellow when normal
        }
    }

    updateSelection() {
        const selected = this.game.selectedEntities;

        if (selected.length === 0) {
            this.selectionInfoEl.innerHTML = '<div class="sidebar-header">Selection</div><div class="unit-info">No units selected</div>';
            return;
        }

        let html = '<div class="sidebar-header">Selection</div>';

        if (selected.length === 1) {
            const entity = selected[0];
            html += `<div class="unit-info">`;
            html += `<strong>${entity.stats.name || entity.type}</strong><br>`;
            html += `HP: ${Math.floor(entity.hp)}/${entity.maxHp}<br>`;

            if (entity.veterancy > 0) {
                html += `Rank: ${'★'.repeat(entity.veterancy)}<br>`;
            }

            if (entity instanceof Unit) {
                if (entity.isHarvester) {
                    html += `Cargo: ${Math.floor(entity.cargo)}/${entity.stats.maxCargo}<br>`;
                }
                if (entity.maxAmmo > 0) {
                    html += `Ammo: ${entity.ammo}/${entity.maxAmmo}<br>`;
                    if (entity.needsReload) {
                        html += `<span style="color: #ff0;">RELOADING</span><br>`;
                    }
                }
            }

            if (entity instanceof Building) {
                if (entity.currentProduction) {
                    const progress = (entity.getProductionProgress() * 100).toFixed(0);
                    html += `<br>Building: ${entity.currentProduction.stats.name}<br>`;
                    html += `Progress: ${progress}%<br>`;
                }
                if (entity.productionQueue.length > 0) {
                    html += `Queue: ${entity.productionQueue.length}<br>`;
                }
            }

            html += `</div>`;
            html += `<div class="health-bar"><div class="health-fill" style="width: ${entity.getHealthPercent() * 100}%"></div></div>`;
        } else {
            html += `<div class="unit-info">`;
            html += `<strong>${selected.length} units selected</strong><br>`;

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
            // Still update production queue if showing production menu
            if (currentEntity instanceof Building && currentEntity.stats.produces) {
                this.updateProductionQueue(currentEntity);
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

            const canBuild = player.canBuild(unitType, true);
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

    updateProductionQueue(building) {
        let html = '';

        if (building.currentProduction) {
            const progress = (building.getProductionProgress() * 100).toFixed(0);
            html += `<div class="queue-item">`;
            html += `${building.currentProduction.stats.name}`;
            html += `<div class="queue-progress" style="width: ${progress}%"></div>`;
            html += `</div>`;
        }

        for (let i = 0; i < building.productionQueue.length; i++) {
            const item = building.productionQueue[i];
            html += `<div class="queue-item">${item.stats.name}</div>`;
        }

        this.buildQueueEl.innerHTML = html;
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

        gameMenu.innerHTML = `
            <div class="menu-title">${message}</div>
            <div style="text-align: center; margin: 20px 0;">
                ${winner === this.game.humanPlayer ?
                    'You have destroyed all enemy forces!' :
                    'Your base has been destroyed!'}
            </div>
            <button class="menu-button" onclick="location.reload()">PLAY AGAIN</button>
        `;

        gameMenu.classList.remove('hidden');
    }
}
