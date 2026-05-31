import test from 'node:test';
import assert from 'node:assert/strict';

import { runStartupSequence } from '../src/main/startup-sequence.ts';

test('shows the main window without waiting for tracker rules to finish loading', async () => {
  const calls: string[] = [];
  let resolveBlocker: (() => void) | undefined;

  const blockerReady = new Promise<void>((resolve) => {
    resolveBlocker = resolve;
  });

  await runStartupSequence({
    startBlocker: () => {
      calls.push('blocker:start');
      return blockerReady;
    },
    createMainWindow: async () => {
      calls.push('window:create');
    },
    installMenu: () => {
      calls.push('menu:install');
    },
    onBlockerError: () => {
      calls.push('blocker:error');
    },
  });

  assert.deepEqual(calls, ['blocker:start', 'window:create', 'menu:install']);
  resolveBlocker?.();
});

test('reports blocker startup errors after the window is created', async () => {
  const calls: string[] = [];
  const blockerFailure = new Error('rules unavailable');

  await runStartupSequence({
    startBlocker: async () => {
      calls.push('blocker:start');
      throw blockerFailure;
    },
    createMainWindow: async () => {
      calls.push('window:create');
    },
    installMenu: () => {
      calls.push('menu:install');
    },
    onBlockerError: (error) => {
      assert.equal(error, blockerFailure);
      calls.push('blocker:error');
    },
  });

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls[0], 'blocker:start');
  assert.ok(calls.indexOf('window:create') < calls.indexOf('blocker:error'));
  assert.ok(calls.includes('menu:install'));
});
