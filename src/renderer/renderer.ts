import './styles.css';

const statusDot = document.querySelector<HTMLSpanElement>('[data-status-dot]');
const statusText = document.querySelector<HTMLElement>('[data-status-text]');
const blockedCount = document.querySelector<HTMLElement>('[data-blocked-count]');
const refreshButton = document.querySelector<HTMLButtonElement>('[data-action="refresh"]');
const clearCacheButton = document.querySelector<HTMLButtonElement>('[data-action="clear-cache"]');
const clearSiteDataButton = document.querySelector<HTMLButtonElement>('[data-action="clear-site-data"]');
const openChatGptButton = document.querySelector<HTMLButtonElement>('[data-action="open-chatgpt"]');
const message = document.querySelector<HTMLElement>('[data-message]');

function setMessage(value: string): void {
  if (message) {
    message.textContent = value;
  }
}

async function refreshStatus(): Promise<void> {
  const status = await window.chatgptWebApp.getBlockerStatus();

  if (statusDot) {
    statusDot.dataset.active = String(status.enabled && status.ready);
  }
  if (statusText) {
    statusText.textContent = status.enabled
      ? status.ready
        ? 'Active'
        : 'Starting'
      : 'Off';
  }
  if (blockedCount) {
    blockedCount.textContent = String(status.blockedCount);
  }
}

async function runAction(button: HTMLButtonElement | null, action: () => Promise<unknown>, done: string): Promise<void> {
  if (!button) {
    return;
  }

  button.disabled = true;
  setMessage('Working...');
  try {
    await action();
    await refreshStatus();
    setMessage(done);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Action failed');
  } finally {
    button.disabled = false;
  }
}

refreshButton?.addEventListener('click', () => {
  void runAction(refreshButton, refreshStatus, 'Status refreshed');
});

clearCacheButton?.addEventListener('click', () => {
  void runAction(clearCacheButton, () => window.chatgptWebApp.clearCache(), 'Cache cleared');
});

clearSiteDataButton?.addEventListener('click', () => {
  void runAction(
    clearSiteDataButton,
    () => window.chatgptWebApp.clearSiteData(),
    'Site data cleared',
  );
});

openChatGptButton?.addEventListener('click', () => {
  void window.chatgptWebApp.openExternal('https://chatgpt.com');
});

void refreshStatus();

