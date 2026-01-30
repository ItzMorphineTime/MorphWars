# Unit Testing Plan

This document outlines the research, framework choice, and implementation plan for unit testing the Morph Wars RTS game.

---

## 1. Framework Research Summary

### Options Evaluated

| Framework | Pros | Cons | Verdict |
|-----------|------|------|---------|
| **Vitest** | Native ESM, fast (Vite-powered), simple config, watch mode, coverage built-in, works with vanilla JS | Requires Node/npm (dev only) | **Recommended** |
| **Jest** | Most popular, rich ecosystem, zero-config for many setups | ESM support historically awkward; heavier | Good alternative |
| **Mocha + Chai** | Flexible, widely used, good for async | More manual setup (assertions, reporters) | Viable |
| **Browser-based (no framework)** | Zero deps, tests run in real browser | Limited tooling, no coverage, manual harness | Only for tiny projects |

### Recommendation: **Vitest**

- **Native ESM**: Fits modern JS; no transform gymnastics.
- **Speed**: Uses Vite’s transform pipeline; quick feedback during TDD.
- **Vanilla JS**: Works with classic script-based structure; we can load modules via Vite or expose testable units.
- **DX**: Watch mode, coverage (`v8`/`istanbul`), and compatible `describe`/`it`/`expect` API.
- **Config**: Single `vitest.config.js`; minimal boilerplate.

The game remains **dependency-free at runtime** (no framework in `index.html`). Testing uses **dev-only** dependencies (Vitest, jsdom if needed).

---

## 2. Implementation Plan

### Phase 1: Setup (Day 1) ✅

Phase 1 is in place. The repo includes:

- **`package.json`** with `test`, `test:run`, `test:coverage` scripts and Vitest as a dev dependency.
- **`vitest.config.js`** at project root: `**/*.test.js` and `**/*.spec.js`, `environment: 'node'`, `globals: true`.
- **`tests/smoke.test.js`** — minimal smoke test so `npm test` runs something immediately.
- **`.gitignore`** — `node_modules/` and `coverage/` are ignored.

**Quick start:**

1. **Install dependencies** (once):
   ```bash
   npm install
   ```
2. **Run tests**:
   ```bash
   npm test          # watch mode
   npm run test:run  # single run
   npm run test:coverage  # with coverage
   ```

### Phase 2: Testable Units & Priorities

Focus on **pure logic and isolated modules** first. Order by value and ease of testing:

| Priority | Module | Targets | Notes |
|----------|--------|---------|-------|
| **P0** | `utils.js` | `distance`, `distanceTiles`, `clamp`, `lerp`, `normalizeVector`, `pointInRect`, `rectIntersect`, `worldToTile`, `tileToWorld`, `getRandomInt`, `shuffle` | Pure functions; mock `TILE_SIZE` if needed |
| **P0** | `utils.js` | `canPlaceBuilding` | Boundary checks, tile iteration; use small fake map |
| **P1** | `utils.js` | `findPath`, `findPathDirect`, `findPathHierarchical` | Pathfinding; use minimal map fixtures |
| **P1** | `utils.js` | `findNearestValidTile`, `getCachedPath`, `cachePath`, `clearPathfindingCache` | Caching and fallbacks |
| **P1** | `pool.js` | `ObjectPool` (acquire, release, releaseAll, counts) | Mock `createFn` / `resetFn` |
| **P1** | `pool.js` | `EffectsPool` | If logic is testable without DOM |
| **P2** | `entity.js` | `Entity` (takeDamage, heal, isAlive, veterancy) | Mock `notificationManager` / game deps |
| **P2** | `spatialgrid.js` | `SpatialGrid` (buildGrid, isTileBlocked, getBlockedTilesInArea) | Use small `GameMap` fixture |
| **P2** | `map.js` | `GameMap` (getTile, isTileBlocked, isValidSpawnTile, etc.) | Isolated map instances |
| **P3** | `unit.js` | Movement, combat, harvester state transitions | Heavier mocking; integration-style |
| **P3** | `building.js` | Production queue, spawn position logic | Same |
| **P3** | `ai.js` | Decision logic, thresholds | Mock game state |
| **P4** | `spritemanager.js` / `spriterenderer.js` | Loading, fallbacks, layout calculations | Mock `Image`, canvas where needed |

### Phase 3: Test Layout and Conventions

- **Location**: Use `tests/` for spec files (e.g. `tests/smoke.test.js`, `tests/utils.test.js`). Co-locating next to source (e.g. `js/utils.test.js`) is also supported; pick one and stick to it.
- **Naming**: `*.test.js` or `*.spec.js`; match Vitest glob.
- **Structure**:
  ```js
  describe('utils', () => {
    describe('distance', () => {
      it('returns correct Euclidean distance', () => { ... });
      it('returns 0 for same point', () => { ... });
    });
    describe('canPlaceBuilding', () => { ... });
  });
  ```
- **Fixtures**: Add `tests/fixtures/` (e.g. minimal map JSON, mock entities) if useful.

### Phase 4: Dealing with Globals and DOM

- **Constants** (`TILE_SIZE`, `MAP_GENERATION`, etc.): Either:
  - Load `constants.js` in tests via Vite (alias or copy) and rely on globals, or
  - Introduce a small `constants` module used by both game and tests, or
  - Mock globals in `setupFiles` / `beforeEach` for specific tests.
- **DOM / Canvas**: Use `environment: 'jsdom'` for DOM-only logic. For canvas-heavy code (e.g. `SpriteRenderer`), mock `HTMLCanvasElement` / `getContext` or test logic in isolation.
- **`notificationManager` etc.**: Mock in unit tests; use real instances only in integration tests.

### Phase 5: CI and Checks

- Add **`npm run test:run`** (and optionally `test:coverage`) to your CI pipeline.
- Optionally enforce coverage thresholds in `vitest.config.js` once baseline exists.

### Phase 6: Documentation and Onboarding

- Link this plan from `README.md` (e.g. “Testing” section).
- Keep `docs/class-diagram.md` and `docs/flowcharts.md` updated with a “Testing” view (see below).

---

## 3. Quick Reference

| Task | Command |
|------|---------|
| Run tests (watch) | `npm test` |
| Run once | `npm run test:run` |
| Coverage | `npm run test:coverage` |

---

## 4. Success Criteria

- [ ] Vitest runs via `npm test` and `npm run test:run`.
- [ ] All P0 targets have unit tests.
- [ ] No regressions in existing gameplay; tests are fast and deterministic.
- [ ] `docs/class-diagram.md` and `docs/flowcharts.md` include testing structure and flow.

---

## 5. References

- [Vitest](https://vitest.dev/)
- [Vitest — Testing vanilla JS / non-Vite projects](https://vitest.dev/guide/)
- [CUSTOM_SPRITES.MD](../CUSTOM_SPRITES.MD) — Testing plan for sprites (unit/integration/performance)
- [CURSOR_SUGGESTIONS.MD](../CURSOR_SUGGESTIONS.MD) — Unit/integration test suggestions
