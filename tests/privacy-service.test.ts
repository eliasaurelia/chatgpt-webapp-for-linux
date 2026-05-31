import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SITE_DATA_STORAGES,
  createPrivacyService,
} from '../src/main/privacy-service.ts';

test('clears HTTP cache without touching credentials directly', async () => {
  const calls: string[] = [];
  const service = createPrivacyService({
    clearCache: async () => calls.push('clearCache'),
    clearStorageData: async () => calls.push('clearStorageData'),
  });

  await service.clearCache();

  assert.deepEqual(calls, ['clearCache']);
});

test('clears all isolated session site data for logout/reset', async () => {
  const calls: unknown[] = [];
  const service = createPrivacyService({
    clearCache: async () => calls.push('clearCache'),
    clearStorageData: async (options: unknown) => calls.push(options),
  });

  await service.clearSiteData();

  assert.deepEqual(calls, [{ storages: SITE_DATA_STORAGES }]);
});
