export interface PageSearchRequest {
  query: string;
  forward?: boolean;
  findNext?: boolean;
}

export interface PageSearchStopRequest {
  clearSelection?: boolean;
}

export interface PageSearchResult {
  ok: true;
  requestId: number;
}

export type PageSearchStopAction = 'clearSelection' | 'keepSelection';

export interface SearchableWebContents {
  findInPage(
    text: string,
    options: {
      forward: boolean;
      findNext: boolean;
    },
  ): number;
  stopFindInPage(action: PageSearchStopAction): void;
}

export interface PageSearchServiceDependencies {
  getWebContents(): SearchableWebContents | null | undefined;
}

export interface PageSearchService {
  find(request: PageSearchRequest): Promise<PageSearchResult>;
  stop(request?: PageSearchStopRequest): Promise<PageSearchResult>;
}

export function createPageSearchService(
  dependencies: PageSearchServiceDependencies,
): PageSearchService {
  function requireWebContents(): SearchableWebContents {
    const webContents = dependencies.getWebContents();
    if (!webContents) {
      throw new Error('No active page to search');
    }
    return webContents;
  }

  return {
    async find(request: PageSearchRequest): Promise<PageSearchResult> {
      const webContents = requireWebContents();
      if (request.query.trim().length === 0) {
        webContents.stopFindInPage('clearSelection');
        return { ok: true, requestId: 0 };
      }

      const requestId = webContents.findInPage(request.query, {
        forward: request.forward ?? true,
        findNext: request.findNext ?? false,
      });

      return { ok: true, requestId };
    },

    async stop(request: PageSearchStopRequest = {}): Promise<PageSearchResult> {
      requireWebContents().stopFindInPage(
        request.clearSelection === true ? 'clearSelection' : 'keepSelection',
      );
      return { ok: true, requestId: 0 };
    },
  };
}
