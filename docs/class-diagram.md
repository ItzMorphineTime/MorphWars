# RTS Game - Class Diagram

This document contains the comprehensive class diagram for the RTS game, showing all classes, their properties, methods, and relationships.

## Class Diagram

```mermaid
classDiagram
    %% Core Entity Hierarchy
    class Entity {
        +int id
        +string type
        +Player owner
        +float x
        +float y
        +Object stats
        +float hp
        +int veterancy
        +int kills
        +bool selected
        +constructor(x, y, type, stats, owner)
        +update(deltaTime, game)
        +render(ctx, camera)
        +takeDamage(amount, game)
        +heal(amount)
        +isAlive() bool
        +destroy(game)
        +gainExperience()
        +applyVeterancyBonus()
    }

    class Unit {
        +Array~Object~ path
        +int pathIndex
        +Entity targetEnemy
        +string stance
        +bool isHarvester
        +bool isBuilder
        +int cargo
        +int collisionCount
        +int lastCollisionTime
        +int collisionCooldown
        +int destinationChangeCount
        +Object originalDestination
        +int lastCombatPathTime
        +int lastTargetSearchTime
        +int lastStuckCheck
        +Object lastPosition
        +int stuckCount
        +moveTo(x, y, game)
        +attackMove(x, y, game)
        +updateMovement(deltaTime, game)
        +updateCombat(deltaTime, game)
        +updateHarvester(deltaTime, game)
        +findNearestEnemy(game) Entity
        +findNearestRefinery(game) Building
        +findNearestResource(game) Object
        +findNearestEmptyTile(game, x, y) Object
        +attack(target)
        +checkStuckState(game)
    }

    class Building {
        +int tileX
        +int tileY
        +int width
        +int height
        +Array~string~ buildQueue
        +int buildProgress
        +Object currentBuild
        +bool isHQ
        +bool isRefinery
        +bool isRepairBay
        +bool isSuperweapon
        +addToBuildQueue(unitType)
        +updateProduction(deltaTime, player)
        +cancelProduction()
        +getSpawnPosition(game) Object
        +checkSpawnPerimeter(game, centerX, centerY) Object
    }

    Entity <|-- Unit
    Entity <|-- Building

    %% Game Management Classes
    class Game {
        +GameMap map
        +Array~Player~ players
        +Player currentPlayer
        +Renderer renderer
        +InputHandler input
        +UIController ui
        +Array~AIController~ aiControllers
        +int lastUpdateTime
        +init()
        +run()
        +update(deltaTime)
        +render()
        +createPlayer(id, name, isAI)
        +spawnUnit(player, unitType, x, y)
        +spawnBuilding(player, buildingType, tileX, tileY)
        +handleUnitDeath(unit)
        +handleBuildingDestruction(building)
    }

    class Player {
        +int id
        +string name
        +string color
        +int credits
        +int power
        +int powerUsed
        +Array~Unit~ units
        +Array~Building~ buildings
        +bool isAI
        +int currentTier
        +Object specialPowers
        +Array~Array~ fogOfWar
        +addCredits(amount)
        +spendCredits(amount) bool
        +canBuild(type, isUnit) bool
        +updatePower()
        +updateFogOfWar(map)
        +revealArea(x, y, radius)
        +getTileVisibility(x, y) int
        +unlockTier(tier)
    }

    class AIController {
        +Player player
        +string difficulty
        +Object config
        +string state
        +int lastUpdate
        +int lastScout
        +int lastSpread
        +int lastMassAttack
        +bool massAttackInitiated
        +update(deltaTime)
        +decideAction(owned)
        +buildEconomy(owned)
        +buildMilitary(owned)
        +launchAttack(owned)
        +launchMassAttack(owned)
        +rejoinMassAttack(owned)
        +scoutMap(owned)
        +spreadUnits(owned)
        +findEnemyHQ() Building
        +findExpansionLocation() Object
    }

    Game "1" --> "1" GameMap
    Game "1" --> "*" Player
    Game "1" --> "1" Renderer
    Game "1" --> "1" InputHandler
    Game "1" --> "1" UIController
    Game "1" --> "*" AIController
    Player "1" --> "*" Unit
    Player "1" --> "*" Building
    AIController "1" --> "1" Player
    AIController "1" --> "1" Game

    %% Map and Rendering
    class GameMap {
        +int width
        +int height
        +string mapType
        +Array~Object~ tiles
        +Array~Object~ resourceNodes
        +HeightMapGenerator heightMapGenerator
        +constructor(width, height, mapType, skipResourceGeneration, terrainSeed, customMapData)
        +getTile(x, y) Object
        +isTileBlocked(x, y, size, isHarvester, isNaval) bool
        +isBuildingPlacementValid(x, y, width, height) bool
        +setBuilding(x, y, width, height, building)
        +clearBuilding(x, y, width, height)
        +findNearestResource(x, y) Object
        +update(deltaTime)
        +loadCustomMap(data)
        +generateTerrainWithHeightMap(seed)
        +placeResourceNodes()
    }

    class Renderer {
        +HTMLCanvasElement canvas
        +CanvasRenderingContext2D ctx
        +Object camera
        +init(canvas)
        +render(game)
        +renderMap(map, player)
        +renderFogOfWar(map, player)
        +renderEntities(entities, camera, player)
        +renderSelectionBox(selection)
        +renderMinimap(game, player)
        +worldToScreen(x, y) Object
        +screenToWorld(x, y) Object
    }

    %% Input and UI
    class InputHandler {
        +HTMLCanvasElement canvas
        +Object camera
        +Object mouse
        +Set~string~ keys
        +Array~Unit~ selectedUnits
        +Object selectionBox
        +bool isDragging
        +setupEventListeners()
        +onMouseDown(event)
        +onMouseUp(event)
        +onMouseMove(event)
        +onWheel(event)
        +handleLeftClick(worldX, worldY, game)
        +handleRightClick(worldX, worldY, game)
        +selectUnitsInBox(box, player)
        +issueOrderToSelected(x, y, game)
    }

    class UIController {
        +HTMLElement buildMenuEl
        +HTMLElement statsEl
        +HTMLElement minimapEl
        +Object game
        +init(game)
        +setupBuildMenu(player)
        +updateStats(player)
        +updateBuildButtonStates(player)
        +handleBuildClick(type, isUnit, player)
        +showNotification(message)
    }

    %% Pooling, Spatial, and Utilities
    class ObjectPool {
        +Function createFn
        +Function resetFn
        +Array pool
        +Set active
        +acquire() Object
        +release(obj)
        +releaseAll()
        +getActiveCount() int
        +getPoolSize() int
    }

    class EffectsPool {
        +ObjectPool damageNumbers
        +ObjectPool projectiles
        +ObjectPool muzzleFlashes
    }

    class SpatialGrid {
        +GameMap map
        +int cellSize
        +Map grid
        +bool dirty
        +buildGrid()
        +getBlockedTilesInArea(centerX, centerY, radius) Set
        +isTileBlocked(x, y, size, isHarvester, isNaval) bool
    }

    class SpriteManager {
        +Map cache
        +loadSprite(path) Promise
        +loadSpriteSheet(path, config) Promise
        +getSprite(path) Image
        +getFrame(sheetPath, frameName) Object
        +hasSprite(path) bool
        +hasFailed(path) bool
        +preloadSprites(spriteConfigs, onProgress) Promise
        +clearCache()
    }

    class SpriteRenderer {
        +SpriteManager spriteManager
        +CanvasRenderingContext2D ctx
        +renderUnit(unit, camera)
        +renderBuilding(building, camera)
        +renderTurret(building, turretConfig, baseX, baseY, baseW, baseH)
        +getUnitAngle(unit, rotationConfig) float
        +getAnimationState(unit) string
    }

    class PerlinNoise {
        +Array permutation
        +noise2D(x, y) float
    }

    class HeightMapGenerator {
        +PerlinNoise perlin
        +getHeight(x, y) float
        +isValidLandTile(x, y, mapType) bool
    }

    class EffectsManager {
        +Game game
        +Array damageNumbers
        +Array projectiles
        +Array muzzleFlashes
        +Array deathAnimations
        +addDamageNumber(x, y, damage, isCritical)
        +addProjectile(fromX, fromY, toX, toY, damageType)
        +update(deltaTime)
        +render(ctx, camera)
    }

    class SaveLoadManager {
        +save(game, name) string
        +load(name) Object
        +listSaves() Array
        +deleteSave(name)
    }

    class MapEditor {
        +GameMap map
        +string mode
        +int brushSize
        +activate()
        +deactivate()
        +handleInput(game)
    }

    GameMap "1" --> "0..1" HeightMapGenerator
    HeightMapGenerator --> PerlinNoise
    Game "1" --> "0..1" MapEditor
    Game "1" --> "1" EffectsManager
    MapEditor "1" --> "1" GameMap
    Renderer ..> SpriteRenderer : uses
    SpriteRenderer --> SpriteManager
    EffectsManager ..> EffectsPool : optional pooling

    %% Utility Note
    note for Entity "Base class for all game entities (units and buildings)"
    note for Unit "Handles movement, combat, pathfinding, and harvesting"
    note for Building "Handles production queues and unit spawning"
    note for AIController "AI state machine with economy, military, and attack states"
    note for GameMap "Tile-based map with fog of war and resource management"
    note for ObjectPool "Object pooling for effects; see UNIT_TESTING_PLAN"
    note for SpatialGrid "Spatial hashing for pathfinding; used by findPath"
```

