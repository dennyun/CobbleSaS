const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  closeWindow:    () => ipcRenderer.send('window-close'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),

  // ─── Settings & System ──────────────────────────────────────────────────────
  getSystemRam:   () => ipcRenderer.invoke('get-system-ram'),
  getSettings:    () => ipcRenderer.invoke('get-settings'),
  saveSettings:   (s) => ipcRenderer.invoke('save-settings', s),
  selectDirectory:() => ipcRenderer.invoke('select-directory'),
  selectJava:     () => ipcRenderer.invoke('select-java'),

  checkUpdate:    ()                                    => ipcRenderer.invoke('check-update'),
  downloadUpdate: (ver, pack, mc, fabric)               => ipcRenderer.invoke('download-update', ver, pack, mc, fabric),
  installFabric:  (mc, ld, iv)                          => ipcRenderer.invoke('install-fabric', mc, ld, iv),
  launchGame:     (mc, ld)                              => ipcRenderer.invoke('launch-game', mc, ld),
  killGame:       ()                                    => ipcRenderer.send('kill-game'),
  openModsFolder: ()                                    => ipcRenderer.send('open-mods-folder'),

  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_, d) => cb(d)),
  onFabricStatus:     (cb) => ipcRenderer.on('fabric-status',     (_, m) => cb(m)),
  onGameState:        (cb) => ipcRenderer.on('game-state',        (_, state) => cb(state)),
});
