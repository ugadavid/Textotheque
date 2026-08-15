const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, ipcMain } = require('electron');
const { version: packageVersion } = require('../package.json');

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
    deleted_at: null,
    notes: '',
    folder_id: null,
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
    deleted_at: null,
    notes: '',
    folder_id: null,
  },
  {
    id: 3,
    title: 'Ancien document',
    content: 'Contenu archive',
    content_format: 'plain',
    status: 'draft',
    favorite: 0,
    created_at: '2026-07-09T00:00:00.000Z',
    updated_at: '2026-07-09T00:00:00.000Z',
    last_opened_at: '2026-07-09T00:00:00.000Z',
    deleted_at: '2026-07-09T00:03:00.000Z',
    notes: '',
    folder_id: null,
  },
  {
    id: 4,
    title: 'Document corbeille bis',
    content: 'Deuxieme contenu archive',
    content_format: 'plain',
    status: 'draft',
    favorite: 0,
    created_at: '2026-07-09T00:00:00.000Z',
    updated_at: '2026-07-09T00:00:00.000Z',
    last_opened_at: '2026-07-09T00:00:00.000Z',
    deleted_at: '2026-07-09T00:03:30.000Z',
    notes: '',
    folder_id: null,
  },
];

let folders = [];
let libraryBackupInvocations = 0;
let libraryChooseOpenInvocations = 0;
let libraryChooseCreateInvocations = 0;
let libraryInspectInvocations = 0;
let libraryOpenInvocations = 0;
let libraryInfo = {
  path: 'C:\\temporary\\test-ui.sqlite',
  fileName: 'test-ui.sqlite',
  applicationId: 1413830735,
  userVersion: 2,
  isTextotheque: true,
};
const forcedFailureCounts = new Map();

function forceFailures(channel, count = 1) {
  forcedFailureCounts.set(channel, count);
}

function rejectIfForced(channel) {
  const remaining = forcedFailureCounts.get(channel) ?? 0;
  if (remaining <= 0) {
    return;
  }
  forcedFailureCounts.set(channel, remaining - 1);
  throw new Error(`SQLITE_FORCED ${channel} C:\\private\\textotheque.sqlite`);
}

function cloneDocument(document) {
  return { ...document };
}