## Class Relationships Summary

### Inheritance
- **Entity** is the base class
  - **Unit** extends Entity (adds movement, combat, harvesting)
  - **Building** extends Entity (adds production, spawning)

### Composition
- **Game** contains:
  - 1 GameMap
  - Multiple Players
  - 1 Renderer
  - 1 InputHandler
  - 1 UIController
  - Multiple AIControllers (one per AI player)

- **Player** contains:
  - Multiple Units
  - Multiple Buildings
  - Fog of War grid

- **AIController** references:
  - 1 Player (the AI player)
  - 1 Game (for access to other players and map)

### Key Systems

#### Combat System
- Units track `targetEnemy` (Entity reference)
- Combat updates throttled by `lastCombatPathTime` and `lastTargetSearchTime`
- Damage multipliers based on armor type and damage type

#### Movement System
- Units use A* pathfinding with `path` array
- Collision detection with cooldown system (`collisionCooldown`, `collisionCount`)
- Stuck detection for harvesters (`lastStuckCheck`, `stuckCount`)
- Original destination tracking for collision resolution

#### Production System
- Buildings have `buildQueue` and `buildProgress`
- Production consumes player credits and power
- Units spawn at building perimeter using `getSpawnPosition()`

#### Fog of War
- Each Player has 2D `fogOfWar` array
- Tile visibility states: unexplored (0), explored (1), visible (2)
- Updated based on unit/building sight ranges

