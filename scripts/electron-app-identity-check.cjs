const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const electronPath = require('electron');
const { productName } = require('../package.json');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

const projectRoot = path.resolve(__dirname, '..');
const outputPrefix = 'textotheque app identity: ';

const tempDirectory = createTestTempDirectory('app-identity');
const testUserData = path.join(tempDirectory, 'Textotheque-Dev-Test');

function inspectIdentity(dbPathOverride) {
  const env = { ...process.env };
  env.TEXTOTHEQUE_TEST_USER_DATA_PATH = testUserData;
  if (dbPathOverride === undefined) {
    delete env.TEXTOTHEQUE_DB_PATH;
  } else {
    env.TEXTOTHEQUE_DB_PATH = dbPathOverride;
  }

  const result = spawnSync(electronPath, [projectRoot, '--textotheque-check-app-identity'], {
    cwd: projectRoot,
    env,
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.status !== 0) {
    throw new Error(`Le diagnostic d'identite Electron a echoue (${result.status}).\n${result.stderr}`);
  }

  const outputLine = result.stdout
    .split(/\r?\n/)
    .find((line) => line.startsWith(outputPrefix));
  if (!outputLine) {
    throw new Error(`Sortie d'identite Electron introuvable.\n${result.stdout}\n${result.stderr}`);
  }

  return JSON.parse(outputLine.slice(outputPrefix.length));
}

try {
  const defaultIdentity = inspectIdentity(undefined);
  const expectedDefaultUserData = path.join(defaultIdentity.appData, `${productName}-Dev`);
  const expectedDatabase = path.join(testUserData, 'textotheque.sqlite');

  assert.equal(defaultIdentity.name, `${productName} DEV`);
  assert.equal(defaultIdentity.displayName, `${productName} DEV`);
  assert.equal(defaultIdentity.profileName, `${productName}-Dev`);
  assert.equal(defaultIdentity.packaged, false);
  assert.equal(path.normalize(defaultIdentity.defaultUserData), path.normalize(expectedDefaultUserData));
  assert.equal(path.normalize(defaultIdentity.userData), path.normalize(testUserData));
  assert.equal(path.normalize(defaultIdentity.sessionData), path.normalize(testUserData));
  assert.equal(path.normalize(defaultIdentity.database), path.normalize(expectedDatabase));
  assert.equal(path.normalize(defaultIdentity.libraryHistory), path.normalize(path.join(testUserData, 'library-history.json')));
  assert.deepEqual(defaultIdentity.renderer, { kind: 'url', value: 'http://localhost:5173' });

  const overriddenDatabase = path.join(tempDirectory, 'override.sqlite');
  const overriddenIdentity = inspectIdentity(overriddenDatabase);
  assert.equal(path.normalize(overriddenIdentity.database), path.normalize(overriddenDatabase));
  assert.equal(path.normalize(overriddenIdentity.userData), path.normalize(testUserData));

  console.log(
    `app identity ok: ${defaultIdentity.name}, userData=${defaultIdentity.userData}, database=${defaultIdentity.database}`
  );
} finally {
  removeTestTempDirectory(tempDirectory);
}
