# OpenFront Improvement Roadmap

A long-term wishlist of improvements to OpenFront, drawn from common community
asks, comparable territorial-IO games, and gaps observed while reading the
codebase. Items are grouped by theme and roughly ranked inside each section
from "lowest risk / quickest win" to "ambitious / multi-PR".

The intent is for this file to outlive any single contributor — pick something
you care about, file an issue, and submit a PR.

> ⚠️ **Determinism guardrail.** Anything inside `src/core/` runs in the
> deterministic worker. Cosmetic or QoL features should be implemented in the
> client (`src/client/`) wherever possible. Anything that affects executions
> needs to be pure, deterministic, and replay-compatible.

## How to read each entry

Every roadmap item below uses the same template so even a fresh contributor
(or a small language model) can pick one up and ship it without first having
to reverse-engineer the codebase:

- **What.** User-facing behaviour in one or two sentences.
- **Why.** Player / competitive / onboarding rationale.
- **Implementation.** File paths, classes, APIs to extend, and the order of
  operations. Where applicable, the new lobby-config field or schema entry.
- **Determinism / replay.** How the change must be gated so existing replays
  stay bit-identical. (Skip the gating only when the section header explicitly
  says the work is client-side.)
- **Acceptance.** Concrete "done" criteria + the tests / manual checks that
  prove it.
- **Gotchas.** Known pitfalls, dependencies on other roadmap items, or
  cross-cutting concerns.

For items already shipped, the entry summarises what was actually built and
points at the file(s) of record.

---

## 1. Quality-of-Life & Onboarding

These have the highest gameplay-to-effort ratio and are mostly client-only.

### ✅ Keybind cheat-sheet overlay (`?` key)

- **What.** Sectioned overlay listing every configured hotkey, grouped by
  category (View, Camera, Build, Attack, Attack ratio, Diplomacy, Game
  controls). Toggles with `?`, closes with `Esc`, ignores keystrokes when
  an input is focused, and badges any bind the user has customised.
- **Status.** Implemented in
  `src/client/graphics/layers/KeybindHelpOverlay.ts`; mounted from
  `index.html`; translation keys live under `keybind_help.*` in
  `resources/lang/en.json`. Languages without translations fall back to
  English.

### First-game interactive tutorial

- **What.** A scripted single-player scenario walking a brand-new player
  through: pick a spawn → expand to nearest neighbour → build city → build
  port → open trade route → launch first attack → form alliance. Each step
  is gated on completion (the tutorial advances only when the prerequisite
  unit/event is observed, not on a timer).
- **Why.** The current help modal is a wall of text; new-player retention
  drops sharply on the first multiplayer game when basics aren't internalised.
- **Implementation.**
  - Add a new client layer `src/client/graphics/layers/TutorialOverlay.ts`
    that subscribes to `EventBus` events (`UnitBuiltEvent`,
    `AllianceFormedEvent`, `AttackEvent`, etc.) and advances a step machine.
  - Wrap each step with: highlight target UI element (CSS outline / spotlight
    overlay), short instructional copy from `resources/lang/<lang>.json` under
    `tutorial.*`, and a "skip" button.
  - Drive the scenario from a fixed-seed single-player game: configure via
    `GameConfig` with `randomSpawn: false`, two friendly bots, and a curated
    map (`resources/maps/Tutorial`). Store the map under
    `resources/maps/tutorial/` and add a manifest entry.
  - Launch from `LobbyMenu` ("Play tutorial" button) — only visible when the
    player has zero recorded games (look up via account API or `localStorage`
    fallback).
- **Determinism / replay.** No core changes needed — tutorial is pure client
  state.
- **Acceptance.** Brand-new browser session can complete every step without
  reading the help modal; tutorial is replayable from settings; skip button
  works at every step; translates cleanly to at least English + one other
  language.
- **Gotchas.** The bot AI must be predictable enough that the scenario
  doesn't soft-lock — pin `bots: 2` and use a low-aggression doctrine. Don't
  block input on the tutorial; players can ignore it.

### "What does this do?" tooltips on every build button

- **What.** Hovering a build button in `BuildMenu` surfaces a tooltip card
  listing: cost (gold + population), build time, effect (one-line summary),
  and counter (what hard-counters the structure / unit). Mobile: long-press
  shows the same card.
- **Why.** The build menu is icon-only today; new players resort to trial-
  and-error and lose their opener.
- **Implementation.**
  - Extend `src/client/graphics/layers/BuildMenu.ts`. For each entry, add
    a `BuildEntryMeta` object pulled from a single source of truth.
  - Add `resources/lang/<lang>.json` keys under `build_menu.tooltip.<unit>`
    (e.g. `build_menu.tooltip.port.effect`,
    `build_menu.tooltip.port.counter`). Cost and build time should be read
    from `Config` so the tooltip reflects live numbers (`Config.unitCost()`,
    `Config.buildDuration()` etc.).
  - Use a Lit component `<build-tooltip>` that mounts inside the build menu
    and follows the cursor. Use `aria-describedby` for accessibility.
- **Determinism / replay.** None — pure client UI.
- **Acceptance.** Every entry in `BuildMenu` has a tooltip that reads
  cost / time / effect / counter; hovering with keyboard focus also opens
  it (a11y); long-press on touch devices opens it; closing it restores
  focus to the previously focused element.
- **Gotchas.** Numbers must come from `Config`, not be hard-coded — costs
  change with `goldMultiplier` and per-game overrides. Don't show numbers
  for units the player can't currently build (lock-icon UX is fine but the
  cost should still be readable).

### Persistent "ping" markers

- **What.** Right-click (or long-press on mobile) a tile to drop a ping
  visible to allies for ~10 seconds, with a per-player cooldown of ~5 s.
  Pings show as a pulsing ring + sender's flag mini-icon and play a soft
  audio cue for the ally.
- **Why.** Mid-fight communication without typing — a single bound keystroke
  beats 10 seconds of typing during a nuke trade.
- **Implementation.**
  - Add a new intent `PingIntent { tile: TileRef, kind: "general" | "danger"
    | "help" }` and matching execution `src/core/execution/PingExecution.ts`.
    The execution simply broadcasts a `PingEvent` via `EventBus` and dies
    after one tick.
  - Add `Schemas.ts` entry `PingIntentSchema` and register in the intent
    discriminated union.
  - Client: new layer `src/client/graphics/layers/PingLayer.ts` that listens
    for `PingEvent`, draws the ring, and decays after `Config.pingTtlTicks()`
    (~100 ticks at 10 TPS).
  - Add `Config.pingCooldownTicks(): number` (default 50) — server enforces
    by tracking last-ping per player on `PlayerImpl`.
  - Hook into `RadialMenu.ts` so the ping can also be triggered from there
    on touch devices.
- **Determinism / replay.** The intent flows through the standard pipeline
  so replays naturally include pings. Audio cue is client-only.
- **Acceptance.** Ping is visible to all alliance members and only to them;
  cooldown is enforced server-side; ping decays cleanly; works on touch.
- **Gotchas.** Don't show pings to non-allies (info leak in late game).
  Don't allow pings during spawn phase. Pre-existing replays must keep
  decoding (use `nullable().optional()` for any new schema field).

### Quick-chat presets per language

- **What.** Today `resources/QuickChat.json` is a single flat catalogue.
  Expand to per-language phrases plus per-context filtering: combat phrases
  surface during a fight, diplomacy phrases during a truce window,
  construction phrases when build menu is open, etc.
- **Why.** Reduces typing friction across language barriers and surfaces
  the right phrase at the right moment.
- **Implementation.**
  - Restructure `resources/QuickChat.json` into
    `resources/QuickChat/<lang>.json`, each containing
    `{ context: "combat" | "diplomacy" | "build" | "general", text: string }[]`.
  - Add a loader in `src/client/QuickChatLoader.ts` that reads the user's
    selected `lang` from `UserSettings` (with `en` fallback).
  - Modify `ChatModal.ts` to read the active "context" from a small client
    state machine (combat = ≥1 active attack involving the player; truce =
    ≥1 alliance accepted in last 30 s; build = `BuildMenu` open).
  - Existing `QuickChatExecution` does not need to change — keep the
    canonical wire format (an integer ID), just expand the catalogue.
