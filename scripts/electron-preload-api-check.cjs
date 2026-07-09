const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');

app
  .whenReady()
  .then(async () => {
    ipcMain.handle('documents:list', () => []);
    ipcMain.handle('documents:create', () => ({
      id: 1,
      title: 'Sans titre',
      content: '',
      content_format: 'plain',
      status: 'draft',
      favorite: 0,
      created_at: '2026-07-09T00:00:00.000Z',
      updated_at: '2026-07-09T00:00:00.000Z',
      last_opened_at: '2026-07-09T00:00:00.000Z',
      notes: '',
    }));
    ipcMain.handle('documents:get', () => null);
    ipcMain.handle('documents:update', (_event, id, input) => ({ id, ...input, content_format: 'plain' }));
    ipcMain.handle('documents:mark-opened', (_event, id) => ({ id }));

    const window = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'dist-electron', 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    await window.loadURL('data:text/html,<html><body>preload check</body></html>');
    const result = await window.webContents.executeJavaScript(`
      (async () => {
        const api = window.textotheque;
        if (!api) return { ok: false, reason: 'window.textotheque missing' };
        if (typeof api.listDocuments !== 'function') return { ok: false, reason: 'listDocuments missing' };
        if (typeof api.createDocument !== 'function') return { ok: false, reason: 'createDocument missing' };
        const documents = await api.listDocuments();
        const created = await api.createDocument();
        return { ok: Array.isArray(documents) && created && created.id === 1, reason: 'ok' };
      })()
    `);

    if (!result.ok) {
      throw new Error(`Preload API check failed: ${result.reason}`);
    }

    console.log('preload api ok');
    window.close();
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
