import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTextothequeDatabase, DocumentInput, TextothequeDatabase } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let database: TextothequeDatabase | null = null;
let closeApproved = false;

function getDatabase(): TextothequeDatabase {
  if (!database) {
    const dbPath = process.env.TEXTOTHEQUE_DB_PATH ?? path.join(app.getPath('userData'), 'textotheque.sqlite');
    database = createTextothequeDatabase(dbPath);
  }
  return database;
}

function registerIpcHandlers(): void {
  ipcMain.handle('documents:list', () => getDatabase().listDocuments());
  ipcMain.handle('documents:create', () => getDatabase().createDocument());
  ipcMain.handle('documents:get', (_event, id: number) => getDatabase().getDocument(id));
  ipcMain.handle('documents:update', (_event, id: number, input: DocumentInput) =>
    getDatabase().updateDocument(id, input)
  );
  ipcMain.handle('documents:mark-opened', (_event, id: number) => getDatabase().markOpened(id));
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
