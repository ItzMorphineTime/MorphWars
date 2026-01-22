// Map Editor System

class MapEditor {
    constructor() {
        this.isActive = false;
        this.currentTool = 'terrain'; // 'terrain', 'resource', 'spawn', 'erase'
        this.currentTerrain = 'grass'; // 'grass', 'rock', 'water'
        this.currentResource = 'ore'; // 'ore', 'gems'
        this.map = null;
        this.canvas = null;
        this.ctx = null;
        this.camera = { x: 0, y: 0 };
        this.scale = 1.0;
        this.mapWidth = 150;
        this.mapHeight = 150;
        this.spawnPoints = []; // Array of {x, y, playerIndex}
        this.isDragging = false;
        this.lastPaintTile = null;
    }

    init() {
        // Create editor canvas if it doesn't exist
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'mapEditorCanvas';
            this.canvas.width = window.innerWidth - 300; // Leave room for toolbar
            this.canvas.height = window.innerHeight - 100;
            this.ctx = this.canvas.getContext('2d');
        }
        
        // Create empty map
        this.map = new GameMap(this.mapWidth, this.mapHeight, 'standard', true);
        // Don't generate terrain - we'll paint it manually
        for (const tile of this.map.tiles) {
            tile.terrain = 'grass';
            tile.blocked = false;
        }
        
