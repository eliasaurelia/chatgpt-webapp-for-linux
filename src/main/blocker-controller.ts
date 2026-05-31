import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { isCoreOpenAiResource } from '../shared/url-policy.ts';

export interface BlockerEngine {
  enableBlockingInSession(session: unknown): void;
  disableBlockingInSession(session: unknown): void;
  on?(eventName: 'request-blocked', listener: () => void): void;
}

export interface BlockerStatus {
  enabled: boolean;
  ready: boolean;
  blockedCount: number;
}

export interface BlockerControllerOptions {
  session: unknown;
  loadEngine: () => Promise<BlockerEngine>;
  initialEnabled: boolean;
}

export interface BlockerController {
  start(): Promise<void>;
  setEnabled(enabled: boolean): Promise<void>;
  getStatus(): BlockerStatus;
}

export const GHOSTERY_NETWORK_ONLY_CONFIG = {
  enableMutationObserver: false,
  enablePushInjectionsOnNavigationEvents: false,
  loadCosmeticFilters: false,
  loadExtendedSelectors: false,
  loadGenericCosmeticsFilters: false,
  loadNetworkFilters: true,
  loadCSPFilters: true,
} as const;

type WebRequestCallback = (response: Record<string, unknown>) => void;
type WebRequestHandler = (details: { url?: string }, callback: WebRequestCallback) => void;

interface CoreResourceBypassableBlocker extends BlockerEngine {
  onBeforeRequest?: WebRequestHandler;
  onHeadersReceived?: WebRequestHandler;
}

export function allowCoreOpenAiResources<T extends BlockerEngine>(engine: T): T {
  const blocker = engine as T & CoreResourceBypassableBlocker;
  const originalBeforeRequest = blocker.onBeforeRequest;
  const originalHeadersReceived = blocker.onHeadersReceived;

  if (typeof originalBeforeRequest === 'function') {
    blocker.onBeforeRequest = (details, callback) => {
      if (details.url && isCoreOpenAiResource(details.url)) {
        callback({});
        return;
      }

      originalBeforeRequest.call(blocker, details, callback);
    };
  }

  if (typeof originalHeadersReceived === 'function') {
    blocker.onHeadersReceived = (details, callback) => {
      if (details.url && isCoreOpenAiResource(details.url)) {
        callback({});
        return;
      }

      originalHeadersReceived.call(blocker, details, callback);
    };
  }

  return engine;
}

export function createBlockerController(options: BlockerControllerOptions): BlockerController {
  let engine: BlockerEngine | null = null;
  let loadPromise: Promise<BlockerEngine> | null = null;
  let enabled = options.initialEnabled;
  let ready = false;
  let blockedCount = 0;
  let eventBound = false;
  let activeInSession = false;

  async function getEngine(): Promise<BlockerEngine> {
    loadPromise ??= options.loadEngine();
    engine = await loadPromise;

    if (!eventBound && typeof engine.on === 'function') {
      engine.on('request-blocked', () => {
        blockedCount += 1;
      });
      eventBound = true;
    }

    ready = true;
    return engine;
  }

  return {
    async start(): Promise<void> {
      if (enabled && !activeInSession) {
        const blocker = await getEngine();
        blocker.enableBlockingInSession(options.session);
        activeInSession = true;
      }
    },

    async setEnabled(nextEnabled: boolean): Promise<void> {
      if (enabled === nextEnabled && (ready || !nextEnabled)) {
        return;
      }

      enabled = nextEnabled;
      const blocker = await getEngine();

      if (enabled) {
        blocker.enableBlockingInSession(options.session);
        activeInSession = true;
      } else {
        blocker.disableBlockingInSession(options.session);
        activeInSession = false;
      }
    },

    getStatus(): BlockerStatus {
      return {
        enabled,
        ready,
        blockedCount,
      };
    },
  };
}

export async function loadGhosteryEngine(cachePath: string): Promise<BlockerEngine> {
  await mkdir(dirname(cachePath), { recursive: true });
  const { ElectronBlocker, adsAndTrackingLists } = await import('@ghostery/adblocker-electron');

  const blocker = await ElectronBlocker.fromLists(
    fetch,
    adsAndTrackingLists,
    GHOSTERY_NETWORK_ONLY_CONFIG,
    {
      path: cachePath,
      read: readFile,
      write: writeFile,
    },
  );

  return allowCoreOpenAiResources(blocker);
}
