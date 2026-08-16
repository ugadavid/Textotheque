import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  type DocumentCatalogOptions,
  type DocumentInput,
  type SavedSearchInput,
  type SearchDocumentsOptions,
  type SpecialDocumentRole,
  type TextothequeDatabase,
} from './database.js';
import { ActiveLibraryManager, type LibraryMenuAction } from './library-manager.js';
import { LibraryHistoryRegistry, type KnownLibrary } from './library-history.js';
import {
  suggestedTextExportFileName,
  writeTextExport,
  type FileMenuAction,
  type TextExportDraft,
  type TextExportResult,
} from './text-export.js';
import { buildSearchMenu, type SearchMenuAction, type SearchMenuState } from './search-menu.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const packageMetadata = require('../package.json') as { name: string; productName?: string };
const applicationName = packageMetadata.productName ?? packageMetadata.name;
const identityCheckRequested = process.argv.includes('--textotheque-check-app-identity');
const ipcErrorCheckRequested = process.argv.includes('--textotheque-check-ipc-error');

app.setName(applicationName);

let mainWindow: BrowserWindow | null = null;
let libraryManager: ActiveLibraryManager | null = null;
let libraryHistory: LibraryHistoryRegistry | null = null;
let closeApproved = false;
let documentExportAvailable = false;
let searchMenuState: SearchMenuState = { activeSavedSearchId: null, modified: false, canSave: true };

function getDatabasePath(): string {
  return process.env.TEXTOTHEQUE_DB_PATH ?? path.join(app.getPath('userData'), 'textotheque.sqlite');
}

function getDatabase(): TextothequeDatabase {
  if (!libraryManager) {
    libraryManager = new ActiveLibraryManager(getDatabasePath(), undefined, getLibraryHistory());
  }
  return libraryManager.getDatabase();
}

function getLibraryHistory(): LibraryHistoryRegistry {
  if (!libraryHistory) {
    const historyPath = process.env.TEXTOTHEQUE_LIBRARY_HISTORY_PATH ?? path.join(app.getPath('userData'), 'library-history.json');
    libraryHistory = new LibraryHistoryRegistry(historyPath);
  }
  return libraryHistory;
}

function getLibraryManager(): ActiveLibraryManager {
  getDatabase();
  return libraryManager!;
}

function registerIpcHandler<Args extends unknown[], Result>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: Args) => Result | Promise<Result>
): void {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    try {
      return await handler(event, ...(args as Args));
    } catch (error) {
      console.error(`[IPC ${channel}]`, error);
      throw new Error(`L'operation IPC ${channel} a echoue.`);
    }
  });
}

