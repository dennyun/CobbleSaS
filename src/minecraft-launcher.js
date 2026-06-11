const { exec, spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

/**
 * Retorna o caminho da pasta .minecraft de acordo com o SO.
 */
function getMinecraftFolder() {
  const home = os.homedir();
  if (process.platform === 'win32') return path.join(home, 'AppData', 'Roaming', '.minecraft');
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'minecraft');
  return path.join(home, '.minecraft');
}

/**
 * Retorna o caminho da pasta de mods.
 */
function getModsFolder() {
  return path.join(getMinecraftFolder(), 'mods');
}

/**
 * Tenta abrir o Minecraft usando o launcher oficial.
 * O launcher oficial do Minecraft tem suporte CLI via protocolo minecraft://
 * Alternativamente abre o launcher diretamente.
 */
async function launch(mcVersion, loaderVersion) {
  const profileId = `fabric-loader-${loaderVersion}-${mcVersion}`;

  return new Promise((resolve, reject) => {
    let command;

    if (process.platform === 'win32') {
      // Windows: Abre o launcher do Minecraft e seleciona o perfil via URL
      command = `start "" "minecraft://run/${profileId}"`;
    } else if (process.platform === 'darwin') {
      command = `open "minecraft://run/${profileId}"`;
    } else {
      // Linux: Tenta abrir via xdg-open
      command = `xdg-open "minecraft://run/${profileId}"`;
    }

    exec(command, (err) => {
      if (err) {
        // Fallback: tenta abrir o launcher diretamente
        launchFallback(resolve, reject);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Fallback: abre o launcher do Minecraft diretamente.
 */
function launchFallback(resolve, reject) {
  let launcherPath;

  if (process.platform === 'win32') {
    // Caminhos comuns do Minecraft Launcher no Windows
    const candidates = [
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Minecraft Launcher', 'MinecraftLauncher.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Minecraft Launcher', 'MinecraftLauncher.exe'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Minecraft Launcher', 'Minecraft Launcher.lnk'),
    ];

    launcherPath = candidates.find((p) => fs.existsSync(p));

    if (launcherPath) {
      spawn('cmd', ['/c', 'start', '', launcherPath], { detached: true, shell: true });
      resolve();
    } else {
      reject(new Error('Launcher do Minecraft não encontrado. Por favor, abra o Minecraft Launcher manualmente.'));
    }
  } else if (process.platform === 'darwin') {
    exec('open -a "Minecraft"', (err) => {
      err ? reject(new Error('Minecraft não encontrado no Mac. Abra manualmente.')) : resolve();
    });
  } else {
    exec('minecraft-launcher || flatpak run com.mojang.Minecraft', (err) => {
      err ? reject(new Error('Minecraft não encontrado. Abra manualmente.')) : resolve();
    });
  }
}

module.exports = { launch, getMinecraftFolder, getModsFolder };
