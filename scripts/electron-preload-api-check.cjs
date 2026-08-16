const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');

app
  .whenReady()
  .then(async () => {
    ipcMain.handle('library:get-info', () => ({
      path: 'C:\\temporary\\textotheque.sqlite',
      fileName: 'textotheque.sqlite',
      applicationId: 1413830735,
      userVersion: 3,
      isTextotheque: true,
    }));
    let exportAvailable = false;
    ipcMain.handle('file:set-export-available', (_event, available) => {
      exportAvailable = available;
    });
    ipcMain.handle('file:export-text', (event, draft) => {
      event.sender.send('file:menu-action', { action: 'open-todo' });
      event.sender.send('file:menu-action', { action: 'export-text' });
      return { canceled: false, fileName: `${draft.title}.txt` };
    });
    ipcMain.handle('library:backup', () => ({ canceled: true, path: null, fileName: null, error: null }));
    ipcMain.handle('library:get-startup-notice', () => 'fallback temporaire');
    ipcMain.handle('library:choose-open', () => ({
      status: 'compatible',
      inspection: { path: 'C:\\temporary\\other.sqlite', compatibility: 'compatible' },
      library: null,
      backupPath: null,
    }));
    ipcMain.handle('library:open', (_event, candidatePath, migrationApproved) => ({
      status: 'opened',
      inspection: { path: candidatePath, compatibility: 'compatible' },
      library: { path: candidatePath, fileName: 'other.sqlite', applicationId: 1413830735, userVersion: 3, isTextotheque: true },
      backupPath: migrationApproved ? 'C:\\temporary\\pre-migration.sqlite' : null,
    }));
    ipcMain.handle('library:inspect', (_event, candidatePath) => ({
      status: 'compatible', inspection: { path: candidatePath, compatibility: 'compatible' }, library: null, backupPath: null,
    }));
    ipcMain.handle('library:choose-create', (event) => {
      event.sender.send('library:menu-action', { action: 'new' });
      return { status: 'selected', path: 'C:\\temporary\\created.sqlite' };
    });
    ipcMain.handle('library:create', (_event, candidatePath) => ({
      status: 'created',
      library: { path: candidatePath, fileName: 'created.sqlite', applicationId: 1413830735, userVersion: 3, isTextotheque: true },
    }));
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
      special_role: null,
    }));
    ipcMain.handle('documents:get-or-create-special', (_event, role) => ({
      id: 2,
      title: 'TODO',
      content: '',
      content_format: 'plain',
      status: 'active',
      favorite: 0,
      created_at: '2026-07-09T00:00:00.000Z',
      updated_at: '2026-07-09T00:00:00.000Z',
      last_opened_at: '2026-07-09T00:00:00.000Z',
      deleted_at: null,
      notes: '',
      folder_id: null,
      special_role: role,
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
    ipcMain.handle('documents:get', (_event, id) => {
      if (id === -1) {
        throw new Error('forced preload rejection');
      }
      return null;
    });
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
        if (typeof api.getLibraryInfo !== 'function') return { ok: false, reason: 'getLibraryInfo missing' };
        if (typeof api.backupLibrary !== 'function') return { ok: false, reason: 'backupLibrary missing' };
        if (typeof api.chooseOpenLibrary !== 'function') return { ok: false, reason: 'chooseOpenLibrary missing' };
        if (typeof api.openLibrary !== 'function') return { ok: false, reason: 'openLibrary missing' };
        if (typeof api.inspectLibrary !== 'function') return { ok: false, reason: 'inspectLibrary missing' };
        if (typeof api.chooseCreateLibrary !== 'function') return { ok: false, reason: 'chooseCreateLibrary missing' };
        if (typeof api.createLibrary !== 'function') return { ok: false, reason: 'createLibrary missing' };
        if (typeof api.onLibraryMenuAction !== 'function') return { ok: false, reason: 'onLibraryMenuAction missing' };
        if (typeof api.exportTextDocument !== 'function') return { ok: false, reason: 'exportTextDocument missing' };
        if (typeof api.setDocumentExportAvailable !== 'function') return { ok: false, reason: 'setDocumentExportAvailable missing' };
        if (typeof api.onFileMenuAction !== 'function') return { ok: false, reason: 'onFileMenuAction missing' };
        if (typeof api.listDocuments !== 'function') return { ok: false, reason: 'listDocuments missing' };
        if (typeof api.listDeletedDocuments !== 'function') return { ok: false, reason: 'listDeletedDocuments missing' };
        if (typeof api.createDocument !== 'function') return { ok: false, reason: 'createDocument missing' };
        if (typeof api.getOrCreateSpecialDocument !== 'function') return { ok: false, reason: 'getOrCreateSpecialDocument missing' };
        if (typeof api.listFolders !== 'function') return { ok: false, reason: 'listFolders missing' };
        if (typeof api.createFolder !== 'function') return { ok: false, reason: 'createFolder missing' };
        if (typeof api.renameFolder !== 'function') return { ok: false, reason: 'renameFolder missing' };
        if (typeof api.trashDocument !== 'function') return { ok: false, reason: 'trashDocument missing' };
        if (typeof api.restoreDocument !== 'function') return { ok: false, reason: 'restoreDocument missing' };
        if (typeof api.emptyTrash !== 'function') return { ok: false, reason: 'emptyTrash missing' };
        if (typeof api.getDocument !== 'function') return { ok: false, reason: 'getDocument missing' };
        const unhandledRejections = [];
        window.addEventListener('unhandledrejection', (event) => {
          unhandledRejections.push(String(event.reason));
        });
        const documents = await api.listDocuments();
        const libraryInfo = await api.getLibraryInfo();
        const startupNotice = await api.getLibraryStartupNotice();
        const canceledBackup = await api.backupLibrary();
        const chosenLibrary = await api.chooseOpenLibrary();
        const openedLibrary = await api.openLibrary(chosenLibrary.inspection.path, true);
        const inspectedLibrary = await api.inspectLibrary('C:\\temporary\\known.sqlite');
        const fileMenuActions = [];
        const unsubscribeFileMenu = api.onFileMenuAction((action) => { fileMenuActions.push(action.action); });
        await api.setDocumentExportAvailable(true);
        const textExport = await api.exportTextDocument({ title: 'Brouillon', content: 'exact\\ncontent' });
        await new Promise((resolve) => setTimeout(resolve, 0));
        unsubscribeFileMenu();
        let receivedMenuAction = null;
        const unsubscribeMenu = api.onLibraryMenuAction((action) => { receivedMenuAction = action; });
        const createSelection = await api.chooseCreateLibrary();
        await new Promise((resolve) => setTimeout(resolve, 0));
        unsubscribeMenu();
        const createdLibrary = await api.createLibrary(createSelection.path);
        const deletedDocuments = await api.listDeletedDocuments();
        const folders = await api.listFolders();
        const createdFolder = await api.createFolder(null);
        const created = await api.createDocument(createdFolder.id);
        const todo = await api.getOrCreateSpecialDocument('todo');
        const renamedFolder = await api.renameFolder(createdFolder.id, 'Notes');
        const trashed = await api.trashDocument(created.id);
        const restored = await api.restoreDocument(created.id);
        const emptied = await api.emptyTrash();
        let rejectionWasCaught = false;
        try {
          await api.getDocument(-1);
        } catch (error) {
          rejectionWasCaught = error instanceof Error && error.message.includes('forced preload rejection');
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
        return {
          ok: Array.isArray(documents) &&
            libraryInfo.fileName === 'textotheque.sqlite' &&
            libraryInfo.applicationId === 1413830735 &&
            libraryInfo.userVersion === 3 &&
            startupNotice === 'fallback temporaire' &&
            canceledBackup.canceled === true &&
            canceledBackup.path === null &&
            chosenLibrary.status === 'compatible' &&
            openedLibrary.status === 'opened' &&
            openedLibrary.library.fileName === 'other.sqlite' &&
            openedLibrary.backupPath.endsWith('pre-migration.sqlite') &&
            inspectedLibrary.status === 'compatible' &&
            fileMenuActions.join(',') === 'open-todo,export-text' &&
            textExport.canceled === false &&
            textExport.fileName === 'Brouillon.txt' &&
            receivedMenuAction?.action === 'new' &&
            createdLibrary.status === 'created' &&
            createdLibrary.library.fileName === 'created.sqlite' &&
            Array.isArray(deletedDocuments) &&
            Array.isArray(folders) &&
            created &&
            created.id === 1 &&
            created.folder_id === createdFolder.id &&
            todo.special_role === 'todo' &&
            createdFolder &&
            createdFolder.name === 'Nouveau dossier' &&
            renamedFolder &&
            renamedFolder.name === 'Notes' &&
            Boolean(trashed.deleted_at) &&
            restored.deleted_at === null &&
            emptied === 2 &&
            rejectionWasCaught &&
            unhandledRejections.length === 0,
          reason: 'ok'
        };
      })()
    `);

    if (!result.ok) {
      throw new Error(`Preload API check failed: ${result.reason}`);
    }
    if (!exportAvailable) {
      throw new Error('Preload API check failed: export availability was not forwarded');
    }

    console.log('preload api ok');
    window.close();
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
