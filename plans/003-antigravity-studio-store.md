# Plan 003: Create headless `StudioStore` and connect `/listen` watcher to persistent track library

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f5f7704..HEAD -- src/cli/agy-watch.ts package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-media-storage-engine.md, plans/002-stateful-playback-engine.md
- **Category**: architecture
- **Planned at**: commit `f5f7704`, 2026-09-08

## Why this matters

The terminal user interface must never execute file I/O, orchestrate Gemini TTS synthesis, or manage process locks directly. It needs a headless, reactive `StudioStore` that binds together the `AudioLibrary` (Plan 001), the `PlaybackEngine` (Plan 002), and the Antigravity `/listen` conversation watcher. When a user sends `/listen` in Antigravity, the turn must be synthesized, streamed to the speakers if active, and automatically persisted into the audio library with chunk timecode alignments.

## Current state

In `src/cli/agy-watch.ts:150-180`, the watcher synthesizes audio directly to `LiveAudioPlayerSink(sharedPlayer)` without saving the output to a track library:

```ts
// src/cli/agy-watch.ts:153-167
const paragraphs = parseMarkdownToSpeakableParagraphs(item.content);
const chunks = chunkSpeakableParagraphs(paragraphs, 400);
if (chunks.length === 0) return;

sharedPlayer.reset();
const eventBus = new UniversalEventBus();
const sink = new LiveAudioPlayerSink(sharedPlayer);
sink.attachToEventBus(eventBus);

activePipeline = new DocumentAudioPipeline(provider, eventBus);
await activePipeline.processDocument(chunks, item.voice || defaultVoice, item.style ?? defaultStyle);
await sink.waitForPlaybackComplete();
```

When synthesis finishes, the PCM bytes and the markdown transcript are discarded.

## Commands you will need

| Purpose | Command | Expected on success |
| :--- | :--- | :--- |
| Build | `bun run build` | exit 0, dist/ emitted |
| Test | `bun test test/studio/studio-store.test.ts` | exit 0, all tests pass |
| Typecheck | `bunx tsc -p tsconfig.json --noEmit` | exit 0, no errors |
| Verification | `bun run verify` | exit 0, all checks pass |

## Scope

**In scope**:
- `src/studio/types.ts` (create)
- `src/studio/narration-recorder.ts` (create)
- `src/studio/studio-store.ts` (create)
- `src/studio/index.ts` (create)
- `src/cli/agy-watch.ts` (update to use `StudioStore` & `AudioLibrary`)
- `test/studio/studio-store.test.ts` (create)

**Out of scope**:
- OpenTUI visual component implementation (Plan 004).
- Modifying `GeminiTTSProvider`.

## Git workflow

- Branch: `feat/003-antigravity-studio-store`
- Commit per step; message style: `feat(studio): <description>`

## Steps

### Step 1: Define `StudioStore` types in `src/studio/types.ts`

Create `src/studio/types.ts` with:
- `StudioState`:
  - `tracks: TrackMetadata[]`
  - `selectedTrack: TrackMetadata | null`
  - `playback: { status: PlaybackStatus; positionMs: number; durationMs: number; rate: number; activeChunkIndex: number }`
  - `queue: TrackMetadata[]`
  - `live: { isStreaming: boolean; activeSessionId: string | null; currentChunkText: string | null }`
  - `filterQuery: string`
- `StudioAction`:
  - `play(trackId?: string): Promise<void>`
  - `pause(): void`
  - `togglePause(): void`
  - `seek(positionMs: number): Promise<void>`
  - `scrub(deltaMs: number): Promise<void>`
  - `setRate(rate: number): Promise<void>`
  - `selectTrack(trackId: string): void`
  - `setFilter(query: string): void`
  - `deleteTrack(trackId: string): Promise<void>`
  - `next(): Promise<void>`
  - `prev(): Promise<void>`

**Verify**: `bunx tsc -p tsconfig.json --noEmit` → exit 0

### Step 2: Implement `NarrationRecorder` in `src/studio/narration-recorder.ts`

Implement `NarrationRecorder`:
- Wraps `DocumentAudioPipeline` and attaches to `UniversalEventBus`.
- Accumulates raw PCM bytes in a buffer while synthesis runs.
- Collects `chunk:start` and `chunk:complete` events to record `ChunkTiming` entries:
  - `startMs`: Cumulative duration of preceding PCM bytes (`bytes / 48`).
  - `endMs`: `startMs + (chunkBytes / 48)`.
  - `text`: Spoken chunk text.
- Generates a valid 24kHz 16-bit mono WAV buffer from the accumulated PCM bytes.
- Returns `{ wavBuffer, chunkTimings, totalPCMBytes }`.

**Verify**: `bun test test/studio/studio-store.test.ts` → all pass.

### Step 3: Implement `StudioStore` in `src/studio/studio-store.ts`

Implement `StudioStore`:
- Holds instances of `AudioLibrary` and `PlaybackEngine`.
- Subscribes to `PlaybackEngine` events (`timeupdate`, `status`, `track:end`).
- In `timeupdate` handler, computes `activeChunkIndex`:
  Finds the chunk in `selectedTrack.metadata` whose `startMs <= positionMs <= endMs`.
- Exposes `getState(): StudioState` and `subscribe(listener: (state: StudioState) => void): () => void`.
- Dispatches all `StudioAction` methods.
- Supports `handleLiveTurn(input: TurnInput)`:
  1. Sets `live.isStreaming = true`.
  2. Runs `NarrationRecorder` while concurrently piping to `PlaybackEngine` if speaker mode is enabled.
  3. Saves the completed turn into `AudioLibrary.saveTrack(...)`.
  4. Reloads tracks list and marks `live.isStreaming = false`.

**Verify**: `bun test test/studio/studio-store.test.ts` → all pass.

### Step 4: Update `src/cli/agy-watch.ts` to use `StudioStore`

Refactor `src/cli/agy-watch.ts`:
- Instantiate `AudioLibrary`, `PlaybackEngine`, and `StudioStore`.
- On detecting `/listen` or `/listen auto`, dispatch to `studioStore.handleLiveTurn(...)`.
- The turn is automatically saved to the persistent catalog.

**Verify**: `bun run build && bun run verify` → exit 0, all tests pass.

## Test plan

- `test/studio/studio-store.test.ts`:
  - `NarrationRecorder` records PCM bytes and accurately assigns `ChunkTiming` intervals based on byte counts.
  - `StudioStore` initializes with library tracks and emits state updates to subscribers.
  - Selecting a track updates `selectedTrack` and loads it into `PlaybackEngine`.
  - Seeking and scrubbing update `playback.positionMs` and map to the correct `activeChunkIndex`.
  - `deleteTrack` removes track from library and updates store state.

## Done criteria

- [ ] `bunx tsc -p tsconfig.json --noEmit` exits 0.
- [ ] `bun test test/studio/studio-store.test.ts` exits 0.
- [ ] `bun run verify` exits 0.
- [ ] `plans/README.md` status row updated to DONE.

## STOP conditions

- If concurrent live turns from multiple sessions arrive simultaneously, ensure `StudioStore` queues them sequentially and does not corrupt the active `NarrationRecorder` buffer.
- If chunk timing calculations drift by more than 200ms from actual audio length, verify sample rate alignment (`48 bytes/ms`) before proceeding.

## Maintenance notes

- Future considerations: Expose a WebSocket or IPC interface on `StudioStore` so the sidecar Web UI and the terminal TUI can connect to the same shared store instance simultaneously.