- **Determinism / replay.** No core change. Existing IDs must keep their
  meaning; only add new IDs at the end.
- **Acceptance.** Switching language switches the quick-chat list; opening
  the chat during a fight pre-selects the combat tab; existing recorded
  replays still render the old IDs correctly.
- **Gotchas.** Treat the integer IDs as immutable — never reorder the
  catalogue. Phrases must be moderation-safe (no slurs / harassment
  shortcuts).

### Mobile gesture upgrades

- **What.** Pinch zoom adjusts attack ratio when the radial menu is open;
  two-finger drag pans the camera target while a single-finger drag pans
  the map; long-press radial menu polish (haptic feedback where supported,
  bigger hit targets on small screens).
- **Why.** OpenFront on mobile is functional but not great — the desktop UX
  is faithfully ported instead of being adapted.
- **Implementation.**
  - Touch input lives in `src/client/InputHandler.ts`. Add gesture
    recognition (track `pointerdown` / `pointermove` per pointer ID,
    compute pinch distance + rotation). Recommend pulling in `hammer.js`
    or hand-rolling — start hand-rolled.
  - Hook pinch delta into `EventBus.emit(new SetAttackRatioEvent(ratio))`
    when `ControlPanel`'s attack ratio mode is active.
  - Polish `RadialMenu.ts`: detect `coarse pointer` via media query and
    grow hit targets by ~30 %. Trigger `navigator.vibrate(8)` on selection
    (Android only — silently no-ops on iOS).
- **Determinism / replay.** Pure client / input layer.
- **Acceptance.** Smoke-test on iOS Safari + Android Chrome at 360 px wide:
  spawn → expand → build a city → launch attack at custom ratio, all
  without opening the keyboard.
- **Gotchas.** Don't break desktop drag (still single mouse). iPadOS
  reports as macOS Safari — feature-detect on `ontouchstart` not UA.

### Auto-save and restore client preferences

- **What.** Settings (volume, dark mode, day/night cycle, alert frame, FX,
  preferred attack ratio, etc.) sync across browsers via the account
  system instead of `localStorage` only.
- **Why.** Players who play on multiple devices / clear cookies repeatedly
  reconfigure the same five toggles.
- **Implementation.**
  - Server: extend the user account record (see `src/server/auth/`) with a
    `preferences: jsonb` column. Add REST endpoints `GET /api/me/prefs`
    and `PUT /api/me/prefs` (rate-limit the write to ≤1 per 5 s).
  - Client: `src/core/game/UserSettings.ts` already centralises preference
    access. Refactor it so writes call both `localStorage` and (if logged
    in) `PUT /api/me/prefs` debounced.
  - On login, `GET /api/me/prefs` and merge into `UserSettings` (server
    wins on conflict, with a `lastModified` timestamp tiebreaker).
- **Determinism / replay.** None — preferences are client-only.
- **Acceptance.** Toggle a setting on browser A, log in on browser B,
  setting is honoured. Anonymous users keep working via `localStorage`
  alone.
- **Gotchas.** Schema-version the JSON blob (`{ v: 1, ... }`) so future
  preference renames don't wipe data. Don't store sensitive data
  (clan-mod tokens etc.) in this blob.

### Replay scrubbing UX

- **What.** A YouTube-style timeline under `ReplayPanel` with bookmarked
  events: nukes launched, alliances formed, eliminations, MIRV impacts.
  Click a marker to seek to that tick; arrow-keys scrub by ±10 ticks; `,`
  / `.` step single ticks.
- **Why.** Replays are unwatchable today — you can play / pause / change
  speed but not jump.
- **Implementation.**
  - Pre-compute an event timeline once at replay-load time: scan
    `gameUpdates` recorded by the worker for `MessageType` events that
    correspond to the bookmark categories above.
  - Store as `BookmarkEntry { tick: number, kind: BookmarkKind, playerID:
    PlayerID }[]`.
  - Render the timeline in `src/client/graphics/layers/ReplayPanel.ts` as
    an SVG bar with one `<g>` per bookmark, coloured per category and
    flagged with a tooltip on hover.
  - Seeking: today the replay applies updates tick-by-tick. Implement
    fast-forward by repeatedly calling `executeNextTick` without rendering
    until the target tick (cap at ~5 000 ticks per frame to keep the UI
    responsive — show a "seeking…" spinner).
- **Determinism / replay.** Replay is read-only — no execution changes.
- **Acceptance.** Open any saved replay, click the "first nuke" marker,
  the playhead lands within ±1 tick; arrow-key scrubbing works smoothly;
  the panel collapses on narrow screens.
- **Gotchas.** Seeking backward requires re-running from tick 0 (no
  reverse execution). Either snapshot every N ticks (fast rewind) or
  accept a "rewind = restart + ff" UX. Snapshotting is more code; start
  with restart-and-ff.

## 2. Accessibility

### Color-blind safe palette mode

- **What.** Add a "high-distinguishability" territory palette (Wong / Tol
  Bright / Okabe-Ito sets) selectable from `UserSettingModal`. Player
  colours are deterministic per player slot.
- **Why.** The current allocator favours visual variety, but
  protans/deutans cannot reliably tell red apart from green opponents.
- **Implementation.**
  - The territory colour allocator lives in `src/core/colors/` (look for
    `ColorAllocator` / similar). Add a parallel palette table (e.g.
    `WONG_PALETTE`, `TOL_BRIGHT_PALETTE`).
  - `UserSettings.colorPalette()` returns a string enum (`default | wong
    | tol_bright`). Default is `default`.
  - Render path reads the active palette and substitutes the player
    colour at draw time. Crucially, this must happen on the client only
    — palette is per-viewer, not per-game, so two players in the same
    lobby can each see their preferred palette.
  - Settings UI: add a `<setting-select>` (new component, pattern after
    the existing `<setting-toggle>`) in `UserSettingModal.renderBasicSettings`
    around the existing colour-related toggles.
- **Determinism / replay.** None — purely a per-client viewing concern.
  Replays render with the viewer's palette, not the original player's.
- **Acceptance.** Switching palette repaints the map without reload;
  patterns still render correctly; default behaviour is unchanged when
  setting is absent.
- **Gotchas.** Some palettes have only 8 distinct colours — when there
  are >8 players, fall back to deterministic perturbation (e.g. dither
  with a pattern overlay) rather than reusing colours.

### Pattern-only mode

- **What.** Force every player to render with a distinct `PatternDecoder`
  pattern even without a cosmetic, so colour is no longer load-bearing.
- **Why.** Deeply colour-blind players can't distinguish even the best
  palettes; a hatch / dot / chevron pattern is uniformly readable.
- **Implementation.**
  - `src/core/PatternDecoder.ts` already decodes patterns. Add a
    "fallback pattern set" — 16+ visually distinct patterns generated
    once and shipped under `resources/patterns/fallback/`.
  - In the territory render layer, when `UserSettings.forcePatterns()`
    is true and a player has no cosmetic, assign a fallback pattern
    deterministically (e.g. by `playerID % fallback.length`).
  - Add `force-patterns-toggle` to `UserSettingModal` with new i18n
    keys `user_setting.force_patterns_label` / `_desc`.
- **Determinism / replay.** None — view-only.
- **Acceptance.** With the toggle on, every player has a unique
  pattern; greyscale screenshots remain legible (the actual a11y test).
- **Gotchas.** Patterns can hurt FPS if applied per-pixel — use shader
  / sprite atlases. Don't apply to ocean tiles.

### Screen-reader announcements

- **What.** Major events (alliance request, under attack, nuke incoming,
  player eliminated, victory) are announced via an off-screen
  `aria-live="polite"` region.
