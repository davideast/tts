import { GoogleGenAI } from '@google/genai';
import type { IEnvProvider } from '../types/platform.js';

export class NodeEnvProvider implements IEnvProvider {
  getApiKey(): string | undefined {
    return process.env.GEMINI_API_KEY;
  }
}

export function createGeminiClient(envProvider?: IEnvProvider): GoogleGenAI {
  const apiKey = envProvider ? envProvider.getApiKey() : process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required.');
  }
  return new GoogleGenAI({ apiKey });
}
