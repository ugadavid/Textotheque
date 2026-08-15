const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');

function readInstalledPackageVersion(packageName) {
  let packagePath;
  try {
    packagePath = require.resolve(`${packageName}/package.json`, { paths: [projectRoot] });
  } catch {
    throw new Error(`Le paquet ${packageName} n est pas installe. Lancez npm install avant le rebuild.`);
  }

  const packageJson = require(packagePath);
  if (typeof packageJson.version !== 'string' || packageJson.version.trim() === '') {
    throw new Error(`La version installee de ${packageName} est introuvable.`);
  }
  return packageJson.version;
}

function rebuildBetterSqlite3() {
  const electronVersion = readInstalledPackageVersion('electron');
  const betterSqlite3Version = readInstalledPackageVersion('better-sqlite3');
  const npmExecPath = process.env.npm_execpath;

  if (!npmExecPath) {
    throw new Error('Le chemin de npm est introuvable. Lancez ce script avec npm run rebuild:electron.');
  }

  console.log(`Electron detecte : ${electronVersion}`);
  console.log(`Rebuild better-sqlite3 ${betterSqlite3Version} pour Electron ${electronVersion}`);

  const result = spawnSync(
    process.execPath,
    [
      npmExecPath,
      'rebuild',
      'better-sqlite3',
      '--runtime=electron',
      `--target=${electronVersion}`,
      '--disturl=https://electronjs.org/headers',
    ],
    {
      cwd: projectRoot,
      env: process.env,
      stdio: 'inherit',
    }
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
}

try {
  rebuildBetterSqlite3();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
