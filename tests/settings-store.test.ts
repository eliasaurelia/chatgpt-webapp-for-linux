import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  defaultSettings,
  readSettings,
  writeSettings,
} from '../src/main/settings-store.ts';

test('uses privacy-preserving defaults when no local settings file exists', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chatgpt-webapp-settings-'));
  try {
    const settings = await readSettings(join(dir, 'settings.json'));

    assert.deepEqual(settings.blocker, { enabled: true });
    assert.deepEqual(settings.window, defaultSettings.window);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('persists only app settings and never serializes account secrets', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chatgpt-webapp-settings-'));
  const path = join(dir, 'settings.json');

  try {
    await writeSettings(path, {
      blocker: { enabled: false },
      window: { width: 1200, height: 820, x: 20, y: 40, maximized: true },
    });

    const raw = await readFile(path, 'utf8');
    assert.match(raw, /"blocker"/);
    assert.doesNotMatch(raw, /password|token|account|email|conversation/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
