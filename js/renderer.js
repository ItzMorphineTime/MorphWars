// Renderer

class Renderer {
    constructor(game, canvas, minimapCanvas) {
        this.game = game;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.minimapCanvas = minimapCanvas;
        this.minimapCtx = minimapCanvas.getContext('2d');

        // Minimap optimization: throttle updates
        this.lastMinimapUpdate = 0;
        this.MINIMAP_UPDATE_INTERVAL = 500; // Update every 500ms (2 FPS)
        this.minimapTerrainCache = null; // Cache static terrain data
        this.minimapFogCache = null; // Cache fog of war data
        this.lastFogUpdateTime = 0;
        
        // Frustum culling: visibility cache per frame
        this.visibilityCache = new Map(); // Cache entity visibility per frame
        this.currentFrameId = 0;
        
        // Sprite system (use game's instances if available, otherwise create new)
        if (typeof SpriteManager !== 'undefined') {
            this.spriteManager = new SpriteManager();
        } else {
            console.warn('SpriteManager not loaded, sprite system disabled');
            this.spriteManager = null;
        }
        
        if (typeof SpriteRenderer !== 'undefined' && this.spriteManager) {
            this.spriteRenderer = new SpriteRenderer(this.spriteManager, this.ctx);
        } else {
            console.warn('SpriteRenderer not loaded, sprite system disabled');
            this.spriteRenderer = null;
        }

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        // Canvas width should account for sidebar (280px)
        const sidebarWidth = 280;
        this.canvas.width = window.innerWidth - sidebarWidth;
        this.canvas.height = window.innerHeight;

        this.minimapCanvas.width = this.minimapCanvas.clientWidth;
        this.minimapCanvas.height = this.minimapCanvas.clientHeight;
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Clear visibility cache at start of each frame (if caching enabled)
        if (FRUSTUM_CULLING.CACHE_VISIBILITY) {
            this.visibilityCache.clear();
            this.currentFrameId++;
        }

        this.ctx.save();
        this.ctx.translate(-this.game.camera.x, -this.game.camera.y);

        this.renderTerrain();
        this.renderFogOfWar();
        this.renderBuildings();
        this.renderUnits();
        this.renderPlacementGhost();
        
        // Render visual effects (damage numbers, projectiles, etc.)
        if (this.game.effects) {
            this.game.effects.render(this.ctx, this.game.camera);
        }

        this.ctx.restore();

        // Airplanes are now regular units, rendered in renderUnits()

        this.renderUI();
        this.renderMinimap();
        
        // Render performance stats if enabled
        if (this.game.profiler && this.game.profiler.enabled) {
            this.game.ui.renderPerformanceStats();
        }
    }

    renderTerrain() {
        const startX = Math.floor(this.game.camera.x / TILE_SIZE);
        const startY = Math.floor(this.game.camera.y / TILE_SIZE);
        const endX = Math.ceil((this.game.camera.x + this.canvas.width) / TILE_SIZE);
        const endY = Math.ceil((this.game.camera.y + this.canvas.height) / TILE_SIZE);

        for (let y = Math.max(0, startY); y < Math.min(this.game.map.height, endY); y++) {
            for (let x = Math.max(0, startX); x < Math.min(this.game.map.width, endX); x++) {
                const tile = this.game.map.getTile(x, y);
                if (!tile) continue;

                const px = x * TILE_SIZE;
                const py = y * TILE_SIZE;

                // Use pre-calculated terrain color (optimization: calculated once during map generation)
                // Fallback to calculation if color not set (for backwards compatibility)
                let color = tile.color;
                if (!color) {
                    // Fallback: calculate color on the fly (shouldn't happen after optimization)
                    let height = 0.5;
                    if (this.game.map.heightMapGenerator) {
                        height = this.game.map.heightMapGenerator.getHeight(x, y);
                    }
                    color = this.game.map.calculateTerrainColor(x, y, tile.terrain, height);
                    tile.color = color; // Cache it for next time
                }

                this.ctx.fillStyle = color;
                this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

                // Grid
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                this.ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
            }
        }

        // Resource nodes
        for (const node of this.game.map.resourceNodes) {
            if (node.resources > 0) {
                const px = node.x * TILE_SIZE;
                const py = node.y * TILE_SIZE;

                // Use resource-specific color (Ore = orange, Gems = cyan)
                this.ctx.fillStyle = node.color || '#d4af37';
                this.ctx.fillRect(px - 10, py - 10, 20, 20);

                // Resource amount text
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '10px monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(Math.floor(node.resources), px, py + 25);

                // Resource type indicator
                if (node.type === 'gems') {
                    this.ctx.fillStyle = node.color;
                    this.ctx.fillRect(px - 2, py - 2, 4, 4);
                }
            }
        }
    }