- **Why.** Vision-impaired players can't see the on-screen banner.
- **Implementation.**
  - Add `<div id="sr-announcer" aria-live="polite" aria-atomic="true"
    style="position:absolute;left:-9999px">` in `index.html`.
  - Add a thin client helper `src/client/Accessibility.ts`:
    `announce(text: string, severity: "polite" | "assertive")`.
    Subscribes to relevant `EventBus` events and writes localised text.
  - Severity: "assertive" only for nuke-incoming and elimination
    (interrupts the SR queue); everything else "polite".
- **Determinism / replay.** None.
- **Acceptance.** With macOS VoiceOver / Windows NVDA, the listed events
  read aloud within ~1 s; no spam (rate-limit duplicate announcements
  to once per 5 s).
- **Gotchas.** Don't announce in spawn phase. Cap message length at
  ~120 chars (SRs truncate / queue badly past that).

### Configurable UI scale & font size

- **What.** A "UI scale" slider (0.75x – 1.5x) and an independent
  "font size" slider applied to the in-game HUD without using browser
  zoom (which also resizes the game canvas).
- **Why.** Browser zoom breaks pixel coordinates; users on 4K monitors
  want a bigger HUD without bigger units.
- **Implementation.**
  - Apply via CSS custom properties (`--ui-scale`, `--ui-font-size`) on
    `:root`, written by `UserSettings.uiScale()` /
    `UserSettings.uiFontSize()`.
  - Audit all in-game CSS to use these variables (most sizes use `rem`
    today — convert to `calc(var(--ui-font-size) * 1rem)`).
  - The game canvas uses pixel coordinates and must NOT scale with these
    settings. Confirm by inspecting the Pixi root container — its
    transform must remain the user's camera transform only.
- **Determinism / replay.** None.
- **Acceptance.** Sliders affect HUD without affecting click-to-tile
  precision; settings persist; defaults remain 1x / 1rem.
- **Gotchas.** The build menu uses absolute positioning in places —
  audit during the work.

### Reduced-motion mode

- **What.** Disable shake, particles, and screen-flash effects when the
  user prefers reduced motion. Already partially via the special-effects
  toggle — extend to nuke flash and "you've been attacked" alert frame.
- **Why.** Vestibular-disorder users are physically harmed by screen
  shake.
- **Implementation.**
  - Use `window.matchMedia('(prefers-reduced-motion: reduce)')` as the
    default value for the toggle. User can override.
  - In `FxLayer.ts`, gate every shake / particle effect behind
    `userSettings.reducedMotion()`.
  - In `AlertFrame.ts`, replace pulsing animation with a static border
    when reduced-motion is on.
  - In `NukeExecution` rendering (client side, FxLayer), replace the
    flash with a slow fade.
- **Determinism / replay.** Pure client.
- **Acceptance.** With the OS preference set to "reduce motion", first
  game load already disables flashy effects; user can re-enable from
  settings.
- **Gotchas.** Don't disable functional cues (the alert frame still has
  to be visible — just static).

### High-contrast UI theme

- **What.** A dedicated dark, high-contrast HUD/menu theme: pure
  black/white text with bordered panels and a visible focus ring on
  every interactive element.
- **Why.** Existing dark mode is dark-grey-on-dark-grey; not enough for
  WCAG AAA contrast.
- **Implementation.**
  - Add a `data-theme="high-contrast"` attribute on `<body>` toggled by
    `UserSettings.theme()`.
  - In a new stylesheet `src/client/styles/highContrast.css`, override
    HUD colour variables to satisfy WCAG AAA (≥7:1 contrast ratio for
    body text).
  - Audit `:focus-visible` outlines — every interactive element must
    have a 2 px solid outline in high-contrast mode.
- **Determinism / replay.** None.
- **Acceptance.** Lighthouse a11y audit ≥95; manual contrast check on
  every modal.
- **Gotchas.** Don't sacrifice readability of the in-game map for HUD
  contrast — they're separate layers.

## 3. Gameplay & Balance

These touch `src/core/execution/` and require determinism + replay
compatibility (gate behind a config flag, version replays).

### ✅ Naval blockade mechanics

- **What.** A port stops launching new trade ships while a hostile
  (non-self, non-allied) `Warship` sits inside `Config.portBlockadeRange()`
  tiles of it. Trade ships already at sea continue normally, so the
  mechanic punishes long-term naval pressure rather than instantly
  cutting income.
- **Status.** Implemented in `PortExecution.shouldSpawnTradeShip()` and
  `PortExecution.isBlockaded()`. Opt-in via `portBlockadeRange` on the
  game config (default `null` = disabled, replays bit-identical). Tests
  in `tests/PortExecution.test.ts`.

### ✅ Nuclear winter aftermath

- **What.** Fallout tiles decay back to clean land after a configurable
  number of ticks instead of being permanent.
- **Status.** Implemented as `FalloutDecayExecution`, sweeping a
  tick-stamped fallout map kept on `GameImpl`. Opt-in via
  `falloutDecayTicks` on the game config (default `null` keeps the
  historical "fallout is forever" behaviour).

### Conditional MIRV targeting

- **What.** When firing a MIRV, instead of clicking individual tiles, a
  player can pick a salvo template such as "all enemy missile silos
  within 100 tiles of cursor", "all enemy cities", or "all enemy ports
  on this continent". The client computes the target list, server
  validates the cap (≤ MIRV warhead count), and a normal MIRV intent is
  submitted with the resolved tiles.
- **Why.** Manual MIRV painting is fiddly and a UX gap separates
  experienced players from new ones. Templates also reduce client→server
  payload size.
- **Implementation.**
  - Client-only resolver: `src/client/mirv/MIRVTargetResolver.ts` with
    a function `resolveTargets(template: MIRVTemplate, view: GameView,
    cursor: TileRef): TileRef[]`.
  - Templates: `EnemyStructures(filter, radius)`, `EnemyContinent`,
    `EnemyMissiles`. Each is a small pure function over `GameView`.
  - UI: extend `MainRadialMenu.ts` with a "MIRV templates" submenu shown
    when the player has a loaded MIRV.
  - Server still receives `IntentMIRV { targets: TileRef[] }` exactly as
    today — no schema change. The server already enforces the warhead
    cap; templates produce ≤ cap targets.
- **Determinism / replay.** No core change at all — the wire format is
  unchanged. Templates are an authoring aid.
- **Acceptance.** Selecting "all enemy silos in radius" produces the
  same target list as a player who manually painted them; deselecting a
  target works; templates respect the warhead cap with sensible
  truncation (closest first).
- **Gotchas.** `GameView` only exposes visible-to-player units — a
  template can't reveal hidden enemy structures. That's correct; don't
  fight it.

### Random world events

- **What.** Periodic, deterministic world events that shake up
  long-running games:
  - **Pirates** — a hostile, neutral-owned warship spawns in a high-
    traffic shipping lane every N ticks and behaves like a regular
    warship until destroyed.
  - **Refugee waves** — a coastal player receives a one-shot population
    bonus to simulate displaced civilians (small effect, telegraphed by
    a "ship of refugees" event).
  - **Volcanic eruption** — a single-tile fallout-style debuff applied
    to a small region for a fixed duration; players can rebuild after
    it expires.
- **Why.** Adds variability and prevents stale late-game stalemates.
- **Implementation.**
  - Add `Config.worldEvents(): WorldEventConfig | null` (default `null`
    = disabled). The config holds rate + intensity per event type.
  - New scheduler `src/core/execution/WorldEventScheduler.ts`. Uses the
    seeded `mg.random()` (deterministic per-game RNG) to pick the next
    event and tile.
  - Per-event executions:
    - `PirateSpawnExecution` — spawns a `UnitType.Warship` owned by a
      synthetic "Pirates" `Player` (analogous to existing nation owner).
    - `RefugeeWaveExecution` — bumps a player's population once.
    - `VolcanicEruptionExecution` — calls `setFallout(true)` on a
      circular radius, then schedules an expiry that calls
      `setFallout(false)`.
  - Schema: `worldEvents: { pirates: { ratePerHour: number }, refugees:
    {...}, volcanos: {...} } | null` in `GameConfigSchema`.
  - Display: a new `WorldEventBanner.ts` HUD layer announces events
    when they occur.
