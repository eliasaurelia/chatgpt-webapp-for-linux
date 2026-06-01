import {
  app,
  BrowserWindow,
  dialog,
  nativeImage,
  session,
  shell,
  type Session,
} from 'electron';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createBlockerController,
  loadGhosteryEngine,
  type BlockerController,
  type BlockerStatus,
} from './blocker-controller.ts';
import { computeNextBlockerUpdateDelayMs } from './blocker-update-schedule.ts';
import { createChatExportService, type ChatExportService } from './chat-export-service.ts';
import { registerIpcHandlers } from './ipc.ts';
import { installApplicationMenu } from './menu.ts';
import { shouldGrantPermission } from './permission-policy.ts';
import { createPrivacyService, type PrivacyService } from './privacy-service.ts';
import {
  readSettings,
  sanitizeBlockerUpdateIntervalHours,
  writeSettings,
  type AppSettings,
} from './settings-store.ts';
import { runStartupSequence } from './startup-sequence.ts';
import {
  CHATGPT_HOME_URL,
  CHATGPT_SESSION_PARTITION,
  createSecureWebPreferences,
} from './security-config.ts';
import { shouldOpenExternally } from '../shared/url-policy.ts';
import { createWindowOptionsFromState, extractWindowState } from './window-state.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DEV_SERVER_URL = process.env.CHATGPT_WEBAPP_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;
let privacyWindow: BrowserWindow | null = null;
let settings: AppSettings;
let blockerController: BlockerController;
let chatExportService: ChatExportService;
let privacyService: PrivacyService;
let blockerUpdateTimer: NodeJS.Timeout | null = null;

function configureLinuxChromium(): void {
  if (process.platform !== 'linux') {
    return;
  }

  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
}

function iconPath(): string {
  return join(app.getAppPath(), 'assets', 'icons', '256x256.png');
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

function blockerCachePath(): string {
  return join(app.getPath('userData'), 'blocker', 'engine-network-only.bin');
}

function rendererUrl(): string {
  if (DEV_SERVER_URL) {
    return DEV_SERVER_URL;
  }

  return `file://${join(app.getAppPath(), 'dist', 'renderer', 'index.html')}`;
}

function openUrlInsideOrOutside(window: BrowserWindow, url: string): void {
  if (shouldOpenExternally(url)) {
    void shell.openExternal(url);
    return;
  }

  void window.loadURL(url);
}

function guardNavigation(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    openUrlInsideOrOutside(window, url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (shouldOpenExternally(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });
}

function configurePermissions(chatSession: Session): void {
  chatSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details.requestingUrl || webContents.getURL();
    callback(shouldGrantPermission(permission, requestingUrl));
  });

  chatSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const requestingUrl = requestingOrigin || webContents?.getURL() || '';
    return shouldGrantPermission(permission, requestingUrl);
  });
}

function configureDownloads(chatSession: Session): void {
  chatSession.on('will-download', (_event, item) => {
    const owner = mainWindow ?? BrowserWindow.getFocusedWindow() ?? undefined;
    const defaultPath = join(app.getPath('downloads'), item.getFilename());
    const dialogOptions = {
      title: 'Save download',
      defaultPath,
      buttonLabel: 'Save',
    };
    const selectedPath = owner
      ? dialog.showSaveDialogSync(owner, dialogOptions)
      : dialog.showSaveDialogSync(dialogOptions);

    if (!selectedPath) {
      item.cancel();
      return;
    }

    item.setSavePath(selectedPath);
  });
}

async function saveWindowState(): Promise<void> {
  if (!mainWindow) {
    return;
  }

  settings = {
    ...settings,
    window: extractWindowState(mainWindow),
  };
  await writeSettings(settingsPath(), settings);
}

async function saveSettings(): Promise<void> {
  await writeSettings(settingsPath(), settings);
}

function blockerStatusForRenderer(): BlockerStatus & { updateIntervalHours: number } {
  return {
    ...blockerController.getStatus(),
    updateIntervalHours: settings.blocker.updateIntervalHours,
  };
}

async function persistBlockerSettings(
  blockerSettings: Partial<AppSettings['blocker']>,
): Promise<void> {
  settings = {
    ...settings,
    blocker: {
      ...settings.blocker,
      ...blockerSettings,
    },
  };
  await saveSettings();
}

function clearBlockerUpdateTimer(): void {
  if (blockerUpdateTimer) {
    clearTimeout(blockerUpdateTimer);
    blockerUpdateTimer = null;
  }
}

