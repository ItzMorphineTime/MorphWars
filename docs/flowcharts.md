# RTS Game - Logic Flowcharts

This document contains comprehensive flowcharts showing the logic flow for major game systems.

## Table of Contents
1. [Main Game Loop](#main-game-loop)
2. [Unit Update Logic](#unit-update-logic)
3. [Unit Movement System](#unit-movement-system)
4. [Unit Combat System](#unit-combat-system)
5. [Harvester State Machine](#harvester-state-machine)
6. [AI Decision Making](#ai-decision-making)
7. [Pathfinding Algorithm](#pathfinding-algorithm-a)
8. [Building Production System](#building-production-system)

---

## Main Game Loop

```mermaid
flowchart TD
    Start([Game Start]) --> Init[Initialize Game]
    Init --> CreateMap[Create Map & Resources]
    CreateMap --> CreatePlayers[Create Players]
    CreatePlayers --> SpawnStartUnits[Spawn Starting Units/Buildings]
    SpawnStartUnits --> GameLoop{Game Loop}

    GameLoop --> CalcDelta[Calculate deltaTime]
    CalcDelta --> UpdateGame[Update Game State]

    UpdateGame --> UpdatePlayers[Update Each Player]
    UpdatePlayers --> UpdateFog[Update Fog of War]
    UpdateFog --> UpdateUnits[Update All Units]
    UpdateUnits --> UpdateBuildings[Update All Buildings]
    UpdateBuildings --> UpdateAI[Update AI Controllers]

    UpdateAI --> Render[Render Frame]
    Render --> RenderMap[Render Map & Tiles]
    RenderMap --> RenderFog[Render Fog of War]
    RenderFog --> RenderEntities[Render Units & Buildings]
    RenderEntities --> RenderUI[Render UI Elements]
    RenderUI --> RenderMinimap[Render Minimap]

    RenderMinimap --> CheckGameOver{Game Over?}
    CheckGameOver -->|No| GameLoop
    CheckGameOver -->|Yes| EndGame([End Game])
```

---

## Unit Update Logic

```mermaid
flowchart TD
    Start([Unit Update]) --> CheckAlive{Is Unit Alive?}
    CheckAlive -->|No| Return([Return])
    CheckAlive -->|Yes| IsHarvester{Is Harvester?}

    IsHarvester -->|Yes| UpdateHarvester[Update Harvester Logic]
    IsHarvester -->|No| HasDamage{Has Damage Stats?}

    HasDamage -->|Yes| UpdateCombat[Update Combat]
    HasDamage -->|No| UpdateMove[Update Movement]

    UpdateHarvester --> UpdateMove
    UpdateCombat --> UpdateMove

    UpdateMove --> CheckStuck{Check Stuck State}
    CheckStuck --> UpdateAnimation[Update Animation]
    UpdateAnimation --> Return
```

---

## Unit Movement System

```mermaid
flowchart TD
    Start([Update Movement]) --> HasPath{Has Path?}
    HasPath -->|No| Return([Return])
    HasPath -->|Yes| IsAir{Is Air Unit?}

    IsAir -->|Yes| MoveAir[Move Without Collision]
    IsAir -->|No| CheckCooldown{Collision Cooldown > 0?}

    CheckCooldown -->|Yes| DecrementCooldown[Decrease Cooldown]
    DecrementCooldown --> Return

    CheckCooldown -->|No| GetNextTile[Get Next Path Tile]
    GetNextTile --> CheckBlocked{Is Tile Blocked?}

    CheckBlocked -->|No| MoveToTile[Move Toward Tile]
    CheckBlocked -->|Yes| IncrementCollision[Increment Collision Count]

    IncrementCollision --> CheckMaxCollisions{Collision Count >= Max?}
    CheckMaxCollisions -->|Yes| ClearPath[Clear Path & Reset]
    CheckMaxCollisions -->|No| SetCooldown[Set Collision Cooldown]

    SetCooldown --> CheckDestChanges{Dest Changes >= Max?}
    CheckDestChanges -->|Yes| ClearPath
    CheckDestChanges -->|No| FindAltTile[Find Nearest Empty Tile]

    FindAltTile --> HasAltTile{Found Empty Tile?}
    HasAltTile -->|Yes| RecalcPath[Recalculate Path]
    HasAltTile -->|No| ClearPath

    RecalcPath --> IncrementDestChange[Increment Dest Change Count]
    IncrementDestChange --> ResetCollisionCount[Reset Collision Count]
    ResetCollisionCount --> Return

    MoveToTile --> AtTile{Reached Tile?}
    AtTile -->|Yes| NextPathIndex[Move to Next Path Node]
    AtTile -->|No| Return

    NextPathIndex --> PathComplete{Path Complete?}
    PathComplete -->|Yes| ClearPath
    PathComplete -->|No| Return

    MoveAir --> Return
    ClearPath --> Return
```

---

## Unit Combat System

```mermaid
flowchart TD
    Start([Update Combat]) --> HasPath{Has Movement Path?}
    HasPath -->|Yes & No Target| Return([Return - Movement Priority])
    HasPath -->|No| CheckTarget{Has Target Enemy?}

    CheckTarget -->|Yes| ValidTarget{Target Valid?}
    ValidTarget -->|No| SearchEnemy
    ValidTarget -->|Yes| CalcDist[Calculate Distance to Target]

    CheckTarget -->|No| CheckStance{Stance = Aggressive?}
    CheckStance -->|No| Return
    CheckStance -->|Yes| CheckSearchCooldown{Search Cooldown Expired?}

    CheckSearchCooldown -->|No| Return
    CheckSearchCooldown -->|Yes| SearchEnemy[Search for Nearest Enemy]

    SearchEnemy --> FoundEnemy{Found Enemy?}
    FoundEnemy -->|No| Return
    FoundEnemy -->|Yes| UpdateSearchTime[Update Last Search Time]
    UpdateSearchTime --> CalcDist

    CalcDist --> InRange{Distance <= Range?}
    InRange -->|Yes| CheckAttackCD{Attack Cooldown Ready?}
    InRange -->|No| CheckPathCooldown{Path Cooldown Expired?}

    CheckPathCooldown -->|No| Return
    CheckPathCooldown -->|Yes| NeedPath{Needs New Path?}

    NeedPath -->|Yes| CalcPath[Calculate Path to Enemy]
    NeedPath -->|No| Return

    CalcPath --> UpdatePathTime[Update Last Path Time]
    UpdatePathTime --> Return

    CheckAttackCD -->|No| Return
    CheckAttackCD -->|Yes| AttackEnemy[Deal Damage to Enemy]

    AttackEnemy --> ResetAttackCD[Reset Attack Cooldown]
    ResetAttackCD --> CheckDead{Enemy Destroyed?}

    CheckDead -->|Yes| ClearTarget[Clear Target Enemy]
    CheckDead -->|No| Return

    ClearTarget --> Return
```

---

## Harvester State Machine

```mermaid
flowchart TD
    Start([Update Harvester]) --> CheckCargo{Cargo > 0?}

    CheckCargo -->|Yes| StateReturning[State: Returning to Refinery]
    CheckCargo -->|No| StateHarvesting[State: Going to Resource]

    StateReturning --> HasRefinery{Has Target Refinery?}
    HasRefinery -->|No| FindRefinery[Find Nearest Refinery]
    FindRefinery --> FoundRef{Found Refinery?}
    FoundRef -->|No| Idle[Stop - No Refinery]
    FoundRef -->|Yes| PathToRef[Path to Refinery]

    HasRefinery -->|Yes| AtRefinery{At Refinery?}
    AtRefinery -->|No| Continue1([Continue Path])
    AtRefinery -->|Yes| DepositCargo[Deposit Cargo to Player Credits]
    DepositCargo --> ResetCargo[Reset Cargo to 0]
    ResetCargo --> ClearRefTarget[Clear Refinery Target]

    StateHarvesting --> HasResource{Has Target Resource?}
    HasResource -->|No| FindResource[Find Nearest Resource]
    FindResource --> FoundRes{Found Resource?}
    FoundRes -->|No| Idle
    FoundRes -->|Yes| PathToRes[Path to Resource]

    HasResource -->|Yes| AtResource{At Resource?}
    AtResource -->|No| Continue2([Continue Path])
    AtResource -->|Yes| HarvestRate[Harvest at Rate]
    HarvestRate --> IncrementCargo[Increment Cargo]
    IncrementCargo --> DepleteTile[Deplete Tile Resource]

    DepleteTile --> TileDepleted{Tile Depleted?}
    TileDepleted -->|Yes| ClearResTarget[Clear Resource Target]
    TileDepleted -->|No| CargoFull{Cargo >= Max?}

    CargoFull -->|Yes| ClearResTarget
    CargoFull -->|No| Continue2

    ClearResTarget --> CheckStuck[Check Stuck State]
    ClearRefTarget --> CheckStuck
    Continue1 --> CheckStuck
    Continue2 --> CheckStuck
    Idle --> CheckStuck
    PathToRef --> CheckStuck
    PathToRes --> CheckStuck

    CheckStuck --> StuckCheck{Time for Stuck Check?}
    StuckCheck -->|No| Return([Return])
    StuckCheck -->|Yes| CalcMovement[Calculate Distance Moved]

    CalcMovement --> MovedEnough{Moved > Threshold?}
    MovedEnough -->|Yes| ResetStuck[Reset Stuck Count]
    MovedEnough -->|No| IncrementStuck[Increment Stuck Count]

    IncrementStuck --> TooStuck{Stuck Count > Max?}
    TooStuck -->|Yes| ForceRepath[Clear Path & Find New Resource]
    TooStuck -->|No| UpdatePos[Update Last Position]

    ResetStuck --> UpdatePos
    ForceRepath --> UpdatePos
    UpdatePos --> Return
```

---

## AI Decision Making

```mermaid
flowchart TD
    Start([AI Update]) --> CheckInterval{Update Interval Elapsed?}
    CheckInterval -->|No| Return([Return])
    CheckInterval -->|Yes| GetOwned[Get Owned Units & Buildings]

    GetOwned --> CountUnits[Count Combat Units]
    CountUnits --> CurrentState{Current State?}

    CurrentState -->|mass_attack| CheckMassEnd{Units < End Threshold?}
    CheckMassEnd -->|Yes| EndMassAttack[State = build]
    CheckMassEnd -->|No| CheckRejoin{Rejoin Interval Elapsed?}

    CheckRejoin -->|Yes| RejoinAttack[Send Idle Units to Attack]
    CheckRejoin -->|No| PeriodicTasks

    EndMassAttack --> ResetMassFlag[massAttackInitiated = false]
    ResetMassFlag --> PeriodicTasks
    RejoinAttack --> PeriodicTasks

    CurrentState -->|Other States| CheckMassStart{Units >= Max Limit?}
    CheckMassStart -->|Yes & Not Initiated & CD Ready| StartMass[State = mass_attack]
    CheckMassStart -->|No| DecideAction[Decide Next Action]

    StartMass --> SetMassFlag[massAttackInitiated = true]
    SetMassFlag --> LaunchMass[Launch Mass Attack]
    LaunchMass --> PeriodicTasks

    DecideAction --> HasHQ{Has HQ?}
    HasHQ -->|No| PeriodicTasks
    HasHQ -->|Yes| NeedsEconomy{Needs Economy Buildings?}

    NeedsEconomy -->|Yes| BuildEcon[Build Power/Refinery/Harvester]
    NeedsEconomy -->|No| NeedsMilitary{Needs Military Buildings?}

    NeedsMilitary -->|Yes| BuildMil[Build Barracks/War Factory]
    NeedsMilitary -->|No| HasEnoughUnits{Combat Units >= Attack Threshold?}

    HasEnoughUnits -->|Yes| LaunchAttack[Launch Attack Wave]
    HasEnoughUnits -->|No| ProduceUnits[Queue Unit Production]

    BuildEcon --> PeriodicTasks
    BuildMil --> PeriodicTasks
    LaunchAttack --> PeriodicTasks
    ProduceUnits --> PeriodicTasks

    PeriodicTasks --> ScoutTime{Scout Interval Elapsed?}
    ScoutTime -->|Yes| SendScout[Send 1-2 Units to Scout]
    ScoutTime -->|No| SpreadTime{Spread Interval Elapsed?}

    SendScout --> SpreadTime
    SpreadTime -->|Yes| SpreadUnits[Spread Idle Units Around Base]
    SpreadTime -->|No| UpdateComplete[Update Last Update Time]

    SpreadUnits --> UpdateComplete
    UpdateComplete --> Return
```

---

## Pathfinding Algorithm (A*)

```mermaid
flowchart TD
    Start([Find Path]) --> Initialize[Initialize Data Structures]
    Initialize --> CreateMaps[Create openSet, closedSet, gScore, fScore Maps]
    CreateMaps --> AddStart[Add Start Node to openSet]
    AddStart --> SetStartG[gScore start = 0]
    SetStartG --> SetStartF[fScore start = heuristic to goal]

    SetStartF --> LoopStart{openSet Not Empty?}
    LoopStart -->|No| NoPath([Return null - No Path])
    LoopStart -->|Yes| CheckIterations{Iterations < Max?}

    CheckIterations -->|No| NoPath
    CheckIterations -->|Yes| FindLowest[Find Node with Lowest fScore]

    FindLowest --> IsGoal{Current = Goal?}
    IsGoal -->|Yes| ReconstructPath[Reconstruct Path from cameFrom]
    IsGoal -->|No| RemoveFromOpen[Remove Current from openSet]

    ReconstructPath --> ReturnPath([Return Path Array])

    RemoveFromOpen --> AddToClosed[Add Current to closedSet]
    AddToClosed --> GetNeighbors{Cardinal Only?}

    GetNeighbors -->|Yes| FourNeighbors[Get 4 Cardinal Neighbors]
    GetNeighbors -->|No| EightNeighbors[Get 8 Neighbors with Diagonals]

    FourNeighbors --> IterateNeighbors
    EightNeighbors --> IterateNeighbors

    IterateNeighbors[For Each Neighbor] --> InBounds{Neighbor In Bounds?}
    InBounds -->|No| NextNeighbor[Next Neighbor]
    InBounds -->|Yes| InClosed{In closedSet?}

    InClosed -->|Yes| NextNeighbor
    InClosed -->|No| IsBlocked{Tile Blocked?}

    IsBlocked -->|Yes & Not Goal| NextNeighbor
    IsBlocked -->|No| CalcTentativeG[Calculate tentativeG]

    CalcTentativeG --> IsDiagonal{Is Diagonal Move?}
    IsDiagonal -->|Yes| DiagCost[Movement Cost = 1.414]
    IsDiagonal -->|No| CardCost[Movement Cost = 1]

    DiagCost --> AddCost[tentativeG = gScore current + cost]
    CardCost --> AddCost

    AddCost --> GetCurrentG[Get neighbor's current gScore]
    GetCurrentG --> IsBetter{tentativeG < currentG?}

    IsBetter -->|No| NextNeighbor
    IsBetter -->|Yes| UpdateCameFrom[cameFrom neighbor = current]
    UpdateCameFrom --> UpdateGScore[gScore neighbor = tentativeG]
    UpdateGScore --> CalcHeuristic[Calculate heuristic to goal]
    CalcHeuristic --> UpdateFScore[fScore = gScore + heuristic]

    UpdateFScore --> InOpen{Neighbor in openSet?}
    InOpen -->|Yes| NextNeighbor
    InOpen -->|No| AddToOpen[Add neighbor to openSet]

    AddToOpen --> NextNeighbor
    NextNeighbor --> MoreNeighbors{More Neighbors?}
    MoreNeighbors -->|Yes| IterateNeighbors
    MoreNeighbors -->|No| IncrementIter[Increment Iterations]

    IncrementIter --> LoopStart
```

---

## Building Production System

```mermaid
flowchart TD
    Start([Update Production]) --> HasQueue{Build Queue > 0?}
    HasQueue -->|No| Return([Return])
    HasQueue -->|Yes| HasCurrent{Has Current Build?}

    HasCurrent -->|No| StartNew[Start Next in Queue]
    HasCurrent -->|Yes| UpdateProgress[Increment Build Progress]

    StartNew --> GetType[Get Unit/Building Type]
    GetType --> SetCurrent[Set currentBuild]
    SetCurrent --> InitProgress[buildProgress = 0]
    InitProgress --> UpdateProgress

    UpdateProgress --> CheckComplete{Progress >= Build Time?}
    CheckComplete -->|No| Return
    CheckComplete -->|Yes| IsUnit{Is Unit?}

    IsUnit -->|Yes| FindSpawn[Find Spawn Position]
    IsUnit -->|No| IsBuilding[Is Building Type?]

    FindSpawn --> CheckPerimeter[Check 1-Tile Perimeter]
    CheckPerimeter --> FoundSpot{Found Empty Tile?}

    FoundSpot -->|No| WaitForSpace[Wait - Keep in Queue]
    FoundSpot -->|Yes| SpawnUnit[Create Unit at Position]

    WaitForSpace --> Return

    SpawnUnit --> AddToPlayer[Add Unit to Player]
    AddToPlayer --> CompleteBuild

    IsBuilding --> UnlockTech{Is Tech Building?}
    UnlockTech -->|Yes| UnlockTier[Unlock Next Tier]
    UnlockTech -->|No| CompleteBuild

    UnlockTier --> CompleteBuild[Complete Build]

    CompleteBuild --> RemoveFromQueue[Remove from Build Queue]
    RemoveFromQueue --> ClearCurrent[currentBuild = null]
    ClearCurrent --> UpdatePower[Update Player Power]
    UpdatePower --> Return
```

---

## System Integration Notes

### Performance Optimizations
- **Pathfinding**: Uses Map data structure for O(1) lookups instead of Array O(n)
- **Combat**: Throttled with `COMBAT_PATH_COOLDOWN` (500ms) and `TARGET_SEARCH_COOLDOWN` (1000ms)
- **Collision**: Uses cooldown system to prevent infinite retry loops
- **AI**: Updates at intervals based on difficulty (2-6 seconds)

### Key Constants Referenced
- `COLLISION_CONFIG`: Cooldowns and limits for collision system
- `UNIT_BEHAVIOR`: Cooldowns for combat, pathfinding, and stuck detection
- `AI_BEHAVIOR`: Thresholds and intervals for AI decision-making
- `PATHFINDING`: Max iterations and diagonal movement flag
- `DEBUG_LOGGING`: Toggle flags for different logging categories

### State Machines
- **AI States**: build → expand → attack → defend → mass_attack
- **Harvester States**: harvesting (going to resource) ↔ returning (going to refinery)
- **Unit Stances**: hold_position, defensive, aggressive
- **Fog States**: unexplored (0) → explored (1) ↔ visible (2)
