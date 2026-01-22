// Visual Effects System for Combat Feedback

class EffectsManager {
    constructor(game) {
        this.game = game;
        this.damageNumbers = []; // Array of {x, y, damage, color, lifetime, age}
        this.projectiles = []; // Array of {x, y, targetX, targetY, speed, color, lifetime}
        this.muzzleFlashes = []; // Array of {x, y, angle, lifetime, age}
        this.deathAnimations = []; // Array of {x, y, type, lifetime, age}
        
        // Object pooling for effects (optional - can be enabled via config)
        this.usePooling = POOLING_CONFIG.ENABLE_EFFECTS_POOLING;
        if (this.usePooling && typeof EffectsPool !== 'undefined') {
            this.pool = new EffectsPool();
        }
    }

    addDamageNumber(x, y, damage, isCritical = false) {
        const config = EFFECTS_CONFIG.DAMAGE_NUMBER;
        
        let num;
        if (this.usePooling && this.pool) {
            num = this.pool.damageNumbers.acquire();
            num.x = x;
            num.y = y;
            num.damage = Math.floor(damage);
            num.color = isCritical ? config.COLOR_CRITICAL : config.COLOR_NORMAL;
            num.lifetime = config.LIFETIME;
            num.age = 0;
            num.velocityY = config.BASE_VELOCITY;
            num.scale = isCritical ? config.CRITICAL_SIZE_MULTIPLIER : 1.0;
        } else {
            num = {
                x: x,
                y: y,
                damage: Math.floor(damage),
                color: isCritical ? config.COLOR_CRITICAL : config.COLOR_NORMAL,
                lifetime: config.LIFETIME,
                age: 0,
                velocityY: config.BASE_VELOCITY, // Float upward
                scale: isCritical ? config.CRITICAL_SIZE_MULTIPLIER : 1.0
            };
        }
        this.damageNumbers.push(num);
    }

    addProjectile(fromX, fromY, toX, toY, damageType = 'bullet') {
        const colors = {
            bullet: '#ffff00',
            shell: '#ff8800',
            rocket: '#ff0000',
            explosive: '#ff6600',
            aa: '#00ffff'
        };
        const config = EFFECTS_CONFIG.PROJECTILE;
        
        let proj;
        if (this.usePooling && this.pool) {
            proj = this.pool.projectiles.acquire();
            proj.x = fromX;
            proj.y = fromY;
            proj.targetX = toX;
            proj.targetY = toY;
            proj.speed = config.SPEED;
            proj.color = colors[damageType] || '#ffff00';
            proj.lifetime = config.LIFETIME;
            proj.age = 0;
            proj.damageType = damageType;
        } else {
            proj = {
                x: fromX,
                y: fromY,
                targetX: toX,
                targetY: toY,
                speed: config.SPEED,
                color: colors[damageType] || '#ffff00',
                lifetime: config.LIFETIME,
                age: 0,
                damageType: damageType
            };
        }
        this.projectiles.push(proj);
    }

    addMuzzleFlash(x, y, angle) {
        const config = EFFECTS_CONFIG.MUZZLE_FLASH;
        
        let flash;
        if (this.usePooling && this.pool) {
            flash = this.pool.muzzleFlashes.acquire();
            flash.x = x;
            flash.y = y;
            flash.angle = angle;
            flash.lifetime = config.LIFETIME;
            flash.age = 0;
        } else {
            flash = {
                x: x,
                y: y,
                angle: angle,
                lifetime: config.LIFETIME,
                age: 0
            };
        }
        this.muzzleFlashes.push(flash);
    }

    addDeathAnimation(x, y, entityType) {
        const config = EFFECTS_CONFIG.DEATH_ANIMATION;
        
        let anim;
        if (this.usePooling && this.pool) {
            anim = this.pool.deathAnimations.acquire();
            anim.x = x;
            anim.y = y;
            anim.type = entityType;
            anim.lifetime = config.LIFETIME;
            anim.age = 0;
        } else {
            anim = {
                x: x,
                y: y,
                type: entityType, // 'unit', 'building'
                lifetime: config.LIFETIME,
                age: 0
            };
        }
        this.deathAnimations.push(anim);
    }

