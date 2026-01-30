// Sprite Renderer - Handles sprite drawing with rotation, animation, and effects

class SpriteRenderer {
    constructor(spriteManager, ctx) {
        this.spriteManager = spriteManager;
        this.ctx = ctx;
    }
    
    /**
     * Render a unit sprite
     * @param {Unit} unit - Unit to render
     * @param {Object} camera - Camera object {x, y}
     * @returns {boolean} True if sprite was rendered, false if fallback needed
     */
    renderUnit(unit, camera) {
        const spriteConfig = unit.stats?.sprite;
        if (!spriteConfig) {
            return false; // No sprite config, use fallback
        }
        
        // Check if using sprite sheet or single sprite
        let image = null;
        let frameData = null;
        
        if (spriteConfig.sheet) {
            // Sprite sheet - get current animation frame
            const animationState = this.getAnimationState(unit);
            const frameName = this.getFrameName(unit, animationState, spriteConfig);
            frameData = this.spriteManager.getFrame(spriteConfig.sheet.path, frameName);
            
            if (!frameData) {
                // Try to load the sheet if not cached
                // For now, return false to use fallback (async loading will happen in background)
                if (!this.spriteManager.hasSprite(spriteConfig.sheet.path) && 
                    !this.spriteManager.hasFailed(spriteConfig.sheet.path)) {
                    // Trigger async load
                    this.spriteManager.loadSpriteSheet(spriteConfig.sheet.path, spriteConfig.sheet);
                }
                return false;
            }
            
            image = frameData.image;
        } else if (spriteConfig.path) {
            // Single sprite
            image = this.spriteManager.getSprite(spriteConfig.path);
            
            if (!image) {
                // Try to load if not cached
                if (!this.spriteManager.hasFailed(spriteConfig.path)) {
                    this.spriteManager.loadSprite(spriteConfig.path);
                }
                return false;
            }
        } else {
            return false; // No valid sprite config
        }
        
        // Calculate sprite size
        const size = (unit.stats.size || 1) * 15;
        const spriteSize = spriteConfig.size || { width: size, height: size };
        const renderWidth = spriteSize.width || size;
        const renderHeight = spriteSize.height || size;
        
        // Calculate rotation angle
        let angle = 0;
        if (spriteConfig.rotation?.enabled) {
            angle = this.getUnitAngle(unit, spriteConfig.rotation);
        }
        
        // Draw sprite
        if (frameData) {
            // Draw from sprite sheet
            this.renderSpriteSheetFrame(
                image,
                frameData,
                unit.x,
                unit.y,
                angle,
                renderWidth,
                renderHeight,
                unit.owner.color,
                spriteConfig.tinting
            );
        } else {
            // Draw single sprite
            this.renderRotated(
                image,
                unit.x,
                unit.y,
                angle,
                renderWidth,
                renderHeight,
                unit.owner.color,
                spriteConfig.tinting
            );
        }
        
        return true; // Sprite rendered successfully
    }
    