    renderFogOfWar() {
        if (!this.game.humanPlayer) return;

        const startX = Math.floor(this.game.camera.x / TILE_SIZE);
        const startY = Math.floor(this.game.camera.y / TILE_SIZE);
        const endX = Math.ceil((this.game.camera.x + this.canvas.width) / TILE_SIZE);
        const endY = Math.ceil((this.game.camera.y + this.canvas.height) / TILE_SIZE);

        for (let y = Math.max(0, startY); y < Math.min(this.game.map.height, endY); y++) {
            for (let x = Math.max(0, startX); x < Math.min(this.game.map.width, endX); x++) {
                const tile = this.game.map.getTile(x, y);
                if (!tile) continue;

                const fogLevel = tile.fogOfWar[this.game.humanPlayer.id] || FOG_UNEXPLORED;

                const px = x * TILE_SIZE;
                const py = y * TILE_SIZE;

                if (fogLevel === FOG_UNEXPLORED) {
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
                    this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                } else if (fogLevel === FOG_EXPLORED) {
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                    this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }

    renderBuildings() {
        for (const building of this.game.buildings) {
            if (!this.isVisible(building)) continue;

            const px = building.tileX * TILE_SIZE;
            const py = building.tileY * TILE_SIZE;
            const w = building.stats.width * TILE_SIZE;
            const h = building.stats.height * TILE_SIZE;

            // Try to render with sprite first (if sprite system is available and enabled)
            let spriteRendered = false;
            if (this.spriteRenderer && this.game.settings.useSprites) {
                spriteRendered = this.spriteRenderer.renderBuilding(building, this.game.camera);
            }
            
            // If sprite rendering failed or not available, use fallback rendering
            if (!spriteRendered) {
                // Building body - blend building type color with player color
                const buildingTypeColor = BUILDING_TYPE_COLORS[building.type] || building.owner.color;
                const blendedColor = this.blendColors(buildingTypeColor, building.owner.color, 0.7);
                this.ctx.fillStyle = blendedColor;
                this.ctx.fillRect(px, py, w, h);

                // Building name (only show in fallback mode)
                this.ctx.fillStyle = '#000';
                this.ctx.font = '10px monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(building.stats.name, px + w / 2, py + h / 2);
            }

            // Border - use player color (always render border)
            this.ctx.strokeStyle = building.selected ? '#fff' : building.owner.color;
            this.ctx.lineWidth = building.selected ? 3 : 2;
            this.ctx.strokeRect(px, py, w, h);

            // Health bar
            this.renderHealthBar(px, py - 5, w, building.getHealthPercent());

            // Construction progress (if under construction)
            if (building.isUnderConstruction) {
                const progress = building.getConstructionPercent();
                this.ctx.fillStyle = '#00f';
                this.ctx.fillRect(px, py + h + 2, w * progress, 4);

                // Construction text
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '8px monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('Constructing...', px + w / 2, py + h + 14);
            }
            // Production progress (if operational and producing)
            else if (building.currentProduction) {
                const progress = building.getProductionProgress();
                this.ctx.fillStyle = '#ff0';
                this.ctx.fillRect(px, py + h + 2, w * progress, 3);
            }

            // Rally point
            if (building.selected && building.stats.produces) {
                this.ctx.strokeStyle = building.owner.color;
                this.ctx.setLineDash([5, 5]);
                this.ctx.beginPath();
                this.ctx.moveTo(px + w / 2, py + h / 2);
                this.ctx.lineTo(building.rallyPoint.x, building.rallyPoint.y);
                this.ctx.stroke();
                this.ctx.setLineDash([]);

                this.ctx.fillStyle = building.owner.color;
                this.ctx.fillRect(building.rallyPoint.x - 5, building.rallyPoint.y - 5, 10, 10);
            }
        }
    }

    renderUnits() {
        for (const unit of this.game.units) {
            if (!this.isVisible(unit)) continue;
            
            // Don't render units that are being transported
            if (unit.transportedBy) continue;

            // Try to render with sprite first (if sprite system is available and enabled)
            let spriteRendered = false;
            if (this.spriteRenderer && this.game.settings.useSprites) {
                spriteRendered = this.spriteRenderer.renderUnit(unit, this.game.camera);
            }
            
            // If sprite rendering failed or not available, use fallback rendering
            if (!spriteRendered) {
                this.renderUnitFallback(unit);
            } else {
                // Sprite rendered successfully, but we still need to render overlays
                const size = (unit.stats.size || 1) * 15;
                this.renderUnitOverlays(unit, size);
            }
        }
    }
    
    /**
     * Fallback rendering for units (original rectangle rendering)
     */
    renderUnitFallback(unit) {
        const size = (unit.stats.size || 1) * 15;

        // Determine unit color based on type (stronger type color blend)
        let unitColor = unit.owner.color;
        if (unit.isHarvester) {
            unitColor = this.blendColors(UNIT_TYPE_COLORS.harvester, unit.owner.color, 0.7);
        } else if (unit.isBuilder) {
            unitColor = this.blendColors(UNIT_TYPE_COLORS.builder, unit.owner.color, 0.7);
        } else if (unit.stats.category === 'infantry') {
            unitColor = this.blendColors(UNIT_TYPE_COLORS.infantry, unit.owner.color, 0.7);
        } else if (unit.stats.category === 'air') {
            unitColor = this.blendColors(UNIT_TYPE_COLORS.air, unit.owner.color, 0.7);
        } else if (unit.stats.category === 'naval') {
            unitColor = this.blendColors('#0066cc', unit.owner.color, 0.7);
        } else if (unit.stats.category === 'vehicle') {
            unitColor = this.blendColors(UNIT_TYPE_COLORS.vehicle, unit.owner.color, 0.7);
        }
        
        // Submarine stealth - only render if detected or owned by player
        if (unit.isSubmarine && unit.stealth && !unit.stealthDetected && unit.owner !== this.game.humanPlayer) {
            return; // Don't render undetected enemy submarines
        }

        // Unit body
        if (unit.stats.category === 'infantry') {
            this.ctx.fillStyle = unitColor;
            this.ctx.beginPath();
            this.ctx.arc(unit.x, unit.y, size / 2, 0, Math.PI * 2);
            this.ctx.fill();

            // Player color border
            this.ctx.strokeStyle = unit.owner.color;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        } else if (unit.stats.category === 'air') {
                this.ctx.fillStyle = unitColor;
                this.ctx.save();
                this.ctx.translate(unit.x, unit.y);
                
                // Airplanes face direction of travel (unless landed)
                if (unit.isAirplane && unit.angle !== undefined && !unit.landed) {
                    this.ctx.rotate(unit.angle);
                }
                
                this.ctx.beginPath();
                if (unit.isAirplane) {
                    // Draw airplane as arrow pointing forward (or sideways if landed)
                    if (unit.landed) {
                        // Landed: draw sideways
                        this.ctx.moveTo(0, -size); // Top point
                        this.ctx.lineTo(-size * 0.5, size * 0.3); // Left back
                        this.ctx.lineTo(0, size * 0.3); // Back center
                        this.ctx.lineTo(size * 0.5, size * 0.3); // Right back
                        this.ctx.closePath();
                    } else {
                        // Flying: draw as arrow pointing forward
                        this.ctx.moveTo(size, 0); // Front point
                        this.ctx.lineTo(-size * 0.5, -size * 0.5); // Top back
                        this.ctx.lineTo(-size * 0.3, 0); // Back center
                        this.ctx.lineTo(-size * 0.5, size * 0.5); // Bottom back
                        this.ctx.closePath();
                    }
                } else {
                    // Helicopter - triangle pointing up
                    this.ctx.moveTo(0, -size);
                    this.ctx.lineTo(-size, size);
                    this.ctx.lineTo(size, size);
                    this.ctx.closePath();
                }
                this.ctx.fill();

                // Player color border
                this.ctx.strokeStyle = unit.owner.color;
                this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.restore();
        } else if (unit.stats.category === 'naval') {
            // Naval units - draw as elongated rectangle (ship shape)
            this.ctx.fillStyle = unitColor;
            const navalWidth = size * 1.5;
            const navalHeight = size * 0.8;
            this.ctx.fillRect(unit.x - navalWidth / 2, unit.y - navalHeight / 2, navalWidth, navalHeight);
            
            // Submarine indicator (periscope)
            if (unit.isSubmarine) {
                this.ctx.fillStyle = '#888';
                this.ctx.fillRect(unit.x - 2, unit.y - size - 3, 4, 6);
            }
            
            // Player color border
            this.ctx.strokeStyle = unit.owner.color;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(unit.x - navalWidth / 2, unit.y - navalHeight / 2, navalWidth, navalHeight);
        } else {
            this.ctx.fillStyle = unitColor;
            this.ctx.fillRect(unit.x - size / 2, unit.y - size / 2, size, size);

            // Player color border
            this.ctx.strokeStyle = unit.owner.color;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(unit.x - size / 2, unit.y - size / 2, size, size);
        }

        // Enhanced selection indicator
        if (unit.selected) {
            // Outer glow
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(unit.x, unit.y, size + 3, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Inner selection circle
            this.ctx.strokeStyle = unit.owner.color;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(unit.x, unit.y, size + 1, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Selection indicator at top
            this.ctx.fillStyle = unit.owner.color;
            this.ctx.fillRect(unit.x - 4, unit.y - size - 8, 8, 4);
        }

        // Health bar
        this.renderHealthBar(unit.x - size, unit.y - size - 8, size * 2, unit.getHealthPercent());
        
        // Veterancy stars and other overlays
        this.renderUnitOverlays(unit, size);
    }
    
    /**
     * Render unit overlays (health bar, selection, veterancy, etc.)
     * Called after sprite or fallback rendering
     */
    renderUnitOverlays(unit, size = null) {
        if (size === null) {
            size = (unit.stats.size || 1) * 15;
        }

        // Selection indicator (for units with sprites)
        if (unit.selected) {
            // Outer glow
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(unit.x, unit.y, size + 3, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Inner selection circle
            this.ctx.strokeStyle = unit.owner.color;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(unit.x, unit.y, size + 1, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Selection indicator at top
            this.ctx.fillStyle = unit.owner.color;
            this.ctx.fillRect(unit.x - 4, unit.y - size - 8, 8, 4);
        }

        // Health bar
        this.renderHealthBar(unit.x - size, unit.y - size - 8, size * 2, unit.getHealthPercent());

        // Veterancy stars
        if (unit.veterancy > 0) {
            this.ctx.fillStyle = '#ff0';
            this.ctx.font = '10px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('★'.repeat(unit.veterancy), unit.x, unit.y + size + 12);
        }

        // Transport capacity indicator
        if (unit.isTransport) {
            const embarkedCount = unit.getEmbarkedCount();
            const capacity = unit.getTransportCapacity();
            if (embarkedCount > 0) {
                this.ctx.fillStyle = '#0f0';
                this.ctx.font = '10px monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`${embarkedCount}/${capacity}`, unit.x, unit.y - size - 12);
            }
        }
        
        // Harvester cargo
        if (unit.isHarvester && unit.cargo > 0) {
            this.ctx.fillStyle = '#d4af37';
            this.ctx.font = '8px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(Math.floor(unit.cargo), unit.x, unit.y + size + 20);
        }

        // Path visualization (for selected units)
        if (unit.selected && unit.path && unit.path.length > 0) {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.setLineDash([3, 3]);
            this.ctx.beginPath();
            this.ctx.moveTo(unit.x, unit.y);

            for (let i = unit.pathIndex; i < unit.path.length; i++) {
                const node = unit.path[i];
                const pos = tileToWorld(node.x, node.y);
                this.ctx.lineTo(pos.x, pos.y);
            }

            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
    }

    renderHealthBar(x, y, width, percent) {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(x, y, width, 4);

        if (percent > 0.6) {
            this.ctx.fillStyle = '#0f0';
        } else if (percent > 0.3) {
            this.ctx.fillStyle = '#ff0';
        } else {
            this.ctx.fillStyle = '#f00';
        }

        this.ctx.fillRect(x, y, width * percent, 4);
    }

    // Airplanes are now regular units, rendered in renderUnits()

    renderEffects() {
        // Visual effects are now handled by EffectsManager
        // This method kept for backward compatibility
    }

    renderPlacementGhost() {
        if (!this.game.placingBuilding) return;

        const mouseWorldX = this.game.input.mouseWorldX;
        const mouseWorldY = this.game.input.mouseWorldY;
        const mouseTile = worldToTile(mouseWorldX, mouseWorldY);

        const stats = BUILDING_TYPES[this.game.placingBuilding];
        if (!stats) return;

        const px = mouseTile.x * TILE_SIZE;
        const py = mouseTile.y * TILE_SIZE;
        const w = stats.width * TILE_SIZE;
        const h = stats.height * TILE_SIZE;

        // Check if PORT can be placed on water
        let canPlace = false;
        if (this.game.placingBuilding === 'PORT') {
            const canPlaceOnWater = this.game.map.isWater(mouseTile.x, mouseTile.y);
            const hasAdjacentWater = this.game.map.hasAdjacentWater(mouseTile.x, mouseTile.y, stats.width, stats.height);
            if (canPlaceOnWater || hasAdjacentWater) {
                canPlace = canPlaceBuilding(this.game.map, mouseTile.x, mouseTile.y, stats.width, stats.height, this.game.humanPlayer, this.game, true);
            }
        } else {
            canPlace = canPlaceBuilding(this.game.map, mouseTile.x, mouseTile.y, stats.width, stats.height, this.game.humanPlayer, this.game);
        }

        // Enhanced visual feedback
        this.ctx.fillStyle = canPlace ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)';
        this.ctx.fillRect(px, py, w, h);

        // Draw grid overlay for better placement visualization
        this.ctx.strokeStyle = canPlace ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)';
        this.ctx.lineWidth = 1;
        for (let ty = 0; ty < stats.height; ty++) {
            for (let tx = 0; tx < stats.width; tx++) {
                this.ctx.strokeRect(px + tx * TILE_SIZE, py + ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }

        // Border
        this.ctx.strokeStyle = canPlace ? '#0f0' : '#f00';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(px, py, w, h);

        // Building name and cost
        this.ctx.fillStyle = canPlace ? '#0f0' : '#f00';
        this.ctx.font = 'bold 12px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(stats.name, px + w / 2, py + h / 2 - 5);
        
        this.ctx.font = '10px monospace';
        this.ctx.fillText(`$${stats.cost}`, px + w / 2, py + h / 2 + 10);

        // Show reason if can't place
        if (!canPlace && this.game.humanPlayer) {
            let reason = '';
            if (!this.game.humanPlayer.canAfford(stats.cost)) {
                reason = 'Insufficient funds';
            } else if (stats.powerConsume > 0 && this.game.humanPlayer.hasLowPower()) {
                reason = 'Low power';
            } else {
                reason = 'Invalid location';
            }
            this.ctx.fillStyle = '#f00';
            this.ctx.font = '10px monospace';
            this.ctx.fillText(reason, px + w / 2, py - 10);
        }
    }

    renderUI() {
        // Selection box
        const selectionBox = this.game.input.getSelectionBox();
        if (selectionBox) {
            this.ctx.strokeStyle = '#0f0';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(
                selectionBox.x - this.game.camera.x,
                selectionBox.y - this.game.camera.y,
                selectionBox.w,
                selectionBox.h
            );
        }

        // Active power indicator
        if (this.game.activePower) {
            const config = SPECIAL_POWERS[this.game.activePower];
            this.ctx.fillStyle = 'rgba(255, 153, 0, 0.3)';
            const radius = (config.radius || 5) * TILE_SIZE;

            this.ctx.beginPath();
            this.ctx.arc(
                this.game.input.mouseWorldX - this.game.camera.x,
                this.game.input.mouseWorldY - this.game.camera.y,
                radius,
                0,
                Math.PI * 2
            );
            this.ctx.fill();

            this.ctx.strokeStyle = '#f90';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    }

    renderMinimap() {
        const now = Date.now();
        
        // Throttle minimap updates to reduce overhead (80-90% performance improvement)
        if (now - this.lastMinimapUpdate < this.MINIMAP_UPDATE_INTERVAL) {
            return; // Skip update - still showing previous frame
        }
        this.lastMinimapUpdate = now;

        const ctx = this.minimapCtx;
        const w = this.minimapCanvas.width;
        const h = this.minimapCanvas.height;

        ctx.clearRect(0, 0, w, h);

        // Check if player has operational radar dome
        const hasRadarDome = this.game.buildings.some(b =>
            b.owner === this.game.humanPlayer &&
            b.stats.revealsMap &&
            b.isAlive() &&
            !b.isUnderConstruction &&
            b.isOperational
        );

        // Check if player has sufficient power
        const hasPower = this.game.humanPlayer && this.game.humanPlayer.getPowerRatio() >= 1;

        if (!hasRadarDome || !hasPower) {
            // Show static/disabled minimap (no radar or insufficient power)
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#333';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('RADAR OFFLINE', w / 2, h / 2 - 5);
            ctx.fillText('Build Radar Dome', w / 2, h / 2 + 10);
            return;
        }

        const scaleX = w / (this.game.map.width * TILE_SIZE);
        const scaleY = h / (this.game.map.height * TILE_SIZE);

        // Background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, w, h);

        // Cache terrain data (only rebuild if map changes)
        if (!this.minimapTerrainCache || this.game.map.width !== this.minimapTerrainCache.width || 
            this.game.map.height !== this.minimapTerrainCache.height) {
            // Build terrain cache
            this.minimapTerrainCache = {
                width: this.game.map.width,
                height: this.game.map.height,
                data: []
            };
            
            for (let y = 0; y < this.game.map.height; y += 2) {
                for (let x = 0; x < this.game.map.width; x += 2) {
                    const tile = this.game.map.getTile(x, y);
                    if (tile && (tile.terrain === 'water' || tile.terrain === 'rock')) {
                        this.minimapTerrainCache.data.push({
                            x: x * TILE_SIZE * scaleX,
                            y: y * TILE_SIZE * scaleY
                        });
                    }
                }
            }
        }

        // Render cached terrain (much faster than recalculating every frame)
        ctx.fillStyle = '#333';
        for (const terrain of this.minimapTerrainCache.data) {
            ctx.fillRect(terrain.x, terrain.y, 2, 2);
        }

        // Fog of War overlay
        if (this.game.humanPlayer) {
            for (let y = 0; y < this.game.map.height; y += 2) {
                for (let x = 0; x < this.game.map.width; x += 2) {
                    const tile = this.game.map.getTile(x, y);
                    if (!tile) continue;

                    const fogLevel = tile.fogOfWar[this.game.humanPlayer.id] || FOG_UNEXPLORED;

                    if (fogLevel === FOG_UNEXPLORED) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
                        ctx.fillRect(x * TILE_SIZE * scaleX, y * TILE_SIZE * scaleY, 2, 2);
                    } else if (fogLevel === FOG_EXPLORED) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                        ctx.fillRect(x * TILE_SIZE * scaleX, y * TILE_SIZE * scaleY, 2, 2);
                    }
                }
            }
        }

        // Buildings (only visible ones)
        for (const building of this.game.buildings) {
            // Check if visible to human player
            if (this.game.humanPlayer && building.owner !== this.game.humanPlayer) {
                const tile = this.game.map.getTile(building.tileX, building.tileY);
                if (!tile || tile.fogOfWar[this.game.humanPlayer.id] !== FOG_VISIBLE) {
                    continue; // Skip enemy buildings in fog of war
                }
            }

            ctx.fillStyle = building.owner.color;
            ctx.fillRect(
                building.tileX * TILE_SIZE * scaleX,
                building.tileY * TILE_SIZE * scaleY,
                building.stats.width * TILE_SIZE * scaleX,
                building.stats.height * TILE_SIZE * scaleY
            );
        }

        // Units (only visible ones)
        for (const unit of this.game.units) {
            // Check if visible to human player
            if (this.game.humanPlayer && unit.owner !== this.game.humanPlayer) {
                const tile = worldToTile(unit.x, unit.y);
                const mapTile = this.game.map.getTile(tile.x, tile.y);
                if (!mapTile || mapTile.fogOfWar[this.game.humanPlayer.id] !== FOG_VISIBLE) {
                    continue; // Skip enemy units in fog of war
                }
            }

            ctx.fillStyle = unit.owner.color;
            ctx.fillRect(
                unit.x * scaleX - 1,
                unit.y * scaleY - 1,
                2,
                2
            );
        }

        // Camera viewport
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(
            this.game.camera.x * scaleX,
            this.game.camera.y * scaleY,
            this.canvas.width * scaleX,
            this.canvas.height * scaleY
        );
    }

    isVisible(entity) {
        if (!this.game.humanPlayer) return true;
        
        // Check visibility cache first (if caching enabled)
        if (FRUSTUM_CULLING.CACHE_VISIBILITY) {
            const entityId = entity.id || `${entity.x},${entity.y},${entity.type}`;
            if (this.visibilityCache.has(entityId)) {
                return this.visibilityCache.get(entityId);
            }
        }
        
        // Early exit if frustum culling is disabled
        if (!FRUSTUM_CULLING.ENABLED) {
            // Still check fog of war if enabled
            let visible = true;
            if (FRUSTUM_CULLING.ENABLE_FOG_CHECK) {
                const tile = worldToTile(entity.x, entity.y);
                visible = this.game.map.isTileVisible(tile.x, tile.y, this.game.humanPlayer.id);
            }
            
            // Cache result if caching enabled
            if (FRUSTUM_CULLING.CACHE_VISIBILITY) {
                const entityId = entity.id || `${entity.x},${entity.y},${entity.type}`;
                this.visibilityCache.set(entityId, visible);
            }
            
            return visible;
        }

        // Enhanced frustum culling: Early exit for off-screen entities
        // This reduces draw calls by 20-40% on large maps
        const screenX = entity.x - this.game.camera.x;
        const screenY = entity.y - this.game.camera.y;
        const margin = FRUSTUM_CULLING.RENDER_MARGIN;
        
        // Early frustum cull - skip entities completely outside viewport
        if (screenX < -margin || screenX > this.canvas.width + margin ||
            screenY < -margin || screenY > this.canvas.height + margin) {
            
            // Cache result if caching enabled
            if (FRUSTUM_CULLING.CACHE_VISIBILITY) {
                const entityId = entity.id || `${entity.x},${entity.y},${entity.type}`;
                this.visibilityCache.set(entityId, false);
            }
            
            return false;
        }
        
        // Then check fog of war (if enabled)
        let visible = true;
        if (FRUSTUM_CULLING.ENABLE_FOG_CHECK) {
            const tile = worldToTile(entity.x, entity.y);
            visible = this.game.map.isTileVisible(tile.x, tile.y, this.game.humanPlayer.id);
            
            // CRITICAL FIX: Units in combat should always be visible, even in fog
            // This prevents invisible units that can still be attacked
            if (!visible && entity instanceof Unit) {
                // Check if unit is in combat (has target enemy or is being targeted)
                const isInCombat = entity.targetEnemy && entity.targetEnemy.isAlive();
                
                // Check if any player unit is targeting this enemy
                let isBeingTargeted = false;
                if (entity.owner !== this.game.humanPlayer) {
                    for (const unit of this.game.units) {
                        if (unit.owner === this.game.humanPlayer && 
                            unit.targetEnemy === entity && 
                            unit.isAlive()) {
                            isBeingTargeted = true;
                            break;
                        }
                    }
                    // Also check buildings (turrets)
                    if (!isBeingTargeted) {
                        for (const building of this.game.buildings) {
                            if (building.owner === this.game.humanPlayer && 
                                building.targetEnemy === entity && 
                                building.isAlive()) {
                                isBeingTargeted = true;
                                break;
                            }
                        }
                    }
                }
                
                // If unit is in combat or being targeted, make it visible
                if (isInCombat || isBeingTargeted) {
                    visible = true;
                }
            }
        }
        
        // Cache result if caching enabled
        if (FRUSTUM_CULLING.CACHE_VISIBILITY) {
            const entityId = entity.id || `${entity.x},${entity.y},${entity.type}`;
            this.visibilityCache.set(entityId, visible);
        }
        
        return visible;
    }

    blendColors(color1, color2, ratio = 0.6) {
        // Convert hex to RGB
        const c1 = {
            r: parseInt(color1.slice(1, 3), 16),
            g: parseInt(color1.slice(3, 5), 16),
            b: parseInt(color1.slice(5, 7), 16),
        };
        const c2 = {
            r: parseInt(color2.slice(1, 3), 16),
            g: parseInt(color2.slice(3, 5), 16),
            b: parseInt(color2.slice(5, 7), 16),
        };

        // Blend
        const r = Math.floor(c1.r * ratio + c2.r * (1 - ratio));
        const g = Math.floor(c1.g * ratio + c2.g * (1 - ratio));
        const b = Math.floor(c1.b * ratio + c2.b * (1 - ratio));

        // Convert back to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
}
