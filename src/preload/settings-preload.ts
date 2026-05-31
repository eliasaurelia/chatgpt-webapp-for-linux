import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('chatgptWebApp', {
  clearCache: () => ipcRenderer.invoke('privacy.clearCache'),
  clearSiteData: () => ipcRenderer.invoke('privacy.clearSiteData'),
  getBlockerStatus: () => ipcRenderer.invoke('privacy.getBlockerStatus'),
  openExternal: (url: string) => ipcRenderer.invoke('app.openExternal', url),
});

