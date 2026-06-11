const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const Store = require('electron-store');
const updater         = require('./src/updater');
const fabricInstaller = require('./src/fabric-installer');
const CoreLauncher    = require('./src/core-launcher');

const store = new Store();
let mainWindow;
let coreLauncherInstance;

const defaultInstallPath = os.platform() === 'win32'
  ? path.join(os.homedir(), 'AppData', 'Roaming', '.cobblesas')
  : path.join(os.homedir(), '.cobblesas');

// Desativa o sandbox no Linux para evitar erro do "chrome-sandbox" exigindo permissão root
if (os.platform() === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900, height: 550,
    minWidth: 900, minHeight: 550,
    frame: false, 
    transparent: os.platform() !== 'linux', 
    resizable: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    }
  });
  mainWindow.loadFile('renderer/index.html');
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  coreLauncherInstance = new CoreLauncher(mainWindow);
}

app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// [SEC] Escudo Anti-Fechamento Silencioso
process.on('uncaughtException', (err) => {
  console.error('[Proteção Global] Erro não tratado interceptado:', err);
  // Mantém o launcher vivo a menos que seja um erro crítico do motor
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Proteção Global] Rejeição de Promise não tratada:', reason);
});

// ─── Janela ───────────────────────────────────────────────────────────────────
ipcMain.on('window-close',    () => app.quit());
ipcMain.on('window-minimize', () => mainWindow.minimize());

ipcMain.handle('get-settings', () => {
  return {
    nickname:   store.get('nickname', ''),
    ram:        store.get('ram', '4G'),
    width:      store.get('width', '854'),
    height:     store.get('height', '480'),
    fullscreen: store.get('fullscreen', false),
    recentNicks: store.get('recent_nicks', []),
    installPath: store.get('install_path', defaultInstallPath),
    setupDone:   store.get('setup_done', false)
  };
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Selecione a pasta de instalação do jogo'
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('save-settings', (_, settings) => {
  // [SEC] Sanitização rigorosa contra Command Injection / Arbitrary Arguments
  if (settings.nickname !== undefined) {
    const cleanNick = String(settings.nickname).replace(/[^a-zA-Z0-9_]/g, '').substring(0, 16);
    store.set('nickname', cleanNick);
    
    if (cleanNick) {
      let recents = store.get('recent_nicks', []);
      recents = recents.filter(n => n !== cleanNick); // Remove duplicada
      recents.unshift(cleanNick); // Adiciona no início
      if (recents.length > 5) recents.pop(); // Limita a 5 recentes
      store.set('recent_nicks', recents);
    }
  }
  if (settings.ram !== undefined) {
    const cleanRam = String(settings.ram).replace(/[^A-Z0-9.]/g, '').substring(0, 10);
    store.set('ram', cleanRam);
  }
  if (settings.width !== undefined) {
    const cleanWidth = String(settings.width).replace(/[^0-9]/g, '').substring(0, 5) || '854';
    store.set('width', cleanWidth);
  }
  if (settings.height !== undefined) {
    const cleanHeight = String(settings.height).replace(/[^0-9]/g, '').substring(0, 5) || '480';
    store.set('height', cleanHeight);
  }
  if (settings.fullscreen !== undefined) {
    store.set('fullscreen', Boolean(settings.fullscreen));
  }
  if (settings.installPath !== undefined) {
    const cleanPath = path.normalize(String(settings.installPath).trim());
    const lowerPath = cleanPath.toLowerCase();
    // Prevenção contra injeção de diretórios críticos do SO
    if (lowerPath !== 'c:\\' && lowerPath !== 'c:\\windows' && lowerPath !== '/' && lowerPath !== '/bin') {
      store.set('install_path', cleanPath);
    }
  }
  if (settings.javaPath !== undefined) {
    if (settings.javaPath === null) {
      store.delete('javaPath');
    } else {
      const cleanJavaPath = path.normalize(String(settings.javaPath).trim());
      store.set('javaPath', cleanJavaPath);
    }
  }
  if (settings.setupDone !== undefined) {
    store.set('setup_done', Boolean(settings.setupDone));
  }
  return { success: true };
});

ipcMain.handle('get-system-ram', () => {
  // Retorna a memória total do sistema em GB
  const totalBytes = os.totalmem();
  const totalGB = totalBytes / (1024 * 1024 * 1024);
  return totalGB;
});

// ─── Selecionar Caminho Customizado do Java ──────────────────────────────────
ipcMain.handle('select-java', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Selecione o executável do Java (javaw.exe ou java.exe)',
    properties: ['openFile'],
    filters: [
      { name: 'Executáveis', extensions: ['exe'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// [SEC] Variável local e isolada da interface para garantir a origem do download
let secureDownloadUrl = null;

// ─── Verificar atualização ────────────────────────────────────────────────────
ipcMain.handle('check-update', async () => {
  try {
    const rootDir = store.get('install_path', defaultInstallPath);
    const modsFolder = path.join(rootDir, 'mods');

    const updateData = await updater.checkForUpdate(store);
    if (updateData && updateData.manifest) {
      secureDownloadUrl = updateData.manifest.download_url; // [SEC] Salva na memória do backend
    }
    return updateData;
  } catch (err) {
    return { error: err.message };
  }
});

// ─── Download + instalação ────────────────────────────────────────────────────
ipcMain.handle('download-update', async (_, version, packName, mcVersion, fabricVersion) => {
  try {
    if (!secureDownloadUrl) throw new Error("Acesso negado: URL de download ausente ou não autorizada.");
    const rootDir = store.get('install_path', defaultInstallPath);
    const modsFolder = path.join(rootDir, 'mods');

    if (packName)      store.set('pack_name', packName);
    if (mcVersion)     store.set('mc_version', mcVersion);
    if (fabricVersion) store.set('fabric_loader_version', fabricVersion);

    // 1. Garantir que o Java 21 está instalado e acessível ANTES de instalar o Fabric
    await coreLauncherInstance.ensureJava21();

    // 2. Instalar Fabric (Motor) usando o Java recém baixado/verificado
    await fabricInstaller.ensureFabric(mcVersion, fabricVersion, null, (msg) => {
      mainWindow.webContents.send('fabric-status', msg);
    });

    // 2. Extrair Modpack depois
    await updater.downloadAndInstall(
      secureDownloadUrl, version, store,
      rootDir, modsFolder,
      (p) => mainWindow.webContents.send('download-progress', p)
    );

    return { success: true };
  } catch (err) { return { error: err.message }; }
});

// ─── Lançar jogo ──────────────────────────────────────────────────────────────
ipcMain.handle('launch-game', async (_, mcVersion, loaderVersion) => {
  try {
    const nickname = store.get('nickname', '').trim();
    if (!nickname) return { error: 'Nenhum nickname definido!' };
    await coreLauncherInstance.launch(mcVersion, loaderVersion);
    return { success: true };
  } catch (err) {
    if (err.message && err.message.includes('ENOENT')) {
      return { error: 'O Java não está instalado ou configurado no PC!' };
    }
    return { error: err.message };
  }
});

ipcMain.on('kill-game', () => {
  if (coreLauncherInstance) {
    coreLauncherInstance.kill();
  }
});

// ─── Abrir pasta do jogo ──────────────────────────────────────────────────────
ipcMain.on('open-mods-folder', () => {
  const rootDir = store.get('install_path', defaultInstallPath);
  if (!fs.existsSync(rootDir)) fs.mkdirSync(rootDir, { recursive: true });
  shell.openPath(rootDir);
});
