import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { isCoreOpenAiResource } from '../shared/url-policy.ts';

export const EASYLIST_RULE_LISTS = [
  {
    id: 'easylist',
    name: 'EasyList',
    url: 'https://easylist.to/easylist/easylist.txt',
  },
  {
    id: 'easyprivacy',
    name: 'EasyPrivacy',
    url: 'https://easylist.to/easylist/easyprivacy.txt',
  },
] as const;

export const DEFAULT_BLOCKER_LOAD_TIMEOUT_MS = 10_000;

export interface BlockerEngine {
  enableBlockingInSession(session: unknown): void;
  disableBlockingInSession(session: unknown): void;
  on?(eventName: 'request-blocked', listener: () => void): void;
}

export interface BlockerStatus {
  enabled: boolean;
  ready: boolean;
  blockedCount: number;
  updateInProgress: boolean;
  lastUpdatedAt?: string;
  lastError?: string;
  lists: typeof EASYLIST_RULE_LISTS;
}

export interface BlockerEngineLoadOptions {
  ignoreCache?: boolean;
}

export interface BlockerControllerOptions {
  session: unknown;
  loadEngine: (options?: BlockerEngineLoadOptions) => Promise<BlockerEngine>;
  initialEnabled: boolean;
  initialLastUpdatedAt?: string;
  loadTimeoutMs?: number;
  now?: () => Date;
}

export interface BlockerController {
  start(): Promise<void>;
  setEnabled(enabled: boolean): Promise<void>;
  updateRules(): Promise<BlockerStatus>;
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
  let updateInProgress = false;
  let updatePromise: Promise<BlockerStatus> | null = null;
  let lastUpdatedAt = options.initialLastUpdatedAt;
  let lastError: string | undefined;
  const eventBoundEngines = new WeakSet<object>();
  let activeInSession = false;
  const now = options.now ?? (() => new Date());
  const loadTimeoutMs = options.loadTimeoutMs ?? DEFAULT_BLOCKER_LOAD_TIMEOUT_MS;

  function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  function bindEngineEvents(target: BlockerEngine): void {
    if (typeof target !== 'object' || target === null || typeof target.on !== 'function') {
      return;
    }

    if (!eventBoundEngines.has(target)) {
      target.on('request-blocked', () => {
        blockedCount += 1;
      });
      eventBoundEngines.add(target);
    }
  }

  function withLoadTimeout(promise: Promise<BlockerEngine>): Promise<BlockerEngine> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<BlockerEngine>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error('Tracker rule loading timed out'));
      }, loadTimeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => {
      if (timer) {
        clearTimeout(timer);
      }
    });
  }

  async function getEngine(loadOptions?: BlockerEngineLoadOptions): Promise<BlockerEngine> {
    try {
      if (loadOptions?.ignoreCache) {
        engine = await withLoadTimeout(options.loadEngine(loadOptions));
        loadPromise = Promise.resolve(engine);
      } else {
        loadPromise ??= withLoadTimeout(options.loadEngine());
        engine = await loadPromise;
      }

      bindEngineEvents(engine);
      ready = true;
      lastError = undefined;
      return engine;
    } catch (error) {
      lastError = getErrorMessage(error);
      ready = false;
      if (!loadOptions?.ignoreCache) {
        loadPromise = null;
      }
      throw error;
    }
  }

  function getStatus(): BlockerStatus {
    return {
      enabled,
      ready,
      blockedCount,
      updateInProgress,
      lastUpdatedAt,
      lastError,
      lists: EASYLIST_RULE_LISTS,
    };
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

    async updateRules(): Promise<BlockerStatus> {
      if (updatePromise) {
        return updatePromise;
      }

      updateInProgress = true;
      updatePromise = (async () => {
        const previousEngine = engine;
        const wasActive = activeInSession;

        try {
          const refreshedEngine = await getEngine({ ignoreCache: true });
          if (wasActive && previousEngine && previousEngine !== refreshedEngine) {
            previousEngine.disableBlockingInSession(options.session);
            activeInSession = false;
          }
          if (enabled && wasActive) {
            refreshedEngine.enableBlockingInSession(options.session);
            activeInSession = true;
          }

          lastUpdatedAt = now().toISOString();
          lastError = undefined;
          return getStatus();
        } catch (error) {
          lastError = getErrorMessage(error);
          throw error;
        } finally {
          updateInProgress = false;
          updatePromise = null;
        }
      })();

      return updatePromise;
    },

    getStatus,
  };
}

interface SerializableBlockerEngine extends BlockerEngine {
  serialize?: () => Uint8Array;
}

async function writeSerializedEngine(cachePath: string, engine: SerializableBlockerEngine): Promise<void> {
  if (typeof engine.serialize === 'function') {
    await writeFile(cachePath, engine.serialize());
  }
}

export async function loadGhosteryEngine(
  cachePath: string,
  options: BlockerEngineLoadOptions = {},
): Promise<BlockerEngine> {
  await mkdir(dirname(cachePath), { recursive: true });
  const { ElectronBlocker } = await import('@ghostery/adblocker-electron');
  const urls = EASYLIST_RULE_LISTS.map((list) => list.url);

  if (options.ignoreCache) {
    const blocker = await ElectronBlocker.fromLists(fetch, urls, GHOSTERY_NETWORK_ONLY_CONFIG);
    await writeSerializedEngine(cachePath, blocker);
    return allowCoreOpenAiResources(blocker);
  }

  const blocker = await ElectronBlocker.fromLists(
    fetch,
    urls,
    GHOSTERY_NETWORK_ONLY_CONFIG,
    {
      path: cachePath,
      read: readFile,
      write: writeFile,
    },
  );

  return allowCoreOpenAiResources(blocker);
}
