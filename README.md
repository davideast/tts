# tts-flash

Convert Markdown documents of any length into a single, clean WAV audio file using Gemini TTS without memory spikes or chunk-boundary truncation.

---

## Usage

### Convert a Markdown file to audio

```bash
tts-flash -i document.md -o output.wav
```

### Direct voice style and delivery

```bash
tts-flash -i article.md -v Fenrir -s "Read in an energetic, engaging tone suitable for a tech podcast."
```

### Use programmatically in TypeScript

```typescript
import { GoogleGenAI } from '@google/genai';
import { NodeFileReader, prepareDocumentChunks } from './src/chunker/index.js';
import { DocumentAudioPipeline, UniversalEventBus } from './src/pipeline/index.js';
import { GeminiTTSProvider } from './src/tts/index.js';
import { WavFileStreamSink } from './src/audio/index.js';

const fileReader = new NodeFileReader();
const chunks = await prepareDocumentChunks(fileReader, 'document.md', 400);

const eventBus = new UniversalEventBus();
const sink = new WavFileStreamSink('output.wav');
sink.attachToEventBus(eventBus);

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const provider = new GeminiTTSProvider(client);
const pipeline = new DocumentAudioPipeline(provider, eventBus);

await pipeline.processDocument(chunks, 'Kore', 'Read in a calm, clear cadence.');
```

---

## Reference

### CLI Options

| Flag | Short | Default | Description |
| :--- | :--- | :--- | :--- |
| `--input` | `-i` | *(required)* | Path to the source `.md` file |
| `--output` | `-o` | `output.wav` | Destination path for the audio file |
| `--voice` | `-v` | `Kore` | Voice name (e.g. `Kore`, `Puck`, `Fenrir`, `Charon`, `Zephyr`) |
| `--style` | `-s` | `undefined` | Prompt prepended to each chunk directing tone, pacing, or character |
| `--maxChars`| `-c` | `400` | Target character threshold for sentence-boundary chunk splits |
| `--model` | `-m` | `gemini-3.1-flash-tts-preview` | Gemini model endpoint |
| `--apiKey` | `-k` | `$GEMINI_API_KEY` | Gemini API key override |
| `--maxRetries` | | `3` | Maximum retry attempts for transient (429/5xx) API errors |
| `--verbose` | | `false` | Log byte transfer sizes for each streaming audio delta |

### Configuration File (`.tts.json`)

If `.tts.json` exists in the working directory, options are loaded automatically. Configuration values are resolved in order of precedence:

1. CLI flags
2. `.tts.json` file values
3. Environment variables (`GEMINI_API_KEY`)
4. Built-in defaults

```json
{
  "voice": "Fenrir",
  "style": "Speak clearly with an authoritative, calm cadence.",
  "model": "gemini-3.1-flash-tts-preview",
  "maxChars": 400,
  "maxRetries": 3
}
```

### Available Voices

Gemini TTS supports 30 prebuilt voices:

`Achernar`, `Achird`, `Algenib`, `Algieba`, `Alnilam`, `Aoede`, `Autonoe`, `Callirrhoe`, `Charon`, `Despina`, `Enceladus`, `Erinome`, `Fenrir`, `Gacrux`, `Iapetus`, `Kore`, `Laomedeia`, `Leda`, `Orus`, `Puck`, `Pulcherrima`, `Rasalgethi`, `Sadachbia`, `Sadaltager`, `Schedar`, `Sulafat`, `Umbriel`, `Vindemiatrix`, `Zephyr`, `Zubenelgenubi`.

### Audio Specifications

- **Format:** Linear PCM in a standard RIFF/WAV container
- **Sample Rate:** 24,000 Hz (24 kHz)
- **Channels:** 1 (Mono)
- **Bit Depth:** 16-bit signed integer, Little-Endian
- **Memory Footprint:** $O(1)$ disk streaming — audio chunks are written to disk as received, and the 44-byte RIFF header is updated in-place on completion.

### Setup & Installation

#### Prerequisites

- Node.js 18+ or Bun 1.0+
- A Gemini API Key ([Google AI Studio](https://aistudio.google.com/))

#### Install dependencies

```bash
bun install
# or: npm install
```

#### Set API key

```bash
export GEMINI_API_KEY="your-api-key-here"
```

#### Run locally

```bash
bun run src/index.ts -i document.md -o output.wav
```

#### Run verification test suite

```bash
bun run verify
```

### Known Limitations

- **Preview Endpoint:** `gemini-3.1-flash-tts-preview` is a preview model and subject to Gemini API rate limits.
- **Audio Encoding:** Output is written as uncompressed 24 kHz mono `.wav`. For MP3 or AAC compression, convert the resulting `.wav` using `ffmpeg` (`ffmpeg -i output.wav output.mp3`).
