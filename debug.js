const Store = require('electron-store');
const updater = require('./src/updater');
const fs = require('fs');

async function test() {
  const store = new Store();
  console.log("Install path:", store.get('install_path'));
  console.log("Modpack version:", store.get('modpack_version'));
  console.log("Installed mods:", store.get('installed_mods', []));
  
  const res = await updater.checkForUpdate(store);
  console.log("Action state:", res.action_state);
}

test();