function scheduleBlockerAutoUpdate(delayOverrideMs?: number): void {
  clearBlockerUpdateTimer();

  const delayMs = delayOverrideMs ?? computeNextBlockerUpdateDelayMs({
    intervalHours: settings.blocker.updateIntervalHours,
    lastUpdatedAt: settings.blocker.lastUpdatedAt,
    now: new Date(),
  });

  blockerUpdateTimer = setTimeout(() => {
    void updateBlockerRulesFromNetwork()
      .catch((error) => {
        console.warn('Tracker blocker rule update failed:', error);
        scheduleBlockerAutoUpdate(settings.blocker.updateIntervalHours * 60 * 60 * 1000);
      });
  }, delayMs);
  blockerUpdateTimer.unref();
}

async function updateBlockerRulesFromNetwork(): Promise<BlockerStatus & { updateIntervalHours: number }> {
  const status = await blockerController.updateRules();
  if (status.lastUpdatedAt) {
    await persistBlockerSettings({ lastUpdatedAt: status.lastUpdatedAt });
  }
  scheduleBlockerAutoUpdate();
  return blockerStatusForRenderer();
}

async function setBlockerUpdateInterval(hours: number): Promise<BlockerStatus & { updateIntervalHours: number }> {
  await persistBlockerSettings({
    updateIntervalHours: sanitizeBlockerUpdateIntervalHours(hours),
  });
  scheduleBlockerAutoUpdate();
  return blockerStatusForRenderer();
}

async function createMainWindow(): Promise<void> {
  const windowOptions = createWindowOptionsFromState(settings.window);
  mainWindow = new BrowserWindow({
    ...windowOptions,
    title: 'ChatGPT WebApp',
    icon: nativeImage.createFromPath(iconPath()),
    webPreferences: createSecureWebPreferences(join(__dirname, '..', 'preload', 'chat-export-preload.cjs')),
  });

  guardNavigation(mainWindow);

  if (settings.window.maximized) {
    mainWindow.maximize();
  }

  mainWindow.on('close', () => {
    void saveWindowState();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(CHATGPT_HOME_URL);
}

function openPrivacyWindow(): void {
  if (privacyWindow) {
    privacyWindow.focus();
    return;
  }

  privacyWindow = new BrowserWindow({
    width: 560,
    height: 520,
    minWidth: 480,
    minHeight: 420,
    title: 'Privacy',
    frame: true,
    show: false,
    backgroundColor: '#f7f7f2',
    icon: nativeImage.createFromPath(iconPath()),
    webPreferences: createSecureWebPreferences(join(__dirname, '..', 'preload', 'settings-preload.cjs')),
  });

  privacyWindow.removeMenu();
  privacyWindow.once('ready-to-show', () => privacyWindow?.show());
  privacyWindow.on('closed', () => {
    privacyWindow = null;
  });
  void privacyWindow.loadURL(rendererUrl());
}

async function bootstrap(): Promise<void> {
  settings = await readSettings(settingsPath());

  const chatSession = session.fromPartition(CHATGPT_SESSION_PARTITION);
  configurePermissions(chatSession);
  configureDownloads(chatSession);

  privacyService = createPrivacyService(chatSession);
  chatExportService = createChatExportService({
    defaultDirectory: app.getPath('downloads'),
    showSaveDialog: (options) => {
      const owner = mainWindow ?? BrowserWindow.getFocusedWindow() ?? undefined;
      return owner ? dialog.showSaveDialog(owner, options) : dialog.showSaveDialog(options);
    },
    writeFile: (path, content) => writeFile(path, content, 'utf8'),
  });
  blockerController = createBlockerController({
    session: chatSession,
    loadEngine: (loadOptions) => loadGhosteryEngine(blockerCachePath(), loadOptions),
    initialEnabled: settings.blocker.enabled,
    initialLastUpdatedAt: settings.blocker.lastUpdatedAt,
  });

  registerIpcHandlers({
    blockerController,
    privacyService,
    getBlockerStatus: blockerStatusForRenderer,
    saveChatExport: (request) => chatExportService.saveChatExport(request),
    updateBlockerRules: updateBlockerRulesFromNetwork,
    setBlockerUpdateInterval,
  });

  await runStartupSequence({
    startBlocker: async () => {
      await blockerController.start();
      scheduleBlockerAutoUpdate();
    },
    createMainWindow,
    installMenu: () => {
      installApplicationMenu({
        blockerController,
        openSettingsWindow: openPrivacyWindow,
        privacyService,
        reloadMainWindow: () => mainWindow?.reload(),
        updateBlockerRules: updateBlockerRulesFromNetwork,
      });
    },
    onBlockerError: (error) => {
      console.warn('Tracker blocker failed to initialize:', error);
    },
  });
}

configureLinuxChromium();
app.setName('ChatGPT WebApp');

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    void bootstrap();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });

  app.on('before-quit', () => {
    clearBlockerUpdateTimer();
    void saveWindowState();
  });
}
