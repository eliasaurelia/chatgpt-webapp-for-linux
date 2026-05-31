import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHATGPT_SESSION_PARTITION,
  createSecureWebPreferences,
} from '../src/main/security-config.ts';

test('uses a persistent private partition for ChatGPT session data', () => {
  assert.equal(CHATGPT_SESSION_PARTITION, 'persist:chatgpt-private');
});

test('keeps remote ChatGPT renderer isolated from Node.js', () => {
  const preferences = createSecureWebPreferences('/tmp/preload.js');

  assert.equal(preferences.partition, CHATGPT_SESSION_PARTITION);
  assert.equal(preferences.nodeIntegration, false);
  assert.equal(preferences.contextIsolation, true);
  assert.equal(preferences.sandbox, true);
  assert.equal(preferences.webSecurity, true);
  assert.equal(preferences.preload, '/tmp/preload.js');
});
