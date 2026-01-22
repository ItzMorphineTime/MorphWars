// Input handling

class InputHandler {
    constructor(game, canvas) {
        this.game = game;
        this.canvas = canvas;

        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseWorldX = 0;
        this.mouseWorldY = 0;

        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;

        this.isRightDragging = false;
        this.keys = {};

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Minimap click to navigate
        const minimap = document.getElementById('minimap');
        minimap.addEventListener('click', (e) => this.onMinimapClick(e));
    }

    updateMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;

        this.mouseWorldX = this.mouseX + this.game.camera.x;
        this.mouseWorldY = this.mouseY + this.game.camera.y;
    }

    isOverSidebar(e) {
        // Check if mouse is over sidebar (positioned on the right)
        const sidebarWidth = 280;
        return e.clientX > window.innerWidth - sidebarWidth;
    }

    onMouseDown(e) {
        // Ignore clicks on sidebar
        if (this.isOverSidebar(e)) {
            return;
        }

        this.updateMousePosition(e);

        if (e.button === 0) {
            // Left click
            if (this.game.placingBuilding) {
                this.game.confirmBuildingPlacement();
            } else {
                this.isDragging = true;
                this.dragStartX = this.mouseWorldX;
                this.dragStartY = this.mouseWorldY;
                // Show crosshair cursor when selecting
                this.canvas.style.cursor = 'crosshair';
            }
        } else if (e.button === 2) {
            // Right click
            if (this.game.placingBuilding) {
                this.game.cancelBuildingPlacement();
            } else if (this.game.activePower) {
                this.game.useSpecialPowerAt(this.mouseWorldX, this.mouseWorldY);
            } else {
                this.handleRightClick();
            }
        }
    }

    onMouseUp(e) {
        this.updateMousePosition(e);

        if (e.button === 0 && this.isDragging) {
            this.isDragging = false;
            this.handleSelection();
            // Update cursor after selection
            this.updateCursor();
        }
    }

    onMouseMove(e) {
        this.updateMousePosition(e);

        // Pan camera with middle mouse (works anywhere, even over sidebar)
        if (e.buttons === 4) {
            this.game.camera.x -= e.movementX;
            this.game.camera.y -= e.movementY;
            // Clamp camera to map bounds
            this.clampCamera();
            return;
        }

        // Keep crosshair when dragging to select
        if (this.isDragging && e.buttons === 1) {
            this.canvas.style.cursor = 'crosshair';
            return;
        }

        // Update cursor based on game state
        this.updateCursor();
    }

    updateCursor() {
        // Active power - always crosshair
        if (this.game.activePower) {
            this.canvas.style.cursor = 'crosshair';
            return;
        }

        // Units selected - check what's under mouse
        if (this.game.selectedEntities.length > 0) {
            const target = this.findEntityAt(this.mouseWorldX, this.mouseWorldY);
            const hasCombatUnits = this.game.selectedEntities.some(e => 
                e instanceof Unit && !e.isHarvester && e.stats.damage
            );

            if (target && target.owner !== this.game.humanPlayer && target.isAlive && target.isAlive() && hasCombatUnits) {
                // Enemy target - show attack cursor (crosshair)
                this.canvas.style.cursor = 'crosshair';
            } else if (hasCombatUnits) {
                // No enemy target - show move cursor (pointer)
                this.canvas.style.cursor = 'pointer';
            } else {
                // No combat units - default cursor
                this.canvas.style.cursor = 'default';
            }
        } else {
            // No selection - default cursor
            this.canvas.style.cursor = 'default';
        }
    }

    clampCamera() {
        // Clamp camera to map bounds - check if map exists
        if (!this.game.map) return;
        
        const maxX = (this.game.map.width * TILE_SIZE) - this.canvas.width;
        const maxY = (this.game.map.height * TILE_SIZE) - this.canvas.height;
        
        this.game.camera.x = Math.max(0, Math.min(this.game.camera.x, maxX));
        this.game.camera.y = Math.max(0, Math.min(this.game.camera.y, maxY));
    }

    onWheel(e) {
        e.preventDefault();
        // Could implement zoom here if desired
    }

    onKeyDown(e) {
        this.keys[e.key] = true;

        // Hotkeys
        if (e.key === 'Escape') {
            this.game.cancelBuildingPlacement();
            this.game.activePower = null;
        }

        if (e.key === 'Delete') {
            this.game.deleteSelected();
        }

        if (e.key === 's' || e.key === 'S') {
            // Stop selected units
            for (const entity of this.game.selectedEntities) {
                if (entity instanceof Unit) {
                    entity.stop();
                }
            }
        }

        // Performance profiler toggle (F3)
        if (e.key === 'F3') {
            if (this.game.profiler) {
                this.game.profiler.toggle();
                showNotification(this.game.profiler.enabled ? 'Performance profiler enabled' : 'Performance profiler disabled');
            }
        }

        if (e.key === 'a' || e.key === 'A') {
            // Attack move toggle
            this.game.attackMoveMode = true;
        }

        // Formation hotkeys
        if (e.key === '1') {
            // Line formation
            this.createFormationForSelected(FORMATION_CONFIG.TYPES.LINE);
        } else if (e.key === '2') {
            // Box formation
            this.createFormationForSelected(FORMATION_CONFIG.TYPES.BOX);
        } else if (e.key === '3') {
            // Wedge formation
            this.createFormationForSelected(FORMATION_CONFIG.TYPES.WEDGE);
        } else if (e.key === '4') {
            // Column formation
            this.createFormationForSelected(FORMATION_CONFIG.TYPES.COLUMN);
        }
    }

    createFormationForSelected(formationType) {
        const selectedUnits = this.game.selectedEntities.filter(e => e instanceof Unit && !e.isHarvester);
        if (selectedUnits.length < 2) {
            showNotification('Select at least 2 units for formation');
            return;
        }

        // Calculate center of selected units
        let centerX = 0, centerY = 0;
        for (const unit of selectedUnits) {
            centerX += unit.x;
            centerY += unit.y;
        }
        centerX /= selectedUnits.length;
        centerY /= selectedUnits.length;

        const formation = this.game.createFormationForSelected(formationType, centerX, centerY);
        if (formation) {
            const typeName = formationType.charAt(0).toUpperCase() + formationType.slice(1);
            showNotification(`${typeName} formation created`);
        }
    }

    onKeyUp(e) {
        this.keys[e.key] = false;

        if (e.key === 'a' || e.key === 'A') {
            this.game.attackMoveMode = false;
        }
    }

    handleSelection() {
        const dragX = Math.min(this.dragStartX, this.mouseWorldX);
        const dragY = Math.min(this.dragStartY, this.mouseWorldY);
        const dragW = Math.abs(this.mouseWorldX - this.dragStartX);
        const dragH = Math.abs(this.mouseWorldY - this.dragStartY);

        // Clear previous selection
        for (const entity of this.game.selectedEntities) {
            entity.selected = false;
        }
        this.game.selectedEntities = [];

        // Single click vs drag selection
        const isClick = dragW < 5 && dragH < 5;

        if (isClick) {
            // Select single entity
            const entity = this.findEntityAt(this.mouseWorldX, this.mouseWorldY);
            if (entity && entity.owner === this.game.humanPlayer) {
                entity.selected = true;
                this.game.selectedEntities.push(entity);
            }
        } else {
            // Box selection
            for (const unit of this.game.units) {
                if (unit.owner !== this.game.humanPlayer) continue;

                if (rectIntersect(
                    dragX, dragY, dragW, dragH,
                    unit.x - 10, unit.y - 10, 20, 20
                )) {
                    unit.selected = true;
                    this.game.selectedEntities.push(unit);
                }
            }

            // If no units selected, try buildings
            if (this.game.selectedEntities.length === 0) {
                for (const building of this.game.buildings) {
                    if (building.owner !== this.game.humanPlayer) continue;

                    const bx = building.tileX * TILE_SIZE;
                    const by = building.tileY * TILE_SIZE;
                    const bw = building.stats.width * TILE_SIZE;
                    const bh = building.stats.height * TILE_SIZE;

                    if (rectIntersect(dragX, dragY, dragW, dragH, bx, by, bw, bh)) {
                        building.selected = true;
                        this.game.selectedEntities.push(building);
                    }
                }
            }
        }
    }

    handleRightClick() {
        if (this.game.selectedEntities.length === 0) return;

        // Find target at mouse position
        const target = this.findEntityAt(this.mouseWorldX, this.mouseWorldY);

        // PRIORITY: If clicking on enemy unit/building, focus fire on it
        if (target && target.owner !== this.game.humanPlayer && target.isAlive()) {
            const selectedUnits = this.game.selectedEntities.filter(e => 
                e instanceof Unit && !e.isHarvester && e.stats.damage
            );

            if (selectedUnits.length > 0) {
                // All selected combat units attack the target
                for (const unit of selectedUnits) {
                    // Remove from formation if in one
                    if (unit.formationId) {
                        this.game.removeUnitFromFormation(unit);
                    }
                    // Set target for focus fire
                    unit.attackTarget(target);
                }
                showNotification(`Focus fire on ${target.stats?.name || target.type || 'target'}!`);
                return;
            }
        }

        // Check if clicking on resource node
        const clickTile = worldToTile(this.mouseWorldX, this.mouseWorldY);
        const resourceNode = this.game.map.getResourceNode(clickTile.x, clickTile.y);

        // Check if we have a formation - move formation as a group
        const selectedUnits = this.game.selectedEntities.filter(e => e instanceof Unit && !e.isHarvester);
        if (selectedUnits.length >= 2) {
            // Check if units are in a formation
            const formationIds = new Set();
            for (const unit of selectedUnits) {
                if (unit.formationId) {
                    formationIds.add(unit.formationId);
                }
            }

            // If all selected units are in the same formation, move formation
            if (formationIds.size === 1) {
                const formationId = Array.from(formationIds)[0];
                const formation = this.game.activeFormations.get(formationId);
                if (formation) {
                    // Calculate facing angle
                    const facing = Math.atan2(
                        this.mouseWorldY - formation.centerY,
                        this.mouseWorldX - formation.centerX
                    );
                    formation.updateCenter(this.mouseWorldX, this.mouseWorldY);
                    formation.updateFacing(facing);

                    // Move all units to their formation positions with slight randomization to avoid collisions
                    // Note: Formation movement doesn't remove units from formation
                    for (let i = 0; i < formation.units.length; i++) {
                        const unit = formation.units[i];
                        const pos = formation.getPositionForUnit(i);
                        
                        // Add small random offset to spread out arrival times and reduce collisions
                        const offsetX = (Math.random() - 0.5) * TILE_SIZE * 0.5;
                        const offsetY = (Math.random() - 0.5) * TILE_SIZE * 0.5;
                        const targetX = pos.x + offsetX;
                        const targetY = pos.y + offsetY;
                        
                        if (this.game.attackMoveMode) {
                            unit.attackMove(targetX, targetY, this.game);
                        } else {
                            unit.moveTo(targetX, targetY, this.game);
                        }
                    }
                    return;
                }
            }
        }
        
        // For non-formation groups, spread out destinations to reduce collisions
        if (selectedUnits.length > 1 && selectedUnits.length <= 20) {
            // Spread destinations in a small area around the click point
            const spreadRadius = Math.min(selectedUnits.length * 0.5, 5) * TILE_SIZE;
            const angleStep = (Math.PI * 2) / selectedUnits.length;
            
            for (let i = 0; i < selectedUnits.length; i++) {
                const unit = selectedUnits[i];
                const angle = i * angleStep;
                const offsetX = Math.cos(angle) * spreadRadius * Math.random();
                const offsetY = Math.sin(angle) * spreadRadius * Math.random();
                const targetX = this.mouseWorldX + offsetX;
                const targetY = this.mouseWorldY + offsetY;
                
                // Remove from formation if unit gets new movement command
                if (unit.formationId) {
                    this.game.removeUnitFromFormation(unit);
                }

                if (target && target.owner !== this.game.humanPlayer) {
                    unit.attackTarget(target);
                } else {
                    if (this.game.attackMoveMode) {
                        unit.attackMove(targetX, targetY, this.game);
                    } else {
                        unit.moveTo(targetX, targetY, this.game);
                    }
                }
            }
            
            // Set rally point for buildings
            for (const entity of this.game.selectedEntities) {
                if (entity instanceof Building) {
                    entity.setRallyPoint(this.mouseWorldX, this.mouseWorldY);
                }
            }
            return;
        }

        // Handle individual units (single unit or large groups)
        for (const entity of this.game.selectedEntities) {
            if (!(entity instanceof Unit)) continue;
            
            // Airplanes can only attack, not move (or return to airfield)
            if (entity.isAirplane) {
                // Check if clicking on own airfield - return home
                if (target instanceof Building && target.type === 'AIRFIELD' && 
                    target.owner === this.game.humanPlayer && target === entity.homeAirfield) {
                    entity.flyByTarget = null;
                    entity.flyByState = 'returning';
                    entity.landed = false; // Take off if landed
                    showNotification('Airplane returning to base');
                    continue;
                }
                // Otherwise, can only attack enemies
                if (target && target.owner !== this.game.humanPlayer && target.isAlive()) {
                    entity.attackTarget(target);
                } else {
                    showNotification('Airplanes can only attack targets or return to airfield');
                }
                continue;
            }

            // CRITICAL: Remove from formation BEFORE giving new command
            // This prevents formation update from overriding the new command
            if (entity.formationId) {
                this.game.removeUnitFromFormation(entity);
            }

            // Harvester-specific commands
            if (entity.isHarvester) {
                // Assign to refinery
                if (target instanceof Building && target.stats.isRefinery && target.owner === this.game.humanPlayer) {
                    entity.homeRefinery = target;
                    showNotification('Harvester assigned to Refinery');
                    continue;
                }

                // Assign to resource node
                if (resourceNode) {
                    entity.targetResource = resourceNode;
                    entity.harvestState = 'moving_to_resource';
                    entity.moveTo(resourceNode.x * TILE_SIZE, resourceNode.y * TILE_SIZE, this.game);
                    showNotification('Harvester assigned to resource');
                    continue;
                }
            }

            if (target && target.owner !== this.game.humanPlayer) {
                // Attack target
                entity.attackTarget(target);
            } else {
                // Move to location
                if (this.game.attackMoveMode) {
                    entity.attackMove(this.mouseWorldX, this.mouseWorldY, this.game);
                } else {
                    entity.moveTo(this.mouseWorldX, this.mouseWorldY, this.game);
                }
            }
        }

        // Set rally point for buildings (if not already set above)
        if (selectedUnits.length <= 1 || selectedUnits.length > 20) {
            for (const entity of this.game.selectedEntities) {
                if (entity instanceof Building) {
                    entity.setRallyPoint(this.mouseWorldX, this.mouseWorldY);
                }
            }
        }
    }

    findEntityAt(worldX, worldY) {
        // Check units first
        for (const unit of this.game.units) {
            const dist = distance(worldX, worldY, unit.x, unit.y);
            if (dist < 20) {
                return unit;
            }
        }

        // Check buildings
        for (const building of this.game.buildings) {
            const bx = building.tileX * TILE_SIZE;
            const by = building.tileY * TILE_SIZE;
            const bw = building.stats.width * TILE_SIZE;
            const bh = building.stats.height * TILE_SIZE;

            if (pointInRect(worldX, worldY, bx, by, bw, bh)) {
                return building;
            }
        }

        return null;
    }

    getSelectionBox() {
        if (!this.isDragging) return null;

        return {
            x: Math.min(this.dragStartX, this.mouseWorldX),
            y: Math.min(this.dragStartY, this.mouseWorldY),
            w: Math.abs(this.mouseWorldX - this.dragStartX),
            h: Math.abs(this.mouseWorldY - this.dragStartY),
        };
    }

    onMinimapClick(e) {
        const minimap = document.getElementById('minimap');
        if (!minimap || !this.game.map) return; // Safety check
        
        const rect = minimap.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Convert minimap coordinates to world coordinates
        const scaleX = (this.game.map.width * TILE_SIZE) / rect.width;
        const scaleY = (this.game.map.height * TILE_SIZE) / rect.height;

        const worldX = x * scaleX;
        const worldY = y * scaleY;

        // Center camera on clicked position
        this.game.camera.x = worldX - this.canvas.width / 2;
        this.game.camera.y = worldY - this.canvas.height / 2;
        this.clampCamera();
    }
}
