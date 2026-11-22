const fs = require('node:fs');
const path = require('node:path');
const windowsIcon = path.join(__dirname, 'assets', 'branding', 'textotheque.ico');

const runtimeRoots = ['/dist', '/dist-electron', '/node_modules'];
const mainOutputs = new Set(fs.readdirSync(path.join(__dirname, 'electron'))
  .filter(file => /\.(?:ts|cts)$/.test(file))
  .map(file => '/dist-electron/' + file.replace(/\.ts$/, '.js').replace(/\.cts$/, '.cjs')));

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'Textotheque',
    icon: windowsIcon,
    extraResource: [windowsIcon],
    ignore: (filePath) => {
      const normalized = filePath.replace(/\\/g, '/');
      if (normalized === '' || normalized === '/package.json') return false;
      if (normalized.endsWith('.d.ts') || normalized.endsWith('.d.cts')) return true;
      if (normalized.startsWith('/dist-electron/')) return !mainOutputs.has(normalized);
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
        setupIcon: windowsIcon,
        iconUrl: 'https://raw.githubusercontent.com/ugadavid/Textotheque/c531bfbd297f15aa22d08b6f7823e2e2b6fc18e1/assets/branding/textotheque.ico',
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
