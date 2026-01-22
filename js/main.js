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

        // Hide menu, show game
        gameMenu.classList.add('hidden');
        gameContainer.classList.remove('hidden');

        // Initialize game
        game = new Game();
        window.game = game; // Make accessible globally
        game.init(mapSize, mapType, aiCount, aiDifficulty, startingCredits, startingInfantry);

        showNotification('Build your base and destroy the enemy!');
    }

    startButton.addEventListener('click', startNewGame);

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