- **Determinism / replay.** Use only `mg.random()` (already seeded by
  game ID). No `Math.random()`. All event schedules must be reproducible
  from the same seed + same tick.
- **Acceptance.** Enabling pirates causes ≥1 pirate warship within the
  expected window; replays of an event-enabled game render identical
  pirate paths; disabling (default) leaves the game bit-identical.
- **Gotchas.** The "Pirates" synthetic player must not affect win
  conditions — exclude from `WinCheckExecution`. Refugees mustn't
  exceed `Config.maxPopulation()`.

### Asymmetric civilisations / starting bonuses

- **What.** Each player optionally picks a **doctrine** at game start:
  Naval (cheaper warships, +5 % trade income), Industrial (faster
  factories, cheaper trains), Nuclear (cheaper silos, faster MIRV
  build), Diplomatic (longer alliance grace, cheaper troop donations).
  Bonuses are small (5–15 %) so balance stays sane.
- **Why.** Adds long-term replay variety and a meta layer beyond raw
  expansion.
- **Implementation.**
  - Add `Doctrine` enum in `src/core/game/Game.ts` and
    `Player.doctrine(): Doctrine`.
  - Pre-game: extend `LobbyMenu` with a doctrine picker per slot, sent
    via the `JoinLobbyMessage`.
  - `Config` gains methods that take an optional `Player` and apply
    doctrine modifiers: `Config.warshipCost(player?)`,
    `Config.factoryBuildDuration(player?)`, etc. Defaults preserve
    today's numbers; doctrine modifiers multiply.
  - Schema: `doctrines: "off" | "on"` on `GameConfigSchema`; per-player
    `doctrine: Doctrine | null` on the join message.
- **Determinism / replay.** All modifiers must be pure functions of
  `(baseConfig, doctrine)`. Default `off` keeps replays bit-identical.
- **Acceptance.** Picking Naval makes a warship visibly cheaper in the
  build menu; picking Industrial speeds factory builds; switching off
  is identical to today.
- **Gotchas.** Display the active doctrine on the player card and in
  `PlayerInfoOverlay` so opponents can scout.

### Formal diplomacy

- **What.** Beyond the binary Alliance / Embargo today:
  - **Non-aggression pact** (NAP) — timed (e.g. 5 min). Breaking gives
    a permanent "treaty-breaker" reputation tag.
  - **Defensive pact** — auto-join a war if the partner is attacked.
  - **Tribute / vassalage** — recurring gold payments, with vassal
    forced to follow suzerain into wars.
- **Why.** Social games are richer with more granular diplomacy;
  treaty-breaking creates emergent narratives.
- **Implementation.**
  - Each treaty is a deterministic `Treaty` object held on
    `GameImpl._treaties: Map<string, Treaty>`.
  - New executions: `ProposeTreatyExecution`, `AcceptTreatyExecution`,
    `BreakTreatyExecution`. Mirror the alliance-execution structure
    under `src/core/execution/treaties/`.
  - Each treaty has `expiresAtTick`, `kind`, `parties: [PlayerID,
    PlayerID]`, plus per-kind data (e.g. tribute amount, frequency).
  - On break: append a `repTag: "treaty-breaker"` to the breaker's
    `Player.tags()`; AI players consider the tag when evaluating
    requests (`AiAttackBehavior` and friends).
  - Schema additions in `Schemas.ts`: new intent variants
    + `treaties: TreatyView[]` in `PlayerUpdate`.
  - Client UI: add a "Diplomacy" submenu in `PlayerPanel.ts`.
- **Determinism / replay.** All treaty effects (gold transfer, war
  joining) are tick-driven via standard executions. Old replays
  (no treaties present) must continue to work — populate `treaties`
  as `[]` in `PlayerUpdate.toView` when absent.
- **Acceptance.** Sign a NAP, attempt to attack, attack is rejected
  with a clear error message; break the NAP, the breaker gets the
  rep tag visible on their player card; tribute moves gold each
  payment tick.
- **Gotchas.** Defensive pacts can chain (A defends B, who defends
  C…) — cap chain length at 1 to avoid pulling the whole map into
  every fight.

### Game-mode: King-of-the-Hill / Capture-the-Capital

- **What.**
  - **KotH** — a fixed map tile (or per-team tile cluster) is the
    "hill". The player who controls it for cumulative N minutes wins.
  - **Capture-the-Capital** — every player has a randomly-assigned
    capital tile. Capturing it eliminates that player; last capital
    standing wins.
- **Why.** FFA / Team are the only modes today; KotH and CtC are
  proven competitive formats.
- **Implementation.**
  - Add `GameMode = "ffa" | "team" | "koth" | "capture_capital"` (extend
    existing mode enum).
  - KotH: new `KingOfTheHillExecution` that ticks every game-tick,
    checks the hill tile's owner, accumulates a `holdTicks` counter per
    player, and triggers victory at `Config.kothWinTicks()`.
  - CtC: assign capital at spawn (`SpawnExecution` extension); when a
    capital tile changes owner via `GameImpl.conquer`, fire a
    `CapitalCapturedEvent` and call `PlayerExecution`'s elimination
    path. Last alive wins.
  - Map data: KotH needs a designated "hill" — encode as a special
    tile flag or pull from the binary map header. Don't hard-code.
  - Schema: `gameMode: enum(...)` on `GameConfigSchema`. Default `"ffa"`.
- **Determinism / replay.** Mode dispatched at game-init; default keeps
  current code paths.
- **Acceptance.** A KotH game ends in finite time deterministically; a
  CtC game ends when one capital remains; FFA / team games are
  unaffected.
- **Gotchas.** `WinCheckExecution` currently encodes FFA / team win
  logic — refactor it to dispatch by mode rather than adding two more
  branches.

### Submarines

- **What.** A stealth naval unit that:
  - Doesn't appear on the enemy's `GameView` until detected.
  - Detection: within `Config.submarineDetectionRange()` of an enemy
    `Port` (radar arc) or actively pinging `Warship`.
  - Damage: can sink trade ships and `TransportShip` units in one
    shell-equivalent.
- **Why.** Adds a stealth layer to naval play; gives ports defensive
  value beyond trade.
