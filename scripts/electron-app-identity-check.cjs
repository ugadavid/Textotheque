const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const electronPath = require('electron');
const { productName } = require('../package.json');

const projectRoot = path.resolve(__dirname, '..');
const mainPath = path.join(projectRoot, 'dist-electron', 'main.js');
const outputPrefix = 'textotheque app identity: ';

function inspectIdentity(dbPathOverride) {
  const env = { ...process.env };
  if (dbPathOverride === undefined) {
    delete env.TEXTOTHEQUE_DB_PATH;
  } else {
    env.TEXTOTHEQUE_DB_PATH = dbPathOverride;
  }

  const result = spawnSync(electronPath, [mainPath, '--textotheque-check-app-identity'], {
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

const defaultIdentity = inspectIdentity(undefined);
const expectedUserData = path.join(defaultIdentity.appData, productName);
const expectedDatabase = path.join(expectedUserData, 'textotheque.sqlite');

assert.equal(defaultIdentity.name, productName);
assert.equal(path.normalize(defaultIdentity.userData), path.normalize(expectedUserData));
assert.notEqual(path.basename(defaultIdentity.userData).toLowerCase(), 'electron');
assert.equal(path.normalize(defaultIdentity.sessionData), path.normalize(expectedUserData));
assert.equal(path.normalize(defaultIdentity.database), path.normalize(expectedDatabase));

const overriddenDatabase = path.join(defaultIdentity.appData, 'Textotheque-test', 'override.sqlite');
const overriddenIdentity = inspectIdentity(overriddenDatabase);
assert.equal(path.normalize(overriddenIdentity.database), path.normalize(overriddenDatabase));
assert.equal(path.normalize(overriddenIdentity.userData), path.normalize(expectedUserData));

console.log(
  `app identity ok: ${defaultIdentity.name}, userData=${defaultIdentity.userData}, database=${defaultIdentity.database}`
);
