// Player class

class Player {
    constructor(id, name, color, isAI = false) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.isAI = isAI;
        this.credits = 5000;
        this.powerGenerated = 0;
        this.powerConsumed = 0;
        this.unlockedTiers = [1];
        this.specialPowers = {
            recon: { cooldown: 0, available: true },
            airstrike: { cooldown: 0, available: false },
            superweapon: { cooldown: 0, available: false },
        };
        this.defeated = false;
    }

    canAfford(cost) {
        return this.credits >= cost;
    }

    spend(amount) {
        if (this.canAfford(amount)) {
            this.credits -= amount;
            return true;
        }
        return false;
    }

    earnCredits(amount) {
        this.credits += amount;
    }

    updatePower(buildings) {
        this.powerGenerated = 0;
        this.powerConsumed = 0;

        for (const building of buildings) {
            if (building.owner !== this || !building.isAlive()) continue;

            this.powerGenerated += building.stats.powerGenerate || 0;
            this.powerConsumed += building.stats.powerConsume || 0;
        }
    }

    getPowerRatio() {
        if (this.powerConsumed === 0) return 1;
        return Math.min(1, this.powerGenerated / this.powerConsumed);
    }

    hasLowPower() {
        return this.getPowerRatio() < 1;
    }

    updateTechTree(buildings) {
        const hadTier2 = this.unlockedTiers.includes(2);
        const hadTier3 = this.unlockedTiers.includes(3);

        // Check for tech unlocks
        for (const building of buildings) {
            if (building.owner !== this || !building.isAlive()) continue;

            if (building.stats.unlocks === 'tier2' && !this.unlockedTiers.includes(2)) {
                this.unlockedTiers.push(2);
            }

            if (building.stats.unlocks === 'tier3' && !this.unlockedTiers.includes(3)) {
                this.unlockedTiers.push(3);
            }

            // Unlock airstrike with airfield
            if (building.stats.produces && building.stats.produces.includes('air')) {
                this.specialPowers.airstrike.available = true;
            }

            // Unlock superweapon
            if (building.stats.isSuperweapon) {
                this.specialPowers.superweapon.available = true;
            }
        }

        // Notify on new tier unlocks
        if (!hadTier2 && this.unlockedTiers.includes(2) && !this.isAI) {
            showNotification('Tier 2 Technology Unlocked!');
        }
        if (!hadTier3 && this.unlockedTiers.includes(3) && !this.isAI) {
            showNotification('Tier 3 Technology Unlocked!');
        }
    }

    canBuild(type, isUnit = false) {
        const stats = isUnit ? UNIT_TYPES[type] : BUILDING_TYPES[type];
        if (!stats) return false;

        // Check tier
        if (!this.unlockedTiers.includes(stats.tier)) return false;

        // Check cost
        if (!this.canAfford(stats.cost)) return false;

        // Check power for buildings - can't build if power is insufficient
        if (!isUnit && stats.powerConsume > 0) {
            if (this.hasLowPower()) {
                return false;
            }
        }

        return true;
    }

    canUsePower(powerType) {
        const power = this.specialPowers[powerType];
        if (!power || !power.available) return false;

        const config = SPECIAL_POWERS[powerType];
        if (config.cost && !this.canAfford(config.cost)) return false;

        if (power.cooldown > 0) return false;

        return true;
    }

    usePower(powerType) {
        const power = this.specialPowers[powerType];
        const config = SPECIAL_POWERS[powerType];

        if (!this.canUsePower(powerType)) return false;

        if (config.cost) {
            this.spend(config.cost);
        }

        power.cooldown = config.cooldown;
        return true;
    }

    updatePowerCooldowns(deltaTime) {
        for (const powerType in this.specialPowers) {
            const power = this.specialPowers[powerType];
            if (power.cooldown > 0) {
                power.cooldown = Math.max(0, power.cooldown - deltaTime);
            }
        }
    }

    getOwnedEntities(units, buildings) {
        return {
            units: units.filter(u => u.owner === this),
            buildings: buildings.filter(b => b.owner === this),
        };
    }

    hasHQ(buildings) {
        return buildings.some(b => b.owner === this && b.stats.isHQ && b.isAlive());
    }
}
