const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, ipcMain } = require('electron');

let documents = [
  {
    id: 1,
    title: 'Premier document',
    content: 'Contenu initial',
    content_format: 'plain',
    status: 'draft',
    favorite: 0,
    created_at: '2026-07-09T00:00:00.000Z',
    updated_at: '2026-07-09T00:00:00.000Z',
    last_opened_at: '2026-07-09T00:00:00.000Z',
    notes: '',
  },
  {
    id: 2,
    title: 'Deuxieme document',
    content: 'Autre contenu',
    content_format: 'plain',
    status: 'active',
    favorite: 0,
    created_at: '2026-07-09T00:00:00.000Z',
    updated_at: '2026-07-09T00:00:00.000Z',
    last_opened_at: '2026-07-09T00:00:00.000Z',
    notes: '',
  },
];

function cloneDocument(document) {
  return { ...document };
}

app
  .whenReady()
  .then(async () => {
    ipcMain.handle('documents:list', () => documents.map(cloneDocument));
    ipcMain.handle('documents:create', () => {
      const created = {
        ...documents[0],
        id: documents.length + 1,
        title: '',
        content: '',
        status: 'draft',
        favorite: 0,
      };
      documents = [created, ...documents];
      return cloneDocument(created);
    });
    ipcMain.handle('documents:get', (_event, id) => cloneDocument(documents.find((document) => document.id === id)));
    ipcMain.handle('documents:update', (_event, id, input) => {
      const index = documents.findIndex((document) => document.id === id);
      documents[index] = {
        ...documents[index],
        ...input,
        favorite: input.favorite ? 1 : 0,
        content_format: 'plain',
        updated_at: '2026-07-09T00:01:00.000Z',
      };
      return cloneDocument(documents[index]);
    });
    ipcMain.handle('documents:mark-opened', (_event, id) => {
      const document = documents.find((item) => item.id === id);
      document.last_opened_at = '2026-07-09T00:02:00.000Z';
      return cloneDocument(document);
    });
    ipcMain.handle('app:approve-close', () => undefined);

    const window = new BrowserWindow({
      width: 1280,
      height: 820,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'dist-electron', 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    await window.loadURL(pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).toString());

    const result = await window.webContents.executeJavaScript(`
      (async () => {
        const waitFor = async (predicate, label) => {
          const start = Date.now();
          while (Date.now() - start < 3000) {
            const value = predicate();
            if (value) return value;
            await new Promise((resolve) => setTimeout(resolve, 30));
          }
          throw new Error('Timeout: ' + label);
        };

        await waitFor(() => document.querySelectorAll('.document-item').length >= 2, 'documents loaded');
        const firstTitle = document.querySelector('.title-input');
        const editor = document.querySelector('.content-editor');
        if (!firstTitle || !editor) throw new Error('editor missing');

        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
          .set.call(editor, 'Contenu initial modifie');
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelector('.title-dirty-marker'), 'dirty marker visible');

        document.querySelectorAll('.document-item')[1].click();
        await waitFor(() => document.querySelector('.confirm-dialog'), 'discard confirmation visible');
        document.querySelector('.secondary-button').click();
        await waitFor(() => !document.querySelector('.confirm-dialog'), 'discard confirmation cancelled');
        if (document.querySelector('.title-input').value !== 'Premier document') {
          throw new Error('selection changed after confirmation cancel');
        }

        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
          .set.call(editor, 'Contenu initial modifie encore');
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelector('.content-editor').value === 'Contenu initial modifie encore', 'editor editable after cancel');

        document.querySelectorAll('.document-item')[1].click();
        await waitFor(() => document.querySelector('.confirm-dialog'), 'discard confirmation visible again');
        document.querySelector('.danger-button').click();
        await waitFor(() => document.querySelector('.title-input').value === 'Deuxieme document', 'target document selected');
        const targetEditor = document.querySelector('.content-editor');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
          .set.call(targetEditor, 'Document cible modifie');
        targetEditor.dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelector('.content-editor').value === 'Document cible modifie', 'target editor editable after confirm');

        document.querySelector('.primary-button').click();
        await waitFor(() => !document.querySelector('.title-dirty-marker'), 'dirty marker cleared');

        const handles = document.querySelectorAll('.resize-handle');
        if (handles.length !== 2) throw new Error('resize handles missing');
        handles[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 280 }));
        window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 340 }));
        window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 340 }));
        await waitFor(() => window.localStorage.getItem('textotheque:pane-widths:v1'), 'pane widths stored');

        document.querySelector('.icon-button').click();
        await waitFor(() => document.querySelector('.title-input').value === '', 'new document title is empty');
        if (document.querySelector('.title-input').placeholder !== 'Sans titre') {
          throw new Error('Untitled fallback is not used as title placeholder');
        }
        await waitFor(() => document.querySelector('.document-item .document-title').textContent.includes('Sans titre'), 'untitled fallback visible in navigation');
        const newTitleInput = document.querySelector('.title-input');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          .set.call(newTitleInput, 'Titre saisi directement');
        newTitleInput.dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelector('.title-input').value === 'Titre saisi directement', 'direct title typing works');
        await waitFor(() => document.querySelector('.title-dirty-marker'), 'new title dirty marker visible');
        document.querySelector('.primary-button').click();
        await waitFor(() => !document.querySelector('.title-dirty-marker'), 'new title saved');

        return { ok: true };
      })()
    `);

    if (!result.ok) {
      throw new Error('UI safeguards check failed.');
    }

    console.log('ui safeguards ok');
    window.close();
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
