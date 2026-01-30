# RTS Research: Balancing & Future Features

This document summarizes research into similar RTS games, best practices for balance management, and a prioritized list of future features for Morph Wars.

---

## 1. Similar RTS Games & Their Balance Approach

### Command & Conquer (Westwood / EA)

- **Economy**: Single resource (Tiberium/Crystals); harvesters and refineries. Minimal “speed bumps”—early rushes can dominate. Later titles (e.g. C&C3) added more pacing.
- **Units**: Faction-specific rosters; cost, HP, damage, and range drive balance. No formal supply cap in many entries; balance relies on cost and production time.
- **Tech**: Building-gated (Barracks → War Factory → Tech Center). Tier unlocks control when advanced units appear.
- **Takeaway**: Our game’s C&C-inspired economy and building-gated tech align with this. Consider adding light “speed bumps” (e.g. build times, early-unit limits) to reduce rush volatility.

### StarCraft / StarCraft II

- **Economy**: Two resources (minerals, gas); workers, bases, and expansion pressure. Strong emphasis on map control and worker count.
- **Units**: **Supply cap** limits army size and forces trade-offs (economy vs army). Unit cost, HP, DPS, range, and **armor/weapon type** (damage multipliers) are core balance levers.
- **Tech**: Building + research; early units stay relevant via upgrades. Rock–paper–scissors (RPS) matchups prevent one dominant comp.
- **Balance process**: Patches driven by **win rates**, **pick/ban rates**, and pro play. Data + playtesting over “gut feel” as complexity grows.
- **Takeaway**: Our `DAMAGE_MULTIPLIERS` (bullet/rocket/shell/explosive vs none/light/medium/heavy) already implement RPS. Optional supply/pop cap could improve late-game pacing.

### Age of Empires

- **Economy**: Multiple resources (food, wood, gold, stone); villagers and gathering rates. Strong “speed bumps” via tech and age progression.
- **Units**: Counters and tech upgrades; civ-specific bonuses. Balance tuned around cost efficiency and upgrade paths.
- **Tech**: Age-based gates + research trees. Pacing is explicit (you can’t skip ages).
- **Takeaway**: Multi-resource and age-style gates are possible future directions; our dual resource (credits from ore/gems) is simpler and already in a good place.

### Grey Goo / Company of Heroes 2 (modern examples)

- **Economy**: Streamlined; focus on map control and combat rather than heavy macro. Fewer “speed bumps” in some C&C-style games led to volatile early games; these titles tuned economy to reduce that.
- **Takeaway**: “Speed bumps” (upkeep, build delays, early limits) are a proven tool when we want more stable early-game pacing.

---

## 2. Best Practices for Managing Balance

### 2.1 Core Systems to Balance

Research and industry practice consistently single out these areas:

| System | What to tune | Our game |
|--------|----------------|----------|
| **Units** | Cost, HP, damage, range, attack speed, armor/weapon type, size, tier | `UNIT_TYPES` in `constants.js`; `DAMAGE_MULTIPLIERS` |
| **Economy** | Gather rates, resource value, build times, starting resources | `RESOURCE_CONFIG`, `UNIT_TYPES` (harvester, refinery), `BUILDING_TYPES` |
| **Tech tree** | Unlock order, tier gates, building prerequisites | `tier` on units/buildings; `BUILDING_TYPES` prerequisites |
| **AI** | Decision intervals, thresholds, economy vs military weight | `AI_CONFIG` (easy/medium/hard) |
| **Maps** | Resource placement, chokepoints, base distance | Map gen in `map.js`; custom maps |

Keeping all balance knobs in **one place** (`constants.js`) is good; consider a **balance spreadsheet** that mirrors these values for quick iteration and patch notes.

### 2.2 Data-Driven Tuning

- **Spreadsheet / config**: Maintain a spreadsheet (or exported JSON) with unit/building stats. Use it to:
  - Compare cost vs DPS, cost vs HP, and “cost efficiency”
  - Check RPS: e.g. “Infantry (bullet) vs Light (0.5x) vs Heavy (0.2x)” so counters are clear
