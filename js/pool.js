// Object Pooling System for frequently created/destroyed objects

class ObjectPool {
    constructor(createFn, resetFn, initialSize = 10) {
        this.createFn = createFn; // Function to create new object
        this.resetFn = resetFn; // Function to reset object state for reuse
        this.pool = []; // Array of pooled objects
        this.active = new Set(); // Set of currently active objects
        
        // Pre-populate pool
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
        }
    }
    
    acquire() {
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            obj = this.createFn();
        }
        this.active.add(obj);
        return obj;
    }
    
    release(obj) {
        if (!this.active.has(obj)) {
            return; // Already released
        }
        this.active.delete(obj);
        this.resetFn(obj);
        this.pool.push(obj);
    }
    
    releaseAll() {
        for (const obj of this.active) {
            this.resetFn(obj);
            this.pool.push(obj);
        }
        this.active.clear();
    }
    
    getActiveCount() {
        return this.active.size;
    }
    
    getPoolSize() {
        return this.pool.length;
    }
}

// Specialized pools for common effect types
class EffectsPool {
    constructor() {
        const config = POOLING_CONFIG || {};
        
        // Damage number pool
        this.damageNumbers = new ObjectPool(
            () => ({ x: 0, y: 0, damage: 0, color: '#ffff00', lifetime: 0, age: 0, velocityY: 0, scale: 1.0 }),
            (obj) => {
                obj.x = 0;
                obj.y = 0;
                obj.damage = 0;
                obj.color = '#ffff00';
                obj.lifetime = 0;
                obj.age = 0;
                obj.velocityY = 0;
                obj.scale = 1.0;
            },
            config.DAMAGE_NUMBER_POOL_SIZE || 20
        );
        
        // Projectile pool
        this.projectiles = new ObjectPool(
            () => ({ x: 0, y: 0, targetX: 0, targetY: 0, speed: 0, color: '#ffff00', lifetime: 0, age: 0, damageType: 'bullet' }),
            (obj) => {
                obj.x = 0;
                obj.y = 0;
                obj.targetX = 0;
                obj.targetY = 0;
                obj.speed = 0;
                obj.color = '#ffff00';
                obj.lifetime = 0;
                obj.age = 0;
                obj.damageType = 'bullet';
            },
            config.PROJECTILE_POOL_SIZE || 15
        );
        
        // Muzzle flash pool
        this.muzzleFlashes = new ObjectPool(
            () => ({ x: 0, y: 0, angle: 0, lifetime: 0, age: 0 }),
            (obj) => {
                obj.x = 0;
                obj.y = 0;
                obj.angle = 0;
                obj.lifetime = 0;
                obj.age = 0;
            },
            config.MUZZLE_FLASH_POOL_SIZE || 10
        );
        
        // Death animation pool
        this.deathAnimations = new ObjectPool(
            () => ({ x: 0, y: 0, type: 'unit', lifetime: 0, age: 0 }),
            (obj) => {
                obj.x = 0;
                obj.y = 0;
                obj.type = 'unit';
                obj.lifetime = 0;
                obj.age = 0;
            },
            config.DEATH_ANIMATION_POOL_SIZE || 10
        );
    }
}