    /**
     * Render a building sprite
     * @param {Building} building - Building to render
     * @param {Object} camera - Camera object {x, y}
     * @returns {boolean} True if sprite was rendered, false if fallback needed
     */
    renderBuilding(building, camera) {
        const spriteConfig = building.stats?.sprite;
        if (!spriteConfig) {
            return false; // No sprite config, use fallback
        }
        
        const px = building.tileX * TILE_SIZE;
        const py = building.tileY * TILE_SIZE;
        const w = building.stats.width * TILE_SIZE;
        const h = building.stats.height * TILE_SIZE;
        
        // Check if using sprite sheet (for construction animation)
        let image = null;
        let frameData = null;
        
        if (spriteConfig.sheet && building.isUnderConstruction) {
            // Use construction frame from sprite sheet
            const frameName = this.getBuildingFrameName(building, spriteConfig);
            frameData = this.spriteManager.getFrame(spriteConfig.sheet.path, frameName);
            
            // If indexed frame not found, try base frame name
            if (!frameData && building.animationFrame === 0) {
                frameData = this.spriteManager.getFrame(spriteConfig.sheet.path, 'building');
            }
            
            if (!frameData) {
                // Try to load the sheet if not cached
                if (!this.spriteManager.hasSheet(spriteConfig.sheet.path) && 
                    !this.spriteManager.hasFailed(spriteConfig.sheet.path)) {
                    this.spriteManager.loadSpriteSheet(spriteConfig.sheet.path, spriteConfig.sheet);
                }
                return false;
            }
            
            image = frameData.image;
        } else if (spriteConfig.path) {
            // Single sprite
            image = this.spriteManager.getSprite(spriteConfig.path);
            
            if (!image) {
                // Try to load if not cached
                if (!this.spriteManager.hasFailed(spriteConfig.path)) {
                    this.spriteManager.loadSprite(spriteConfig.path);
                }
                return false;
            }
        } else {
            return false; // No valid sprite config
        }
        
        // Draw base building sprite
        this.ctx.save();
        
        // Draw sprite first
        if (frameData) {
            // Draw from sprite sheet
            this.ctx.drawImage(
                image,
                frameData.x, frameData.y, frameData.width, frameData.height, // Source
                px, py, w, h // Destination
            );
        } else {
            // Draw single sprite
            this.ctx.drawImage(image, px, py, w, h);
        }
        
        // Apply player color tinting overlay if enabled
        if (spriteConfig.tinting?.enabled) {
            this.applyPlayerColorTint(building.owner.color, spriteConfig.tinting);
            // Draw tint overlay over the sprite
            this.ctx.fillRect(px, py, w, h);
            this.resetCompositeOperation();
        }
        
        this.ctx.restore();
        
        // Draw turret if building has one (always render, rotates to face target)
        if (spriteConfig.turret) {
            this.renderTurret(building, spriteConfig.turret, px, py, w, h);
        }
        
        return true; // Sprite rendered successfully
    }
    
    /**
     * Get frame name for building animation state
     */
    getBuildingFrameName(building, spriteConfig) {
        if (building.isUnderConstruction && spriteConfig.construction) {
            const maxFrames = spriteConfig.construction.frames || 4;
            const frameIndex = building.animationFrame;
            return `building_${frameIndex}`;
        }
        return 'idle';
    }
    
    /**
     * Render turret sprite (for buildings like gun turrets)
     * Turret sprites face downward by default, so we add Math.PI/2 offset
     */
    renderTurret(building, turretConfig, baseX, baseY, baseW, baseH) {
        const turretImage = this.spriteManager.getSprite(turretConfig.path);
        if (!turretImage) {
            // Try to load if not cached
            if (!this.spriteManager.hasFailed(turretConfig.path)) {
                this.spriteManager.loadSprite(turretConfig.path);
            }
            return;
        }
        
        // Calculate angle to target (use lastAttackDirection if available, otherwise calculate)
        let angle = building.lastAttackDirection || 0;
        if (building.targetEnemy) {
            const dx = building.targetEnemy.x - (baseX + baseW / 2);
            const dy = building.targetEnemy.y - (baseY + baseH / 2);
            angle = Math.atan2(dy, dx);
            // Sprites face 180 degrees wrong direction, so add Math.PI / 2 to correct
            angle -= Math.PI / 2;
            building.lastAttackDirection = angle; // Store for smooth rotation
        }

        // Get pivot point (default to center)
        const pivot = turretConfig.pivot || { x: baseW / 2, y: baseH / 2 };
        const pivotX = baseX + pivot.x;
        const pivotY = baseY + pivot.y;
        
        // Draw rotated turret (always render, even without target)
        this.ctx.save();
        this.ctx.translate(pivotX, pivotY);
        this.ctx.rotate(angle);
        
        const turretSize = turretConfig.size || { width: baseW, height: baseH };
        this.ctx.drawImage(
            turretImage,
            -turretSize.width / 2,
            -turretSize.height / 2,
            turretSize.width,
            turretSize.height
        );
        
        this.ctx.restore();
    }
    
