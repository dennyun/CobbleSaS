const os   = require('os');
const path = require('path');
const fs   = require('fs');
const { exec, spawn, execSync } = require('child_process');
const { shell } = require('electron');

const HOME   = os.homedir();
const MC_DIR = path.join(HOME, 'AppData', 'Roaming', '.minecraft');

// ─── SKLauncher candidates ────────────────────────────────────────────────────
const SK_CANDIDATES = [
  path.join(HOME, 'Desktop',   'SKlauncher.jar'),
  path.join(HOME, 'Desktop',   'SKLauncher.jar'),
  path.join(HOME, 'Downloads', 'SKlauncher.jar'),
  path.join(HOME, 'Downloads', 'SKLauncher.jar'),
  path.join(HOME, 'AppData', 'Roaming', 'SKlauncher',  'SKlauncher.jar'),
  path.join(HOME, 'AppData', 'Roaming', 'SKLauncher',  'SKLauncher.jar'),
  'C:\\SKlauncher\\SKlauncher.jar',
];

// ─── Minecraft Launcher — busca em registro + scan de disco ──────────────────

/**
 * Estratégia 1: Registro do Windows — App Paths
 * O instalador oficial sempre registra o caminho aqui.
 */
function findExeFromAppPaths() {
  const keys = [
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Minecraft.exe',
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Minecraft.exe',
    'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Minecraft.exe',
  ];
  for (const key of keys) {
    try {
      const out = execSync(`reg query "${key}" /ve`, { encoding: 'utf8', timeout: 3000, windowsHide: true });
      const m = out.match(/REG_SZ\s+(.+\.exe)/i);
      if (m) {
        const p = m[1].trim();
        // Valida que é EXATAMENTE Minecraft.exe, não outro .exe qualquer
        if (path.basename(p).toLowerCase() === 'minecraft.exe' && fs.existsSync(p)) return p;
      }
    } catch {}
  }
  return null;
}

/**
 * Estratégia 2: Registro do Windows — chaves de desinstalação
 * Procura o DisplayIcon ou InstallLocation de "Minecraft Launcher".
 */
