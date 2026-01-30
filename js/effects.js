// Visual Effects System for Combat Feedback

class EffectsManager {
    constructor(game) {
        this.game = game;
        this.damageNumbers = []; // Array of {x, y, damage, color, lifetime, age}
        this.projectiles = []; // Array of {x, y, targetX, targetY, speed, color, lifetime}
        this.muzzleFlashes = []; // Array of {x, y, angle, lifetime, age}
        this.deathAnimations = []; // Array of {x, y, type, lifetime, age}
        this.teslaEffects = []; // Array of {x, y, targetX, targetY, lifetime, age, segments}
        this.ionCannonEffects = []; // Array of {x, y, radius, lifetime, age, chargeTime, phase}
        
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
            aa: '#00ffff',
            tesla: '#00ffff' // Tesla uses cyan/blue color
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

    addTeslaEffect(fromX, fromY, toX, toY) {
        // Create a lightning bolt effect with multiple segments
        const segments = [];
        const numSegments = 8;
        const dx = toX - fromX;
        const dy = toY - fromY;
        
        // Create jagged lightning path
        for (let i = 0; i <= numSegments; i++) {
            const t = i / numSegments;
            const baseX = fromX + dx * t;
            const baseY = fromY + dy * t;
            
            // Add random offset for jagged effect
            const offsetX = (Math.random() - 0.5) * 15;
            const offsetY = (Math.random() - 0.5) * 15;
            
            segments.push({
                x: baseX + offsetX,
                y: baseY + offsetY
            });
        }
        
        const effect = {
            x: fromX,
            y: fromY,
            targetX: toX,
            targetY: toY,
            segments: segments,
            lifetime: 200, // Short duration for lightning effect
            age: 0
        };
        
        this.teslaEffects.push(effect);
    }

    addIonCannonEffect(x, y, radius, chargeTime) {
        const effect = {
            x: x,
            y: y,
            radius: radius * TILE_SIZE, // Convert to world coordinates
            lifetime: chargeTime + 1000, // Charge time + 1 second for explosion
            age: 0,
            chargeTime: chargeTime,
            phase: 'charging' // 'charging' or 'explosion'
        };
        
        this.ionCannonEffects.push(effect);
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

        // Update Tesla effects
        for (let i = this.teslaEffects.length - 1; i >= 0; i--) {
            const effect = this.teslaEffects[i];
            effect.age += deltaTime;
            
            if (effect.age >= effect.lifetime) {
                this.teslaEffects.splice(i, 1);
            }
        }

        // Update Ion Cannon effects
        for (let i = this.ionCannonEffects.length - 1; i >= 0; i--) {
            const effect = this.ionCannonEffects[i];
            effect.age += deltaTime;
            
            // Transition from charging to explosion phase
            if (effect.phase === 'charging' && effect.age >= effect.chargeTime) {
                effect.phase = 'explosion';
            }
            
            if (effect.age >= effect.lifetime) {
                this.ionCannonEffects.splice(i, 1);
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

        // Render Tesla Coil lightning effects
        for (const tesla of this.teslaEffects) {
            const alpha = 1 - (tesla.age / tesla.lifetime);
            const flicker = Math.random() * 0.3 + 0.7; // Random flicker for lightning effect
            
            ctx.save();
            ctx.globalAlpha = alpha * flicker;
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00ffff';
            
            // Draw jagged lightning path
            ctx.beginPath();
            ctx.moveTo(tesla.segments[0].x, tesla.segments[0].y);
            for (let i = 1; i < tesla.segments.length; i++) {
                ctx.lineTo(tesla.segments[i].x, tesla.segments[i].y);
            }
            ctx.stroke();
            
            // Add bright core
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Add glow effect at impact point
            const lastSegment = tesla.segments[tesla.segments.length - 1];
            ctx.globalAlpha = alpha * 0.5;
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(lastSegment.x, lastSegment.y, 8, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }

        // Render Ion Cannon effects
        const ionConfig = EFFECTS_CONFIG.ION_CANNON;
        for (const ion of this.ionCannonEffects) {
            const progress = ion.age / ion.lifetime;
            const chargeProgress = ion.age / ion.chargeTime;
            
            ctx.save();
            
            if (ion.phase === 'charging') {
                // Charging phase: growing circle with pulsing effect
                const pulse = Math.sin(chargeProgress * Math.PI * 4) * 0.3 + 0.7; // Pulsing effect
                const currentRadius = (ion.radius * 0.3) * chargeProgress * pulse;
                
                // Outer glow
                ctx.globalAlpha = (1 - chargeProgress * 0.5) * 0.6;
                ctx.fillStyle = '#00ffff';
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#00ffff';
                ctx.beginPath();
                ctx.arc(ion.x, ion.y, currentRadius, 0, Math.PI * 2);
                ctx.fill();
                
                // Inner core
                ctx.globalAlpha = (1 - chargeProgress * 0.3) * 0.9;
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 30;
                ctx.shadowColor = '#ffffff';
                ctx.beginPath();
                ctx.arc(ion.x, ion.y, currentRadius * 0.6, 0, Math.PI * 2);
                ctx.fill();
                
                // Energy particles (sparkles)
                ctx.globalAlpha = 0.8;
                ctx.fillStyle = '#00ffff';
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2 + chargeProgress * Math.PI * 2;
                    const dist = currentRadius * 0.8;
                    const px = ion.x + Math.cos(angle) * dist;
                    const py = ion.y + Math.sin(angle) * dist;
                    ctx.beginPath();
                    ctx.arc(px, py, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                // Explosion phase: expanding blast with shockwave
                const explosionProgress = (ion.age - ion.chargeTime) / (ion.lifetime - ion.chargeTime);
                const currentRadius = ion.radius * explosionProgress;
                const maxRadius = ion.radius;
                
                // Outer shockwave
                ctx.globalAlpha = (1 - explosionProgress) * 0.8;
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 8;
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#00ffff';
                ctx.beginPath();
                ctx.arc(ion.x, ion.y, currentRadius, 0, Math.PI * 2);
                ctx.stroke();
                
                // Main explosion
                const explosionAlpha = Math.min(1, (1 - explosionProgress * 0.7));
                ctx.globalAlpha = explosionAlpha;
                const gradient = ctx.createRadialGradient(ion.x, ion.y, 0, ion.x, ion.y, currentRadius);
                gradient.addColorStop(0, '#ffffff');
                gradient.addColorStop(0.3, '#00ffff');
                gradient.addColorStop(0.6, '#0088ff');
                gradient.addColorStop(1, 'rgba(0, 136, 255, 0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(ion.x, ion.y, currentRadius, 0, Math.PI * 2);
                ctx.fill();
                
                // Inner bright core
                ctx.globalAlpha = explosionAlpha * 0.9;
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#ffffff';
                ctx.beginPath();
                ctx.arc(ion.x, ion.y, currentRadius * 0.4, 0, Math.PI * 2);
                ctx.fill();
                
                // Energy rings
                for (let ring = 0; ring < 3; ring++) {
                    const ringProgress = (explosionProgress + ring * 0.2) % 1;
                    const ringRadius = currentRadius * ringProgress;
                    ctx.globalAlpha = (1 - ringProgress) * 0.5;
                    ctx.strokeStyle = '#00ffff';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(ion.x, ion.y, ringRadius, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            
            ctx.restore();
        }
    }
}
