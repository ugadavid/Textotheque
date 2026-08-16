const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const {
    DEV_PROFILE_NAME,
    STABLE_PROFILE_NAME,
    resolveRendererTarget,
    resolveRuntimeProfile,
  } = await import('../dist-electron/runtime-profile.js');

  const appData = path.join('C:', 'Users', 'Test', 'AppData', 'Roaming');
  const dev = resolveRuntimeProfile(appData, false);
  const stable = resolveRuntimeProfile(appData, true);

  assert.equal(DEV_PROFILE_NAME, 'Textotheque-Dev');
  assert.equal(STABLE_PROFILE_NAME, 'Textotheque');
  assert.equal(dev.displayName, 'Textotheque DEV');
  assert.equal(dev.profileName, 'Textotheque-Dev');
  assert.equal(stable.displayName, 'Textotheque');
  assert.equal(stable.profileName, 'Textotheque');
  assert.notEqual(path.normalize(dev.userDataPath), path.normalize(stable.userDataPath));
  assert.equal(path.normalize(dev.defaultDatabasePath), path.normalize(path.join(appData, 'Textotheque-Dev', 'textotheque.sqlite')));
  assert.equal(path.normalize(stable.defaultDatabasePath), path.normalize(path.join(appData, 'Textotheque', 'textotheque.sqlite')));
  assert.equal(path.normalize(dev.defaultLibraryHistoryPath), path.normalize(path.join(appData, 'Textotheque-Dev', 'library-history.json')));
  assert.equal(path.normalize(stable.defaultLibraryHistoryPath), path.normalize(path.join(appData, 'Textotheque', 'library-history.json')));

  const devRenderer = resolveRendererTarget(false, path.join('C:', 'project', 'dist-electron'));
  const stableRenderer = resolveRendererTarget(true, path.join('C:', 'package', 'resources', 'app.asar', 'dist-electron'));
  assert.deepEqual(devRenderer, { kind: 'url', value: 'http://localhost:5173' });
  assert.equal(stableRenderer.kind, 'file');
  assert.equal(path.basename(stableRenderer.value), 'index.html');
  assert.equal(stableRenderer.value.includes('localhost'), false);

  console.log('runtime profiles ok: DEV isolated, STABLE historical, packaged renderer file-only');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