    update(deltaTime) {
        // Update damage numbers
        const damageConfig = EFFECTS_CONFIG.DAMAGE_NUMBER;
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const num = this.damageNumbers[i];
            num.age += deltaTime;
            num.y += num.velocityY * (deltaTime / 16); // Adjust for frame time
            num.velocityY *= damageConfig.VELOCITY_DECAY; // Slow down
            
            if (num.age >= num.lifetime) {
                // Release to pool if pooling enabled
                if (this.usePooling && this.pool) {
                    this.pool.damageNumbers.release(num);
                }
                this.damageNumbers.splice(i, 1);
            }
        }

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.age += deltaTime;
            
            const dx = proj.targetX - proj.x;
            const dy = proj.targetY - proj.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 5 || proj.age >= proj.lifetime) {
                // Reached target or expired
                // Release to pool if pooling enabled
                if (this.usePooling && this.pool) {
                    this.pool.projectiles.release(proj);
                }
                this.projectiles.splice(i, 1);
            } else {
                // Move towards target
                const moveDist = proj.speed * (deltaTime / 16);
                proj.x += (dx / dist) * moveDist;
                proj.y += (dy / dist) * moveDist;
            }
        }

        // Update muzzle flashes
        for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
            const flash = this.muzzleFlashes[i];
            flash.age += deltaTime;
            
            if (flash.age >= flash.lifetime) {
                // Release to pool if pooling enabled
                if (this.usePooling && this.pool) {
                    this.pool.muzzleFlashes.release(flash);
                }
                this.muzzleFlashes.splice(i, 1);
            }
        }

        // Update death animations
        for (let i = this.deathAnimations.length - 1; i >= 0; i--) {
            const anim = this.deathAnimations[i];
            anim.age += deltaTime;
            
            if (anim.age >= anim.lifetime) {
                // Release to pool if pooling enabled
                if (this.usePooling && this.pool) {
                    this.pool.deathAnimations.release(anim);
                }
                this.deathAnimations.splice(i, 1);
            }
        }
    }

    render(ctx, camera) {
        // NOTE: Context is already translated by camera in renderer.js, so use world coordinates directly
        // Render damage numbers
        for (const num of this.damageNumbers) {
            const alpha = 1 - (num.age / num.lifetime);
            
            const config = EFFECTS_CONFIG.DAMAGE_NUMBER;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = num.color;
            ctx.font = `${config.BASE_SIZE * num.scale}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`-${num.damage}`, num.x, num.y);
            ctx.restore();
        }

        // Render projectiles
        const projConfig = EFFECTS_CONFIG.PROJECTILE;
        for (const proj of this.projectiles) {
            ctx.save();
            ctx.fillStyle = proj.color;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, projConfig.SIZE, 0, Math.PI * 2);
            ctx.fill();
            
            // Add trail effect
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, projConfig.TRAIL_SIZE, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Render muzzle flashes
        const flashConfig = EFFECTS_CONFIG.MUZZLE_FLASH;
        for (const flash of this.muzzleFlashes) {
            const alpha = 1 - (flash.age / flash.lifetime);
            
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(flash.x, flash.y);
            ctx.rotate(flash.angle);
            ctx.fillStyle = flashConfig.COLOR;
            ctx.fillRect(-flashConfig.WIDTH / 2, -flashConfig.HEIGHT / 2, flashConfig.WIDTH, flashConfig.HEIGHT);
            ctx.restore();
        }

        // Render death animations
        const deathConfig = EFFECTS_CONFIG.DEATH_ANIMATION;
        for (const anim of this.deathAnimations) {
            const progress = anim.age / anim.lifetime;
            const size = (1 - progress) * deathConfig.MAX_SIZE; // Shrink over time
            
            ctx.save();
            ctx.globalAlpha = 1 - progress;
            ctx.fillStyle = deathConfig.COLOR;
            
            if (anim.type === 'unit') {
                ctx.beginPath();
                ctx.arc(anim.x, anim.y, size, 0, Math.PI * 2);
                ctx.fill();
            } else if (anim.type === 'building') {
                ctx.fillRect(anim.x - size, anim.y - size, size * 2, size * 2);
            }
            
            ctx.restore();
        }
    }
}
