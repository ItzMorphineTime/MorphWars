# 🎮 Morph Wars - RTS Game

<p align="center">
  <img src="assets/sprites/Example.png" alt="The Shattered Seas" width="480">
</p>

[![Play Now](https://img.shields.io/badge/Play-Now-brightgreen?style=for-the-badge)](https://itzmorphinetime.github.io/MorphWars/)
[![License](https://img.shields.io/badge/license-Apache%202.0-green)](LICENSE)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg?style=flat-square&logo=javascript)](https://www.javascript.com/)
[![No Dependencies](https://img.shields.io/badge/Dependencies-None-success.svg?style=flat-square)](package.json)

A feature-rich, real-time strategy game, built entirely with vanilla JavaScript and HTML5 Canvas. No frameworks, no dependencies—just pure, performant gameplay.

**[🕹️ Play the Game Here](https://itzmorphinetime.github.io/MorphWars/)**

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
- **Custom Map Editor** - Full-featured map creation tool with:
  - Terrain painting (Grass, Rock, Water)
  - Resource node placement (Ore, Gems)
  - Player spawn point configuration
  - Adjustable brush size (1-5 tiles)
  - Grid overlay toggle
  - Camera pan and zoom controls
  - Save/Load custom maps to localStorage
  - Keyboard shortcuts for all tools
- **Height-based Terrain Coloring** - Visual elevation gradients
- **Smart Spawn System** - Guarantees fair starting positions on valid land

### 💎 **Dual Resource Economy**
- **Ore** (Orange) - Standard resource with 1x value multiplier
- **Gems** (Cyan) - Premium resource with 2x value multiplier
- **Elevation-based Spawning** - Gems prefer higher terrain
- **Intelligent Placement** - Resources avoid water and mountains
- **Configurable Rarity** - Adjustable spawn rates and values

### 🏗️ **Strategic Building System**
- **15 Building Types** - Economy, production, defense, naval, and superweapons
- **Multiple HQs** - Deploy additional HQs by building MCVs from War Factory and deploying them anywhere on the map
- **Construction Time** - Buildings require time to become operational
- **Power-based Speed**:
  - Low Power (<100%): 25% construction speed
  - Normal Power (100-150%): 100% speed
  - High Power (>150%): 150% speed boost
- **Tech Tree** - Unlock advanced structures through research
- **Auto-harvester Deployment** - Refineries spawn harvesters automatically
- **PORT Building** - Naval production facility:
  - Can be built on water or adjacent to water
  - Produces submarines, warships, and transport ships
  - Allows units on top (no collision)
  - **Heals naval ships** when docked on or near the port
  - Works even when built entirely in water
- **Tesla Coil** - Advanced defensive structure:
  - Requires Tier 2 (Advanced Tech)
  - Very high damage (300) but long cooldown (5 seconds)
  - Consumes 150 power (very high consumption)
  - Cannot attack without sufficient power
  - Unique lightning bolt visual effect
- **Power-Dependent Defenses** - Tesla Coils and AA Turrets require power to function
- **Defensive Projectiles** - All turrets now fire visible projectiles when attacking

### ⚔️ **Deep Combat & Unit System**
- **21 Unit Types** across infantry, vehicles, air, and naval units
- **Veterancy System** - Units gain experience and bonuses
- **Advanced Pathfinding** - Hierarchical A* algorithm with:
  - Collision avoidance and waypoint optimization
  - Spatial hashing for fast obstacle detection (40-60% faster)
  - Priority-based throttling (combat units prioritized)
  - Size-aware path caching
- **Rock-Paper-Scissors Combat** - Damage multipliers based on armor/weapon types
- **Combat Visual Feedback** - Damage numbers, projectile trails, muzzle flashes, death animations
- **Unit Formations** - Line, Box, Wedge, and Column formations with hotkey support
- **Harvester Intelligence**:
  - Harvesters don't collide with each other
  - Maximum 2 harvesters per resource node
  - Push blocking units out of the way
- **Transport Systems**:
  - **APC (Armored Personnel Carrier)** - Embark up to 5 infantry units for rapid transport
  - **Transport Ships** - Naval transport with capacity-based unit loading (50 capacity points)
  - **APCs and MCVs can embark on Transport Ships** - Ground vehicles load onto naval transports for amphibious operations
  - Ground units path to coastline when embarking on naval transports (can't path to water)
  - Manual embark/disembark commands with visual indicators
  - Automatic disembark when transport is destroyed
  - **Embarked units are protected** - Cannot be targeted by enemies while inside transport
- **Special Units**:
  - **Mammoth Tank** - Advanced tech super-heavy tank with explosive rounds
  - **Airplanes** - Airfield-based aircraft with fly-by attacks and ammo management
  - **Naval Units** - Submarines (stealth), Warships (long-range), Transport Ships
  - Harvesters with intelligent resource seeking (find nodes closest to assigned refinery)
  - Medics for infantry healing
  - Artillery with splash damage
  - Helicopters with ammo management (can pathfind over water)

### 🤖 **Advanced AI**
- **3 Difficulty Levels** (Easy, Medium, Hard)
- **Intelligent Behaviors**:
  - Dynamic base expansion
  - Economic management
  - Coordinated mass attacks
  - Defensive positioning
  - Scout deployment
  - Unit spreading to avoid clustering
- **Performance Optimizations**:
  - Phased processing (decisions split across multiple frames)
  - Build location caching (30-40% computation reduction)
  - Throttled updates for multiple AI players

### 🎯 **Special Powers**
- **Recon Sweep** - Airplane flies over area to fully reveal fog of war temporarily
- **Airstrike** - Airplane delivers devastating explosive damage to target area (damages friendly units)
- **Air Drop** - Airplane drops 5 random infantry units at target location (requires Airfield)
- **Ion Cannon** - Ultimate superweapon with:
  - Massive AOE damage (800 base damage)
  - Damage falloff from center (100% at center, 50% at edge)
  - Stunning visual effects (charging phase + explosion)
  - Cooldown reduction: Each operational Ion Cannon building reduces cooldown by 25%
  - Damages friendly units and buildings (use with caution!)

### 🎨 **Polish & Quality of Life**
- **Custom PNG Sprite System** - Beautiful sprite rendering for units and buildings (see [Assets & Sprites](#-assets--sprites)):
  - Sprite assets in `assets/sprites/units/` and `assets/sprites/buildings/`
  - Sprite loading and caching system
  - Smooth rotation based on movement and combat direction
  - Player color tinting for team identification
  - Animation support (sprite sheets)
  - Configurable sprite toggle in main menu and settings
  - Fallback to colored rectangles if sprites unavailable
- **Notification System** - In-game alerts with:
  - Power warnings (low/critical power)
  - Unit and building attack notifications
  - Unit lost and building destroyed alerts
  - Click-to-navigate to event location
  - Spam prevention with cooldowns and grouping
- **Fog of War** - Explored/Visible/Unexplored states with dynamic reveal system (optimized incremental updates)
- **Minimap** - Real-time strategic overview:
  - Requires Radar Dome AND sufficient power
  - Disabled when power is insufficient
  - Throttled rendering for performance
- **Save/Load System** - Save game state to localStorage with multiple save slots (preserves transport relationships)
- **Custom Maps** - Create, save, and play on custom maps with the built-in map editor
- **Production Queues** - Queue multiple units with pause/resume and cancellation
- **Rally Points** - Set unit spawn destinations
- **Unit Formations** - Create and manage formations with hotkeys (1-4)
- **Control Groups** - Assign units to groups (Ctrl+Shift+1-9) and select them (Alt+1-9)
- **Unit Selection** - Ctrl+A to select all units, double-click to select all units of same type
- **Camera Controls** - Presets (Ctrl+F1-F4 to jump, Shift+Ctrl+F1-F4 to save), edge scrolling, minimap click navigation, middle mouse pan
- **Attack Move** - Aggressive unit positioning
- **Repair Bays** - Automatic vehicle, air, and naval unit healing (naval ships when near coast)
- **Game Statistics** - Track units built, killed, money earned, and more
- **Settings Modal** - Comprehensive game options and controls reference:
  - Sprite toggle (enable/disable sprite rendering)
  - Save/Load game
  - Controls reference
- **Combat Visual Feedback** - Enhanced effects system:
  - Damage numbers with critical hit indicators
  - Projectile trails for all attacks (units and turrets)
  - Muzzle flashes at firing positions
  - Death animations
  - Tesla Coil lightning bolt effects
  - Ion Cannon charging and explosion effects
- **Power Management** - Visual power bar showing consumption percentage with color-coded warnings:
  - Continuous notifications when power is insufficient
  - Power-dependent features (defenses, minimap, production speed)

---

## 🚀 Getting Started

### Play Online
Simply visit **[itzmorphinetime.github.io/MorphWars](https://itzmorphinetime.github.io/MorphWars/)** to play instantly in your browser!

### Run Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/ItzMorphineTime/MorphWars.git
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
- **Right Click** - Move/Attack command (focus fire on enemies)
- **Drag Select** - Select multiple units
- **Shift + Click** - Add to selection
- **Double-Click Unit** - Select all units of same type
- **Ctrl+A** - Select all units
- **A + Right Click** - Attack move
- **S** - Stop selected units
- **1-4 Keys** - Create formations (Line, Box, Wedge, Column)
- **Ctrl+Shift+1-9** - Assign selected units to control group
- **Alt+1-9** - Select control group
- **Ctrl+F1-F4** - Jump to saved camera position
- **Shift+Ctrl+F1-F4** - Save current camera position
- **Middle Mouse Drag** - Pan camera
- **Mouse Edge Scrolling** - Move camera when mouse near screen edge
- **Click Minimap** - Jump camera to clicked location
- **P** - Start Power Plant construction
- **R** - Start Refinery construction
- **B** - Start Barracks construction
- **W** - Start War Factory construction
- **A** - Start Airfield construction
- **G** - Start Gun Turret construction
- **T** - Start AA Turret construction
- **F3** - Toggle performance profiler
- **ESC** - Deselect all / Cancel building placement

#### Transport Commands
- **Right-Click APC** (with infantry selected) - Embark infantry into APC
- **Right-Click Transport Ship** (with infantry, APC, or MCV selected) - Embark onto naval transport (bring transport to coast first)
- **Right-Click Transport** (with transport selected, hovering over itself) - Disembark all units at current location
- **Disembark Button** - Click in selection panel when transport is selected

### Map Editor Controls
- **1-3 Keys** - Switch tools (Terrain, Resource, Erase)
- **Q/W/E** - Select terrain type (Grass, Rock, Water)
- **R/T** - Select resource type (Ore, Gems)
- **S** - Set spawn point at cursor
- **G** - Toggle grid overlay
- **Home** - Reset camera position
- **Ctrl+S** - Save map
- **Ctrl+O** - Load map
- **Arrow Keys** - Pan camera
- **Mouse Wheel** - Zoom in/out
- **Middle Mouse / Ctrl+Drag** - Pan camera

### Getting Started
1. Deploy your MCV (Mobile Construction Vehicle) to create your base (build more MCVs from War Factory to deploy additional HQs)
2. Build Power Plants to generate energy
3. Construct Refineries and Harvesters to gather resources
4. Build Barracks/War Factory to produce military units
5. Research Tech Centers to unlock advanced units
6. Destroy enemy headquarters to win!

### Pro Tips
- 💡 Maintain positive power ratio for faster construction (visual power bar shows percentage)
- 💎 Prioritize Gem nodes for double resource income
- 🏔️ Use terrain strategically - mountains create chokepoints
- 🚁 Helicopters can fly over obstacles but need to reload
- ✈️ Airplanes require Airfields and have limited ammo - return them to base to reload
- 🐘 Mammoth Tanks are expensive but devastating - save up for advanced tech
- ⚡ Build multiple refineries near resource clusters
- 🎯 Use special powers strategically in critical moments
- ⚡⚡ Build multiple Ion Cannons to reduce superweapon cooldown (25% per building)
- ⚡ Ion Cannon and Airstrike damage friendly units - position carefully!
- 📊 Save your game frequently - multiple save slots available
- 🎖️ Formations help coordinate large armies - use hotkeys 1-4
- 🗺️ Create custom maps with the Map Editor - design unique battlefields and scenarios
- 🚢 Build PORTs on water for naval production - they work even when entirely in water and heal naval ships docked on/near them
- 🚛 Use APCs to rapidly transport infantry across the map (embarked units are protected from targeting)
- 🚢 MCVs and APCs can load onto Transport Ships - bring transport to coast, then right-click to embark
- ⚓ Naval units can approach coastlines (within 1 tile) to attack land targets
- 🔧 Repair Bays and Ports heal naval ships - dock damaged ships at ports or near coastal Repair Bays
- 🎯 Control groups (Ctrl+Shift+1-9) help manage large armies efficiently
- 🎨 Combat visual effects provide feedback on damage and attacks
- 🚜 Harvesters automatically avoid each other - build multiple refineries near resource clusters
- 📊 Use camera presets (Ctrl+F1-F4) to quickly jump between key locations
- ⌨️ Building hotkeys (P, R, B, W, A, G, T) speed up base construction
- ⚡ Tesla Coils require massive power (150) - ensure sufficient power generation
- 🎨 Toggle sprites on/off in settings for performance or visual preference
- 🖼️ Replace PNGs in `assets/sprites/` to customize unit and building visuals (see Assets & Sprites section)
- 📢 Click notifications to navigate to important events (attacks, losses)
- 🛡️ Power-dependent defenses (Tesla Coil, AA Turret) won't attack without power
- 🗺️ Minimap requires both Radar Dome AND sufficient power to function

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
- **Performance Optimized**:
  - **Frustum Culling** - Skips rendering entities outside viewport (20-40% draw call reduction)
  - **Spatial Hashing** - Grid-based collision detection for pathfinding (40-60% faster)
  - **Pathfinding Throttling** - Priority-based throttling prevents performance spikes
  - **AI Phased Processing** - Decisions split across multiple frames (50-70% overhead reduction)
  - **Entity Pooling** - Reusable objects for visual effects (reduces GC pauses)
  - **Event Debouncing** - Throttled mouse/wheel events for smoother input
  - **Terrain Color Caching** - Pre-calculated colors (30-50% rendering improvement)
  - **Minimap Throttling** - 500ms update interval with terrain caching
- **Save/Load System** - Complete game state serialization with seed preservation and transport relationships
- **Hierarchical Pathfinding** - Waypoint-based optimization for long-distance paths with size-aware caching

---

## 📁 Project Structure

```
Game/
├── index.html              # Main entry point
├── assets/
│   └── sprites/            # PNG sprite assets (see Assets & Sprites below)
│       ├── buildings/      # Building sprites (HQ, Refinery, Turrets, etc.)
│       └── units/          # Unit sprites (Tanks, APC, Harvester, Naval, etc.)
├── js/
│   ├── constants.js        # Game configuration & balance (sprite paths)
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
│   ├── utils.js            # Utility functions & pathfinding
│   ├── performance.js      # Performance profiler
│   ├── saveload.js         # Save/load system
│   ├── mapeditor.js        # Map editor system
│   ├── effects.js          # Visual effects manager
│   ├── spatialgrid.js      # Spatial hashing for pathfinding
│   ├── pool.js             # Object pooling system
│   ├── spritemanager.js    # Sprite loading and caching
│   ├── spriterenderer.js   # Sprite rendering with rotation and tinting
│   └── main.js             # Initialization
└── README.md
```

---

## 🎨 Assets & Sprites

The game uses PNG sprites for units and buildings. Sprite paths are configured in `js/constants.js`. Add or replace files in `assets/sprites/` to customize visuals.

### Unit Sprites (`assets/sprites/units/`)

| Sprite | File | Unit | Notes |
|:------:|------|------|-------|
| ![Harvester](assets/sprites/units/harvester.png) | `harvester.png` | Harvester | Resource gathering vehicle |
| ![Light Tank](assets/sprites/units/light_tank.png) | `light_tank.png` | Light Tank | Tier 1 combat vehicle |
| ![Medium Tank](assets/sprites/units/medium_tank.png) | `medium_tank.png` | Medium Tank | Tier 2 combat vehicle |
| ![APC](assets/sprites/units/apc.png) | `apc.png` | APC | Infantry transport (5 capacity) |
| ![Heavy Tank](assets/sprites/units/heavy_tank.png) | `heavy_tank.png` | Heavy Tank | Tier 3 combat vehicle |
| ![Mammoth Tank](assets/sprites/units/mammoth_tank.png) | `mammoth_tank.png` | Mammoth Tank | Super-heavy with explosive rounds |
| ![Artillery](assets/sprites/units/artillery.png) | `artillery.png` | Artillery | Long-range splash damage |
| ![Transport Ship](assets/sprites/units/transport_ship.png) | `transport_ship.png` | Transport Ship | Naval transport (50 capacity) |
| ![Warship](assets/sprites/units/warship.png) | `warship.png` | Warship | Naval combat unit |

*Infantry, helicopters, airplanes, MCV, and submarines use fallback colored rectangles if no sprite is configured.*

### Building Sprites (`assets/sprites/buildings/`)

| Sprite | File | Building | Notes |
|:------:|------|----------|-------|
| ![HQ](assets/sprites/buildings/hq.png) | `hq.png` | HQ | Headquarters (deployed from MCV) |
| ![Power Plant](assets/sprites/buildings/power_plant.png) | `power_plant.png` | Power Plant | Power generation |
| ![Refinery](assets/sprites/buildings/refinery.png) | `refinery.png` | Refinery | Resource processing, spawns harvesters |
| ![Barracks](assets/sprites/buildings/barracks.png) | `barracks.png` | Barracks | Infantry production |
| ![War Factory](assets/sprites/buildings/war_factory.png) | `war_factory.png` | War Factory | Vehicle production (including MCV) |
| ![Airfield](assets/sprites/buildings/airfield.png) | `airfield.png` | Airfield | Air unit production |
| ![Gun Turret Base](assets/sprites/buildings/gun_turret_base.png) | `gun_turret_base.png` | Gun Turret | Base structure |
| ![Gun Turret](assets/sprites/buildings/gun_turret_turret.png) | `gun_turret_turret.png` | Gun Turret | Rotating turret (separate layer) |
| ![AA Turret Base](assets/sprites/buildings/aa_turret_base.png) | `aa_turret_base.png` | AA Turret | Base structure |
| ![AA Turret](assets/sprites/buildings/aa_turret_turret.png) | `aa_turret_turret.png` | AA Turret | Rotating turret (separate layer) |
| ![PORT](assets/sprites/buildings/port.png) | `port.png` | PORT | Naval production (water placement) |
| ![Radar Dome](assets/sprites/buildings/radar_dome.png) | `radar_dome.png` | Radar Dome | Enables minimap (requires power) |

*Turret buildings use two sprites: a base and a separate rotating turret for directional aiming.*

### Sprite Requirements
- **Format**: PNG with transparency
- **Orientation**: Default facing downward (rotation applied at runtime)
- **Sizing**: Configured per-unit in `constants.js` (e.g., `size: { width: 48, height: 48 }`)
- **Tinting**: Player colors applied via multiply blend (configurable per sprite)

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

- [x] Unit formations and advanced commands ✅
- [x] Save/Load game state ✅
- [x] Map editor ✅
- [ ] Multiplayer support (WebSocket relay + host-authoritative; see [MULTIPLAYER_PLAN.MD](MULTIPLAYER_PLAN.MD))
- [ ] Campaign mode with story missions
- [ ] More unit types and factions
- [ ] Advanced terrain features (bridges, cliffs)
- [ ] Sound effects and music
- [ ] Replay system
- [ ] Modding support

For balancing research (similar RTS games, best practices, data-driven tuning) and a **prioritized list of future features**, see **[RESEARCH.MD](RESEARCH.MD)**.

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

### Testing
- **Unit tests**: Vitest (dev dependency only; game runtime stays dependency-free). See **[Unit Testing Plan](docs/UNIT_TESTING_PLAN.md)** for setup, framework choice, and test targets.
- After `npm install`, run `npm test` (watch) or `npm run test:run` (single run). Use `npm run test:coverage` for coverage.

---

## 🐛 Known Issues

- Large maps (200x200) may have slower initial generation
- Pathfinding can struggle with very dense unit clusters
- AI may occasionally build suboptimally on island maps
- Save files are stored in browser localStorage (limited to ~5-10MB)

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
- Reach out via [Contact](https://joeloe.co.uk/)

---

## 🌟 Show Your Support

If you enjoyed this project, please consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs
- 💡 Suggesting features
- 🔀 Contributing code

---

**[🎮 Start Playing Now!](https://itzmorphinetime.github.io/MorphWars/)**

*Made with ❤️ and JavaScript*
