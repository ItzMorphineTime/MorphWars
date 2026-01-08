// Game constants and configuration

const TILE_SIZE = 32;
const VIEWPORT_PADDING = 50;

// Player colors
const PLAYER_COLORS = [
    '#00ff00', // Green (Player)
    '#ff0000', // Red (AI 1)
    '#0000ff', // Blue (AI 2)
    '#ffff00', // Yellow (AI 3)
];

// Unit type colors (for visual distinction)
const UNIT_TYPE_COLORS = {
    infantry: '#90EE90',      // Light green
    vehicle: '#FFD700',       // Gold
    air: '#87CEEB',          // Sky blue
    harvester: '#FFA500',    // Orange
    builder: '#FF69B4',      // Hot pink
};

const BUILDING_TYPE_COLORS = {
    HQ: '#FFD700',           // Gold
    POWER_PLANT: '#FFFF00',  // Yellow
    REFINERY: '#FFA500',     // Orange
    BARRACKS: '#90EE90',     // Light green
    WAR_FACTORY: '#FFD700',  // Gold
    TECH_CENTER: '#00CED1',  // Dark turquoise
    AIRFIELD: '#87CEEB',     // Sky blue
    ADVANCED_TECH: '#9370DB', // Medium purple
    GUN_TURRET: '#FF6347',   // Tomato red
    AA_TURRET: '#FF4500',    // Orange red
    SUPERWEAPON: '#FF1493',  // Deep pink
};

// Fog of war
const FOG_UNEXPLORED = 0;
const FOG_EXPLORED = 1;
const FOG_VISIBLE = 2;
const SIGHT_RANGE = 8;

// Unit types and stats
const UNIT_TYPES = {
    // Construction
    MCV: {
        name: 'MCV',
        cost: 2000,
        hp: 600,
        speed: 1.0,
        sight: 6,
        buildTime: 20,
        isBuilder: true,
        armor: 'heavy',
        category: 'vehicle',
        tier: 1,
        size: 2,
    },
    HARVESTER: {
        name: 'Harvester',
        cost: 1400,
        hp: 800,
        speed: 1.2,
        sight: 5,
        buildTime: 14,
        isHarvester: true,
        cargo: 0,
        maxCargo: 700,
        armor: 'heavy',
        category: 'vehicle',
        tier: 1,
        size: 2,
    },

    // Infantry (T1)
    RIFLEMAN: {
        name: 'Rifleman',
        cost: 100,
        hp: 50,
        speed: 2.0,
        sight: 6,
        buildTime: 3,
        damage: 8,
        attackSpeed: 1.0,
        range: 4,
        damageType: 'bullet',
        armor: 'none',
        category: 'infantry',
        tier: 1,
        size: 0.5,
    },
    ROCKET_SOLDIER: {
        name: 'Rocket Soldier',
        cost: 300,
        hp: 60,
        speed: 1.8,
        sight: 6,
        buildTime: 5,
        damage: 30,
        attackSpeed: 2.0,
        range: 6,
        damageType: 'rocket',
        armor: 'none',
        category: 'infantry',
        tier: 1,
        size: 0.5,
    },
    MEDIC: {
        name: 'Medic',
        cost: 200,
        hp: 50,
        speed: 2.0,
        sight: 6,
        buildTime: 4,
        healRate: 10,
        healRange: 2,
        armor: 'none',
        category: 'infantry',
        tier: 1,
        size: 0.5,
        isMedic: true,
    },
    GRENADIER: {
        name: 'Grenadier',
        cost: 350,
        hp: 70,
        speed: 1.8,
        sight: 6,
        buildTime: 6,
        damage: 40,
        attackSpeed: 2.5,
        range: 5,
        damageType: 'explosive',
        splashRadius: 2,
        friendlyFire: true,
        armor: 'none',
        category: 'infantry',
        tier: 2,
        size: 0.5,
    },

    // Vehicles (T1)
    LIGHT_TANK: {
        name: 'Light Tank',
        cost: 700,
        hp: 300,
        speed: 2.5,
        sight: 6,
        buildTime: 8,
        damage: 30,
        attackSpeed: 1.5,
        range: 5,
        damageType: 'shell',
        armor: 'light',
        category: 'vehicle',
        tier: 1,
        size: 1.5,
    },

    // Vehicles (T2)
    MEDIUM_TANK: {
        name: 'Medium Tank',
        cost: 950,
        hp: 450,
        speed: 2.0,
        sight: 6,
        buildTime: 11,
        damage: 50,
        attackSpeed: 1.8,
        range: 5,
        damageType: 'shell',
        armor: 'medium',
        category: 'vehicle',
        tier: 2,
        size: 1.8,
    },
    APC: {
        name: 'APC',
        cost: 800,
        hp: 200,
        speed: 3.0,
        sight: 6,
        buildTime: 9,
        damage: 15,
        attackSpeed: 0.8,
        range: 4,
        damageType: 'bullet',
        armor: 'light',
        category: 'vehicle',
        tier: 2,
        size: 1.5,
    },

    // Vehicles (T3)
    HEAVY_TANK: {
        name: 'Heavy Tank',
        cost: 1500,
        hp: 700,
        speed: 1.5,
        sight: 6,
        buildTime: 16,
        damage: 85,
        attackSpeed: 2.5,
        range: 6,
        damageType: 'shell',
        armor: 'heavy',
        category: 'vehicle',
        tier: 3,
        size: 2,
    },
    ARTILLERY: {
        name: 'Artillery',
        cost: 1200,
        hp: 150,
        speed: 1.2,
        sight: 7,
        buildTime: 14,
        damage: 120,
        attackSpeed: 4.0,
        range: 10,
        damageType: 'explosive',
        armor: 'light',
        category: 'vehicle',
        tier: 3,
        size: 1.5,
    },

    // Air units
    HELICOPTER: {
        name: 'Helicopter',
        cost: 1200,
        hp: 180,
        speed: 4.0,
        sight: 8,
        buildTime: 12,
        damage: 45,
        attackSpeed: 1.2,
        range: 5,
        damageType: 'rocket',
        armor: 'light',
        category: 'air',
        tier: 2,
        size: 1.5,
        maxAmmo: 10,
        ignoresCollision: true,
    },
};