- **Implementation.**
  - Add `UnitType.Submarine` in `src/core/game/Game.ts`.
  - New execution `SubmarineExecution.ts` modelled after
    `WarshipExecution` (patrol → target priority: TradeShip,
    TransportShip, Warship).
  - Visibility: extend the per-player view filter so a submarine is
    only included in a `PlayerView` if (a) the viewer is the owner, or
    (b) the viewer has a port within detection range of the sub.
  - Build cost / time: tunable via `Config.submarineCost()` /
    `submarineBuildDuration()`.
  - Display: client adds a "stealth shimmer" sprite to known subs and
    nothing to undetected ones (the unit just isn't there in the view).
  - Schema: new `UnitType` value (append to enum to preserve indices),
    config fields.
- **Determinism / replay.** Visibility filter is a view-construction
  detail — the deterministic state still tracks all subs everywhere.
  Old replays unaffected because no subs exist in them.
- **Acceptance.** A sub can be built; un-detected subs are invisible
  to the enemy; entering a port's detection range reveals them; subs
  sink trade ships in one hit.
- **Gotchas.** Ensure replays of OLD games still parse — appending to
  the `UnitType` enum at the END is essential. The detection check
  must run inside the view-construction, not inside the deterministic
  tick.

### Air units (bombers / interceptors)

- **What.** Two new air units:
  - **Bomber** — slow, expensive, drops a small radius of damage on a
    target tile. Counters tall stacks of `DefensePost` / `City`.
  - **Interceptor** — fast, cheap, only attacks bombers. Spawns from
    `City` (or new `Airbase` building).
- **Why.** Today SAMs only matter against nukes. Air units make SAMs a
  general AA tool and add another rock-paper-scissors vector.
- **Implementation.**
  - New `UnitType.Bomber`, `UnitType.Interceptor`.
  - Executions `BomberExecution` and `InterceptorExecution`. Both move
    over land/water (no naval pathing); bombers drop a `BombExecution`
    on arrival; interceptors target bombers within range and call
    `ShellExecution`.
  - SAM extension: `SAMLauncherExecution` already targets nukes — add
    bombers to its target type list, gated on `Config.samShootsAir()`
    so old games don't silently change SAM behaviour.
  - Build chain: bombers built from `City` (or new `Airbase`),
    interceptors from `City`.
- **Determinism / replay.** New unit types appended to enum; SAM
  behaviour change must be config-gated (default false).
- **Acceptance.** Bomber kills a `DefensePost` in one bomb; interceptor
  kills a bomber in 2 hits; SAM (when enabled) intercepts bombers.
- **Gotchas.** Pathing — air units need a fast straight-line pather,
  not the existing A*. Add a thin `AirPathFinder` that returns
  Bresenham line tiles.

### Spies / intel

- **What.** Place a Spy in another player to:
  - Reveal their structure positions (hidden ones become visible to
    you for 30 s).
  - OR reveal their attack-ratio / gold (one of these per spy mission).
- **Why.** Adds an intel game; counters perfect-info dominance.
- **Implementation.**
  - New `UnitType.Spy` (no rendered sprite on the map; lives "inside"
    the target player).
  - New execution `SpyExecution` — runs for `Config.spyDurationTicks()`,
    then auto-deletes. While alive, it sets a per-(viewer, target,
    info-kind) flag in `GameImpl` consulted by view construction.
  - Counter-intel: target player has a chance per tick to detect and
    arrest the spy (deterministic, seeded). Detected spy is destroyed
    and revealed in the chat.
  - Cost: gold + a small population draw.
- **Determinism / replay.** Detection RNG goes through `mg.random()`.
  Visibility extension is view-time only.
- **Acceptance.** Successful spy reveals the target's structures on
  the map; detection logs an event; expired spy stops revealing.
- **Gotchas.** Don't reveal nukes mid-flight via spy (stay on
  structures only).

### Resource diversification

- **What.** Add a secondary resource called **Industry**, generated by
  `Factory` and consumed by advanced units (warships, MIRVs, future
  bombers). Today gold is universal; industry forces players to build
  factories for late-game power, not just trains.
- **Why.** Factories are currently single-purpose (train economy).
  Decoupling military production from gold creates real economic
  trade-offs.
- **Implementation.**
  - Add `Player.industry(): bigint` and `Player.addIndustry(n)`,
    mirroring the `gold` API on `PlayerImpl`.
  - `Factory` (existing structure) generates industry per tick via a
    new `FactoryExecution` extension.
  - Build cost API: extend `UnitInfo.cost()` to return
    `{ gold?: bigint, industry?: bigint }` and update build validation
    in `canBuild`. Old units default to zero industry.
  - HUD: extend `GameLeftSidebar.ts` (or `GameRightSidebar.ts` —
    wherever gold currently shows) with a second pill for industry.
  - Schema: `industryEnabled: boolean` on `GameConfigSchema` (default
    false). When false, industry generation is zero and unit costs use
    only gold (current behaviour).
- **Determinism / replay.** Gate by `industryEnabled`. When false,
  every code path collapses to today's behaviour.
- **Acceptance.** With industry on: building a warship requires both
  gold and industry; factories accumulate industry visibly; with off:
  game plays exactly as today.
- **Gotchas.** Tutorial / first-game UX needs to mention industry only
  when enabled; tooltips (see §1) need to support both currencies.

## 4. Maps & World

### ✅ Day/night cycle visual layer

- **What.** Cosmetic dawn → noon → dusk → night tint over the map
  driven by the deterministic game tick (~10-minute cycle). Visual
  only; everyone sees the same time of day.
- **Status.** Implemented in
  `src/client/graphics/layers/DayNightLayer.ts`, registered in
  `GameRenderer.ts` between `FxLayer` and `UILayer`. Opt-in via
  Settings → "Day / night cycle".

### In-browser map editor

- **What.** A standalone page (e.g. `/editor`) where users paint
  terrain (land / water / mountain), set spawn points, label regions,
  and export to the same binary format `BinaryLoaderGameMapLoader`
  consumes today.
- **Why.** Today the only path is the Go `map-generator`. An
  in-browser editor 100× the contributor pool.
- **Implementation.**
  - New page: `src/client/editor/MapEditorPage.ts` (Lit element). Uses
    the same Pixi rendering stack as the in-game map view, but with
    paint tools (brush size, terrain type, eyedropper, undo stack).
  - Underlying data: a `Uint8Array` of tile types matching the binary
    map format. Reuse the encoder from `BinaryLoaderGameMapLoader`
    inverted into an exporter.
  - Spawn points: clickable markers stored alongside the bitmap; export
    to a JSON sidecar matching what `MapManifest` reads.
  - Save/load: localStorage for drafts; "Export" downloads a `.bin` and
    a manifest fragment.
  - Optional cloud save: post to `POST /api/maps` (auth required).
- **Determinism / replay.** None — editor is standalone.
- **Acceptance.** Round-trip: open existing built-in map in editor,
  re-export, diff binary == 0. Paint a small island, export, load it
  in a private lobby, play a 1v1.
- **Gotchas.** The map format expects specific magic bytes / version
  headers — read the loader carefully before designing the exporter.

### Community map workshop

- **What.** Upload + rate user maps; curated maps promoted to public
  lobbies. Depends on the editor above.
- **Implementation.**
  - Server: new tables `maps`, `map_ratings`, `map_reports` (Postgres).
    Add REST endpoints `POST /api/maps`, `GET /api/maps?sort=...`,
    `POST /api/maps/:id/rate`, `POST /api/maps/:id/report`.
  - File storage: maps live in `static/maps/community/<id>.bin` (or
    object storage in deploy).
  - Moderation queue: admin (existing `adminToken` flow) reviews
    reports and can soft-delete a map.
  - Curation: an admin-flippable `featured: boolean` flag elevates the
    map into the lobby browser's main rotation.
- **Determinism / replay.** Maps are content; replays already encode
  the map ID, so old replays continue to load against the original
  built-in maps.
- **Acceptance.** Upload via the editor; map appears in "Community"
  tab; can be played; rating averages display.
- **Gotchas.** Quotas — a single user can spam thousands of maps. Cap
  uploads per user per day. Validate file size and magic bytes
  server-side before persisting.

### Procedural islands mode

- **What.** Seeded random map generation as a game mode. Each game
  rolls a fresh map from a seed + parameters (island count, sea
  level, resource density).
- **Why.** Memorisation is a meta in ranked play; procedural maps
  reset the playing field each match.
- **Implementation.**
  - New module `src/core/maps/Procedural.ts`. Implement Perlin or
    simplex noise (deterministic from a seed) → threshold into
    land / water → flood-fill into discrete islands → place spawn
    points.
  - Run generation in the `Worker` at game-init, before normal
    `GameImpl` setup. Convert the generated bitmap into the same
    format `BinaryLoaderGameMapLoader` returns so downstream code is
    untouched.
  - Schema: `proceduralMap: { seed: number, params: {...} } | null`
    on `GameConfigSchema`. Replays must store the seed (they already
    store the map ID — use `proceduralMap` in lieu of `mapId`).
- **Determinism / replay.** Generation is a pure function of seed;
  replays re-generate the same map from the seed. The `params` shape
  must stay frozen once shipped.
- **Acceptance.** Two games with the same seed produce identical maps;
  spawn points are reachable and balanced (no spawn corner-locked).
- **Gotchas.** Generation can be slow — keep it under 500 ms or block
  lobby-start. Cache the bitmap by seed for replay re-runs.

### Weather / fog of war zones

- **What.**
  - **Storms** — moving polygons that reduce visibility (units within
    them are not visible to non-owners).
  - **River fords** — rivers, today probably uncrossable, gain
    designated ford tiles where troops can cross.
