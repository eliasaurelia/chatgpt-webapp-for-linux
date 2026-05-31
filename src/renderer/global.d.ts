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
      }>;
      openExternal(url: string): Promise<{ ok: boolean; error?: string }>;
    };
  }
}

