const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, ipcMain } = require('electron');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'textotheque-text-export-'));
let window;

const documentRecord = {
  id: 1,
  title: 'Titre enregistré',
  content: 'Contenu enregistré',
  content_format: 'plain',
  status: 'draft',
  favorite: 0,
  created_at: '2026-08-15T00:00:00.000Z',
  updated_at: '2026-08-15T00:00:00.000Z',
  last_opened_at: null,
  deleted_at: null,
  notes: '',
  folder_id: null,
};

app.whenReady().then(async () => {
  const textExportModule = await import(pathToFileURL(path.join(__dirname, '..', 'dist-electron', 'text-export.js')).href);
  const exactBytes = 'ligne 1\r\n\tligne 2\naccents éà — 漢字 🙂';
  const byteCheckPath = path.join(temporaryDirectory, 'bytes.txt');
  await textExportModule.writeTextExport(byteCheckPath, exactBytes);
  const writtenBytes = fs.readFileSync(byteCheckPath);
  if (!writtenBytes.equals(Buffer.from(exactBytes, 'utf8')) || writtenBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
    throw new Error('L export texte ne conserve pas exactement les octets UTF-8 sans BOM.');
  }

  const names = [
    [textExportModule.suggestedTextExportFileName('Notes : M2 / soutenance ?'), 'Notes - M2 - soutenance.txt'],
    [textExportModule.suggestedTextExportFileName('  '), 'Sans titre.txt'],
    [textExportModule.suggestedTextExportFileName('Résumé été.txt'), 'Résumé été.txt'],
    [textExportModule.suggestedTextExportFileName('CON'), 'CON - document.txt'],
  ];
  for (const [actual, expected] of names) {
    if (actual !== expected) throw new Error(`Nom d export invalide: ${actual} au lieu de ${expected}`);
  }

  const exportDrafts = [];
  const availability = [];
  let updateCount = 0;

  ipcMain.handle('library:get-info', () => ({
    path: 'C:\\temporary\\text-export.sqlite', fileName: 'text-export.sqlite',
    applicationId: 1413830735, userVersion: 2, isTextotheque: true,
  }));
  ipcMain.handle('library:get-startup-notice', () => null);
  ipcMain.handle('library:backup', () => ({ canceled: true, path: null, fileName: null, error: null }));
  ipcMain.handle('library:choose-open', () => ({ status: 'canceled', inspection: null, library: null, backupPath: null }));
  ipcMain.handle('library:choose-create', () => ({ status: 'canceled', path: null }));
  ipcMain.handle('library:create', () => ({ status: 'create-failed', library: null }));
  ipcMain.handle('library:inspect', () => ({ status: 'invalid', inspection: null, library: null, backupPath: null }));
  ipcMain.handle('library:open', () => ({ status: 'open-failed', inspection: null, library: null, backupPath: null }));
  ipcMain.handle('file:set-export-available', (_event, value) => availability.push(value));
  ipcMain.handle('file:export-text', (_event, draft) => {
    exportDrafts.push({ ...draft });
    return { canceled: false, fileName: 'Brouillon visible.txt' };
  });
  ipcMain.handle('documents:list', () => [{ ...documentRecord }]);
  ipcMain.handle('documents:list-deleted', () => []);
  ipcMain.handle('documents:get', () => ({ ...documentRecord }));
  ipcMain.handle('documents:mark-opened', () => ({ ...documentRecord }));
  ipcMain.handle('documents:update', (_event, _id, input) => {
    updateCount += 1;
    return { ...documentRecord, ...input, favorite: input.favorite ? 1 : 0 };
  });
  ipcMain.handle('documents:create', () => ({ ...documentRecord }));
  ipcMain.handle('documents:trash', () => ({ ...documentRecord, deleted_at: new Date().toISOString() }));
  ipcMain.handle('documents:restore', () => ({ ...documentRecord }));
  ipcMain.handle('documents:empty-trash', () => 0);
  ipcMain.handle('folders:list', () => []);
  ipcMain.handle('folders:create', () => null);
  ipcMain.handle('folders:rename', () => null);
  ipcMain.handle('app:approve-close', () => undefined);

  window = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'dist-electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: `textotheque-text-export-${process.pid}`,
    },
  });
  await window.loadURL(pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).toString());

  const draft = { title: 'Brouillon : visible ?', content: 'Première ligne\n\tDeuxième ligne — 漢字 🙂' };
  const result = await window.webContents.executeJavaScript(`
    (async () => {
      const waitFor = async (predicate, label) => {
        const start = Date.now();
        while (Date.now() - start < 3000) {
          const value = predicate();
          if (value) return value;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        throw new Error('Timeout: ' + label);
      };
      await waitFor(() => document.querySelector('.content-editor'), 'document selection');
      const title = document.querySelector('.title-input');
      const editor = document.querySelector('.content-editor');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(title, ${JSON.stringify(draft.title)});
      title.dispatchEvent(new Event('input', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(editor, ${JSON.stringify(draft.content)});
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      await waitFor(() => document.querySelector('.title-dirty-marker'), 'dirty draft');
      return true;
    })()
  `);
  if (!result) throw new Error('Le brouillon renderer n a pas pu être préparé.');

  window.webContents.send('file:menu-action', { action: 'export-text' });
  const exportState = await window.webContents.executeJavaScript(`
    (async () => {
      const start = Date.now();
      while (Date.now() - start < 1000) {
        if (document.querySelector('.success-message')?.textContent.includes('Export texte créé')) {
          return { dirty: Boolean(document.querySelector('.title-dirty-marker')) };
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return { dirty: false, missingNotice: true };
    })()
  `);
  if (exportDrafts.length !== 1 || JSON.stringify(exportDrafts[0]) !== JSON.stringify(draft)) {
    throw new Error(`Le menu n a pas exporté le brouillon React exact: ${JSON.stringify(exportDrafts)}`);
  }
  if (!exportState.dirty || updateCount !== 0) {
    throw new Error(`L export a modifié la sauvegarde: ${JSON.stringify(exportState)}, updates=${updateCount}`);
  }

  await window.webContents.executeJavaScript(`
    (async () => {
      const button = Array.from(document.querySelectorAll('.nav-view-button')).find((item) => item.textContent.includes('Corbeille'));
      button.click();
      const start = Date.now();
      while (Date.now() - start < 1000 && !document.querySelector('.confirm-dialog')) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      document.querySelector('.confirm-dialog .danger-button').click();
      while (Date.now() - start < 2000 && document.querySelector('.content-editor')) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    })()
  `);
  await new Promise((resolve) => setTimeout(resolve, 50));
  const callsBeforeEmptySelection = exportDrafts.length;
  window.webContents.send('file:menu-action', { action: 'export-text' });
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (exportDrafts.length !== callsBeforeEmptySelection || availability.at(-1) !== false) {
    throw new Error(`L export reste actif sans document: calls=${exportDrafts.length}, availability=${JSON.stringify(availability)}`);
  }

  console.log('text export utf8, filename, renderer snapshot and neutral dirty state ok');
  window.destroy();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  app.quit();
}).catch((error) => {
  console.error(error);
  window?.destroy();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  app.exit(1);
});