#### AI System
- State machine: build, expand, attack, defend, mass_attack
- Periodic behaviors: scouting, unit spreading, mass attacks
- Difficulty levels control update intervals and thresholds

### Utils and Globals

- **`utils.js`** exposes global functions: `distance`, `distanceTiles`, `clamp`, `lerp`, `normalizeVector`, `pointInRect`, `rectIntersect`, `worldToTile`, `tileToWorld`, `canPlaceBuilding`, `findPath`, `findPathDirect`, `findPathHierarchical`, `findNearestValidTile`, `getCachedPath`, `cachePath`, `clearPathfindingCache`, `formatTime`, `getRandomInt`, `shuffle`, `validateEntity`, `safeCall`, `validateMapCoordinates`, `createFormation`.
- **NotificationManager** and **Formation** are classes in `utils.js`.

---

## Testing

Unit tests target pure logic and isolated modules first. See **[UNIT_TESTING_PLAN](UNIT_TESTING_PLAN.md)** for framework choice (Vitest), setup, and implementation plan.

### Unit test targets (priority order)

| Priority | Module | Targets |
|----------|--------|---------|
| **P0** | `utils.js` | `distance`, `clamp`, `lerp`, `pointInRect`, `rectIntersect`, `worldToTile`, `tileToWorld`, `canPlaceBuilding`, `getRandomInt`, `shuffle` |
| **P1** | `utils.js` | `findPath`, `findPathDirect`, `findPathHierarchical`, `findNearestValidTile`, path cache helpers |
| **P1** | `pool.js` | `ObjectPool` (acquire, release, releaseAll, counts) |
| **P2** | `entity.js` | `Entity` (`takeDamage`, `heal`, `isAlive`, veterancy) |
| **P2** | `spatialgrid.js` | `SpatialGrid` (`buildGrid`, `isTileBlocked`, `getBlockedTilesInArea`) |
| **P2** | `map.js` | `GameMap` (`getTile`, `isTileBlocked`, `isValidSpawnTile`) |
| **P3** | `unit.js`, `building.js`, `ai.js` | Movement, production, AI decision logic (with mocks) |
| **P4** | `spritemanager.js`, `spriterenderer.js` | Loading, fallbacks, layout (mock canvas/Image) |

Run tests via `npm test` (watch) or `npm run test:run` once Vitest is configured per the plan.
