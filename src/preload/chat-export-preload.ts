import { ipcRenderer } from 'electron';
import {
  CHAT_EXPORT_FORMATS,
  type ChatExportFormat,
  type ChatExportMessage,
  type ChatExportPayload,
  type ChatExportRole,
} from '../shared/chat-export.ts';

const EXPORT_UI_ATTR = 'data-chatgpt-webapp-export-ui';
const EXPORT_TURN_ATTR = 'data-chatgpt-webapp-export-turn';
const CHAT_HOSTS = new Set(['chatgpt.com', 'chat.openai.com']);

type ExportScope = 'conversation' | 'message';

interface ExportSaveResult {
  ok: boolean;
  filePath?: string;
  canceled?: boolean;
}

let activeScope: ExportScope = 'conversation';
let activeTurn: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let menuElement: HTMLElement | null = null;
let menuCaption: HTMLElement | null = null;
let toastElement: HTMLElement | null = null;
let observer: MutationObserver | null = null;

function isChatPage(): boolean {
  return CHAT_HOSTS.has(window.location.hostname) || window.location.hostname.endsWith('.chatgpt.com');
}

function normalizeRole(value: string | null | undefined): ChatExportRole {
  if (value === 'user' || value === 'assistant' || value === 'system') {
    return value;
  }

  return 'unknown';
}

function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanClone(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(
    `[${EXPORT_UI_ATTR}], script, style, noscript, button, svg, [aria-hidden="true"]`,
  ).forEach((node) => node.remove());
  return clone;
}

function contentRootForTurn(turn: HTMLElement): HTMLElement {
  const roleNode = turn.matches('[data-message-author-role]')
    ? turn
    : turn.querySelector<HTMLElement>('[data-message-author-role]');

  return roleNode?.querySelector<HTMLElement>('.markdown, .prose')
    ?? roleNode
    ?? turn;
}

function extractMessage(turn: HTMLElement): ChatExportMessage | null {
  const roleNode = turn.matches('[data-message-author-role]')
    ? turn
    : turn.querySelector<HTMLElement>('[data-message-author-role]');
  const root = contentRootForTurn(turn);
  const clone = cleanClone(root);
  const text = normalizeText(clone.innerText || clone.textContent || '');

  if (!text) {
    return null;
  }

  return {
    role: normalizeRole(roleNode?.getAttribute('data-message-author-role')),
    text,
    html: clone.innerHTML.trim() || undefined,
  };
}

function findTurnElements(): HTMLElement[] {
  const articles = Array.from(
    document.querySelectorAll<HTMLElement>('article[data-testid^="conversation-turn-"]'),
  );

  if (articles.length > 0) {
    return articles;
  }

  return Array.from(document.querySelectorAll<HTMLElement>('[data-message-author-role]'));
}

function fallbackTitle(messages: ChatExportMessage[]): string {
  const documentTitle = document.title
    .replace(/\s*[|-]\s*ChatGPT\s*$/i, '')
    .replace(/^ChatGPT\s*[|-]\s*/i, '')
    .trim();

  if (documentTitle && !/^chatgpt$/i.test(documentTitle)) {
    return documentTitle;
  }

  return messages.find((message) => message.role === 'user')?.text.slice(0, 80)
    || 'ChatGPT Conversation';
}

function createPayload(messages: ChatExportMessage[]): ChatExportPayload {
  return {
    title: fallbackTitle(messages),
    sourceUrl: window.location.href,
    exportedAt: new Date().toISOString(),
    messages,
  };
}

function collectConversation(): ChatExportPayload {
  const messages = findTurnElements()
    .map(extractMessage)
    .filter((message): message is ChatExportMessage => message !== null);

  return createPayload(messages);
}

function collectSingleMessage(turn: HTMLElement): ChatExportPayload {
  const message = extractMessage(turn);

  return createPayload(message ? [message] : []);
}

function showToast(message: string): void {
  if (!toastElement) {
    return;
  }

  toastElement.textContent = message;
  toastElement.dataset.visible = 'true';
  window.setTimeout(() => {
    if (toastElement?.textContent === message) {
      toastElement.dataset.visible = 'false';
    }
  }, 3200);
}

function closeMenu(): void {
  if (menuElement) {
    menuElement.hidden = true;
  }
}

function openMenu(scope: ExportScope, turn: HTMLElement | null): void {
  activeScope = scope;
  activeTurn = turn;

  if (menuCaption) {
    menuCaption.textContent = scope === 'conversation' ? 'Entire chat' : 'Single message';
  }
  if (menuElement) {
    menuElement.hidden = false;
  }
}

