# Plan 004: Implement fullscreen OpenTUI terminal dashboard with library, transcript viewer, and scrubber

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f5f7704..HEAD -- src/cli/command.ts package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: LOW
- **Depends on**: plans/003-antigravity-studio-store.md
- **Category**: direction
- **Planned at**: commit `f5f7704`, 2026-09-08

## Why this matters

`mdmedia` currently runs as a headless command-line watcher without an interactive audio dashboard. Users cannot scrub through long audio narrations, inspect the generated Markdown script side-by-side with audio, adjust playback speed on the fly, or browse their historical library in the terminal. This plan builds the fullscreen terminal user interface using OpenTUI (`@opentui/react` on a native Zig core with Bun), giving developers an audio studio experience comparable to `lazygit` or `spotify-tui`.

## Current state

The project runs on Bun (`bun.lock`, `bun run build`). The CLI commands in `src/cli/command.ts` currently expose:
- `mdmedia audio`
- `mdmedia video`
- `mdmedia watch`
- `mdmedia plugin`

All components consume the headless `StudioStore` built in Plan 003, ensuring the TUI itself contains zero audio device management, PCM calculations, or transcript parsing.

## Commands you will need

| Purpose | Command | Expected on success |
| :--- | :--- | :--- |
| Install deps | `bun add @opentui/core @opentui/react react @types/react` | exit 0 |
| Build | `bun run build` | exit 0, dist/ emitted |
| Typecheck | `bunx tsc -p tsconfig.json --noEmit` | exit 0, no errors |
| Verification | `bun run verify` | exit 0, all checks pass |

## Scope

**In scope**:
- `package.json` (add `@opentui/core`, `@opentui/react`, `react`, `@types/react`)
- `src/tui/hooks/use-studio-store.ts` (create)
- `src/tui/components/header-bar.tsx` (create)
- `src/tui/components/library-pane.tsx` (create)
- `src/tui/components/transcript-pane.tsx` (create)
- `src/tui/components/transport-deck.tsx` (create)
- `src/tui/app.tsx` (create)
- `src/tui/index.ts` (create)
- `src/cli/command.ts` (add `studio` command)

**Out of scope**:
- Modifying `AudioLibrary`, `PlaybackEngine`, or `StudioStore` (already built in plans 001–003).
- Modifying Web UI AuxPane iframe components.

## Git workflow

- Branch: `feat/004-opentui-studio-interface`
- Commit per step; message style: `feat(tui): <description>`

## Steps

### Step 1: Install OpenTUI and React dependencies

Install `@opentui/core`, `@opentui/react`, and `react`:
```bash
bun add @opentui/core@^0.5.11 @opentui/react@^0.5.11 react@^18.2.0
bun add -d @types/react@^18.2.0
```

Configure `tsconfig.json` to ensure `"jsx": "react-jsx"`.

**Verify**: `bunx tsc -p tsconfig.json --noEmit` → exit 0

### Step 2: Create `useStudioStore` React hook in `src/tui/hooks/use-studio-store.ts`

Create hook connecting React state to `StudioStore`:
- Subscribes to `studioStore.subscribe` on mount.
- Returns current `StudioState` and bound actions.

**Verify**: `bunx tsc -p tsconfig.json --noEmit` → exit 0

### Step 3: Implement Visual Components in `src/tui/components/`

1. **`HeaderBar` (`header-bar.tsx`)**:
   - Flexbox row: `mdmedia Studio v0.1.0`.
   - Streaming status indicator (`● STREAMING` in green when active, `⏸ PAUSED` in yellow).
   - Speed rate badge (`1.25x`) and total tracks counter.
2. **`LibraryPane` (`library-pane.tsx`)**:
   - Left panel (35% width, single border, titled "Library & History [1]").
   - Filter input bar (toggled with `/`).
   - Scrollable track list grouped by date.
   - Selected track highlighted with `▸` and active playhead indicator `♫`.
3. **`TranscriptPane` (`transcript-pane.tsx`)**:
   - Right panel (flexGrow: 1, titled "Transcript [transcript.md] [2]").
   - Renders selected track's markdown content using OpenTUI's `<code>` and formatted paragraphs.
   - Highlights the current sentence corresponding to `playback.activeChunkIndex`.
4. **`TransportDeck` (`transport-deck.tsx`)**:
   - Bottom deck (height: 6, titled "Now Playing").
   - Track title and voice badge.
   - High-resolution timeline bar with elapsed time, progress bar, and remaining time.
   - Keybinding legend: `[Space] Pause  [←/→] ±5s  [H/L] ±30s  [</>] Speed  [Tab] Pane  [q] Quit`.

**Verify**: `bunx tsc -p tsconfig.json --noEmit` → exit 0

### Step 4: Implement `StudioApp` and Keyboard Routing in `src/tui/app.tsx`

Implement root `StudioApp`:
- Wire up `useKeyboard((key) => ...)`:
  - `space`: `actions.togglePause()`
  - `left` / `right`: `actions.scrub(-5000)` / `actions.scrub(+5000)`
  - `h` / `l`: `actions.scrub(-30000)` / `actions.scrub(+30000)`
  - `>` / `<`: `actions.setRate(playback.rate ± 0.25)`
  - `up` / `down`: Navigate library selection
  - `return`: Play selected track
  - `tab`: Toggle active pane focus (`library` $\leftrightarrow$ `transcript`)
  - `q`: Gracefully clean up terminal and exit
- Attach process cleanup listeners (`SIGINT`, `SIGTERM`, `uncaughtException`) to call renderer's `destroy()` so terminal cursor and screen buffer are always restored cleanly.

**Verify**: `bunx tsc -p tsconfig.json --noEmit` → exit 0

### Step 5: Register `studio` command in `src/cli/command.ts`

Add `studioCommand` in `src/cli/command.ts`:
- Launches OpenTUI renderer via `startStudioTui()`.
- Updates `mainCommand` subcommands to include `studio: studioCommand`.

**Verify**: `bun run build && bun run verify` → exit 0, all checks pass.

## Test plan

- Visual manual test:
  - Run `bun run dev studio`.
  - Verify terminal enters alternate screen without flicker.
  - Verify tracks loaded from `AudioLibrary` are displayed.
  - Press Space: verify playhead advances and timeline bar scrubs smoothly.
  - Press `>`: verify speed increments to `1.25x` and audio rate scales in real time.
  - Press `Tab`: verify focus outlines switch between Library and Transcript panes.
  - Press `q`: verify terminal exits cleanly and restores cursor.
- Automated package verification:
  - Run `bun run verify` to ensure the npm build tarball and consumer sandbox pass with 0 errors.

## Done criteria

- [ ] `bun add @opentui/core @opentui/react` installed cleanly.
- [ ] `bunx tsc -p tsconfig.json --noEmit` exits 0.
- [ ] `bun run build` emits valid binaries in `dist/`.
- [ ] `bun run verify` passes with 0 errors.
- [ ] `plans/README.md` status row updated to DONE.

## STOP conditions

- If `@opentui/core` FFI fails on Linux/Windows during `bun run verify`, verify native prebuilt binary resolution before proceeding.
- If terminal cursor is hidden after abnormal termination, ensure `process.on('exit')` explicitly writes `\x1b[?25h` to stdout.

## Maintenance notes

- Future considerations: Support theme switching (e.g. Catppuccin, Tokyo Night, Nord) using OpenTUI's style tokens.