function registerIpcHandlers(): void {
  registerIpcHandler('library:get-info', () => getDatabase().getLibraryInfo());
  registerIpcHandler('library:get-startup-notice', () => getLibraryManager().getStartupNotice());
  registerIpcHandler('library:inspect', (_event, candidatePath: string) => getLibraryManager().inspectCandidate(candidatePath));
  registerIpcHandler('library:choose-open', async () => {
    const options: OpenDialogOptions = {
      title: 'Ouvrir une bibliothèque Textothèque',
      buttonLabel: 'Inspecter la bibliothèque',
      filters: [
        { name: 'Bibliothèque SQLite', extensions: ['sqlite'] },
        { name: 'Tous les fichiers', extensions: ['*'] },
      ],
      properties: ['openFile'],
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) {
      return { status: 'canceled', inspection: null, library: null, backupPath: null };
    }
    return getLibraryManager().inspectCandidate(result.filePaths[0]);
  });
  registerIpcHandler('library:open', (_event, candidatePath: string, migrationApproved: boolean) =>
    getLibraryManager().openCandidate(candidatePath, migrationApproved).then((result) => {
      if (result.status === 'opened') {
        searchMenuState = { activeSavedSearchId: null, modified: false, canSave: true };
        refreshApplicationMenu();
      }
      return result;
    })
  );
  registerIpcHandler('library:choose-create', async () => {
    const options: SaveDialogOptions = {
      title: 'Nouvelle bibliothèque Textothèque',
      defaultPath: path.join(path.dirname(getDatabase().getLibraryInfo().path), 'Nouvelle-bibliotheque.sqlite'),
      buttonLabel: 'Créer la bibliothèque',
      filters: [{ name: 'Bibliothèque SQLite', extensions: ['sqlite'] }],
      properties: ['showOverwriteConfirmation'],
    };
    const result = mainWindow ? await dialog.showSaveDialog(mainWindow, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { status: 'canceled', path: null };
    if (fs.existsSync(result.filePath)) return { status: 'exists', path: result.filePath };
    return { status: 'selected', path: result.filePath };
  });
  registerIpcHandler('library:create', (_event, candidatePath: string) => {
    const result = getLibraryManager().createCandidate(candidatePath);
    if (result.status === 'created') {
      searchMenuState = { activeSavedSearchId: null, modified: false, canSave: true };
      refreshApplicationMenu();
    }
    return result;
  });
  registerIpcHandler('library:backup', async () => {
    const library = getDatabase();
    const libraryInfo = library.getLibraryInfo();
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const baseName = path.basename(libraryInfo.fileName, path.extname(libraryInfo.fileName));
    const options: SaveDialogOptions = {
      title: 'Sauvegarder une copie de la bibliothèque',
      defaultPath: path.join(path.dirname(libraryInfo.path), `${baseName}_backup_${timestamp}.sqlite`),
      buttonLabel: 'Sauvegarder la copie',
      filters: [{ name: 'Bibliothèque SQLite', extensions: ['sqlite'] }],
      properties: ['showOverwriteConfirmation'],
    };
    const result = mainWindow
      ? await dialog.showSaveDialog(mainWindow, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) {
      return { canceled: true, path: null, fileName: null, error: null };
    }
    if (library.isCurrentLibraryPath(result.filePath)) {
      return { canceled: false, path: null, fileName: null, error: 'same-source' };
    }

    const inspection = await library.backupTo(result.filePath);
    return { canceled: false, path: inspection.path, fileName: inspection.fileName, error: null };
  });
  registerIpcHandler('file:export-text', async (_event, draft: TextExportDraft): Promise<TextExportResult> => {
    const suggestedFileName = suggestedTextExportFileName(draft.title);
    const options: SaveDialogOptions = {
      title: 'Exporter le document en texte brut',
      defaultPath: path.join(app.getPath('documents'), suggestedFileName),
      buttonLabel: 'Exporter',
      filters: [{ name: 'Fichier texte', extensions: ['txt'] }],
      properties: ['showOverwriteConfirmation'],
    };
    const result = mainWindow ? await dialog.showSaveDialog(mainWindow, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { canceled: true, fileName: null };

    await writeTextExport(result.filePath, draft.content);
    return { canceled: false, fileName: path.basename(result.filePath) };
  });
  registerIpcHandler('file:set-export-available', (_event, available: boolean) => {
    if (documentExportAvailable === available) return;
    documentExportAvailable = available;
    refreshApplicationMenu();
  });
  registerIpcHandler('documents:list', () => getDatabase().listDocuments());
  registerIpcHandler('documents:list-catalog', (_event, options: DocumentCatalogOptions) =>
    getDatabase().listDocumentCatalog(options)
  );
  registerIpcHandler('documents:search', (_event, options: SearchDocumentsOptions) =>
    getDatabase().searchDocuments(options)
  );
  registerIpcHandler('saved-searches:list', () => getDatabase().listSavedSearches());
  registerIpcHandler('saved-searches:get', (_event, id: number) => getDatabase().getSavedSearch(id));
  registerIpcHandler('saved-searches:create', (_event, input: SavedSearchInput, expectedLibraryPath: string) => {
    const database = getDatabase();
    if (!database.isCurrentLibraryPath(expectedLibraryPath)) throw new Error('Le contexte de bibliothèque a changé.');
    const result = database.createSavedSearch(input);
    refreshApplicationMenu();
    return result;
  });
  registerIpcHandler('saved-searches:update', (_event, id: number, criteria: SearchDocumentsOptions, expectedLibraryPath: string) => {
    const database = getDatabase();
    if (!database.isCurrentLibraryPath(expectedLibraryPath)) throw new Error('Le contexte de bibliothèque a changé.');
    const result = database.updateSavedSearch(id, criteria);
    refreshApplicationMenu();
    return result;
  });
  registerIpcHandler('saved-searches:rename', (_event, id: number, name: string, expectedLibraryPath: string) => {
    const database = getDatabase();
    if (!database.isCurrentLibraryPath(expectedLibraryPath)) throw new Error('Le contexte de bibliothèque a changé.');
    const result = database.renameSavedSearch(id, name);
    refreshApplicationMenu();
    return result;
  });
  registerIpcHandler('saved-searches:delete', (_event, id: number, expectedLibraryPath: string) => {
    const database = getDatabase();
    if (!database.isCurrentLibraryPath(expectedLibraryPath)) throw new Error('Le contexte de bibliothèque a changé.');
    database.deleteSavedSearch(id);
    refreshApplicationMenu();
  });
  registerIpcHandler('search:set-menu-state', (_event, state: SearchMenuState) => {
    searchMenuState = state;
    refreshApplicationMenu();
  });
  registerIpcHandler('documents:list-deleted', () => getDatabase().listDeletedDocuments());
  registerIpcHandler('folders:list', () => getDatabase().listFolders());
  registerIpcHandler('folders:create', (_event, parentId: number | null) => getDatabase().createFolder(parentId));
  registerIpcHandler('folders:rename', (_event, id: number, name: string) => getDatabase().renameFolder(id, name));
  registerIpcHandler('documents:create', (_event, folderId: number | null) => getDatabase().createDocument(folderId));
  registerIpcHandler('documents:get-or-create-special', (_event, role: SpecialDocumentRole) =>
    getDatabase().getOrCreateSpecialDocument(role)
  );
  registerIpcHandler('documents:get', (_event, id: number) => getDatabase().getDocument(id));
  registerIpcHandler('documents:update', (_event, id: number, input: DocumentInput, expectedLibraryPath?: string) => {
    const database = getDatabase();
    if (expectedLibraryPath && !database.isCurrentLibraryPath(expectedLibraryPath)) {
      throw new Error('Le contexte de bibliothèque de la sauvegarde a changé.');
    }
    return database.updateDocument(id, input);
  });
  registerIpcHandler('documents:mark-opened', (_event, id: number) => getDatabase().markOpened(id));
  registerIpcHandler('documents:trash', (_event, id: number) => getDatabase().trashDocument(id));
  registerIpcHandler('documents:restore', (_event, id: number) => getDatabase().restoreDocument(id));
  registerIpcHandler('documents:empty-trash', () => getDatabase().emptyTrash());
  registerIpcHandler('app:approve-close', () => {
    closeApproved = true;
    mainWindow?.close();
  });
}

function sendLibraryMenuAction(action: LibraryMenuAction): void {
  mainWindow?.webContents.send('library:menu-action', action);
}

function sendFileMenuAction(action: FileMenuAction): void {
  mainWindow?.webContents.send('file:menu-action', action);
}

function sendSearchMenuAction(action: SearchMenuAction): void {
  mainWindow?.webContents.send('search:menu-action', action);
}

function knownLibraryLabels(libraries: KnownLibrary[]): Map<string, string> {
  const basenameCounts = new Map<string, number>();
  for (const library of libraries) {
    const baseName = path.basename(library.path);
    basenameCounts.set(baseName.toLocaleLowerCase('en-US'), (basenameCounts.get(baseName.toLocaleLowerCase('en-US')) ?? 0) + 1);
  }
  return new Map(libraries.map((library) => {
    const baseName = path.basename(library.path);
    const duplicate = (basenameCounts.get(baseName.toLocaleLowerCase('en-US')) ?? 0) > 1;
    const label = duplicate ? `${baseName} — ${path.basename(path.dirname(library.path))}` : baseName;
    return [library.path, library.available ? label : `${label} [introuvable]`];
  }));
}

function refreshApplicationMenu(): void {
  const manager = getLibraryManager();
  const knownLibraries = getLibraryHistory().getKnownLibraries();
  const labels = knownLibraryLabels(knownLibraries);
  const knownItems: MenuItemConstructorOptions[] = knownLibraries.length > 0
    ? knownLibraries.map((library) => ({
        label: labels.get(library.path),
        type: 'checkbox',
        checked: manager.getDatabase().isCurrentLibraryPath(library.path),
        enabled: library.available,
        click: () => sendLibraryMenuAction({ action: 'known', path: library.path }),
      }))
    : [{ label: 'Aucune bibliothèque connue', enabled: false }];
  const savedSearches = manager.getDatabase().listSavedSearches();
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Ouvrir le TODO',
          accelerator: 'CommandOrControl+Shift+T',
          click: () => sendFileMenuAction({ action: 'open-todo' }),
        },
        { type: 'separator' },
        {
          label: 'Exporter en texte (.txt)…',
          enabled: documentExportAvailable,
          click: () => sendFileMenuAction({ action: 'export-text' }),
        },
      ],
    },
    {
      label: 'Bibliothèque',
      submenu: [
        { label: 'Nouvelle bibliothèque…', click: () => sendLibraryMenuAction({ action: 'new' }) },
        { label: 'Ouvrir une bibliothèque…', click: () => sendLibraryMenuAction({ action: 'open' }) },
        { label: 'Bibliothèques connues', submenu: knownItems },
        { type: 'separator' },
        { label: 'Sauvegarder une copie…', click: () => sendLibraryMenuAction({ action: 'backup' }) },
      ],
    },
    buildSearchMenu(savedSearches, searchMenuState, sendSearchMenuAction),
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow(): Promise<void> {
  closeApproved = false;
  documentExportAvailable = false;
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: 'Textotheque',
    backgroundColor: '#f5f2ec',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) {
    await mainWindow.loadURL('http://localhost:5173');
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  refreshApplicationMenu();

  mainWindow.on('close', (event) => {
    if (closeApproved) {
      return;
    }

    event.preventDefault();
    mainWindow?.webContents.send('app:close-requested');
  });
}

