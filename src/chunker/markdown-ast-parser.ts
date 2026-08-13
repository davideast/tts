import { lexer, type Token, type Tokens } from 'marked';
import { sanitizeTextForSpeech } from './url-sanitizer.js';

function ensureSentenceEnding(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return '';
  const lastChar = trimmed[trimmed.length - 1];
  if (lastChar === '.' || lastChar === '!' || lastChar === '?' || lastChar === ':' || lastChar === '—') {
    return trimmed;
  }
  return `${trimmed}.`;
}

function extractTextFromTokens(tokens: Token[]): string {
  const parts: string[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'text': {
        const textToken = token as Tokens.Text;
        if (textToken.tokens && textToken.tokens.length > 0) {
          parts.push(extractTextFromTokens(textToken.tokens));
        } else {
          parts.push(textToken.text);
        }
        break;
      }
      case 'strong':
      case 'em':
      case 'del': {
        const parentToken = token as Tokens.Strong | Tokens.Em | Tokens.Del;
        if (parentToken.tokens && parentToken.tokens.length > 0) {
          parts.push(extractTextFromTokens(parentToken.tokens));
        } else if ('text' in parentToken && typeof parentToken.text === 'string') {
          parts.push(parentToken.text);
        }
        break;
      }
      case 'link': {
        const linkToken = token as Tokens.Link;
        let linkText = '';
        if (linkToken.tokens && linkToken.tokens.length > 0) {
          linkText = extractTextFromTokens(linkToken.tokens);
        } else if ('text' in linkToken && typeof linkToken.text === 'string') {
          linkText = linkToken.text;
        }

        // If the anchor text is just the raw URL itself (e.g. [https://...](https://...)), discard it
        if (/^https?:\/\//i.test(linkText.trim())) {
          linkText = '';
        }

        if (linkText) {
          parts.push(linkText);
        }
        break;
      }
      case 'image': {
        // Discard raw markdown image references in spoken speech
        break;
      }
      case 'codespan': {
        const codeToken = token as Tokens.Codespan;
        parts.push(codeToken.text);
        break;
      }
      case 'list': {
        const listToken = token as Tokens.List;
        for (const item of listToken.items) {
          const itemText = extractTextFromTokens(item.tokens);
          if (itemText) parts.push(itemText);
        }
        break;
      }
      default: {
        if ('tokens' in token && Array.isArray((token as any).tokens)) {
          parts.push(extractTextFromTokens((token as any).tokens));
        } else if ('text' in token && typeof token.text === 'string') {
          parts.push(token.text);
        }
        break;
      }
    }
  }

  return parts.join(' ');
}

export function parseMarkdownToSpeakableParagraphs(markdownText: string): string[] {
  const tokens = lexer(markdownText);
  const paragraphs: string[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'paragraph': {
        const pToken = token as Tokens.Paragraph;
        const rawText = sanitizeTextForSpeech(extractTextFromTokens(pToken.tokens));
        const text = ensureSentenceEnding(rawText);
        if (text.length > 0) {
          paragraphs.push(text);
        }
        break;
      }
      case 'heading': {
        const hToken = token as Tokens.Heading;
        const rawText = sanitizeTextForSpeech(extractTextFromTokens(hToken.tokens));
        const text = ensureSentenceEnding(rawText);
        if (text.length > 0) {
          paragraphs.push(text);
        }
        break;
      }
      case 'list': {
        const listToken = token as Tokens.List;
        for (const item of listToken.items) {
          const rawText = sanitizeTextForSpeech(extractTextFromTokens(item.tokens));
          const itemText = ensureSentenceEnding(rawText);
          if (itemText.length > 0) {
            paragraphs.push(itemText);
          }
        }
        break;
      }
      case 'blockquote': {
        const quoteToken = token as Tokens.Blockquote;
        const rawText = sanitizeTextForSpeech(extractTextFromTokens(quoteToken.tokens));
        const quoteText = ensureSentenceEnding(rawText);
        if (quoteText.length > 0) {
          paragraphs.push(quoteText);
        }
        break;
      }
      case 'code': {
        const codeToken = token as Tokens.Code;
        const codeText = sanitizeTextForSpeech(codeToken.text);
        if (codeText.length > 0) {
          paragraphs.push(`Code snippet: ${codeText}.`);
        }
        break;
      }
      default:
        break;
    }
  }

  return paragraphs;
}
