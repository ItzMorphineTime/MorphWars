# Multiplayer Implementation Plan

This document summarizes research into adding multiplayer to Morph Wars, compares approaches (with advantages and disadvantages), and outlines a systematic plan to implement the **easiest** option: **WebSocket relay with host-authoritative state sync**.

---

## 1. Research Summary: Multiplayer Approaches

### 1.1 Transport Options

| Approach | Description | Typical use |
|----------|-------------|-------------|
| **WebSocket (TCP)** | Persistent client–server connection; reliable, ordered delivery. | Lobby, signaling, state sync, turn-based or low-update games. |
| **WebRTC Data Channels (UDP-like)** | Peer-to-peer after signaling; low latency, best-effort delivery. | Real-time action games, voice/video. |
| **WebTransport (QUIC)** | Emerging; UDP-like with modern features. | Future alternative; less ecosystem today. |

- **WebSocket**: Easier to implement (one server, simple relay). Slightly higher latency under packet loss (TCP retransmits). Well-suited to RTS where we sync state periodically (e.g. 2–5×/s) rather than every frame.
- **WebRTC**: Lower latency once P2P is established, but requires a **signaling server** (usually WebSocket) anyway, NAT/firewall handling (ICE), and more client code. Best when you need minimal latency and can invest in P2P.

For a first version, **WebSocket** is the easiest: one server, one protocol, no ICE.

### 1.2 Sync / Netcode Models

| Model | How it works | Bandwidth | Determinism | Complexity |
|-------|----------------|-----------|-------------|------------|
| **Lockstep (deterministic)** | Only inputs/commands are sent; all clients run the same simulation. | Very low | **Required** (identical results on all clients) | High (must make game deterministic) |
| **State sync (host or server)** | One authority runs the game and sends state (full or delta) to others. | Higher | Not required | Lower |
| **Authoritative server** | Server runs game logic; clients send inputs, server broadcasts state. | Medium–high | Not required | Highest (server must run full game) |

- **Lockstep**: Used in classic RTS (e.g. StarCraft). Requires **strict determinism**: same RNG (seeded), same math (fixed-point or disciplined float), same order of operations. JavaScript `Math.*` and float arithmetic are **not** guaranteed identical across browsers/engines; making our current codebase deterministic would be a large, error-prone refactor. **Not recommended** as the first approach.
- **State sync**: One machine (host or server) is the authority. It runs the existing game loop and serializes state (we already have this in `SaveLoadManager`). Others receive state and deserialize (we have this too). No need for determinism. Bandwidth is manageable by syncing at 2–5 Hz and optionally using deltas later.
- **Authoritative server**: Best for anti-cheat and fairness but requires running the full game on the server (Node.js or headless browser). More work than host-authoritative.

**Conclusion**: Use **host-authoritative state sync** over WebSocket: one player is the host (runs the game, sends state), the other is the peer (sends commands, receives state and renders). Reuse existing serialize/deserialize; add a thin relay server and a small command protocol.

### 1.3 Architecture Options Compared

| Option | Description | Advantages | Disadvantages |
|--------|-------------|------------|----------------|
| **A. WebSocket relay + host state sync** | Simple Node server relays messages. Host runs game and sends state; peer sends commands and receives state. | Reuse save/load serialization; no determinism; minimal server (no game logic); one codebase (browser). | Host has slight advantage (no network delay for their actions); host disconnect ends game; 2-player focus. |
| **B. WebRTC P2P + host state sync** | Signaling via WebSocket; then P2P data channel. Same host/peer roles. | Lower latency for state/commands; no server in the data path after connect. | Signaling server still needed; ICE/NAT complexity; more client code; firewall issues for some users. |
| **C. WebSocket + authoritative server** | Server runs game loop (e.g. Node port of game logic). Clients send inputs, server broadcasts state. | Fair (no host advantage); server can enforce rules. | Must port or run game logic on server; more infra; harder to implement. |
| **D. Lockstep (WebSocket or WebRTC)** | All clients run simulation; only inputs exchanged. | Minimal bandwidth; no single point of failure for simulation. | Requires full determinism (float/RNG/order); large refactor and easy desyncs; JS is brittle for this. |

**Recommended for “easiest”**: **Option A — WebSocket relay + host-authoritative state sync.**

---

## 2. Advantages and Disadvantages by Approach

### 2.1 WebSocket Relay + Host-Authoritative State Sync (Recommended)

**Advantages**