    /**
     * Render a sprite with rotation
     */
    renderRotated(image, x, y, angle, width, height, playerColor = null, tinting = null) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);
        
        // Draw sprite first
        this.ctx.drawImage(
            image,
            -width / 2,
            -height / 2,
            width,
            height
        );
        
        // Apply player color tinting overlay if enabled
        if (tinting?.enabled && playerColor) {
            this.applyPlayerColorTint(playerColor, tinting);
            // Draw tint overlay over the sprite
            this.ctx.fillRect(-width / 2, -height / 2, width, height);
            this.resetCompositeOperation();
        }
        
        this.ctx.restore();
    }
    
    /**
     * Render a frame from a sprite sheet
     */
    renderSpriteSheetFrame(image, frameData, x, y, angle, width, height, playerColor = null, tinting = null) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);
        
        // Draw the specific frame from the sprite sheet first
        this.ctx.drawImage(
            image,
            frameData.x, frameData.y, frameData.width, frameData.height, // Source rectangle
            -width / 2, -height / 2, width, height // Destination rectangle
        );
        
        // Apply player color tinting overlay if enabled
        if (tinting?.enabled && playerColor) {
            this.applyPlayerColorTint(playerColor, tinting);
            // Draw tint overlay over the sprite
            this.ctx.fillRect(-width / 2, -height / 2, width, height);
            this.resetCompositeOperation();
        }
        
        this.ctx.restore();
    }
    
    /**
     * Apply player color tinting to canvas using composite operation
     * This method sets up the canvas for tinting, but the actual tinting
     * happens when drawing the sprite with the composite operation active.
     */
    applyPlayerColorTint(playerColor, tinting) {
        const method = tinting.method || 'multiply';
        const intensity = tinting.intensity !== undefined ? tinting.intensity : 0.5;
        
        if (method === 'multiply') {
            // Multiply blend mode - darker colors work better
            this.ctx.globalCompositeOperation = 'multiply';
            const rgb = this.hexToRgb(playerColor);
            // Create a semi-transparent overlay that will multiply with the sprite
            this.ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${1 - intensity})`;
        } else if (method === 'overlay') {
            // Overlay blend mode - preserves highlights and shadows
            this.ctx.globalCompositeOperation = 'overlay';
            const rgb = this.hexToRgb(playerColor);
            this.ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity})`;
        } else if (method === 'color') {
            // Color blend mode - replaces color while preserving luminance
            this.ctx.globalCompositeOperation = 'color';
            const rgb = this.hexToRgb(playerColor);
            this.ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity})`;
        } else if (method === 'screen') {
            // Screen blend mode - lighter colors work better
            this.ctx.globalCompositeOperation = 'screen';
            const rgb = this.hexToRgb(playerColor);
            this.ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity})`;
        }
    }
    
    /**
     * Reset canvas composite operation to default
     */
    resetCompositeOperation() {
        this.ctx.globalCompositeOperation = 'source-over';
    }
    
    /**
     * Get unit angle for rotation
     * Sprites face downward by default, so we add Math.PI/2 to rotate correctly
     * Supports smooth rotation interpolation
     */
    getUnitAngle(unit, rotationConfig) {
        // Use explicit angle if available (airplanes, helicopters)
        if (rotationConfig.useAngle && unit.angle !== undefined) {
            // Sprites face downward by default, so add Math.PI/2 offset
            const targetAngle = unit.angle + Math.PI / 2;
            // console.log('targetAngle from useAngle', targetAngle);
            return this.updateSmoothRotation(unit, targetAngle, rotationConfig);
        }
        
        // Priority 1: Face enemy target if attacking
        if (unit.targetEnemy && unit.targetEnemy.isAlive()) {
            const dx = unit.targetEnemy.x - unit.x;
            const dy = unit.targetEnemy.y - unit.y;
            let angle = Math.atan2(dy, dx);
            // Attack direction was 180 degrees wrong, so subtract Math.PI / 2 to correct
            angle -= Math.PI / 2;
            return this.updateSmoothRotation(unit, angle, rotationConfig);
        }
        
        // Priority 2: Calculate from movement direction
        // Use the current path target (pathIndex) instead of first tile to avoid drift
        if (unit.path && unit.path.length > 0 && unit.pathIndex !== undefined && unit.pathIndex < unit.path.length) {
            const currentTargetTile = unit.path[unit.pathIndex];
            // Convert tile coordinates to world coordinates
            const targetPos = tileToWorld(currentTargetTile.x, currentTargetTile.y);
            const dx = targetPos.x - unit.x;
            const dy = targetPos.y - unit.y;
            let angle = Math.atan2(dy, dx);
            
            // Movement direction was correct, so keep original offset
            // Sprites face downward by default, so add Math.PI/2 offset
            angle -= Math.PI / 2;
            // console.log('angle from movement direction', angle);
            // Snap to directions if configured
            if (rotationConfig.snapToDirections) {
                const snapCount = rotationConfig.snapToDirections;
                const snapAngle = (Math.PI * 2) / snapCount;
                angle = Math.round(angle / snapAngle) * snapAngle;
            }
            
            return this.updateSmoothRotation(unit, angle, rotationConfig);
        }
        
        // Default: maintain last angle (don't reset when stopped)
        // If no previous angle, default to facing right (which is Math.PI/2 from downward)
        if (unit.spriteAngle === undefined) {
            unit.spriteAngle = Math.PI / 2;
        }
        return unit.spriteAngle;
    }
    
    /**
     * Update smooth rotation for unit
     * Uses global SPRITE_ROTATION constants for all units
     * @param {Unit} unit - Unit to update
     * @param {number} targetAngle - Target angle in radians
     * @param {object} rotationConfig - Rotation configuration (unused, kept for compatibility)
     * @returns {number} Current angle (interpolated if smooth rotation enabled)
     */
    updateSmoothRotation(unit, targetAngle, rotationConfig) {
        // Initialize sprite angle if not set
        if (unit.spriteAngle === undefined) {
            unit.spriteAngle = targetAngle;
        }
        
        // Normalize angles to 0-2π range
        const normalizeAngle = (angle) => {
            while (angle < 0) angle += Math.PI * 2;
            while (angle >= Math.PI * 2) angle -= Math.PI * 2;
            return angle;
        };
        
        targetAngle = normalizeAngle(targetAngle);
        unit.spriteAngle = normalizeAngle(unit.spriteAngle);
        
        // Use global smooth rotation setting
        const smoothRotation = typeof SPRITE_ROTATION !== 'undefined' && SPRITE_ROTATION.SMOOTH_ROTATION;
        
        if (smoothRotation) {
            // Use global turn speed for all units
            const turnSpeed = (typeof SPRITE_ROTATION !== 'undefined' ? SPRITE_ROTATION.DEFAULT_TURN_SPEED : 0.15);
            
            // Calculate shortest rotation direction
            let angleDiff = targetAngle - unit.spriteAngle;
            if (angleDiff > Math.PI) {
                angleDiff -= Math.PI * 2;
            } else if (angleDiff < -Math.PI) {
                angleDiff += Math.PI * 2;
            }

            // Calculate new speed based on turn speed and unit speed
            let newSpeed = turnSpeed * unit.stats.speed;
            // if (unit.selected) {
            //     console.log('unit', unit);
            //     console.log('unit.stats.speed', unit.stats.speed);
            //     console.log('turnSpeed', turnSpeed);
            //     console.log('targetAngle', targetAngle);
            //     console.log('newSpeed', newSpeed);
            // }
            // Apply rotation
            const absTurnSpeed = Math.abs(newSpeed);
            if (Math.abs(angleDiff) < absTurnSpeed) {
                // Close enough, snap to target
                unit.spriteAngle = targetAngle;
            } else {
                // Rotate towards target
                unit.spriteAngle += Math.sign(angleDiff) * absTurnSpeed;
            }
            if (unit.selected) {
                console.log('unit.spriteAngle', unit.spriteAngle);
            }
            // Normalize again
            unit.spriteAngle = normalizeAngle(unit.spriteAngle);
        } else {
            // Instant rotation
            unit.spriteAngle = targetAngle;
        }
        
        return unit.spriteAngle;
    }
    
    /**
     * Get current animation state for unit
     */
    getAnimationState(unit) {
        if (unit.hp <= 0) return 'dying';
        if (unit.targetEnemy && unit.attackCooldown > 0) return 'attacking';
        if (unit.path && unit.path.length > 0) return 'moving';
        return 'idle';
    }
    
    /**
     * Get frame name for current animation state
     */
    getFrameName(unit, animationState, spriteConfig) {
        if (!spriteConfig || !spriteConfig.sheet) {
            return animationState;
        }
        
        const frameDef = spriteConfig.sheet.frames[animationState];
        if (!frameDef) {
            return animationState; // Fallback to state name
        }
        
        const count = frameDef.count || 1;
        
        // If multiple frames, append frame index
        if (count > 1) {
            return `${animationState}_${unit.animationFrame}`;
        } else {
            return animationState;
        }
    }
    
    /**
     * Convert hex color to RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
    }
}
