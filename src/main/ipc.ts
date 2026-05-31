import { ipcMain, shell } from 'electron';
import type { BlockerController } from './blocker-controller.ts';
import type { PrivacyService } from './privacy-service.ts';

export interface IpcDependencies {
  blockerController: BlockerController;
  privacyService: PrivacyService;
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
  ipcMain.removeHandler('app.openExternal');

  ipcMain.handle('privacy.clearCache', async () => {
    await dependencies.privacyService.clearCache();
    return { ok: true };
  });

  ipcMain.handle('privacy.clearSiteData', async () => {
    await dependencies.privacyService.clearSiteData();
    return { ok: true };
  });

  ipcMain.handle('privacy.getBlockerStatus', () => dependencies.blockerController.getStatus());

  ipcMain.handle('app.openExternal', async (_event, url: string) => {
    if (!isSafeExternalUrl(url)) {
      return { ok: false, error: 'Unsupported URL' };
    }

    await shell.openExternal(url);
    return { ok: true };
  });
}

