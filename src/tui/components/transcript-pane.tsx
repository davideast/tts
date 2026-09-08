import fs from 'node:fs';
import type { TrackMetadata } from '../../storage/types.js';

export interface TranscriptPaneProps {
  track: TrackMetadata | null;
  activeChunkIndex: number;
  liveStreaming: boolean;
  currentLiveChunkText: string | null;
  focused: boolean;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function TranscriptPane({
  track,
  activeChunkIndex,
  liveStreaming,
  currentLiveChunkText,
  focused,
}: TranscriptPaneProps) {
  const borderColor = focused ? '#38bdf8' : '#334155';

  let rawTranscript = '';
  if (track && (!track.chunkTimings || track.chunkTimings.length === 0)) {
    try {
      if (fs.existsSync(track.transcriptPath)) {
        rawTranscript = fs.readFileSync(track.transcriptPath, 'utf8');
      }
    } catch {}
  }

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      height="100%"
      borderStyle="single"
      borderColor={borderColor}
      title="Transcript [transcript.md] [2]"
      titleColor={focused ? '#38bdf8' : '#94a3b8'}
      paddingLeft={1}
      paddingRight={1}
    >
      {liveStreaming && currentLiveChunkText && (
        <box
          height={3}
          marginBottom={1}
          borderStyle="single"
          borderColor="#10b981"
          backgroundColor="#064e3b"
          paddingLeft={1}
          paddingRight={1}
          justifyContent="center"
        >
          <text fg="#6ee7b7">
            <b>● Live Generating: </b>
            {currentLiveChunkText}
          </text>
        </box>
      )}

      {!track ? (
        <box flexGrow={1} justifyContent="center" alignItems="center">
          <text fg="#64748b">No track selected.</text>
          <text fg="#475569">
            Select a track from the library [Tab] or send /listen in Antigravity.
          </text>
        </box>
      ) : (
        <box flexDirection="column" flexGrow={1}>
          {/* Metadata bar */}
          <box
            height={1}
            marginBottom={1}
            flexDirection="row"
            justifyContent="space-between"
          >
            <text fg="#94a3b8">
              <b>{track.title}</b> ({track.slug})
            </text>
            <text fg="#64748b">
              {track.voice} • {track.charCount} chars • {track.chunkCount} chunks
            </text>
          </box>

          {/* Karaoke sentence chunks */}
          {track.chunkTimings && track.chunkTimings.length > 0 ? (
            <scrollbox scrollY={true} flexGrow={1} flexDirection="column" gap={1}>
              {track.chunkTimings.map((chunk) => {
                const isActive = chunk.chunkIndex === activeChunkIndex;
                const startStr = formatTime(chunk.startMs);
                const endStr = formatTime(chunk.endMs);

                return (
                  <box
                    key={chunk.chunkIndex}
                    flexDirection="row"
                    backgroundColor={isActive ? '#1e3a8a' : undefined}
                    paddingLeft={1}
                    paddingRight={1}
                    gap={1}
                  >
                    <text fg={isActive ? '#38bdf8' : '#64748b'}>
                      [{startStr} - {endStr}]
                    </text>
                    <text
                      fg={isActive ? '#ffffff' : '#cbd5e1'}
                      wrapMode="word"
                    >
                      {chunk.text}
                    </text>
                  </box>
                );
              })}
            </scrollbox>
          ) : (
            <scrollbox scrollY={true} flexGrow={1} flexDirection="column">
              <text fg="#cbd5e1" wrapMode="word">
                {rawTranscript || 'No transcript text available.'}
              </text>
            </scrollbox>
          )}
        </box>
      )}
    </box>
  );
}
