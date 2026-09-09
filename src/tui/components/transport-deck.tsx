import type { StudioLiveState, StudioPlaybackState } from '../../studio/types.js';
import type { TrackMetadata } from '../../storage/types.js';

export interface TransportDeckProps {
  playback: StudioPlaybackState;
  track: TrackMetadata | null;
  live?: StudioLiveState;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function TransportDeck({ playback, track, live }: TransportDeckProps) {
  const isSynthesizing = Boolean(live?.isStreaming);
  const posStr = formatTime(playback.positionMs);
  const durStr = formatTime(playback.durationMs);

  const totalSlots = 40;
  let ratio = 0;
  if (isSynthesizing && (live?.totalChunks ?? 0) > 0) {
    ratio = Math.min(1, Math.max(0, (live?.completedChunks ?? 0) / (live?.totalChunks ?? 1)));
  } else if (playback.durationMs > 0) {
    ratio = Math.min(1, Math.max(0, playback.positionMs / playback.durationMs));
  }

  const filledCount = Math.round(ratio * totalSlots);
  const emptyCount = Math.max(0, totalSlots - filledCount);
  const bar = '━'.repeat(filledCount) + '●' + '─'.repeat(emptyCount);
  const pctStr = `${Math.round(ratio * 100)}%`;

  let statusIcon = '■';
  if (isSynthesizing) statusIcon = '~';
  else if (playback.status === 'playing') statusIcon = '▶';
  else if (playback.status === 'paused') statusIcon = '⏸';

  return (
    <box
      flexDirection="column"
      height={6}
      borderStyle="single"
      borderColor={isSynthesizing ? '#f59e0b' : '#10b981'}
      title={isSynthesizing ? 'Synthesizing Audio via Gemini TTS...' : 'Now Playing & Controls'}
      titleColor={isSynthesizing ? '#f59e0b' : '#10b981'}
      paddingLeft={1}
      paddingRight={1}
      justifyContent="space-between"
    >
      {/* Track & Voice row */}
      <box flexDirection="row" justifyContent="space-between">
        <box flexDirection="row" gap={1}>
          <text fg={isSynthesizing ? '#f59e0b' : '#10b981'}>{statusIcon}</text>
          <text fg="#f8fafc">
            <b>
              {isSynthesizing
                ? `Generating Audio (${live?.completedChunks ?? 0}/${live?.totalChunks ?? 1} chunks)`
                : track
                ? track.title
                : 'No track loaded'}
            </b>
          </text>
          {track && !isSynthesizing && <text fg="#64748b">({track.slug})</text>}
        </box>
        <box flexDirection="row" gap={2}>
          {track && <text fg="#94a3b8">Voice: {track.voice}</text>}
          <text fg="#38bdf8">{playback.rate.toFixed(2)}x Speed</text>
        </box>
      </box>

      {/* Progress Timeline Scrubber */}
      <box flexDirection="row" alignItems="center" gap={1}>
        <text fg="#94a3b8">{isSynthesizing ? 'GEN' : posStr}</text>
        <text fg={isSynthesizing ? '#f59e0b' : '#10b981'}>{bar}</text>
        <text fg="#94a3b8">
          {isSynthesizing ? `${live?.completedChunks ?? 0}/${live?.totalChunks ?? 1}` : durStr}
        </text>
        <text fg="#64748b">({pctStr})</text>
      </box>

      {/* Shortcut Legend */}
      <box flexDirection="row" gap={2}>
        <text fg="#cbd5e1">
          <b>[Space]</b> Play/Pause
        </text>
        <text fg="#cbd5e1">
          <b>[←/→]</b> ±5s
        </text>
        <text fg="#cbd5e1">
          <b>[H/L]</b> ±30s
        </text>
        <text fg="#cbd5e1">
          <b>[&lt;/&gt;]</b> Rate
        </text>
        <text fg="#cbd5e1">
          <b>[Tab]</b> Focus
        </text>
        <text fg="#cbd5e1">
          <b>[/]</b> Search
        </text>
        <text fg="#ef4444">
          <b>[q]</b> Quit
        </text>
      </box>
    </box>
  );
}
