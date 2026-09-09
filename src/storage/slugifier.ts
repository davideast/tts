import { lexer, type Token, type Tokens } from 'marked';

/**
 * Generates a clean, human-readable title and filesystem-safe slug from Markdown content.
 */
export function generateTrackSlug(
  markdown: string,
  fallbackId: string
): { title: string; slug: string } {
  const title = extractTitle(markdown) || `Response ${fallbackId}`;
  const slug = slugify(title) || `response-${fallbackId}`;

  return { title, slug };
}

function extractPlainTextFromTokens(tokens: Token[]): string {
  let result = '';

  for (const token of tokens) {
    switch (token.type) {
      case 'text': {
        const textToken = token as Tokens.Text;
        if (textToken.tokens && textToken.tokens.length > 0) {
          result += extractPlainTextFromTokens(textToken.tokens);
        } else {
          result += textToken.text;
        }
        break;
      }
      case 'strong':
      case 'em':
      case 'del':
      case 'link': {
        const parent = token as Tokens.Strong | Tokens.Em | Tokens.Del | Tokens.Link;
        if (parent.tokens && parent.tokens.length > 0) {
          result += extractPlainTextFromTokens(parent.tokens);
        } else if ('text' in parent && typeof parent.text === 'string') {
          result += parent.text;
        }
        break;
      }
      case 'codespan': {
        const codeToken = token as Tokens.Codespan;
        result += codeToken.text;
        break;
      }
      default: {
        if ('tokens' in token && Array.isArray((token as any).tokens)) {
          result += extractPlainTextFromTokens((token as any).tokens);
        } else if ('text' in token && typeof token.text === 'string') {
          result += token.text;
        }
        break;
      }
    }
  }

  return result.replace(/\s+/g, ' ').trim();
}

function extractPlainTextFromMarkdown(markdownSnippet: string): string {
  const tokens = lexer(markdownSnippet);
  return extractPlainTextFromTokens(tokens);
}

function extractTitle(markdown: string): string | null {
  if (!markdown || !markdown.trim()) return null;

  // 1. Check for explicit title directive: [TITLE: ...]
  const titleTagMatch = markdown.match(/\[TITLE:\s*([^\]]+)\]/i);
  if (titleTagMatch && titleTagMatch[1].trim()) {
    return extractPlainTextFromMarkdown(titleTagMatch[1].trim());
  }

  const tokens = lexer(markdown);

  // 2. Check for markdown headings (# Heading, ## Heading, etc.) via AST
  for (const token of tokens) {
    if (token.type === 'heading') {
      const hToken = token as Tokens.Heading;
      const cleaned = hToken.tokens
        ? extractPlainTextFromTokens(hToken.tokens)
        : extractPlainTextFromMarkdown(hToken.text);
      if (cleaned.length > 0) {
        return cleaned.slice(0, 80);
      }
    }
  }

  // 3. Fallback: first non-empty paragraph or list item sentence up to 60 chars via AST
  for (const token of tokens) {
    if (token.type === 'paragraph' || token.type === 'text') {
      const pToken = token as Tokens.Paragraph | Tokens.Text;
      const cleaned = pToken.tokens
        ? extractPlainTextFromTokens(pToken.tokens)
        : extractPlainTextFromMarkdown(pToken.text);
      if (cleaned.length > 0) {
        const sentenceMatch = cleaned.match(/^([^.!?]+[.!?]?)/);
        const sentence = sentenceMatch ? sentenceMatch[1].trim() : cleaned;
        return sentence.slice(0, 60);
      }
    }
  }

  return null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    // Replace accented characters
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Replace non-alphanumeric chars with hyphens
    .replace(/[^a-z0-9]+/g, '-')
    // Collapse consecutive hyphens
    .replace(/-+/g, '-')
    // Trim leading and trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Clamp to 48 characters
    .slice(0, 48)
    .replace(/-+$/, '');
}
