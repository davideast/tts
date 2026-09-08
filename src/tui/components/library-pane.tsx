import type { TrackMetadata } from '../../storage/types.js';

export interface LibraryPaneProps {
  tracks: TrackMetadata[];
  selectedTrack: TrackMetadata | null;
  playingTrackId: string | null;
  filterQuery: string;
  focused: boolean;
  filterActive?: boolean;
}

function formatDuration(ms: number): string {
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function LibraryPane({
  tracks,
  selectedTrack,
  playingTrackId,
  filterQuery,
  focused,
  filterActive = false,
}: LibraryPaneProps) {
  const borderColor = focused ? '#38bdf8' : '#334155';

  return (
    <box
      flexDirection="column"
      width="35%"
      height="100%"
      borderStyle="single"
      borderColor={borderColor}
      title="Library & History [1]"
      titleColor={focused ? '#38bdf8' : '#94a3b8'}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={0}
      paddingBottom={0}
    >
      {/* Search / Filter Indicator */}
      <box height={1} marginBottom={1} flexDirection="row" gap={1}>
        <text fg={filterActive ? '#f59e0b' : '#64748b'}>
          {filterActive ? '🔍 Search:' : '🔍 /:'}
        </text>
        <text fg={filterQuery ? '#38bdf8' : '#475569'}>
          {filterQuery || (filterActive ? 'Type query...' : '(press / to search)')}
        </text>
      </box>

      {/* Track List */}
      {tracks.length === 0 ? (
        <box marginTop={2} justifyContent="center" alignItems="center">
          <text fg="#64748b">No tracks recorded yet.</text>
          <text fg="#475569">Type /listen in an Antigravity chat</text>
        </box>
      ) : (
        <scrollbox scrollY={true} flexGrow={1} flexDirection="column" gap={0}>
          {tracks.map((track) => {
            const isSelected = selectedTrack?.id === track.id;
            const isPlaying = playingTrackId === track.id;

            let prefix = '  ';
            if (isSelected) prefix = '▸ ';
            if (isPlaying) prefix = '♫ ';

            const titleColor = isSelected ? '#38bdf8' : '#cbd5e1';
            const durationStr = formatDuration(track.durationMs);

            return (
              <box
                key={track.id}
                flexDirection="row"
                justifyContent="space-between"
                backgroundColor={isSelected ? '#1e293b' : undefined}
                paddingLeft={0}
                paddingRight={1}
              >
                <box flexDirection="row" flexGrow={1} gap={1}>
                  <text fg={isSelected ? '#38bdf8' : '#64748b'}>{prefix}</text>
                  <text fg={titleColor} truncate={true}>
                    {track.title}
                  </text>
                </box>
                <box flexDirection="row" gap={1}>
                  <text fg="#64748b">[{track.voice}]</text>
                  <text fg="#94a3b8">{durationStr}</text>
                </box>
              </box>
            );
          })}
        </scrollbox>
      )}
    </box>
  );
}
