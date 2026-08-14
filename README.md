# mdmedia

Transform Markdown documents into rich audio and video media using Gemini's native multimodal generative models (**Gemini Flash 3.1 TTS** and **Gemini Omni Flash**).

---

## Features

- **Audio Narration (`mdmedia audio`)**: Stream Markdown documents of any length into single `.wav` audio files with zero memory spikes and **real-time speaker playback (`-p, --play`)** while synthesis streams.
- **Video Generation (`mdmedia video`)**: Convert Markdown storyboards, timecoded scenes, and reference images into `.mp4` video clips via **Gemini Omni Flash** (`gemini-omni-flash-preview`), supporting aspect ratio control (`16:9` / `9:16`), Files API URI polling, and stateful multi-turn editing.
- **Smart Extension Routing**: Run `mdmedia -i doc.md -o out.wav` or `mdmedia -i storyboard.md -o scene.mp4` and let `mdmedia` automatically detect the right multimodal pipeline.

---

## Usage

### 1. Audio Narration (`mdmedia audio`)

Convert a Markdown file to a clean WAV audio file:

```bash
mdmedia audio -i document.md -o output.wav -v Puck
```

#### Real-time live speaker playback
Listen through your system speakers (`afplay` on macOS / `aplay` on Linux) as each chunk streams:

```bash
mdmedia audio -i article.md -o output.wav -v Puck --play
```

#### Direct voice style and delivery
```bash
mdmedia audio -i article.md -v Fenrir -s "Read in an energetic, engaging tone suitable for a tech podcast."
```

---

### 2. Video Generation (`mdmedia video`)

Convert a Markdown storyboard into an `.mp4` video clip:

```bash
mdmedia video -i storyboard.md -o scene.mp4 --aspect 16:9
```

#### Timecoded & multi-scene storyboards (`storyboard.md` syntax)
You can structure storyboards with scene headers (`# Scene`), timecodes (`[0-3s]`), and image reference tags (`<FIRST_FRAME>`, `<IMAGE_REF_0>`):

```markdown
# Scene 1: Portrait Intro
<FIRST_FRAME> ./assets/starting_frame.png
<IMAGE_REF_0> ./assets/character_sheet.png

[0-3s] A studio fashion sequence. Starting with woman <IMAGE_REF_0>, she turns slowly.
[3-6s] Warm golden hour lighting illuminates the room.
```

Generate video with explicit image tags or command-line reference images:
```bash
mdmedia video -i script.md -o action.mp4 --firstFrame start.png --ref character.png
```

#### Stateful Iterative Video Editing
Edit an existing generated video turn-by-turn using its interaction ID:
```bash
mdmedia video -i edit-prompt.md -o edited.mp4 --interactionId v1_abc123
```

---

## Configuration File (`.mdmedia.json`)

If `.mdmedia.json` exists in the working directory, options are loaded automatically. Precedence:
1. CLI flags
2. `.mdmedia.json` file values
3. Environment variables (`GEMINI_API_KEY`)
4. Built-in defaults

```json
{
  "mode": "audio",
  "audio": {
    "voice": "Puck",
    "style": "Speak clearly with an authoritative, calm cadence.",
    "model": "gemini-3.1-flash-tts-preview",
    "play": false
  },
  "video": {
    "model": "gemini-omni-flash-preview",
    "aspectRatio": "16:9",
    "task": "text_to_video",
    "delivery": "uri"
  },
  "maxChars": 400,
  "maxRetries": 3
}
```

---

## CLI Reference

### `mdmedia audio` Options

| Flag | Short | Default | Description |
| :--- | :--- | :--- | :--- |
| `--input` | `-i` | *(required)* | Path to source `.md` file |
| `--output` | `-o` | `output.wav` | Destination path for audio file |
| `--voice` | `-v` | `Kore` | Voice name (`Kore`, `Puck`, `Fenrir`, `Charon`, `Zephyr`, etc.) |
| `--style` | `-s` | `undefined` | Prompt directing tone, pacing, or delivery |
| `--play` | `-p` | `false` | Play audio in real-time through speakers as chunks stream |
| `--maxChars` | `-c` | `400` | Target character threshold for sentence-boundary chunk splits |
| `--model` | `-m` | `gemini-3.1-flash-tts-preview` | Gemini TTS model endpoint |

### `mdmedia video` Options

| Flag | Short | Default | Description |
| :--- | :--- | :--- | :--- |
| `--input` | `-i` | *(required)* | Path to source `.md` storyboard file |
| `--output` | `-o` | `output.mp4` | Destination path for `.mp4` video clip |
| `--aspectRatio` | `-a` | `16:9` | Video aspect ratio (`16:9` or `9:16`) |
| `--task` | `-t` | `text_to_video` | Generation task (`text_to_video`, `image_to_video`, `reference_to_video`, `edit`) |
| `--delivery` | | `uri` | Delivery mode (`uri` for Files API polling or `inline`) |
| `--ref` | `-r` | `undefined` | Comma-separated reference image paths |
| `--firstFrame` | | `undefined` | Path to starting image frame |
| `--interactionId` | | `undefined` | Previous interaction ID for stateful video editing |
| `--model` | `-m` | `gemini-omni-flash-preview` | Gemini Omni Flash model endpoint |

---

## Programmatic TypeScript Usage

### Audio Narration
```typescript
import { GoogleGenAI } from '@google/genai';
import { NodeFileReader, prepareDocumentChunks } from 'mdmedia/chunker';
import { DocumentAudioPipeline, UniversalEventBus } from 'mdmedia/pipeline';
import { GeminiTTSProvider } from 'mdmedia/tts';
import { WavFileStreamSink } from 'mdmedia/audio';

const fileReader = new NodeFileReader();
const chunks = await prepareDocumentChunks(fileReader, 'document.md', 400);

const eventBus = new UniversalEventBus();
const sink = new WavFileStreamSink('output.wav');
sink.attachToEventBus(eventBus);

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const provider = new GeminiTTSProvider(client);
const pipeline = new DocumentAudioPipeline(provider, eventBus);

await pipeline.processDocument(chunks, 'Puck', 'Clear documentary cadence');
```

### Video Generation
```typescript
import { GoogleGenAI } from '@google/genai';
import { NodeFileReader, prepareStoryboardScenes } from 'mdmedia/chunker';
import { DocumentVideoPipeline, UniversalEventBus } from 'mdmedia/pipeline';
import { GeminiOmniVideoProvider, NodeVideoFileWriter } from 'mdmedia/video';

const fileReader = new NodeFileReader();
const scenes = await prepareStoryboardScenes(fileReader, 'storyboard.md');

const eventBus = new UniversalEventBus();
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const videoProvider = new GeminiOmniVideoProvider(client);
const pipeline = new DocumentVideoPipeline(videoProvider, eventBus);

const results = await pipeline.processScenes(scenes, {
  aspectRatio: '16:9',
  task: 'text_to_video',
});

const fileWriter = new NodeVideoFileWriter();
await fileWriter.writeVideoFile('scene.mp4', results[0].videoBytes);
```

---

## Setup & Installation

### Prerequisites
- Node.js 18+ or Bun 1.0+
- A Gemini API Key ([Google AI Studio](https://aistudio.google.com/))

### Global Installation
```bash
npm install -g mdmedia
# or: bun add -g mdmedia
```

### Run verification test suite
```bash
bun run verify
```