app
  .whenReady()
  .then(async () => {
    ipcMain.handle('library:get-info', () => ({ ...libraryInfo }));
    ipcMain.handle('file:set-export-available', () => undefined);
    ipcMain.handle('file:export-text', () => ({ canceled: true, fileName: null }));
    ipcMain.handle('library:get-startup-notice', () => null);
    ipcMain.handle('library:backup', (event) => {
      rejectIfForced('library:backup');
      libraryBackupInvocations += 1;
      if (libraryBackupInvocations === 1) event.sender.send('library:menu-action', { action: 'backup' });
      return { canceled: true, path: null, fileName: null, error: null };
    });
    ipcMain.handle('library:choose-open', (event) => {
      libraryChooseOpenInvocations += 1;
      if (libraryChooseOpenInvocations === 1) event.sender.send('library:menu-action', { action: 'open' });
      return { status: 'canceled', inspection: null, library: null, backupPath: null };
    });
    ipcMain.handle('library:inspect', (event, candidatePath) => {
      libraryInspectInvocations += 1;
      if (libraryInspectInvocations === 1) event.sender.send('library:menu-action', { action: 'known', path: candidatePath });
      return {
        status: 'compatible',
        inspection: { path: candidatePath, fileName: path.basename(candidatePath), readable: true, applicationId: 1413830735, userVersion: 2, isTextotheque: true, compatibility: 'compatible' },
        library: null,
        backupPath: null,
      };
    });
    ipcMain.handle('library:choose-create', (event) => {
      libraryChooseCreateInvocations += 1;
      if (libraryChooseCreateInvocations === 1) event.sender.send('library:menu-action', { action: 'new' });
      return { status: 'canceled', path: null };
    });
    ipcMain.handle('library:create', () => ({ status: 'create-failed', library: null }));
    ipcMain.handle('library:open', (_event, candidatePath) => {
      libraryOpenInvocations += 1;
      libraryInfo = { ...libraryInfo, path: candidatePath, fileName: path.basename(candidatePath) };
      documents = [{
        id: 101,
        title: 'Document bibliothèque B',
        content: 'Contenu B',
        content_format: 'plain',
        status: 'active',
        favorite: 0,
        created_at: '2026-08-15T00:00:00.000Z',
        updated_at: '2026-08-15T00:00:00.000Z',
        last_opened_at: null,
        deleted_at: null,
        notes: '',
        folder_id: null,
      }];
      folders = [];
      return { status: 'opened', inspection: null, library: { ...libraryInfo }, backupPath: null };
    });
    ipcMain.handle('documents:list', () => {
      rejectIfForced('documents:list');
      return documents.filter((document) => !document.deleted_at).map(cloneDocument);
    });
    ipcMain.handle('documents:list-deleted', () => {
      rejectIfForced('documents:list-deleted');
      return documents.filter((document) => document.deleted_at).map(cloneDocument);
    });
    ipcMain.handle('documents:create', (_event, folderId = null) => {
      rejectIfForced('documents:create');
      const created = {
        ...documents[0],
        id: Math.max(...documents.map((document) => document.id)) + 1,
        title: '',
        content: '',
        status: 'draft',
        favorite: 0,
        deleted_at: null,
        folder_id: folderId,
      };
      documents = [created, ...documents];
      return cloneDocument(created);
    });
    ipcMain.handle('documents:get', (_event, id) => cloneDocument(documents.find((document) => document.id === id)));
    ipcMain.handle('documents:update', (_event, id, input) => {
      rejectIfForced('documents:update');
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
      rejectIfForced('documents:mark-opened');
      const document = documents.find((item) => item.id === id);
      document.last_opened_at = '2026-07-09T00:02:00.000Z';
      return cloneDocument(document);
    });
    ipcMain.handle('documents:trash', (_event, id) => {
      rejectIfForced('documents:trash');
      const document = documents.find((item) => item.id === id);
      document.deleted_at = '2026-07-09T00:04:00.000Z';
      document.updated_at = '2026-07-09T00:04:00.000Z';
      return cloneDocument(document);
    });
    ipcMain.handle('documents:restore', (_event, id) => {
      rejectIfForced('documents:restore');
      const document = documents.find((item) => item.id === id);
      document.deleted_at = null;
      document.updated_at = '2026-07-09T00:05:00.000Z';
      return cloneDocument(document);
    });
    ipcMain.handle('documents:empty-trash', () => {
      rejectIfForced('documents:empty-trash');
      const deletedCount = documents.filter((document) => document.deleted_at).length;
      documents = documents.filter((document) => !document.deleted_at);
      return deletedCount;
    });
    ipcMain.handle('folders:list', () => {
      rejectIfForced('folders:list');
      return folders.map((folder) => ({ ...folder }));
    });
    ipcMain.handle('folders:create', (_event, parentId) => {
      rejectIfForced('folders:create');
      const siblings = folders.filter((folder) => folder.parent_id === parentId);
      const folder = {
        id: folders.length === 0 ? 1 : Math.max(...folders.map((item) => item.id)) + 1,
        name: 'Nouveau dossier',
        parent_id: parentId,
        position: siblings.length + 1,
        created_at: '2026-07-09T00:06:00.000Z',
        updated_at: '2026-07-09T00:06:00.000Z',
      };
      folders = [...folders, folder];
      return { ...folder };
    });
    ipcMain.handle('folders:rename', (_event, id, name) => {
      rejectIfForced('folders:rename');
      const index = folders.findIndex((folder) => folder.id === id);
      folders[index] = {
        ...folders[index],
        name: name.trim() || 'Nouveau dossier',
        updated_at: '2026-07-09T00:07:00.000Z',
      };
      return { ...folders[index] };
    });
    ipcMain.handle('app:approve-close', () => undefined);

    const window = new BrowserWindow({
      width: 1020,
      height: 680,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'dist-electron', 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        partition: `textotheque-ui-safeguards-${process.pid}`,
      },
    });

    const rendererConsoleMessages = [];
    window.webContents.on('console-message', (_event, _level, message) => {
      rendererConsoleMessages.push(message);
    });

    forceFailures('documents:list');
    await window.loadURL(pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).toString());

    const initialFailureResult = await window.webContents.executeJavaScript(`
      (async () => {
        const unhandledRejections = [];
        window.addEventListener('unhandledrejection', (event) => unhandledRejections.push(String(event.reason)));
        const start = Date.now();
        while (Date.now() - start < 3000) {
          const message = document.querySelector('.error-message')?.textContent ?? '';
          if (message.includes('Impossible de charger les documents et les dossiers.')) {
            await new Promise((resolve) => setTimeout(resolve, 150));
            return {
              ok: document.querySelectorAll('.document-item').length === 0 &&
                !message.includes('SQLITE_FORCED') &&
                !message.includes('C:\\\\private') &&
                unhandledRejections.length === 0,
              message,
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        return { ok: false, message: 'initial load error missing' };
      })()
    `);
    if (!initialFailureResult.ok) {
      throw new Error(`Initial load failure check failed: ${initialFailureResult.message}`);
    }

    const recoveryResult = await window.webContents.executeJavaScript(`
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
        const findView = (text) =>
          Array.from(document.querySelectorAll('.nav-view-button')).find((button) => button.textContent.includes(text));
        findView('Corbeille').click();
        await new Promise((resolve) => setTimeout(resolve, 500));
        const trashSelected = document.querySelector('.nav-view-button.selected')?.textContent.includes('Corbeille');
        if (!trashSelected) {
          return {
            ok: false,
            selected: document.querySelector('.nav-view-button.selected')?.textContent ?? null,
            error: document.querySelector('.error-message')?.textContent ?? null,
            documentCount: document.querySelectorAll('.document-item').length,
          };
        }
        findView('Tous les textes').click();
        await waitFor(
          () => document.querySelector('.nav-view-button.selected')?.textContent.includes('Tous les textes'),
          'all documents recovery view'
        );
        await waitFor(() => document.querySelectorAll('.document-item').length >= 2, 'documents loaded after recovery');
        await waitFor(() => !document.querySelector('.error-message'), 'load error cleared after recovery');
        return { ok: true };
      })()
    `);
    if (!recoveryResult.ok) {
      throw new Error(`Initial load recovery failed: ${JSON.stringify(recoveryResult)}; console=${JSON.stringify(rendererConsoleMessages)}`);
    }

    const result = await window.webContents.executeJavaScript(`
      (async () => {
        const expectedAppVersion = ${JSON.stringify(packageVersion)};
        const waitFor = async (predicate, label) => {
          const start = Date.now();
          while (Date.now() - start < 3000) {
            const value = predicate();
            if (value) return value;
            await new Promise((resolve) => setTimeout(resolve, 30));
          }
          throw new Error('Timeout: ' + label);
        };
        const dispatchShortcut = (key, options = {}) => {
          const event = new KeyboardEvent('keydown', {
            key,
            bubbles: true,
            cancelable: true,
            ...options,
          });
          const dispatchResult = window.dispatchEvent(event);
          return { defaultPrevented: event.defaultPrevented, dispatchResult };
        };
        const findButtonByText = (selector, text) =>
          Array.from(document.querySelectorAll(selector)).find((button) => button.textContent.includes(text));
        const clickView = (text) => {
          const button = findButtonByText('.nav-view-button', text);
          if (!button) throw new Error('Vue introuvable: ' + text);
          button.click();
        };
        const folderTreeText = () => document.querySelector('.folder-section')?.textContent ?? '';
        const unfiledTreeText = () => document.querySelector('.unfiled-tree-section')?.textContent ?? '';

        await waitFor(() => document.querySelectorAll('.document-item').length >= 2, 'documents loaded');
        await waitFor(() => document.querySelector('.status-bar')?.textContent.includes('2 documents'), 'status total documents');
        await waitFor(() => document.querySelector('.status-bar')?.textContent.includes('Corbeille: 2'), 'status trash count');
        await waitFor(
          () => document.querySelector('.status-bar')?.textContent.includes('v' + expectedAppVersion),
          'status package version'
        );
        await waitFor(
          () => document.querySelector('.status-bar .library-name')?.textContent.includes('test-ui.sqlite'),
          'current library name in status bar'
        );
        if (document.querySelector('.status-bar .library-name').title !== ${JSON.stringify('C:\\temporary\\test-ui.sqlite')}) {
          throw new Error('current library full path tooltip missing');
        }
        if (document.querySelector('.library-backup-button') || document.querySelector('.library-open-button')) {
          throw new Error('occasional library actions should be removed from the toolbar');
        }
        const searchInput = document.querySelector('.search-input-row input');
        if (!searchInput) throw new Error('search input missing');
        if (window.innerWidth > 1020) throw new Error('reduced window test did not use the expected width');
        if (document.querySelector('.navigation-pane .search-input-row')) {
          throw new Error('search should not be rendered in the navigation pane');
        }
        if (!searchInput.closest('.editor-toolbar')) {
          throw new Error('search should be rendered in the editor toolbar');
        }
        const viewButtons = document.querySelectorAll('.nav-view-button');
        if (viewButtons.length !== 2) throw new Error('document view buttons missing');
        if (expectedAppVersion !== '0.1.20') throw new Error('unexpected application version');
        const initialExpandedState = JSON.parse(window.localStorage.getItem('textotheque:expanded-folders:v2') ?? '[]');
        if (initialExpandedState.length !== 0) throw new Error('folders should be closed by default');
        await waitFor(() => window.localStorage.getItem('textotheque:pane-layout:v2'), 'pane layout stored');
        const initialPaneLayout = JSON.parse(window.localStorage.getItem('textotheque:pane-layout:v2'));
        if (!initialPaneLayout.leftVisible || !initialPaneLayout.rightVisible) {
          throw new Error('both side panels should be visible by default');
        }
        if (document.querySelectorAll('.resize-handle').length !== 2) {
          throw new Error('both resize handles should be visible initially');
        }

        const shellRect = document.querySelector('.app-shell').getBoundingClientRect();
        const leftHandle = document.querySelector('.left-resize-handle');
        leftHandle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, buttons: 1, clientX: leftHandle.getBoundingClientRect().left }));
        window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, buttons: 1, clientX: shellRect.left + shellRect.width * 0.09 }));
        window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: shellRect.left + shellRect.width * 0.09 }));
        await waitFor(() => JSON.parse(window.localStorage.getItem('textotheque:pane-layout:v2')).left <= 10, 'compact left pane width stored');

        const rightHandle = document.querySelector('.right-resize-handle');
        rightHandle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, buttons: 1, clientX: rightHandle.getBoundingClientRect().left }));
        window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, buttons: 1, clientX: shellRect.right - shellRect.width * 0.09 }));
        window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: shellRect.right - shellRect.width * 0.09 }));
        await waitFor(() => JSON.parse(window.localStorage.getItem('textotheque:pane-layout:v2')).right <= 10, 'compact right pane width stored');

        const compactLayout = JSON.parse(window.localStorage.getItem('textotheque:pane-layout:v2'));
        const leftWidthBeforeHide = document.querySelector('.navigation-pane').getBoundingClientRect().width;
        const editorWidthWithBothPanels = document.querySelector('.editor-pane').getBoundingClientRect().width;
        document.querySelector('.toggle-navigation-button').click();
        await waitFor(() => !document.querySelector('.navigation-pane'), 'left pane hidden');
        if (document.querySelector('.left-resize-handle') || !document.querySelector('.metadata-pane')) {
          throw new Error('left pane hide should remove only its handle and pane');
        }
        if (document.querySelector('.editor-pane').getBoundingClientRect().width <= editorWidthWithBothPanels) {
          throw new Error('editor did not recover space from hidden left pane');
        }
        document.querySelector('.toggle-navigation-button').click();
        await waitFor(() => document.querySelector('.navigation-pane'), 'left pane reopened');
        if (Math.abs(document.querySelector('.navigation-pane').getBoundingClientRect().width - leftWidthBeforeHide) > 3) {
          throw new Error('left pane width was not restored');
        }

        document.querySelector('.toggle-metadata-button').click();
        await waitFor(() => !document.querySelector('.metadata-pane'), 'right pane hidden');
        if (document.querySelector('.right-resize-handle') || !document.querySelector('.navigation-pane')) {
          throw new Error('right pane hide should remove only its handle and pane');
        }
        document.querySelector('.toggle-navigation-button').click();
        await waitFor(() => !document.querySelector('.navigation-pane'), 'both panes hidden');
        if (document.querySelectorAll('.resize-handle').length !== 0) {
          throw new Error('hidden panels should not leave resize handles');
        }
        if (document.querySelector('.editor-pane').getBoundingClientRect().width < shellRect.width * 0.95) {
          throw new Error('editor should use almost the full width when both panes are hidden');
        }
        const statusWhilePanelsHidden = document.querySelector('.status-bar').getBoundingClientRect();
        if (statusWhilePanelsHidden.bottom > window.innerHeight + 1 || statusWhilePanelsHidden.height <= 0) {
          throw new Error('status bar should remain visible when both panels are hidden');
        }
        document.querySelector('.toggle-navigation-button').click();
        document.querySelector('.toggle-metadata-button').click();
        await waitFor(() => document.querySelector('.navigation-pane') && document.querySelector('.metadata-pane'), 'both panes reopened');
        const reopenedLayout = JSON.parse(window.localStorage.getItem('textotheque:pane-layout:v2'));
        if (reopenedLayout.left !== compactLayout.left || reopenedLayout.right !== compactLayout.right) {
          throw new Error('pane toggles should preserve compact widths');
        }

        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          .set.call(searchInput, 'ancien');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelectorAll('.document-item').length === 0, 'active search excludes trash');
        if (searchInput.type !== 'text' || document.querySelectorAll('.clear-search-button').length !== 1) {
          throw new Error('search should expose exactly one custom clear control');
        }

        document.querySelector('.clear-search-button').click();
        await waitFor(() => document.querySelector('.folder-section'), 'clear search returns to navigation');
        clickView('Tous les textes');
        await waitFor(() => document.querySelectorAll('.document-item').length >= 2, 'all documents restored after search');

        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          .set.call(searchInput, 'deuxieme');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelectorAll('.document-item').length === 1, 'search filters by title');
        if (!document.querySelector('.document-item')?.textContent.includes('Deuxieme document')) {
          throw new Error('title search result is incorrect');
        }
        await waitFor(() => document.querySelector('.status-bar')?.textContent.includes('1 affiches'), 'status filtered count');

        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          .set.call(searchInput, 'CONTENU INITIAL');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelectorAll('.document-item').length === 1, 'search filters by content case-insensitively');
        if (!document.querySelector('.document-item')?.textContent.includes('Premier document')) {
          throw new Error('content search result is incorrect');
        }

        document.querySelector('.clear-search-button').click();
        await waitFor(() => document.querySelector('.folder-section'), 'clear search restores navigation');
        clickView('Tous les textes');
        await waitFor(() => document.querySelectorAll('.document-item').length >= 2, 'all documents restored');

        document.querySelector('.toggle-navigation-button').click();
        await waitFor(() => !document.querySelector('.navigation-pane'), 'navigation hidden before Ctrl+F');
        document.querySelector('.toggle-metadata-button').click();
        await waitFor(() => !document.querySelector('.metadata-pane'), 'both panels hidden before Ctrl+F');
        const selectedTitleBeforeHiddenSearch = document.querySelector('.title-input')?.value;
        const ctrlFResult = dispatchShortcut('f', { ctrlKey: true });
        if (!ctrlFResult.defaultPrevented || ctrlFResult.dispatchResult !== false) {
          throw new Error('Ctrl+F did not prevent native search');
        }
        await waitFor(() => document.querySelector('.navigation-pane'), 'Ctrl+F reveals hidden navigation');
        if (document.querySelector('.metadata-pane')) {
          throw new Error('Ctrl+F should not reveal the metadata pane');
        }
        await waitFor(() => document.activeElement === document.querySelector('.search-input-row input'), 'Ctrl+F focuses search');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          .set.call(document.querySelector('.search-input-row input'), 'ancien');
        document.querySelector('.search-input-row input').dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelector('.search-input-row input').value === 'ancien', 'search text entered before escape');
        dispatchShortcut('Escape');
        await waitFor(() => document.querySelector('.search-input-row input').value === '', 'Escape clears focused search');
        await waitFor(() => !document.querySelector('.navigation-pane'), 'Escape restores temporarily hidden navigation state');
        if (document.querySelector('.title-input')?.value !== selectedTitleBeforeHiddenSearch) {
          throw new Error('hidden navigation search changed the selected document');
        }
        document.querySelector('.toggle-navigation-button').click();
        document.querySelector('.toggle-metadata-button').click();
        await waitFor(() => document.querySelector('.folder-section') && document.querySelector('.metadata-pane'), 'panels reopened after hidden search');

        document.querySelector('.folder-actions button[title="Nouveau dossier racine"]').click();
        await waitFor(() => document.querySelector('.folder-button')?.textContent.includes('Nouveau dossier'), 'folder created');
        await waitFor(() => document.querySelector('.status-bar')?.textContent.includes('Dossier: Nouveau dossier'), 'folder status context');
        document.querySelector('.folder-rename-button').click();
        await waitFor(() => document.querySelector('.folder-name-input'), 'folder rename input visible');
        document.querySelector('.folder-name-input').focus();
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          .set.call(document.querySelector('.folder-name-input'), 'Notes memoire');
        document.querySelector('.folder-name-input').dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 50));
        document.querySelector('.folder-name-input').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await waitFor(() => document.querySelector('.folder-button')?.textContent.includes('Notes memoire'), 'folder renamed in UI');
        if (!(await window.textotheque.listFolders()).some((folder) => folder.name === 'Notes memoire')) {
          throw new Error('renamed folder did not persist through API');
        }
        clickView('Tous les textes');
        await waitFor(() => Array.from(document.querySelectorAll('.document-item')).some((item) => item.textContent.includes('Premier document')), 'all view after folder creation');
        Array.from(document.querySelectorAll('.document-item'))
          .find((item) => item.textContent.includes('Premier document'))
          .click();
        await waitFor(() => document.querySelector('.title-input')?.value === 'Premier document', 'first document reselected');
        const folderSelect = Array.from(document.querySelectorAll('.metadata-pane select'))
          .find((select) => Array.from(select.options).some((option) => option.textContent.includes('Notes memoire')));
        if (!folderSelect) throw new Error('folder selector missing in metadata');
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(folderSelect, '1');
        folderSelect.dispatchEvent(new Event('change', { bubbles: true }));
        await waitFor(() => document.querySelector('.title-dirty-marker'), 'folder assignment marks document dirty');
        document.querySelector('.primary-button').click();
        await waitFor(() => !document.querySelector('.title-dirty-marker'), 'folder assignment saved');
        document.querySelector('.navigation-home').click();
        await waitFor(() => document.querySelector('.folder-section'), 'navigation restored after all texts');
        findButtonByText('.folder-button', 'Notes memoire').click();
        await waitFor(() => document.querySelector('.status-bar')?.textContent.includes('Dossier: Notes memoire'), 'folder view selected');
        await waitFor(
          () => folderTreeText().includes('Premier document'),
          'folder tree includes assigned document'
        );
        if (document.querySelector('.document-list')) {
          throw new Error('normal navigation should not duplicate documents in a separate list');
        }
        if (folderTreeText().includes('Deuxieme document')) {
          throw new Error('folder tree should not include unfiled document');
        }
        dispatchShortcut('n', { ctrlKey: true });
        await waitFor(() => document.querySelector('.title-input')?.value === '', 'Ctrl+N creates empty document in folder');
        if ((await window.textotheque.listDocuments()).find((item) => item.title === '')?.folder_id !== 1) {
          throw new Error('Ctrl+N in folder did not assign folder_id');
        }
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          .set.call(document.querySelector('.title-input'), 'Doc CtrlN dossier');
        document.querySelector('.title-input').dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.primary-button').click();
        await waitFor(
          () => folderTreeText().includes('Doc CtrlN dossier'),
          'Ctrl+N folder document visible immediately in tree'
        );
        document.querySelector('.icon-button').click();
        await waitFor(() => document.querySelector('.title-input')?.value === '', 'button plus creates empty document in folder');
        if ((await window.textotheque.listDocuments()).find((item) => item.title === '')?.folder_id !== 1) {
          throw new Error('button plus in folder did not assign folder_id');
        }
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          .set.call(document.querySelector('.title-input'), 'Doc bouton dossier');
        document.querySelector('.title-input').dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.primary-button').click();
        await waitFor(
          () => folderTreeText().includes('Doc bouton dossier'),
          'button plus folder document visible immediately in tree'
        );
        if (!document.querySelector('.folder-button')?.textContent.includes('3')) {
          throw new Error('folder direct document counter did not update');
        }
        document.querySelector('.folder-actions button[title="Nouveau sous-dossier"]').click();
        await waitFor(() => Array.from(document.querySelectorAll('.folder-button')).some((item) => item.textContent.includes('Nouveau dossier')), 'subfolder created');
        dispatchShortcut('n', { ctrlKey: true });
        await waitFor(() => document.querySelector('.title-input')?.value === '', 'Ctrl+N creates empty document in subfolder');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          .set.call(document.querySelector('.title-input'), 'Doc sous dossier');
        document.querySelector('.title-input').dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.primary-button').click();
        await waitFor(
          () => folderTreeText().includes('Doc sous dossier'),
          'subfolder document visible in folder tree'
        );
        if ((await window.textotheque.listDocuments()).find((item) => item.title === 'Doc sous dossier')?.folder_id !== 2) {
          throw new Error('subfolder document did not keep subfolder folder_id');
        }
        Array.from(document.querySelectorAll('.folder-button'))
          .find((item) => item.textContent.includes('Notes memoire'))
          .click();
        await waitFor(() => document.querySelector('.status-bar')?.textContent.includes('Dossier: Notes memoire'), 'parent folder reselected');
        const titleBeforeToggle = document.querySelector('.title-input').value;
        const parentFolderRow = () =>
          Array.from(document.querySelectorAll('.folder-row'))
            .find((row) => row.querySelector('.folder-button')?.textContent.includes('Notes memoire'));
        parentFolderRow().querySelector('.folder-toggle-button').click();
        await waitFor(() => !folderTreeText().includes('Doc bouton dossier'), 'collapsed folder hides direct documents');
        if (folderTreeText().includes('Doc sous dossier')) {
          throw new Error('collapsed folder should hide subfolder documents');
        }
        if (folderTreeText().includes('Nouveau dossier')) {
          throw new Error('collapsed folder should hide subfolders');
        }
        if (!parentFolderRow().querySelector('.folder-button')?.textContent.includes('3')) {
          throw new Error('collapsed folder should keep direct document counter visible');
        }
        const expandedAfterCollapse = JSON.parse(window.localStorage.getItem('textotheque:expanded-folders:v2') ?? '[]');
        if (expandedAfterCollapse.includes(1)) {
          throw new Error('collapsed folder should be removed from expanded localStorage state');
        }
        if (document.querySelector('.title-input').value !== titleBeforeToggle) {
          throw new Error('folder toggle should not open another document');
        }
        parentFolderRow().querySelector('.folder-toggle-button').click();
        await waitFor(() => folderTreeText().includes('Doc bouton dossier'), 'expanded folder shows direct documents again');
        await waitFor(() => folderTreeText().includes('Nouveau dossier'), 'expanded folder shows subfolder again');
        document.querySelector('.collapse-all-folders').click();
        await waitFor(() => !folderTreeText().includes('Doc bouton dossier'), 'collapse all hides folder documents');
        document.querySelector('.expand-all-folders').click();
        await waitFor(() => folderTreeText().includes('Doc sous dossier'), 'expand all shows descendants');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          .set.call(document.querySelector('.search-input-row input'), 'Doc bouton');
        document.querySelector('.search-input-row input').dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelectorAll('.document-item').length === 1, 'global search from folder view');
        document.querySelector('.clear-search-button').click();
        await waitFor(() => document.querySelector('.unfiled-tree-section'), 'unfiled tree section visible after search');
        document.querySelector('.pseudo-folder-row .folder-button').click();
        await waitFor(
          () => unfiledTreeText().includes('Deuxieme document'),
          'unfiled tree includes unfiled document'
        );
        if (unfiledTreeText().includes('Premier document')) {
          throw new Error('unfiled tree should exclude foldered document');
        }
        if (unfiledTreeText().includes('Doc CtrlN dossier')) {
          throw new Error('folder-created document should not appear in unfiled tree');
        }
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          .set.call(document.querySelector('.search-input-row input'), 'Premier');
        document.querySelector('.search-input-row input').dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelectorAll('.document-item').length === 1, 'search is global from unfiled view');
        if (!document.querySelector('.document-item')?.textContent.includes('Premier document')) {
          throw new Error('global search did not find foldered document from unfiled view');
        }
        document.querySelector('.clear-search-button').click();
        await waitFor(() => findButtonByText('.nav-view-button', 'Tous les textes'), 'view buttons restored after global search');
        clickView('Tous les textes');
        await waitFor(() => document.querySelectorAll('.document-item').length >= 2, 'all view restored after folder tests');
        Array.from(document.querySelectorAll('.document-item'))
          .find((item) => item.textContent.includes('Premier document'))
          .click();
        await waitFor(() => document.querySelector('.title-input')?.value === 'Premier document', 'first document selected after folder tests');
        document.querySelector('.navigation-home').click();
        await waitFor(() => folderTreeText().includes('Premier document'), 'selected document path reopened in navigation');
        clickView('Tous les textes');
        await waitFor(() => document.querySelectorAll('.document-item').length >= 2, 'all view reopened after reveal check');

        const firstTitle = document.querySelector('.title-input');
        const editor = document.querySelector('.content-editor');
        if (!firstTitle || !editor) throw new Error('editor missing');

        dispatchShortcut('F2');
        await waitFor(() => document.activeElement === document.querySelector('.title-input'), 'F2 focuses title');

        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
          .set.call(editor, 'Contenu initial modifie par raccourci');
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelector('.title-dirty-marker'), 'dirty marker visible');
        await waitFor(() => document.querySelector('.status-bar')?.textContent.includes('Modifie'), 'status dirty state');
        await window.textotheque.chooseOpenLibrary();
        await waitFor(() => document.querySelector('.confirm-dialog'), 'library switch respects dirty confirmation');
        document.querySelector('.confirm-dialog .secondary-button').click();
        await waitFor(() => !document.querySelector('.confirm-dialog'), 'library switch confirmation canceled');
        if (!document.querySelector('.title-dirty-marker')) {
          throw new Error('canceling a dirty library switch cleared pending edits');
        }
        await window.textotheque.chooseCreateLibrary();
        await waitFor(() => document.querySelector('.confirm-dialog'), 'new library respects dirty confirmation');
        document.querySelector('.confirm-dialog .secondary-button').click();
        await waitFor(() => !document.querySelector('.confirm-dialog'), 'new library confirmation canceled');
        await window.textotheque.inspectLibrary('C:\\temporary\\known.sqlite');
        await waitFor(() => document.querySelector('.confirm-dialog'), 'known library respects dirty confirmation');
        document.querySelector('.confirm-dialog .secondary-button').click();
        await waitFor(() => !document.querySelector('.confirm-dialog'), 'known library confirmation canceled');
        await window.textotheque.backupLibrary();
        await waitFor(
          () => document.querySelector('.error-message')?.textContent.includes('Sauvegardez le document avant'),
          'dirty backup refused'
        );
        if (!document.querySelector('.title-dirty-marker')) {
          throw new Error('dirty backup refusal cleared pending edits');
        }
        const dirtyTitleBeforeToggle = document.querySelector('.title-input').value;
        document.querySelector('.toggle-navigation-button').click();
        await waitFor(() => !document.querySelector('.navigation-pane'), 'left pane hidden with dirty document');
        if (!document.querySelector('.title-dirty-marker') || document.querySelector('.title-input').value !== dirtyTitleBeforeToggle) {
          throw new Error('left pane toggle lost selection or dirty state');
        }
        document.querySelector('.toggle-navigation-button').click();
        await waitFor(() => document.querySelector('.navigation-pane'), 'left pane restored with dirty document');

        const notesBeforeToggle = 'Note conservee pendant le masquage';
        const notesEditor = document.querySelector('.notes-editor');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(notesEditor, notesBeforeToggle);
        notesEditor.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.toggle-metadata-button').click();
        await waitFor(() => !document.querySelector('.metadata-pane'), 'right pane hidden with edited metadata');
        document.querySelector('.toggle-metadata-button').click();
        await waitFor(() => document.querySelector('.notes-editor'), 'right pane restored with edited metadata');
        if (document.querySelector('.notes-editor').value !== notesBeforeToggle || !document.querySelector('.title-dirty-marker')) {
          throw new Error('right pane toggle lost metadata or dirty state');
        }
        dispatchShortcut('n', { ctrlKey: true });
        await waitFor(() => document.querySelector('.confirm-dialog'), 'Ctrl+N respects dirty confirmation');
        dispatchShortcut('Escape');
        await waitFor(() => !document.querySelector('.confirm-dialog'), 'Escape cancels dirty confirmation');
        if (document.querySelector('.title-input').value !== 'Premier document') {
          throw new Error('Escape confirmation changed current document');
        }
        dispatchShortcut('s', { ctrlKey: true });
        await waitFor(() => !document.querySelector('.title-dirty-marker'), 'Ctrl+S clears dirty marker');
        await waitFor(() => document.querySelector('.status-bar')?.textContent.includes('Sauvegarde'), 'Ctrl+S updates status');

        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
          .set.call(document.querySelector('.content-editor'), 'Contenu initial modifie');
        document.querySelector('.content-editor').dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelector('.title-dirty-marker'), 'dirty marker visible again');
        Array.from(document.querySelectorAll('.document-item'))
          .find((item) => item.textContent.includes('Deuxieme document'))
          .click();
        await waitFor(() => document.querySelector('.confirm-dialog'), 'discard confirmation visible');
        document.querySelector('.confirm-dialog .secondary-button').click();
        await waitFor(() => !document.querySelector('.confirm-dialog'), 'discard confirmation cancelled');
        if (document.querySelector('.title-input').value !== 'Premier document') {
          throw new Error('selection changed after confirmation cancel');
        }

        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
          .set.call(editor, 'Contenu initial modifie encore');
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelector('.content-editor').value === 'Contenu initial modifie encore', 'editor editable after cancel');

        Array.from(document.querySelectorAll('.document-item'))
          .find((item) => item.textContent.includes('Deuxieme document'))
          .click();
        await waitFor(() => document.querySelector('.confirm-dialog'), 'discard confirmation visible again');
        document.querySelector('.confirm-dialog .danger-button').click();
        await waitFor(() => document.querySelector('.title-input').value === 'Deuxieme document', 'target document selected');
        const targetEditor = document.querySelector('.content-editor');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
          .set.call(targetEditor, 'Document cible modifie');
        targetEditor.dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelector('.content-editor').value === 'Document cible modifie', 'target editor editable after confirm');

        document.querySelector('.primary-button').click();
        await waitFor(() => !document.querySelector('.title-dirty-marker'), 'dirty marker cleared');

        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
          .set.call(document.querySelector('.content-editor'), 'Document cible non sauvegarde');
        document.querySelector('.content-editor').dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.trash-button').click();
        await waitFor(
          () => document.querySelector('.error-message')?.textContent.includes('Sauvegardez'),
          'dirty document trash guard visible'
        );
        if (document.querySelector('.confirm-dialog')) {
          throw new Error('dirty document should not open trash confirmation');
        }
        if (!document.querySelector('.title-input').value.includes('Deuxieme document')) {
          throw new Error('dirty trash guard changed selection');
        }
        document.querySelector('.primary-button').click();
        await waitFor(() => !document.querySelector('.title-dirty-marker'), 'dirty document saved before trash');

        document.querySelector('.trash-button').click();
        await waitFor(() => document.querySelector('.confirm-dialog'), 'trash confirmation visible');
        document.querySelector('.confirm-dialog .danger-button').click();
        await waitFor(
          () => Array.from(document.querySelectorAll('.document-item')).every((item) => !item.textContent.includes('Deuxieme document')),
          'trashed document removed from active list'
        );
        if ((await window.textotheque.listDocuments()).length + (await window.textotheque.listDeletedDocuments()).length !== 7) {
          throw new Error('trash operation deleted a document permanently');
        }

        clickView('Corbeille');
        await waitFor(() => document.querySelector('.status-bar')?.textContent.includes('Corbeille'), 'trash status context');
        await waitFor(
          () => Array.from(document.querySelectorAll('.document-item')).some((item) => item.textContent.includes('Deuxieme document')),
          'trashed document appears in trash'
        );
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          .set.call(document.querySelector('.search-input-row input'), 'premier');
        document.querySelector('.search-input-row input').dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelectorAll('.document-item').length === 1, 'search remains global from trash');
        if (!document.querySelector('.document-item')?.textContent.includes('Premier document')) {
          throw new Error('global search from trash did not return active document');
        }
        document.querySelector('.clear-search-button').click();
        await waitFor(() => document.querySelector('.folder-section'), 'trash search clear returns navigation');
        clickView('Corbeille');
        await waitFor(() => document.querySelectorAll('.document-item').length >= 2, 'trash view restored explicitly');
        Array.from(document.querySelectorAll('.document-item'))
          .find((item) => item.textContent.includes('Deuxieme document'))
          .click();
        await waitFor(() => document.querySelector('.title-input').value === 'Deuxieme document', 'trashed document selected');
        if (document.querySelector('.content-editor').disabled !== true) {
          throw new Error('trashed document editor should be read-only');
        }
        if (document.querySelector('.content-editor').value !== 'Document cible non sauvegarde') {
          throw new Error('trashed document content was not preserved');
        }
        document.querySelector('.primary-button').click();
        await waitFor(() => document.querySelector('.status-bar')?.textContent.includes('Tous les textes'), 'restored active status context');
        await waitFor(
          () => Array.from(document.querySelectorAll('.document-item')).some((item) => item.textContent.includes('Deuxieme document')),
          'restored document appears in active list'
        );
        if (document.querySelector('.content-editor').disabled) {
          throw new Error('restored document editor should be editable');
        }
        clickView('Corbeille');
        await waitFor(() => document.querySelector('.empty-trash-button'), 'empty trash button visible');
        if (document.querySelector('.empty-trash-button').disabled) {
          throw new Error('empty trash button should be enabled with trashed documents');
        }
        const countBeforeCancel =
          (await window.textotheque.listDocuments()).length + (await window.textotheque.listDeletedDocuments()).length;
        document.querySelector('.empty-trash-button').click();
        await waitFor(() => document.querySelector('.confirm-dialog'), 'empty trash confirmation visible');
        if (!document.querySelector('.confirm-dialog')?.textContent.includes('2 document(s)')) {
          throw new Error('empty trash confirmation count is incorrect');
        }
        document.querySelector('.confirm-dialog .secondary-button').click();
        await waitFor(() => !document.querySelector('.confirm-dialog'), 'empty trash cancellation closes dialog');
        const countAfterCancel =
          (await window.textotheque.listDocuments()).length + (await window.textotheque.listDeletedDocuments()).length;
        if (countAfterCancel !== countBeforeCancel || (await window.textotheque.listDeletedDocuments()).length !== 2) {
          throw new Error('empty trash cancellation removed documents');
        }
        document.querySelector('.empty-trash-button').click();
        await waitFor(() => document.querySelector('.confirm-dialog'), 'empty trash confirmation visible again');
        document.querySelector('.confirm-dialog .danger-button').click();
        await waitFor(() => document.querySelector('.empty-state')?.textContent.includes('La corbeille est vide'), 'trash view empty after emptying');
        if ((await window.textotheque.listDeletedDocuments()).length !== 0) {
          throw new Error('empty trash did not remove trashed documents');
        }
        const activeAfterEmpty = await window.textotheque.listDocuments();
        if (activeAfterEmpty.length !== 5 || !activeAfterEmpty.some((item) => item.title === 'Premier document')) {
          throw new Error('empty trash removed active documents');
        }
        if (!document.querySelector('.empty-trash-button').disabled) {
          throw new Error('empty trash button should be disabled when trash is empty');
        }
        await waitFor(() => document.querySelector('.status-bar')?.textContent.includes('0 documents'), 'trash status count after empty');

        if (document.querySelectorAll('.resize-handle').length !== 2) throw new Error('resize handles missing');
        await waitFor(() => window.localStorage.getItem('textotheque:pane-layout:v2'), 'pane layout remains stored');
        const statusRect = document.querySelector('.status-bar').getBoundingClientRect();
        if (statusRect.bottom > window.innerHeight + 1 || statusRect.height <= 0) {
          throw new Error(
            'status bar is not visible after pane resize: ' +
              JSON.stringify({
                bottom: statusRect.bottom,
                height: statusRect.height,
                innerHeight: window.innerHeight,
              })
          );
        }

        dispatchShortcut('n', { ctrlKey: true });
        await waitFor(() => document.querySelector('.title-input')?.value === '', 'new document title is empty');
        if (document.querySelector('.title-input').placeholder !== 'Sans titre') {
          throw new Error('Untitled fallback is not used as title placeholder');
        }
        await waitFor(() => document.querySelector('.unfiled-tree-section')?.textContent.includes('Sans titre'), 'untitled fallback visible in navigation');
        const newTitleInput = document.querySelector('.title-input');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          .set.call(newTitleInput, 'Titre saisi directement');
        newTitleInput.dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelector('.title-input').value === 'Titre saisi directement', 'direct title typing works');
        await waitFor(() => document.querySelector('.title-dirty-marker'), 'new title dirty marker visible');
        document.querySelector('.primary-button').click();
        await waitFor(() => !document.querySelector('.title-dirty-marker'), 'new title saved');

        document.querySelector('.toggle-metadata-button').click();
        await waitFor(() => !document.querySelector('.metadata-pane'), 'right pane hidden before reload');
        await waitFor(
          () => JSON.parse(window.localStorage.getItem('textotheque:pane-layout:v2')).rightVisible === false,
          'hidden right pane persisted before reload'
        );
        return {
          ok: true,
          paneLayoutBeforeReload: JSON.parse(window.localStorage.getItem('textotheque:pane-layout:v2')),
        };
      })().catch((error) => ({ ok: false, errorStack: error.stack }))
    `);

    if (!result.ok) {
      throw new Error(`UI safeguards check failed: ${result.errorStack ?? 'unknown error'}`);
    }
    if (libraryBackupInvocations !== 1) {
      throw new Error(`Dirty backup should stop the menu workflow before a second IPC call, got ${libraryBackupInvocations}.`);
    }
    if (libraryChooseOpenInvocations !== 1 || libraryChooseCreateInvocations !== 1 || libraryInspectInvocations !== 1) {
      throw new Error('A dirty menu action reached its library IPC after cancellation.');
    }

    forceFailures('library:backup');
    window.webContents.send('library:menu-action', { action: 'backup' });
    const backupFailureResult = await window.webContents.executeJavaScript(`
      (async () => {
        const start = Date.now();
        while (Date.now() - start < 3000) {
          const message = document.querySelector('.error-message')?.textContent ?? '';
          if (message.includes('Impossible de créer la sauvegarde de la bibliothèque.')) {
            return {
              ok: !document.querySelector('.success-message') &&
                !message.includes('SQLITE_FORCED') &&
                !message.includes('C:\\private'),
              message,
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        return { ok: false, message: 'library backup error feedback missing' };
      })()
    `);
    if (!backupFailureResult.ok) {
      throw new Error(`Library backup failure feedback check failed: ${backupFailureResult.message}`);
    }

    await new Promise((resolve) => {
      window.webContents.once('did-finish-load', resolve);
      window.webContents.reload();
    });

    const panePersistenceResult = await window.webContents.executeJavaScript(`
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
        await waitFor(() => document.querySelector('.title-input'), 'application restored after reload');
        const layout = JSON.parse(window.localStorage.getItem('textotheque:pane-layout:v2'));
        if (
          layout.left !== ${JSON.stringify(result.paneLayoutBeforeReload.left)} ||
          layout.right !== ${JSON.stringify(result.paneLayoutBeforeReload.right)} ||
          layout.leftVisible !== true ||
          layout.rightVisible !== false
        ) {
          return { ok: false, message: 'pane layout did not survive reload', layout };
        }
        if (!document.querySelector('.navigation-pane') || document.querySelector('.metadata-pane')) {
          return { ok: false, message: 'pane visibility did not survive reload', layout };
        }
        document.querySelector('.toggle-metadata-button').click();
        await waitFor(() => document.querySelector('.metadata-pane'), 'metadata pane reopened after reload');
        return { ok: true };
      })().catch((error) => ({ ok: false, message: error.stack }))
    `);
    if (!panePersistenceResult.ok) {
      throw new Error(`Pane persistence check failed: ${panePersistenceResult.message}; ${JSON.stringify(panePersistenceResult.layout)}`);
    }

    forceFailures('documents:create');
    const createFailureResult = await window.webContents.executeJavaScript(`
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
        window.__ipcUnhandledRejections = [];
        window.addEventListener('unhandledrejection', (event) => {
          window.__ipcUnhandledRejections.push(String(event.reason));
        });
        const beforeCount = (await window.textotheque.listDocuments()).length;
        const beforeTitle = document.querySelector('.title-input')?.value;
        document.querySelector('.pane-header .icon-button').click();
        const message = await waitFor(
          () => document.querySelector('.error-message')?.textContent,
          'create failure message'
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
        return {
          ok: message.includes('Impossible de creer le document.') &&
            !message.includes('SQLITE_FORCED') &&
            (await window.textotheque.listDocuments()).length === beforeCount &&
            document.querySelector('.title-input')?.value === beforeTitle &&
            window.__ipcUnhandledRejections.length === 0,
          message,
        };
      })()
    `);
    if (!createFailureResult.ok) {
      throw new Error(`Create failure check failed: ${createFailureResult.message}`);
    }

    forceFailures('documents:update');
    const saveFailureResult = await window.webContents.executeJavaScript(`
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
        const selectedId = Number(document.querySelector('.status-bar')?.textContent.match(/Document (\\d+)/)?.[1]);
        const persistedBefore = (await window.textotheque.listDocuments()).find((item) => item.id === selectedId)?.content;
        const editor = document.querySelector('.content-editor');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
          .set.call(editor, 'Contenu refuse par SQLite');
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.primary-button').click();
        const message = await waitFor(
          () => {
            const text = document.querySelector('.error-message')?.textContent ?? '';
            return text.includes('Impossible de sauvegarder le document.') ? text : null;
          },
          'save failure message'
        );
        await waitFor(() => document.querySelector('.save-state.error'), 'save failure state');
        const persistedAfterFailure = (await window.textotheque.listDocuments()).find((item) => item.id === selectedId)?.content;
        const failureStateIsCorrect = Boolean(document.querySelector('.title-dirty-marker')) &&
          persistedAfterFailure === persistedBefore &&
          message.includes('Impossible de sauvegarder le document.') &&
          !message.includes('SQLITE_FORCED');

        document.querySelector('.primary-button').click();
        await waitFor(() => !document.querySelector('.title-dirty-marker'), 'successful save after failure');
        await waitFor(() => !document.querySelector('.error-message'), 'old save error cleared');
        return {
          ok: failureStateIsCorrect && window.__ipcUnhandledRejections.length === 0,
          message,
        };
      })()
    `);
    if (!saveFailureResult.ok) {
      throw new Error(`Save failure check failed: ${saveFailureResult.message}`);
    }

    forceFailures('folders:rename');
    const folderFailureResult = await window.webContents.executeJavaScript(`
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
        const persistedBefore = (await window.textotheque.listFolders())[0];
        const firstRow = document.querySelector('.folder-row');
        firstRow.querySelector('.folder-button').click();
        const renameButton = await waitFor(
          () => firstRow.querySelector('.folder-rename-button'),
          'folder rename button'
        );
        renameButton.click();
        const input = await waitFor(() => firstRow.querySelector('.folder-name-input'), 'folder rename input');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Nom refuse');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        const message = await waitFor(
          () => {
            const text = document.querySelector('.error-message')?.textContent ?? '';
            return text.includes('Impossible de renommer le dossier.') ? text : null;
          },
          'folder rename failure message'
        );
        const persistedAfter = (await window.textotheque.listFolders())[0];
        return {
          ok: message.includes('Impossible de renommer le dossier.') &&
            persistedAfter.name === persistedBefore.name &&
            !document.querySelector('.folder-section')?.textContent.includes('Nom refuse') &&
            window.__ipcUnhandledRejections.length === 0,
          message,
        };
      })()
    `);
    if (!folderFailureResult.ok) {
      throw new Error(`Folder failure check failed: ${folderFailureResult.message}`);
    }

    forceFailures('documents:trash');
    const trashFailureResult = await window.webContents.executeJavaScript(`
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
        const selectedId = Number(document.querySelector('.status-bar')?.textContent.match(/Document (\\d+)/)?.[1]);
        document.querySelector('.trash-button').click();
        const dialog = await waitFor(() => document.querySelector('.confirm-dialog'), 'trash failure confirmation');
        dialog.querySelector('.danger-button').click();
        const message = await waitFor(
          () => {
            const text = document.querySelector('.error-message')?.textContent ?? '';
            return text.includes('Impossible de deplacer le document vers la corbeille.') ? text : null;
          },
          'trash failure message'
        );
        const activeDocument = (await window.textotheque.listDocuments()).find((item) => item.id === selectedId);
        return {
          ok: message.includes('Impossible de deplacer le document vers la corbeille.') &&
            Boolean(activeDocument) &&
            Number(document.querySelector('.status-bar')?.textContent.match(/Document (\\d+)/)?.[1]) === selectedId &&
            window.__ipcUnhandledRejections.length === 0,
          message,
        };
      })()
    `);
    if (!trashFailureResult.ok) {
      throw new Error(`Trash failure check failed: ${trashFailureResult.message}`);
    }

    await window.webContents.executeJavaScript(`
      (() => {
        const input = document.querySelector('.search-input-row input');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'ancienne recherche');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);
    window.webContents.send('library:menu-action', { action: 'known', path: 'C:\\temporary\\library-b.sqlite' });
    const switchResult = await window.webContents.executeJavaScript(`
      (async () => {
        const start = Date.now();
        while (Date.now() - start < 3000) {
          const libraryName = document.querySelector('.status-bar .library-name')?.textContent ?? '';
          const workspaceText = document.querySelector('.app-shell')?.textContent ?? '';
          if (libraryName.includes('library-b.sqlite') && document.querySelector('.status-bar')?.textContent.includes('1 document')) {
            return {
              ok: !document.querySelector('.title-input') &&
                document.querySelector('.search-input-row input')?.value === '' &&
                document.querySelector('.status-bar')?.textContent.includes('1 document') &&
                !workspaceText.includes('Premier document'),
              libraryName,
              workspaceText,
            };
          }
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        return {
          ok: false,
          message: 'successful known-library switch did not refresh the UI',
          dialog: document.querySelector('.confirm-dialog')?.textContent ?? null,
          error: document.querySelector('.error-message')?.textContent ?? null,
          library: document.querySelector('.status-bar .library-name')?.textContent ?? null,
        };
      })()
    `);
    if (!switchResult.ok) {
      throw new Error(`Known library UI refresh check failed: ${JSON.stringify(switchResult)}; inspect=${libraryInspectInvocations}; open=${libraryOpenInvocations}`);
    }

    const unexpectedRejectionLog = rendererConsoleMessages.find((message) =>
      /UnhandledPromiseRejection|Unhandled Promise Rejection|uncaught \(in promise\)/i.test(message)
    );
    if (unexpectedRejectionLog) {
      throw new Error(`Unexpected unhandled rejection log: ${unexpectedRejectionLog}`);
    }

    console.log('ui safeguards ok');
    window.close();
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
