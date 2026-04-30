# OpenFront.io

OpenFront is a multiplayer real-time strategy game (browser-based) — a fork/rewrite of WarFront.io. Players compete to control territory, build structures, and form alliances on real-world maps.

## Tech Stack

- **Client**: TypeScript + Vite + Lit + PixiJS + Tailwind CSS v4
- **Server**: Node.js (TypeScript via `tsx`) with Express + WebSockets (`ws`), running as a Node `cluster` (1 master + N workers)
- **Build**: Vite (output to `static/`)
- **Package manager**: npm (use `npm run inst` which runs `npm ci --ignore-scripts`)

## Project Layout

- `src/client` — browser code (entry: `src/client/Main.ts`)
- `src/server` — master + worker processes
  - `Server.ts` — entry; forks `Master` (primary) and `Worker` (children)
  - `Master.ts` — listens on port `3000`, serves the SPA shell + `/api`
  - `Worker.ts` — listens on `3001 + workerIndex` (game/websocket workers)
- `src/core` — shared game/config logic
- `resources/` — public assets (maps, lang, images, sounds)
- `proprietary/` — extra assets served in dev (overlaid on `resources/`)
- `map-generator/` — Go tool that regenerates the map data
- `static/` — build output (also served by master in prod)
- `vite.config.ts` — dev server + Vite build config

## Replit Environment Setup

- Single workflow `Start application` runs `SKIP_BROWSER_OPEN=true npm run dev`, which concurrently starts:
  - Vite dev server on `0.0.0.0:5000` (the public preview port)
  - The clustered server: master on `localhost:3000`, workers on `3001` and `3002` (dev uses 2 workers)
- Vite proxies `/api`, `/lobbies`, `/w0`, `/w1` to the backend so the frontend on port 5000 is the single entry point.
- `vite.config.ts` sets `host: "0.0.0.0"`, `port: 5000`, `allowedHosts: true`, and an HMR `clientPort: 443` so the Replit-proxied iframe works.
- Some console errors are expected in dev: the privilege-refresher tries to reach a cosmetics service on `localhost:8787` (not present here), and the master tries to render `static/index.html` for SPA fallbacks (only exists after a prod build). Neither blocks the dev experience because Vite serves the SPA on port 5000.

## Deployment

Configured for **VM** deployment (the game is stateful — websockets + in-memory game state per worker — so autoscale is not appropriate).

- Build: `npm run build-prod`
- Run: `npm run start:server` (cluster master serves the built `static/` and proxies workers)

## Common Commands

- `npm run dev` — full dev (client + server, dev config)
- `npm run start:client` — Vite only
- `npm run start:server-dev` — server only (dev)
- `npm run build-prod` — production bundle to `static/`
- `npm test` — vitest suite
- `npm run lint` / `npm run format`

## Roadmap & Recent Work

- `ROADMAP.md` tracks long-term improvement ideas grouped by theme. Items are
  checked off as they ship.
- Recent client additions:
  - **Keybind cheat-sheet overlay** — press `?` in-game (or anywhere on the
    page) to toggle a sectioned overlay listing every configured hotkey.
    Implemented as a Lit custom element in
    `src/client/graphics/layers/KeybindHelpOverlay.ts` and mounted from
    `index.html`. New translation keys live under `keybind_help.*` in
    `resources/lang/en.json`; localisation for other languages will fall back
    to English until translated.
  - **Vite watcher hygiene** — `.local/`, `.cache/`, `.git/`, `static/`,
    `coverage/`, `node_modules/` are excluded from the dev server's file
    watcher so workflow-log churn no longer triggers nonstop HMR reloads.
  - **Day/night cycle visual layer (§4)** — opt-in cosmetic tint over the map
    driven by the deterministic game tick. Toggle in Settings → "Day / night
    cycle". Implemented in `src/client/graphics/layers/DayNightLayer.ts` and
    registered in `GameRenderer.ts` between `FxLayer` and `UILayer`.
  - **Disconnect / reconnect grace (§5)** — server-side `disconnectedTimeout`
    raised from 30s → 60s; deterministic `Player.disconnectedSinceTick()`
    added so `AiAttackBehavior`'s AFK strategy waits for
    `Config.aiAfkGraceTicks()` (~10s) before kicking in. Net hiccups no
    longer immediately get the player swarmed.
  - **Nuclear winter aftermath (§3)** — fallout tiles can now decay back to
    clean land after a configurable number of ticks. New `falloutDecayTicks`
    field on `GameConfig` (default `null` = historical permanent fallout, so
    no replay impact). New deterministic `FalloutDecayExecution` sweeps a
    tick-stamped fallout map kept on `GameImpl`. Set
    `falloutDecayTicks: 1500` (≈2.5 minutes at 10 TPS) on the lobby config
    to enable in a game.
  - **Naval blockade (§3)** — ports now stop launching new trade ships when
    a hostile (non-self, non-allied) `Warship` parks within
    `portBlockadeRange` tiles. Trade ships already at sea continue normally,
    so the mechanic rewards sustained naval pressure rather than gold
    instantly evaporating. New `portBlockadeRange` field on `GameConfig`
    (default `null` = disabled, replays bit-identical). Logic lives in
    `PortExecution.isBlockaded()`; tests in `tests/PortExecution.test.ts`.
  - **`ROADMAP.md` rewritten with per-item implementation guides.** Every
    entry now follows a consistent template — *What / Why / Implementation /
    Determinism-replay / Acceptance / Gotchas* — naming exact files, classes,
    APIs and config fields to touch. The intent is that a fresh contributor
    (or a small language model) can pick any unchecked item and work it
    end-to-end without first reverse-engineering the codebase.
