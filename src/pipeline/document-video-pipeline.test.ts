import { describe, expect, it } from 'bun:test';
import type { StoryboardScene } from '../chunker/storyboard-parser.js';
import { UniversalEventBus } from './pipeline-event-bus.js';
import { DocumentVideoPipeline } from './document-video-pipeline.js';
import type { IVideoProvider, VideoGenerationResult } from '../video/video-provider.interface.js';

class MockVideoProvider implements IVideoProvider {
  public generatedScenes: { prompt: string; options: any }[] = [];

  async generateVideoClip(prompt: string, options: any = {}): Promise<VideoGenerationResult> {
    this.generatedScenes.push({ prompt, options });
    return {
      interactionId: `mock_interaction_${this.generatedScenes.length}`,
      videoBytes: new Uint8Array([1, 2, 3, 4]),
    };
  }
}

describe('DocumentVideoPipeline - TDD Unit Tests', () => {
  it('processes scenes sequentially and emits lifecycle events on eventBus', async () => {
    const eventBus = new UniversalEventBus();
    const provider = new MockVideoProvider();
    const pipeline = new DocumentVideoPipeline(provider, eventBus);

    const scenes: StoryboardScene[] = [
      {
        index: 0,
        title: 'Scene 1',
        prompt: 'First shot of the character',
        referenceImages: [],
      },
      {
        index: 1,
        title: 'Scene 2',
        prompt: 'Second shot of the landscape',
        referenceImages: ['tree.png'],
      },
    ];

    const startedScenes: number[] = [];
    const completedScenes: number[] = [];
    let isPipelineComplete = false;

    eventBus.on('scene:start', ({ scene }) => {
      startedScenes.push(scene.index);
    });

    eventBus.on('scene:complete', ({ sceneIndex }) => {
      completedScenes.push(sceneIndex);
    });

    eventBus.on('video:pipeline:complete', () => {
      isPipelineComplete = true;
    });

    const results = await pipeline.processScenes(scenes, {
      aspectRatio: '16:9',
      task: 'text_to_video',
    });

    expect(results.length).toBe(2);
    expect(startedScenes).toEqual([0, 1]);
    expect(completedScenes).toEqual([0, 1]);
    expect(isPipelineComplete).toBe(true);
    expect(provider.generatedScenes.length).toBe(2);
    expect(provider.generatedScenes[0].options.aspectRatio).toBe('16:9');
  });
});
