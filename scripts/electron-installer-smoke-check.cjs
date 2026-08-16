const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

const projectRoot = path.resolve(__dirname, '..');
const setupPath = path.join(projectRoot, 'out', 'make', 'squirrel.windows', process.arch, 'Textotheque Setup.exe');
assert(fs.existsSync(setupPath), `Installateur introuvable: ${setupPath}`);

const tempDirectory = createTestTempDirectory('installer-smoke');
const stableTestProfile = path.join(tempDirectory, 'Textotheque-Stable-Test');
const reportPath = path.join(tempDirectory, 'installed-smoke-report.json');
const installRoot = path.join(process.env.LOCALAPPDATA, 'Textotheque');
const installedExecutable = path.join(installRoot, 'Textotheque.exe');
const shortcutPath = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'David', 'Textotheque.lnk');

function run(file, args, env, timeout = 30000) {
  const result = spawnSync(file, args, { cwd: tempDirectory, env, encoding: 'utf8', windowsHide: true, timeout });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(file)} a echoue (${result.status}).\n${result.stdout}\n${result.stderr}`);
  return result;
}

try {
  assert(fs.existsSync(installedExecutable), `Executable installe introuvable: ${installedExecutable}`);
  assert(fs.existsSync(shortcutPath), `Raccourci menu Demarrer absent: ${shortcutPath}`);

  const smokeEnv = {
    ...process.env,
    TEXTOTHEQUE_TEST_USER_DATA_PATH: stableTestProfile,
    TEXTOTHEQUE_DB_PATH: path.join(stableTestProfile, 'textotheque.sqlite'),
    TEXTOTHEQUE_LIBRARY_HISTORY_PATH: path.join(stableTestProfile, 'library-history.json'),
    TEXTOTHEQUE_PACKAGED_SMOKE_REPORT: reportPath,
  };
  run(installedExecutable, ['--textotheque-check-packaged-smoke'], smokeEnv, 30000);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.packaged, true);
  assert.equal(report.version, '0.1.28');
  assert.equal(report.protocol, 'file:');
  assert.equal(report.autosave && report.search && report.todo && report.savedSearch, true);
  assert(!report.href.includes('localhost:5173'));
  console.log(`installer smoke ok: version=${report.version}, shortcut=${shortcutPath}, renderer=${report.protocol}`);
} finally {
  removeTestTempDirectory(tempDirectory);
}
