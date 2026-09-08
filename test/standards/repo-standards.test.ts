import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

function getAllSourceFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllSourceFiles(fullPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Mechanical Repository Standards & Architecture Checks', () => {
  const srcDir = path.resolve(import.meta.dir, '../../src');
  const tuiDir = path.resolve(srcDir, 'tui');

  test('Standard 1: Zero occurrences of internal codenames in src/', () => {
    const forbiddenCodename = ['jet', 'ski'].join('');
    const sourceFiles = getAllSourceFiles(srcDir);
    expect(sourceFiles.length).toBeGreaterThan(0);

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content.toLowerCase()).not.toContain(forbiddenCodename);
    }
  });

  test('Standard 2: Headless TUI layer separation (no node:fs imports or sync file I/O in src/tui/)', () => {
    const tuiFiles = getAllSourceFiles(tuiDir);
    expect(tuiFiles.length).toBeGreaterThan(0);

    for (const file of tuiFiles) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(/from\s+['"](node:)?fs(\/promises)?['"]/);
      expect(content).not.toContain('readFileSync');
      expect(content).not.toContain('existsSync');
    }
  });

  test('Standard 3: Single source of truth for getBrainDir and getGeminiApiKey in src/', () => {
    const sourceFiles = getAllSourceFiles(srcDir);
    const brainDirDeclarations: string[] = [];
    const geminiKeyDeclarations: string[] = [];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (/function\s+getBrainDir\s*\(/.test(content)) {
        brainDirDeclarations.push(path.relative(srcDir, file));
      }
      if (/function\s+getGeminiApiKey\s*\(/.test(content)) {
        geminiKeyDeclarations.push(path.relative(srcDir, file));
      }
    }

    expect(brainDirDeclarations).toEqual(['studio/antigravity-watcher.ts']);
    expect(geminiKeyDeclarations).toEqual(['studio/antigravity-watcher.ts']);
  });

  test('Standard 4: TUI app lifecycle registers uncaughtException, SIGINT, SIGTERM, and exit handlers', () => {
    const appFile = path.resolve(tuiDir, 'app.tsx');
    const content = fs.readFileSync(appFile, 'utf8');

    expect(content).toContain("process.on('exit'");
    expect(content).toContain("process.on('SIGINT'");
    expect(content).toContain("process.on('SIGTERM'");
    expect(content).toContain("process.on('uncaughtException'");
  });
});
