import { app, BrowserWindow, ipcMain } from 'electron';
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

function registerIpcHandlers(): void {
  ipcMain.handle('documents:list', () => getDatabase().listDocuments());
  ipcMain.handle('documents:list-deleted', () => getDatabase().listDeletedDocuments());
  ipcMain.handle('folders:list', () => getDatabase().listFolders());
  ipcMain.handle('folders:create', (_event, parentId: number | null) => getDatabase().createFolder(parentId));
  ipcMain.handle('folders:rename', (_event, id: number, name: string) => getDatabase().renameFolder(id, name));
  ipcMain.handle('documents:create', (_event, folderId: number | null) => getDatabase().createDocument(folderId));
  ipcMain.handle('documents:get', (_event, id: number) => getDatabase().getDocument(id));
  ipcMain.handle('documents:update', (_event, id: number, input: DocumentInput) =>
    getDatabase().updateDocument(id, input)
  );
  ipcMain.handle('documents:mark-opened', (_event, id: number) => getDatabase().markOpened(id));
  ipcMain.handle('documents:trash', (_event, id: number) => getDatabase().trashDocument(id));
  ipcMain.handle('documents:restore', (_event, id: number) => getDatabase().restoreDocument(id));
  ipcMain.handle('documents:empty-trash', () => getDatabase().emptyTrash());
  ipcMain.handle('app:approve-close', () => {
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
  void createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
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
