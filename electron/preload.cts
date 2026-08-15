import type { DocumentInput, Folder, LibraryBackupResult, LibraryInfo, TextDocument } from './database.js';
import type { LibraryOpenResult } from './library-manager.js';

const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

const api = {
  getLibraryInfo: (): Promise<LibraryInfo> => ipcRenderer.invoke('library:get-info'),
  backupLibrary: (): Promise<LibraryBackupResult> => ipcRenderer.invoke('library:backup'),
  chooseOpenLibrary: (): Promise<LibraryOpenResult> => ipcRenderer.invoke('library:choose-open'),
  openLibrary: (candidatePath: string, migrationApproved: boolean): Promise<LibraryOpenResult> =>
    ipcRenderer.invoke('library:open', candidatePath, migrationApproved),
  listDocuments: (): Promise<TextDocument[]> => ipcRenderer.invoke('documents:list'),
  listDeletedDocuments: (): Promise<TextDocument[]> => ipcRenderer.invoke('documents:list-deleted'),
  listFolders: (): Promise<Folder[]> => ipcRenderer.invoke('folders:list'),
  createFolder: (parentId: number | null): Promise<Folder> => ipcRenderer.invoke('folders:create', parentId),
  renameFolder: (id: number, name: string): Promise<Folder> => ipcRenderer.invoke('folders:rename', id, name),
  createDocument: (folderId: number | null = null): Promise<TextDocument> =>
    ipcRenderer.invoke('documents:create', folderId),
  getDocument: (id: number): Promise<TextDocument | null> => ipcRenderer.invoke('documents:get', id),
  updateDocument: (id: number, input: DocumentInput): Promise<TextDocument> =>
    ipcRenderer.invoke('documents:update', id, input),
  markOpened: (id: number): Promise<TextDocument> => ipcRenderer.invoke('documents:mark-opened', id),
  trashDocument: (id: number): Promise<TextDocument> => ipcRenderer.invoke('documents:trash', id),
  restoreDocument: (id: number): Promise<TextDocument> => ipcRenderer.invoke('documents:restore', id),
  emptyTrash: (): Promise<number> => ipcRenderer.invoke('documents:empty-trash'),
  onCloseRequested: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on('app:close-requested', listener);
    return () => ipcRenderer.removeListener('app:close-requested', listener);
  },
  approveClose: (): Promise<void> => ipcRenderer.invoke('app:approve-close'),
};

contextBridge.exposeInMainWorld('textotheque', api);

export type TextothequeApi = typeof api;
