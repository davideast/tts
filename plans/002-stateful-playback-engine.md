# Plan 002: Build stateful `PlaybackEngine` with sample-accurate scrubbing, rate scaling, and timeupdate ticker

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f5f7704..HEAD -- src/audio/player/ package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-media-storage-engine.md
- **Category**: tech-debt
- **Planned at**: commit `f5f7704`, 2026-09-08

## Why this matters

`ChunkQueueAudioPlayer` is currently an append-only stream sink designed for live synthesis chunks. It cannot seek to arbitrary timestamps, scrub backward or forward by seconds, adjust playback rate (`-r`), or emit regular playhead progress events (`timeupdate`). A terminal UI scrubber requires a high-level stateful media engine that decouples `afplay` process management from UI interactions.

## Current state

`ChunkQueueAudioPlayer` in `src/audio/player/chunk-queue-audio-player.ts:28-48` manages a single sequential queue:

```ts
export class ChunkQueueAudioPlayer implements IAudioPlayer {
  private activeProcess?: ChildProcess;
  private isAborted = false;
  private isPaused = false;
  private wasPausedDuringPlayback = false;
  private queue: Promise<void> = Promise.resolve();
```

While it introduced sample-accurate slicing for pause/resume, it does not support:
1. Seeking to an absolute `positionMs` or scrubbing $\pm 5\text{s}$.
2. Setting playback rate (`afplay -r <rate>`).
3. Continuous time updates (the UI has no way of knowing current position without estimating).
4. Managing a track queue (next/prev/auto-advance).

## Commands you will need

| Purpose | Command | Expected on success |
| :--- | :--- | :--- |
| Build | `bun run build` | exit 0, dist/ emitted |
| Test | `bun test test/audio/playback-engine.test.ts` | exit 0, all tests pass |
| Typecheck | `bunx tsc -p tsconfig.json --noEmit` | exit 0, no errors |
| Verification | `bun run verify` | exit 0, all checks pass |

## Scope

**In scope**:
- `src/audio/player/types.ts` (create)
- `src/audio/player/playback-engine.ts` (create)
- `src/audio/index.ts` (export new player engine)
- `test/audio/playback-engine.test.ts` (create)

**Out of scope**:
- Direct OpenTUI rendering.
- Modifying `LiveAudioPlayerSink`.
- Modifying `AudioLibrary` (from Plan 001).

## Git workflow

- Branch: `feat/002-stateful-playback-engine`
- Commit per step; message style: `feat(audio): <description>`

## Steps

### Step 1: Define player engine types in `src/audio/player/types.ts`

Create `src/audio/player/types.ts` with:
- `PlaybackStatus`: `'idle' | 'playing' | 'paused' | 'stopped'`.
- `PlaybackTimeUpdate`: `positionMs`, `durationMs`, `progressPct`, `rate`.
- `PlaybackEngineEvents`:
  - `'status'`: `(status: PlaybackStatus) => void`
  - `'timeupdate'`: `(data: PlaybackTimeUpdate) => void`
  - `'track:start'`: `(track: TrackMetadata) => void`
  - `'track:end'`: `(track: TrackMetadata) => void`
  - `'error'`: `(err: Error) => void`

**Verify**: `bunx tsc -p tsconfig.json --noEmit` → exit 0

### Step 2: Implement `PlaybackEngine` in `src/audio/player/playback-engine.ts`

Implement `PlaybackEngine` extending `EventEmitter`:
- **State Properties**:
  - `status: PlaybackStatus = 'idle'`
  - `rate: number = 1.0` (clamped between `0.5` and `2.5`, default step `0.25`)
  - `positionMs: number = 0`
  - `durationMs: number = 0`
  - `currentTrack: TrackMetadata | null = null`
  - `queue: TrackMetadata[] = []`
- **Core Methods**:
  - `load(track: TrackMetadata, autoPlay = true): Promise<void>`
    Reads WAV file into memory buffer, parses header to determine total duration and PCM byte length.
  - `play(): Promise<void>` / `pause(): void` / `togglePause(): void` / `stop(): void`
  - `seek(positionMs: number): Promise<void>`:
    Clamps `positionMs` between `0` and `durationMs`.
    Aborts active `afplay` process immediately.
    Calculates 16-bit sample-aligned PCM byte offset:
    `byteOffset = Math.floor((positionMs / 1000) * 48000); byteOffset -= byteOffset % 2;`
    Slices remaining PCM buffer, attaches new WAV header, and spawns `afplay -r <rate> <slicedFile>`.
  - `scrub(deltaMs: number): Promise<void>`:
    Calls `seek(this.positionMs + deltaMs)`.
  - `setRate(newRate: number): Promise<void>`:
    Clamps rate to `[0.5, 2.5]`.
    If currently playing, records current playhead, kills process, and respawns `afplay -r <newRate>` from current position.
- **Timeupdate Loop**:
  - Runs on a 100ms `setInterval` only while `status === 'playing'`.
  - In each tick, calculates:
    `const wallElapsedMs = performance.now() - this.segmentStartTime;`
    `const audioElapsedMs = wallElapsedMs * this.rate;`
    `this.positionMs = Math.min(this.durationMs, this.segmentStartOffsetMs + audioElapsedMs);`
    Emits `'timeupdate', { positionMs, durationMs, progressPct, rate }`.
- **Queue Controls**:
  - `enqueue(track: TrackMetadata): void`
  - `next(): Promise<void>`
  - `prev(): Promise<void>`
  - Auto-advances to next track in queue on track completion.

**Verify**: Create and run `test/audio/playback-engine.test.ts` via `bun test test/audio/playback-engine.test.ts` → all pass.

### Step 3: Export from `src/audio/index.ts` and `src/index.ts`

Export `PlaybackEngine` and its types from `src/audio/index.ts` and re-export in `src/index.ts`.

**Verify**: `bun run build && bun run verify` → exit 0, all tests pass.

## Test plan

- `test/audio/playback-engine.test.ts`:
  - `load` loads track and correctly computes duration from WAV header.
  - `seek` calculates sample-aligned PCM byte offsets and clamps out-of-range bounds.
  - `scrub(+5000)` and `scrub(-5000)` update playhead appropriately.
  - `setRate(1.5)` scales audio elapsed time calculation (`audioElapsed = wall * rate`).
  - `enqueue` and `next()` progress sequentially through a queue of tracks.
  - `timeupdate` emits periodic progress packets with matching duration and progress percentage.

## Done criteria

- [ ] `bunx tsc -p tsconfig.json --noEmit` exits 0.
- [ ] `bun test test/audio/playback-engine.test.ts` exits 0.
- [ ] `bun run verify` exits 0.
- [ ] `plans/README.md` status row updated to DONE.

## STOP conditions

- If `afplay -r` on macOS produces unexpected exit codes on high rates (>2.0), clamp the supported rate range to `[0.75, 2.0]` before proceeding.
- If rapid seeking causes overlapping child process race conditions, verify the previous child process is cleanly terminated before spawning the new segment.

## Maintenance notes

- On Linux environments without `afplay`, `aplay` does not natively support `-r`. The player should detect Linux and log a warning that rate scaling requires `sox` or fall back to 1.0x rate.
