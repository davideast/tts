import { AudioLibrary } from '../storage/audio-library.js';
import { PlaybackEngine } from '../audio/player/playback-engine.js';
import { parseMarkdownToSpeakableParagraphs } from '../chunker/markdown-ast-parser.js';
import { chunkSpeakableParagraphs } from '../chunker/word-boundary-chunker.js';
import { UniversalEventBus } from '../pipeline/pipeline-event-bus.js';
import { LiveAudioPlayerSink } from '../audio/live-audio-player-sink.js';
import { ChunkQueueAudioPlayer } from '../audio/player/chunk-queue-audio-player.js';
import { NarrationRecorder } from './narration-recorder.js';
import type { ChunkTiming, TrackMetadata } from '../storage/types.js';
import type { VoiceName } from '../types/voice.js';
import type { ITTSProvider } from '../tts/tts-provider.interface.js';
import type {
  LiveTurnInput,
  StudioAction,
  StudioState,
  StudioStoreOptions,
} from './types.js';

export function computeActiveChunkIndex(
  chunkTimings?: ChunkTiming[],
  positionMs: number = 0
): number {
  if (!chunkTimings || chunkTimings.length === 0) return -1;
  const match = chunkTimings.findIndex(
    (c) => positionMs >= c.startMs && positionMs <= c.endMs
  );
  if (match !== -1) return match;

  if (positionMs < chunkTimings[0].startMs) return 0;

  for (let i = chunkTimings.length - 1; i >= 0; i--) {
    if (positionMs >= chunkTimings[i].startMs) {
      return i;
    }
  }
  return 0;
}

export class StudioStore implements StudioAction {
  private readonly library: AudioLibrary;
  private readonly player: PlaybackEngine;
  private readonly ttsProvider?: ITTSProvider;
  private readonly enableLiveAudio: boolean;
  private readonly defaultVoice: VoiceName;
  private readonly defaultStyle?: string;

  private state: StudioState;
  private readonly listeners = new Set<(state: StudioState) => void>();
  private turnQueue: Promise<any> = Promise.resolve();
  private activeRecorder?: NarrationRecorder;
  private livePlayer?: ChunkQueueAudioPlayer;

  constructor(options: StudioStoreOptions = {}) {
    this.library = options.library ?? new AudioLibrary();
    this.player = options.player ?? new PlaybackEngine();
    this.ttsProvider = options.ttsProvider;
    this.enableLiveAudio = options.enableLiveAudio ?? true;
    this.defaultVoice = options.defaultVoice ?? 'Puck';
    this.defaultStyle = options.defaultStyle;

    const initialTracks = this.library.listTracks();
    const initialSelected = initialTracks[0] ?? null;

    this.state = {
      tracks: initialTracks,
      selectedTrack: initialSelected,
      playback: {
        status: 'idle',
        positionMs: 0,
        durationMs: initialSelected ? initialSelected.durationMs : 0,
        rate: 1.0,
        activeChunkIndex: initialSelected ? 0 : -1,
      },
      queue: [],
      live: {
        isStreaming: false,
        activeSessionId: null,
        currentChunkText: null,
      },
      filterQuery: '',
    };

    if (initialSelected) {
      this.player.load(initialSelected, false).catch(() => {});
    }

    this.bindPlayerEvents();
  }

  public getLibrary(): AudioLibrary {
    return this.library;
  }

  public getPlayer(): PlaybackEngine {
    return this.player;
  }

