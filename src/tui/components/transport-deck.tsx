import type { StudioPlaybackState } from '../../studio/types.js';
import type { TrackMetadata } from '../../storage/types.js';

export interface TransportDeckProps {
  playback: StudioPlaybackState;
  track: TrackMetadata | null;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function TransportDeck({ playback, track }: TransportDeckProps) {
  const posStr = formatTime(playback.positionMs);
  const durStr = formatTime(playback.durationMs);

  const totalSlots = 40;
  const ratio = playback.durationMs > 0
    ? Math.min(1, Math.max(0, playback.positionMs / playback.durationMs))
    : 0;

  const filledCount = Math.round(ratio * totalSlots);
  const emptyCount = Math.max(0, totalSlots - filledCount);
  const bar = '━'.repeat(filledCount) + '●' + '─'.repeat(emptyCount);
  const pctStr = `${Math.round(ratio * 100)}%`;

  let statusIcon = '■';
  if (playback.status === 'playing') statusIcon = '▶';
  if (playback.status === 'paused') statusIcon = '⏸';

  return (
    <box
      flexDirection="column"
      height={6}
      borderStyle="single"
      borderColor="#10b981"
      title="Now Playing & Controls"
      titleColor="#10b981"
      paddingLeft={1}
      paddingRight={1}
      justifyContent="space-between"
    >
      {/* Track & Voice row */}
      <box flexDirection="row" justifyContent="space-between">
        <box flexDirection="row" gap={1}>
          <text fg="#10b981">{statusIcon}</text>
          <text fg="#f8fafc">
            <b>{track ? track.title : 'No track loaded'}</b>
          </text>
          {track && <text fg="#64748b">({track.slug})</text>}
        </box>
        <box flexDirection="row" gap={2}>
          {track && <text fg="#94a3b8">Voice: {track.voice}</text>}
          <text fg="#38bdf8">{playback.rate.toFixed(2)}x Speed</text>
        </box>
      </box>

      {/* Progress Timeline Scrubber */}
      <box flexDirection="row" alignItems="center" gap={1}>
        <text fg="#94a3b8">{posStr}</text>
        <text fg="#10b981">{bar}</text>
        <text fg="#94a3b8">{durStr}</text>
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
