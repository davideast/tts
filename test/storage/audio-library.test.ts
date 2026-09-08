import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AudioLibrary } from '../../src/storage/audio-library.js';

describe('AudioLibrary', () => {
  let tempDir: string;
  let library: AudioLibrary;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `mdmedia_test_lib_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    library = new AudioLibrary(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('initializes directories and catalog.json on creation', () => {
    expect(fs.existsSync(path.join(tempDir, 'tracks'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'catalog.json'))).toBe(true);
  });

  it('saves a complete track bundle with audio, transcript, and metadata', async () => {
    // 44-byte dummy WAV header + 4800 bytes PCM (100ms duration at 48 bytes/ms)
    const dummyAudio = new Uint8Array(44 + 4800);

    const track = await library.saveTrack({
      sessionId: 'ac52ca05-0fde-4734-a358-0b39f77b9c97',
      stepIndex: 12,
      markdown: '# Refactoring Auth Middleware\n\nHere are the implementation details.',
      audioBuffer: dummyAudio,
      voice: 'Puck',
      style: 'Clear cadence',
      chunkTimings: [
        { chunkIndex: 0, startMs: 0, endMs: 100, text: 'Here are the implementation details.' },
      ],
    });

    expect(track.id).toBe('ac52ca05_s12');
    expect(track.title).toBe('Refactoring Auth Middleware');
    expect(track.slug).toBe('refactoring-auth-middleware');
    expect(track.durationMs).toBe(100);
    expect(track.chunkCount).toBe(1);

    expect(fs.existsSync(track.audioPath)).toBe(true);
    expect(fs.existsSync(track.transcriptPath)).toBe(true);
    expect(fs.existsSync(track.metadataPath)).toBe(true);

    const savedTranscript = fs.readFileSync(track.transcriptPath, 'utf8');
    expect(savedTranscript).toContain('# Refactoring Auth Middleware');
  });

  it('filters tracks by sessionId and search query', async () => {
    const dummyAudio = new Uint8Array(44 + 480);

    await library.saveTrack({
      sessionId: 'session-alpha',
      stepIndex: 1,
      markdown: '# First Alpha Feature\n\nAlpha details.',
      audioBuffer: dummyAudio,
      voice: 'Puck',
    });

    await library.saveTrack({
      sessionId: 'session-beta',
      stepIndex: 2,
      markdown: '# Second Beta Migration\n\nBeta details.',
      audioBuffer: dummyAudio,
      voice: 'Kore',
    });

    const allTracks = library.listTracks();
    expect(allTracks.length).toBe(2);

    const alphaTracks = library.listTracks({ sessionId: 'session-alpha' });
    expect(alphaTracks.length).toBe(1);
    expect(alphaTracks[0].title).toBe('First Alpha Feature');

    const queryTracks = library.listTracks({ query: 'migration' });
    expect(queryTracks.length).toBe(1);
    expect(queryTracks[0].title).toBe('Second Beta Migration');

    const bodyQueryTracks = library.listTracks({ query: 'alpha details' });
    expect(bodyQueryTracks.length).toBe(1);
    expect(bodyQueryTracks[0].title).toBe('First Alpha Feature');
  });

  it('retrieves track by ID and deletes track cleanly', async () => {
    const dummyAudio = new Uint8Array(44 + 480);

    const track = await library.saveTrack({
      sessionId: 'session-delete-me',
      stepIndex: 1,
      markdown: '# Temporary Feature\n\nTo be deleted.',
      audioBuffer: dummyAudio,
      voice: 'Fenrir',
    });

    expect(library.getTrack(track.id)).not.toBeNull();

    const deleted = await library.deleteTrack(track.id);
    expect(deleted).toBe(true);
    expect(library.getTrack(track.id)).toBeNull();
    expect(library.listTracks().length).toBe(0);
    expect(fs.existsSync(track.audioPath)).toBe(false);
  });

  it('persists catalog across restarts', async () => {
    const dummyAudio = new Uint8Array(44 + 480);

    await library.saveTrack({
      sessionId: 'session-persistent',
      stepIndex: 5,
      markdown: '# Persistent Track\n\nStored safely.',
      audioBuffer: dummyAudio,
      voice: 'Zephyr',
    });

    // Create fresh instance pointing to same directory
    const newLibraryInstance = new AudioLibrary(tempDir);
    const tracks = newLibraryInstance.listTracks();

    expect(tracks.length).toBe(1);
    expect(tracks[0].title).toBe('Persistent Track');
  });
});
