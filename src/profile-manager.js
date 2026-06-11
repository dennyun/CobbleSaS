/**
 * Cria ou atualiza um perfil no launcher_profiles.json do .minecraft
 * Tanto o Minecraft Launcher original quanto o SKLauncher leem este arquivo.
 *
 * IMPORTANTE: Usa sempre a chave fixa derivada do packName para garantir que
 * nunca seja criado um segundo perfil em atualizações subsequentes.
 */
const fs   = require('fs');
const path = require('path');

/**
 * @param {string} mcDir      - Caminho do .minecraft
 * @param {string} packName   - Nome do modpack (ex: "CobbleSaS")
 * @param {string} versionId  - ID da versão Fabric (ex: "fabric-loader-0.19.2-1.21.1")
 * @param {string} gameDir    - Pasta raiz da instância (.minecraft\modpacks\CobbleSaS)
 * @returns {string}          - Chave do perfil (sempre a mesma para o mesmo packName)
 */
function createOrUpdateProfile(mcDir, packName, versionId, gameDir) {
  const profilesPath = path.join(mcDir, 'launcher_profiles.json');

  // Chave FIXA derivada do nome — nunca muda entre atualizações
  const profileKey = packName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Lê o arquivo existente ou cria estrutura base
  let data = { profiles: {}, settings: {}, version: 3 };
  if (fs.existsSync(profilesPath)) {
    try {
      const raw = fs.readFileSync(profilesPath, 'utf8');
      data = JSON.parse(raw);
      if (!data.profiles) data.profiles = {};
    } catch (e) {
      console.warn('[ProfileManager] Falha ao ler launcher_profiles.json:', e.message);
      data = { profiles: {}, settings: {}, version: 3 };
    }
  }

  const now = new Date().toISOString();

  // Mantém a data de criação original — só atualiza campos que mudam
  const existing = data.profiles[profileKey] || {};

  // Remove qualquer perfil duplicado com nome igual mas chave diferente
  for (const [key, prof] of Object.entries(data.profiles)) {
    if (key !== profileKey && prof.name === packName) {
      console.log(`[ProfileManager] Removendo perfil duplicado com chave "${key}"`);
      delete data.profiles[key];
    }
  }

  data.profiles[profileKey] = {
    created:       existing.created || now,
    gameDir:       gameDir,
    icon:          existing.icon || 'Creeper_Head',
    lastUsed:      now,
    lastVersionId: versionId,
    name:          packName,
    type:          'custom',
  };

  try {
    fs.writeFileSync(profilesPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[ProfileManager] Perfil "${packName}" (chave: ${profileKey}) salvo/atualizado.`);
  } catch (e) {
    console.error('[ProfileManager] Erro ao escrever launcher_profiles.json:', e.message);
  }

  return profileKey;
}

module.exports = { createOrUpdateProfile };