async function saveExport(format: ChatExportFormat): Promise<void> {
  const payload = activeScope === 'message' && activeTurn
    ? collectSingleMessage(activeTurn)
    : collectConversation();

  if (payload.messages.length === 0) {
    showToast('No chat messages found on this page');
    return;
  }

  closeMenu();
  showToast('Preparing export...');

  try {
    const result = await ipcRenderer.invoke('chatExport.save', {
      format,
      payload,
    }) as ExportSaveResult;

    if (result.ok) {
      showToast('Export saved');
    } else if (result.canceled) {
      showToast('Export canceled');
    } else {
      showToast('Export failed');
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Export failed');
  }
}

function ensureHostUi(): void {
  if (shadowRoot) {
    return;
  }

  const host = document.createElement('div');
  host.setAttribute(EXPORT_UI_ATTR, 'true');
  document.documentElement.append(host);
  shadowRoot = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    :host { color-scheme: light dark; }
    .launcher {
      position: fixed;
      right: 18px;
      bottom: 92px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      font: 13px system-ui, sans-serif;
    }
    button {
      border: 1px solid rgba(116, 123, 116, .42);
      border-radius: 8px;
      background: rgba(31, 35, 31, .92);
      color: #f7f7f2;
      cursor: pointer;
      font: 600 13px system-ui, sans-serif;
      min-height: 34px;
      padding: 0 12px;
      box-shadow: 0 10px 28px rgba(0, 0, 0, .22);
    }
    button:hover { background: rgba(48, 54, 49, .96); }
    .menu {
      min-width: 184px;
      border: 1px solid rgba(122, 128, 121, .35);
      border-radius: 8px;
      background: rgba(245, 246, 240, .97);
      color: #222720;
      box-shadow: 0 16px 38px rgba(0, 0, 0, .24);
      padding: 8px;
    }
    .caption {
      color: #5e665f;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 6px 8px;
      text-transform: uppercase;
    }
    .format {
      display: block;
      width: 100%;
      margin: 2px 0;
      box-shadow: none;
      background: transparent;
      color: #222720;
      text-align: left;
    }
    .format:hover { background: rgba(53, 82, 72, .1); }
    .toast {
      position: fixed;
      right: 18px;
      bottom: 46px;
      z-index: 2147483647;
      max-width: min(320px, calc(100vw - 36px));
      border-radius: 8px;
      background: rgba(31, 35, 31, .94);
      color: #f7f7f2;
      font: 13px system-ui, sans-serif;
      opacity: 0;
      padding: 9px 11px;
      pointer-events: none;
      transform: translateY(6px);
      transition: opacity .18s ease, transform .18s ease;
    }
    .toast[data-visible="true"] {
      opacity: 1;
      transform: translateY(0);
    }
    @media (prefers-color-scheme: dark) {
      .menu { background: rgba(31, 35, 31, .97); color: #f7f7f2; }
      .caption { color: #b7beb7; }
      .format { color: #f7f7f2; }
      .format:hover { background: rgba(255, 255, 255, .08); }
    }
  `;

  const launcher = document.createElement('div');
  launcher.className = 'launcher';
  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.textContent = 'Export';
  exportButton.addEventListener('click', () => openMenu('conversation', null));

  menuElement = document.createElement('div');
  menuElement.className = 'menu';
  menuElement.hidden = true;
  menuCaption = document.createElement('div');
  menuCaption.className = 'caption';
  menuElement.append(menuCaption);

  for (const format of CHAT_EXPORT_FORMATS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'format';
    button.textContent = format === 'txt' ? 'Plain text' : format.toUpperCase();
    button.addEventListener('click', () => {
      void saveExport(format);
    });
    menuElement.append(button);
  }

  toastElement = document.createElement('div');
  toastElement.className = 'toast';
  toastElement.dataset.visible = 'false';

  launcher.append(menuElement, exportButton);
  shadowRoot.append(style, launcher, toastElement);
}

function ensurePageStyle(): void {
  if (document.querySelector(`[${EXPORT_UI_ATTR}="style"]`)) {
    return;
  }

  const style = document.createElement('style');
  style.setAttribute(EXPORT_UI_ATTR, 'style');
  style.textContent = `
    [${EXPORT_TURN_ATTR}="true"] { position: relative; }
    .chatgpt-webapp-message-export[${EXPORT_UI_ATTR}] {
      position: absolute;
      right: 12px;
      top: 8px;
      z-index: 12;
      border: 1px solid rgba(102, 111, 103, .32);
      border-radius: 7px;
      background: rgba(31, 35, 31, .88);
      color: #f7f7f2;
      cursor: pointer;
      font: 600 12px system-ui, sans-serif;
      min-height: 28px;
      opacity: 0;
      padding: 0 9px;
      transition: opacity .15s ease, background .15s ease;
    }
    [${EXPORT_TURN_ATTR}="true"]:hover > .chatgpt-webapp-message-export[${EXPORT_UI_ATTR}],
    .chatgpt-webapp-message-export[${EXPORT_UI_ATTR}]:focus-visible {
      opacity: 1;
    }
    .chatgpt-webapp-message-export[${EXPORT_UI_ATTR}]:hover {
      background: rgba(49, 55, 50, .96);
    }
  `;
  document.head.append(style);
}

function attachMessageExportButtons(): void {
  for (const turn of findTurnElements()) {
    if (turn.querySelector(`:scope > .chatgpt-webapp-message-export[${EXPORT_UI_ATTR}]`)) {
      continue;
    }

    turn.setAttribute(EXPORT_TURN_ATTR, 'true');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chatgpt-webapp-message-export';
    button.setAttribute(EXPORT_UI_ATTR, 'true');
    button.textContent = 'Export';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openMenu('message', turn);
    });
    turn.append(button);
  }
}

function installExportUi(): void {
  if (!isChatPage()) {
    return;
  }

  ensureHostUi();
  ensurePageStyle();
  attachMessageExportButtons();

  observer ??= new MutationObserver(() => {
    attachMessageExportButtons();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installExportUi, { once: true });
} else {
  installExportUi();
}
