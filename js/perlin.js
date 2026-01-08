// Perlin noise implementation for procedural map generation

class PerlinNoise {
    constructor(seed = Math.random()) {
        this.seed = seed;
        this.permutation = this.generatePermutation(seed);
        this.p = [...this.permutation, ...this.permutation]; // Duplicate for overflow
    }

    generatePermutation(seed) {
        // Generate deterministic permutation based on seed
        const p = [];
        for (let i = 0; i < 256; i++) {
            p[i] = i;
        }

        // Fisher-Yates shuffle with seeded random
        let random = this.seededRandom(seed);
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [p[i], p[j]] = [p[j], p[i]];
        }

        return p;
    }

    seededRandom(seed) {
        // Simple seeded random number generator
        let value = seed;
        return () => {
            value = (value * 9301 + 49297) % 233280;
            return value / 233280;
        };
    }

    fade(t) {
        // Smooth interpolation curve (6t^5 - 15t^4 + 10t^3)
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }

    grad(hash, x, y) {
        // Convert hash to gradient direction
        const h = hash & 3;
        const u = h < 2 ? x : y;
        const v = h < 2 ? y : x;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise(x, y) {
        // Find unit square containing point
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        // Find relative x, y in square
        x -= Math.floor(x);
        y -= Math.floor(y);

        // Compute fade curves
        const u = this.fade(x);
        const v = this.fade(y);

        // Hash coordinates of square corners
        const a = this.p[X] + Y;
        const aa = this.p[a];
        const ab = this.p[a + 1];
        const b = this.p[X + 1] + Y;
        const ba = this.p[b];
        const bb = this.p[b + 1];

        // Blend results from corners
        return this.lerp(v,
            this.lerp(u, this.grad(this.p[aa], x, y), this.grad(this.p[ba], x - 1, y)),
            this.lerp(u, this.grad(this.p[ab], x, y - 1), this.grad(this.p[bb], x - 1, y - 1))
        );
    }

    octaveNoise(x, y, octaves, persistence, scale) {
        // Layered noise for more natural results
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            total += this.noise(x * frequency / scale, y * frequency / scale) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }

        return total / maxValue;
    }
}

// Height map generator using layered Perlin noise
class HeightMapGenerator {
    constructor(width, height, seed = Math.random()) {
        this.width = width;
        this.height = height;
        this.perlin = new PerlinNoise(seed);
        this.heightMap = [];
    }

    generate(mapType) {
        // Get configuration for map type
        const config = MAP_GENERATION.HEIGHTMAP_CONFIG[mapType] || MAP_GENERATION.HEIGHTMAP_CONFIG.standard;

        // Generate base height map
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const nx = x / this.width;
                const ny = y / this.height;

                // Generate layered noise
                let elevation = this.perlin.octaveNoise(
                    x, y,
                    config.octaves,
                    config.persistence,
                    config.scale
                );

                // Normalize to 0-1 range
                elevation = (elevation + 1) / 2;

                // Apply island effect if enabled (circular falloff from center)
                if (config.islandEffect > 0) {
                    const dx = nx - 0.5;
                    const dy = ny - 0.5;
                    const distance = Math.sqrt(dx * dx + dy * dy) * 2; // 0-1+ range
                    const falloff = Math.pow(distance, config.islandEffect);
                    elevation = Math.max(0, elevation - falloff);
                }

                // Apply redistribution curve for more dramatic terrain
                elevation = Math.pow(elevation, config.redistributionPower);

                this.heightMap.push(elevation);
            }
        }

        return this.heightMap;
    }

    getHeight(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return 0;
        }
        return this.heightMap[y * this.width + x];
    }

    getTerrainType(x, y, mapType) {
        const height = this.getHeight(x, y);
        const thresholds = MAP_GENERATION.TERRAIN_THRESHOLDS[mapType] || MAP_GENERATION.TERRAIN_THRESHOLDS.standard;

        if (height < thresholds.water) {
            return 'water';
        } else if (height > thresholds.mountain) {
            return 'rock';
        } else if (height > thresholds.hill) {
            return 'grass'; // Could be higher elevation grass
        } else {
            return 'grass';
        }
    }

    isValidLandTile(x, y, mapType) {
        const terrain = this.getTerrainType(x, y, mapType);
        return terrain === 'grass'; // Only grass is valid for spawning/building
    }

    findValidSpawnArea(centerX, centerY, radius, mapType) {
        // Find a clear area of valid land tiles
        const requiredClearTiles = 9; // 3x3 area minimum

        for (let searchRadius = 0; searchRadius < radius; searchRadius++) {
            for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
                const testX = Math.floor(centerX + Math.cos(angle) * searchRadius);
                const testY = Math.floor(centerY + Math.sin(angle) * searchRadius);

                // Check if 3x3 area around this point is all valid land
                let validCount = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (this.isValidLandTile(testX + dx, testY + dy, mapType)) {
                            validCount++;
                        }
                    }
                }

                if (validCount >= requiredClearTiles) {
                    return { x: testX, y: testY };
                }
            }
        }

        return null;
    }

    getResourceSuitability(x, y, mapType) {
        // Resources prefer certain elevation ranges (not too high, not in water)
        const height = this.getHeight(x, y);
        const thresholds = MAP_GENERATION.TERRAIN_THRESHOLDS[mapType] || MAP_GENERATION.TERRAIN_THRESHOLDS.standard;

        // Resources avoid water and mountains
        if (height < thresholds.water || height > thresholds.mountain) {
            return 0;
        }

        // Prefer mid-elevation areas
        const idealHeight = (thresholds.water + thresholds.hill) / 2;
        const deviation = Math.abs(height - idealHeight);
        return Math.max(0, 1 - deviation * 2);
    }
}
