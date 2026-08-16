const fs = require('node:fs');
const path = require('node:path');

const runtimeRoots = ['/dist', '/dist-electron', '/node_modules'];

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'Textotheque',
    ignore: (filePath) => {
      const normalized = filePath.replace(/\\/g, '/');
      if (normalized === '' || normalized === '/package.json') return false;
      if (normalized.endsWith('.d.ts') || normalized.endsWith('.d.cts')) return true;
      if (normalized === '/dist-electron/preload.js') return true;
      return !runtimeRoots.some((root) => normalized === root || normalized.startsWith(`${root}/`));
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'Textotheque',
        authors: 'David',
        description: 'Application desktop locale d’écriture et de classement de textes',
        exe: 'Textotheque.exe',
        setupExe: 'Textotheque Setup.exe',
        noMsi: true,
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
  ],
  hooks: {
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      const packagePath = path.join(buildPath, 'package.json');
      const packageMetadata = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      delete packageMetadata.scripts;
      delete packageMetadata.devDependencies;
      fs.writeFileSync(packagePath, `${JSON.stringify(packageMetadata, null, 2)}\n`, 'utf8');
    },
  },
};