- **Metrics** (when we have multiplayer or replays):
  - Win rate by faction / map / first 5 min
  - Unit/build usage and win rate when built
  - Game length distribution
- **Playtesting**: Regular sessions with clear questions (e.g. “Is early rush too strong?”). Prefer **real match data** over single-unit vacuum tests.

### 2.3 Rock–Paper–Scissors (Intransitive Design)

- **Why**: Prevents one dominant strategy; keeps multiple units and comps viable.
- **How**: Damage multipliers (we have this), hard counters (e.g. AA vs air), and cost/range/speed trade-offs.
- **Our game**: `DAMAGE_MULTIPLIERS` (bullet, rocket, shell, explosive, aa, tesla) vs armor (none, light, medium, heavy) already define RPS. When adding units or factions, check that new damage/armor types don’t flatten these relationships.

### 2.4 “Speed Bumps” for Pacing

- **Concept**: Mechanics that slow early-game volatility so both players reach mid-game.
- **Examples**: Build time on first barracks, upkeep costs, population/supply cap, or a short “grace period” where certain units are unavailable.
- **Our game**: We have build times and power; we don’t have upkeep or supply. If early rushes or AI timing feel off, consider:
  - Slightly longer build times for first military building
  - Optional supply cap (e.g. 50/100/200) for late-game diversity
  - Tuning `AI_CONFIG.expansionDelay` and `attackThreshold` per difficulty

### 2.5 Iteration and Patches

- **Cycle**: Playtest → identify outliers (e.g. “Unit X wins every game”) → adjust 1–2 levers (cost, HP, or damage) → repeat. Avoid changing everything at once.
- **Docs**: Keep a short “Balance changelog” (e.g. in `CHANGELOG.md` or `BALANCE.md`) so we know what changed and why.
- **Our game**: Single source of truth in `constants.js` makes patches easy; we can add a `BALANCE.md` when we start formal balance passes.

---

## 3. How Morph Wars Handles Balance Today

- **Units**: `js/constants.js` → `UNIT_TYPES` (cost, hp, speed, damage, range, damageType, armor, tier, size, buildTime, etc.).
- **Buildings**: `BUILDING_TYPES` (cost, power, prerequisites, tier, buildTime).
- **Combat**: `DAMAGE_MULTIPLIERS` (damageType × armorType → multiplier). No supply cap.
- **Economy**: Credits from harvesters; ore 1x, gems 2x; `RESOURCE_CONFIG` for placement and regen.
- **AI**: `AI_CONFIG` per difficulty (updateInterval, expansionDelay, attackThreshold, maxUnitLimit, economyFocus, militaryFocus, etc.).
- **Special powers**: `SPECIAL_POWERS` (cost, cooldown, damage, radius, requiresTier/requiresBuilding).

Recommendation: when adding features or factions, keep all new balance knobs in `constants.js` (or a dedicated balance module that constants import) so RESEARCH and future balance docs stay accurate.

---

## 4. Future Features We Could / Should Implement

Below is a prioritized list of future features, informed by similar RTS games and our current roadmap. **Should** = high impact or alignment with project goals; **Could** = valuable but optional or later-phase.

### 4.1 High priority (should)

| Feature | Description | Why |
|--------|-------------|-----|
| **Balance spreadsheet / BALANCE.md** | Single doc or sheet listing current unit/building stats and damage matrix; link to `constants.js`. Optional: script to export constants to CSV/JSON for comparison. | Makes tuning and patch notes consistent; supports research above. |
| **Sound effects & music** | UI clicks, build complete, combat, alerts, ambient music, toggle in settings. | Major polish; expected in RTS. |
| **Campaign / story missions** | Linear or branching missions with objectives (destroy HQ, survive N minutes, escort, etc.). Reuse existing map editor and save/load. | Differentiates from pure skirmish; replayability. |
| **More maps & scenarios** | Curated built-in maps (small/medium/large, 1v1/2v2/FFA) plus “scenario” type (e.g. defend for 10 min). | Variety without relying only on procedural gen. |
| **Difficulty tuning pass** | Use RESEARCH and playtesting to tune `AI_CONFIG` and possibly early-game “speed bumps” so Easy/Medium/Hard feel distinct and fair. | Direct application of balance research. |

