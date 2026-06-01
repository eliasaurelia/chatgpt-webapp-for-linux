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
    updateIntervalHours: number;
    lastUpdatedAt?: string;
  };
  window: WindowSettings;
}

export const DEFAULT_BLOCKER_UPDATE_INTERVAL_HOURS = 24;
export const MIN_BLOCKER_UPDATE_INTERVAL_HOURS = 1;
export const MAX_BLOCKER_UPDATE_INTERVAL_HOURS = 168;

export const defaultSettings: AppSettings = {
  blocker: {
    enabled: true,
    updateIntervalHours: DEFAULT_BLOCKER_UPDATE_INTERVAL_HOURS,
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

export function sanitizeBlockerUpdateIntervalHours(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_BLOCKER_UPDATE_INTERVAL_HOURS;
  }

  return Math.min(
    MAX_BLOCKER_UPDATE_INTERVAL_HOURS,
    Math.max(MIN_BLOCKER_UPDATE_INTERVAL_HOURS, Math.round(numeric)),
  );
}

function sanitizeTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return Number.isFinite(Date.parse(value)) ? value : undefined;
}

export function sanitizeSettings(value: Partial<AppSettings> | undefined): AppSettings {
  const lastUpdatedAt = sanitizeTimestamp(value?.blocker?.lastUpdatedAt);

  return {
    blocker: {
      enabled: value?.blocker?.enabled ?? defaultSettings.blocker.enabled,
      updateIntervalHours: sanitizeBlockerUpdateIntervalHours(value?.blocker?.updateIntervalHours),
      ...(lastUpdatedAt === undefined ? {} : { lastUpdatedAt }),
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
