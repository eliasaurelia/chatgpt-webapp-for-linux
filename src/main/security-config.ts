import type { BrowserWindowConstructorOptions } from 'electron';

export const CHATGPT_HOME_URL = 'https://chatgpt.com';
export const CHATGPT_SESSION_PARTITION = 'persist:chatgpt-private';

export function createSecureWebPreferences(
  preload?: string,
): NonNullable<BrowserWindowConstructorOptions['webPreferences']> {
  return {
    ...(preload ? { preload } : {}),
    partition: CHATGPT_SESSION_PARTITION,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
  };
}

