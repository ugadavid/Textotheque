const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, ipcMain } = require('electron');

const libraryA = 'C:\\temporary\\autosave-a.sqlite';
const libraryB = 'C:\\temporary\\autosave-b.sqlite';
let libraryInfo = { path: libraryA, fileName: 'autosave-a.sqlite', applicationId: 1413830735, userVersion: 3, isTextotheque: true };
let documents = [
  { id: 1, title: 'Premier document', content: 'Initial A', content_format: 'plain', status: 'active', favorite: 0, created_at: '2026-08-15T00:00:00.000Z', updated_at: '2026-08-15T00:00:00.000Z', last_opened_at: null, deleted_at: null, notes: '', folder_id: null },
  { id: 2, title: 'Deuxieme document', content: 'Initial deux', content_format: 'plain', status: 'active', favorite: 0, created_at: '2026-08-15T00:00:00.000Z', updated_at: '2026-08-15T00:00:00.000Z', last_opened_at: null, deleted_at: null, notes: '', folder_id: null },
];
let updateCalls = [];
let delayNextUpdate = false;
let failNextUpdate = false;
let pendingUpdate = null;

function clone(value) {
  return value ? { ...value } : value;
}

function persistDocument(id, input) {
  const index = documents.findIndex((document) => document.id === id);
  if (index < 0) throw new Error('document absent de la bibliotheque active');
  documents[index] = {
    ...documents[index],
    ...input,
    title: input.title.trim() || 'Sans titre',
    favorite: input.favorite ? 1 : 0,
    updated_at: new Date().toISOString(),
  };
  return clone(documents[index]);
}

