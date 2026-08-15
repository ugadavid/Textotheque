const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TEMP_DIRECTORY_PREFIX = 'textotheque-test-';

function createTestTempDirectory(label) {
  if (!/^[a-z0-9-]+$/.test(label)) {
    throw new Error(`Libelle de ressource temporaire invalide: ${label}`);
  }

  return fs.mkdtempSync(path.join(os.tmpdir(), `${TEMP_DIRECTORY_PREFIX}${label}-`));
}

function removeTestTempDirectory(tempDirectory) {
  const resolvedTempDirectory = path.resolve(tempDirectory);
  const resolvedSystemTemp = path.resolve(os.tmpdir());
  const directoryName = path.basename(resolvedTempDirectory);

  if (
    path.dirname(resolvedTempDirectory) !== resolvedSystemTemp ||
    !directoryName.startsWith(TEMP_DIRECTORY_PREFIX)
  ) {
    throw new Error(`Refus de nettoyer un chemin temporaire non controle: ${resolvedTempDirectory}`);
  }

  fs.rmSync(resolvedTempDirectory, {
    recursive: true,
    force: true,
    maxRetries: 2,
    retryDelay: 50,
  });

  if (fs.existsSync(resolvedTempDirectory)) {
    throw new Error(`Le repertoire temporaire existe encore apres nettoyage: ${resolvedTempDirectory}`);
  }
}

module.exports = {
  createTestTempDirectory,
  removeTestTempDirectory,
};
