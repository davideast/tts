# Plan 001: Implement persistent `AudioLibrary`, content-based slug generator, and transcript storage

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f5f7704..HEAD -- src/index.ts package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `f5f7704`, 2026-09-08

## Why this matters

Currently, `mdmedia` either outputs audio to a single ephemeral output path or overwrites a single file (`latest_narration.wav`) in the sidecar data directory. All Markdown transcripts, chunk timecode alignments, and historical turns are discarded once spoken. This plan builds the persistent media library foundation: generating human-readable, content-derived directory slugs, writing the tripartite artifact bundle (`audio.wav`, `transcript.md`, `metadata.json`), and maintaining an in-memory cached `catalog.json` index for sub-millisecond query performance.

## Current state

Today, audio files are written through `WavFileStreamSink` in `src/audio/wav-file-stream-sink.ts` to a single fixed destination:

```ts
// src/audio/wav-file-stream-sink.ts:16-24
export class WavFileStreamSink {
  private fileHandle?: FileHandle;
  private totalPCMBytes = 0;
  // ... writes header and appends PCM bytes to single target file ...
```

In `src/sidecar/narrator-server.ts:28`, the path is hardcoded to a single shared file:
```ts
const LATEST_WAV_PATH = path.join(DATA_DIR, 'latest_narration.wav');
```

The repo conventions to follow:
- Pure TypeScript ESM modules (`"type": "module"` in `package.json`).
- Explicit `.js` extension on all relative imports (e.g., `import { createWavHeader } from '../audio/wav-header.js';`).
- Bun test runner (`bun test`).

## Commands you will need

| Purpose | Command | Expected on success |
| :--- | :--- | :--- |
| Build | `bun run build` | exit 0, dist/ emitted |
| Test | `bun test test/storage` | exit 0, all tests pass |
| Typecheck | `bunx tsc -p tsconfig.json --noEmit` | exit 0, no errors |
| Verification | `bun run verify` | exit 0, all checks pass |

## Scope

**In scope**:
- `src/storage/types.ts` (create)
- `src/storage/slugifier.ts` (create)
- `src/storage/audio-library.ts` (create)
- `src/storage/index.ts` (create)
- `src/index.ts` (export storage module)
- `test/storage/slugifier.test.ts` (create)
- `test/storage/audio-library.test.ts` (create)

**Out of scope**:
- Terminal UI rendering (`@opentui/react`).
- Playback controls (`afplay` child process management).
- Modifying `GeminiTTSProvider`.

## Git workflow

- Branch: `feat/001-media-storage-engine`
- Commit per step; message style: `feat(storage): <description>`

## Steps

### Step 1: Define storage domain types in `src/storage/types.ts`

Create `src/storage/types.ts` defining:
- `TrackMetadata`: `id`, `sessionId`, `stepIndex`, `title`, `slug`, `voice`, `style`, `durationMs`, `charCount`, `chunkCount`, `createdAt`, `audioPath`, `transcriptPath`, `metadataPath`.
- `ChunkTiming`: `chunkIndex`, `startMs`, `endMs`, `text`.
- `CatalogIndex`: `version: 1`, `updatedAt`, `tracks: TrackMetadata[]`.
- `SaveTrackInput`: `sessionId`, `stepIndex`, `markdown`, `audioBuffer: Uint8Array`, `voice: VoiceName`, `style?: string`, `chunkTimings?: ChunkTiming[]`.

**Verify**: `bunx tsc -p tsconfig.json --noEmit` → exit 0

### Step 2: Implement content-based slug & title generator in `src/storage/slugifier.ts`

Implement `generateTrackSlug(markdown: string, fallbackId: string): { title: string; slug: string }`:
1. Check for explicit title directive in markdown (e.g. `[TITLE: <title>]` or `# Heading`).
2. If no heading, extract the first non-empty sentence up to 60 characters.
3. Clean all markdown formatting (links, bold, code ticks, HTML tags).
4. Slugs must convert non-alphanumerics to single hyphens, lowercase, and be truncated to at most 48 characters with no leading/trailing hyphens.
5. If result is empty, fall back to `response-${fallbackId}`.

**Verify**: Create and run `test/storage/slugifier.test.ts` via `bun test test/storage/slugifier.test.ts` → all pass.

### Step 3: Implement `AudioLibrary` in `src/storage/audio-library.ts`

Implement `AudioLibrary` class:
- Constructor takes `baseDir?: string` (defaults to `process.env.ANTIGRAVITY_AUDIO_DIR` or `~/.gemini/antigravity/audio_library`).
- `init()`: Ensures directory tree exists: `<baseDir>/tracks/<YYYY-MM-DD>/` and loads `<baseDir>/catalog.json`.
- `saveTrack(input: SaveTrackInput): Promise<TrackMetadata>`:
  - Generates slug via `generateTrackSlug`.
  - Determines folder name: `<date>/${sessionId.slice(0, 8)}_s${stepIndex}_${slug}`.
  - Atomically writes `audio.wav`, `transcript.md`, and `metadata.json`.
  - Appends to `catalog.json` using atomic write (write to temporary file then `fs.renameSync`).
  - Emits event `'track:saved'`.
- `listTracks(filter?: { sessionId?: string; query?: string }): TrackMetadata[]`:
  - Returns tracks from in-memory catalog sorted newest first.
  - Supports query search against title and transcript.
- `getTrack(id: string): TrackMetadata | null`.
- `deleteTrack(id: string): Promise<boolean>`:
  - Removes directory from disk and updates `catalog.json`.

**Verify**: `bun test test/storage/audio-library.test.ts` → all pass.

### Step 4: Export from `src/storage/index.ts` and `src/index.ts`

Export all public storage types and `AudioLibrary` from `src/storage/index.ts` and re-export in `src/index.ts`.

**Verify**: `bun run build && bun run verify` → exit 0, all 30 checks pass.

## Test plan

- `test/storage/slugifier.test.ts`:
  - Extracts `# Heading` as title and slug.
  - Handles markdown without headings by using first sentence.
  - Strips emojis, special punctuation, and long strings.
  - Handles empty markdown with deterministic fallback.
- `test/storage/audio-library.test.ts`:
  - Saves a complete track bundle (`audio.wav`, `transcript.md`, `metadata.json`).
  - Disambiguates duplicate headings across different step indices.
  - Persists and reloads `catalog.json` on restart.
  - Deletes tracks and cleans directory.
  - Filters tracks by search query.

## Done criteria

- [ ] `bunx tsc -p tsconfig.json --noEmit` exits 0.
- [ ] `bun test test/storage/` exits 0 with all tests passing.
- [ ] `bun run verify` exits 0.
- [ ] `git status` shows only in-scope files modified or created.
- [ ] `plans/README.md` status row updated to DONE.

## STOP conditions

- If `catalog.json` atomic file replacement fails on Windows/Mac, stop and implement safe fallback with retry before continuing.
- If `bun run verify` fails due to packaging export issues, stop and verify `package.json` subpath exports before proceeding.

## Maintenance notes

- Future considerations: If library grows to $>10,000$ tracks, `catalog.json` can transition to an embedded SQLite database (`bun:sqlite`), but JSON is optimal for current scales.
