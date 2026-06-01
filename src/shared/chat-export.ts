export const CHAT_EXPORT_FORMATS = ['markdown', 'html', 'json', 'txt'] as const;

export type ChatExportFormat = (typeof CHAT_EXPORT_FORMATS)[number];

export type ChatExportRole = 'user' | 'assistant' | 'system' | 'unknown';

export interface ChatExportMessage {
  role: ChatExportRole;
  text: string;
  markdown?: string;
  html?: string;
}

export interface ChatExportPayload {
  title?: string;
  sourceUrl?: string;
  exportedAt?: string;
  messages: ChatExportMessage[];
}

export const CHAT_EXPORT_EXTENSIONS: Record<ChatExportFormat, string> = {
  markdown: 'md',
  html: 'html',
  json: 'json',
  txt: 'txt',
};

export function joinCodeBlockLines(lines: string[]): string {
  return lines
    .map((line) => line.replace(/\u00a0/g, ' ').replace(/\s+$/g, ''))
    .join('\n')
    .replace(/\n+$/g, '');
}

const CHAT_EXPORT_LABELS: Record<ChatExportRole, string> = {
  user: 'User',
  assistant: 'Assistant',
  system: 'System',
  unknown: 'Message',
};

export function isChatExportFormat(value: unknown): value is ChatExportFormat {
  return typeof value === 'string' && CHAT_EXPORT_FORMATS.includes(value as ChatExportFormat);
}

function exportTitle(payload: ChatExportPayload): string {
  return payload.title?.trim() || 'ChatGPT Conversation';
}

function roleLabel(role: ChatExportRole): string {
  return CHAT_EXPORT_LABELS[role] ?? CHAT_EXPORT_LABELS.unknown;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function sanitizeChatExportHtml(value: string): string {
  return value
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, ' $1="#"')
    .replace(/\s+(href|src)\s*=\s*javascript:[^\s>]+/gi, ' $1="#"');
}

function metadataLines(payload: ChatExportPayload): string[] {
  return [
    `Exported: ${payload.exportedAt ?? new Date().toISOString()}`,
    ...(payload.sourceUrl ? [`Source: ${payload.sourceUrl}`] : []),
  ];
}

function formatMarkdown(payload: ChatExportPayload): string {
  const sections = payload.messages.map((message) => {
    return [`## ${roleLabel(message.role)}`, '', (message.markdown || message.text).trim()].join('\n');
  });

  return [
    `# ${exportTitle(payload)}`,
    '',
    ...metadataLines(payload),
    '',
    ...sections.flatMap((section, index) => (index === 0 ? [section] : ['---', '', section])),
    '',
  ].join('\n');
}

function formatText(payload: ChatExportPayload): string {
  const sections = payload.messages.map((message) => {
    return [`[${roleLabel(message.role)}]`, message.text.trim()].join('\n');
  });

  return [
    exportTitle(payload),
    ...metadataLines(payload),
    '',
    ...sections.flatMap((section, index) => (index === 0 ? [section] : ['', section])),
    '',
  ].join('\n');
}

function formatHtml(payload: ChatExportPayload): string {
  const messages = payload.messages
    .map((message) => {
      const body = message.html
        ? sanitizeChatExportHtml(message.html)
        : `<pre>${escapeHtml(message.text.trim())}</pre>`;
      return [
        `<section class="message ${message.role}">`,
        `<h2>${escapeHtml(roleLabel(message.role))}</h2>`,
        `<div class="body">${body}</div>`,
        '</section>',
      ].join('');
    })
    .join('\n');

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(exportTitle(payload))}</title>`,
    '<style>',
    'body{margin:0;padding:32px;font:16px/1.55 system-ui,sans-serif;background:#f7f7f2;color:#20231f}',
    'main{max-width:860px;margin:0 auto}.meta{color:#5f6760;font-size:13px}.message{border-top:1px solid #d9ded7;padding:22px 0}.message h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#59615b}.body{overflow-wrap:anywhere}pre{white-space:pre-wrap}',
    '</style>',
    '</head>',
    '<body>',
    '<main>',
    `<h1>${escapeHtml(exportTitle(payload))}</h1>`,
    `<p class="meta">${escapeHtml(metadataLines(payload).join(' | '))}</p>`,
    messages,
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function normalizeImportRole(role: ChatExportRole): 'user' | 'assistant' | 'system' {
  if (role === 'user' || role === 'assistant' || role === 'system') {
    return role;
  }

  return 'assistant';
}

function formatJson(payload: ChatExportPayload): string {
  return `${JSON.stringify(
    {
      schema: 'ai-chat-export.v1',
      formatVersion: 2,
      title: exportTitle(payload),
      exportedAt: payload.exportedAt ?? new Date().toISOString(),
      source: {
        platform: 'chatgpt',
        url: payload.sourceUrl,
      },
      messages: payload.messages.map((message, index) => ({
        id: `message-${index + 1}`,
        role: normalizeImportRole(message.role),
        content: message.text,
        contentParts: [
          {
            type: 'text',
            text: message.text,
          },
        ],
        ...(message.markdown ? { markdown: message.markdown } : {}),
        ...(message.html ? { html: sanitizeChatExportHtml(message.html) } : {}),
      })),
    },
    null,
    2,
  )}\n`;
}

export function formatChatExport(payload: ChatExportPayload, format: ChatExportFormat): string {
  if (!isChatExportFormat(format)) {
    throw new Error(`Unsupported export format: ${String(format)}`);
  }

  if (!Array.isArray(payload.messages)) {
    throw new Error('Chat export payload must include messages');
  }

  if (format === 'markdown') {
    return formatMarkdown(payload);
  }
  if (format === 'html') {
    return formatHtml(payload);
  }
  if (format === 'json') {
    return formatJson(payload);
  }
  return formatText(payload);
}

export function createChatExportFileName(title: string | undefined, format: ChatExportFormat, date: Date): string {
  const base = (title?.trim() || 'chatgpt-conversation')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56) || 'chatgpt-conversation';
  const timestamp = date.toISOString().replace(/\.\d{3}Z$/, '').replace(/:/g, '-');

  return `chatgpt-${base}-${timestamp}.${CHAT_EXPORT_EXTENSIONS[format]}`;
}
