import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface WindowSettings {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized: boolean;
}

export interface AppSettings {
  blocker: {
    enabled: boolean;
  };
  window: WindowSettings;
}

export const defaultSettings: AppSettings = {
  blocker: {
    enabled: true,
  },
  window: {
    width: 1180,
    height: 820,
    maximized: false,
  },
};

function sanitizeWindow(value: Partial<WindowSettings> | undefined): WindowSettings {
  const width = Number.isFinite(value?.width) ? Number(value?.width) : defaultSettings.window.width;
  const height = Number.isFinite(value?.height) ? Number(value?.height) : defaultSettings.window.height;
  const x = Number.isFinite(value?.x) ? Number(value?.x) : undefined;
  const y = Number.isFinite(value?.y) ? Number(value?.y) : undefined;

  return {
    width: Math.max(860, Math.round(width)),
    height: Math.max(640, Math.round(height)),
    ...(x === undefined ? {} : { x: Math.round(x) }),
    ...(y === undefined ? {} : { y: Math.round(y) }),
    maximized: Boolean(value?.maximized),
  };
}

export function sanitizeSettings(value: Partial<AppSettings> | undefined): AppSettings {
  return {
    blocker: {
      enabled: value?.blocker?.enabled ?? defaultSettings.blocker.enabled,
    },
    window: sanitizeWindow(value?.window),
  };
}

export async function readSettings(path: string): Promise<AppSettings> {
  try {
    const raw = await readFile(path, 'utf8');
    return sanitizeSettings(JSON.parse(raw) as Partial<AppSettings>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return sanitizeSettings(defaultSettings);
    }
    throw error;
  }
}

export async function writeSettings(path: string, settings: AppSettings): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(sanitizeSettings(settings), null, 2)}\n`, 'utf8');
}