// Building types and stats
const BUILDING_TYPES = {
    HQ: {
        name: 'HQ',
        cost: 0,
        hp: 1500,
        buildTime: 0,
        powerGenerate: 100,
        powerConsume: 0,
        sight: 8,
        width: 3,
        height: 3,
        tier: 1,
        isHQ: true,
    },
    POWER_PLANT: {
        name: 'Power Plant',
        cost: 300,
        hp: 400,
        buildTime: 10,
        powerGenerate: 100,
        powerConsume: 0,
        sight: 4,
        width: 2,
        height: 2,
        tier: 1,
    },
    REFINERY: {
        name: 'Refinery',
        cost: 2000,
        hp: 900,
        buildTime: 20,
        powerGenerate: 0,
        powerConsume: 30,
        sight: 5,
        width: 3,
        height: 2,
        tier: 1,
        isRefinery: true,
    },
    BARRACKS: {
        name: 'Barracks',
        cost: 300,
        hp: 500,
        buildTime: 12,
        powerGenerate: 0,
        powerConsume: 20,
        sight: 5,
        width: 2,
        height: 2,
        tier: 1,
        produces: ['infantry'],
    },
    WAR_FACTORY: {
        name: 'War Factory',
        cost: 2000,
        hp: 1000,
        buildTime: 25,
        powerGenerate: 0,
        powerConsume: 40,
        sight: 5,
        width: 3,
        height: 3,
        tier: 1,
        produces: ['vehicle'],
    },
    TECH_CENTER: {
        name: 'Tech Center',
        cost: 1500,
        hp: 600,
        buildTime: 20,
        powerGenerate: 0,
        powerConsume: 50,
        sight: 5,
        width: 2,
        height: 2,
        tier: 1,
        unlocks: 'tier2',
    },
    AIRFIELD: {
        name: 'Airfield',
        cost: 2500,
        hp: 800,
        buildTime: 22,
        powerGenerate: 0,
        powerConsume: 50,
        sight: 6,
        width: 3,
        height: 2,
        tier: 2,
        produces: ['air'],
    },
    ADVANCED_TECH: {
        name: 'Advanced Tech',
        cost: 3000,
        hp: 700,
        buildTime: 30,
        powerGenerate: 0,
        powerConsume: 75,
        sight: 5,
        width: 2,
        height: 2,
        tier: 2,
        unlocks: 'tier3',
    },
    GUN_TURRET: {
        name: 'Gun Turret',
        cost: 600,
        hp: 400,
        buildTime: 8,
        powerGenerate: 0,
        powerConsume: 20,
        sight: 7,
        width: 1,
        height: 1,
        tier: 1,
        damage: 25,
        attackSpeed: 1.0,
        range: 7,
        damageType: 'shell',
        isDefense: true,
    },
    AA_TURRET: {
        name: 'AA Turret',
        cost: 800,
        hp: 350,
        buildTime: 9,
        powerGenerate: 0,
        powerConsume: 25,
        sight: 8,
        width: 1,
        height: 1,
        tier: 2,
        damage: 40,
        attackSpeed: 0.8,
        range: 9,
        damageType: 'aa',
        isDefense: true,
    },
    SUPERWEAPON: {
        name: 'Ion Cannon',
        cost: 5000,
        hp: 800,
        buildTime: 40,
        powerGenerate: 0,
        powerConsume: 100,
        sight: 6,
        width: 2,
        height: 2,
        tier: 3,
        isSuperweapon: true,
    },
    REPAIR_BAY: {
        name: 'Repair Bay',
        cost: 1200,
        hp: 600,
        buildTime: 15,
        powerGenerate: 0,
        powerConsume: 30,
        sight: 5,
        width: 2,
        height: 2,
        tier: 1,
        repairRate: 5,
        repairRange: 3,
        isRepairBay: true,
        allowsUnitsOnTop: true,  // Units can walk on repair bay to heal
    },
    RADAR_DOME: {
        name: 'Radar Dome',
        cost: 1000,
        hp: 500,
        buildTime: 12,
        powerGenerate: 0,
        powerConsume: 40,
        sight: 10,
        width: 2,
        height: 2,
        tier: 1,
        revealsMap: true,
    },
};

