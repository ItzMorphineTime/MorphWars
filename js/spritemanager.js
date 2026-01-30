// Sprite Manager - Handles sprite loading, caching, and sprite sheet parsing

class SpriteManager {
    constructor() {
        this.spriteCache = new Map(); // path -> Image
        this.sheetCache = new Map();  // path -> {frames: Map, image: Image, config: Object}
        this.loadingPromises = new Map(); // path -> Promise (prevents duplicate loads)
        this.failedSprites = new Set(); // Track failed loads to avoid retrying
    }
    
    /**
     * Load a single sprite image
     * @param {string} path - Path to sprite image
     * @returns {Promise<Image>} Promise that resolves to loaded image
     */
    async loadSprite(path) {
        // Return cached sprite if available
        if (this.spriteCache.has(path)) {
            return this.spriteCache.get(path);
        }
        
        // Return existing loading promise if already loading
        if (this.loadingPromises.has(path)) {
            return this.loadingPromises.get(path);
        }
        
        // Skip if we know this sprite failed to load
        if (this.failedSprites.has(path)) {
            return null;
        }
        
        // Create loading promise
        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                this.spriteCache.set(path, img);
                this.loadingPromises.delete(path);
                resolve(img);
            };
            
            img.onerror = () => {
                console.warn(`[SpriteManager] Failed to load sprite: ${path}`);
                this.failedSprites.add(path);
                this.loadingPromises.delete(path);
                resolve(null); // Resolve with null instead of rejecting (graceful fallback)
            };
            
            img.src = path;
        });
        
        this.loadingPromises.set(path, promise);
        return promise;
    }
    
    /**
     * Load a sprite sheet and parse frames
     * @param {string} path - Path to sprite sheet image
     * @param {Object} config - Sprite sheet configuration
     * @returns {Promise<Object>} Promise that resolves to {image, frames}
     */
    async loadSpriteSheet(path, config) {
        // Return cached sheet if available
        if (this.sheetCache.has(path)) {
            return this.sheetCache.get(path);
        }
        
        // Load the base image
        const image = await this.loadSprite(path);
        if (!image) {
            return null;
        }
        
        // Parse frames based on config type
        const frames = new Map();
        
        if (config.type === 'grid') {
            // Grid-based sprite sheet
            const frameWidth = config.frameWidth;
            const frameHeight = config.frameHeight;
            
            if (config.frames) {
                // Parse defined frame groups
                for (const [frameName, frameDef] of Object.entries(config.frames)) {
                    const startX = frameDef.x * frameWidth;
                    const startY = frameDef.y * frameHeight;
                    const count = frameDef.count || 1;
                    
                    // Always create base frame name (for single-frame animations)
                    frames.set(frameName, {
                        x: startX,
                        y: startY,
                        width: frameWidth,
                        height: frameHeight
                    });
                    
                    // Create indexed frames for multi-frame animations
                    for (let i = 0; i < count; i++) {
                        const frameKey = `${frameName}_${i}`;
                        frames.set(frameKey, {
                            x: startX + (i * frameWidth),
                            y: startY,
                            width: frameWidth,
                            height: frameHeight
                        });
                    }
                }
            } else {
                // Auto-detect frames (if no config provided)
                const cols = Math.floor(image.width / frameWidth);
                const rows = Math.floor(image.height / frameHeight);
                
                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        const frameKey = `frame_${row}_${col}`;
                        frames.set(frameKey, {
                            x: col * frameWidth,
                            y: row * frameHeight,
                            width: frameWidth,
                            height: frameHeight
                        });
                    }
                }
            }
        } else if (config.type === 'json') {
            // JSON metadata-based sprite sheet (future implementation)
            console.warn('[SpriteManager] JSON sprite sheets not yet implemented');
            return null;
        }
        
        const sheetData = {
            image: image,
            frames: frames,
            config: config
        };
        
        this.sheetCache.set(path, sheetData);
        return sheetData;
    }
    
    /**
     * Get a sprite from cache (synchronous)
     * Returns null if not loaded yet
     * @param {string} path - Path to sprite
     * @returns {Image|null} Cached image or null
     */
    getSprite(path) {
        return this.spriteCache.get(path) || null;
    }
    
    /**
     * Get a frame from a sprite sheet
     * @param {string} sheetPath - Path to sprite sheet
     * @param {string} frameName - Name of frame to get
     * @returns {Object|null} Frame data {x, y, width, height, image} or null
     */
    getFrame(sheetPath, frameName) {
        const sheet = this.sheetCache.get(sheetPath);
        if (!sheet) {
            return null;
        }
        
        const frameData = sheet.frames.get(frameName);
        if (!frameData) {
            return null;
        }
        
        return {
            ...frameData,
            image: sheet.image
        };
    }
    
    /**
     * Check if a sprite is loaded and available
     * @param {string} path - Path to sprite
     * @returns {boolean} True if sprite is loaded
     */
    hasSprite(path) {
        return this.spriteCache.has(path);
    }
    
    /**
     * Check if a sprite failed to load
     * @param {string} path - Path to sprite
     * @returns {boolean} True if sprite failed to load
     */
    hasFailed(path) {
        return this.failedSprites.has(path);
    }
    
    /**
     * Preload multiple sprites
     * @param {Array<Object>} spriteConfigs - Array of sprite configurations
     * @param {Function} onProgress - Optional progress callback (loaded, total)
     * @returns {Promise<void>} Promise that resolves when all sprites are loaded
     */
    async preloadSprites(spriteConfigs, onProgress = null) {
        const total = spriteConfigs.length;
        let loaded = 0;
        
        const promises = spriteConfigs.map(async (config) => {
            try {
                if (config.sheet) {
                    await this.loadSpriteSheet(config.sheet.path, config.sheet);
                } else if (config.path) {
                    await this.loadSprite(config.path);
                }
                loaded++;
                if (onProgress) {
                    onProgress(loaded, total);
                }
            } catch (error) {
                console.warn(`[SpriteManager] Failed to preload sprite:`, config, error);
            }
        });
        
        await Promise.all(promises);
    }
    
    /**
     * Clear sprite cache (useful for memory management)
     */
    clearCache() {
        this.spriteCache.clear();
        this.sheetCache.clear();
        this.failedSprites.clear();
    }
}
