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
        }
    }

    onMouseMove(e) {
        this.updateMousePosition(e);

        // Pan camera with middle mouse
        if (e.buttons === 4) {
            this.game.camera.x -= e.movementX;
            this.game.camera.y -= e.movementY;
        }

        // Edge scrolling
        const edgeSize = 20;
        const scrollSpeed = 10;

        if (this.mouseX < edgeSize) {
            this.game.camera.x -= scrollSpeed;
        } else if (this.mouseX > this.canvas.width - edgeSize) {
            this.game.camera.x += scrollSpeed;
        }

        if (this.mouseY < edgeSize) {
            this.game.camera.y -= scrollSpeed;
        } else if (this.mouseY > this.canvas.height - edgeSize) {
            this.game.camera.y += scrollSpeed;
        }
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

        if (e.key === 'a' || e.key === 'A') {
            // Attack move toggle
            this.game.attackMoveMode = true;
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

        // Check if clicking on resource node
        const clickTile = worldToTile(this.mouseWorldX, this.mouseWorldY);
        const resourceNode = this.game.map.getResourceNode(clickTile.x, clickTile.y);

        for (const entity of this.game.selectedEntities) {
            if (!(entity instanceof Unit)) continue;

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

        // Set rally point for buildings
        for (const entity of this.game.selectedEntities) {
            if (entity instanceof Building) {
                entity.setRallyPoint(this.mouseWorldX, this.mouseWorldY);
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
    }
}