function openWindow(): void {
  void createWindow().catch((error: unknown) => {
    console.error('[Electron createWindow]', error);
  });
}

async function runIpcErrorCheck(): Promise<void> {
  const checkWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await checkWindow.loadURL('data:text/html,<html><body>ipc error check</body></html>');
  const result = await checkWindow.webContents.executeJavaScript(`
    (async () => {
      try {
        await window.textotheque.listDocuments();
        return { rejected: false, message: null };
      } catch (error) {
        return {
          rejected: true,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    })()
  `);

  console.log(`textotheque ipc error check: ${JSON.stringify(result)}`);
  checkWindow.destroy();
  app.quit();
}

app.whenReady().then(() => {
  if (identityCheckRequested) {
    console.log(
      `textotheque app identity: ${JSON.stringify({
        name: app.getName(),
        appData: app.getPath('appData'),
        userData: app.getPath('userData'),
        sessionData: app.getPath('sessionData'),
        database: getDatabasePath(),
      })}`
    );
    app.quit();
    return;
  }

  registerIpcHandlers();
  if (ipcErrorCheckRequested) {
    void runIpcErrorCheck().catch((error: unknown) => {
      console.error('[IPC error check]', error);
      app.exit(1);
    });
    return;
  }

  openWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  libraryManager?.close();
});
