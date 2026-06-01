import test from 'node:test';
import assert from 'node:assert/strict';

import { createChatExportService } from '../src/main/chat-export-service.ts';
import type { ChatExportPayload } from '../src/shared/chat-export.ts';

const payload: ChatExportPayload = {
  title: 'Service Test',
  sourceUrl: 'https://chatgpt.com/c/service',
  exportedAt: '2026-06-01T12:00:00.000Z',
  messages: [
    {
      role: 'user',
      text: 'Hello',
    },
  ],
};

test('saves a selected chat export file', async () => {
  const writes: Array<{ path: string; content: string }> = [];
  const service = createChatExportService({
    showSaveDialog: async (options) => {
      assert.equal(options.defaultPath?.endsWith('.md'), true);
      assert.equal(options.filters?.[0]?.extensions.includes('md'), true);
      return { canceled: false, filePath: '/tmp/service-test.md' };
    },
    writeFile: async (path, content) => {
      writes.push({ path, content });
    },
    now: () => new Date('2026-06-01T12:00:00.000Z'),
  });

  const result = await service.saveChatExport({ format: 'markdown', payload });

  assert.deepEqual(result, { ok: true, filePath: '/tmp/service-test.md' });
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.path, '/tmp/service-test.md');
  assert.match(writes[0]?.content ?? '', /# Service Test/);
});

test('does not write a file when the save dialog is canceled', async () => {
  let writeCount = 0;
  const service = createChatExportService({
    showSaveDialog: async () => ({ canceled: true }),
    writeFile: async () => {
      writeCount += 1;
    },
    now: () => new Date('2026-06-01T12:00:00.000Z'),
  });

  const result = await service.saveChatExport({ format: 'json', payload });

  assert.deepEqual(result, { ok: false, canceled: true });
  assert.equal(writeCount, 0);
});

test('rejects unsupported export formats before opening a save dialog', async () => {
  let dialogCount = 0;
  const service = createChatExportService({
    showSaveDialog: async () => {
      dialogCount += 1;
      return { canceled: true };
    },
    writeFile: async () => undefined,
    now: () => new Date('2026-06-01T12:00:00.000Z'),
  });

  await assert.rejects(
    () => service.saveChatExport({ format: 'pdf' as never, payload }),
    /Unsupported export format/,
  );
  assert.equal(dialogCount, 0);
});