- Reuse existing **serialize/deserialize** from `SaveLoadManager`; no new save format.
- **No determinism** requirement; current JS and `Math` are fine.
- **Minimal server**: only relays messages (and maybe matchmaking); no game logic.
- **Single codebase**: game runs only in the browser; server is a small Node script.
- **Incremental**: get “peer watches host” working first, then add peer input.
- **Familiar**: WebSocket APIs are simple; many tutorials and libraries (e.g. `ws`).

**Disadvantages**

- **Host advantage**: host’s actions apply immediately; peer’s actions go over the network.
- **Host dependency**: if host quits or crashes, the game ends (no migration in v1).
- **Bandwidth**: full state snapshots can be large; we can tune frequency and add delta/diff later.
- **No anti-cheat**: host could cheat (peer trusts received state); acceptable for a first version.

### 2.2 WebRTC P2P + Host State Sync

**Advantages**

- **Lower latency** after connection (direct P2P, UDP-like).
- **No server in the data path** once connected (only signaling).

**Disadvantages**

- **Signaling server still required** (WebSocket); so we don’t avoid server entirely.
- **ICE/NAT/firewall** handling; some users may not get P2P working.
- **More complex** client code (RTCPeerConnection, DataChannel, reconnection).
- **Same** host-authoritative and state-sync design; only transport changes.

### 2.3 Authoritative Server (WebSocket)

**Advantages**

- **Fair**: no host advantage; server is the single source of truth.
- **Anti-cheat**: server can validate all actions.

**Disadvantages**

- **Server must run game logic**: either port `Game`/map/units/buildings to Node or run headless browser.
- **More infrastructure**: always-on server, deployment, scaling.
- **Largest implementation effort** for our current codebase.

### 2.4 Lockstep (WebSocket or WebRTC)

**Advantages**

- **Very low bandwidth** (only inputs).
- **No single authority** for simulation; all clients equal in theory.

**Disadvantages**

- **Strict determinism** required: same RNG, same math, same order on all clients. Our game uses floats, `Math.*`, and is not built for this.
- **High implementation and debugging cost**: desyncs are hard to track; JS cross-browser determinism is fragile.
- **Latency**: everyone waits for the slowest input each step; RTS often uses 100–500 ms input delay in lockstep.

---

## 3. Easiest Solution: WebSocket Relay + Host-Authoritative State Sync

### 3.1 High-Level Design

- **Server (Node.js + `ws`)**
  - Listens for WebSocket connections.
  - Maintains **rooms** (e.g. room id = 4-character code).
  - **Host** creates a room and gets the code; **peer** joins with the code.
  - Server **relays** messages between the two clients in the same room (no game logic).

- **Host (browser)**
  - Runs the game as today (single-player 1v1, but player 1 is human).
  - Periodically serializes state (e.g. every 200–500 ms) and sends to server; server relays to peer.
  - Receives **commands** from peer (move, attack, build, selection, etc.) and applies them for **player 2** in the same game instance.

- **Peer (browser)**
  - Does not run the full game loop.
  - Receives **state** from server (relayed from host), deserializes, and **renders** (and updates local UI).
  - Sends **commands** (e.g. right-click move, build, selection) to server; server relays to host.

- **Game setup**
  - Both players see the same 1v1: Player 0 = host, Player 1 = peer. Map, starting bases, and rules are the same; only who controls which side differs.

### 3.2 Message Types (Minimal)

| Message | Direction | Purpose |
|---------|-----------|--------|
| `create_room` | Client → Server | Host creates room; server returns `roomId` (e.g. 4-char code). |
| `join_room` | Client → Server | Peer joins by `roomId`; server confirms or rejects. |
| `state` | Host → Server → Peer | Serialized game state (reuse `serializeGameState()`). |
| `command` | Peer → Server → Host | Peer’s action: e.g. `{ type: 'move'|'attack'|'build'|'select', ... }`. |
| `ping` / `pong` | Both | Optional latency measurement. |
| `leave` | Client → Server | Disconnect; notify other client. |

### 3.3 Command Protocol (Peer → Host)

Peer sends high-level commands so host can apply them the same way as local input. Host maps these to **player 2** (peer’s side).

Examples:

- **Selection**: `{ type: 'select', entityIds: [id1, id2] }` or `{ type: 'select_rect', worldBounds: { x, y, w, h } }`.
- **Move**: `{ type: 'order_move', worldX, worldY }` (for currently selected units).
- **Attack**: `{ type: 'order_attack', targetEntityId }` or `{ type: 'order_attack_ground', worldX, worldY }`.
- **Build**: `{ type: 'build', buildingType, tileX, tileY }`.
- **Build queue**: `{ type: 'build_queue_add', buildingType }`, `{ type: 'build_queue_cancel', index }`.
- **Deploy MCV**: `{ type: 'deploy_mcv' }` (if MCV selected).
- **Special power**: `{ type: 'special_power', powerType, worldX, worldY }`.