// Damage multipliers
const DAMAGE_MULTIPLIERS = {
    bullet: { none: 1.0, light: 0.5, medium: 0.3, heavy: 0.2 },
    rocket: { none: 0.8, light: 1.2, medium: 1.0, heavy: 0.8 },
    shell: { none: 0.5, light: 1.0, medium: 1.2, heavy: 1.0 },
    explosive: { none: 1.5, light: 1.2, medium: 1.3, heavy: 1.0 },
    aa: { none: 0.3, light: 0.5, medium: 0.3, heavy: 0.2 },
};

// Special power definitions
const SPECIAL_POWERS = {
    recon: {
        name: 'Recon Sweep',
        cost: 500,
        cooldown: 60000, // 60 seconds
        revealRadius: 15,
        duration: 5000,
    },
    airstrike: {
        name: 'Airstrike',
        cost: 1000,
        cooldown: 120000, // 120 seconds
        damage: 200,
        radius: 3,
        requiresTier: 2,
    },
    superweapon: {
        name: 'Ion Cannon',
        cost: 0,
        cooldown: 300000, // 300 seconds
        damage: 1000,
        radius: 5,
        requiresBuilding: 'SUPERWEAPON',
        chargeTime: 5000,
    },
};

// AI configuration
const AI_CONFIG = {
    easy: {
        updateInterval: 6000,
        expansionDelay: 180000,
        attackThreshold: 8,
        maxUnitLimit: 20,        // Full assault when reached
        scoutInterval: 60000,     // Scout every 60s
        spreadInterval: 15000,    // Spread units every 15s
        economyFocus: 0.7,
        militaryFocus: 0.3,
    },
    medium: {
        updateInterval: 4000,
        expansionDelay: 120000,
        attackThreshold: 12,
        maxUnitLimit: 30,        // Full assault when reached
        scoutInterval: 45000,     // Scout every 45s
        spreadInterval: 12000,    // Spread units every 12s
        economyFocus: 0.6,
        militaryFocus: 0.4,
    },
    hard: {
        updateInterval: 2000,
        expansionDelay: 90000,
        attackThreshold: 15,
        maxUnitLimit: 40,        // Full assault when reached
        scoutInterval: 30000,     // Scout every 30s
        spreadInterval: 10000,    // Spread units every 10s
        economyFocus: 0.5,
        militaryFocus: 0.5,
    },
};

// Collision system configuration
const COLLISION_CONFIG = {
    COOLDOWN_MS: 1500,              // Pause 1500ms after collision
    MAX_COLLISIONS: 5,              // Stop after 5 collisions
    MAX_DESTINATION_CHANGES: 3,     // Stop after 3 destination changes
    SEARCH_RADIUS: 10,              // Search radius for alternate destinations (tiles)
};

// Debug logging toggles
const DEBUG_LOGGING = {
    PLAYER_MOVEMENT: true,         // Player unit movement and collision logs
    AI_MOVEMENT: false,             // AI unit movement and collision logs
    AI_SCOUTING: true,              // AI scouting behavior logs
    AI_SPREADING: true,             // AI unit spreading logs
    AI_ATTACKING: true,             // AI attack decision logs
};

// Unit behavior constants
const UNIT_BEHAVIOR = {
    STUCK_CHECK_INTERVAL: 5000,     // Check if harvester is stuck every 5 seconds
    STUCK_MOVEMENT_THRESHOLD: 2,    // Minimum distance to move in 5 seconds to not be stuck
    STUCK_COUNT_THRESHOLD: 2,       // Number of stuck checks before taking action
    REPATH_COOLDOWN: 1000,          // Minimum time between repath attempts (ms)
    ATTACK_COOLDOWN_MULTIPLIER: 1000, // Multiply attack speed by this for cooldown in ms
    COMBAT_PATH_COOLDOWN: 500,      // Minimum time between combat pathfinding (ms)
    TARGET_SEARCH_COOLDOWN: 1000,   // Minimum time between enemy searches (ms)
};

