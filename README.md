# Claude of Duty Multiplayer

A browser-based, mobile-first first-person shooter. It is a multiplayer conversion of the single-player Three.js game **Claude-of-Duty-2**: players pick a nickname and an avatar, then share one live match on a server-authoritative WebSocket server.

Built on **Claude of Duty** by Matt Shumer ([mshumer](https://github.com/mshumer)), released under the MIT License. See [Acknowledgements](#acknowledgements).

Everything in this project is built and operated from a **terminal on an Android phone**.

| | |
|---|---|
| **Play** | https://claude-of-duty-multiplayer.vercel.app |
| **Game server** | `wss://cod2-server.onrender.com` (Render free tier) |
| **Repository** | `olekariamunyororo-crypto/Claude-of-Duty-Multiplayer` (private) |
| **Legacy single-player** | https://claude-of-duty-2.vercel.app (separate repo, untouched) |

> Free-tier note: the Render server sleeps when idle. The first player may wait up to a minute while it wakes. A server redeploy drops every live connection.

---

## Features

- **Guest login with nickname.** No account needed. A signed guest credential is stored in `localStorage` so you keep your identity.
- **Three avatars:** Vanguard, Irregular and Breacher, each a full skinned soldier with its own camouflage (arid, woodland or urban).
- **3D avatar preview in the lobby.** A full-screen Three.js scene shows a slowly turning soldier with its camo name; drag to rotate, or use the `<` `>` arrows or avatar buttons to switch. It is disposed when you press PLAY and shows an on-screen error (with the colour buttons still working) if 3D fails. The lobby layout scales with the screen, so it stays readable in Chrome's Desktop-site mode.
- **Real-time multiplayer.** Position and view angles are streamed to the server; snapshots are interpolated on every client.
- **Soldier models for remote players** (not capsules), animated by speed (idle, walk, run) with aim pitch and floating name tags.
- **Server-authoritative combat.** Shots are validated and resolved on the server (wall raycast plus player cylinders, headshots deal double damage).
- **Remote gunfire effects.** The server relays each valid shot to the other players, who replay muzzle flash, light, sound and an occasional tracer at the shooter.
- **Hit markers, kill messages, respawns,** and an `online N - nearest Xm` HUD counter.
- **No art assets.** As in the original game, every texture, mesh, animation and sound is generated procedurally at load time from code: no models, HDRIs, image files or audio files.
- **Shared procedural world.** The server picks a seed and every client builds the identical city from it.
- **On-screen mobile debug console** (DBG button) for capturing logs and renderer state without a PC.

## Controls

**Mobile:** left virtual joystick (move), **FIRE**, **ADS**, **JUMP**, **R** (reload), plus drag to look. Designed for mobile Chrome.

**Desktop** (from the original game): click the canvas to lock the cursor. WASD move, mouse aim, left click fire, right click ADS, R reload, Shift sprint, Ctrl crouch, Space jump, Q/E lean, Esc release.

HUD: compass, minimap ("ZONE 07"), TDM timer and score counters, weapon name and fire mode (M4A1, AUTO), magazine and reserve ammo, grenades.

---

## Tech stack

| Layer | Technology |
|---|---|
| Rendering | Three.js r180 (WebGL2), cascaded shadow maps, procedural PBR materials |
| Client build | Vite, JavaScript (ES modules) |
| Audio | WebAudio |
| Server | Node.js (plain), `ws` WebSocket library, ES modules |
| Database | MongoDB Atlas via the `mongodb` driver (database `cod2`) |
| Client hosting | Vercel (auto-deploys from `main`) |
| Server hosting | Render free web service, managed through its REST API by `render.sh` |
| Source control | GitHub (private) |
| Dev environment | Terminal on Android: git, node, npm, vite, curl, jq |

**Not used:** Meteor. An earlier, separate project (the LUME / Meteor voxel FPS, `first-person-shooter` on Render) shares the same Atlas *cluster* but uses its own database.

## Architecture

```
 Phone (Chrome)                    GitHub (private, main)
 Vite + Three.js client                 |            |
        |                          auto-deploy    manual redeploy
        | HTTPS                         |        (render.sh, REST API)
        v                               v            v
     Vercel  <-------------------- static build    Render: cod2-server
 (static hosting)                                  Node + ws, authoritative
        ^                                               |
        |        WSS: input up / snapshots down         | mongodb driver
        +-----------------------------------------------+--> MongoDB Atlas (db: cod2)
```

### Client (`src/`)

The client is a small engine made of subsystems that share one context (`ctx`) and talk through an event bus (`ctx.events`) or by looking each other up (`ctx.peek('sky')`). All but `net` come from the original game.

| Subsystem | What it does |
|---|---|
| `render` | HDR pipeline, cascaded shadow maps, GTAO, TAA, bloom and grading; on mobile the "low" profile turns most of the post stack off |
| `materials` | Procedural texture forge: tiling PBR surfaces (concrete, brick, plaster, asphalt, sand, metals, wood, fabric, burlap, glass and more) |
| `sky` | Analytic atmosphere and sun |
| `world` | Seeded procedural city |
| `physics` | BVH collision world, raycasts and bullets |
| `player`, `weapons`, `fx`, `ui`, `audio` | Movement, viewmodel and firing, muzzle flash and decals, HUD, WebAudio |
| `ai` | Soldier models, camo textures, animator, navigation; reused here to draw remote players |
| `net` | **Added for multiplayer:** sync, remote soldiers, shots, HUD |

Joining multiplayer happens **before** the engine starts, so the world seed is known in time. `src/main.js` awaits the lobby, seeds the world with the server's seed, and registers the `net` subsystem. A global flag `window.__MP__` turns off the single-player AI garrison and makes the AI system bake all three camo sets.

Typical boot on a mid-range phone is about 12 seconds (world build about 3.8 s, weapons about 2.3 s, AI materials and navigation about 1.3 s).

### Server (`server/`)

| File | Role |
|---|---|
| `index.mjs` | HTTP and WebSocket server, origin check (`ALLOWED_ORIGINS`), auth gate, message dispatch |
| `game.mjs` | Player map, tick loop and snapshots, movement validation, shots and damage, kills, respawn, avatars, headless physics world from the same seed |
| `auth.mjs` | Guest creation and token verification (`GUEST_SECRET`), MongoDB persistence |

### Network protocol

All messages are JSON over WSS with a type field `t`.

| Dir | Type | Payload | Meaning |
|---|---|---|---|
| C to S | `auth` | token, nickname, avatar | Guest login (first message) |
| S to C | `welcome` | id, seed, spawn | Login accepted |
| S to C | `cred` | credential | Guest credential to store |
| C to S | `in` | `p`, `yaw`, `pitch` | Periodic position and view update |
| C to S | `fire` | `o`, `d` | A shot: muzzle origin and direction |
| S to C | `snap` | players (id, name, av, p, yaw, pitch, alive) | World snapshot |
| S to C | `shot` | id, `o`, `d` | Another player fired (replayed as flash, sound, tracer) |
| S to C | `hit` | victim, amount, head | Your shot connected |
| S to C | `dmg` | from, amount, hp | You were hit |
| S to C | `kill` | killer, victim, head | Broadcast kill |
| S to C | `respawn` | position | You respawned |
| S to C | `fix` | `p` | Server corrected your position |

### Server-side rules

- Shots need a live player, are rate-limited (`FIRE_GAP`), and the claimed muzzle must be within 3 m of the player's eye.
- The server raycasts the collision world (up to 300 m) and tests other players as vertical cylinders; the nearest hit wins.
- A hit above 1.45 m over the target's feet is a headshot (double damage).
- A speed cap checks movement against elapsed time with lag tolerance (50 ms of slack); violations send a `fix` teleport.
- Respawn happens after `RESPAWN_MS` within `SPAWN_RANGE` metres.

---

## Repository layout

```
.
|-- README.md
|-- render.sh                 Render REST helper (create/wait/status/logs/redeploy/env)
|-- index.html, vite config   Client entry and build
|-- src/
|   |-- main.js               Engine bootstrap (multiplayer-aware)
|   |-- net/
|   |   |-- lobby.js          Nickname screen, avatar picker, websocket join
|   |   |-- preview.js        3D soldier preview used by the lobby
|   |   |-- index.js          NetSystem: sync, puppets, shots, HUD
|   |   `-- debug.js          On-screen debug console
|   |-- ai/                   Soldier assets, camo textures, animator, navigation
|   |-- audio/                WebAudio (listens to weapon:fire, bullet:tracer, ...)
|   `-- ...                   render, world, physics, player, weapons, fx, ui
`-- server/
    |-- index.mjs
    |-- game.mjs
    `-- auth.mjs
```

---

## Getting started

### Run the client locally

```bash
npm install
npm run dev          # Vite on http://127.0.0.1:5173
```

Open `http://127.0.0.1:5173`. By default it connects to the production server. To use another server, add `?server=wss://host`.

In the Android terminal, keep the dev server in the background and avoid port clashes:

```bash
pkill -f vite; sleep 1
cd ~/cod2 && (nohup npm run dev > ~/vite.log 2>&1 &); sleep 4; tail -3 ~/vite.log
```

Tap **Acquire wakelock** in the terminal app's notification so Android does not kill it.

### Run the server locally

The server needs the environment variables below (at minimum `MONGO_URL`, `MONGO_DB` and `GUEST_SECRET`). Start it with Node from `server/`, then point the client at it with `?server=ws://127.0.0.1:PORT`.

### URL options (client)

| Option | Effect |
|---|---|
| `?fresh=1` | Ask for nickname and avatar again and create a new guest each time (for testing two tabs on one phone) |
| `?server=wss://...` | Connect to a different game server |
| `?debug=1` / `?debug=0` | Show or hide the DBG console (remembered) |
| `?nopreview=1` | Turn off the 3D lobby preview |
| `?flip=1` | Turn soldier models around if they face backwards |
| `?prewarm=1` | Force shader prewarm on mobile |

---

## Configuration and deployment

### Render server environment variables

| Variable | Purpose |
|---|---|
| `MONGO_URL` | Atlas connection string |
| `MONGO_DB` | `cod2` |
| `GUEST_SECRET` | Secret used to sign guest credentials |
| `SPAWN_RANGE` | Spawn spread in metres (40 in play; was 8 for two-player tests) |
| `ALLOWED_ORIGINS` | Comma-separated allowed web origins. Empty means any origin. To lock down: your Vercel URL plus `http://127.0.0.1:5173` |

Render's **autoDeploy is set to `no`**, so pushing to GitHub updates Vercel only. Deploy server changes on purpose with `render.sh`.

### `render.sh` cheat-sheet

Credentials live in `~/.render_env` (`RENDER_API_KEY`, `MP_SRV`, `MP_URL`). **Never commit that file.**

```bash
cd ~/cod2
./render.sh status                 # service state
./render.sh logs                   # server logs
./render.sh env KEY VALUE          # set an environment variable
./render.sh redeploy && ./render.sh wait
```

`./render.sh create` provisions the service, copies `MONGO_URL` from the older Render service, generates `GUEST_SECRET` and sets `MONGO_DB=cod2`.

### Vercel

Project `claude-of-duty-multiplayer`, imported from this private repo (the Vercel GitHub App needs access to it). Every push to `main` builds and deploys. Use the short production domain; the long per-deployment URL can sit behind a Vercel login wall.

### Everyday workflow

```bash
git add -A && git commit -qm "message" && git push     # client deploys via Vercel
./render.sh redeploy && ./render.sh wait                # only when server/ changed
```

Tip: run `set +H` in bash before pasting commands that contain `!` to avoid history-expansion errors.

---

## Debug console

Open with `?debug=1`, then tap the **DBG** pill at the bottom of the screen.

- **Info:** GPU and texture limits, AI variants and camo sets built, per-player soldier or capsule state and materials.
- **Errors:** captured exceptions and warnings (for example `[net] soldier failed, using capsule`).
- **Copy / Clear:** copy the whole log to paste into chat, or clear it.

---

## Status

| Area | State |
|---|---|
| Server on Render, guest login, snapshots | Working |
| Two or more players seeing each other | Working (tested with several players) |
| Soldier models and camo for remote players | Working in matches for urban and woodland; arid confirmed in the lobby preview, not yet seen in a match |
| Avatar choice relayed through server | Working |
| Vercel production deploy | Working |
| Remote gunfire (flash, sound, tracer) | Implemented; in-game confirmation pending |
| Lobby 3D preview | Working on phone. Full-screen enlarged layout pushed; confirmation pending |
| `SPAWN_RANGE` reset to 40 | Set; redeploy started, completion not yet confirmed |
| AI soldiers absent when alone | Spawning disabled by flag; not yet confirmed in play |

### Known issues and limits

- Tracers are a fixed 120 m line and do not stop at walls.
- All remote shots use one rifle sound; the weapon id is not relayed yet.
- Hits are resolved against current positions (no lag compensation).
- Three camo bakes use more memory on low-end phones; if one crashes, remap avatars to an existing camo set instead.
- Free-tier cold starts on Render.
- In Chrome's Desktop-site mode the page is laid out at desktop width, so everything looks small unless sized relative to the screen.

### Roadmap and ideas (not committed)

- Confirm remote gunfire and the lobby preview in play; lock `ALLOWED_ORIGINS` to the Vercel domain.
- Team assignment (the HUD already shows two team scores).
- A scene and mission such as "Hold the Relay": capture and hold a zone in the central plaza for points.
- Additional maps: a new seed per match or a rotation, a night variant, or a new location such as a container yard.
- Google login (a small OAuth endpoint on the Node server), an in-game scoreboard and a `/leaderboard` endpoint. Put on hold for now.
- Lag compensation and a weapon id on relayed shots.

---

## Security notes

- Keep `~/.render_env`, `MONGO_URL` and `GUEST_SECRET` out of git and out of chat. Rotate any key that has been pasted anywhere public.
- The Atlas cluster is shared with another project; this game only uses the `cod2` database.
- Lock `ALLOWED_ORIGINS` before sharing the game widely.

## Acknowledgements

This project is a multiplayer conversion of **Claude of Duty** by Matt Shumer (mshumer), the single-player browser FPS whose engine, procedural world, materials and AI soldiers it is built on. The multiplayer layer (lobby, 3D avatar preview, networking, server, hosting setup) is added on top. Many thanks to the original author.

## License

MIT License. Copyright (c) 2026 mshumer. See the [LICENSE](LICENSE) file. The original copyright and license notice must be kept in copies and derivatives of this software.
