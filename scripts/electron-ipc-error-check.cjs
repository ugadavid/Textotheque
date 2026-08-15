const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const electronPath = require('electron');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

const projectRoot = path.resolve(__dirname, '..');
const mainPath = path.join(projectRoot, 'dist-electron', 'main.js');
const invalidDatabasePath = createTestTempDirectory('ipc-error');
const outputPrefix = 'textotheque ipc error check: ';

try {
  const result = spawnSync(electronPath, [mainPath, '--textotheque-check-ipc-error'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      TEXTOTHEQUE_DB_PATH: invalidDatabasePath,
      TEXTOTHEQUE_LIBRARY_HISTORY_PATH: path.join(invalidDatabasePath, 'library-history.json'),
    },
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.status !== 0) {
    throw new Error(`Le test d'erreur IPC a echoue (${result.status}).\n${result.stdout}\n${result.stderr}`);
  }

  const outputLine = result.stdout
    .split(/\r?\n/)
    .find((line) => line.startsWith(outputPrefix));
  if (!outputLine) {
    throw new Error(`Sortie du test d'erreur IPC introuvable.\n${result.stdout}\n${result.stderr}`);
  }

  const rendererResult = JSON.parse(outputLine.slice(outputPrefix.length));
  assert.equal(rendererResult.rejected, true);
  assert.match(rendererResult.message, /documents:list/);
  assert.doesNotMatch(rendererResult.message, /SQLITE_|textotheque-ipc-error-|[A-Z]:\\/i);
  assert.match(result.stderr, /\[IPC documents:list\]/);
  assert.match(result.stderr, /SQLITE_|Cannot open database/i);

  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  assert.doesNotMatch(combinedOutput, /UnhandledPromiseRejection|Unhandled Promise Rejection|uncaught \(in promise\)/i);

  console.log('ipc error propagation ok: documents:list rejection caught by renderer');
} finally {
  removeTestTempDirectory(invalidDatabasePath);
}

console.log(`ipc error temporary resources cleaned: ${invalidDatabasePath}`);