app.whenReady().then(async () => {
  ipcMain.handle('library:get-info', () => ({ ...libraryInfo }));
  ipcMain.handle('file:set-export-available', () => undefined);
  ipcMain.handle('file:export-text', () => ({ canceled: true, fileName: null }));
  ipcMain.handle('library:get-startup-notice', () => null);
  ipcMain.handle('library:backup', () => ({ canceled: true, path: null, fileName: null, error: null }));
  ipcMain.handle('library:choose-open', () => ({ status: 'canceled', inspection: null, library: null, backupPath: null }));
  ipcMain.handle('library:choose-create', () => ({ status: 'canceled', path: null }));
  ipcMain.handle('library:create', () => ({ status: 'create-failed', library: null }));
  ipcMain.handle('library:inspect', (_event, candidatePath) => ({
    status: 'compatible',
    inspection: { path: candidatePath, fileName: path.basename(candidatePath), readable: true, applicationId: 1413830735, userVersion: 3, isTextotheque: true, compatibility: 'compatible' },
    library: null,
    backupPath: null,
  }));
  ipcMain.handle('library:open', (_event, candidatePath) => {
    libraryInfo = { ...libraryInfo, path: candidatePath, fileName: path.basename(candidatePath) };
    documents = [{ id: 101, title: 'Document B', content: 'Bibliotheque B intacte', content_format: 'plain', status: 'active', favorite: 0, created_at: '2026-08-15T00:00:00.000Z', updated_at: '2026-08-15T00:00:00.000Z', last_opened_at: null, deleted_at: null, notes: '', folder_id: null }];
    return { status: 'opened', inspection: null, library: { ...libraryInfo }, backupPath: null };
  });
  ipcMain.handle('documents:list', () => documents.filter((document) => !document.deleted_at).map(clone));
  ipcMain.handle('documents:list-deleted', () => []);
  ipcMain.handle('documents:get', (_event, id) => clone(documents.find((document) => document.id === id)));
  ipcMain.handle('documents:mark-opened', (_event, id) => clone(documents.find((document) => document.id === id)));
  ipcMain.handle('documents:update', (_event, id, input, expectedLibraryPath) => {
    const call = { id, input: { ...input }, expectedLibraryPath };
    updateCalls.push(call);
    if (failNextUpdate) {
      failNextUpdate = false;
      throw new Error('SQLITE_AUTOSAVE_FORCED C:\\private\\autosave.sqlite');
    }
    if (delayNextUpdate) {
      delayNextUpdate = false;
      return new Promise((resolve, reject) => {
        pendingUpdate = {
          resolve: () => {
            pendingUpdate = null;
            if (expectedLibraryPath !== libraryInfo.path) {
              reject(new Error('contexte bibliotheque modifie'));
              return;
            }
            try { resolve(persistDocument(id, input)); } catch (error) { reject(error); }
          },
        };
      });
    }
    if (expectedLibraryPath !== libraryInfo.path) throw new Error('contexte bibliotheque modifie');
    return persistDocument(id, input);
  });
  ipcMain.handle('documents:create', () => clone(documents[0]));
  ipcMain.handle('documents:trash', (_event, id) => clone(documents.find((document) => document.id === id)));
  ipcMain.handle('documents:restore', (_event, id) => clone(documents.find((document) => document.id === id)));
  ipcMain.handle('documents:empty-trash', () => 0);
  ipcMain.handle('folders:list', () => []);
  ipcMain.handle('folders:create', () => null);
  ipcMain.handle('folders:rename', () => null);
  ipcMain.handle('app:approve-close', () => undefined);

  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'dist-electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: `textotheque-autosave-${process.pid}`,
    },
  });

  try {
    await window.loadURL(pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).toString());
    const setup = `
      const waitFor = async (predicate, label, timeout = 5000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          const value = predicate();
          if (value) return value;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        throw new Error('Timeout: ' + label);
      };
      const setEditor = (value) => {
        const editor = document.querySelector('.content-editor');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(editor, value);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const shortcutSave = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
      const dispatchKey = (element, key, options = {}) => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
        const dispatchResult = element.dispatchEvent(event);
        return { defaultPrevented: event.defaultPrevented, dispatchResult };
      };
    `;

    const debounceStart = updateCalls.length;
    const debounceResult = await window.webContents.executeJavaScript(`(async () => {
      ${setup}
      await waitFor(() => document.querySelector('.content-editor'), 'editor ready');
      Array.from(document.querySelectorAll('.nav-view-button')).find((button) => button.textContent.includes('Tous les textes')).click();
      await waitFor(() => document.querySelectorAll('.document-item').length === 2, 'all documents view');
      setEditor('Debounce 1');
      await new Promise((resolve) => setTimeout(resolve, 100));
      setEditor('Debounce 2');
      await new Promise((resolve) => setTimeout(resolve, 100));
      setEditor('Debounce final');
      await waitFor(() => !document.querySelector('.title-dirty-marker'), 'debounced autosave success');
      const persisted = (await window.textotheque.listDocuments()).find((item) => item.id === 1);
      return { content: document.querySelector('.content-editor').value, persisted: persisted.content };
    })()`);
    if (updateCalls.length !== debounceStart + 1 || debounceResult.content !== 'Debounce final' || debounceResult.persisted !== 'Debounce final') {
      throw new Error(`Debounce autosave invalide: ${JSON.stringify(debounceResult)}, calls=${updateCalls.length - debounceStart}`);
    }

    const tabStart = updateCalls.length;
    const tabResult = await window.webContents.executeJavaScript(`(async () => {
      ${setup}
      const editor = document.querySelector('.content-editor');
      setEditor('abcdef');
      await waitFor(() => document.querySelector('.title-dirty-marker'), 'tab cursor baseline dirty');
      shortcutSave();
      await waitFor(() => !document.querySelector('.title-dirty-marker'), 'tab cursor baseline saved');

      editor.focus();
      editor.setSelectionRange(3, 3);
      const cursorEvent = dispatchKey(editor, 'Tab');
      await waitFor(() => editor.value === 'abc\\tdef', 'tab inserted at cursor');
      await waitFor(() => editor.selectionStart === 4 && editor.selectionEnd === 4, 'caret restored after tab');
      const cursorState = {
        value: editor.value,
        start: editor.selectionStart,
        end: editor.selectionEnd,
        focused: document.activeElement === editor,
        dirty: Boolean(document.querySelector('.title-dirty-marker')),
        event: cursorEvent,
      };
      await waitFor(() => !document.querySelector('.title-dirty-marker'), 'tab cursor autosaved');
      const cursorPersisted = (await window.textotheque.listDocuments()).find((item) => item.id === 1).content;

      setEditor('abcDEFghi');
      await waitFor(() => document.querySelector('.title-dirty-marker'), 'tab selection baseline dirty');
      shortcutSave();
      await waitFor(() => !document.querySelector('.title-dirty-marker'), 'tab selection baseline saved');
      editor.focus();
      editor.setSelectionRange(3, 6);
      const selectionEvent = dispatchKey(editor, 'Tab');
      await waitFor(() => editor.value === 'abc\\tghi', 'selection replaced by tab');
      await waitFor(() => editor.selectionStart === 4 && editor.selectionEnd === 4, 'caret restored after selection replacement');
      const selectionState = {
        value: editor.value,
        start: editor.selectionStart,
        end: editor.selectionEnd,
        focused: document.activeElement === editor,
        dirty: Boolean(document.querySelector('.title-dirty-marker')),
        event: selectionEvent,
      };
      shortcutSave();
      await waitFor(() => !document.querySelector('.title-dirty-marker'), 'tab selection saved');

      const beforeIgnoredKeys = editor.value;
      const shiftTabEvent = dispatchKey(editor, 'Tab', { shiftKey: true });
      const searchInput = document.querySelector('.search-input-row input');
      const outsideTabEvent = dispatchKey(searchInput, 'Tab');
      return {
        cursorState,
        cursorPersisted,
        selectionState,
        ignoredContentUnchanged: editor.value === beforeIgnoredKeys,
        shiftTabEvent,
        outsideTabEvent,
      };
    })()`);
    if (
      updateCalls.length !== tabStart + 4 ||
      tabResult.cursorState.value !== 'abc\tdef' ||
      tabResult.cursorPersisted !== 'abc\tdef' ||
      tabResult.cursorState.start !== 4 ||
      tabResult.cursorState.end !== 4 ||
      !tabResult.cursorState.focused ||
      !tabResult.cursorState.dirty ||
      !tabResult.cursorState.event.defaultPrevented ||
      tabResult.cursorState.event.dispatchResult !== false ||
      tabResult.selectionState.value !== 'abc\tghi' ||
      tabResult.selectionState.start !== 4 ||
      tabResult.selectionState.end !== 4 ||
      !tabResult.selectionState.focused ||
      !tabResult.selectionState.dirty ||
      !tabResult.selectionState.event.defaultPrevented ||
      tabResult.selectionState.event.dispatchResult !== false ||
      !tabResult.ignoredContentUnchanged ||
      tabResult.shiftTabEvent.defaultPrevented ||
      tabResult.shiftTabEvent.dispatchResult !== true ||
      tabResult.outsideTabEvent.defaultPrevented ||
      tabResult.outsideTabEvent.dispatchResult !== true
    ) {
      throw new Error(`Tabulation editeur invalide: ${JSON.stringify(tabResult)}, calls=${updateCalls.length - tabStart}`);
    }

    const manualStart = updateCalls.length;
    const manualResult = await window.webContents.executeJavaScript(`(async () => {
      ${setup}
      setEditor('Sauvegarde manuelle prioritaire');
      await waitFor(() => document.querySelector('.title-dirty-marker'), 'manual dirty');
      shortcutSave();
      await waitFor(() => !document.querySelector('.title-dirty-marker'), 'manual save success');
      await new Promise((resolve) => setTimeout(resolve, 1800));
      return (await window.textotheque.listDocuments()).find((item) => item.id === 1).content;
    })()`);
    if (updateCalls.length !== manualStart + 1 || manualResult !== 'Sauvegarde manuelle prioritaire') {
      throw new Error(`Ctrl+S a laisse un autosave double: calls=${updateCalls.length - manualStart}`);
    }

    delayNextUpdate = true;
    const raceStart = updateCalls.length;
    await window.webContents.executeJavaScript(`(async () => {
      ${setup}
      setEditor('Snapshot A en vol');
      await waitFor(() => document.querySelector('.save-state.saving'), 'snapshot A in flight');
    })()`);
    await window.webContents.executeJavaScript(`(async () => {
      ${setup}
      setEditor('Version B plus recente');
      await waitFor(() => document.querySelector('.title-dirty-marker'), 'version B dirty');
    })()`);
    pendingUpdate.resolve();
    const raceResult = await window.webContents.executeJavaScript(`(async () => {
      ${setup}
      await new Promise((resolve) => setTimeout(resolve, 100));
      const staleReturnPreservedDirty = Boolean(document.querySelector('.title-dirty-marker')) && document.querySelector('.content-editor').value === 'Version B plus recente';
      await waitFor(() => !document.querySelector('.title-dirty-marker'), 'version B autosaved');
      const persisted = (await window.textotheque.listDocuments()).find((item) => item.id === 1).content;
      return { staleReturnPreservedDirty, visible: document.querySelector('.content-editor').value, persisted };
    })()`);
    if (updateCalls.length !== raceStart + 2 || !raceResult.staleReturnPreservedDirty || raceResult.visible !== 'Version B plus recente' || raceResult.persisted !== 'Version B plus recente') {
      throw new Error(`Course A/B non protegee: ${JSON.stringify(raceResult)}, calls=${updateCalls.length - raceStart}`);
    }

    failNextUpdate = true;
    const failureStart = updateCalls.length;
    const failureResult = await window.webContents.executeJavaScript(`(async () => {
      ${setup}
      setEditor('Contenu conserve apres erreur');
      await waitFor(() => document.querySelector('.save-state.error'), 'autosave error');
      await new Promise((resolve) => setTimeout(resolve, 1800));
      return {
        dirty: Boolean(document.querySelector('.title-dirty-marker')),
        visible: document.querySelector('.content-editor').value,
        message: document.querySelector('.error-message')?.textContent ?? '',
      };
    })()`);
    if (updateCalls.length !== failureStart + 1 || !failureResult.dirty || failureResult.visible !== 'Contenu conserve apres erreur' || !failureResult.message.includes('Impossible de sauvegarder')) {
      throw new Error(`Echec autosave mal gere: ${JSON.stringify(failureResult)}, calls=${updateCalls.length - failureStart}`);
    }
    await window.webContents.executeJavaScript(`(async () => {
      ${setup}
      shortcutSave();
      await waitFor(() => !document.querySelector('.title-dirty-marker') && !document.querySelector('.error-message'), 'manual recovery after autosave error');
    })()`);

    delayNextUpdate = true;
    await window.webContents.executeJavaScript(`(async () => {
      ${setup}
      setEditor('Retour tardif ancien document');
      await waitFor(() => document.querySelector('.save-state.saving'), 'old document save in flight');
      const second = Array.from(document.querySelectorAll('.document-item')).find((item) => item.textContent.includes('Deuxieme document'));
      second.click();
      const dialog = await waitFor(() => document.querySelector('.confirm-dialog'), 'document switch confirmation');
      dialog.querySelector('.danger-button').click();
      await waitFor(() => document.querySelector('.title-input')?.value === 'Deuxieme document', 'second document selected');
    })()`);
    pendingUpdate.resolve();
    const documentSwitchResult = await window.webContents.executeJavaScript(`(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return { title: document.querySelector('.title-input')?.value, content: document.querySelector('.content-editor')?.value };
    })()`);
    if (documentSwitchResult.title !== 'Deuxieme document' || documentSwitchResult.content !== 'Initial deux') {
      throw new Error(`Retour tardif a modifie le nouveau document: ${JSON.stringify(documentSwitchResult)}`);
    }

    await window.webContents.executeJavaScript(`(async () => {
      ${setup}
      const first = Array.from(document.querySelectorAll('.document-item')).find((item) => item.textContent.includes('Premier document'));
      first.click();
      await waitFor(() => document.querySelector('.title-input')?.value === 'Premier document', 'first document reselected');
    })()`);
    delayNextUpdate = true;
    await window.webContents.executeJavaScript(`(async () => {
      ${setup}
      setEditor('Ancienne bibliotheque en vol');
      await waitFor(() => document.querySelector('.save-state.saving'), 'old library save in flight');
    })()`);
    const librarySwitchCallCount = updateCalls.length;
    window.webContents.send('library:menu-action', { action: 'known', path: libraryB });
    await window.webContents.executeJavaScript(`(async () => {
      ${setup}
      const dialog = await waitFor(() => document.querySelector('.confirm-dialog'), 'library switch confirmation');
      dialog.querySelector('.danger-button').click();
      await waitFor(() => document.querySelector('.status-bar .library-name')?.textContent.includes('autosave-b.sqlite'), 'library B active');
    })()`);
    pendingUpdate.resolve();
    const librarySwitchResult = await window.webContents.executeJavaScript(`(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1800));
      return {
        library: document.querySelector('.status-bar .library-name')?.textContent ?? '',
        selected: document.querySelector('.title-input')?.value ?? null,
        error: document.querySelector('.error-message')?.textContent ?? null,
        count: document.querySelector('.status-bar')?.textContent ?? '',
      };
    })()`);
    if (updateCalls.length !== librarySwitchCallCount || !librarySwitchResult.library.includes('autosave-b.sqlite') || librarySwitchResult.selected !== null || librarySwitchResult.error !== null || !librarySwitchResult.count.includes('1 document')) {
      throw new Error(`Autosave ancienne bibliotheque non neutralise: ${JSON.stringify(librarySwitchResult)}`);
    }

    console.log('autosave, editor tabs, snapshots, errors and context switches ok');
    window.close();
    app.quit();
  } catch (error) {
    console.error(error);
    window.destroy();
    app.exit(1);
  }
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
