import { describe, expect, it } from 'bun:test';
import { parseMarkdownToStoryboardScenes } from './storyboard-parser.js';

describe('Storyboard Scene Parser - TDD Unit Tests', () => {
  it('parses a single scene markdown into one StoryboardScene', () => {
    const markdown = `
# Cyberpunk City

A futuristic city with neon lights and flying cars, cyberpunk style.
Continuous unbroken camera movement moving forward through rainy streets.
`;
    const scenes = parseMarkdownToStoryboardScenes(markdown);
    expect(scenes.length).toBe(1);
    expect(scenes[0].index).toBe(0);
    expect(scenes[0].title).toBe('Cyberpunk City');
    expect(scenes[0].prompt).toContain('A futuristic city with neon lights');
  });

  it('splits multi-scene markdown by heading levels (# Scene 1, # Scene 2)', () => {
    const markdown = `
# Scene 1: The Lab
A scientist inspecting a glowing vial under a microscope.

# Scene 2: The Discovery
The vial suddenly illuminates the dark laboratory with green light.
`;
    const scenes = parseMarkdownToStoryboardScenes(markdown);
    expect(scenes.length).toBe(2);
    expect(scenes[0].index).toBe(0);
    expect(scenes[0].title).toBe('Scene 1: The Lab');
    expect(scenes[0].prompt).toContain('A scientist inspecting a glowing vial');

    expect(scenes[1].index).toBe(1);
    expect(scenes[1].title).toBe('Scene 2: The Discovery');
    expect(scenes[1].prompt).toContain('The vial suddenly illuminates');
  });

  it('extracts image references and first frame from markdown image syntax', () => {
    const markdown = `
# Scene 1: Portrait Intro
<FIRST_FRAME> ./assets/starting_frame.png
<IMAGE_REF_0> ./assets/character_sheet.png

A character smiling and turning towards the camera.
`;
    const scenes = parseMarkdownToStoryboardScenes(markdown);
    expect(scenes.length).toBe(1);
    expect(scenes[0].firstFrame).toBe('./assets/starting_frame.png');
    expect(scenes[0].referenceImages).toEqual(['./assets/character_sheet.png']);
    expect(scenes[0].prompt).toContain('A character smiling and turning towards the camera');
    // Ensure tags are cleaned from the text prompt
    expect(scenes[0].prompt).not.toContain('./assets/starting_frame.png');
  });

  it('extracts timecoded scene cues into structured prompts', () => {
    const markdown = `
# Action Sequence
[0-3s] The car speeds down the highway.
[3-6s] It swerves around a sharp corner.
[6-10s] The driver hits the nitro boost.
`;
    const scenes = parseMarkdownToStoryboardScenes(markdown);
    expect(scenes.length).toBe(1);
    expect(scenes[0].prompt).toContain('[0-3s] The car speeds down the highway.');
    expect(scenes[0].prompt).toContain('[3-6s] It swerves around a sharp corner.');
  });
});
