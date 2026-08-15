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
        if (expectedAppVersion !== '0.1.14') throw new Error('unexpected application version');
        const initialExpandedState = JSON.parse(window.localStorage.getItem('textotheque:expanded-folders:v2') ?? '[]');
        if (initialExpandedState.length !== 0) throw new Error('folders should be closed by default');

        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          .set.call(searchInput, 'ancien');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelectorAll('.document-item').length === 0, 'active search excludes trash');

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

        const ctrlFResult = dispatchShortcut('f', { ctrlKey: true });
        if (!ctrlFResult.defaultPrevented || ctrlFResult.dispatchResult !== false) {
          throw new Error('Ctrl+F did not prevent native search');
        }
        await waitFor(() => document.activeElement === document.querySelector('.search-input-row input'), 'Ctrl+F focuses search');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          .set.call(document.querySelector('.search-input-row input'), 'ancien');
        document.querySelector('.search-input-row input').dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelector('.search-input-row input').value === 'ancien', 'search text entered before escape');
        dispatchShortcut('Escape');
        await waitFor(() => document.querySelector('.search-input-row input').value === '', 'Escape clears focused search');
        await waitFor(() => document.querySelector('.folder-section'), 'Escape returns to navigation');

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

        const handles = document.querySelectorAll('.resize-handle');
        if (handles.length !== 2) throw new Error('resize handles missing');
        handles[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 280 }));
        window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 340 }));
        window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 340 }));
        await waitFor(() => window.localStorage.getItem('textotheque:pane-widths:v1'), 'pane widths stored');
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

        return { ok: true };
      })().catch((error) => ({ ok: false, errorStack: error.stack }))
    `);

    if (!result.ok) {
      throw new Error(`UI safeguards check failed: ${result.errorStack ?? 'unknown error'}`);
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