Host maintains a **remote command queue** for player 2; each frame (or at a fixed tick), host processes queued commands by temporarily treating “current player” as player 2 and invoking the same logic used for local input (e.g. move selected units, place building).

### 3.4 State Sync Frequency and Payload

- **Frequency**: Start with **2–5 state syncs per second** (e.g. every 200–300 ms). Reduces bandwidth and CPU; peer may see a slight delay (acceptable for RTS).
- **Payload**: Use existing **full state** from `serializeGameState()`. If payload size becomes an issue (e.g. >100 KB), consider delta/diff or compressing (e.g. gzip) in a later phase.
- **Interpolation**: Optional later: peer interpolates unit positions between state updates for smoother visuals.

---

## 4. Systematic Implementation Plan

### Phase 1: WebSocket Relay Server and Lobby (No Game Yet)

**Goal**: Two clients can create/join a room and exchange simple messages.

1. **Scaffold Node server**
   - New folder/dir: `server/` (or `multiplayer-server/`).
   - `package.json` with dependency `ws`.
   - Entry file, e.g. `server/index.js`, that:
     - Listens on a port (e.g. 8080 or configurable).
     - Accepts WebSocket connections.
     - Parses JSON messages: `{ type: 'create_room' | 'join_room' | ... }`.

2. **Room and relay logic**
   - In-memory store: `Map<roomId, { host: WebSocket, peer: WebSocket }>`.
   - On `create_room`: generate `roomId` (4–6 alphanumeric), store host socket, send `{ type: 'room_created', roomId }` to host.
   - On `join_room`: if room exists and peer slot empty, attach peer; send `{ type: 'joined_room' }` to peer and `{ type: 'peer_joined' }` to host. If room full or missing, send error.
   - Any other message from host or peer: relay to the other in the same room (e.g. forward `state` to peer, `command` to host).

3. **Client connection UI (in game)**
   - Add a “Multiplayer” section to the main menu:
     - **Host**: “Host game” → connect to server (e.g. `ws://localhost:8080`), send `create_room`, display “Room code: ABCD” and wait.
     - **Join**: Input field for room code + “Join game” → connect, send `join_room` with code.
   - Use browser `WebSocket`; store socket and roomId in a small `MultiplayerClient` or `NetworkManager` module. No game logic yet—just connection and room state.

4. **Checkpoint**: Host creates room, peer joins; server relays a test message (e.g. “hello”) both ways.

---

### Phase 2: Host Sends State; Peer Receives and Renders (Watch-Only Peer)

**Goal**: Host runs a 1v1 game (host = Player 0, AI = Player 1 for now). Host serializes state and sends it; peer deserializes and renders. Peer does not control anything yet.

1. **Host: run game in “multiplayer host” mode**
   - After “room_created”, host starts game: e.g. 1v1, map size/type, host = Player 0, **Player 1 = AI** (temporary).
   - Game loop unchanged. Add a **network tick**: every N ms (e.g. 250), call `saveLoadManager.serializeGameState()` (or a thin wrapper that returns the same structure), then send `{ type: 'state', payload: gameState }` over WebSocket.

2. **Peer: receive state and replace local game**
   - On `state` message: call `saveLoadManager.deserializeGameState(payload)` (or equivalent that restores `game.players`, `game.units`, `game.buildings`, `game.map`, etc.).
   - Ensure peer’s `game` instance exists and is the one used by renderer; replace its state so that **renderer.render()** draws the host’s world.
   - Peer does not run `game.update(deltaTime)`; only **render** and optional UI (e.g. show “Waiting for host…” or “Connected – watching”). Camera can be peer-local (peer scrolls their own view).

3. **Game instance on peer**
   - Peer needs a minimal `Game` + map + players + units + buildings so that `deserializeGameState` and `renderer.render()` work. Easiest: create a full `Game` and `Renderer` on peer, then repeatedly replace state via deserialize so the same rendering path is used.

4. **Checkpoint**: Host plays vs AI; peer sees the same game in real time (with ~200–300 ms delay). No peer input.

---

### Phase 3: Peer Sends Commands; Host Applies Them (2-Player Playable)

**Goal**: Peer controls Player 2. Commands from peer are applied on host’s game; host continues to send state; peer continues to render received state.

1. **Command encoding on peer**
   - When peer performs an action (e.g. right-click move, build, selection), instead of applying it locally, **send a command** to server: `{ type: 'command', payload: { type: 'order_move', worldX, worldY } }`.
   - Implement a **command layer** in peer’s input path: e.g. peer’s `InputHandler` or a wrapper produces commands and sends them; peer does not run game logic for player 2.

