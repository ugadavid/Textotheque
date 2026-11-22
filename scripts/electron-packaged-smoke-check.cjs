const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const asar = require('@electron/asar');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

const projectRoot = path.resolve(__dirname, '..');
const packageDirectory = path.join(projectRoot, 'out', `Textotheque-win32-${process.arch}`);
const executablePath = path.join(packageDirectory, 'Textotheque.exe');
const resourcesPath = path.join(packageDirectory, 'resources');

assert(fs.existsSync(executablePath), `Executable package introuvable: ${executablePath}`);
assert(fs.existsSync(path.join(resourcesPath, 'app.asar')), 'Archive app.asar absente.');
assert(fs.existsSync(path.join(resourcesPath, 'app.asar.unpacked')), 'Ressources natives ASAR non depaquetees.');
assert(!fs.existsSync(path.join(resourcesPath, 'app', 'src')), 'Les sources renderer ne doivent pas etre distribuees.');
const packagedFiles = asar.listPackage(path.join(resourcesPath, 'app.asar'));
for (const forbidden of [/^\\src(?:\\|$)/, /^\\reports(?:\\|$)/, /^\\scripts(?:\\|$)/, /\.sqlite$/i, /library-history\.json$/i]) {
  assert(!packagedFiles.some((entry) => forbidden.test(entry)), `Contenu interdit dans app.asar: ${forbidden}`);
}
for (const entry of packagedFiles.filter((item) => /\.(?:js|cjs|json|html|css)$/.test(item))) {
  const contents = asar.extractFile(path.join(resourcesPath, 'app.asar'), entry.slice(1)).toString('utf8');
  assert(!contents.includes('J:\\2026\\Textotheque'), `Chemin absolu du depot dans le package: ${entry}`);
  assert(!contents.includes('localhost:5173'), `URL Vite litterale dans le package: ${entry}`);
}

const tempDirectory = createTestTempDirectory('packaged-smoke');
const userDataPath = path.join(tempDirectory, 'Textotheque-Stable-Test');
const databasePath = path.join(userDataPath, 'textotheque.sqlite');
const historyPath = path.join(userDataPath, 'library-history.json');
const reportPath = path.join(tempDirectory, 'packaged-smoke-report.json');

try {
  const env = {
    ...process.env,
    TEXTOTHEQUE_TEST_USER_DATA_PATH: userDataPath,
    TEXTOTHEQUE_DB_PATH: databasePath,
    TEXTOTHEQUE_LIBRARY_HISTORY_PATH: historyPath,
    TEXTOTHEQUE_PACKAGED_SMOKE_REPORT: reportPath,
  };
  const result = spawnSync(executablePath, ['--textotheque-check-packaged-smoke'], {
    cwd: packageDirectory,
    env,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Le smoke test package a echoue (${result.status}).\n${result.stdout}\n${result.stderr}`);
  }
  assert(fs.existsSync(reportPath), `Rapport du smoke test absent.\n${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.packaged, true);
  assert.equal(report.name, 'Textotheque');
  assert.equal(report.version, require('../package.json').version);
  assert.equal(report.protocol, 'file:');
  assert.equal(report.preload, true);
  assert.equal(report.schemaVersion, 5);
  assert.equal(report.autosave, true);
  assert.equal(report.search, true);
  assert.equal(report.todo, true);
  assert.equal(report.savedSearch, true);
  assert.equal(path.normalize(report.userData), path.normalize(userDataPath));
  assert.equal(path.normalize(report.database), path.normalize(databasePath));
  assert(!report.href.includes('localhost:5173'), 'Le renderer package depend encore du serveur Vite.');
  assert.deepEqual(report.renderer.kind, 'file');
  console.log(`packaged smoke ok: ${report.name} ${report.version}, renderer=${report.protocol}, schema=${report.schemaVersion}`);
  console.log(`packaged smoke temporary profile: ${userDataPath}`);
} finally {
  removeTestTempDirectory(tempDirectory);
}
