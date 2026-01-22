// Main entry point

let game = null;

// Make game accessible globally for menu functions
window.game = null;

document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startGame');
    const loadGameMenuBtn = document.getElementById('loadGameMenuBtn');
    const gameMenu = document.getElementById('gameMenu');
    const gameContainer = document.getElementById('gameContainer');

    function startNewGame() {
        const aiCount = parseInt(document.getElementById('aiCount').value);
        const aiDifficulty = document.getElementById('aiDifficulty').value;
        const mapSize = document.getElementById('mapSize').value;
        const mapType = document.getElementById('mapType').value;
        const startingCredits = parseInt(document.getElementById('startingCredits').value);
        const startingInfantry = parseInt(document.getElementById('startingInfantry').value);
        
        let customMapName = null;
        if (mapType === 'custom') {
            customMapName = document.getElementById('customMapSelect').value;
            if (!customMapName) {
                alert('Please select a custom map');
                return;
            }
        }

        // Hide menu, show game
        gameMenu.classList.add('hidden');
        gameContainer.classList.remove('hidden');

        // Initialize game
        game = new Game();
        window.game = game; // Make accessible globally
        game.init(mapSize, mapType, aiCount, aiDifficulty, startingCredits, startingInfantry, customMapName);

        showNotification('Build your base and destroy the enemy!');
    }
    
    // Update custom map list when map type changes
    document.getElementById('mapType').addEventListener('change', (e) => {
        const customMapOption = document.getElementById('customMapOption');
        const customMapSelect = document.getElementById('customMapSelect');
        
        if (e.target.value === 'custom') {
            customMapOption.style.display = 'block';
            // Load custom maps
            const editor = new MapEditor();
            const maps = editor.getCustomMapList();
            customMapSelect.innerHTML = '<option value="">Select a custom map...</option>';
            for (const map of maps) {
                const option = document.createElement('option');
                option.value = map.name;
                option.textContent = `${map.name} (${map.width}x${map.height})`;
                customMapSelect.appendChild(option);
            }
        } else {
            customMapOption.style.display = 'none';
        }
    });

    startButton.addEventListener('click', startNewGame);

    // Map Editor button
    const mapEditorBtn = document.getElementById('mapEditorBtn');
    mapEditorBtn.addEventListener('click', () => {
        showMapEditor();
    });

    loadGameMenuBtn.addEventListener('click', () => {
        // Create temporary game instance to access saveLoadManager
        if (!game) {
            game = new Game();
            window.game = game;
        }
        
        const saves = game.saveLoadManager.getSaveList();
        if (saves.length === 0) {
            alert('No save files found');
            return;
        }

        // Show load menu modal
        const modal = document.createElement('div');
        modal.id = 'loadGameModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 2000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: #222;
            border: 3px solid #0f0;
            padding: 20px;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            width: 90%;
        `;
        
        let html = '<div class="menu-title" style="margin-bottom: 15px;">LOAD GAME</div>';
        html += '<div style="max-height: 400px; overflow-y: auto;">';
        
        for (const save of saves) {
            const date = new Date(save.timestamp).toLocaleString();
            const saveNameEscaped = save.name.replace(/'/g, "&#39;").replace(/"/g, "&quot;");
            html += `<div style="padding: 10px; margin: 5px 0; background: #333; border: 1px solid #0f0; position: relative;">
                <div style="cursor: pointer; padding-right: 60px;" 
                    onmouseover="this.parentElement.style.background='#444'" 
                    onmouseout="this.parentElement.style.background='#333'"
                    onclick="loadGameFromMenu('${saveNameEscaped.replace(/'/g, "\\'")}'); document.getElementById('loadGameModal').remove();">
                    <div style="font-weight: bold; color: #0f0;">${save.name}</div>
                    <div style="opacity: 0.7; font-size: 12px; margin-top: 5px;">${date}</div>
                </div>
                <button style="position: absolute; top: 10px; right: 10px; padding: 5px 10px; background: #f00; border: 1px solid #a00; color: #fff; cursor: pointer; font-size: 10px;"
                    onclick="if(confirm('Delete save: ${saveNameEscaped.replace(/'/g, "\\'")}?')) { if(!game) { game = new Game(); window.game = game; } game.saveLoadManager.deleteSave('${save.name.replace(/'/g, "\\'")}'); document.getElementById('loadGameModal').remove(); location.reload(); }">DELETE</button>
            </div>`;
        }
        
        html += '</div>';
        html += '<button class="menu-button" style="margin-top: 15px; width: 100%;" onclick="document.getElementById(\'loadGameModal\').remove();">CANCEL</button>';
        
        content.innerHTML = html;
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    });
});

function loadGameFromMenu(saveName) {
    // Hide menu, show game first (before loading, so canvas is visible)
    const gameMenu = document.getElementById('gameMenu');
    const gameContainer = document.getElementById('gameContainer');
    gameMenu.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    
    // Force canvas to be visible and ready
    const canvas = document.getElementById('mainCanvas');
    if (canvas) {
        canvas.style.display = 'block';
    }
    
    // Always create new game instance for clean load
    // Do this AFTER showing the container so canvas exists
    setTimeout(() => {
        game = new Game();
        window.game = game;
        
        if (game.saveLoadManager.loadGame(saveName)) {
            showNotification('Game loaded successfully!');
        } else {
            // If load failed, show menu again
            gameMenu.classList.remove('hidden');
            gameContainer.classList.add('hidden');
        }
    }, 100);
}

function showMapEditor() {
    // Hide main menu
    const gameMenu = document.getElementById('gameMenu');
    gameMenu.classList.add('hidden');
    
    // Create map editor container
    const editorContainer = document.createElement('div');
    editorContainer.id = 'mapEditorContainer';
    editorContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #000;
        z-index: 1000;
        display: flex;
    `;
    
    // Create toolbar
    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
        width: 300px;
        background: #222;
        border-right: 3px solid #0f0;
        padding: 20px;
        overflow-y: auto;
        color: #0f0;
        font-family: 'Courier New', monospace;
    `;
    
    let toolbarHTML = '<div style="font-size: 24px; font-weight: bold; margin-bottom: 20px; text-align: center; color: #0ff;">🗺️ MAP EDITOR</div>';
    
    // Map size selector
    toolbarHTML += '<div style="margin-bottom: 20px; padding: 10px; background: #1a1a1a; border: 1px solid #0f0;">';
    toolbarHTML += '<div style="font-weight: bold; margin-bottom: 10px; color: #0f0;">Map Size:</div>';
    toolbarHTML += '<select id="editorMapSize" style="width: 100%; padding: 5px; background: #333; color: #0f0; border: 1px solid #0f0;">';
    toolbarHTML += '<option value="100">Small (100x100)</option>';
    toolbarHTML += '<option value="150" selected>Medium (150x150)</option>';
    toolbarHTML += '<option value="200">Large (200x200)</option>';
    toolbarHTML += '</select>';
    toolbarHTML += '</div>';
    
    // Brush size
    toolbarHTML += '<div style="margin-bottom: 20px; padding: 10px; background: #1a1a1a; border: 1px solid #0f0;">';
    toolbarHTML += '<div style="font-weight: bold; margin-bottom: 10px; color: #0f0;">Brush Size: <span id="brushSizeDisplay">1</span></div>';
    toolbarHTML += '<input type="range" id="brushSizeSlider" min="1" max="5" value="1" style="width: 100%;">';
    toolbarHTML += '</div>';
    
    // Tool selection
    toolbarHTML += '<div style="margin-bottom: 20px; padding: 10px; background: #1a1a1a; border: 1px solid #0f0;">';
    toolbarHTML += '<div style="font-weight: bold; margin-bottom: 10px; color: #0f0;">Tool (1-3):</div>';
    toolbarHTML += '<button class="editor-btn" data-tool="terrain" style="background: #0f0; color: #000;" title="Press 1">🖌️ Terrain Paint</button>';
    toolbarHTML += '<button class="editor-btn" data-tool="resource" style="background: #fa0; color: #000;" title="Press 2">💎 Resource</button>';
    toolbarHTML += '<button class="editor-btn" data-tool="erase" style="background: #f00; color: #fff;" title="Press 3">🗑️ Erase</button>';
    toolbarHTML += '</div>';
    
    // Terrain selection (only visible when terrain tool selected)
    toolbarHTML += '<div id="terrainOptions" style="margin-bottom: 20px; padding: 10px; background: #1a1a1a; border: 1px solid #0f0;">';
    toolbarHTML += '<div style="font-weight: bold; margin-bottom: 10px; color: #0f0;">Terrain Type (Q/W/E):</div>';
    toolbarHTML += '<button class="terrain-btn" data-terrain="grass" style="background: #2a5a2a; color: #fff;" title="Press Q">🌱 Grass</button>';
    toolbarHTML += '<button class="terrain-btn" data-terrain="rock" style="background: #555; color: #fff;" title="Press W">⛰️ Rock</button>';
    toolbarHTML += '<button class="terrain-btn" data-terrain="water" style="background: #1a3a5a; color: #fff;" title="Press E">💧 Water</button>';
    toolbarHTML += '</div>';
    
    // Resource selection (only visible when resource tool selected)
    toolbarHTML += '<div id="resourceOptions" style="margin-bottom: 20px; padding: 10px; background: #1a1a1a; border: 1px solid #0f0; display: none;">';
    toolbarHTML += '<div style="font-weight: bold; margin-bottom: 10px; color: #0f0;">Resource Type (R/T):</div>';
    toolbarHTML += '<button class="resource-btn" data-resource="ore" style="background: #fa0; color: #000;" title="Press R">🟠 Ore</button>';
    toolbarHTML += '<button class="resource-btn" data-resource="gems" style="background: #0ff; color: #000;" title="Press T">💎 Gems</button>';
    toolbarHTML += '</div>';
    
    // Spawn points
    toolbarHTML += '<div style="margin-bottom: 20px; padding: 10px; background: #1a1a1a; border: 1px solid #0f0;">';
    toolbarHTML += '<div style="font-weight: bold; margin-bottom: 10px; color: #0f0;">📍 Spawn Points:</div>';
    toolbarHTML += '<div style="margin-bottom: 10px; display: flex; align-items: center; gap: 10px;">';
    toolbarHTML += '<input type="number" id="spawnPlayerIndex" min="0" max="3" value="0" style="width: 60px; padding: 5px; background: #333; color: #0f0; border: 1px solid #0f0;">';
    toolbarHTML += '<span style="font-size: 12px;">Player (0-3)</span>';
    toolbarHTML += '</div>';
    toolbarHTML += '<button id="setSpawnBtn" style="width: 100%; padding: 10px; background: #0f0; color: #000; border: 2px solid #0a0; cursor: pointer; font-weight: bold; margin-bottom: 5px;">Set Spawn (S)</button>';
    toolbarHTML += '<div id="spawnPointsList" style="font-size: 11px; opacity: 0.7; margin-top: 5px;"></div>';
    toolbarHTML += '</div>';
    
    // View controls
    toolbarHTML += '<div style="margin-bottom: 20px; padding: 10px; background: #1a1a1a; border: 1px solid #0f0;">';
    toolbarHTML += '<div style="font-weight: bold; margin-bottom: 10px; color: #0f0;">View Controls:</div>';
    toolbarHTML += '<button id="toggleGridBtn" style="width: 100%; padding: 8px; background: #333; color: #0f0; border: 1px solid #0f0; cursor: pointer; margin-bottom: 5px;">Toggle Grid (G)</button>';
    toolbarHTML += '<button id="resetCameraBtn" style="width: 100%; padding: 8px; background: #333; color: #0f0; border: 1px solid #0f0; cursor: pointer;">Reset Camera (Home)</button>';
    toolbarHTML += '<div style="margin-top: 10px; font-size: 11px; opacity: 0.7;">Pan: Middle Mouse / Ctrl+Drag<br>Zoom: Mouse Wheel</div>';
    toolbarHTML += '</div>';
    
    // Save/Load section
    toolbarHTML += '<div style="margin-bottom: 20px; padding: 10px; background: #1a1a1a; border: 1px solid #0f0; border-top: 2px solid #0f0;">';
    toolbarHTML += '<div style="font-weight: bold; margin-bottom: 10px; color: #0f0;">💾 Save/Load Map:</div>';
    toolbarHTML += '<input type="text" id="mapNameInput" placeholder="Map name..." style="width: 100%; padding: 5px; background: #333; color: #0f0; border: 1px solid #0f0; margin-bottom: 10px;">';
    toolbarHTML += '<button id="saveMapBtn" style="width: 100%; padding: 10px; background: #0f0; color: #000; border: 2px solid #0a0; cursor: pointer; margin-bottom: 5px; font-weight: bold;">💾 SAVE MAP (Ctrl+S)</button>';
    toolbarHTML += '<button id="loadMapBtn" style="width: 100%; padding: 10px; background: #0ff; color: #000; border: 2px solid #0af; cursor: pointer; margin-bottom: 10px; font-weight: bold;">📂 LOAD MAP (Ctrl+O)</button>';
    toolbarHTML += '<div id="customMapsList" style="max-height: 200px; overflow-y: auto; margin-top: 10px; border: 1px solid #0f0; padding: 5px; background: #111;"></div>';
    toolbarHTML += '</div>';
    
    // Stats
    toolbarHTML += '<div style="margin-bottom: 20px; padding: 10px; background: #1a1a1a; border: 1px solid #0f0;">';
    toolbarHTML += '<div style="font-weight: bold; margin-bottom: 5px; color: #0f0; font-size: 12px;">Map Stats:</div>';
    toolbarHTML += '<div id="mapStats" style="font-size: 11px; opacity: 0.7; line-height: 1.5;"></div>';
    toolbarHTML += '</div>';
    
    // Close button
    toolbarHTML += '<button id="closeEditorBtn" style="width: 100%; padding: 15px; background: #f00; color: #fff; border: 2px solid #a00; cursor: pointer; font-weight: bold; font-size: 16px;">❌ CLOSE EDITOR (ESC)</button>';
    
    toolbar.innerHTML = toolbarHTML;
    
    // Create canvas container
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `
        flex: 1;
        position: relative;
        overflow: hidden;
    `;
    
    editorContainer.appendChild(toolbar);
    editorContainer.appendChild(canvasContainer);
    document.body.appendChild(editorContainer);
    
    // Initialize map editor
    const editor = new MapEditor();
    editor.canvasContainer = canvasContainer;
    editor.init(); // This creates the canvas
    canvasContainer.appendChild(editor.canvas);
    
    // Update map size
    document.getElementById('editorMapSize').addEventListener('change', (e) => {
        const size = parseInt(e.target.value);
        editor.setMapSize(size, size);
        if (typeof updateMapStats === 'function') updateMapStats();
    });
    
    // Brush size slider
    const brushSizeSlider = document.getElementById('brushSizeSlider');
    const brushSizeDisplay = document.getElementById('brushSizeDisplay');
    if (brushSizeSlider && brushSizeDisplay) {
        brushSizeSlider.addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            editor.setBrushSize(size);
            brushSizeDisplay.textContent = size;
        });
    }
    
    // Toggle grid
    const toggleGridBtn = document.getElementById('toggleGridBtn');
    if (toggleGridBtn) {
        toggleGridBtn.addEventListener('click', () => {
            editor.toggleGrid();
        });
    }
    
    // Reset camera
    const resetCameraBtn = document.getElementById('resetCameraBtn');
    if (resetCameraBtn) {
        resetCameraBtn.addEventListener('click', () => {
            editor.camera.x = 0;
            editor.camera.y = 0;
            editor.scale = 1.0;
            editor.render();
        });
    }
    
    // Tool selection
    document.querySelectorAll('.editor-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.editor-btn').forEach(b => b.style.opacity = '0.5');
            e.target.style.opacity = '1';
            editor.setTool(e.target.dataset.tool);
            
            // Show/hide options
            if (e.target.dataset.tool === 'terrain') {
                document.getElementById('terrainOptions').style.display = 'block';
                document.getElementById('resourceOptions').style.display = 'none';
            } else if (e.target.dataset.tool === 'resource') {
                document.getElementById('terrainOptions').style.display = 'none';
                document.getElementById('resourceOptions').style.display = 'block';
            } else {
                document.getElementById('terrainOptions').style.display = 'none';
                document.getElementById('resourceOptions').style.display = 'none';
            }
        });
    });
    
    // Set first tool as active
    document.querySelector('.editor-btn[data-tool="terrain"]').style.opacity = '1';
    
    // Terrain selection
    document.querySelectorAll('.terrain-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.terrain-btn').forEach(b => b.style.border = '1px solid #0f0');
            e.target.style.border = '3px solid #fff';
            editor.setTerrain(e.target.dataset.terrain);
        });
    });
    document.querySelector('.terrain-btn[data-terrain="grass"]').style.border = '3px solid #fff';
    
    // Resource selection
    document.querySelectorAll('.resource-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.resource-btn').forEach(b => b.style.border = '1px solid #0f0');
            e.target.style.border = '3px solid #fff';
            editor.setResource(e.target.dataset.resource);
        });
    });
    document.querySelector('.resource-btn[data-resource="ore"]').style.border = '3px solid #fff';
    
    // Mouse events
    editor.canvas.addEventListener('mousedown', (e) => editor.handleMouseDown(e));
    editor.canvas.addEventListener('mousemove', (e) => editor.handleMouseMove(e));
    editor.canvas.addEventListener('mouseup', (e) => editor.handleMouseUp(e));
    editor.canvas.addEventListener('mouseleave', (e) => editor.handleMouseUp(e));
    editor.canvas.addEventListener('wheel', (e) => editor.handleWheel(e));
    editor.canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent right-click menu
    
    // Set spawn point
    document.getElementById('setSpawnBtn').addEventListener('click', () => {
        const playerIndex = parseInt(document.getElementById('spawnPlayerIndex').value);
        // Get mouse position relative to canvas
        const rect = editor.canvas.getBoundingClientRect();
        const mouseX = editor.lastMouseX || rect.width / 2;
        const mouseY = editor.lastMouseY || rect.height / 2;
        const tile = editor.worldToTile(mouseX, mouseY);
        if (tile.x >= 0 && tile.y >= 0 && tile.x < editor.mapWidth && tile.y < editor.mapHeight) {
            editor.setSpawnPoint(playerIndex, tile.x, tile.y);
        }
    });
    
    // Track mouse for spawn point
    editor.canvas.addEventListener('mousemove', (e) => {
        const rect = editor.canvas.getBoundingClientRect();
        editor.lastMouseX = e.clientX - rect.left;
        editor.lastMouseY = e.clientY - rect.top;
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (document.getElementById('mapEditorContainer') && document.getElementById('mapEditorContainer').parentElement) {
            // Tool shortcuts
            if (e.key === '1') {
                document.querySelector('.editor-btn[data-tool="terrain"]').click();
            } else if (e.key === '2') {
                document.querySelector('.editor-btn[data-tool="resource"]').click();
            } else if (e.key === '3') {
                document.querySelector('.editor-btn[data-tool="erase"]').click();
            }
            // Terrain shortcuts
            else if (e.key === 'q' || e.key === 'Q') {
                document.querySelector('.terrain-btn[data-terrain="grass"]').click();
            } else if (e.key === 'w' || e.key === 'W') {
                document.querySelector('.terrain-btn[data-terrain="rock"]').click();
            } else if (e.key === 'e' || e.key === 'E') {
                document.querySelector('.terrain-btn[data-terrain="water"]').click();
            }
            // Resource shortcuts
            else if (e.key === 'r' || e.key === 'R') {
                document.querySelector('.resource-btn[data-resource="ore"]').click();
            } else if (e.key === 't' || e.key === 'T') {
                document.querySelector('.resource-btn[data-resource="gems"]').click();
            }
            // Spawn shortcut
            else if (e.key === 's' || e.key === 'S') {
                if (!e.ctrlKey && !e.metaKey) {
                    document.getElementById('setSpawnBtn').click();
                }
            }
            // Grid toggle
            else if (e.key === 'g' || e.key === 'G') {
                const btn = document.getElementById('toggleGridBtn');
                if (btn) btn.click();
            }
            // Reset camera
            else if (e.key === 'Home') {
                const btn = document.getElementById('resetCameraBtn');
                if (btn) btn.click();
            }
            // Save/Load shortcuts
            else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                document.getElementById('saveMapBtn').click();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                e.preventDefault();
                document.getElementById('loadMapBtn').click();
            }
            // Close editor
            else if (e.key === 'Escape') {
                document.getElementById('closeEditorBtn').click();
            }
            // Camera movement with arrow keys
            else if (e.key === 'ArrowUp') {
                editor.camera.y += 20;
                editor.render();
            } else if (e.key === 'ArrowDown') {
                editor.camera.y -= 20;
                editor.render();
            } else if (e.key === 'ArrowLeft') {
                editor.camera.x += 20;
                editor.render();
            } else if (e.key === 'ArrowRight') {
                editor.camera.x -= 20;
                editor.render();
            }
        }
    });
    
    // Save map
    document.getElementById('saveMapBtn').addEventListener('click', () => {
        const name = document.getElementById('mapNameInput').value.trim();
        if (!name) {
            alert('Please enter a map name');
            return;
        }
        if (editor.saveToLocalStorage(name)) {
            alert(`Map "${name}" saved successfully!`);
            updateCustomMapsList();
            document.getElementById('mapNameInput').value = '';
        }
    });
    
    // Load map
    document.getElementById('loadMapBtn').addEventListener('click', () => {
        const name = document.getElementById('mapNameInput').value.trim();
        if (!name) {
            alert('Please enter a map name');
            return;
        }
        if (editor.loadFromLocalStorage(name)) {
            alert(`Map "${name}" loaded successfully!`);
            updateCustomMapsList();
        } else {
            alert(`Failed to load map "${name}"`);
        }
    });
    
    // Update custom maps list
    function updateCustomMapsList() {
        const list = document.getElementById('customMapsList');
        const maps = editor.getCustomMapList();
        if (maps.length === 0) {
            list.innerHTML = '<div style="opacity: 0.7; font-size: 12px;">No custom maps saved</div>';
            return;
        }
        let html = '<div style="font-weight: bold; margin-bottom: 5px;">Saved Maps:</div>';
        for (const map of maps) {
            html += `<div style="padding: 5px; margin: 2px 0; background: #333; border: 1px solid #0f0; cursor: pointer; display: flex; justify-content: space-between;" 
                onmouseover="this.style.background='#444'" 
                onmouseout="this.style.background='#333'"
                onclick="document.getElementById('mapNameInput').value='${map.name.replace(/'/g, "\\'")}'">
                <span>${map.name}</span>
                <span style="opacity: 0.7;">${map.width}x${map.height}</span>
                <button onclick="event.stopPropagation(); if(confirm('Delete ${map.name.replace(/'/g, "\\'")}?')) { editor.deleteCustomMap('${map.name.replace(/'/g, "\\'")}'); updateCustomMapsList(); }" 
                    style="background: #f00; border: 1px solid #a00; color: #fff; padding: 2px 5px; font-size: 10px;">X</button>
            </div>`;
        }
        list.innerHTML = html;
    }
    updateCustomMapsList();
    
    // Update map stats
    function updateMapStats() {
        const stats = document.getElementById('mapStats');
        if (!stats || !editor.map) return;
        
        const grassCount = editor.map.tiles.filter(t => t.terrain === 'grass').length;
        const rockCount = editor.map.tiles.filter(t => t.terrain === 'rock').length;
        const waterCount = editor.map.tiles.filter(t => t.terrain === 'water').length;
        const oreCount = editor.map.resourceNodes.filter(n => n.type === 'ore').length;
        const gemsCount = editor.map.resourceNodes.filter(n => n.type === 'gems').length;
        
        stats.innerHTML = `
            Size: ${editor.mapWidth}x${editor.mapHeight}<br>
            Grass: ${grassCount}<br>
            Rock: ${rockCount}<br>
            Water: ${waterCount}<br>
            Ore Nodes: ${oreCount}<br>
            Gem Nodes: ${gemsCount}<br>
            Spawn Points: ${editor.spawnPoints.length}
        `;
    }
    
    // Update stats on render
    const originalRender = editor.render.bind(editor);
    editor.render = function() {
        originalRender();
        updateMapStats();
    };
    
    // Update spawn points list
    function updateSpawnPointsList() {
        const list = document.getElementById('spawnPointsList');
        if (!list) return;
        
        if (editor.spawnPoints.length === 0) {
            list.innerHTML = '<span style="opacity: 0.5;">No spawn points set</span>';
            return;
        }
        
        let html = '';
        for (const spawn of editor.spawnPoints) {
            const color = PLAYER_COLORS[spawn.playerIndex] || '#0f0';
            html += `<div style="color: ${color}; margin: 2px 0;">Player ${spawn.playerIndex + 1}: (${spawn.x}, ${spawn.y})</div>`;
        }
        list.innerHTML = html;
    }
    
    // Update spawn list when spawn is set
    const originalSetSpawn = editor.setSpawnPoint.bind(editor);
    editor.setSpawnPoint = function(playerIndex, x, y) {
        originalSetSpawn(playerIndex, x, y);
        updateSpawnPointsList();
    };
    
    updateMapStats();
    updateSpawnPointsList();
    
    // Close editor
    document.getElementById('closeEditorBtn').addEventListener('click', () => {
        editorContainer.remove();
        gameMenu.classList.remove('hidden');
    });
    
    // Make editor accessible globally for map list updates
    window.editor = editor;
    window.updateCustomMapsList = updateCustomMapsList;
    window.updateMapStats = updateMapStats;
}
