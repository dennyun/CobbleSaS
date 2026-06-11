const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const extractZip = require('extract-zip');
const Store = require('electron-store');

// URL do manifest no GitHub (raw content — não usar /blob/)
const MANIFEST_URL =
  'https://raw.githubusercontent.com/f4xizzz/cobblesas-modpack/main/manifest.json';

/**
 * Retorna o caminho da raiz da instalação do jogo.
 */
function getMinecraftFolder() {
  const store = new Store();
  const defaultPath = os.platform() === 'win32' 
    ? path.join(os.homedir(), 'AppData', 'Roaming', '.cobblesas')
    : path.join(os.homedir(), '.cobblesas');
  return store.get('install_path', defaultPath);
}

/**
 * Busca o manifest remoto e compara com a versão local salva.
 * Retorna { needsUpdate, manifest, localVersion }
 */
async function checkForUpdate(store) {
  // Cache-busting: força o Electron a não usar versão em cache do manifest
  const url = MANIFEST_URL + '?t=' + Date.now();
  let manifest;
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
    });
    manifest = response.data;
    
    // [SEC] Validação Estrita do Manifest (Evita crashes se o CDN entregar JSON corrompido)
    if (!manifest || typeof manifest !== 'object' || !manifest.version || !manifest.download_url) {
      throw new Error("Manifest inválido ou corrompido");
    }
  } catch (error) {
    console.error('[Updater] Erro ao buscar manifest:', error.message);
    // Em caso de falha de conexão, retorna o estado local como está para não impedir o offline
    const isFirstTime = store.get('modpack_version', '0.0.0') === '0.0.0';
    return {
      action_state: isFirstTime ? 'install' : 'play',
      reason: 'Modo Offline / Sem conexão',
      needsUpdate: false,
      manifest: { version: store.get('modpack_version', '0.0.0'), changelog: isFirstTime ? ['Instalação pendente... Necessário internet para baixar o jogo pela primeira vez!'] : [] },
      localVersion: store.get('modpack_version', '0.0.0')
    };
  }

  // Log de debug — aparece no terminal onde rodou "npm start"
  console.log('[Updater] Manifest carregado:', JSON.stringify(manifest, null, 2));

  let action_state = 'play'; // Padrão: tudo perfeito
  let reason = '';

  const installPath = getMinecraftFolder();
  const modsFolder = path.join(installPath, 'mods');

  // 1. A pasta base existe? Se não, é uma instalação limpa (primeira vez).
  if (!fs.existsSync(installPath)) {
    action_state = 'install';
    reason = 'Pasta base não existe';
  } else {
    // 2. O Motor do Jogo existe? (Verifica o arquivo JSON do Fabric)
    const engineJsonPath = path.join(
      installPath,
      'versions',
      `fabric-loader-${manifest.fabric_loader_version}-${manifest.minecraft_version}`,
      `fabric-loader-${manifest.fabric_loader_version}-${manifest.minecraft_version}.json`
    );
    
    let engineMissing = !fs.existsSync(engineJsonPath);
    let modsMissing = false;

    const officialMods = store.get('installed_mods', []);
    if (!fs.existsSync(modsFolder)) {
      modsMissing = true;
    } else {
      for (const modFile of officialMods) {
        if (!fs.existsSync(path.join(modsFolder, modFile))) {
          modsMissing = true;
          break;
        }
      }
    }

    const localVersion = store.get('modpack_version', '0.0.0');
    let isOutdated = localVersion !== manifest.version;

    if (localVersion === '0.0.0') {
      action_state = 'install';
      reason = 'Primeira instalação pendente';
    } else if (engineMissing || modsMissing || isOutdated) {
      action_state = 'update';
      
      if (engineMissing && modsMissing) {
        reason = 'Motor/Assets essenciais e Mods ausentes';
      } else if (engineMissing) {
        reason = 'Motor/Assets essenciais ausentes';
      } else if (modsMissing) {
        reason = 'Mods ausentes';
      } else if (isOutdated) {
        reason = `Versão desatualizada (Local: ${localVersion}, Nuvem: ${manifest.version})`;
      }
    }
  }

  const localVersion = store.get('modpack_version', '0.0.0');

  return {
    action_state,
    reason,
    needsUpdate: action_state !== 'play', // Mantém retrocompatibilidade leve
    manifest,
    localVersion,
  };
}

/**
 * Baixa o modpack.zip do GitHub e extrai para o diretório da instância.
 * @param {string} downloadUrl   - URL do modpack.zip
 * @param {string} version       - Versão nova
 * @param {object} store         - electron-store
 * @param {string} instanceRoot  - Pasta raiz da instância (onde ficam mods/, config/, etc.)
 * @param {string} modsFolder    - Pasta de mods (para limpar JARs antigos)
 * @param {function} onProgress  - Callback de progresso
 */