        this.render();
    }

    setTool(tool) {
        this.currentTool = tool;
    }

    setTerrain(terrain) {
        this.currentTerrain = terrain;
    }

    setResource(resource) {
        this.currentResource = resource;
    }

    setMapSize(width, height) {
        this.mapWidth = width;
        this.mapHeight = height;
        this.map = new GameMap(width, height, 'standard', true);
        for (const tile of this.map.tiles) {
            tile.terrain = 'grass';
            tile.blocked = false;
        }
        this.spawnPoints = [];
        this.render();
    }

    worldToTile(worldX, worldY) {
        const x = Math.floor((worldX - this.camera.x) / (TILE_SIZE * this.scale));
        const y = Math.floor((worldY - this.camera.y) / (TILE_SIZE * this.scale));
        return { x, y };
    }
    
    setBrushSize(size) {
        this.brushSize = Math.max(1, Math.min(5, size));
    }
    
    toggleGrid() {
        this.showGrid = !this.showGrid;
        this.render();
        // Update button text
        const btn = document.getElementById('toggleGridBtn');
        if (btn) {
            btn.textContent = this.showGrid ? 'Toggle Grid (G) - ON' : 'Toggle Grid (G) - OFF';
        }
    }

    handleMouseDown(e) {
        if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
            // Middle mouse or Ctrl+Left = pan
            this.isPanning = true;
            this.lastPanX = e.clientX;
            this.lastPanY = e.clientY;
            e.preventDefault();
            return;
        } else if (e.button === 0 && !e.ctrlKey) {
            // Left click = paint (but not if Ctrl is held)
            this.isDragging = true;
            this.lastPaintTile = null; // Reset to allow painting on click
            // Immediately paint on click by calling handleMouseMove
            this.handleMouseMove(e);
        }
    }

    handleMouseMove(e) {
        if (this.isPanning) {
            const deltaX = e.clientX - this.lastPanX;
            const deltaY = e.clientY - this.lastPanY;
            this.camera.x += deltaX;
            this.camera.y += deltaY;
            this.lastPanX = e.clientX;
            this.lastPanY = e.clientY;
            this.render();
            return;
        }
        
        // Update hovered tile for preview
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const tile = this.worldToTile(mouseX, mouseY);
        this.hoveredTile = tile;
        
        // Always render to show hover preview, but only paint when dragging
        if (!this.isDragging) {
            this.render(); // Re-render to show hover preview
            return;
        }
        
        // Prevent painting same center tile multiple times in one drag
        if (this.lastPaintTile && this.lastPaintTile.x === tile.x && this.lastPaintTile.y === tile.y) {
            // Still render to show preview, but don't paint again
            this.render();
            return;
        }
        this.lastPaintTile = { x: tile.x, y: tile.y };
        
        // Paint with brush size
        const halfBrush = Math.floor(this.brushSize / 2);
        for (let dy = -halfBrush; dy <= halfBrush; dy++) {
            for (let dx = -halfBrush; dx <= halfBrush; dx++) {
                const brushX = tile.x + dx;
                const brushY = tile.y + dy;
                
                if (brushX < 0 || brushY < 0 || brushX >= this.mapWidth || brushY >= this.mapHeight) {
                    continue;
                }

                const mapTile = this.map.getTile(brushX, brushY);
                if (!mapTile) continue;

                if (this.currentTool === 'terrain') {
                    mapTile.terrain = this.currentTerrain;
                    mapTile.blocked = (this.currentTerrain === 'rock' || this.currentTerrain === 'water');
                } else if (this.currentTool === 'resource') {
                    // Remove existing resource at this location
                    this.map.resourceNodes = this.map.resourceNodes.filter(node => 
                        !(Math.abs(node.x - brushX) <= 1 && Math.abs(node.y - brushY) <= 1)
                    );
                    
                    // Add new resource node (only at center of brush)
                    if (dx === 0 && dy === 0) {
                        const nodeType = this.currentResource === 'gems' ? RESOURCE_CONFIG.NODE_TYPES.GEMS : RESOURCE_CONFIG.NODE_TYPES.ORE;
                        const initialResources = getRandomInt(nodeType.minValue, nodeType.maxValue);
                        this.map.resourceNodes.push({
                            x: brushX,
                            y: brushY,
                            type: this.currentResource,
                            resources: initialResources,
                            maxResources: nodeType.maxValue,
                            valueMultiplier: nodeType.baseValue,
                            color: nodeType.color,
                        });
                    }
                } else if (this.currentTool === 'spawn') {
                    // Spawn points are set via UI buttons, not by clicking
                } else if (this.currentTool === 'erase') {
                    if (mapTile.terrain !== 'grass') {
                        mapTile.terrain = 'grass';
                        mapTile.blocked = false;
                    }
                    // Remove resource nodes
                    this.map.resourceNodes = this.map.resourceNodes.filter(node => 
                        !(Math.abs(node.x - brushX) <= 1 && Math.abs(node.y - brushY) <= 1)
                    );
                }
            }
        }
        
        this.render();
    }

    handleMouseUp(e) {
        this.isDragging = false;
        this.isPanning = false;
        this.lastPaintTile = null;
    }
    
    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 1.1 : 0.9;
        this.scale = Math.max(0.5, Math.min(3.0, this.scale * delta));
        this.render();
    }

    setSpawnPoint(playerIndex, x, y) {
        // Remove existing spawn for this player
        this.spawnPoints = this.spawnPoints.filter(sp => sp.playerIndex !== playerIndex);
        // Add new spawn
        this.spawnPoints.push({ x, y, playerIndex });
        this.render();
    }

    render() {
        if (!this.ctx || !this.map) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const tileSize = TILE_SIZE * this.scale;
        
        // Render tiles
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const tile = this.map.getTile(x, y);
                if (!tile) continue;
                
                const screenX = x * tileSize + this.camera.x;
                const screenY = y * tileSize + this.camera.y;
                
                // Skip off-screen tiles
                if (screenX + tileSize < 0 || screenX > this.canvas.width ||
                    screenY + tileSize < 0 || screenY > this.canvas.height) {
                    continue;
                }
                
                // Draw terrain
                let color = '#2a5a2a'; // grass
                if (tile.terrain === 'rock') {
                    color = '#555';
                } else if (tile.terrain === 'water') {
                    color = '#1a3a5a';
                } else if (tile.terrain === 'resource') {
                    color = '#3a5a2a';
                }
                
                this.ctx.fillStyle = color;
                this.ctx.fillRect(screenX, screenY, tileSize, tileSize);
                
                // Draw grid
                if (this.showGrid) {
                    this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
                    this.ctx.lineWidth = 0.5;
                    this.ctx.strokeRect(screenX, screenY, tileSize, tileSize);
                }
            }
        }
        
        // Draw hover preview
        if (this.hoveredTile && this.hoveredTile.x >= 0 && this.hoveredTile.y >= 0 && 
            this.hoveredTile.x < this.mapWidth && this.hoveredTile.y < this.mapHeight) {
            const halfBrush = Math.floor(this.brushSize / 2);
            for (let dy = -halfBrush; dy <= halfBrush; dy++) {
                for (let dx = -halfBrush; dx <= halfBrush; dx++) {
                    const brushX = this.hoveredTile.x + dx;
                    const brushY = this.hoveredTile.y + dy;
                    if (brushX < 0 || brushY < 0 || brushX >= this.mapWidth || brushY >= this.mapHeight) continue;
                    
                    const screenX = brushX * tileSize + this.camera.x;
                    const screenY = brushY * tileSize + this.camera.y;
                    
                    // Draw preview overlay
                    this.ctx.strokeStyle = '#0ff';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(screenX, screenY, tileSize, tileSize);
                    
                    // Show tool-specific preview
                    if (this.currentTool === 'terrain') {
                        let previewColor = 'rgba(42, 90, 42, 0.3)'; // grass
                        if (this.currentTerrain === 'rock') previewColor = 'rgba(85, 85, 85, 0.3)';
                        else if (this.currentTerrain === 'water') previewColor = 'rgba(26, 58, 90, 0.3)';
                        this.ctx.fillStyle = previewColor;
                        this.ctx.fillRect(screenX, screenY, tileSize, tileSize);
                    } else if (this.currentTool === 'resource' && dx === 0 && dy === 0) {
                        const previewColor = this.currentResource === 'gems' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(255, 170, 0, 0.3)';
                        this.ctx.fillStyle = previewColor;
                        this.ctx.beginPath();
                        this.ctx.arc(screenX + tileSize / 2, screenY + tileSize / 2, tileSize * 0.3, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                }
            }
        }
        
        // Render resource nodes
        for (const node of this.map.resourceNodes) {
            const screenX = node.x * tileSize + this.camera.x;
            const screenY = node.y * tileSize + this.camera.y;
            
            this.ctx.fillStyle = node.color || (node.type === 'gems' ? '#0ff' : '#fa0');
            this.ctx.beginPath();
            this.ctx.arc(screenX + tileSize / 2, screenY + tileSize / 2, tileSize * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Render spawn points
        for (const spawn of this.spawnPoints) {
            const screenX = spawn.x * tileSize + this.camera.x;
            const screenY = spawn.y * tileSize + this.camera.y;
            
            const playerColor = PLAYER_COLORS[spawn.playerIndex] || '#0f0';
            this.ctx.fillStyle = playerColor;
            this.ctx.fillRect(screenX, screenY, tileSize, tileSize);
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(screenX, screenY, tileSize, tileSize);
            
            // Draw player number
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `${tileSize * 0.5}px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText((spawn.playerIndex + 1).toString(), screenX + tileSize / 2, screenY + tileSize / 2);
        }
    }

    serialize() {
        return {
            width: this.mapWidth,
            height: this.mapHeight,
            tiles: this.map.tiles.map(tile => ({
                x: tile.x,
                y: tile.y,
                terrain: tile.terrain,
                blocked: tile.blocked,
            })),
            resourceNodes: this.map.resourceNodes.map(node => ({
                x: node.x,
                y: node.y,
                type: node.type,
                resources: node.resources,
                maxResources: node.maxResources,
                valueMultiplier: node.valueMultiplier,
                color: node.color,
            })),
            spawnPoints: this.spawnPoints,
        };
    }

    deserialize(data) {
        this.mapWidth = data.width;
        this.mapHeight = data.height;
        this.map = new GameMap(data.width, data.height, 'standard', true);
        
        // Restore tiles
        for (const tileData of data.tiles) {
            const tile = this.map.getTile(tileData.x, tileData.y);
            if (tile) {
                tile.terrain = tileData.terrain;
                tile.blocked = tileData.blocked;
            }
        }
        
        // Restore resource nodes
        this.map.resourceNodes = data.resourceNodes.map(nodeData => ({
            x: nodeData.x,
            y: nodeData.y,
            type: nodeData.type,
            resources: nodeData.resources,
            maxResources: nodeData.maxResources,
            valueMultiplier: nodeData.valueMultiplier,
            color: nodeData.color,
        }));
        
        // Restore spawn points
        this.spawnPoints = data.spawnPoints || [];
        
        this.render();
    }

    saveToLocalStorage(name) {
        const data = this.serialize();
        const key = `custom_map_${name}`;
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    }

    loadFromLocalStorage(name) {
        const key = `custom_map_${name}`;
        const data = localStorage.getItem(key);
        if (!data) return false;
        
        try {
            const parsed = JSON.parse(data);
            this.deserialize(parsed);
            return true;
        } catch (e) {
            console.error('Failed to load custom map:', e);
            return false;
        }
    }

    getCustomMapList() {
        const maps = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('custom_map_')) {
                const name = key.replace('custom_map_', '');
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    maps.push({
                        name: name,
                        width: data.width,
                        height: data.height,
                    });
                } catch (e) {
                    // Skip invalid entries
                }
            }
        }
        return maps;
    }

    deleteCustomMap(name) {
        const key = `custom_map_${name}`;
        localStorage.removeItem(key);
    }
}
