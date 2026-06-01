import './styles.css';

type BlockerStatus = Awaited<ReturnType<typeof window.chatgptWebApp.getBlockerStatus>>;

const STATUS_REFRESH_INTERVAL_MS = 3000;

const statusDot = document.querySelector<HTMLSpanElement>('[data-status-dot]');
const statusText = document.querySelector<HTMLElement>('[data-status-text]');
const blockedCount = document.querySelector<HTMLElement>('[data-blocked-count]');
const listNames = document.querySelector<HTMLElement>('[data-list-names]');
const lastUpdated = document.querySelector<HTMLElement>('[data-last-updated]');
const blockerError = document.querySelector<HTMLElement>('[data-blocker-error]');
const intervalSelect = document.querySelector<HTMLSelectElement>('[data-update-interval]');
const refreshButton = document.querySelector<HTMLButtonElement>('[data-action="refresh"]');
const updateRulesButton = document.querySelector<HTMLButtonElement>('[data-action="update-rules"]');
const clearCacheButton = document.querySelector<HTMLButtonElement>('[data-action="clear-cache"]');
const clearSiteDataButton = document.querySelector<HTMLButtonElement>('[data-action="clear-site-data"]');
const openChatGptButton = document.querySelector<HTMLButtonElement>('[data-action="open-chatgpt"]');
const message = document.querySelector<HTMLElement>('[data-message]');

function setMessage(value: string): void {
  if (message) {
    message.textContent = value;
  }
}

function formatUpdatedAt(value: string | undefined): string {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function applyStatus(status: BlockerStatus): void {
  if (statusDot) {
    statusDot.dataset.active = String(status.enabled && status.ready && !status.lastError);
  }
  if (statusText) {
    let label = 'Off';
    if (status.lastError) {
      label = 'Error';
    } else if (status.updateInProgress) {
      label = 'Updating';
    } else if (status.enabled) {
      label = status.ready ? 'Active' : 'Starting';
    }
    statusText.textContent = label;
  }
  if (blockedCount) {
    blockedCount.textContent = String(status.blockedCount);
  }
  if (listNames) {
    listNames.textContent = status.lists.map((list) => list.name).join(' + ');
  }
  if (lastUpdated) {
    lastUpdated.textContent = formatUpdatedAt(status.lastUpdatedAt);
  }
  if (intervalSelect) {
    intervalSelect.value = String(status.updateIntervalHours);
  }
  if (blockerError) {
    blockerError.hidden = !status.lastError;
    blockerError.textContent = status.lastError ?? '';
  }
}

function handleStatusError(error: unknown): void {
  if (statusText) {
    statusText.textContent = 'Error';
  }
  if (statusDot) {
    statusDot.dataset.active = 'false';
  }
  setMessage(error instanceof Error ? error.message : 'Unable to read blocker status');
}

async function refreshStatus(): Promise<void> {
  applyStatus(await window.chatgptWebApp.getBlockerStatus());
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

updateRulesButton?.addEventListener('click', () => {
  void runAction(
    updateRulesButton,
    async () => {
      applyStatus(await window.chatgptWebApp.updateBlockerRules());
    },
    'Rules updated',
  );
});

intervalSelect?.addEventListener('change', () => {
  intervalSelect.disabled = true;
  setMessage('Saving...');
  window.chatgptWebApp
    .setBlockerUpdateInterval(Number(intervalSelect.value))
    .then((status) => applyStatus(status))
    .then(() => setMessage('Update interval saved'))
    .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Action failed'))
    .finally(() => {
      intervalSelect.disabled = false;
    });
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

void refreshStatus().catch(handleStatusError);
setInterval(() => {
  void refreshStatus().catch(handleStatusError);
}, STATUS_REFRESH_INTERVAL_MS);