- **Why.** Adds tactical depth to map control beyond pure expansion.
- **Implementation.**
  - Storms: a new `StormManager` ticks every N ticks, moves storm
    polygons (deterministic) over the map. View construction filters
    out enemy units inside a storm if the viewer has no scout/port
    nearby (similar mechanic to subs).
  - Rivers / fords: extend the map binary format with a `tileFlags`
    field per tile (river, ford, mountain pass). Pathing
    (`A*` in `src/core/game/PathFinder*`) penalises river tiles with
    `Infinity` cost except at fords.
- **Determinism / replay.** Storm motion uses `mg.random()`. River
  flags are part of the map data, so replays of old maps without
  flags fall back to "no rivers" (zero impact).
- **Acceptance.** Storms render and move; units inside storms are
  hidden to non-allies; troops auto-route through fords.
- **Gotchas.** Storms can break the AI — `AiAttackBehavior` must
  handle hidden enemy units gracefully. New maps need ford
  authoring tooling (extend the editor).

### More real-world maps

- **What.** Add curated real-world maps: South-east Asia detail,
  Indian sub-continent, the Caribbean, the Mediterranean basin,
  Middle East with rivers as movement modifiers.
- **Why.** Map variety is the #1 returning-player driver.
- **Implementation.**
  - For each map: generate the binary map file (via the existing Go
    `map-generator` or the new in-browser editor), add to
    `resources/maps/`, register in the map manifest.
  - Add localised display name + "About this map" blurb in
    `resources/lang/<lang>.json`.
  - Add a thumbnail under `resources/maps/<map>/thumbnail.png`.
- **Determinism / replay.** Maps are immutable; old replays bind to
  their original map ID.
- **Acceptance.** Map appears in lobby browser, plays smoothly,
  spawn points balanced.
- **Gotchas.** Don't reuse map IDs from removed maps — new maps get
  fresh IDs to avoid breaking historical replay loads.

## 5. Multiplayer & Competitive

### ✅ Disconnect / reconnect grace

- **What.** Server-side `disconnectedTimeout` raised from 30 s → 60 s
  in `GameServer`. Players carry a deterministic `disconnectedSinceTick`,
  and `AiAttackBehavior`'s AFK strategy waits for
  `Config.aiAfkGraceTicks()` (~10 s default) before targeting them, so a
  brief net hiccup no longer hands you to the nearest nation.
- **Status.** Shipped. See `src/server/GameServer.ts`,
  `src/core/game/PlayerImpl.ts`,
  `src/core/execution/utils/AiAttackBehavior.ts`.

### Server browser / region picker

- **What.** A pre-lobby UI showing public servers grouped by region
  with live ping per region. The user picks a region (or auto-picks
  the lowest-latency one).
- **Why.** Players currently land on whichever region the master
  lobby decides; high-ping games are frustrating.
- **Implementation.**
  - Server: `MasterLobbyService` already routes players. Add an
    endpoint `GET /api/regions` returning
    `[{ id, displayName, healthcheckUrl }]`. Healthcheck is a tiny
    `/ping` route on each worker.
  - Client: a new `RegionPicker.ts` Lit element pings each region
    in parallel (`fetch`-based timing, average of 3) and displays
    sorted by latency. Selected region is sent in the
    `JoinLobbyMessage`.
- **Determinism / replay.** Latency only affects routing; once in a
  game, no determinism impact.
- **Acceptance.** Latencies displayed within ~1 s of opening the
  picker; choosing a region honours that choice; auto-pick chooses
  the lowest.
- **Gotchas.** CORS on the healthcheck endpoint must allow the
  client origin. Cache region list for 5 min on the client to avoid
  hammering the master.

### Friends list & party invites

- **What.** Add friends from the post-game scoreboard or a friend
  search; party up (max 4) and queue together for public lobbies;
  follow a friend into a private lobby.
- **Why.** Social retention is the single biggest multiplier for
  RTS lifetime.
- **Implementation.**
  - Server: tables `friendships(user_a, user_b, status)` and
    `parties(id, members[])`. Endpoints `POST /api/friends/:id`,
    `DELETE /api/friends/:id`, `POST /api/parties`,
    `POST /api/parties/:id/invite`, `POST /api/parties/:id/leave`.
  - WebSocket: extend the existing socket with a `PartyState` channel
    so members see each other's online status live.
  - Matchmaking: when a party queues, the master holds them in the
    same lobby (already supported via the lobby ID; just thread
    `partyId` through the join flow).
  - Client: `src/client/social/FriendsPanel.ts` (Lit element) docked
    in the main menu.
- **Determinism / replay.** None.
- **Acceptance.** Two accounts can friend each other, form a party,
  queue for a public game, end up in the same lobby.
