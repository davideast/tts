import type { StoryboardScene } from '../chunker/storyboard-parser.js';
import type {
  GenerateVideoOptions,
  IVideoProvider,
  VideoGenerationResult,
} from '../video/video-provider.interface.js';
import type { UniversalEventBus } from './pipeline-event-bus.js';

export class DocumentVideoPipeline {
  constructor(
    private readonly videoProvider: IVideoProvider,
    private readonly eventBus?: UniversalEventBus
  ) {}

  async processScenes(
    scenes: StoryboardScene[],
    options: GenerateVideoOptions = {}
  ): Promise<VideoGenerationResult[]> {
    const results: VideoGenerationResult[] = [];
    let totalBytes = 0;
    let lastInteractionId: string | undefined = options.previousInteractionId;

    for (const scene of scenes) {
      this.eventBus?.emit('scene:start', { scene });

      try {
        const sceneOptions: GenerateVideoOptions = {
          ...options,
          firstFrame: scene.firstFrame ?? options.firstFrame,
          referenceImages:
            scene.referenceImages.length > 0
              ? scene.referenceImages
              : options.referenceImages,
          previousInteractionId:
            scene.previousInteractionId ?? lastInteractionId,
        };

        const result = await this.videoProvider.generateVideoClip(
          scene.prompt,
          sceneOptions
        );

        results.push(result);
        totalBytes += result.videoBytes.byteLength;
        lastInteractionId = result.interactionId;

        this.eventBus?.emit('scene:complete', {
          sceneIndex: scene.index,
          videoBytes: result.videoBytes,
          interactionId: result.interactionId,
        });
      } catch (error: any) {
        this.eventBus?.emit('pipeline:error', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
        throw error;
      }
    }

    this.eventBus?.emit('video:pipeline:complete', {
      totalScenesProcessed: scenes.length,
      totalBytesGenerated: totalBytes,
    });

    return results;
  }
}
