import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('chatgptWebApp', {
  clearCache: () => ipcRenderer.invoke('privacy.clearCache'),
  clearSiteData: () => ipcRenderer.invoke('privacy.clearSiteData'),
  getBlockerStatus: () => ipcRenderer.invoke('privacy.getBlockerStatus'),
  updateBlockerRules: () => ipcRenderer.invoke('privacy.updateBlockerRules'),
  setBlockerUpdateInterval: (hours: number) => ipcRenderer.invoke('privacy.setBlockerUpdateInterval', hours),
  openExternal: (url: string) => ipcRenderer.invoke('app.openExternal', url),
});
