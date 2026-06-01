import test from 'node:test';
import assert from 'node:assert/strict';

import { createPageSearchService } from '../src/main/page-search-service.ts';

test('starts a page search in the active web contents', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const service = createPageSearchService({
    getWebContents: () => ({
      findInPage: (text: string, options: Record<string, unknown>) => {
        calls.push({ text, options });
        return 42;
      },
      stopFindInPage: () => calls.push({ stop: true }),
    }),
  });

  const result = await service.find({ query: 'glmocr', forward: true, findNext: false });

  assert.deepEqual(result, { ok: true, requestId: 42 });
  assert.deepEqual(calls, [
    {
      text: 'glmocr',
      options: {
        forward: true,
        findNext: false,
      },
    },
  ]);
});

test('jumps to next and previous page search matches', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const service = createPageSearchService({
    getWebContents: () => ({
      findInPage: (text: string, options: Record<string, unknown>) => {
        calls.push({ text, options });
        return calls.length;
      },
      stopFindInPage: () => undefined,
    }),
  });

  await service.find({ query: 'export', forward: true, findNext: true });
  await service.find({ query: 'export', forward: false, findNext: true });

  assert.deepEqual(calls.map((call) => call.options), [
    { forward: true, findNext: true },
    { forward: false, findNext: true },
  ]);
});

test('stops page search when the query is blank', async () => {
  const calls: string[] = [];
  const service = createPageSearchService({
    getWebContents: () => ({
      findInPage: () => {
        calls.push('find');
        return 1;
      },
      stopFindInPage: (action: string) => calls.push(`stop:${action}`),
    }),
  });

  const result = await service.find({ query: '   ', forward: true, findNext: false });

  assert.deepEqual(result, { ok: true, requestId: 0 });
  assert.deepEqual(calls, ['stop:clearSelection']);
});

test('keeps selection when page search is closed', async () => {
  const calls: string[] = [];
  const service = createPageSearchService({
    getWebContents: () => ({
      findInPage: () => 1,
      stopFindInPage: (action: string) => calls.push(action),
    }),
  });

  await service.stop({ clearSelection: false });

  assert.deepEqual(calls, ['keepSelection']);
});