// AI behavior constants
const AI_BEHAVIOR = {
    MASS_ATTACK_COOLDOWN: 30000,    // Cooldown between mass attacks (30 seconds)
    MASS_ATTACK_REJOIN_INTERVAL: 5000, // Send idle units to rejoin every 5 seconds
    MASS_ATTACK_END_THRESHOLD: 10,  // End mass attack when units fall below this number
    EXPANSION_CREDIT_THRESHOLD: 3000, // Credits needed to consider expansion
    SUPERWEAPON_CREDIT_THRESHOLD: 5000, // Credits needed to build superweapon
};

// Pathfinding constants
const PATHFINDING = {
    MAX_ITERATIONS: 10000,            // Maximum pathfinding iterations before giving up
    CARDINAL_ONLY: true,            // Only use cardinal directions (no diagonals) for performance
};

// Map generation constants
const MAP_GENERATION = {
    TYPES: {
        STANDARD: 'standard',           // Balanced mix of terrain
        DESERT: 'desert',               // More rock obstacles, sparse resources
        ISLANDS: 'islands',             // More water, isolated land masses
        PLAINS: 'plains',               // Minimal obstacles, many resources
        HIGHLANDS: 'highlands',         // Heavy rock formations, strategic chokepoints
    },
    DEFAULT_TYPE: 'standard',

    // Heightmap configuration for Perlin noise generation
    HEIGHTMAP_CONFIG: {
        standard: {
            octaves: 4,                 // Number of noise layers
            persistence: 0.5,           // Amplitude decay per octave
            scale: 80,                  // Noise frequency scale
            redistributionPower: 1.2,   // Exponent for height redistribution
            islandEffect: 0,            // No island effect (0 = disabled)
        },
        desert: {
            octaves: 5,
            persistence: 0.6,
            scale: 60,
            redistributionPower: 1.5,   // More extreme elevation changes
            islandEffect: 0,
        },
        islands: {
            octaves: 4,
            persistence: 0.5,
            scale: 70,
            redistributionPower: 1.3,
            islandEffect: 1.0,          // Strong island effect
        },
        plains: {
            octaves: 3,
            persistence: 0.4,
            scale: 100,                 // Larger, smoother features
            redistributionPower: 0.9,   // Flatter terrain
            islandEffect: 0,
        },
        highlands: {
            octaves: 6,
            persistence: 0.7,
            scale: 50,
            redistributionPower: 2.0,   // Very dramatic elevation
            islandEffect: 0,
        },
    },

    // Terrain height thresholds (0-1 range from heightmap)
    TERRAIN_THRESHOLDS: {
        standard: {
            water: 0.35,                // Below this = water
            hill: 0.65,                 // Above this = hills
            mountain: 0.70,             // Above this = mountains/rock
        },
        desert: {
            water: 0.25,                // Less water
            hill: 0.55,
            mountain: 0.70,             // Lower mountain threshold
        },
        islands: {
            water: 0.50,                // Much more water
            hill: 0.70,
            mountain: 0.85,
        },
        plains: {
            water: 0.30,
            hill: 0.75,                 // Higher hill threshold (flatter)
            mountain: 0.90,             // Rare mountains
        },
        highlands: {
            water: 0.20,
            hill: 0.250,                 // Lower hill threshold
            mountain: 0.3,             // More mountains
        },
    },

    RESOURCE_MULTIPLIER: {
        standard: 1.0,
        desert: 0.7,                    // 30% fewer resources
        islands: 0.8,                   // 20% fewer resources
        plains: 1.5,                    // 50% more resources
        highlands: 0.9,                 // 10% fewer resources
    },
};

// Resource constants
const RESOURCE_CONFIG = {
    HARVESTING_RATE: 5,                 // Resources harvested per update (was 10)
    REGENERATION_RATE: 100,             // Resources regenerated per 30s
    REGENERATION_INTERVAL: 30000,       // Regeneration interval in ms

    // Resource node types
    NODE_TYPES: {
        ORE: {
            name: 'Ore',
            color: '#FFA500',           // Orange
            minValue: 5000,
            maxValue: 10000,
            baseValue: 1,               // Credits per resource unit
        },
        GEMS: {
            name: 'Gems',
            color: '#00FFFF',           // Cyan
            minValue: 3000,
            maxValue: 6000,
            baseValue: 2,               // Credits per resource unit (2x value)
        },
    },

    GEM_SPAWN_CHANCE: 0.25,             // 25% chance for a resource node to be gems
};

// Construction constants
const CONSTRUCTION_CONFIG = {
    BASE_SPEED: 1.0,                    // Base construction speed multiplier
    LOW_POWER_PENALTY: 0.25,            // 75% slower when power < 100%
    HIGH_POWER_BONUS: 1.5,              // 50% faster when power > 150%
};