function findExeFromUninstallKey() {
  const hives = [
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  ];
  for (const hive of hives) {
    try {
      const out = execSync(`reg query "${hive}" /s /f "Minecraft Launcher" /d`, {
        encoding: 'utf8', timeout: 5000, windowsHide: true,
      });
      // Extrai caminhos .exe da saída
      const lines = out.split('\n');
      for (const line of lines) {
        const m = line.match(/(?:DisplayIcon|InstallLocation)\s+REG_SZ\s+(.+)/i);
        if (m) {
          let p = m[1].trim().replace(/^"(.+)"$/, '$1');
          // Constrói lista de candidatos a testar
          const candidates = [
            p,
            path.join(p, 'Minecraft.exe'),
            path.join(p, 'Content', 'Minecraft.exe'),
            path.join(path.dirname(p), 'Content', 'Minecraft.exe'),
          ];
          for (const c of candidates) {
            // Aceita APENAS se o arquivo se chama exatamente Minecraft.exe
            if (path.basename(c).toLowerCase() === 'minecraft.exe' && fs.existsSync(c)) return c;
          }
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Estratégia 3: Scan de discos (drives comuns + subpastas típicas)
 */
const DRIVES  = ['C', 'D', 'E', 'F', 'G', 'H', 'I'];
const MC_SUBS = [
  'Minecraft Launcher\\Content\\Minecraft.exe',
  'Games\\Minecraft Launcher\\Content\\Minecraft.exe',
  'Program Files\\Minecraft Launcher\\Content\\Minecraft.exe',
  'Program Files (x86)\\Minecraft Launcher\\Content\\Minecraft.exe',
  'Programs\\Minecraft Launcher\\Content\\Minecraft.exe',
  'XboxGames\\Minecraft Launcher\\Content\\Minecraft.exe',
];

function findExeFromDriveScan() {
  // 0. Atalhos .lnk do Desktop e Menu Iniciar (mais rápido e comum)
  const lnkCandidates = [
    path.join(HOME, 'Desktop',    'Minecraft Launcher.lnk'),
    path.join(HOME, 'Desktop',    'Minecraft.lnk'),
    path.join('C:\\Users', 'Public', 'Desktop', 'Minecraft Launcher.lnk'),
    path.join(HOME, 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Minecraft Launcher.lnk'),
    path.join('C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Minecraft Launcher.lnk'),
  ];
  for (const lnk of lnkCandidates) {
    try { if (fs.existsSync(lnk)) return lnk; } catch {}
  }

  // 1. Variáveis de ambiente do Windows (C: padrão)
  const envRoots = [
    process.env['PROGRAMFILES']      || '',
    process.env['PROGRAMFILES(X86)'] || '',
    process.env['LOCALAPPDATA']      || '',
  ];
  for (const root of envRoots) {
    try {
      const p = path.join(root, 'Minecraft Launcher', 'Content', 'Minecraft.exe');
      if (p && fs.existsSync(p)) return p;
    } catch {}
  }

  // 2. Varre drives
  for (const d of DRIVES) {
    for (const sub of MC_SUBS) {
      try {
        const p = `${d}:\\${sub}`;
        if (fs.existsSync(p)) return p;
      } catch {}
    }
  }
  return null;
}

/**
 * Ponto de entrada principal — tenta as 3 estratégias em ordem de velocidade.
 * Síncrono para compatibilidade com o código existente.
 */
function findMinecraftExe() {
  return findExeFromAppPaths()
      || findExeFromUninstallKey()
      || findExeFromDriveScan()
      || null;
}

function findSKLauncher() {
  return SK_CANDIDATES.find(fs.existsSync) || null;
}

// ─── Launchers ────────────────────────────────────────────────────────────────
const LAUNCHERS = [
  {
    id: 'vanilla',
    name: 'Minecraft Launcher',
    subtitle: 'Original (Mojang)',
    emoji: '🟢',
    getInstanceRoot: (packName) => path.join(MC_DIR, 'modpacks', packName || 'CobbleSaS'),
    getModsFolder:   (packName) => path.join(MC_DIR, 'modpacks', packName || 'CobbleSaS', 'mods'),
    needsFabric: true,

    launch(_mcVer, _loaderVer, _sk, mcExePath) {
      return new Promise((resolve, reject) => {
        const exePath = mcExePath || findMinecraftExe();

        if (!exePath) {
          reject(new Error(
            'Minecraft Launcher não encontrado.\n\n' +
            'Clique em "⚙ Trocar" → "📂 Procurar" e selecione\n' +
            'o Minecraft.exe ou o atalho "Minecraft Launcher.lnk".'
          ));
          return;
        }

        console.log(`[Launcher] Abrindo: ${exePath}`);
        shell.openPath(exePath).then((errStr) => {
          if (errStr) {
            // Fallback: spawn direto (para .exe) caso o shell.openPath falhe
            try {
              const { spawn } = require('child_process');
              const child = spawn(exePath, [], { detached: true, stdio: 'ignore' });
              child.unref();
            } catch (e) {
              reject(new Error(`Erro ao abrir o Minecraft Launcher:\n${errStr}\n${e.message}`));
              return;
            }
          }
          resolve();
        }).catch((e) => {
          reject(new Error(`Erro crítico ao abrir:\n${e.message}`));
        });
      });
    },
  },

  {
    id: 'sklauncher',
    name: 'SKLauncher',
    subtitle: 'Pirata',
    emoji: '☠️',
    getInstanceRoot: (packName) => path.join(MC_DIR, 'modpacks', packName || 'CobbleSaS'),
    getModsFolder:   (packName) => path.join(MC_DIR, 'modpacks', packName || 'CobbleSaS', 'mods'),
    needsFabric: true,

    launch(_mcVer, _loaderVer, skJarPath) {
      return new Promise((resolve, reject) => {
        const jarPath = skJarPath || findSKLauncher();
        if (!jarPath) {
          reject(new Error(
            'SKLauncher.jar não encontrado.\n' +
            'Clique em "⚙ Trocar" e informe o caminho do SKLauncher.jar.'
          ));
          return;
        }
        console.log(`[Launcher] Abrindo SKLauncher: ${jarPath}`);
        exec(`start "" javaw -jar "${jarPath}"`, (err) => {
          if (err) exec(`java -jar "${jarPath}"`);
          resolve();
        });
      });
    },
  },
];

function getLauncherById(id) {
  return LAUNCHERS.find((l) => l.id === id) || null;
}

module.exports = { LAUNCHERS, getLauncherById, findSKLauncher, findMinecraftExe, MC_DIR };