async function downloadAndInstall(downloadUrl, version, store, instanceRoot, modsFolder, onProgress) {
  const tmpZip = path.join(os.tmpdir(), `cobblemon-modpack-${version}.zip`);

  // Garantir que as pastas existem
  if (!fs.existsSync(instanceRoot)) fs.mkdirSync(instanceRoot, { recursive: true });
  if (!fs.existsSync(modsFolder))   fs.mkdirSync(modsFolder,   { recursive: true });

  // ─── Download ──────────────────────────────────────────────────────────────
  await new Promise((resolve, reject) => {
    let existingSize = 0;
    
    // Verifica se já existe um arquivo temporário e pega o tamanho dele
    if (fs.existsSync(tmpZip)) {
      try {
        existingSize = fs.statSync(tmpZip).size;
      } catch (e) {
        existingSize = 0;
      }
    }

    let downloaded = existingSize;
    let totalLength = 0;

    function doRequest(url, redirectCount, rangeStart) {
      if (redirectCount > 10) { reject(new Error('Muitos redirecionamentos')); return; }

      if (!url.startsWith('https://')) {
        reject(new Error('Segurança comprometida: URL de download não utiliza HTTPS.'));
        return;
      }

      const options = {
        headers: { 'User-Agent': 'cobblesas-launcher/1.0.0', 'Accept': 'application/octet-stream' },
        timeout: 300000,
      };

      // Se temos bytes baixados, pede pro servidor enviar o resto a partir desse ponto
      if (rangeStart > 0) {
        options.headers['Range'] = `bytes=${rangeStart}-`;
      }

      const protocol = https;
      protocol.get(url, options, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          // Em redirecionamentos, mantemos o rangeStart original
          doRequest(res.headers.location, redirectCount + 1, rangeStart);
          return;
        }

        let isResuming = false;
        
        if (res.statusCode === 206) {
          // Servidor aceitou continuar de onde parou!
          isResuming = true;
          totalLength = rangeStart + (parseInt(res.headers['content-length'], 10) || 0);
          downloaded = rangeStart;
        } else if (res.statusCode === 200) {
          // Servidor ignorou o Range ou o arquivo mudou, recomeça do 0
          isResuming = false;
          totalLength = parseInt(res.headers['content-length'], 10) || 0;
          downloaded = 0;
          rangeStart = 0; // reset
        } else {
          reject(new Error(`Falha no download: HTTP ${res.statusCode}\nURL: ${url}`));
          return;
        }

        // 'a' = append (continuar), 'w' = write (substituir)
        const fileFlags = isResuming ? 'a' : 'w';
        const writer = fs.createWriteStream(tmpZip, { flags: fileFlags });
        
        writer.on('error', (err) => {
          if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip);
          reject(new Error(`Erro de disco ao salvar: ${err.message}`));
        });

        res.on('data', (chunk) => {
          downloaded += chunk.length;
          const percent = totalLength > 0 ? Math.round((downloaded / totalLength) * 100) : -1;
          // Mostra na barra o progresso real grudado
          onProgress({ percent, downloaded, total: totalLength, phase: 'download' });
        });

        res.pipe(writer);
        writer.on('finish', resolve);
      }).on('error', (err) => {
        if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip);
        reject(new Error(`Erro de rede: ${err.message}`));
      });
    }

    doRequest(downloadUrl, 0, existingSize);
  });

  // ─── Limpar mods oficiais antigos (preservando mods extras do jogador) ─────
  onProgress({ percent: 0, phase: 'extract', message: 'Limpando mods antigos...' });
  if (fs.existsSync(modsFolder)) {
    const oldOfficialMods = store.get('installed_mods', []);
    for (const mod of oldOfficialMods) {
      const safeModName = path.basename(mod); // [SEC] Previne Path Traversal
      if (!safeModName) continue;
      const modPath = path.join(modsFolder, safeModName);
      if (fs.existsSync(modPath)) fs.unlinkSync(modPath);
    }
  }

  // ─── Extrair para a raiz da instância e mapear mods oficiais ──────────────
  onProgress({ percent: 50, phase: 'extract', message: 'Extraindo modpack...' });
  
  const officialModsList = [];
  try {
    await extractZip(tmpZip, { 
      dir: instanceRoot,
      onEntry: (entry) => {
        // Identifica os arquivos dentro da pasta mods/ do ZIP (mesmo se houver subpastas na raiz do zip)
        if (entry.fileName.includes('mods/') && entry.fileName.endsWith('.jar')) {
          const relativePath = entry.fileName.substring(entry.fileName.indexOf('mods/') + 5);
          if (relativePath) {
             officialModsList.push(relativePath);
          }
        }
      }
    });
  } catch (err) {
    // Se o arquivo ZIP estiver corrompido (ex: devido a queda de internet e o servidor mandar lixo), apaga o lixo!
    if (fs.existsSync(tmpZip)) {
      fs.unlinkSync(tmpZip);
    }
    throw new Error(`Arquivo corrompido detectado! O download foi limpo. Por favor, clique em Atualizar novamente para recomeçar o download do zero. (${err.message})`);
  }
  
  if (fs.existsSync(tmpZip)) {
    fs.unlinkSync(tmpZip);
  }

  // ─── Salvar configurações padrão do modpack (Para herança de novos perfis) ─
  const defaultProfileDir = path.join(instanceRoot, 'default_profile');
  if (!fs.existsSync(defaultProfileDir)) fs.mkdirSync(defaultProfileDir, { recursive: true });
  const syncFiles = ['options.txt', 'servers.dat', 'hotbar.nbt', 'optionsof.txt', 'optionsshaders.txt'];
  for (const file of syncFiles) {
    const rootFile = path.join(instanceRoot, file);
    if (fs.existsSync(rootFile)) fs.copyFileSync(rootFile, path.join(defaultProfileDir, file));
  }

  // Deletar last_player.txt para forçar o recarregamento do perfil do veterano na próxima execução
  const lastPlayerFile = path.join(instanceRoot, 'last_player.txt');
  if (fs.existsSync(lastPlayerFile)) fs.unlinkSync(lastPlayerFile);

  // ─── Salvar lista de mods instalados (IGNORANDO mods custom do jogador) ────
  store.set('installed_mods', officialModsList);
  store.set('modpack_version', version);

  // Não precisamos mais do profileManager porque nós mesmos somos o Launcher!

  onProgress({ percent: 100, phase: 'done', message: 'Modpack atualizado com sucesso!' });
}

module.exports = { checkForUpdate, downloadAndInstall, getMinecraftFolder };
