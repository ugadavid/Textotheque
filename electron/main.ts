import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent, type SaveDialogOptions } from 'electron';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createTextothequeDatabase, DocumentInput, TextothequeDatabase } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const packageMetadata = require('../package.json') as { name: string; productName?: string };
const applicationName = packageMetadata.productName ?? packageMetadata.name;
const identityCheckRequested = process.argv.includes('--textotheque-check-app-identity');
const ipcErrorCheckRequested = process.argv.includes('--textotheque-check-ipc-error');

app.setName(applicationName);

let mainWindow: BrowserWindow | null = null;
let database: TextothequeDatabase | null = null;
let closeApproved = false;

function getDatabasePath(): string {
  return process.env.TEXTOTHEQUE_DB_PATH ?? path.join(app.getPath('userData'), 'textotheque.sqlite');
}

function getDatabase(): TextothequeDatabase {
  if (!database) {
    database = createTextothequeDatabase(getDatabasePath());
  }
  return database;
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
  registerIpcHandler('documents:list', () => getDatabase().listDocuments());
  registerIpcHandler('documents:list-deleted', () => getDatabase().listDeletedDocuments());
  registerIpcHandler('folders:list', () => getDatabase().listFolders());
  registerIpcHandler('folders:create', (_event, parentId: number | null) => getDatabase().createFolder(parentId));
  registerIpcHandler('folders:rename', (_event, id: number, name: string) => getDatabase().renameFolder(id, name));
  registerIpcHandler('documents:create', (_event, folderId: number | null) => getDatabase().createDocument(folderId));
  registerIpcHandler('documents:get', (_event, id: number) => getDatabase().getDocument(id));
  registerIpcHandler('documents:update', (_event, id: number, input: DocumentInput) =>
    getDatabase().updateDocument(id, input)
  );
  registerIpcHandler('documents:mark-opened', (_event, id: number) => getDatabase().markOpened(id));
  registerIpcHandler('documents:trash', (_event, id: number) => getDatabase().trashDocument(id));
  registerIpcHandler('documents:restore', (_event, id: number) => getDatabase().restoreDocument(id));
  registerIpcHandler('documents:empty-trash', () => getDatabase().emptyTrash());
  registerIpcHandler('app:approve-close', () => {
    closeApproved = true;
    mainWindow?.close();
  });
}

async function createWindow(): Promise<void> {
  closeApproved = false;
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
  database?.close();
});
