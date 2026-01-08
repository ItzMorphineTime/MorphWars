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

    takeDamage(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.hp = 0;
            return true; // Entity destroyed
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