2. **Host: remote command queue**
   - Host maintains `remoteCommandQueue = []` for player 2.
   - On receiving `command` from server, push `payload` to `remoteCommandQueue`.

3. **Host: apply remote commands**
   - Once per frame (or every K frames), host processes `remoteCommandQueue`:
     - Pop one or several commands.
     - For each command, temporarily set “current player” to player 2 (e.g. `game.humanPlayer = game.players[1]`, and optionally `game.selectedEntities` from command if we sync selection).
     - Call the same logic that handles local input (e.g. move selected units to worldX/worldY, place building at tileX/tileY, set selection by entity IDs).
     - Restore `game.humanPlayer` to host’s player (0) and clear or keep selection as needed.
   - Selection for player 2: either host infers from “select” commands and maintains a “remote selection” for display only, or we include “selected entity ids” in state so peer can highlight; host only needs to apply move/attack/build for the units that peer has selected (we can send selection with each command).

4. **Selection sync**
   - Option A: Each command includes `selectedEntityIds` so host knows which units to move/attack/build. Host applies command to those entities for player 2.
   - Option B: Host receives explicit `select` and `select_rect` commands and maintains a “player 2 selection” list; subsequent move/attack/build use that list. Prefer Option B for clarity.

5. **Peer: input → commands**
   - Peer’s input (click, drag, build menu, etc.) should produce the same command types (select, order_move, order_attack, build, etc.). Peer still receives state and deserializes; so peer’s “selection” is only for sending the next command (e.g. “move my selection to here”). Optionally, host can echo “player 2 selection” in state so peer can show selection UI from state.

6. **Checkpoint**: Host and peer each control their side; both see the same game. One game, host authority, peer drives Player 2 via commands.

---

### Phase 4: Polish and Robustness

**Goal**: Better UX and handling of disconnects.

1. **Disconnect handling**
   - If host disconnects: server notifies peer (“host_left”); peer shows “Host disconnected” and returns to menu.
   - If peer disconnects: server notifies host (“peer_left”); host can show “Opponent left” and optionally pause or end game.

2. **Reconnection**
   - v1: no reconnection; disconnect = leave game. Later: optional “reconnect within 60 s” using same roomId and a token.

3. **Latency display**
   - Optional: ping/pong or timestamp in state; peer shows “Delay: ~200 ms” so players know what to expect.

4. **Config**
   - Server URL (e.g. `ws://localhost:8080` or `wss://your-server.com`) in a config or UI so the same client can be used against different environments.

5. **Deployment**
   - Server can run on a small VPS or PaaS (e.g. Railway, Render, Fly.io). Use `wss://` in production. Client must connect to that URL (e.g. input field or build-time env).

---

## 5. File and Module Sketch

- **Server**
  - `server/package.json` — dependency `ws`.
  - `server/index.js` — HTTP server (optional, for health check), WebSocket upgrade, room map, relay logic, message parsing.

- **Client**
  - `js/network.js` (or `multiplayer.js`) — `NetworkManager` or similar: connect, send, onMessage, createRoom, joinRoom, sendCommand, onStateReceived. Hooks into game only via “send state” (host) and “apply state” (peer).
  - `main.js` — multiplayer menu (Host / Join), wire “Host” to create room and start game in host mode, “Join” to join and start peer mode (no local game loop; only receive state and render).
  - `game.js` — optional flags: `isMultiplayerHost`, `isMultiplayerPeer`; host runs loop and sends state; peer skips update or runs a minimal update (e.g. only camera). Remote command queue and “apply remote command” called from host’s update.
  - `input.js` — on peer: input generates commands and sends via `NetworkManager` instead of (or in addition to) local application. Host’s input unchanged; host also processes `remoteCommandQueue` for player 2.

- **Shared**
  - Reuse `SaveLoadManager.serializeGameState()` and `deserializeGameState()`; ensure serialization is deterministic (e.g. no per-run ids in payload if we ever add delta sync) or document that we always send full state.

---

## 6. Summary

| Topic | Choice |
|-------|--------|
| **Easiest approach** | WebSocket relay + host-authoritative state sync |
| **Transport** | WebSocket (simple, one server, no P2P setup) |
| **Authority** | Host runs game; peer sends commands; host sends state |
| **State** | Reuse `serializeGameState` / `deserializeGameState` |
| **Determinism** | Not required (no lockstep) |
| **Phases** | 1) Server + lobby, 2) State sync + peer watch, 3) Peer commands, 4) Disconnect/polish |

Implementing in this order keeps each step testable and avoids lockstep and server-side game logic until we decide to invest in a more advanced architecture later.
