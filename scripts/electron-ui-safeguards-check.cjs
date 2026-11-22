const path = require('node:path');
const fs = require('node:fs');
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
let specialDocumentInvocations = 0;
const catalogRequests = [];
const searchRequests = [];
const savedSearchWrites = [];
let savedSearches = [];
let nextSavedSearchId = 1;
let latestSearchMenuState = null;
let libraryInfo = {
  path: 'C:\\temporary\\test-ui.sqlite',
  fileName: 'test-ui.sqlite',
  applicationId: 1413830735,
  userVersion: 5,
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
  return { special_role: null, ...document };
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
        inspection: { path: candidatePath, fileName: path.basename(candidatePath), readable: true, applicationId: 1413830735, userVersion: 5, isTextotheque: true, compatibility: 'compatible' },
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
      savedSearches = [{
        id: 1,
        name: 'Gaming B',
        query: 'contenu',
        fields: ['title', 'content', 'notes'],
        matchMode: 'all',
        folderSelection: { folderIds: [], includeUnclassified: false },
        statuses: [],
        favoriteOnly: false,
        created: { period: 'all', from: null, to: null },
        modified: { period: 'all', from: null, to: null },
        sortBy: 'relevance',
        direction: 'asc',
        createdAt: '2026-08-16T00:00:00.000Z',
        updatedAt: '2026-08-16T00:00:00.000Z',
      }];
      nextSavedSearchId = 2;
      return { status: 'opened', inspection: null, library: { ...libraryInfo }, backupPath: null };
    });
    ipcMain.handle('saved-searches:list', () => savedSearches
      .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
      .sort((left, right) => left.name.localeCompare(right.name)));
    ipcMain.handle('saved-searches:get', (_event, id) => {
      const found = savedSearches.find((item) => item.id === id);
      return found ? JSON.parse(JSON.stringify(found)) : null;
    });
    ipcMain.handle('saved-searches:create', (_event, input, expectedLibraryPath) => {
      if (expectedLibraryPath !== libraryInfo.path) throw new Error('contexte bibliotheque modifie');
      if (savedSearches.some((item) => item.name === input.name.trim())) throw new Error('nom duplique');
      const now = '2026-08-16T12:00:00.000Z';
      const created = { id: nextSavedSearchId++, ...JSON.parse(JSON.stringify(input)), name: input.name.trim(), createdAt: now, updatedAt: now };
      savedSearches.push(created);
      savedSearchWrites.push({ action: 'create', libraryPath: expectedLibraryPath, id: created.id });
      return JSON.parse(JSON.stringify(created));
    });
    ipcMain.handle('saved-searches:update', (_event, id, criteria, expectedLibraryPath) => {
      if (expectedLibraryPath !== libraryInfo.path) throw new Error('contexte bibliotheque modifie');
      const index = savedSearches.findIndex((item) => item.id === id);
      if (index < 0) throw new Error('introuvable');
      savedSearches[index] = { ...savedSearches[index], ...JSON.parse(JSON.stringify(criteria)), updatedAt: '2026-08-16T12:01:00.000Z' };
      savedSearchWrites.push({ action: 'update', libraryPath: expectedLibraryPath, id });
      return JSON.parse(JSON.stringify(savedSearches[index]));
    });
    ipcMain.handle('saved-searches:rename', (_event, id, name, expectedLibraryPath) => {
      if (expectedLibraryPath !== libraryInfo.path) throw new Error('contexte bibliotheque modifie');
      const found = savedSearches.find((item) => item.id === id);
      if (!found) throw new Error('introuvable');
      found.name = name.trim();
      found.updatedAt = '2026-08-16T12:02:00.000Z';
      savedSearchWrites.push({ action: 'rename', libraryPath: expectedLibraryPath, id });
      return JSON.parse(JSON.stringify(found));
    });
    ipcMain.handle('saved-searches:delete', (_event, id, expectedLibraryPath) => {
      if (expectedLibraryPath !== libraryInfo.path) throw new Error('contexte bibliotheque modifie');
      savedSearches = savedSearches.filter((item) => item.id !== id);
      savedSearchWrites.push({ action: 'delete', libraryPath: expectedLibraryPath, id });
    });
    ipcMain.handle('search:set-menu-state', (_event, state) => { latestSearchMenuState = { ...state }; });
    ipcMain.handle('documents:list', () => {
      rejectIfForced('documents:list');
      return documents.filter((document) => !document.deleted_at).map(cloneDocument);
    });
    ipcMain.handle('documents:list-catalog', (_event, options) => {
      rejectIfForced('documents:list-catalog');
      catalogRequests.push({ ...options });
      const direction = options.direction === 'asc' ? 1 : -1;
      const folderName = (document) => folders.find((folder) => folder.id === document.folder_id)?.name ?? null;
      const valueFor = (row) => {
        if (options.sortBy === 'folder') return row.folderName ?? '';
        if (options.sortBy === 'favorite') return Number(row.favorite);
        if (options.sortBy === 'created_at') return row.createdAt;
        if (options.sortBy === 'updated_at') return row.updatedAt;
        return row[options.sortBy];
      };
      return documents
        .filter((document) => !document.deleted_at)
        .map((document) => ({
          id: document.id,
          title: document.title,
          folderId: document.folder_id,
          folderName: folderName(document),
          status: document.status,
          favorite: Boolean(document.favorite),
          createdAt: document.created_at,
          updatedAt: document.updated_at,
          specialRole: document.special_role ?? null,
        }))
        .sort((left, right) => {
          const leftValue = valueFor(left);
          const rightValue = valueFor(right);
          const comparison = String(leftValue ?? '').localeCompare(String(rightValue ?? ''), 'fr', { sensitivity: 'base' });
          return comparison === 0 ? (left.id - right.id) * direction : comparison * direction;
        });
    });
    ipcMain.handle('documents:search', async (_event, options) => {
      rejectIfForced('documents:search');
      searchRequests.push(JSON.parse(JSON.stringify(options)));
      if (options.query.toLocaleLowerCase('fr-FR') === 'premier lent') {
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
      if (options.query.toLocaleLowerCase('fr-FR') === 'deuxieme rapide') {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (options.query.toLocaleLowerCase('fr-FR') === 'ancienne recherche') {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR');
      const query = normalize(options.query.trim()).replace(/ (lent|rapide)$/u, '');
      const tokens = query.split(/\s+/).filter(Boolean);
      const folderName = (document) => folders.find((folder) => folder.id === document.folder_id)?.name ?? null;
      const matches = (document) => {
        if (!query) return true;
        const haystack = options.fields.map((field) => normalize(field === 'notes' ? document.notes : document[field])).join(' ');
        if (options.matchMode === 'phrase') return haystack.includes(query);
        if (options.matchMode === 'any') return tokens.some((token) => haystack.includes(token));
        return tokens.every((token) => haystack.includes(token));
      };
      const dateMatches = (document, column, filter) => {
        if (filter.period === 'all') return true;
        const value = new Date(document[column]).getTime();
        let lower = null;
        let upperExclusive = null;
        if (filter.period === 'custom') {
          if (filter.from) lower = new Date(filter.from + 'T00:00:00').getTime();
          if (filter.to) {
            const upper = new Date(filter.to + 'T00:00:00');
            upper.setDate(upper.getDate() + 1);
            upperExclusive = upper.getTime();
          }
        } else {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          if (filter.period === 'thisYear') start.setMonth(0, 1);
          else start.setDate(start.getDate() - ({ last7days: 6, last15days: 14, last30days: 29 }[filter.period] ?? 0));
          lower = start.getTime();
        }
        return (lower === null || value >= lower) && (upperExclusive === null || value < upperExclusive);
      };
      const scopedFolderIds = new Set(options.folderSelection.folderIds);
      let folderScopeGrew = true;
      while (folderScopeGrew) {
        folderScopeGrew = false;
        for (const folder of folders) {
          if (folder.parent_id !== null && scopedFolderIds.has(folder.parent_id) && !scopedFolderIds.has(folder.id)) {
            scopedFolderIds.add(folder.id);
            folderScopeGrew = true;
          }
        }
      }
      const folderFilterActive = scopedFolderIds.size > 0 || options.folderSelection.includeUnclassified;
      const structuredMatches = (document) =>
        (!folderFilterActive || scopedFolderIds.has(document.folder_id) || (options.folderSelection.includeUnclassified && document.folder_id === null)) &&
        (options.statuses.length === 0 || options.statuses.includes(document.status)) &&
        (!options.favoriteOnly || Boolean(document.favorite)) &&
        dateMatches(document, 'created_at', options.created) &&
        dateMatches(document, 'updated_at', options.modified);
      return documents.filter((document) => !document.deleted_at && matches(document) && structuredMatches(document)).map((document) => ({
        id: document.id,
        title: document.title,
        folderId: document.folder_id,
        folderName: folderName(document),
        status: document.status,
        favorite: Boolean(document.favorite),
        createdAt: document.created_at,
        updatedAt: document.updated_at,
        specialRole: document.special_role ?? null,
        snippet: query ? `\uE000${options.query}\uE001 — extrait` : null,
        relevance: query ? -1 : null,
      }));
    });
    ipcMain.handle('documents:list-deleted', () => {
      rejectIfForced('documents:list-deleted');
      return documents.filter((document) => document.deleted_at).map(cloneDocument);
    });
    ipcMain.handle('documents:create', (_event, folderId = null) => {
      rejectIfForced('documents:create');
      const automaticTitleDate = '20260816';
      const automaticTitlePattern = new RegExp(`^tot_${automaticTitleDate}_(\\d{2})$`);
      const maximumSuffix = documents.reduce((maximum, document) => {
        const match = document.title.match(automaticTitlePattern);
        return match ? Math.max(maximum, Number(match[1])) : maximum;
      }, 0);
      if (maximumSuffix >= 99) throw new Error('automatic document title limit reached');
      const created = {
        ...documents[0],
        id: Math.max(...documents.map((document) => document.id)) + 1,
        title: `tot_${automaticTitleDate}_${String(maximumSuffix + 1).padStart(2, '0')}`,
        content: '',
        status: 'draft',
        favorite: 0,
        deleted_at: null,
        folder_id: folderId,
      };
      documents = [created, ...documents];
      return cloneDocument(created);
    });
    ipcMain.handle('documents:get-or-create-special', (_event, role) => {
      rejectIfForced('documents:get-or-create-special');
      specialDocumentInvocations += 1;
      const existing = documents.find((document) => document.special_role === role);
      if (existing) return cloneDocument(existing);
      const created = {
        id: Math.max(...documents.map((document) => document.id)) + 1,
        title: 'TODO',
        content: '',
        content_format: 'plain',
        status: 'active',
        favorite: 0,
        created_at: '2026-08-16T12:00:00.000Z',
        updated_at: '2026-08-16T12:00:00.000Z',
        last_opened_at: '2026-08-16T12:00:00.000Z',
        deleted_at: null,
        notes: '',
        folder_id: null,
        special_role: role,
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
      if (document.special_role) throw new Error('permanent document');
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
            const value = await predicate();
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
        const setSearch = (value) => {
          const input = document.querySelector('.search-input-row input');
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const selectSavedSearch = (name) => {
          const select = document.querySelector('.saved-search-select');
          const option = Array.from(select?.options ?? []).find((item) => item.textContent.replace(/ \*$/, '') === name);
          if (!select || !option) throw new Error('Recherche enregistrée introuvable dans le sélecteur: ' + name);
          Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, option.value);
          select.dispatchEvent(new Event('change', { bubbles: true }));
        };

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
        if (document.querySelector('.navigation-pane')?.textContent.includes('Recherches enregistrées') || document.querySelector('.navigation-pane .saved-search-select')) {
          throw new Error('saved searches must not be rendered in structural navigation');
        }
        if (!searchInput.closest('.editor-toolbar')) {
          throw new Error('search should be rendered in the editor toolbar');
        }
        const viewButtons = document.querySelectorAll('.nav-view-button');
        if (viewButtons.length !== 2) throw new Error('document view buttons missing');
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

        setSearch('ancien');
        await waitFor(() => document.querySelector('.document-catalog') && document.querySelectorAll('.catalog-row').length === 0, 'active search excludes trash');
        const advancedPanel = document.querySelector('.advanced-search-panel');
        if (!advancedPanel || advancedPanel.querySelectorAll('fieldset:first-child input[type="checkbox"]:checked').length !== 3 ||
            !advancedPanel.querySelector('input[type="radio"][value="all"]:checked')) {
          throw new Error('default advanced search criteria are incorrect');
        }
        const defaultDateValues = Array.from(advancedPanel.querySelectorAll('.search-date-filter select')).map((select) => select.value);
        if (advancedPanel.textContent.includes('Type') || advancedPanel.textContent.includes('Indifférent') ||
            advancedPanel.querySelectorAll('.status-filter-options input:checked').length !== 0 ||
            advancedPanel.querySelector('.favorite-only-filter input').checked ||
            advancedPanel.querySelector('.folder-filter-menu summary strong').textContent !== 'Aucune branche' ||
            !advancedPanel.textContent.includes('inclut ses sous-dossiers') || defaultDateValues.join(',') !== 'all,all') {
          throw new Error('default structured search criteria are incorrect');
        }
        const fieldCheckboxes = Array.from(advancedPanel.querySelectorAll('fieldset:first-child input[type="checkbox"]'));
        fieldCheckboxes.forEach((checkbox) => checkbox.click());
        await waitFor(() => document.querySelector('.search-validation-message')?.textContent.includes('au moins une zone'), 'no search field validation');
        fieldCheckboxes.forEach((checkbox) => checkbox.click());
        await waitFor(() => !document.querySelector('.search-validation-message'), 'search fields restored');
        advancedPanel.querySelector('input[type="radio"][value="any"]').click();
        await waitFor(() => advancedPanel.querySelector('input[type="radio"][value="any"]:checked'), 'any match mode selected');
        await new Promise((resolve) => setTimeout(resolve, 310));
        advancedPanel.querySelector('input[type="radio"][value="all"]').click();
        if (document.querySelector('.search-input-row input').type !== 'text' || document.querySelectorAll('.clear-search-button').length !== 1) {
          throw new Error('search should expose exactly one custom clear control');
        }

        document.querySelector('.clear-search-button').click();
        await waitFor(() => document.querySelector('.folder-section'), 'clear search returns to navigation');
        clickView('Tous les textes');
        await waitFor(() => document.querySelectorAll('.document-item').length >= 2, 'all documents restored after search');

        setSearch('deuxieme');
        await waitFor(() => document.querySelectorAll('.catalog-row').length === 1, 'search filters by title');
        if (!document.querySelector('.catalog-row')?.textContent.includes('Deuxieme document')) {
          throw new Error('title search result is incorrect');
        }
        if (document.querySelector('.navigation-pane')?.textContent.includes('Résultats')) {
          throw new Error('search results must not be duplicated in the navigation pane');
        }
        if (!document.querySelector('.catalog-snippet mark')) throw new Error('safe highlighted search snippet missing');
        await waitFor(() => document.querySelector('.status-bar')?.textContent.includes('1 affiches'), 'status filtered count');
        const searchTitleSort = Array.from(document.querySelectorAll('.catalog-sort-button')).find((button) => button.textContent.includes('Titre'));
        searchTitleSort.click();
        await waitFor(() => searchTitleSort.textContent.includes('↑'), 'manual search result title sort');
        await new Promise((resolve) => setTimeout(resolve, 310));

        setSearch('CONTENU INITIAL');
        await waitFor(
          () => document.querySelectorAll('.catalog-row').length === 1 && document.querySelector('.catalog-row')?.textContent.includes('Premier document'),
          'search filters by content case-insensitively'
        );

        setSearch('premier lent');
        await new Promise((resolve) => setTimeout(resolve, 310));
        setSearch('deuxieme rapide');
        await waitFor(() => document.querySelector('.catalog-row')?.textContent.includes('Deuxieme document'), 'newer fast search result');
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (!document.querySelector('.catalog-row')?.textContent.includes('Deuxieme document')) {
          throw new Error('stale slow search replaced the latest results');
        }

        document.querySelector('.clear-search-button').click();
        await waitFor(() => document.querySelector('.folder-section'), 'clear search restores navigation');
        document.querySelector('.advanced-search-button').click();
        await waitFor(() => document.querySelector('.advanced-search-panel'), 'advanced search accessible with empty text');
        const createdPeriodSelect = document.querySelectorAll('.search-date-filter select')[0];
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(createdPeriodSelect, 'last7days');
        createdPeriodSelect.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 310));
        await waitFor(() => document.querySelector('.document-catalog') && document.querySelector('.search-input-row input').value === '', 'date-only search');
        const modifiedPeriodSelect = document.querySelectorAll('.search-date-filter select')[1];
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(modifiedPeriodSelect, 'last15days');
        modifiedPeriodSelect.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 310));

        document.querySelector('.status-filter-options input[value="draft"]').click();
        document.querySelector('.status-filter-options input[value="active"]').click();
        await new Promise((resolve) => setTimeout(resolve, 310));
        document.querySelector('.favorite-only-filter input').click();
        await new Promise((resolve) => setTimeout(resolve, 310));

        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(createdPeriodSelect, 'custom');
        createdPeriodSelect.dispatchEvent(new Event('change', { bubbles: true }));
        await waitFor(() => document.querySelectorAll('.search-date-filter input[type="date"]').length === 2, 'custom created date inputs');
        const customCreatedInputs = document.querySelectorAll('.search-date-filter')[0].querySelectorAll('input[type="date"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(customCreatedInputs[0], '2026-08-16');
        customCreatedInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(customCreatedInputs[1], '2026-08-15');
        customCreatedInputs[1].dispatchEvent(new Event('change', { bubbles: true }));
        await waitFor(() => document.querySelector('.search-validation-message')?.textContent.includes('date de début'), 'reversed custom date validation');

        document.querySelector('.reset-search-button').click();
        await waitFor(() => !document.querySelector('.search-validation-message'), 'structured search reset clears validation');
        const resetPanel = document.querySelector('.advanced-search-panel');
        if (document.querySelector('.search-input-row input').value !== '' ||
            resetPanel.querySelectorAll('input[type="checkbox"]:checked').length !== 3 ||
            !resetPanel.querySelector('input[type="radio"][value="all"]:checked') ||
            resetPanel.querySelector('.folder-filter-menu summary strong').textContent !== 'Aucune branche' ||
            Array.from(resetPanel.querySelectorAll('.search-date-filter select')).map((select) => select.value).join(',') !== 'all,all') {
          throw new Error('structured search reset did not restore all defaults');
        }
        await new Promise((resolve) => setTimeout(resolve, 310));
        dispatchShortcut('Escape');
        await waitFor(() => !document.querySelector('.document-catalog'), 'Escape exits structured results');
        clickView('Tous les textes');
        await waitFor(() => document.querySelectorAll('.document-item').length >= 2, 'all documents restored');

        document.querySelector('.toggle-navigation-button').click();
        await waitFor(() => !document.querySelector('.navigation-pane'), 'navigation hidden before Ctrl+F');
        document.querySelector('.toggle-metadata-button').click();
        await waitFor(() => !document.querySelector('.metadata-pane'), 'both panels hidden before Ctrl+F');
        const selectedTitleBeforeHiddenSearch = document.querySelector('.title-input')?.value;
        const selectedIdBeforeHiddenSearch = document.querySelector('.status-bar')?.textContent.match(/Document (\d+)/)?.[1] ?? null;
        const ctrlFResult = dispatchShortcut('f', { ctrlKey: true });
        if (ctrlFResult.defaultPrevented || ctrlFResult.dispatchResult === false) {
          throw new Error('Le renderer ne doit plus posseder Ctrl+F');
        }
        document.querySelector('.toggle-navigation-button').click();
        await waitFor(() => document.querySelector('.navigation-pane'), 'navigation reopened for search intent simulation');
        if (document.querySelector('.metadata-pane')) {
          throw new Error('Ctrl+F should not reveal the metadata pane');
        }
        document.querySelector('.search-input-row input').focus();
        await waitFor(() => document.activeElement === document.querySelector('.search-input-row input'), 'search input focused');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          .set.call(document.querySelector('.search-input-row input'), 'ancien');
        document.querySelector('.search-input-row input').dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelector('.search-input-row input').value === 'ancien', 'search text entered before escape');
        dispatchShortcut('Escape');
        await waitFor(() => document.querySelector('.search-input-row input').value === '', 'Escape clears focused search');
        await waitFor(() => document.querySelector('.navigation-pane'), 'renderer search keeps explicit navigation state');
        const selectedIdAfterHiddenSearch = document.querySelector('.status-bar')?.textContent.match(/Document (\d+)/)?.[1] ?? null;
        if (selectedIdAfterHiddenSearch !== selectedIdBeforeHiddenSearch ||
            (selectedTitleBeforeHiddenSearch !== undefined && document.querySelector('.title-input')?.value !== selectedTitleBeforeHiddenSearch)) {
          throw new Error('hidden navigation search changed the selected document');
        }
        document.querySelector('.toggle-metadata-button').click();
        await waitFor(() => document.querySelector('.folder-section') && document.querySelector('.metadata-pane'), 'panels reopened after hidden search');

        document.querySelector('.folder-actions button[title="Nouveau dossier racine"]').click();
        await waitFor(() => document.querySelector('.folder-button')?.textContent.includes('Nouveau dossier'), 'folder created');
        await waitFor(() => document.querySelector('.status-bar')?.textContent.includes('Dossier: Nouveau dossier'), 'folder status context');
        document.querySelector('.folder-row .folder-button.selected').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
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
        const ctrlNFolderTitle = await waitFor(
          () => /^tot_20260816_\\d{2,}$/.test(document.querySelector('.title-input')?.value ?? '') && document.querySelector('.title-input').value,
          'Ctrl+N creates automatically titled document in folder'
        );
        if ((await window.textotheque.listDocuments()).find((item) => item.title === ctrlNFolderTitle)?.folder_id !== 1) {
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
        const buttonFolderTitle = await waitFor(
          () => /^tot_20260816_\\d{2,}$/.test(document.querySelector('.title-input')?.value ?? '') && document.querySelector('.title-input').value,
          'button plus creates automatically titled document in folder'
        );
        if ((await window.textotheque.listDocuments()).find((item) => item.title === buttonFolderTitle)?.folder_id !== 1) {
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
        await waitFor(
          () => /^tot_20260816_\\d{2,}$/.test(document.querySelector('.title-input')?.value ?? ''),
          'Ctrl+N creates automatically titled document in subfolder'
        );
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
        document.querySelector('.advanced-search-button').click();
        await waitFor(() => document.querySelector('.advanced-search-panel'), 'advanced search with real folders');
        const folderMenu = document.querySelector('.folder-filter-menu');
        folderMenu.open = true;
        const searchFolderLabels = Array.from(folderMenu.querySelectorAll('.folder-filter-option[title]')).map((option) => option.title);
        if (!searchFolderLabels.includes('Notes memoire') || !searchFolderLabels.includes('Notes memoire › Nouveau dossier')) {
          throw new Error('advanced folder paths do not expose the hierarchy');
        }
        folderMenu.querySelector('input[value="1"]').click();
        await waitFor(
          () => document.querySelector('.catalog-table-region')?.textContent.includes('Doc bouton dossier') && document.querySelector('.catalog-table-region')?.textContent.includes('Doc sous dossier'),
          'parent branch structured filter includes descendant'
        );
        if (!folderMenu.querySelector('input[value="2"]').disabled || !folderMenu.textContent.includes('déjà inclus')) {
          throw new Error('selected parent does not visibly cover its descendant');
        }
        dispatchShortcut('Escape');
        await waitFor(() => !document.querySelector('.document-catalog'), 'Escape exits folder filter');
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
        setSearch('Doc bouton');
        await waitFor(() => document.querySelectorAll('.catalog-row').length === 1, 'global search from folder view');
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
        setSearch('Premier');
        await waitFor(() => document.querySelectorAll('.catalog-row').length === 1, 'search is global from unfiled view');
        if (!document.querySelector('.catalog-row')?.textContent.includes('Premier document')) {
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
        await waitFor(() => document.querySelector('.document-catalog'), 'catalog reopened after reveal check');
        const catalogLabels = Array.from(document.querySelectorAll('.catalog-sort-button')).map((button) => button.textContent.trim().replace(/[↑↓]/g, '').trim());
        if (catalogLabels.join('|') !== 'Titre|Dossier|Statut|Favori|Créé|Modifié') {
          throw new Error('catalog columns are incomplete: ' + catalogLabels.join('|'));
        }
        if (document.querySelectorAll('.catalog-row').length < 2) throw new Error('active catalog rows missing');
        if (document.querySelector('.catalog-table').textContent.includes('Ancien document')) {
          throw new Error('trashed document leaked into catalog');
        }
        const modifiedSortButton = Array.from(document.querySelectorAll('.catalog-sort-button'))
          .find((button) => button.textContent.includes('Modifié'));
        if (!modifiedSortButton.textContent.includes('↓')) throw new Error('default catalog sort is not updated_at descending');
        modifiedSortButton.click();
        await waitFor(() => modifiedSortButton.textContent.includes('↑'), 'catalog modified ascending sort');
        const titleSortButton = Array.from(document.querySelectorAll('.catalog-sort-button'))
          .find((button) => button.textContent.includes('Titre'));
        titleSortButton.click();
        await waitFor(() => titleSortButton.textContent.includes('↑'), 'catalog title ascending sort');
        const firstCatalogRow = Array.from(document.querySelectorAll('.catalog-row'))
          .find((row) => row.textContent.includes('Premier document'));
        firstCatalogRow.click();
        await waitFor(() => document.querySelector('.title-input')?.value === 'Premier document', 'catalog row opens document');

        const firstTitle = document.querySelector('.title-input');
        let editor = document.querySelector('.content-editor');
        if (!firstTitle || !editor) throw new Error('editor missing');

        dispatchShortcut('F2');
        await waitFor(() => document.activeElement === document.querySelector('.title-input'), 'F2 focuses title');

        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
          .set.call(editor, 'Contenu initial modifie par raccourci');
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelector('.title-dirty-marker'), 'dirty marker visible');
        await waitFor(() => document.querySelector('.status-bar')?.textContent.includes('Modifie'), 'status dirty state');
        clickView('Tous les textes');
        await waitFor(() => document.querySelector('.document-catalog'), 'catalog opens over dirty document');
        if (document.querySelector('.confirm-dialog')) throw new Error('opening catalog must not trigger dirty confirmation');
        const selectedCatalogRow = document.querySelector('.catalog-row.selected');
        if (!selectedCatalogRow?.textContent.includes('Premier document')) {
          throw new Error('selected document is not visible in catalog');
        }
        const otherCatalogRow = Array.from(document.querySelectorAll('.catalog-row'))
          .find((row) => row.textContent.includes('Deuxieme document'));
        otherCatalogRow.click();
        await waitFor(() => document.querySelector('.confirm-dialog'), 'catalog row uses dirty guard');
        document.querySelector('.confirm-dialog .secondary-button').click();
        await waitFor(() => !document.querySelector('.confirm-dialog'), 'catalog row dirty guard canceled');
        if (!document.querySelector('.document-catalog')) throw new Error('dirty cancellation left catalog');
        document.querySelector('.catalog-row.selected').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await waitFor(() => document.querySelector('.content-editor'), 'selected catalog row opens with Enter');
        if (document.querySelector('.content-editor').value !== 'Contenu initial modifie par raccourci' || !document.querySelector('.title-dirty-marker')) {
          throw new Error('catalog navigation lost the in-memory draft');
        }
        editor = document.querySelector('.content-editor');
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
        setSearch('premier');
        await waitFor(() => document.querySelectorAll('.catalog-row').length === 1, 'search remains global from trash');
        if (!document.querySelector('.catalog-row')?.textContent.includes('Premier document')) {
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
        const trashedEditor = document.querySelector('.content-editor');
        if (trashedEditor.disabled !== true) {
          throw new Error('trashed document editor should be read-only');
        }
        if (trashedEditor.value !== 'Document cible non sauvegarde') {
          throw new Error('trashed document content was not preserved');
        }
        const trashedContentBeforeTab = trashedEditor.value;
        const trashedTabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        const trashedTabDispatchResult = trashedEditor.dispatchEvent(trashedTabEvent);
        if (trashedEditor.value !== trashedContentBeforeTab || trashedTabEvent.defaultPrevented || !trashedTabDispatchResult) {
          throw new Error('Tab should not be intercepted in a read-only trashed document');
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
        await waitFor(() => Array.from(document.querySelectorAll('.empty-state')).some((item) => item.textContent.includes('La corbeille est vide')), 'trash view empty after emptying');
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
        const automaticTitle = await waitFor(
          () => /^tot_20260816_\\d{2,}$/.test(document.querySelector('.title-input')?.value ?? '') && document.querySelector('.title-input').value,
          'new document receives automatic title'
        );
        if (document.querySelector('.title-input').placeholder !== 'Sans titre') {
          throw new Error('Untitled fallback is not used as title placeholder');
        }
        await waitFor(
          () => document.querySelector('.unfiled-tree-section')?.textContent.includes(automaticTitle),
          'automatic title visible in navigation'
        );
        const newTitleInput = document.querySelector('.title-input');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
          .set.call(newTitleInput, 'Titre saisi directement');
        newTitleInput.dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelector('.title-input').value === 'Titre saisi directement', 'direct title typing works');
        await waitFor(() => document.querySelector('.title-dirty-marker'), 'new title dirty marker visible');
        document.querySelector('.primary-button').click();
        await waitFor(() => !document.querySelector('.title-dirty-marker'), 'new title saved');

        document.querySelector('.advanced-search-button').click();
        await waitFor(() => document.querySelector('.advanced-search-panel'), 'advanced search before saved search creation');
        if (!document.querySelector('.saved-search-select') || document.querySelector('.saved-search-select').value !== '') {
          throw new Error('saved search selector missing or not on its placeholder');
        }
        setSearch('premier');
        await waitFor(() => document.querySelector('.catalog-row')?.textContent.includes('Premier document'), 'saved search source criteria applied');
        Array.from(document.querySelectorAll('.saved-search-actions button')).find((button) => button.textContent.includes('Enregistrer la recherche')).click();
        let nameDialog = await waitFor(() => document.querySelector('.saved-search-name-dialog'), 'saved search name dialog');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(nameDialog.querySelector('input'), 'Recherche A');
        nameDialog.querySelector('input').dispatchEvent(new Event('input', { bubbles: true }));
        nameDialog.querySelector('.primary-button').click();
        await waitFor(() => Array.from(document.querySelector('.saved-search-select').options).some((item) => item.textContent === 'Recherche A'), 'saved search added to selector');
        await waitFor(() => document.querySelector('.saved-search-select').selectedOptions[0]?.textContent === 'Recherche A', 'new saved search selected');
        await waitFor(() => document.querySelector('.active-saved-search-label')?.textContent.includes('Recherche A'), 'saved search active label');
        if (document.querySelector('.active-saved-search-label').textContent.includes('modifiée')) {
          throw new Error('new saved search should start on a clean baseline');
        }

        setSearch('deuxieme');
        await waitFor(() => document.querySelector('.active-saved-search-label')?.textContent.includes('modifiée'), 'loaded saved search becomes modified');
        await waitFor(() => document.querySelector('.saved-search-select').selectedOptions[0]?.textContent === 'Recherche A *', 'selector marks modified saved search');
        const updateButton = Array.from(document.querySelectorAll('.saved-search-actions button')).find((button) => button.textContent === 'Mettre à jour');
        if (updateButton.disabled) throw new Error('explicit saved search update should be enabled after modification');
        updateButton.click();
        await waitFor(() => !document.querySelector('.active-saved-search-label')?.textContent.includes('modifiée'), 'explicit update refreshes baseline');
        await waitFor(() => document.querySelector('.saved-search-select').selectedOptions[0]?.textContent === 'Recherche A', 'selector clears modified marker after update');

        Array.from(document.querySelectorAll('.saved-search-actions button')).find((button) => button.textContent.includes('Enregistrer sous')).click();
        nameDialog = await waitFor(() => document.querySelector('.saved-search-name-dialog'), 'save-as name dialog');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(nameDialog.querySelector('input'), 'Copie A');
        nameDialog.querySelector('input').dispatchEvent(new Event('input', { bubbles: true }));
        nameDialog.querySelector('.primary-button').click();
        await waitFor(() => document.querySelector('.active-saved-search-label')?.textContent.includes('Copie A'), 'save-as activates copy');
        await waitFor(() => document.querySelector('.saved-search-select').selectedOptions[0]?.textContent === 'Copie A', 'save-as selects copy immediately');
        Array.from(document.querySelectorAll('.saved-search-actions button')).find((button) => button.textContent.includes('Renommer')).click();
        nameDialog = await waitFor(() => document.querySelector('.saved-search-name-dialog'), 'rename saved search dialog');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(nameDialog.querySelector('input'), 'Copie renommée');
        nameDialog.querySelector('input').dispatchEvent(new Event('input', { bubbles: true }));
        nameDialog.querySelector('.primary-button').click();
        await waitFor(() => document.querySelector('.active-saved-search-label')?.textContent.includes('Copie renommée'), 'saved search renamed');
        await waitFor(() => document.querySelector('.saved-search-select').selectedOptions[0]?.textContent === 'Copie renommée', 'renamed search refreshed in selector');

        document.querySelector('.catalog-row').click();
        await waitFor(() => document.querySelector('.content-editor'), 'open result from saved search');
        document.querySelector('.advanced-search-button').click();
        await waitFor(() => document.querySelector('.active-saved-search-label')?.textContent.includes('Copie renommée'), 'return to active saved search');
        if (document.querySelector('.saved-search-select').selectedOptions[0]?.textContent !== 'Copie renommée') {
          throw new Error('opening a result forgot the active saved search');
        }
        Array.from(document.querySelectorAll('.saved-search-actions button')).find((button) => button.textContent.includes('Supprimer')).click();
        let deleteDialog = await waitFor(() => document.querySelector('.confirm-dialog'), 'saved search delete confirmation');
        if (!deleteDialog.textContent.includes('Copie renommée')) throw new Error('saved search delete confirmation has wrong name');
        deleteDialog.querySelector('.danger-button').click();
        await waitFor(() => !document.querySelector('.active-saved-search-label'), 'deleted active search becomes unassociated');
        await waitFor(() => document.querySelector('.saved-search-select').value === '', 'delete returns selector to placeholder');
        await waitFor(() => document.querySelector('.catalog-row')?.textContent.includes('Deuxieme document'), 'deleting saved search keeps current criteria and results');
        selectSavedSearch('Recherche A');
        await waitFor(() => document.querySelector('.active-saved-search-label')?.textContent.includes('Recherche A'), 'saved search loaded from selector');
        await waitFor(() => document.querySelector('.catalog-row')?.textContent.includes('Deuxieme document'), 'selector uses saved search criteria and results');
        document.querySelector('.reset-search-button').click();
        await waitFor(() => !document.querySelector('.active-saved-search-label'), 'reset leaves saved search association');
        await waitFor(() => document.querySelector('.saved-search-select').value === '', 'reset returns selector to placeholder');

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
    if (!catalogRequests.some((request) => request.sortBy === 'updated_at' && request.direction === 'desc') ||
        !catalogRequests.some((request) => request.sortBy === 'updated_at' && request.direction === 'asc') ||
        !catalogRequests.some((request) => request.sortBy === 'title' && request.direction === 'asc')) {
      throw new Error(`Catalog sort requests were not forwarded through IPC: ${JSON.stringify(catalogRequests)}`);
    }
    if (searchRequests.some((request) => request.fields.length === 0) ||
        !searchRequests.some((request) => request.fields.join(',') === 'title,content,notes' && request.matchMode === 'all') ||
        !searchRequests.some((request) => request.matchMode === 'any') ||
        !searchRequests.some((request) => request.query === '' && request.created.period === 'last7days' && request.modified.period === 'all' && request.sortBy === 'created_at' && request.direction === 'desc') ||
        !searchRequests.some((request) => request.query === '' && request.created.period === 'last7days' && request.modified.period === 'last15days' && request.sortBy === 'updated_at' && request.direction === 'desc') ||
        !searchRequests.some((request) => request.statuses.includes('draft') && request.statuses.includes('active')) ||
        !searchRequests.some((request) => request.favoriteOnly === true) ||
        !searchRequests.some((request) => request.folderSelection.folderIds.includes(1) && request.query === '' && request.sortBy === 'updated_at') ||
        searchRequests.some((request) => request.created.period === 'custom' && request.created.from === '2026-08-16' && request.created.to === '2026-08-15') ||
        !searchRequests.some((request) => request.query === '' && request.folderSelection.folderIds.length === 0 && !request.folderSelection.includeUnclassified && request.statuses.length === 0 && !request.favoriteOnly && request.created.period === 'all' && request.modified.period === 'all' && request.sortBy === 'updated_at') ||
        !searchRequests.some((request) => request.query === 'deuxieme' && request.sortBy === 'title' && request.direction === 'asc') ||
        !searchRequests.some((request) => request.query === 'premier lent') ||
        !searchRequests.some((request) => request.query === 'deuxieme rapide')) {
      throw new Error(`Advanced search requests are incomplete or invalid: ${JSON.stringify(searchRequests)}`);
    }
    if (savedSearchWrites.filter((write) => write.action === 'create').length !== 2 ||
        savedSearchWrites.filter((write) => write.action === 'update').length !== 1 ||
        savedSearchWrites.filter((write) => write.action === 'rename').length !== 1 ||
        savedSearchWrites.filter((write) => write.action === 'delete').length !== 1 ||
        savedSearchWrites.some((write) => write.libraryPath !== 'C:\\temporary\\test-ui.sqlite')) {
      throw new Error(`Saved search writes are incomplete or crossed a library: ${JSON.stringify(savedSearchWrites)}`);
    }
    if (!latestSearchMenuState || latestSearchMenuState.activeSavedSearchId !== null) {
      throw new Error(`Search menu state did not follow reset: ${JSON.stringify(latestSearchMenuState)}`);
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
        firstRow.querySelector('.folder-button').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
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
      (async () => {
        document.querySelector('.advanced-search-button').click();
        const start = Date.now();
        while (!document.querySelector('.advanced-search-panel') && Date.now() - start < 3000) {
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        const folderCheckbox = document.querySelector('.folder-filter-menu input[value="2"]');
        if (folderCheckbox) {
          folderCheckbox.click();
        }
        const input = document.querySelector('.search-input-row input');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'ancienne recherche');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);
    await new Promise((resolve) => setTimeout(resolve, 310));
    window.webContents.send('library:menu-action', { action: 'known', path: 'C:\\temporary\\library-b.sqlite' });
    const switchResult = await window.webContents.executeJavaScript(`
      (async () => {
        const start = Date.now();
        while (Date.now() - start < 3000) {
          const libraryName = document.querySelector('.status-bar .library-name')?.textContent ?? '';
          const workspaceText = document.querySelector('.app-shell')?.textContent ?? '';
          if (libraryName.includes('library-b.sqlite') && document.querySelector('.status-bar')?.textContent.includes('1 document')) {
            document.querySelector('.advanced-search-button').click();
            await new Promise((resolve) => setTimeout(resolve, 50));
            const folderMenu = document.querySelector('.folder-filter-menu');
            const savedSearchSelect = document.querySelector('.saved-search-select');
            const savedSearchNames = Array.from(savedSearchSelect?.options ?? []).map((option) => option.textContent);
            return {
              ok: !document.querySelector('.title-input') &&
                document.querySelector('.search-input-row input')?.value === '' &&
                document.querySelector('.status-bar')?.textContent.includes('1 document') &&
                !workspaceText.includes('Premier document') &&
                !savedSearchNames.includes('Recherche A') &&
                savedSearchNames.includes('Gaming B') &&
                savedSearchSelect?.value === '' &&
                !document.querySelector('.navigation-pane')?.textContent.includes('Gaming B') &&
                !document.querySelector('.active-saved-search-label') &&
                folderMenu?.querySelector('summary strong')?.textContent === 'Aucune branche' &&
                !folderMenu?.querySelector('input[value="2"]'),
              libraryName,
              workspaceText,
              savedSearchNames,
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

    const staleSavedSearchWrite = await window.webContents.executeJavaScript(`
      (async () => {
        try {
          await window.textotheque.createSavedSearch({
            name: 'Ne doit pas atteindre B', query: '', fields: ['title', 'content', 'notes'], matchMode: 'all',
            folderSelection: { folderIds: [], includeUnclassified: false }, statuses: [], favoriteOnly: false,
            created: { period: 'all', from: null, to: null }, modified: { period: 'all', from: null, to: null },
            sortBy: 'updated_at', direction: 'desc'
          }, 'C:\\temporary\\textotheque.sqlite');
          return { rejected: false };
        } catch (error) {
          return { rejected: true, names: (await window.textotheque.listSavedSearches()).map((item) => item.name) };
        }
      })()
    `);
    if (!staleSavedSearchWrite.rejected || staleSavedSearchWrite.names.join(',') !== 'Gaming B') {
      throw new Error(`A stale saved-search write crossed the library boundary: ${JSON.stringify(staleSavedSearchWrite)}`);
    }

    await window.webContents.executeJavaScript(`document.querySelector('.toggle-navigation-button').click()`);
    window.webContents.send('search:menu-action', { action: 'focus' });
    const searchMenuFocusResult = await window.webContents.executeJavaScript(`
      (async () => {
        const start = Date.now();
        while (Date.now() - start < 3000) {
          if (document.querySelector('.navigation-pane') && document.activeElement === document.querySelector('.search-input-row input')) return true;
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        return false;
      })()
    `);
    if (!searchMenuFocusResult) throw new Error('Native search menu intent did not reach the shared renderer focus handler.');
    window.webContents.send('search:menu-action', { action: 'open', id: 1 });
    const searchMenuOpenResult = await window.webContents.executeJavaScript(`
      (async () => {
        const start = Date.now();
        while (Date.now() - start < 3000) {
          if (
            document.querySelector('.active-saved-search-label')?.textContent.includes('Gaming B') &&
            document.querySelector('.search-input-row input')?.value === 'contenu' &&
            document.querySelector('.saved-search-select')?.selectedOptions[0]?.textContent === 'Gaming B'
          ) return true;
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        return false;
      })()
    `);
    if (!searchMenuOpenResult) throw new Error('Native saved-search menu item did not reach the shared renderer load handler.');

    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.ts'), 'utf8');
    const searchMenuSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'search-menu.ts'), 'utf8');
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8');
    const navigationSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'NavigationPane.tsx'), 'utf8');
    const catalogSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'DocumentCatalog.tsx'), 'utf8');
    if (!mainSource.includes("label: 'Ouvrir le TODO'") || !mainSource.includes("accelerator: 'CommandOrControl+Shift+T'")) {
      throw new Error('Native File menu TODO item or accelerator missing.');
    }
    if (appSource.includes("event.shiftKey && key === 't'")) {
      throw new Error('Ctrl+Shift+T must have only the native menu accelerator as owner.');
    }
    if (!searchMenuSource.includes("accelerator: 'CommandOrControl+F'") || appSource.includes("usesCtrl && key === 'f'")) {
      throw new Error('Ctrl+F must have only the native Search menu accelerator as owner.');
    }
    if (navigationSource.includes('SavedSearch') || navigationSource.includes('Recherches enregistrées')) {
      throw new Error('Structural NavigationPane must not own saved searches.');
    }
    if (!catalogSource.includes('saved-search-select') || !catalogSource.includes('onOpenSavedSearch(id)') || !appSource.includes('onOpenSavedSearch={(id) => { void handleOpenSavedSearch(id); }}')) {
      throw new Error('Saved-search selector and native menu must converge on the shared renderer handler.');
    }

    const menuDirtySetup = await window.webContents.executeJavaScript(`
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
        const allButton = Array.from(document.querySelectorAll('.nav-view-button'))
          .find((button) => button.textContent.includes('Tous les textes'));
        allButton.click();
        await waitFor(() => document.querySelector('.document-item'), 'menu dirty source document');
        document.querySelector('.document-item').click();
        const editor = await waitFor(() => document.querySelector('.content-editor'), 'menu dirty editor');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
          .set.call(editor, 'Modification protegee depuis le menu');
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => document.querySelector('.title-dirty-marker'), 'menu dirty state');
        return { ok: true };
      })().catch((error) => ({ ok: false, message: error.stack }))
    `);
    if (!menuDirtySetup.ok) throw new Error(`File menu dirty setup failed: ${menuDirtySetup.message}`);

    window.webContents.send('file:menu-action', { action: 'open-todo' });
    const menuDirtyCancel = await window.webContents.executeJavaScript(`
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
        const dialog = await waitFor(() => document.querySelector('.confirm-dialog'), 'file menu dirty guard');
        Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent.includes('Annuler')).click();
        await waitFor(() => !document.querySelector('.confirm-dialog'), 'file menu cancellation');
        if ((await window.textotheque.listDocuments()).some((item) => item.special_role === 'todo')) {
          throw new Error('File menu created TODO before dirty guard approval');
        }
        const editor = document.querySelector('.content-editor');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(editor, 'Contenu B');
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        await waitFor(() => !document.querySelector('.title-dirty-marker'), 'restore clean document after menu cancellation');
        return { ok: true };
      })().catch((error) => ({ ok: false, message: error.stack }))
    `);
    if (!menuDirtyCancel.ok) throw new Error(`File menu dirty cancellation failed: ${menuDirtyCancel.message}`);

    await window.webContents.executeJavaScript(`if (!document.querySelector('.navigation-pane')) document.querySelector('.toggle-navigation-button')?.click()`);
    const specialTodoResult = await window.webContents.executeJavaScript(`
      (async () => {
        const waitFor = async (predicate, label, timeout = 4000) => {
          const start = Date.now();
          while (Date.now() - start < timeout) {
            const value = await predicate();
            if (value) return value;
            await new Promise((resolve) => setTimeout(resolve, 30));
          }
          throw new Error('Timeout: ' + label);
        };
        const findButton = (selector, text) =>
          Array.from(document.querySelectorAll(selector)).find((button) => button.textContent.includes(text));
        const setNativeValue = (element, value) => {
          const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
          element.dispatchEvent(new Event('input', { bubbles: true }));
        };

        let todoButton = document.querySelector('.todo-toolbar-button');
        if (!todoButton || todoButton.title !== 'Ouvrir le TODO — Ctrl+Shift+T') {
          throw new Error('TODO toolbar button or tooltip missing');
        }
        findButton('.nav-view-button', 'Tous les textes').click();
        await waitFor(() => document.querySelector('.document-item'), 'library B document');
        document.querySelector('.document-item').click();
        const editor = await waitFor(() => document.querySelector('.content-editor'), 'selected document editor');
        todoButton = document.querySelector('.todo-toolbar-button');
        setNativeValue(editor, 'Modification qui doit rester protegee');
        await waitFor(() => document.querySelector('.title-dirty-marker'), 'dirty state before TODO');

        todoButton.click();
        let dialog = await waitFor(() => document.querySelector('.confirm-dialog'), 'dirty guard before TODO');
        findButton('.confirm-dialog .secondary-button', 'Annuler').click();
        await waitFor(() => !document.querySelector('.confirm-dialog'), 'TODO dirty guard cancellation');
        if ((await window.textotheque.listDocuments()).some((item) => item.special_role === 'todo')) {
          throw new Error('TODO was created before dirty guard approval');
        }

        todoButton.click();
        dialog = await waitFor(() => document.querySelector('.confirm-dialog'), 'second TODO dirty guard');
        dialog.querySelector('.danger-button').click();
        await waitFor(() => document.querySelector('.title-input')?.value === 'TODO', 'lazy TODO creation');
        await waitFor(() => document.querySelector('.todo-toolbar-button')?.getAttribute('aria-pressed') === 'true', 'active TODO button');
        if (document.querySelector('.trash-button')) throw new Error('trash action must be unavailable for TODO');
        const todoId = Number(document.querySelector('.status-bar')?.textContent.match(/Document (\\d+)/)?.[1]);
        const countAfterCreation = (await window.textotheque.listDocuments()).filter((item) => item.special_role === 'todo').length;
        if (countAfterCreation !== 1) throw new Error('lazy TODO creation did not produce exactly one document');

        const todoEditor = document.querySelector('.content-editor');
        setNativeValue(todoEditor, 'Contenu recherche hippocampe TODO');
        await waitFor(async () => {
          const persisted = (await window.textotheque.listDocuments()).find((item) => item.id === todoId);
          return persisted?.content === 'Contenu recherche hippocampe TODO';
        }, 'TODO shared autosave', 5000);

        const search = document.querySelector('.search-input-row input');
        setNativeValue(search, 'hippocampe');
        await waitFor(() => document.querySelector('.catalog-row')?.textContent.includes('TODO'), 'TODO search result');
        document.querySelector('.clear-search-button').click();
        await waitFor(() => document.querySelector('.search-input-row input')?.value === '', 'clear TODO search');

        if (!document.querySelector('.navigation-home')) {
          document.querySelector('.toggle-navigation-button')?.click();
          await waitFor(() => document.querySelector('.navigation-home'), 'navigation restored after TODO search');
        }
        document.querySelector('.navigation-home').click();
        await waitFor(() => document.querySelector('.folder-section'), 'normal navigation after TODO');
        const normalTreeText = [
          document.querySelector('.folder-section')?.textContent ?? '',
          document.querySelector('.unfiled-tree-section')?.textContent ?? '',
        ].join(' ');
        if (normalTreeText.includes('TODO')) throw new Error('TODO leaked into normal navigation tree');

        const directCatalog = await window.textotheque.listDocumentCatalog({ sortBy: 'updated_at', direction: 'desc' });
        if (!directCatalog.some((item) => item.specialRole === 'todo')) {
          throw new Error('TODO missing from direct catalog API: ' + JSON.stringify(directCatalog));
        }
        findButton('.nav-view-button', 'Tous les textes').click();
        await waitFor(() => document.querySelector('.document-catalog'), 'document catalog after TODO');
        if (!Array.from(document.querySelectorAll('.catalog-row')).some((row) => row.textContent.includes('TODO'))) {
          throw new Error('TODO missing from rendered catalog: ' + document.querySelector('.document-catalog')?.textContent);
        }
        const normalDocument = Array.from(document.querySelectorAll('.catalog-row')).find((row) => !row.textContent.includes('TODO'));
        normalDocument.click();
        await waitFor(() => document.querySelector('.title-input')?.value !== 'TODO', 'normal document before shortcut');
        return {
          ok: (await window.textotheque.listDocuments()).filter((item) => item.special_role === 'todo').length === 1,
        };
      })().catch((error) => ({ ok: false, message: error.stack }))
    `);
    if (!specialTodoResult.ok) {
      throw new Error(`Special TODO UI check failed: ${specialTodoResult.message ?? 'unknown error'}`);
    }

    const invocationsBeforeMenuOpen = specialDocumentInvocations;
    window.webContents.send('file:menu-action', { action: 'open-todo' });
    const menuOpenResult = await window.webContents.executeJavaScript(`
      (async () => {
        const start = Date.now();
        while (Date.now() - start < 3000) {
          if (document.querySelector('.title-input')?.value === 'TODO') return { ok: true };
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        return { ok: false, message: 'File menu did not open TODO' };
      })()
    `);
    if (!menuOpenResult.ok || specialDocumentInvocations !== invocationsBeforeMenuOpen + 1) {
      throw new Error(`File menu TODO workflow was not executed exactly once: ${JSON.stringify(menuOpenResult)}`);
    }

    const invocationsBeforeNoop = specialDocumentInvocations;
    const documentCountBeforeNoop = documents.length;
    window.webContents.send('file:menu-action', { action: 'open-todo' });
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (specialDocumentInvocations !== invocationsBeforeNoop || documents.length !== documentCountBeforeNoop) {
      throw new Error('File menu TODO action is not a clean no-op when TODO is already current.');
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
