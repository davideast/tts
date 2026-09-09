import type { TrackMetadata } from '../../storage/types.js';
import type { TurnItem } from '../../studio/session-catalog.js';

export interface LibraryPaneProps {
  tracks: TrackMetadata[];
  selectedTrack: TrackMetadata | null;
  turns?: TurnItem[];
  selectedTurn?: TurnItem | null;
  audioOnlyFilter?: boolean;
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

function getStatusBadge(
  status: TurnItem['status'],
  isPlaying: boolean
): { symbol: string; color: string } {
  if (isPlaying) {
    return { symbol: '▶', color: '#38bdf8' };
  }
  if (status === 'cached') {
    return { symbol: '●', color: '#10b981' };
  }
  if (status === 'synthesizing') {
    return { symbol: '~', color: '#f59e0b' };
  }
  return { symbol: '·', color: '#475569' };
}

export function LibraryPane({
  tracks,
  selectedTrack,
  turns = [],
  selectedTurn = null,
  audioOnlyFilter = false,
  playingTrackId,
  filterQuery,
  focused,
  filterActive = false,
}: LibraryPaneProps) {
  const borderColor = focused ? '#38bdf8' : '#334155';

  return (
    <box
      flexDirection="column"
      width="36%"
      flexShrink={0}
      flexGrow={0}
      overflow="hidden"
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
      <box height={1} marginBottom={1} flexDirection="row" justifyContent="space-between" width="100%">
        <box flexDirection="row" gap={1}>
          <text fg={filterActive ? '#f59e0b' : '#64748b'}>
            {filterActive ? '[Search]' : '[/]'}
          </text>
          <text fg={filterQuery ? '#38bdf8' : '#475569'}>
            {filterQuery || (filterActive ? 'Type query...' : 'Press / to search')}
          </text>
        </box>
        <text fg={audioOnlyFilter ? '#38bdf8' : '#64748b'}>
          [f] Audio Only: {audioOnlyFilter ? 'ON' : 'OFF'}
        </text>
      </box>

      {/* Turn Cards List (Windowed Virtualization) */}
      {turns.length === 0 && tracks.length === 0 ? (
        <box marginTop={2} justifyContent="center" alignItems="center">
          <text fg="#64748b">No turns or tracks found.</text>
          <text fg="#475569">Type /listen in an Antigravity chat</text>
        </box>
      ) : (
        (() => {
          const selectedIndex = Math.max(
            0,
            turns.findIndex((t) => t.id === selectedTurn?.id)
          );
          // Each card takes 3 rows (2 content rows + 1 bottom spacing)
          const totalTerminalRows = process.stdout.rows || 48;
          const availablePanelRows = Math.max(18, totalTerminalRows - 11);
          const WINDOW_SIZE = Math.max(6, Math.floor(availablePanelRows / 3));
          const halfWindow = Math.floor(WINDOW_SIZE / 2);
          let startIdx = Math.max(0, selectedIndex - halfWindow);
          const endIdx = Math.min(turns.length, startIdx + WINDOW_SIZE);
          if (endIdx - startIdx < WINDOW_SIZE) {
            startIdx = Math.max(0, endIdx - WINDOW_SIZE);
          }
          const visibleTurns = turns.slice(startIdx, endIdx);

          return (
            <box flexDirection="column" flexGrow={1} width="100%">
              <box height={1} marginBottom={1} justifyContent="space-between" flexDirection="row" width="100%">
                <text fg="#64748b">
                  Showing {startIdx + 1}–{endIdx} of {turns.length} turns
                </text>
                <text fg="#475569">[j/k] scroll</text>
              </box>
              <box flexDirection="column" flexGrow={1} width="100%">
                {visibleTurns.map((turn) => {
                  const isSelected = selectedTurn?.id === turn.id;
                  const isPlaying = Boolean(turn.track && playingTrackId === turn.track.id);
                  const cursor = isSelected ? '▸ ' : '  ';
                  const badge = getStatusBadge(turn.status, isPlaying);
                  const titleColor = isSelected ? '#38bdf8' : '#cbd5e1';
                  const durationStr = turn.track
                    ? formatDuration(turn.track.durationMs)
                    : turn.status === 'synthesizing'
                    ? 'LIVE'
                    : '';

                  return (
                    <box
                      key={turn.id}
                      flexDirection="column"
                      width="100%"
                      height={2}
                      overflow="hidden"
                      backgroundColor={isSelected ? '#1e293b' : undefined}
                      paddingLeft={0}
                      paddingRight={1}
                      marginBottom={1}
                    >
                      {/* Line 1: Single text node with 4-char prefix + title (never wraps) */}
                      <box height={1} width="100%" overflow="hidden">
                        <text wrapMode="none">
                          <span fg={isSelected ? '#38bdf8' : '#64748b'}>{cursor}</span>
                          <span fg={badge.color}>{badge.symbol} </span>
                          <span fg={titleColor}>{turn.title.trim()}</span>
                        </text>
                      </box>

                      {/* Line 2: Single text node indented 4 spaces to align under title */}
                      <box
                        height={1}
                        width="100%"
                        overflow="hidden"
                        flexDirection="row"
                        justifyContent="space-between"
                      >
                        <text wrapMode="none" fg="#64748b">
                          {'    '}
                          {turn.sessionId.slice(0, 8)} • step #{turn.stepIndex} • {turn.wordCount} words
                        </text>
                        {durationStr ? (
                          <text
                            wrapMode="none"
                            fg={turn.status === 'synthesizing' ? '#f59e0b' : '#10b981'}
                          >
                            {durationStr}
                          </text>
                        ) : null}
                      </box>
                    </box>
                  );
                })}
              </box>
            </box>
          );
        })()
      )}
    </box>
  );
}

