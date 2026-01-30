// Base entity class

let nextEntityId = 0;

class Entity {
    constructor(x, y, type, stats, owner) {
        this.id = nextEntityId++;
        this.x = x;
        this.y = y;
        this.type = type;
        this.stats = { ...stats };
        this.owner = owner;
        this.hp = stats.hp;
        this.maxHp = stats.hp;
        this.selected = false;
        this.veterancy = 0;
        this.kills = 0;
    }

    takeDamage(damage, game = null) {
        const wasAlive = this.isAlive();
        const wasHealthy = this.hp > this.maxHp * 0.5; // Consider "healthy" if above 50% HP
        
        this.hp -= damage;
        if (this.hp <= 0) {
            this.hp = 0;
            
            // Notify if entity was destroyed and belongs to human player
            if (wasAlive && game && notificationManager && this.owner && !this.owner.isAI) {
                if (this instanceof Unit) {
                    notificationManager.showUnitLost(this);
                } else if (this instanceof Building) {
                    notificationManager.showBuildingDestroyed(this);
                }
            }
            
            return true; // Entity destroyed
        }
        
        // Notify if entity is being attacked (first time taking damage or significant damage)
        if (game && notificationManager && this.owner && !this.owner.isAI) {
            // Only notify if entity was healthy before (to avoid spam on already damaged entities)
            // Or if this is the first significant hit (bringing HP below 50%)
            if (wasHealthy && this.hp <= this.maxHp * 0.5) {
                if (this instanceof Unit) {
                    notificationManager.showUnitAttacked(this);
                } else if (this instanceof Building) {
                    notificationManager.showBuildingAttacked(this);
                }
            }
        }
        
        return false;
    }

    heal(amount) {
        this.hp = Math.min(this.hp + amount, this.maxHp);
    }

    gainExperience() {
        this.kills++;
        if (this.kills >= 3 && this.veterancy === 0) {
            this.veterancy = 1;
            this.applyVeterancyBonus();
        } else if (this.kills >= 7 && this.veterancy === 1) {
            this.veterancy = 2;
            this.applyVeterancyBonus();
        } else if (this.kills >= 12 && this.veterancy === 2) {
            this.veterancy = 3;
            this.applyVeterancyBonus();
        }
    }

    applyVeterancyBonus() {
        // Increase stats by 10% per rank
        const bonus = 1.1;
        this.maxHp = Math.floor(this.maxHp * bonus);
        this.hp = Math.min(this.hp, this.maxHp);

        if (this.stats.damage) {
            this.stats.damage = Math.floor(this.stats.damage * bonus);
        }
    }

    getHealthPercent() {
        return this.hp / this.maxHp;
    }

    update(deltaTime, game) {
        // Override in subclasses
    }

    isAlive() {
        return this.hp > 0;
    }
}
