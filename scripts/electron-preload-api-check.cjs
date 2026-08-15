const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');

app
  .whenReady()
  .then(async () => {
    ipcMain.handle('documents:list', () => []);
    ipcMain.handle('documents:list-deleted', () => []);
    ipcMain.handle('documents:create', (_event, folderId = null) => ({
      id: 1,
      title: 'Sans titre',
      content: '',
      content_format: 'plain',
      status: 'draft',
      favorite: 0,
      created_at: '2026-07-09T00:00:00.000Z',
      updated_at: '2026-07-09T00:00:00.000Z',
      last_opened_at: '2026-07-09T00:00:00.000Z',
      deleted_at: null,
      notes: '',
      folder_id: folderId,
    }));
    ipcMain.handle('folders:list', () => []);
    ipcMain.handle('folders:create', (_event, parentId) => ({
      id: 1,
      name: 'Nouveau dossier',
      parent_id: parentId,
      position: 1,
      created_at: '2026-07-09T00:00:00.000Z',
      updated_at: '2026-07-09T00:00:00.000Z',
    }));
    ipcMain.handle('folders:rename', (_event, id, name) => ({
      id,
      name: name.trim() || 'Nouveau dossier',
      parent_id: null,
      position: 1,
      created_at: '2026-07-09T00:00:00.000Z',
      updated_at: '2026-07-09T00:01:00.000Z',
    }));
    ipcMain.handle('documents:get', () => null);
    ipcMain.handle('documents:update', (_event, id, input) => ({ id, ...input, content_format: 'plain' }));
    ipcMain.handle('documents:mark-opened', (_event, id) => ({ id }));
    ipcMain.handle('documents:trash', (_event, id) => ({ id, deleted_at: '2026-07-09T00:01:00.000Z' }));
    ipcMain.handle('documents:restore', (_event, id) => ({ id, deleted_at: null }));
    ipcMain.handle('documents:empty-trash', () => 2);

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
        if (typeof api.listDeletedDocuments !== 'function') return { ok: false, reason: 'listDeletedDocuments missing' };
        if (typeof api.createDocument !== 'function') return { ok: false, reason: 'createDocument missing' };
        if (typeof api.listFolders !== 'function') return { ok: false, reason: 'listFolders missing' };
        if (typeof api.createFolder !== 'function') return { ok: false, reason: 'createFolder missing' };
        if (typeof api.renameFolder !== 'function') return { ok: false, reason: 'renameFolder missing' };
        if (typeof api.trashDocument !== 'function') return { ok: false, reason: 'trashDocument missing' };
        if (typeof api.restoreDocument !== 'function') return { ok: false, reason: 'restoreDocument missing' };
        if (typeof api.emptyTrash !== 'function') return { ok: false, reason: 'emptyTrash missing' };
        const documents = await api.listDocuments();
        const deletedDocuments = await api.listDeletedDocuments();
        const folders = await api.listFolders();
        const createdFolder = await api.createFolder(null);
        const created = await api.createDocument(createdFolder.id);
        const renamedFolder = await api.renameFolder(createdFolder.id, 'Notes');
        const trashed = await api.trashDocument(created.id);
        const restored = await api.restoreDocument(created.id);
        const emptied = await api.emptyTrash();
        return {
          ok: Array.isArray(documents) &&
            Array.isArray(deletedDocuments) &&
            Array.isArray(folders) &&
            created &&
            created.id === 1 &&
            created.folder_id === createdFolder.id &&
            createdFolder &&
            createdFolder.name === 'Nouveau dossier' &&
            renamedFolder &&
            renamedFolder.name === 'Notes' &&
            Boolean(trashed.deleted_at) &&
            restored.deleted_at === null &&
            emptied === 2,
          reason: 'ok'
        };
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
