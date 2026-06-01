import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('builds the privacy preload as CommonJS for Electron preload loading', async () => {
  const buildScript = await readFile('scripts/build.mjs', 'utf8');

  assert.match(buildScript, /--format=cjs/);
  assert.match(buildScript, /settings-preload\.cjs/);
});

test('builds the chat export preload as CommonJS for Electron preload loading', async () => {
  const buildScript = await readFile('scripts/build.mjs', 'utf8');

  assert.match(buildScript, /chat-export-preload\.cjs/);
});

test('loads the CommonJS privacy preload bundle from the settings window', async () => {
  const mainSource = await readFile('src/main/main.ts', 'utf8');

  assert.match(mainSource, /settings-preload\.cjs/);
});

test('loads the CommonJS chat export preload bundle from the ChatGPT window', async () => {
  const mainSource = await readFile('src/main/main.ts', 'utf8');

  assert.match(mainSource, /chat-export-preload\.cjs/);
});

test('extracts markdown from the live ChatGPT DOM instead of a detached clone', async () => {
  const preloadSource = await readFile('src/preload/chat-export-preload.ts', 'utf8');

  assert.match(preloadSource, /markdown:\s*normalizeMarkdown\(childMarkdown\(root\)\)/);
  assert.doesNotMatch(preloadSource, /markdown:\s*normalizeMarkdown\(childMarkdown\(clone\)\)/);
});
