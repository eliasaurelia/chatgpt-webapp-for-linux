import { ipcMain, shell } from 'electron';
import type { BlockerController, BlockerStatus } from './blocker-controller.ts';
import type { PrivacyService } from './privacy-service.ts';

export type RendererBlockerStatus = BlockerStatus & {
  updateIntervalHours: number;
};

export interface IpcDependencies {
  blockerController: BlockerController;
  privacyService: PrivacyService;
  getBlockerStatus: () => RendererBlockerStatus;
  updateBlockerRules: () => Promise<RendererBlockerStatus>;
  setBlockerUpdateInterval: (hours: number) => Promise<RendererBlockerStatus>;
}

function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function registerIpcHandlers(dependencies: IpcDependencies): void {
  ipcMain.removeHandler('privacy.clearCache');
  ipcMain.removeHandler('privacy.clearSiteData');
  ipcMain.removeHandler('privacy.getBlockerStatus');
  ipcMain.removeHandler('privacy.updateBlockerRules');
  ipcMain.removeHandler('privacy.setBlockerUpdateInterval');
  ipcMain.removeHandler('app.openExternal');

  ipcMain.handle('privacy.clearCache', async () => {
    await dependencies.privacyService.clearCache();
    return { ok: true };
  });

  ipcMain.handle('privacy.clearSiteData', async () => {
    await dependencies.privacyService.clearSiteData();
    return { ok: true };
  });

  ipcMain.handle('privacy.getBlockerStatus', () => dependencies.getBlockerStatus());

  ipcMain.handle('privacy.updateBlockerRules', async () => dependencies.updateBlockerRules());

  ipcMain.handle('privacy.setBlockerUpdateInterval', async (_event, hours: number) => {
    if (!Number.isFinite(Number(hours))) {
      return { ok: false, error: 'Invalid interval' };
    }

    return dependencies.setBlockerUpdateInterval(Number(hours));
  });

  ipcMain.handle('app.openExternal', async (_event, url: string) => {
    if (!isSafeExternalUrl(url)) {
      return { ok: false, error: 'Unsupported URL' };
    }

    await shell.openExternal(url);
    return { ok: true };
  });
}
