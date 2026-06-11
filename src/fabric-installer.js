const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const crypto = require('crypto');
const Store = require('electron-store');

// API oficial do Fabric para buscar a versão mais recente do installer
const FABRIC_META_INSTALLER = 'https://meta.fabricmc.net/v2/versions/installer';

/**
 * Retorna o comando Java disponível no sistema.
 */
function findJava() {
  const store = new Store();
  const javaPath = store.get('javaPath');
  if (javaPath && fs.existsSync(javaPath)) {
    return javaPath;
  }
  return process.platform === 'win32' ? 'java.exe' : 'java';
}

/**
 * Retorna o caminho da pasta raiz do novo Standalone Launcher.
 */
function getMinecraftFolder() {
  const store = new Store();
  const defaultPath = os.platform() === 'win32' 
    ? path.join(os.homedir(), 'AppData', 'Roaming', '.cobblesas')
    : path.join(os.homedir(), '.cobblesas');
  return store.get('install_path', defaultPath);
}

/**
 * Busca a versão estável mais recente do Fabric Installer via API oficial.
 */
async function getLatestInstallerVersion() {
  const response = await axios.get(FABRIC_META_INSTALLER, { timeout: 10000 });
  const stable = response.data.find((v) => v.stable === true);
  const version = stable ? stable.version : response.data[0].version;
  const url = stable ? stable.url : response.data[0].url;
  return { version, url };
}

/**
 * Verifica se o perfil Fabric já está instalado para a versão especificada.
 */
function isFabricInstalled(mcVersion, loaderVersion) {
  const mcFolder = getMinecraftFolder();
  const profileId = `fabric-loader-${loaderVersion}-${mcVersion}`;
  const jsonPath = path.join(mcFolder, 'versions', profileId, `${profileId}.json`);
  return fs.existsSync(jsonPath);
}

/**
 * Baixa e executa o Fabric Installer.
 * Instala o perfil Fabric para a versão do Minecraft especificada.
 */
async function ensureFabric(mcVersion, loaderVersion, _installerVersion, onStatus) {
  // Garantir valores válidos e blindar contra injeção de argumentos (só permite letras, números, pontos e traços)
  const safeMcVersion     = (mcVersion     && mcVersion     !== 'undefined') ? String(mcVersion).replace(/[^a-zA-Z0-9.-]/g, '')     : '1.21.1';
  const safeLoaderVersion = (loaderVersion && loaderVersion !== 'undefined') ? String(loaderVersion).replace(/[^a-zA-Z0-9.-]/g, '') : '0.16.9';

  if (isFabricInstalled(safeMcVersion, safeLoaderVersion)) {
    onStatus('✅ Fabric já está instalado!');
    return;
  }

  onStatus('🔍 Buscando Fabric Installer...');

  // Busca a URL real do installer mais recente da API oficial
  let installerUrl, installerVersion;
  try {
    const info = await getLatestInstallerVersion();
    installerVersion = info.version;
    installerUrl     = info.url;
  } catch (err) {
    throw new Error('Não foi possível conectar ao servidor do Fabric. Verifique sua conexão com a internet.');
  }

  onStatus(`⬇️ Baixando Fabric Installer v${installerVersion}...`);

  const mcFolderForTemp = getMinecraftFolder();
  if (!fs.existsSync(mcFolderForTemp)) fs.mkdirSync(mcFolderForTemp, { recursive: true });
  const tmpJar = path.join(mcFolderForTemp, `fabric-installer-${crypto.randomUUID()}.jar`);

  // Baixar o installer
  const response = await axios.get(installerUrl, {
    responseType: 'arraybuffer',
    timeout: 60000,
  });

  fs.writeFileSync(tmpJar, response.data);

  onStatus(`🔧 Instalando Fabric ${safeLoaderVersion} para MC ${safeMcVersion}...`);

  try {
    // Executar o installer — argumentos válidos do Fabric Installer CLI
    await new Promise((resolve, reject) => {
      const mcFolder = getMinecraftFolder();
      
      // CORREÇÃO: O Fabric Installer falha (Could not find a valid launcher profile .json)
      // se o arquivo não existir, pois estamos usando uma pasta isolada (.cobblesas)
      const profilesPath = path.join(mcFolder, 'launcher_profiles.json');
      if (!fs.existsSync(profilesPath)) {
        fs.writeFileSync(profilesPath, JSON.stringify({ profiles: {} }, null, 2));
      }

      const args = [
        '-jar', tmpJar,
        'client',
        '-mcversion', safeMcVersion,
        '-loader',    safeLoaderVersion,
        '-dir',       mcFolder,    // pasta .minecraft onde o perfil será criado
      ];

      const proc = execFile(findJava(), args, { timeout: 120000 });

      let stderr = '';
      if (proc.stderr) proc.stderr.on('data', (d) => { stderr += d; });

      proc.on('exit', (code) => {
        if (code === 0) {
          onStatus('✅ Fabric instalado com sucesso!');
          resolve();
        } else {
          reject(new Error(
            `Fabric installer falhou (código ${code}).\n` +
            (stderr ? stderr.slice(0, 300) : 'Verifique se o Java 21 está instalado.')
          ));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(
          `Não foi possível executar o Java.\n` +
          `Instale o Java 21 em: https://adoptium.net/\n\nErro: ${err.message}`
        ));
      });
    });
  } finally {
    // Limpar arquivo temporário de forma garantida
    try { fs.unlinkSync(tmpJar); } catch (_) {}
  }
}

module.exports = { ensureFabric, isFabricInstalled };