### 4.2 Medium priority (should / could)

| Feature | Description | Why |
|--------|-------------|-----|
| **Multiplayer (WebRTC or similar)** | 1v1 or small FFA over browser; shared game state, sync, reconnection. | Roadmap item; multiplies fun and enables real balance data later. |
| **Supply / population cap** | Optional cap (e.g. 50/100/200) in game options; buildings or tech increase cap. | Matches StarCraft-style pacing; late-game trade-offs. |
| **Second faction** | Alternate roster (different units/buildings, same rules). Balance with RPS and cost efficiency. | Variety and “asymmetric” balance practice. |
| **Replay system** | Record inputs or state snapshots; playback in-game. | Debugging, balance review, and “watch my game” appeal. |
| **Rally points & waypoints** | Set rally for new units; queue waypoints for move orders. | Standard RTS QoL; we have rally, waypoints would extend it. |
| **Improved minimap** | Unit dots, building icons, optional labels. Optional: minimap pings. | Improves readability and coordination (for future multiplayer). |
| **Skirmish options** | Starting resources, unit limits, map, AI difficulty, win condition (destroy HQ / destroy all / score) in one screen. | Aligns with C&C/StarCraft skirmish; better for testing and casual play. |

### 4.3 Lower priority (could)

| Feature | Description | Why |
|--------|-------------|-----|
| **Modding support** | Load custom `constants.js` or JSON (units, buildings, maps) from URL or file; sandbox or “custom game” mode. | Extensibility and community content; larger scope. |
| **Advanced terrain** | Bridges, cliffs, elevation affecting line of sight or movement. | Depth and map variety; requires pathfinding and vision changes. |
| **More unit types** | Additional infantry, vehicles, or naval/air variants within existing damage/armor framework. | Variety; keep RPS and cost balance in mind. |
| **Upkeep or economy “speed bumps”** | Optional upkeep cost per unit or building; or delayed first military build. | Fine-tuning early-game pacing if needed. |
| **Achievements & stats** | Per-session or persistent stats (games won, units built, etc.); optional achievements (e.g. “Win without building air”). | Retention and goals; can be localStorage or later backend. |
| **Localization** | All UI and tooltip strings in a table; load by language. | Accessibility and reach. |
| **Accessibility** | Key remapping, high-contrast UI, optional reduced motion, screen-reader-friendly labels. | Inclusivity; aligns with modern standards. |

### 4.4 Technical & polish (could)

| Feature | Description | Why |
|--------|-------------|-----|
| **Export balance to JSON/CSV** | Small script or Vitest util that reads `constants.js` (or a balance module) and outputs unit/building stats for spreadsheet import. | Supports balance spreadsheet and BALANCE.md. |
| **Performance options** | Settings for effect density, fog quality, draw distance, or FPS cap. | Helps low-end devices and large maps. |
| **Save format versioning** | Version field in save data; migration path for old saves when we change structure. | Prevents breakage when we add features. |
| **Analytics hooks (privacy-friendly)** | Optional, anonymized: game length, winner, map size, AI difficulty. No PII; opt-in. | Future balance data if we add multiplayer or share builds. |

---

## 5. Summary

- **Similar games**: C&C (economy, tech gates), StarCraft (supply, RPS, data-driven patches), Age of Empires (multi-resource, age pacing), and modern RTS (speed bumps, map control) all inform how we can manage balance.
- **Best practices**: Centralize knobs in `constants.js`, use a balance spreadsheet/doc, rely on RPS (we already do), consider speed bumps and supply for pacing, and iterate with playtesting and simple metrics.
- **Future features**: Prioritize balance documentation, sound, campaign/missions, maps/scenarios, and difficulty tuning; then multiplayer, supply cap, second faction, replay, and skirmish options; then modding, terrain, more units, and accessibility.

Keeping balance in one place and documenting it (e.g. in `BALANCE.md` or RESEARCH) will make future patches and new features easier to integrate without breaking the game.
