import { lexer, type Token, type Tokens } from 'marked';
import { sanitizeTextForSpeech } from './url-sanitizer.js';

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
      case 'codespan': {
        const codeToken = token as Tokens.Codespan;
        parts.push(codeToken.text);
        break;
      }
      default: {
        if ('text' in token && typeof token.text === 'string') {
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
        const text = sanitizeTextForSpeech(extractTextFromTokens(pToken.tokens));
        if (text.length > 0) {
          paragraphs.push(text);
        }
        break;
      }
      case 'heading': {
        const hToken = token as Tokens.Heading;
        const text = sanitizeTextForSpeech(extractTextFromTokens(hToken.tokens));
        if (text.length > 0) {
          paragraphs.push(`${text}.`);
        }
        break;
      }
      case 'list': {
        const listToken = token as Tokens.List;
        for (const item of listToken.items) {
          const itemText = sanitizeTextForSpeech(extractTextFromTokens(item.tokens));
          if (itemText.length > 0) {
            paragraphs.push(itemText);
          }
        }
        break;
      }
      case 'blockquote': {
        const quoteToken = token as Tokens.Blockquote;
        const quoteText = sanitizeTextForSpeech(extractTextFromTokens(quoteToken.tokens));
        if (quoteText.length > 0) {
          paragraphs.push(quoteText);
        }
        break;
      }
      case 'code': {
        const codeToken = token as Tokens.Code;
        const codeText = sanitizeTextForSpeech(codeToken.text);
        if (codeText.length > 0) {
          paragraphs.push(`Code snippet: ${codeText}`);
        }
        break;
      }
      default:
        break;
    }
  }

  return paragraphs;
}
