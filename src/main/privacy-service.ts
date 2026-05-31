export type SiteDataStorage =
  | 'cookies'
  | 'filesystem'
  | 'indexdb'
  | 'localstorage'
  | 'shadercache'
  | 'websql'
  | 'serviceworkers'
  | 'cachestorage';

export const SITE_DATA_STORAGES: SiteDataStorage[] = [
  'cookies',
  'filesystem',
  'indexdb',
  'localstorage',
  'shadercache',
  'websql',
  'serviceworkers',
  'cachestorage',
] ;

export interface ClearableSession {
  clearCache(): Promise<void>;
  clearStorageData(options: { storages: SiteDataStorage[] }): Promise<void>;
}

export interface PrivacyService {
  clearCache(): Promise<void>;
  clearSiteData(): Promise<void>;
}

export function createPrivacyService(session: ClearableSession): PrivacyService {
  return {
    clearCache: () => session.clearCache(),
    clearSiteData: () => session.clearStorageData({ storages: SITE_DATA_STORAGES }),
  };
}
