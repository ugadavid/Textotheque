const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const electronPath = require('electron');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

const root = path.resolve(__dirname, '..');
const stableExecutable = path.join(root, 'out', `Textotheque-win32-${process.arch}`, 'Textotheque.exe');
const viteEntry = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const mainEntry = path.join(root, 'dist-electron', 'main.js');
assert(fs.existsSync(stableExecutable), 'Le package Textotheque STABLE est requis pour ce test.');

const tempDirectory = createTestTempDirectory('concurrent-runtime');
const stable = paths('stable');
const dev = paths('dev');
let vite;
let stableProcess;
let devProcess;

function paths(label) {
  const profile = path.join(tempDirectory, label, label === 'stable' ? 'Textotheque' : 'Textotheque-Dev');
  return {
    profile,
    database: path.join(profile, 'textotheque.sqlite'),
    history: path.join(profile, 'library-history.json'),
    report: path.join(tempDirectory, `${label}-report.json`),
    release: path.join(tempDirectory, `${label}-release`),
  };
}

function envFor(target) {
  return {
    ...process.env,
    TEXTOTHEQUE_TEST_USER_DATA_PATH: target.profile,
    TEXTOTHEQUE_DB_PATH: target.database,
    TEXTOTHEQUE_LIBRARY_HISTORY_PATH: target.history,
    TEXTOTHEQUE_CONCURRENT_REPORT: target.report,
    TEXTOTHEQUE_CONCURRENT_RELEASE: target.release,
  };
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function waitFor(predicate, label, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await predicate()) return;
    await wait(100);
  }
  throw new Error(`Timeout: ${label}`);
}

(async () => {
  try {
    vite = spawn(process.execPath, [viteEntry, '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore', windowsHide: true });
    await waitFor(async () => {
      try { return (await fetch('http://127.0.0.1:5173')).ok; } catch { return false; }
    }, 'Vite 5173');

    stableProcess = spawn(stableExecutable, ['--textotheque-check-concurrent-runtime'], {
      cwd: tempDirectory, env: envFor(stable), stdio: 'ignore', windowsHide: true,
    });
    devProcess = spawn(electronPath, [mainEntry, '--textotheque-check-concurrent-runtime'], {
      cwd: root, env: envFor(dev), stdio: 'ignore', windowsHide: true,
    });
    await waitFor(() => fs.existsSync(stable.report) && fs.existsSync(dev.report), 'rapports des deux runtimes');
    assert.equal(stableProcess.exitCode, null, 'STABLE s est fermee avant la verification simultanee.');
    assert.equal(devProcess.exitCode, null, 'DEV s est fermee avant la verification simultanee.');
    const stableReport = JSON.parse(fs.readFileSync(stable.report, 'utf8'));
    const devReport = JSON.parse(fs.readFileSync(dev.report, 'utf8'));
    assert.equal(stableReport.packaged, true);
    assert.equal(stableReport.name, 'Textotheque');
    assert.equal(stableReport.protocol, 'file:');
    assert.equal(devReport.packaged, false);
    assert.equal(devReport.name, 'Textotheque DEV');
    assert(devReport.href.startsWith('http://localhost:5173'));
    for (const field of ['userData', 'sessionData', 'database', 'history']) {
      assert.notEqual(path.normalize(stableReport[field]), path.normalize(devReport[field]), `${field} est partage.`);
    }
    assert(stableReport.preload && devReport.preload);
    assert(fs.existsSync(stable.database) && fs.existsSync(dev.database));
    console.log(`concurrent runtimes ok: STABLE pid=${stableProcess.pid}, DEV pid=${devProcess.pid}, profiles distincts`);
    fs.writeFileSync(stable.release, 'ok');
    fs.writeFileSync(dev.release, 'ok');
    await Promise.all([
      new Promise((resolve) => stableProcess.once('exit', resolve)),
      new Promise((resolve) => devProcess.once('exit', resolve)),
    ]);
  } finally {
    if (stableProcess?.exitCode === null) stableProcess.kill();
    if (devProcess?.exitCode === null) devProcess.kill();
    if (vite?.exitCode === null) vite.kill();
    await wait(500);
    removeTestTempDirectory(tempDirectory);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
