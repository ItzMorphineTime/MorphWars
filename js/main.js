// Main entry point

let game = null;

document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startGame');
    const gameMenu = document.getElementById('gameMenu');
    const gameContainer = document.getElementById('gameContainer');

    startButton.addEventListener('click', () => {
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
        game.init(mapSize, mapType, aiCount, aiDifficulty, startingCredits, startingInfantry);

        showNotification('Build your base and destroy the enemy!');
    });
});