- **Gotchas.** Block lists + abuse prevention (don't expose
  party members' public IDs to randoms).

### Spectator mode

- **What.** True observer slot — the client receives the full
  `GameView` but cannot send any `intent` (no spawn, no build, no
  chat-as-player). Useful for casters and replays-of-live-games.
- **Implementation.**
  - Server: extend `JoinLobbyMessage` with `role: "player" |
    "spectator"`. The lobby config gets `maxSpectators: number`.
  - In `GameServer`, spectators receive the same `GameUpdates` stream
    but their incoming intents are dropped server-side with a clear
    error message (they shouldn't be able to send any from the
    client either — gate the UI on role).
  - Client: hide build menu, attack ratio, etc. when role is
    spectator. Show a bigger map, leaderboard pinned, optional
    "follow player" camera.
- **Determinism / replay.** Spectator state is read-only; no impact.
- **Acceptance.** A spectator can watch a live game in real time;
  cannot send any state-changing message; can switch follow target.
- **Gotchas.** Don't leak hidden info (sub positions, spies) — view
  construction must apply the same fog-of-war as a non-aligned
  player. Provide an "all-seeing" admin role separately.

### In-game caster overlay

- **What.** Optional "tournament UI" with bigger player cards, a kill-
  feed, and a live economy / population graph. Built on top of
  spectator mode.
- **Implementation.**
  - New layer `src/client/graphics/layers/CasterOverlay.ts` rendered
    only when role == spectator AND `URL?caster=1`.
  - Player cards: large bottom-bar listing each player with flag,
    score, gold, troops.
  - Kill-feed: subscribes to `EventBus` (player elimination,
    significant unit kills, MIRV detonations).
  - Economy graph: 60-second sliding window of gold delta per player
    rendered as a small sparkline.
- **Determinism / replay.** None.
- **Acceptance.** Stream-friendly UI scales correctly at 1080p and
  4K; kill-feed updates within 1 tick of event.
- **Gotchas.** Avoid covering the map — overlays should occupy the
  letterbox region for ultra-wide streams.

### Tournaments / brackets

- **What.** First-class support for organising private brackets:
  schedule matches, auto-create lobbies at the right time, post
  results to a webhook (Discord).
- **Implementation.**
  - Server: tables `tournaments(id, name, format, owner, ...)`,
    `tournament_matches(tournament_id, round, p1, p2, winner,
    lobby_id)`. Endpoints to CRUD tournaments and report results.
  - Match-creation: when a match starts, create a private lobby
    pre-configured with the right settings + restricted to the two
    participants (use existing private-lobby invite codes).
  - Webhooks: outbound HTTP POST to user-supplied URLs on round
    completion; payload is a small JSON.
  - Client: a `TournamentPanel.ts` for organisers (bracket
    visualisation) + a smaller "your next match" widget for
    participants.
- **Determinism / replay.** None — tournament flow is metadata.
- **Acceptance.** Create a 4-player single-elimination tournament,
  play through it; webhooks fire; bracket updates live.
- **Gotchas.** Webhooks are an SSRF risk — validate the URL is
  HTTPS, public DNS, not pointing at internal addresses.

### Ranked seasons & MMR

- **What.** A per-player MMR rating that adjusts after each ranked
  game. Seasons reset every quarter with cosmetic rewards for top
  brackets.
- **Implementation.**
  - Server: `players.mmr` column, `seasons` table, `ranked_matches`
    table. Use Glicko-2 (better than Elo for sporadic players).
  - Lobby type: "ranked" lobbies require the player to have ≥10
    completed games; matchmaking (a thin wrapper on the master)
    pairs by MMR ±100 with a widening window.
  - End-of-game: `WinCheckExecution` already emits a winner — server
    reads the result and adjusts MMR.
  - Client: leaderboard tab grouped by tier (Bronze / Silver / Gold /
    Platinum / Diamond / Master).
- **Determinism / replay.** None — MMR is post-game metadata.
- **Acceptance.** Win moves rating up, loss down; MMR difference is
  larger when underdog wins; season reset preserves history.
- **Gotchas.** Smurf detection is hard — start without it, watch for
  obvious abuse, add later.

## 6. Cosmetics & Personalisation

### Pattern editor in the browser

- **What.** A small in-modal painter (16×16 or 32×32 grid) where users
  design custom territory patterns. Today patterns are uploaded
  out-of-band.
- **Implementation.**
  - New Lit element `src/client/cosmetics/PatternEditor.ts`. Backed
    by a 2D canvas; each cell toggles on click.
  - Output format: must match the existing `PatternDecoder` input
    bitstring exactly. Re-use the encoder by reading
    `PatternDecoder.ts` and inverting it.
  - Save: `POST /api/cosmetics/patterns` (auth required, rate-limited
    to a few uploads per hour).
  - Live preview: render the pattern over a sample territory
    silhouette inside the modal.
- **Determinism / replay.** None — patterns are visual.
- **Acceptance.** Draw a pattern, save, equip, verify it shows in a
  test game.
- **Gotchas.** Validate dimensions and bit-length server-side.
  Moderation: patterns can be NSFW shapes — provide a report flow.

### Animated banners / flag holders

- **What.** Cosmetic banner / flag-holder graphics with subtle
  animations (waving cloth, glowing trim) unlocked by clan rank.
- **Implementation.**
  - Animated sprites stored under `resources/cosmetics/banners/<id>/`
    as either spritesheets or short Lottie files.
  - `PlayerInfoOverlay` and `Leaderboard` render the active banner.
  - Server: gate equip via clan-rank check.
- **Determinism / replay.** Pure cosmetic; replays render the
  banner the player had at game time (record `cosmeticState` in the
  player join data).
- **Acceptance.** Equipped banner shows in the player card; locked
  banners cannot be equipped.
- **Gotchas.** Animations on 50+ player cards in a big game can hurt
  FPS — pause animation when card is off-screen.

### End-of-game victory animations

- **What.** Themed victory animations per civilisation/doctrine
  (depends on §3 doctrines): Naval doctrine plays a fleet flyby,
  Industrial plays a factory time-lapse, etc.
- **Implementation.**
  - Add `VictoryAnimationLayer.ts` mounted on the post-game screen.
  - Animations: short pre-rendered videos or canvas-based scenes.
  - Pick the animation based on the winning player's doctrine; fall
    back to a generic "victory" animation when doctrines disabled.
- **Determinism / replay.** Pure cosmetic.
- **Acceptance.** Each doctrine has its animation; generic fallback
  works; can be skipped (Esc).
- **Gotchas.** Keep it short (≤8 s); offer a "skip" button by default.

### Custom emote wheel

- **What.** Bind your six favourite emojis to the radial chat instead
  of always opening the full picker.
- **Implementation.**
  - Persist a `UserSettings.emoteWheel: string[6]` (JSON of emoji
    code-points).
  - Modify `RadialMenu.ts`: when chat radial is opened with a chosen
    modifier (e.g. shift), render the wheel using `emoteWheel`
    instead of the full set.
  - Settings UI: a small picker in `UserSettingModal.ts` to set the 6
    emojis.
- **Determinism / replay.** Pure client.
- **Acceptance.** Configure 6 emojis, open radial-with-modifier in
  game, see only those.
- **Gotchas.** Use only emojis already in `EmojiTable` to avoid
  rendering surprises.

## 7. Performance & Tech Debt

### Replace `process.env.WEBSOCKET_URL` injection

- **What.** Stop using the legacy `define`-block injection of
  `process.env.WEBSOCKET_URL`. Use `import.meta.env.VITE_WEBSOCKET_URL`
  via Vite's standard env-var path.
- **Implementation.**
  - Rename the env var in `.env` files to `VITE_WEBSOCKET_URL`.
  - Replace every `process.env.WEBSOCKET_URL` in client code (`rg
    'process.env.WEBSOCKET_URL' src/client`) with
    `import.meta.env.VITE_WEBSOCKET_URL`.
  - Drop the `define` entry in `vite.config.ts`.
  - Update `replit.md` env-var documentation.
- **Acceptance.** App starts and connects in dev + prod; no
  `process.env` references remain in client code.
- **Gotchas.** Server code (`src/server/`) still uses `process.env.*`
  legitimately — don't touch those.

### Type-safe `EventBus`

- **What.** Today `src/core/EventBus.ts` uses string keys. Codify
  events as a discriminated union so subscribers / publishers get
  full type safety.
- **Implementation.**
  - Define `type AppEvent = NukeLaunchedEvent | AllianceFormedEvent |
    …` (one variant per existing emit site).
  - Refactor `EventBus.on<T extends AppEvent['kind']>(kind: T,
    handler: (e: Extract<AppEvent, { kind: T }>) => void)`.
  - Migrate all callers in tranches per directory.
- **Acceptance.** `tsc --noEmit` clean; no `any` introduced; no
  behaviour change.
- **Gotchas.** Some events are emitted from worker code, some from
  UI — keep a single canonical `AppEvent` union and re-export from
  both contexts.

### Move static asset hashing into a Vite plugin

- **What.** Replace the ad-hoc `syncHashedPublicAssets` plugin with a
  proper Vite plugin using its asset graph.
- **Implementation.**
  - Vite already content-hashes processed assets. The current plugin
    handles assets in `static/` that bypass the bundler.
  - Either move them into the bundler (preferred) or write a small
    `vite-plugin-static-hash` that emits hashed copies during build
    and rewrites references in HTML / CSS.
  - Tests `tests/server/StaticAssetCache.test.ts` and
    `tests/server/PublicAssetManifest.test.ts` already exercise the
    behaviour — they should keep passing without modification.
- **Acceptance.** All static-asset tests still pass; hashes change
  only when content changes; cache headers still long-TTL.
- **Gotchas.** Don't break service-worker cache invalidation — bump
  the SW version if hash strategy changes.

### Test coverage for executions

- **What.** `tests/server` is light. Every execution that mutates
  `GameImpl` deserves a deterministic unit test.
- **Implementation.**
  - For each file in `src/core/execution/*Execution.ts` not yet
    covered, add a `tests/<Name>.test.ts` that:
    1. Sets up a `Game` via `tests/util/Setup.ts`.
    2. Adds the execution.
    3. Steps `executeNextTick` enough times to observe the effect.
    4. Asserts on `Player` / `Unit` / `Tile` state.
  - Use `tests/PortExecution.test.ts` as the template.
- **Acceptance.** Coverage of `src/core/execution/` reaches ≥80 %
  line-coverage (run `vitest --coverage`).
- **Gotchas.** Some executions need real maps; use the tiny
  `half_land_half_ocean` / `plains` fixtures rather than full-size
  real-world maps to keep tests fast.

### Worker memory cap & graceful eviction

- **What.** Long uptimes on the `Worker` cluster grow the
  game-history buffer until OOM. Add an LRU cap.
- **Implementation.**
  - In `src/server/Worker.ts`, track per-game memory cost roughly
    (recorded ticks count × tile count). Maintain an LRU of finished
    games.
  - When total memory crosses `WORKER_MEMORY_CAP_MB` (env var),
    evict oldest finished games until under the cap.
  - Don't evict in-progress games. Flush replays of evicted games
    to long-term storage (S3 / object store) first.
- **Acceptance.** Worker RSS stays under cap during a 24 h soak
  test with continuous traffic.
- **Gotchas.** Replay download endpoints must transparently fetch
  from long-term storage if not in-memory.

### WebGPU rendering path

- **What.** PixiJS v8 supports WebGPU. Add an opt-in flag that
  selects the WebGPU renderer when supported, expecting large FPS
  wins on big maps.
- **Implementation.**
  - Pixi exposes a `preference: "webgpu" | "webgl"` option on init.
  - Add `UserSettings.preferWebGPU(): boolean` (default false initially;
    flip to true after a few weeks of beta).
  - Feature-detect at startup; fall back to WebGL if `navigator.gpu`
    is missing.
  - Add a small "Renderer: WebGPU/WebGL" indicator in
    `PerformanceOverlay.ts`.
- **Acceptance.** WebGPU users see the indicator; FPS measured on a
  large map (4k × 4k) is materially higher; WebGL fallback still
  works on browsers without WebGPU.
- **Gotchas.** Some custom shaders may not port cleanly — test the
  pattern overlay and fog effects.

### Asset streaming

- **What.** On large maps, load only the tiles for the active region
  first; defer the rest. Useful for slow connections.
- **Implementation.**
  - The map binary is monolithic today. Either
    1. Split it into 256×256 chunks at build time and stream chunks
       as the camera moves.
    2. Or stream the whole map but in priority order (visible first,
       neighbours next, far last).
  - Option 2 is simpler — change the map fetch to a streaming
    response and decode incrementally.
- **Acceptance.** Time-to-first-render on a slow link drops by
  ≥30 % on the largest map.
- **Gotchas.** Game logic assumes the full map is loaded — gate
  game start on full load. Streaming only affects render warm-up.

## 8. Modding & Community

### First-party mod loader

- **What.** Load user JS that subscribes to `EventBus` events but
  cannot mutate state — strictly observers (overlays, stat trackers,
  alert sounds).
- **Implementation.**
  - Define `ModAPI`: read-only access to `GameView`, subscribe to a
    whitelist of `EventBus` events, render into a dedicated DOM root
    (#mod-area) overlaid on the game.
  - Mods are loaded from a user-supplied URL (or local file) inside
    a sandboxed iframe with `sandbox="allow-scripts"` (no
    same-origin). Communicate via `postMessage`.
  - Provide a typed npm package `@openfront/mod-types` (`.d.ts` only)
    for mod authors.
- **Determinism / replay.** Mods have zero state-mutation rights —
  determinism is preserved by construction.
- **Acceptance.** A reference mod (e.g. "show enemy gold delta over
  last 60s") loads, runs, has no effect on game state.
- **Gotchas.** Make absolutely sure mods can't talk to the WebSocket
  — keep the iframe origin-isolated.

### Public typed API package

- **What.** Publish `@openfront/sdk` on npm wrapping the public REST
  API documented in `docs/API.md` so third-party stat sites stop
  hand-rolling fetch calls.
- **Implementation.**
  - New folder `packages/sdk/` (introduce a workspace if not already
    present). One TS file per resource (players, games, replays,
    leaderboards).
  - Generate types from a single OpenAPI / Zod spec — reuse
    `src/core/Schemas.ts` where possible.
  - Add CI publish step on tag.
- **Acceptance.** `npm install @openfront/sdk`; `new
  OpenfrontClient(...).getPlayer(id)` returns typed data.
- **Gotchas.** Keep the SDK dependency-light (just `fetch` /
  `undici`).

### OBS browser-source overlay

- **What.** A read-only HUD URL streamers can drop into OBS as a
  browser source: shows player score, kills, alliance status with a
  transparent background.
- **Implementation.**
  - New page `/overlay/:gameId` (no auth — public URL is the access
    token, like a stream key).
  - Subscribes to the same WebSocket as a spectator (read-only).
  - Pure CSS overlay over a transparent background; no chrome.
- **Acceptance.** OBS browser source displays the overlay without
  background colour; updates in real time.
- **Gotchas.** Don't expose hidden info (apply spectator fog-of-war).

### Localisation contribution flow

- **What.** Document in `CONTRIBUTING.md` how to translate the game
  into a new language, with a single command (`npm run i18n:export`)
  to generate Crowdin-friendly source files.
- **Implementation.**
  - Inventory existing `resources/lang/<lang>.json` files and the
    fallback / merge logic.
  - Add a small Node script `scripts/i18nExport.ts` that produces a
    canonical `en.json` (the source of truth) plus a "missing keys"
    report per language.
  - Document how to submit a translation PR.
- **Acceptance.** A new contributor following only `CONTRIBUTING.md`
  can submit a fully-functional translation PR.
- **Gotchas.** Watch for Lit-template placeholder formats — they
  must survive the translation round-trip.

## 9. Operations & Ops Hygiene

### Health endpoint (`/healthz`)

- **What.** A lightweight `GET /healthz` returning master + worker
  readiness for use by load balancers and the deployment platform.
- **Implementation.**
  - Master: respond `200 { masterReady: true, workersReady: N/M }`.
    Read worker count from existing master state. Return `503` when
    `workersReady === 0`.
  - Workers: their own `/healthz` returns `200 { worker: true,
    activeGames: N, memMB: X }`.
  - No auth (intentionally public — load balancers).
- **Acceptance.** `curl /healthz` returns 200 in normal operation
  and 503 when no workers are alive.
- **Gotchas.** Keep the response time < 50 ms — load balancers
  hammer this.

### Structured admin dashboard

- **What.** A web dashboard (behind `adminToken`) showing live
  lobby / worker / player counts, recent errors, replay search.
  Replaces ad-hoc log greps.
- **Implementation.**
  - New route `/admin` gated on `adminToken` cookie.
  - Server endpoints `GET /api/admin/overview`, `GET /api/admin/games`,
    `GET /api/admin/players`, etc.
  - Client: a single Lit page (or small framework if too complex);
    poll every 5 s.
  - Admin actions (kick player, end game) reuse existing
    `KickPlayerExecution`-style flows behind admin checks.
- **Acceptance.** Admin can see the cluster state at a glance and
  perform basic moderation actions.
- **Gotchas.** Audit-log every destructive admin action.

### Per-region capacity autoscaling

- **What.** Master signals load metrics so the deployment platform
  can autoscale workers per region.
- **Implementation.**
  - Master emits a `GET /api/metrics` endpoint in Prometheus format
    with `lobby_count`, `active_games`, `players_online` per region.
  - Configure the deploy target (Replit deploy, K8s, etc.) to scale
    on `active_games > 0.7 × capacity`.
- **Acceptance.** Load test with 10× normal traffic triggers scale-up;
  scale-down happens within 5 min of returning to baseline.
- **Gotchas.** Don't scale down workers with active games; gate
  termination on `activeGames == 0`.

### Crash-safe game persistence

- **What.** Snapshot in-progress games every N ticks to disk so a
  worker crash can resume an in-progress public game instead of
  dropping it.
- **Implementation.**
  - Worker periodically (every ~600 ticks ≈ 1 min at 10 TPS)
    serialises `GameImpl` state + the recent intent log to a file
    under `${TMP}/games/<gameId>.snapshot`.
  - On worker startup, scan `${TMP}/games/` for snapshots, replay
    the intent tail to bring them current, and resume serving them.
  - On graceful shutdown (SIGTERM), flush snapshots before exit.
- **Determinism / replay.** Snapshot must capture every byte of
  `GameImpl` state plus the seeded RNG state. The intent log replay
  must produce bit-identical results to the original execution.
- **Acceptance.** Kill -9 a worker mid-game; spawn a new worker;
  game resumes for connected clients within ~5 s.
- **Gotchas.** Snapshot size on big maps can be huge — compress and
  cap retention at the most recent snapshot per game.

---

## How to use this list

1. Pick an item.
2. Open an issue referencing the heading.
3. If it touches `src/core/`, write a deterministic unit test first.
4. Keep PRs small — a single roadmap bullet per PR.
5. Update this file in the same PR: flip the bullet to ✅ and replace
   the speculative sections with the concrete "Status" line pointing
   at the file(s) of record (mirror the existing completed entries
   above).
