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

function extractTitle(markdown: string): string | null {
  if (!markdown || !markdown.trim()) return null;

  // 1. Check for explicit title directive: [TITLE: ...]
  const titleTagMatch = markdown.match(/\[TITLE:\s*([^\]]+)\]/i);
  if (titleTagMatch && titleTagMatch[1].trim()) {
    return cleanMarkdownText(titleTagMatch[1].trim());
  }

  const lines = markdown.split('\n');

  // 2. Check for markdown headings (# Heading, ## Heading, etc.)
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,6}\s+/.test(trimmed)) {
      const headingText = trimmed.replace(/^#{1,6}\s+/, '').trim();
      const cleaned = cleanMarkdownText(headingText);
      if (cleaned.length > 0) {
        return cleaned.slice(0, 80);
      }
    }
  }

  // 3. Fallback: first non-empty sentence / line up to 60 chars
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines, quotes, horizontal rules, or code fences
    if (
      !trimmed ||
      trimmed.startsWith('```') ||
      trimmed.startsWith('---') ||
      trimmed.startsWith('>')
    ) {
      continue;
    }

    const cleaned = cleanMarkdownText(trimmed);
    if (cleaned.length > 0) {
      // Split on sentence boundaries (. ! ?)
      const sentenceMatch = cleaned.match(/^([^.!?]+[.!?]?)/);
      const sentence = sentenceMatch ? sentenceMatch[1].trim() : cleaned;
      return sentence.slice(0, 60);
    }
  }

  return null;
}

function cleanMarkdownText(text: string): string {
  return text
    // Replace [link text](url) with link text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bold and italic markers
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    // Remove inline code ticks
    .replace(/`([^`]+)`/g, '$1')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Normalize extra spaces
    .replace(/\s+/g, ' ')
    .trim();
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
