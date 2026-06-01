import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('builds the privacy preload as CommonJS for Electron preload loading', async () => {
  const buildScript = await readFile('scripts/build.mjs', 'utf8');

  assert.match(buildScript, /--format=cjs/);
  assert.match(buildScript, /settings-preload\.cjs/);
});

test('loads the CommonJS privacy preload bundle from the settings window', async () => {
  const mainSource = await readFile('src/main/main.ts', 'utf8');

  assert.match(mainSource, /settings-preload\.cjs/);
});
