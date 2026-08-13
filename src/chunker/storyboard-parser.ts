import { lexer, type Token, type Tokens } from 'marked';

export interface StoryboardScene {
  index: number;
  title?: string;
  prompt: string;
  firstFrame?: string;
  referenceImages: string[];
  estimatedDurationSeconds?: number;
  previousInteractionId?: string;
}

export function parseMarkdownToStoryboardScenes(markdownText: string): StoryboardScene[] {
  const tokens = lexer(markdownText);
  const scenes: StoryboardScene[] = [];

  let currentTitle: string | undefined;
  let currentPromptLines: string[] = [];
  let currentFirstFrame: string | undefined;
  let currentRefs: string[] = [];

  function flushScene() {
    const rawPrompt = currentPromptLines.join('\n').trim();
    if (rawPrompt.length === 0 && !currentTitle && !currentFirstFrame) {
      return;
    }

    // Extract any <FIRST_FRAME> file paths
    let prompt = rawPrompt;
    const firstFrameMatch = prompt.match(/<FIRST_FRAME>\s*([^\s\n]+)/i);
    let firstFrame = currentFirstFrame;
    if (firstFrameMatch) {
      firstFrame = firstFrameMatch[1].trim();
      prompt = prompt.replace(firstFrameMatch[0], '').trim();
    }

    // Extract any <IMAGE_REF_N> file paths
    const refs: string[] = [...currentRefs];
    const refMatches = prompt.matchAll(/<IMAGE_REF_\d+>\s*([^\s\n]+)/gi);
    for (const match of refMatches) {
      refs.push(match[1].trim());
      prompt = prompt.replace(match[0], '').trim();
    }

    // Normalize prompt spaces and newlines
    prompt = prompt.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

    if (prompt.length > 0 || firstFrame) {
      scenes.push({
        index: scenes.length,
        title: currentTitle,
        prompt: prompt || (currentTitle ?? 'Scene'),
        firstFrame,
        referenceImages: refs,
      });
    }

    currentTitle = undefined;
    currentPromptLines = [];
    currentFirstFrame = undefined;
    currentRefs = [];
  }

  for (const token of tokens) {
    if (token.type === 'heading' && (token as Tokens.Heading).depth <= 2) {
      // If we already have content, flush the previous scene
      if (currentPromptLines.length > 0 || currentTitle) {
        flushScene();
      }
      currentTitle = (token as Tokens.Heading).text.trim();
    } else if (token.type === 'paragraph') {
      currentPromptLines.push((token as Tokens.Paragraph).text.trim());
    } else if (token.type === 'blockquote') {
      currentPromptLines.push((token as Tokens.Blockquote).text.trim());
    } else if (token.type === 'list') {
      const listToken = token as Tokens.List;
      for (const item of listToken.items) {
        currentPromptLines.push(item.text.trim());
      }
    } else if (token.type === 'code') {
      currentPromptLines.push((token as Tokens.Code).text.trim());
    }
  }

  flushScene();

  // If no headings existed and nothing was parsed, fall back to entire text as single scene
  if (scenes.length === 0 && markdownText.trim().length > 0) {
    scenes.push({
      index: 0,
      prompt: markdownText.trim(),
      referenceImages: [],
    });
  }

  return scenes;
}
