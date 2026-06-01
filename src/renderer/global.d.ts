export {};

declare global {
  interface Window {
    chatgptWebApp: {
      clearCache(): Promise<{ ok: boolean }>;
      clearSiteData(): Promise<{ ok: boolean }>;
      getBlockerStatus(): Promise<{
        enabled: boolean;
        ready: boolean;
        blockedCount: number;
        updateInProgress: boolean;
        updateIntervalHours: number;
        lastUpdatedAt?: string;
        lastError?: string;
        lists: readonly {
          id: string;
          name: string;
          url: string;
        }[];
      }>;
      updateBlockerRules(): Promise<Window['chatgptWebApp'] extends { getBlockerStatus(): Promise<infer T> } ? T : never>;
      setBlockerUpdateInterval(hours: number): Promise<Window['chatgptWebApp'] extends { getBlockerStatus(): Promise<infer T> } ? T : never>;
      openExternal(url: string): Promise<{ ok: boolean; error?: string }>;
    };
  }
}
