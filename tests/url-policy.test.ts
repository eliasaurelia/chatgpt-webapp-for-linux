import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyNavigation,
  isCoreOpenAiResource,
  shouldOpenExternally,
} from '../src/shared/url-policy.ts';

test('keeps ChatGPT and OpenAI login navigation inside the app', () => {
  assert.equal(classifyNavigation('https://chatgpt.com/'), 'internal');
  assert.equal(classifyNavigation('https://chat.openai.com/'), 'internal');
  assert.equal(classifyNavigation('https://auth.openai.com/authorize'), 'internal');
  assert.equal(shouldOpenExternally('https://auth.openai.com/authorize'), false);
});

test('opens ordinary external navigation outside the app', () => {
  assert.equal(classifyNavigation('https://example.com/docs'), 'external');
  assert.equal(classifyNavigation('mailto:hello@example.com'), 'external');
  assert.equal(shouldOpenExternally('https://example.com/docs'), true);
});

test('recognizes OpenAI content and CDN resources for blocker allowlisting', () => {
  assert.equal(isCoreOpenAiResource('https://persistent.oaistatic.com/asset.js'), true);
  assert.equal(isCoreOpenAiResource('https://files.oaiusercontent.com/file.png'), true);
  assert.equal(isCoreOpenAiResource('https://analytics.google.com/collect'), false);
});
