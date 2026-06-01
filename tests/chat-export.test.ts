import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHAT_EXPORT_FORMATS,
  createChatExportFileName,
  formatChatExport,
  type ChatExportPayload,
} from '../src/shared/chat-export.ts';

const sampleExport: ChatExportPayload = {
  title: 'Plan / Demo: <unsafe>',
  sourceUrl: 'https://chatgpt.com/c/example',
  exportedAt: '2026-06-01T12:00:00.000Z',
  messages: [
    {
      role: 'user',
      text: 'Give me a tiny demo.',
      html: '<p>Give me a tiny demo.</p>',
    },
    {
      role: 'assistant',
      text: 'Sure.\n\nconsole.log("hi")',
      html: '<p>Sure.</p><script>alert(1)</script><a href="javascript:alert(1)" onclick="bad()">bad</a>',
    },
  ],
};

test('supports the expected chat export formats', () => {
  assert.deepEqual(CHAT_EXPORT_FORMATS, ['markdown', 'html', 'json', 'txt']);
});

test('formats a conversation as markdown with metadata and role sections', () => {
  const output = formatChatExport(sampleExport, 'markdown');

  assert.match(output, /^# Plan \/ Demo: <unsafe>/);
  assert.match(output, /Source: https:\/\/chatgpt\.com\/c\/example/);
  assert.match(output, /## User/);
  assert.match(output, /Give me a tiny demo\./);
  assert.match(output, /## Assistant/);
  assert.match(output, /console\.log\("hi"\)/);
});

test('formats a conversation as safe standalone html', () => {
  const output = formatChatExport(sampleExport, 'html');

  assert.match(output, /<!doctype html>/);
  assert.match(output, /Plan \/ Demo: &lt;unsafe&gt;/);
  assert.match(output, /<section class="message assistant">/);
  assert.doesNotMatch(output, /<script/i);
  assert.doesNotMatch(output, /onclick=/i);
  assert.doesNotMatch(output, /javascript:/i);
});

test('formats a conversation as structured json', () => {
  const output = formatChatExport(sampleExport, 'json');
  const parsed = JSON.parse(output) as ChatExportPayload & { formatVersion: number };

  assert.equal(parsed.formatVersion, 1);
  assert.equal(parsed.messages.length, 2);
  assert.equal(parsed.messages[1]?.role, 'assistant');
});

test('formats a conversation as plain text', () => {
  const output = formatChatExport(sampleExport, 'txt');

  assert.match(output, /Plan \/ Demo: <unsafe>/);
  assert.match(output, /\[User\]/);
  assert.match(output, /\[Assistant\]/);
});

test('creates safe default filenames for exported chats', () => {
  assert.equal(
    createChatExportFileName('Plan / Demo: <unsafe>', 'markdown', new Date('2026-06-01T12:00:00.000Z')),
    'chatgpt-plan-demo-unsafe-2026-06-01T12-00-00.md',
  );
});
