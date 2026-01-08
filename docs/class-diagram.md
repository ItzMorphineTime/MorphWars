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
        +bool selected
        +init(id, type, x, y, owner, stats)
        +update(deltaTime, game)
        +render(ctx, camera)
        +takeDamage(amount)
        +isAlive() bool
        +destroy(game)
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
        +Array~Array~ tiles
        +Array~Object~ resources
        +init(width, height)
        +getTile(x, y) Object
        +isTileBlocked(x, y, size) bool
        +isBuildingPlacementValid(x, y, width, height) bool
        +setBuilding(x, y, width, height, building)
        +clearBuilding(x, y, width, height)
        +findNearestResource(x, y) Object
        +generateResources()
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

    Game "1" --> "1" GameMap
    Game "1" --> "1" Renderer
    Game "1" --> "1" InputHandler
    Game "1" --> "1" UIController

    %% Utility Note
    note for Entity "Base class for all game entities (units and buildings)"
    note for Unit "Handles movement, combat, pathfinding, and harvesting"
    note for Building "Handles production queues and unit spawning"
    note for AIController "AI state machine with economy, military, and attack states"
    note for GameMap "Tile-based map with fog of war and resource management"
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