  public subscribe(listener: (state: StudioState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): StudioState {
    return {
      ...this.state,
      playback: { ...this.state.playback },
      live: { ...this.state.live },
      tracks: [...this.state.tracks],
      queue: [...this.state.queue],
    };
  }

  public async play(trackId?: string): Promise<void> {
    if (trackId) {
      const track = this.library.getTrack(trackId);
      if (track) {
        this.state.selectedTrack = track;
        await this.player.load(track, true);
        return;
      }
    }

    if (this.state.selectedTrack && this.player.currentTrack?.id !== this.state.selectedTrack.id) {
      await this.player.load(this.state.selectedTrack, true);
    } else {
      await this.player.play();
    }
  }

  public pause(): void {
    this.player.pause();
  }

  public togglePause(): void {
    this.player.togglePause();
  }

  public async seek(positionMs: number): Promise<void> {
    await this.player.seek(positionMs);
  }

  public async scrub(deltaMs: number): Promise<void> {
    await this.player.scrub(deltaMs);
  }

  public async setRate(rate: number): Promise<void> {
    await this.player.setRate(rate);
  }

  public async selectTrack(trackId: string): Promise<void> {
    const track = this.library.getTrack(trackId);
    if (!track) return;
    this.state.selectedTrack = track;
    this.state.playback.durationMs = track.durationMs;
    this.state.playback.positionMs = 0;
    this.state.playback.activeChunkIndex = 0;
    await this.player.load(track, false);
    this.emitChange();
  }

  public setFilter(query: string): void {
    this.state.filterQuery = query;
    this.state.tracks = this.library.listTracks({ query });
    this.emitChange();
  }

  public async deleteTrack(trackId: string): Promise<void> {
    if (this.player.currentTrack?.id === trackId) {
      this.player.stop();
    }

    await this.library.deleteTrack(trackId);
    this.state.tracks = this.library.listTracks({ query: this.state.filterQuery });

    if (this.state.selectedTrack?.id === trackId) {
      this.state.selectedTrack = this.state.tracks[0] ?? null;
      if (this.state.selectedTrack) {
        await this.player.load(this.state.selectedTrack, false);
      } else {
        this.player.stop();
      }
    }

    this.emitChange();
  }

  public async next(): Promise<void> {
    await this.player.next();
  }

  public async prev(): Promise<void> {
    await this.player.prev();
  }

  public async handleLiveTurn(input: LiveTurnInput): Promise<TrackMetadata | null> {
    const turnPromise = this.turnQueue.then(() => this.executeLiveTurn(input));
    this.turnQueue = turnPromise.catch(() => {});
    return turnPromise;
  }

  public abortLiveTurn(): void {
    if (this.activeRecorder) {
      this.activeRecorder.abort();
    }
    if (this.livePlayer) {
      this.livePlayer.stop().catch(() => {});
    }
    this.state.live = {
      isStreaming: false,
      activeSessionId: null,
      currentChunkText: null,
    };
    this.emitChange();
  }

  private async executeLiveTurn(input: LiveTurnInput): Promise<TrackMetadata | null> {
    if (!this.ttsProvider) {
      throw new Error('[StudioStore] No TTS provider configured for live turn synthesis.');
    }

    const paragraphs = parseMarkdownToSpeakableParagraphs(input.content);
    const chunks = chunkSpeakableParagraphs(paragraphs, 400);
    if (chunks.length === 0) return null;

    this.state.live = {
      isStreaming: true,
      activeSessionId: input.sessionId,
      currentChunkText: chunks[0]?.text ?? null,
    };
    this.emitChange();

    const eventBus = new UniversalEventBus();
    const recorder = new NarrationRecorder(this.ttsProvider, eventBus);
    this.activeRecorder = recorder;

    let sink: LiveAudioPlayerSink | undefined;
    if (this.enableLiveAudio) {
      this.livePlayer = new ChunkQueueAudioPlayer();
      sink = new LiveAudioPlayerSink(this.livePlayer);
      sink.attachToEventBus(eventBus);
    }

    eventBus.on('chunk:start', ({ chunk }) => {
      this.state.live.currentChunkText = chunk.text;
      this.emitChange();
    });

    try {
      const voice = input.voice || this.defaultVoice;
      const style = input.style ?? this.defaultStyle;

      const recordPromise = recorder.record(chunks, voice, style);
      const result = await recordPromise;

      if (sink) {
        await sink.waitForPlaybackComplete();
      }

      const savedTrack = await this.library.saveTrack({
        sessionId: input.sessionId,
        stepIndex: input.stepIndex,
        markdown: input.content,
        audioBuffer: result.wavBuffer,
        voice,
        style,
        chunkTimings: result.chunkTimings,
      });

      this.state.tracks = this.library.listTracks({ query: this.state.filterQuery });
      if (!this.state.selectedTrack) {
        this.state.selectedTrack = savedTrack;
      }
      return savedTrack;
    } finally {
      if (sink) {
        sink.detach();
      }
      this.activeRecorder = undefined;
      this.livePlayer = undefined;
      this.state.live = {
        isStreaming: false,
        activeSessionId: null,
        currentChunkText: null,
      };
      this.emitChange();
    }
  }

  private bindPlayerEvents(): void {
    this.player.on('status', (status) => {
      this.state.playback.status = status;
      this.emitChange();
    });

    this.player.on('timeupdate', (data) => {
      this.state.playback.positionMs = data.positionMs;
      this.state.playback.durationMs = data.durationMs;
      this.state.playback.rate = data.rate;
      this.state.playback.activeChunkIndex = computeActiveChunkIndex(
        this.state.selectedTrack?.chunkTimings,
        data.positionMs
      );
      this.emitChange();
    });

    this.player.on('track:start', (track) => {
      this.state.selectedTrack = track;
      this.state.playback.durationMs = track.durationMs;
      this.state.playback.positionMs = 0;
      this.state.playback.activeChunkIndex = 0;
      this.state.queue = [...this.player.queue];
      this.emitChange();
    });

    this.player.on('track:end', () => {
      this.state.playback.status = 'stopped';
      this.state.queue = [...this.player.queue];
      this.emitChange();
    });
  }

  private emitChange(): void {
    const currentState = this.getState();
    for (const listener of this.listeners) {
      listener(currentState);
    }
  }
}
