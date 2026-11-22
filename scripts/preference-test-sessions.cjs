const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

async function runPreferenceSessions(script, label) {
  const { preview } = await import('vite');
  const server = await preview({preview: {port: 5173, strictPort: true}});
  const temp = createTestTempDirectory(label);
  try {
    for (const phase of ['first', 'restart', 'invalid']) {
      const args = [script, '--fixture', phase, '--user-data-dir=' + temp];
      if (process.argv.includes('--captures')) args.push('--captures');
      const child = spawn(require('electron'), args, {stdio: 'inherit', timeout: 45000,
        env: {...process.env, TEXTOTHEQUE_DB_PATH: path.join(temp, 'fixture.sqlite'),
          TEXTOTHEQUE_LIBRARY_HISTORY_PATH: path.join(temp, 'history.json')}});
      const code = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });
      assert.equal(code, 0, phase);
    }
  } finally {
    await server.close();
    removeTestTempDirectory(temp);
  }
}

module.exports = { runPreferenceSessions };
