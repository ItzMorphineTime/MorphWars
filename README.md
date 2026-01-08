# 🎮 Morph Wars - RTS Game

[![Play Now](https://img.shields.io/badge/Play-Now-brightgreen?style=for-the-badge)](https://YOUR_GITHUB_USERNAME.github.io/Game/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg?style=flat-square&logo=javascript)](https://www.javascript.com/)
[![No Dependencies](https://img.shields.io/badge/Dependencies-None-success.svg?style=flat-square)](package.json)

A feature-rich, real-time strategy game, built entirely with vanilla JavaScript and HTML5 Canvas. No frameworks, no dependencies—just pure, performant gameplay.

**[🕹️ Play the Game Here](https://itzmorphinetime.github.io/MorphWars/)**

---

## 📸 Screenshots

*Coming soon - Add your gameplay screenshots here!*

---

## ✨ Features

### 🗺️ **Advanced Procedural Map Generation**
- **Perlin Noise Heightmaps** - Realistic terrain with layered octave noise
- **5 Unique Map Types**:
  - **Standard** - Balanced terrain with rivers and plains
  - **Desert** - Rocky badlands with sparse resources
  - **Islands** - Archipelago with isolated landmasses
  - **Plains** - Wide open grasslands with abundant resources
  - **Highlands** - Dramatic mountain ranges and valleys
- **Height-based Terrain Coloring** - Visual elevation gradients
- **Smart Spawn System** - Guarantees fair starting positions on valid land

### 💎 **Dual Resource Economy**
- **Ore** (Orange) - Standard resource with 1x value multiplier
- **Gems** (Cyan) - Premium resource with 2x value multiplier
- **Elevation-based Spawning** - Gems prefer higher terrain
- **Intelligent Placement** - Resources avoid water and mountains
- **Configurable Rarity** - Adjustable spawn rates and values

### 🏗️ **Strategic Building System**
- **13 Building Types** - Economy, production, defense, and superweapons
- **Construction Time** - Buildings require time to become operational
- **Power-based Speed**:
  - Low Power (<100%): 25% construction speed
  - Normal Power (100-150%): 100% speed
  - High Power (>150%): 150% speed boost
- **Tech Tree** - Unlock advanced structures through research
- **Auto-harvester Deployment** - Refineries spawn harvesters automatically

### ⚔️ **Deep Combat & Unit System**
- **17 Unit Types** across infantry, vehicles, and air units
- **Veterancy System** - Units gain experience and bonuses
- **Smart Pathfinding** - A* algorithm with collision avoidance
- **Rock-Paper-Scissors Combat** - Damage multipliers based on armor/weapon types
- **Special Units**:
  - Harvesters with intelligent resource seeking
  - Medics for infantry healing
  - Artillery with splash damage
  - Helicopters with ammo management

### 🤖 **Advanced AI**
- **3 Difficulty Levels** (Easy, Medium, Hard)
- **Intelligent Behaviors**:
  - Dynamic base expansion
  - Economic management
  - Coordinated mass attacks
  - Defensive positioning
  - Scout deployment
  - Unit spreading to avoid clustering

### 🎯 **Special Powers**
- **Recon Sweep** - Reveal large map areas temporarily
- **Airstrike** - Call in devastating air support
- **Ion Cannon** - Ultimate superweapon with massive AOE damage

### 🎨 **Polish & Quality of Life**
- **Fog of War** - Explored/Visible/Unexplored states
- **Minimap** - Real-time strategic overview
- **Production Queues** - Queue multiple units
- **Rally Points** - Set unit spawn destinations
- **Selection Groups** - Multi-select and group commands
- **Attack Move** - Aggressive unit positioning
- **Repair Bays** - Automatic vehicle healing

---

## 🚀 Getting Started

### Play Online
Simply visit **[itzmorphinetime.github.io/MorphWars](https://itzmorphinetime.github.io/MorphWars/)** to play instantly in your browser!

### Run Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_GITHUB_USERNAME/Game.git
   cd Game
   ```

2. **Open in browser**
   ```bash
   # Open index.html directly, or use a local server:
   python -m http.server 8000
   # Then visit: http://localhost:8000
   ```

That's it! No build process, no npm install, no dependencies.

---

## 🎮 How to Play

### Controls
- **Left Click** - Select units/buildings
- **Right Click** - Move/Attack command
- **Drag Select** - Select multiple units
- **Shift + Click** - Add to selection
- **A + Right Click** - Attack move
- **ESC** - Deselect all

### Getting Started
1. Deploy your MCV (Mobile Construction Vehicle) to create your base
2. Build Power Plants to generate energy
3. Construct Refineries and Harvesters to gather resources
4. Build Barracks/War Factory to produce military units
5. Research Tech Centers to unlock advanced units
6. Destroy enemy headquarters to win!

### Pro Tips
- 💡 Maintain positive power ratio for faster construction
- 💎 Prioritize Gem nodes for double resource income
- 🏔️ Use terrain strategically - mountains create chokepoints
- 🚁 Helicopters can fly over obstacles but need to reload
- ⚡ Build multiple refineries near resource clusters
- 🎯 Use special powers strategically in critical moments

---

## 🛠️ Technology Stack

- **Pure JavaScript (ES6+)** - No frameworks or libraries
- **HTML5 Canvas** - Hardware-accelerated rendering
- **Perlin Noise** - Custom implementation for procedural generation
- **A* Pathfinding** - Optimized for real-time performance
- **Custom Game Engine** - Built from scratch

### Architecture Highlights
- **Modular Design** - Clean separation of concerns
- **State Machines** - Unit AI and building production
- **Observer Pattern** - Fog of war and visibility updates
- **Configuration-driven** - All gameplay values in constants.js
- **Performance Optimized** - Throttled updates, spatial hashing, efficient rendering

---

## 📁 Project Structure

```
Game/
├── index.html              # Main entry point
├── js/
│   ├── constants.js        # Game configuration & balance
│   ├── perlin.js           # Perlin noise generator
│   ├── map.js              # Heightmap & terrain generation
│   ├── entity.js           # Base entity class
│   ├── unit.js             # Unit behaviors & AI
│   ├── building.js         # Building production & defense
│   ├── player.js           # Player state management
│   ├── ai.js               # AI controller
│   ├── game.js             # Main game loop
│   ├── renderer.js         # Canvas rendering
│   ├── input.js            # Mouse/keyboard handling
│   ├── ui.js               # User interface
│   ├── utils.js            # Utility functions
│   └── main.js             # Initialization
└── README.md
```

---

## ⚙️ Configuration

All gameplay parameters are easily configurable in `js/constants.js`:

### Map Generation
```javascript
MAP_GENERATION: {
  HEIGHTMAP_CONFIG: {
    octaves: 4,              // Noise detail layers
    persistence: 0.5,        // Amplitude decay
    scale: 80,               // Feature size
    redistributionPower: 1.2, // Terrain drama
    islandEffect: 0,         // Island strength
  },
  TERRAIN_THRESHOLDS: {
    water: 0.35,            // Water level
    mountain: 0.80,         // Mountain level
  }
}
```

### Resource System
```javascript
RESOURCE_CONFIG: {
  HARVESTING_RATE: 5,          // Resources per cycle
  GEM_SPAWN_CHANCE: 0.25,      // 25% gem probability
  NODE_TYPES: {
    ORE: { baseValue: 1 },
    GEMS: { baseValue: 2 }     // 2x value
  }
}
```

### Construction
```javascript
CONSTRUCTION_CONFIG: {
  BASE_SPEED: 1.0,
  LOW_POWER_PENALTY: 0.25,     // 75% slower
  HIGH_POWER_BONUS: 1.5,       // 50% faster
}
```

---

## 🎯 Roadmap

- [ ] Multiplayer support (WebRTC)
- [ ] Campaign mode with story missions
- [ ] More unit types and factions
- [ ] Advanced terrain features (bridges, cliffs)
- [ ] Sound effects and music
- [ ] Unit formations and advanced commands
- [ ] Save/Load game state
- [ ] Replay system
- [ ] Map editor
- [ ] Modding support

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/AmazingFeature`)
3. **Commit your changes** (`git commit -m 'Add some AmazingFeature'`)
4. **Push to the branch** (`git push origin feature/AmazingFeature`)
5. **Open a Pull Request**

### Development Guidelines
- Follow existing code style (ES6+, modular design)
- Keep performance in mind - this runs in real-time
- Add configuration options to constants.js
- Test with different map types and AI difficulties
- Update README.md for significant features

---

## 🐛 Known Issues

- Large maps (200x200) may have slower initial generation
- Pathfinding can struggle with very dense unit clusters
- AI may occasionally build suboptimally on island maps

---

## 📝 License

This project is licensed under the Apache License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Inspired by **Command & Conquer** (Westwood Studios)
- Perlin noise algorithm by **Ken Perlin**
- Built with knowledge from the game development community

---

## 📧 Contact

Have questions or suggestions? Feel free to:
- Open an issue on GitHub
- Reach out via [your contact method]

---

## 🌟 Show Your Support

If you enjoyed this project, please consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs
- 💡 Suggesting features
- 🔀 Contributing code

---

**[🎮 Start Playing Now!](https://YOUR_GITHUB_USERNAME.github.io/Game/)**

*Made with ❤️ and JavaScript*
