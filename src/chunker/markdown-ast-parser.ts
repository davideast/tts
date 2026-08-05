import { lexer, type Token, type Tokens } from 'marked';

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
      case 'del':
      case 'link': {
        const parentToken = token as Tokens.Strong | Tokens.Em | Tokens.Del | Tokens.Link;
        if (parentToken.tokens && parentToken.tokens.length > 0) {
          parts.push(extractTextFromTokens(parentToken.tokens));
        } else if ('text' in parentToken && typeof parentToken.text === 'string') {
          parts.push(parentToken.text);
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
        const text = extractTextFromTokens(pToken.tokens).trim();
        if (text.length > 0) {
          paragraphs.push(text);
        }
        break;
      }
      case 'heading': {
        const hToken = token as Tokens.Heading;
        const text = extractTextFromTokens(hToken.tokens).trim();
        if (text.length > 0) {
          paragraphs.push(`${text}.`);
        }
        break;
      }
      case 'list': {
        const listToken = token as Tokens.List;
        for (const item of listToken.items) {
          const itemText = extractTextFromTokens(item.tokens).trim();
          if (itemText.length > 0) {
            paragraphs.push(itemText);
          }
        }
        break;
      }
      case 'blockquote': {
        const quoteToken = token as Tokens.Blockquote;
        const quoteText = extractTextFromTokens(quoteToken.tokens).trim();
        if (quoteText.length > 0) {
          paragraphs.push(quoteText);
        }
        break;
      }
      case 'code': {
        const codeToken = token as Tokens.Code;
        if (codeToken.text.trim().length > 0) {
          paragraphs.push(`Code snippet: ${codeToken.text.trim()}`);
        }
        break;
      }
      default:
        break;
    }
  }

  return paragraphs;
}
