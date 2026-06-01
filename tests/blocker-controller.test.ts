import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EASYLIST_RULE_LISTS,
  DEFAULT_BLOCKER_LOAD_TIMEOUT_MS,
  GHOSTERY_NETWORK_ONLY_CONFIG,
  allowCoreOpenAiResources,
  createBlockerController,
} from '../src/main/blocker-controller.ts';

test('uses the standard EasyList and EasyPrivacy subscriptions', () => {
  assert.deepEqual(
    EASYLIST_RULE_LISTS.map((list) => list.url),
    [
      'https://easylist.to/easylist/easylist.txt',
      'https://easylist.to/easylist/easyprivacy.txt',
    ],
  );
});

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
  assert.deepEqual(controller.getStatus(), {
    enabled: true,
    ready: true,
    blockedCount: 0,
    updateInProgress: false,
    lastUpdatedAt: undefined,
    lastError: undefined,
    lists: EASYLIST_RULE_LISTS,
  });
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
  assert.equal(controller.getStatus().enabled, false);
  assert.equal(controller.getStatus().ready, true);
  assert.equal(controller.getStatus().blockedCount, 0);
});

test('manually updates rules, swaps the active engine, and records update time', async () => {
  const calls: string[] = [];
  const session = {};
  const firstEngine = {
    enableBlockingInSession: () => calls.push('first:enable'),
    disableBlockingInSession: () => calls.push('first:disable'),
  };
  const secondEngine = {
    enableBlockingInSession: () => calls.push('second:enable'),
    disableBlockingInSession: () => calls.push('second:disable'),
  };
  const controller = createBlockerController({
    session,
    loadEngine: async ({ ignoreCache } = {}) => {
      calls.push(ignoreCache ? 'load:refresh' : 'load:cache');
      return ignoreCache ? secondEngine : firstEngine;
    },
    initialEnabled: true,
    initialLastUpdatedAt: undefined,
    now: () => new Date('2026-06-01T00:00:00.000Z'),
  });

  await controller.start();
  await controller.updateRules();

  assert.deepEqual(calls, ['load:cache', 'first:enable', 'load:refresh', 'first:disable', 'second:enable']);
  assert.equal(controller.getStatus().lastUpdatedAt, '2026-06-01T00:00:00.000Z');
  assert.equal(controller.getStatus().updateInProgress, false);
});

test('reports blocker load failures in status', async () => {
  const controller = createBlockerController({
    session: {},
    loadEngine: async () => {
      throw new Error('network unavailable');
    },
    initialEnabled: true,
  });

  await assert.rejects(() => controller.start(), /network unavailable/);

  assert.equal(controller.getStatus().ready, false);
  assert.equal(controller.getStatus().lastError, 'network unavailable');
});

test('times out stalled startup loads instead of staying in Starting forever', async () => {
  const controller = createBlockerController({
    session: {},
    loadEngine: async () => new Promise(() => undefined),
    initialEnabled: true,
    loadTimeoutMs: 5,
  });
  const result = await Promise.race([
    controller.start().then(
      () => 'resolved',
      (error: unknown) => error,
    ),
    new Promise<'still-pending'>((resolve) => {
      setTimeout(() => resolve('still-pending'), 50);
    }),
  ]);

  assert.notEqual(result, 'still-pending');
  assert.match(result instanceof Error ? result.message : String(result), /timed out/i);
  assert.equal(controller.getStatus().ready, false);
  assert.match(controller.getStatus().lastError ?? '', /timed out/i);
});

test('times out stalled manual updates and clears update-in-progress state', async () => {
  const controller = createBlockerController({
    session: {},
    loadEngine: async ({ ignoreCache } = {}) => {
      if (ignoreCache) {
        return new Promise(() => undefined);
      }
      return {
        enableBlockingInSession: () => undefined,
        disableBlockingInSession: () => undefined,
      };
    },
    initialEnabled: true,
    loadTimeoutMs: 5,
  });

  await controller.start();
  await assert.rejects(() => controller.updateRules(), /timed out/i);

  assert.equal(controller.getStatus().updateInProgress, false);
  assert.match(controller.getStatus().lastError ?? '', /timed out/i);
});

test('uses a bounded default blocker load timeout', () => {
  assert.ok(DEFAULT_BLOCKER_LOAD_TIMEOUT_MS > 0);
  assert.ok(DEFAULT_BLOCKER_LOAD_TIMEOUT_MS <= 15_000);
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
