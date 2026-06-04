import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const USER_CHROMIUM_FLAGS_FILE_NAME = 'chatgpt-webapp-flags.conf';

export const DEFAULT_LINUX_CHROMIUM_SWITCHES = [
  { name: 'ozone-platform-hint', value: 'auto' },
  { name: 'enable-features', value: 'WaylandWindowDecorations' },
] as const;

export interface ChromiumCommandLine {
  appendSwitch(name: string, value?: string): void;
  appendArgument(argument: string): void;
}

export interface InvalidChromiumFlagLine {
  lineNumber: number;
  text: string;
}

export interface ParsedUserChromiumFlags {
  flags: string[];
  invalidLines: InvalidChromiumFlagLine[];
}

export interface LoadedUserChromiumFlags extends ParsedUserChromiumFlags {
  path: string;
  error?: unknown;
}

export function userChromiumFlagsPath(
  env: { XDG_CONFIG_HOME?: string } = process.env,
  home = homedir(),
): string {
  const configHome = env.XDG_CONFIG_HOME?.trim() || join(home, '.config');
  return join(configHome, USER_CHROMIUM_FLAGS_FILE_NAME);
}

export function parseUserChromiumFlagsConfig(content: string): ParsedUserChromiumFlags {
  const flags: string[] = [];
  const invalidLines: InvalidChromiumFlagLine[] = [];

  const normalizedContent = content.replace(/^\uFEFF/, '');
  normalizedContent.split(/\r?\n/).forEach((line, index) => {
    const text = line.trim();
    if (!text || text.startsWith('#')) {
      return;
    }

    if (!text.startsWith('--') || text === '--' || text.includes('\0')) {
      invalidLines.push({
        lineNumber: index + 1,
        text,
      });
      return;
    }

    flags.push(text);
  });

  return { flags, invalidLines };
}

export function loadUserChromiumFlags(path = userChromiumFlagsPath()): LoadedUserChromiumFlags {
  try {
    return {
      path,
      ...parseUserChromiumFlagsConfig(readFileSync(path, 'utf8')),
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        path,
        flags: [],
        invalidLines: [],
      };
    }

    return {
      path,
      flags: [],
      invalidLines: [],
      error,
    };
  }
}

export function applyLinuxChromiumFlags(
  commandLine: ChromiumCommandLine,
  userFlags: readonly string[],
): void {
  for (const { name, value } of DEFAULT_LINUX_CHROMIUM_SWITCHES) {
    commandLine.appendSwitch(name, value);
  }

  for (const flag of userFlags) {
    commandLine.appendArgument(flag);
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as NodeJS.ErrnoException).code === 'ENOENT';
}
