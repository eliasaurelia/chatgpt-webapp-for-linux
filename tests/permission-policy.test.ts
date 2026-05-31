import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldGrantPermission } from '../src/main/permission-policy.ts';

test('grants expected browser permissions only to OpenAI-owned surfaces', () => {
  assert.equal(shouldGrantPermission('notifications', 'https://chatgpt.com/'), true);
  assert.equal(shouldGrantPermission('media', 'https://chatgpt.com/'), true);
  assert.equal(shouldGrantPermission('clipboard-sanitized-write', 'https://chatgpt.com/'), true);
  assert.equal(shouldGrantPermission('notifications', 'https://example.com/'), false);
});

test('denies risky permissions and malformed origins', () => {
  assert.equal(shouldGrantPermission('openExternal', 'https://chatgpt.com/'), false);
  assert.equal(shouldGrantPermission('notifications', 'notaurl'), false);
});
