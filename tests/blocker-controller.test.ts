import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GHOSTERY_NETWORK_ONLY_CONFIG,
  allowCoreOpenAiResources,
  createBlockerController,
} from '../src/main/blocker-controller.ts';

test('uses a network-only Ghostery configuration for ChatGPT compatibility', () => {
  assert.equal(GHOSTERY_NETWORK_ONLY_CONFIG.loadNetworkFilters, true);
  assert.equal(GHOSTERY_NETWORK_ONLY_CONFIG.loadCSPFilters, true);
  assert.equal(GHOSTERY_NETWORK_ONLY_CONFIG.loadCosmeticFilters, false);
  assert.equal(GHOSTERY_NETWORK_ONLY_CONFIG.loadGenericCosmeticsFilters, false);
  assert.equal(GHOSTERY_NETWORK_ONLY_CONFIG.enableMutationObserver, false);
});

test('enables the Ghostery-backed blocker once for the isolated session', async () => {
  const calls: string[] = [];
  const session = { id: 'persist:chatgpt-private' };
  const controller = createBlockerController({
    session,
    loadEngine: async () => ({
      enableBlockingInSession: (target: unknown) => calls.push(`enable:${target === session}`),
      disableBlockingInSession: (target: unknown) => calls.push(`disable:${target === session}`),
    }),
    initialEnabled: true,
  });

  await controller.start();
  await controller.start();

  assert.deepEqual(calls, ['enable:true']);
  assert.deepEqual(controller.getStatus(), { enabled: true, ready: true, blockedCount: 0 });
});

test('disables blocker integration without clearing session data', async () => {
  const calls: string[] = [];
  const controller = createBlockerController({
    session: {},
    loadEngine: async () => ({
      enableBlockingInSession: () => calls.push('enable'),
      disableBlockingInSession: () => calls.push('disable'),
    }),
    initialEnabled: false,
  });

  await controller.start();
  await controller.setEnabled(true);
  await controller.setEnabled(false);

  assert.deepEqual(calls, ['enable', 'disable']);
  assert.deepEqual(controller.getStatus(), { enabled: false, ready: true, blockedCount: 0 });
});

test('bypasses OpenAI core resources before applying tracker rules', () => {
  const calls: string[] = [];
  const engine = allowCoreOpenAiResources({
    enableBlockingInSession: () => undefined,
    disableBlockingInSession: () => undefined,
    onBeforeRequest: (_details: { url?: string }, callback: (response: Record<string, unknown>) => void) => {
      calls.push('blocked');
      callback({ cancel: true });
    },
    onHeadersReceived: (_details: { url?: string }, callback: (response: Record<string, unknown>) => void) => {
      calls.push('csp');
      callback({ responseHeaders: { test: ['value'] } });
    },
  });

  const responses: Record<string, unknown>[] = [];
  engine.onBeforeRequest?.({ url: 'https://persistent.oaistatic.com/asset.js' }, (response) => {
    responses.push(response);
  });
  engine.onHeadersReceived?.({ url: 'https://chatgpt.com/backend-api/conversation' }, (response) => {
    responses.push(response);
  });
  engine.onBeforeRequest?.({ url: 'https://analytics.example/collect' }, (response) => {
    responses.push(response);
  });

  assert.deepEqual(calls, ['blocked']);
  assert.deepEqual(responses, [{}, {}, { cancel: true }]);
});
