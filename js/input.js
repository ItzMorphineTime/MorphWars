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

        // Double-click detection for unit selection
        this.lastClickTime = 0;
        this.lastClickEntity = null;
        this.DOUBLE_CLICK_TIME = 300; // ms

        // Event debouncing/throttling
        this.lastMouseMoveTime = 0;
        this.MOUSE_MOVE_THROTTLE = 16; // ~60fps (throttle mouse move to once per frame)
        this.lastWheelTime = 0;
        this.WHEEL_THROTTLE = 50; // Throttle wheel events to 20fps
        this.pendingMouseMove = null;
        this.animationFrameId = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

        // Use capture phase for keydown to catch events before browser shortcuts
        // This is especially important for Ctrl+Shift+2 and Ctrl+Shift+3 which browsers may intercept
        document.addEventListener('keydown', (e) => this.onKeyDown(e), true);
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
        // Throttle mouse move events using requestAnimationFrame
        const now = performance.now();
        if (now - this.lastMouseMoveTime < this.MOUSE_MOVE_THROTTLE) {
            // Store the latest event for processing
            this.pendingMouseMove = e;
            
            // Schedule processing on next frame if not already scheduled
            if (!this.animationFrameId) {
                this.animationFrameId = requestAnimationFrame(() => {
                    if (this.pendingMouseMove) {
                        this.processMouseMove(this.pendingMouseMove);
                        this.pendingMouseMove = null;
                    }
                    this.animationFrameId = null;
                });
            }
            return;
        }
        
        this.processMouseMove(e);
        this.lastMouseMoveTime = now;
    }
    
    processMouseMove(e) {
        this.updateMousePosition(e);

        // Edge scrolling: Move camera when mouse is near screen edges
        const edgeScrollMargin = CAMERA_CONFIG.EDGE_SCROLL_MARGIN;
        const scrollSpeed = CAMERA_CONFIG.EDGE_SCROLL_SPEED;
        
        if (!this.isOverSidebar(e)) {
            if (e.clientX < edgeScrollMargin) {
                this.game.camera.x -= scrollSpeed;
            } else if (e.clientX > window.innerWidth - edgeScrollMargin) {
                this.game.camera.x += scrollSpeed;
            }
            
            if (e.clientY < edgeScrollMargin) {
                this.game.camera.y -= scrollSpeed;
            } else if (e.clientY > window.innerHeight - edgeScrollMargin) {
                this.game.camera.y += scrollSpeed;
            }
            
            this.clampCamera();
        }

        // Pan camera with middle mouse (works anywhere, even over sidebar)
        if (e.buttons === 4) {
            this.game.camera.x -= e.movementX * CAMERA_CONFIG.MIDDLE_MOUSE_PAN_SPEED;
            this.game.camera.y -= e.movementY * CAMERA_CONFIG.MIDDLE_MOUSE_PAN_SPEED;
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

        // Check for embark/disembark opportunities
        const target = this.findEntityAt(this.mouseWorldX, this.mouseWorldY);
        const selectedUnits = this.game.selectedEntities.filter(e => e instanceof Unit);
        const hasTransportSelected = selectedUnits.some(u => u.isTransport);
        // Units that can embark: not transported, and either non-transport OR ground transport (APC) loading onto naval transport
        const hasEmbarkableSelected = selectedUnits.some(u => {
            if (u.transportedBy) return false;
            if (!u.isTransport) return true;
            return target instanceof Unit && target.isTransport && target.isNaval; // APC can load onto transport ship
        });
        
        // Check for embark: Selected units over a transport
        if (hasEmbarkableSelected && target instanceof Unit && target.isTransport && 
            target.owner === this.game.humanPlayer && !selectedUnits.includes(target)) {
            // Check if any selected unit can embark
            const canEmbark = selectedUnits.some(unit => {
                if (unit.transportedBy) return false;
                if (unit === target) return false; // Can't embark onto self
                if (unit.isTransport && unit.isNaval) return false; // Naval transport can't load onto another
                if (target.transportType === 'infantry' && unit.stats.category !== 'infantry') return false;
                if (target.transportType === 'all' && target.isNaval) {
                    const unitSize = Math.ceil(unit.stats.size || 1);
                    return (target.transportUsed + unitSize <= target.transportCapacity);
                } else if (target.transportType === 'infantry') {
                    return (target.embarkedUnits.length < target.transportCapacity);
                }
                return false;
            });
            
            if (canEmbark) {
                this.canvas.style.cursor = 'grab';
                return;
            }
        }
        
        // Check for disembark: Selected transport hovering over itself
        if (hasTransportSelected && selectedUnits.length === 1) {
            const transport = selectedUnits[0];
            if (transport.isTransport && transport.embarkedUnits.length > 0) {
                // Check if hovering directly over the transport
                const dist = distance(this.mouseWorldX, this.mouseWorldY, transport.x, transport.y);
                if (dist < 30) { // Within unit size
                    this.canvas.style.cursor = 'grab';
                    return;
                }
            }
        }

        // Units selected - check what's under mouse
        if (this.game.selectedEntities.length > 0) {
            const hasCombatUnits = this.game.selectedEntities.some(e => 
                e instanceof Unit && !e.isHarvester && e.stats.damage && !e.transportedBy
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

        // Throttle wheel events
        const now = performance.now();
        if (now - this.lastWheelTime < this.WHEEL_THROTTLE) {
            return; // Skip this event
        }
        this.lastWheelTime = now;

        // Zoom functionality (if camera.scale exists)
        if (this.game.camera.scale !== undefined) {
            const zoomSpeed = CAMERA_CONFIG.ZOOM_SPEED;
            const mouseWorldX = this.mouseWorldX;
            const mouseWorldY = this.mouseWorldY;

            if (e.deltaY > 0) {
                // Zoom out
                this.game.camera.scale = Math.max(CAMERA_CONFIG.MIN_ZOOM, this.game.camera.scale - zoomSpeed);
            } else {
                // Zoom in
                this.game.camera.scale = Math.min(CAMERA_CONFIG.MAX_ZOOM, this.game.camera.scale + zoomSpeed);
            }

            // Adjust camera to zoom towards mouse position
            const zoomFactor = this.game.camera.scale;
            this.game.camera.x = mouseWorldX - (this.mouseX / zoomFactor);
            this.game.camera.y = mouseWorldY - (this.mouseY / zoomFactor);

            this.clampCamera();
        }
    }

    onKeyDown(e) {
        this.keys[e.key] = true;

        // Control groups should work even when paused (for testing/debugging)
        // But check if game is initialized
        if (!this.game) {
            return;
        }

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

        // Camera presets (Ctrl+F1-F4 to jump, Shift+Ctrl+F1-F4 to save)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'F1' || e.key === 'F2' || e.key === 'F3' || e.key === 'F4')) {
            e.preventDefault(); // Prevent browser shortcuts
            e.stopPropagation();
            const presetNum = e.key === 'F1' ? 1 : e.key === 'F2' ? 2 : e.key === 'F3' ? 3 : 4;
            if (e.shiftKey) {
                // Shift+Ctrl+F1-F4: Save camera position
                this.game.cameraPresets.set(presetNum, { x: this.game.camera.x, y: this.game.camera.y });
                showNotification(`Camera position ${presetNum} saved (Ctrl+F${presetNum} to jump)`);
            } else {
                // Ctrl+F1-F4: Jump to saved camera position
                const preset = this.game.cameraPresets.get(presetNum);
                if (preset) {
                    this.game.camera.x = preset.x;
                    this.game.camera.y = preset.y;
                    this.clampCamera();
                    showNotification(`Jumped to camera position ${presetNum}`);
                } else {
                    showNotification(`No camera position saved for ${presetNum} (Shift+Ctrl+F${presetNum} to save)`);
                }
            }
            return; // Prevent other handlers
        }

        // Select All Units (Ctrl+A)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
            e.preventDefault();
            // Clear previous selection
            for (const entity of this.game.selectedEntities) {
                entity.selected = false;
            }
            // Select all player units
            this.game.selectedEntities = this.game.units.filter(u => 
                u.owner === this.game.humanPlayer && u.isAlive() && !u.transportedBy
            );
            for (const unit of this.game.selectedEntities) {
                unit.selected = true;
            }
            if (this.game.selectedEntities.length > 0) {
                showNotification(`Selected ${this.game.selectedEntities.length} units`);
            }
            return;
        }

        // Building hotkeys: P, R, B, W, A, G, T (construction only)
        // If already placing that building, cancel. Otherwise, start placement
        const buildingHotkeys = {
            'p': 'POWER_PLANT',
            'P': 'POWER_PLANT',
            'r': 'REFINERY',
            'R': 'REFINERY',
            'b': 'BARRACKS',
            'B': 'BARRACKS',
            'w': 'WAR_FACTORY',
            'W': 'WAR_FACTORY',
            'a': 'AIRFIELD',
            'A': 'AIRFIELD',
            'g': 'GUN_TURRET',
            'G': 'GUN_TURRET',
            't': 'AA_TURRET',
            'T': 'AA_TURRET',
        };

        // Handle building hotkeys (A key prioritizes Airfield over attack move)
        if (buildingHotkeys[e.key]) {
            const buildingType = buildingHotkeys[e.key];
            
            // If already placing this building, cancel
            if (this.game.placingBuilding === buildingType) {
                this.game.cancelBuildingPlacement();
                return;
            }
            
            // Start building placement
            this.game.startBuildingPlacement(buildingType);
            return;
        }

        // Attack move toggle (only if A wasn't used for Airfield and not placing building)
        if ((e.key === 'a' || e.key === 'A') && !this.game.placingBuilding) {
            this.game.attackMoveMode = true;
        }

        // Control groups: Ctrl+Shift+1-9 to assign, Alt+1-9 to select
        // Check these BEFORE other number key handlers
        // Map shifted number keys to actual numbers (when Shift is held, browsers send '!' for 1, '@' for 2, etc.)
        const shiftNumberMap = {
            '!': 1, '@': 2, '#': 3, '$': 4, '%': 5,
            '^': 6, '&': 7, '*': 8, '(': 9
        };
        
        // Helper function to get group number from key
        // Also checks keyCode and code as fallbacks for better browser compatibility
        const getGroupNumber = (key, keyCode = null, code = null) => {
            // Check shifted characters first
            if (shiftNumberMap[key]) {
                return shiftNumberMap[key];
            }
            // Then check regular number keys
            const num = parseInt(key.replace('Digit', '') || key);
            if (!isNaN(num) && num >= 1 && num <= 9) {
                return num;
            }
            // Fallback: Check keyCode (deprecated but still works in some browsers)
            // KeyCodes: 49='1', 50='2', 51='3', etc. (when Shift: 33='!', 64='@', 35='#', etc.)
            if (keyCode !== null) {
                const keyCodeMap = {
                    33: 1, 64: 2, 35: 3, 36: 4, 37: 5, 94: 6, 38: 7, 42: 8, 40: 9, // Shifted
                    49: 1, 50: 2, 51: 3, 52: 4, 53: 5, 54: 6, 55: 7, 56: 8, 57: 9  // Regular
                };
                if (keyCodeMap[keyCode]) {
                    return keyCodeMap[keyCode];
                }
            }
            // Fallback: Check code property (e.g., 'Digit2', 'Digit3')
            if (code) {
                const codeMatch = code.match(/Digit(\d)/);
                if (codeMatch) {
                    const num = parseInt(codeMatch[1]);
                    if (num >= 1 && num <= 9) {
                        return num;
                    }
                }
            }
            return null;
        };
        
        // Check if this is a number key (1-9) or shifted number key (!-()
        const isNumberKey = (key) => {
            return (key >= '1' && key <= '9') || 
                   (key >= 'Digit1' && key <= 'Digit9') ||
                   (key in shiftNumberMap);
        };
        
        // Ctrl+Shift+Number = assign control group
        // When Ctrl+Shift is held, browsers send shifted characters (!, @, #, etc.)
        // Some browsers intercept Ctrl+Shift+2 and Ctrl+Shift+3 for their own shortcuts
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && isNumberKey(e.key)) {
            // CRITICAL: Prevent default FIRST, before any other checks
            // This prevents browser from intercepting Ctrl+Shift+2/3
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation(); // Also stop other listeners on same element
            
            const groupNum = getGroupNumber(e.key, e.keyCode, e.code);
            
            // Debug for problematic keys
            if (groupNum === 2 || groupNum === 3 || !groupNum) {
                console.log('Control group key detection:', {
                    key: e.key,
                    keyCode: e.keyCode,
                    code: e.code,
                    groupNum: groupNum,
                    ctrlKey: e.ctrlKey,
                    shiftKey: e.shiftKey,
                    altKey: e.altKey,
                    defaultPrevented: e.defaultPrevented,
                    isNumberKey: isNumberKey(e.key)
                });
            }
            
            if (!groupNum) {
                // Not a valid number key, ignore
                return;
            }
            
            if (!this.game || !this.game.controlGroups) {
                console.error('Game or controlGroups not initialized!');
                return;
            }
            console.log('selectedEntities', this.game);
            if (this.game.selectedEntities.length > 0) {
                // Assign selected entities to control group
                this.game.controlGroups.set(groupNum, [...this.game.selectedEntities]);
                showNotification(`Control group ${groupNum} assigned (${this.game.selectedEntities.length} units)`);
            } else {
                showNotification(`No units selected (select units first, then Ctrl+Shift+${groupNum})`);
            }
            return; // Prevent default and other handlers
        }
        
        // Alt+Number = select control group
        if ((e.altKey || e.metaKey) && !e.shiftKey && !e.ctrlKey && isNumberKey(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            
            const groupNum = getGroupNumber(e.key, e.keyCode, e.code);
            
            if (!groupNum) {
                return;
            }
            
            const group = this.game.controlGroups.get(groupNum);
            
            if (group && group.length > 0) {
                // Filter out dead entities
                const aliveEntities = group.filter(e => e && e.isAlive && e.isAlive());
                
                if (aliveEntities.length > 0) {
                    // Clear previous selection
                    for (const entity of this.game.selectedEntities) {
                        entity.selected = false;
                    }
                    
                    // Select control group
                    this.game.selectedEntities = aliveEntities;
                    for (const entity of aliveEntities) {
                        entity.selected = true;
                    }
                    
                    // Update control group to remove dead entities
                    this.game.controlGroups.set(groupNum, aliveEntities);
                    
                    showNotification(`Control group ${groupNum} selected (${aliveEntities.length} units)`);
                } else {
                    // All units dead, remove group
                    this.game.controlGroups.delete(groupNum);
                    showNotification(`Control group ${groupNum} is empty (all units destroyed)`);
                }
            } else {
                showNotification(`No control group assigned to ${groupNum} (Ctrl+Shift+${groupNum} to assign)`);
            }
            return; // Prevent formation hotkeys
        }
        
        // Formation hotkeys (only if no modifiers and keys 1-4)
        const isFormationKey = (e.key >= '1' && e.key <= '4') || (e.key >= 'Digit1' && e.key <= 'Digit4');
        if (isFormationKey && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
            // Number keys 1-4 = formation hotkeys (only if we have selected units and no modifiers)
            const selectedUnits = this.game.selectedEntities.filter(e => e instanceof Unit && !e.isHarvester);
            if (selectedUnits.length >= 2) {
                if (e.key === '1') {
                    this.createFormationForSelected(FORMATION_CONFIG.TYPES.LINE);
                } else if (e.key === '2') {
                    this.createFormationForSelected(FORMATION_CONFIG.TYPES.BOX);
                } else if (e.key === '3') {
                    this.createFormationForSelected(FORMATION_CONFIG.TYPES.WEDGE);
                } else if (e.key === '4') {
                    this.createFormationForSelected(FORMATION_CONFIG.TYPES.COLUMN);
                }
            }
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
            const now = Date.now();
            
            // Check for double-click (select all units of same type)
            if (entity && entity.owner === this.game.humanPlayer && 
                this.lastClickEntity === entity && 
                (now - this.lastClickTime) < this.DOUBLE_CLICK_TIME) {
                // Double-click detected - select all units of same type
                const entityType = entity.type;
                const sameTypeUnits = this.game.units.filter(u => 
                    u.owner === this.game.humanPlayer && 
                    u.type === entityType && 
                    u.isAlive()
                );
                
                // Clear previous selection
                for (const e of this.game.selectedEntities) {
                    e.selected = false;
                }
                
                // Select all units of same type (filter out transported units)
                this.game.selectedEntities = sameTypeUnits.filter(u => !u.transportedBy);
                for (const unit of sameTypeUnits) {
                    unit.selected = true;
                }
                
                    showNotification(`Selected ${sameTypeUnits.length} ${entity.stats?.name || entityType}`);
                
                // Reset double-click tracking
                this.lastClickTime = 0;
                this.lastClickEntity = null;
                
            } else {
                // Single click - normal selection (skip transported units)
                if (entity && entity.owner === this.game.humanPlayer && !(entity instanceof Unit && entity.transportedBy)) {
                entity.selected = true;
                this.game.selectedEntities.push(entity);
                }
                
                // Update double-click tracking
                this.lastClickTime = now;
                this.lastClickEntity = entity;
            }
        } else {
            // Box selection
            for (const unit of this.game.units) {
                if (unit.owner !== this.game.humanPlayer) continue;
                // Skip transported units in box selection
                if (unit.transportedBy) continue;

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

        // Handle embark/disembark commands
        const selectedUnits = this.game.selectedEntities.filter(e => e instanceof Unit);
        const hasTransportSelected = selectedUnits.some(u => u.isTransport);
        // Units that can embark: not transported, and either non-transport OR ground transport (APC) loading onto naval transport
        const hasEmbarkableSelected = selectedUnits.some(u => {
            if (u.transportedBy) return false;
            if (!u.isTransport) return true;
            return target instanceof Unit && target.isTransport && target.isNaval;
        });
        
        // Check for embark: Selected units right-clicking on a transport
        const isClickingOnTransport = target instanceof Unit && target.isTransport && target.owner === this.game.humanPlayer;
        const isTransportSelected = hasTransportSelected && selectedUnits.length === 1 && selectedUnits[0].isTransport;
        const isClickingOnSelectedTransport = isClickingOnTransport && isTransportSelected && target === selectedUnits[0];
        
        if (hasEmbarkableSelected && isClickingOnTransport) {
            
            let embarkedCount = 0;
            let failedCount = 0;
            
            for (const unit of selectedUnits) {
                // Skip if already transported or trying to embark onto self
                if (unit.transportedBy || unit === target) continue;
                // Naval transports cannot load onto another transport
                if (unit.isTransport && unit.isNaval) continue;
                
                // Check if unit can be transported
                if (target.transportType === 'infantry' && unit.stats.category !== 'infantry') {
                    failedCount++;
                    continue; // Skip non-infantry for APC
                }
                
                // Check capacity
                let hasSpace = false;
                if (target.transportType === 'all' && target.isNaval) {
                    // Transport ship - check capacity points
                    const unitSize = Math.ceil(unit.stats.size || 1);
                    hasSpace = (target.transportUsed + unitSize <= target.transportCapacity);
                } else if (target.transportType === 'infantry') {
                    // APC - check unit count
                    hasSpace = (target.embarkedUnits.length < target.transportCapacity);
                }
                
                if (!hasSpace) {
                    failedCount++;
                    continue; // No space
                }
                
                // Check distance - allow units to move closer if needed
                // Naval transports: use 4 tiles (transport at coast, unit on land adjacent)
                const embarkRange = target.isNaval ? TILE_SIZE * 4 : TILE_SIZE * 3;
                const dist = distance(unit.x, unit.y, target.x, target.y);
                if (dist < embarkRange) {
                    if (target.embarkUnit(unit, this.game)) {
                        embarkedCount++;
                    } else {
                        failedCount++;
                    }
                } else {
                    // Unit is too far - move it closer first
                    // For naval transports, ground units must path to coastline (can't path to water)
                    let moveX = target.x, moveY = target.y;
                    if (target.isNaval && !unit.isNaval) {
                        const coastTile = findNearestCoastlineToPosition(this.game.map, Math.floor(target.x / TILE_SIZE), Math.floor(target.y / TILE_SIZE));
                        if (coastTile) {
                            const worldPos = tileToWorld(coastTile.x, coastTile.y);
                            moveX = worldPos.x;
                            moveY = worldPos.y;
                        }
                    }
                    unit.moveTo(moveX, moveY, this.game);
                    // Don't count as failed, just move closer
                }
            }
            
            if (embarkedCount > 0) {
                showNotification(`${embarkedCount} unit(s) embarked`);
                return;
            } else if (failedCount > 0) {
                showNotification(`Cannot embark: ${failedCount === selectedUnits.length ? 'Transport full or invalid unit type' : 'Some units cannot embark'}`);
                // Don't return - allow movement command to proceed
            }
        }
        
        // Check for disembark: Selected transport right-clicking directly on itself
        if (isTransportSelected && isClickingOnSelectedTransport) {
            const transport = selectedUnits[0];
            if (transport.isTransport && transport.embarkedUnits.length > 0) {
                // Only disembark when clicking directly on the transport
                let disembarkedCount = 0;
                const unitsToDisembark = [...transport.embarkedUnits];
                for (const unit of unitsToDisembark) {
                    if (transport.disembarkUnit(unit, this.game)) {
                        disembarkedCount++;
                    }
                }
                if (disembarkedCount > 0) {
                    showNotification(`${disembarkedCount} unit(s) disembarked`);
                    return;
                }
            }
        }

        // Check if we have a formation - move formation as a group
        // Filter selectedUnits to exclude harvesters for formation logic
        const selectedUnitsForFormation = selectedUnits.filter(e => !e.isHarvester);
        if (selectedUnitsForFormation.length >= 2) {
            // Check if units are in a formation
            const formationIds = new Set();
            for (const unit of selectedUnitsForFormation) {
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
        // Filter out transported units but keep transports
        const unitsForGroupMove = selectedUnitsForFormation.filter(u => !u.transportedBy || u.isTransport);
        if (unitsForGroupMove.length > 1 && unitsForGroupMove.length <= 20) {
            // Spread destinations in a small area around the click point
            const spreadRadius = Math.min(unitsForGroupMove.length * 0.5, 5) * TILE_SIZE;
            const angleStep = (Math.PI * 2) / unitsForGroupMove.length;
            
            for (let i = 0; i < unitsForGroupMove.length; i++) {
                const unit = unitsForGroupMove[i];
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
        // Filter out transported units from selection for movement commands (but allow transports themselves)
        const unitsToCommand = this.game.selectedEntities.filter(e => 
            e instanceof Unit && (!e.transportedBy || e.isTransport)
        );
        
        for (const entity of unitsToCommand) {
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
        // Check units first (skip transported units - they shouldn't be clickable)
        for (const unit of this.game.units) {
            if (unit.transportedBy) continue; // Skip transported units
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
        
        // Enhanced: Jump camera to clicked location on minimap
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
