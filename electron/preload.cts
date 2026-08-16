import type {
  CatalogDocument,
  DocumentCatalogOptions,
  DocumentInput,
  Folder,
  LibraryBackupResult,
  LibraryInfo,
  SavedSearchDefinition,
  SavedSearchInput,
  SavedSearchSummary,
  SearchDocument,
  SearchDocumentsOptions,
  SpecialDocumentRole,
  TextDocument,
} from './database.js';
import type { LibraryCreateResult, LibraryCreateSelection, LibraryMenuAction, LibraryOpenResult } from './library-manager.js';
import type { FileMenuAction, TextExportDraft, TextExportResult } from './text-export.js';
import type { SearchMenuAction, SearchMenuState } from './search-menu.js';

const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

const api = {
  getLibraryInfo: (): Promise<LibraryInfo> => ipcRenderer.invoke('library:get-info'),
  getLibraryStartupNotice: (): Promise<string | null> => ipcRenderer.invoke('library:get-startup-notice'),
  backupLibrary: (): Promise<LibraryBackupResult> => ipcRenderer.invoke('library:backup'),
  chooseOpenLibrary: (): Promise<LibraryOpenResult> => ipcRenderer.invoke('library:choose-open'),
  openLibrary: (candidatePath: string, migrationApproved: boolean): Promise<LibraryOpenResult> =>
    ipcRenderer.invoke('library:open', candidatePath, migrationApproved),
  inspectLibrary: (candidatePath: string): Promise<LibraryOpenResult> => ipcRenderer.invoke('library:inspect', candidatePath),
  chooseCreateLibrary: (): Promise<LibraryCreateSelection> => ipcRenderer.invoke('library:choose-create'),
  createLibrary: (candidatePath: string): Promise<LibraryCreateResult> => ipcRenderer.invoke('library:create', candidatePath),
  onLibraryMenuAction: (callback: (action: LibraryMenuAction) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: LibraryMenuAction) => callback(action);
    ipcRenderer.on('library:menu-action', listener);
    return () => ipcRenderer.removeListener('library:menu-action', listener);
  },
  exportTextDocument: (draft: TextExportDraft): Promise<TextExportResult> => ipcRenderer.invoke('file:export-text', draft),
  setDocumentExportAvailable: (available: boolean): Promise<void> =>
    ipcRenderer.invoke('file:set-export-available', available),
  onFileMenuAction: (callback: (action: FileMenuAction) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: FileMenuAction) => callback(action);
    ipcRenderer.on('file:menu-action', listener);
    return () => ipcRenderer.removeListener('file:menu-action', listener);
  },
  listDocuments: (): Promise<TextDocument[]> => ipcRenderer.invoke('documents:list'),
  listDocumentCatalog: (options: DocumentCatalogOptions): Promise<CatalogDocument[]> =>
    ipcRenderer.invoke('documents:list-catalog', options),
  searchDocuments: (options: SearchDocumentsOptions): Promise<SearchDocument[]> =>
    ipcRenderer.invoke('documents:search', options),
  listSavedSearches: (): Promise<SavedSearchSummary[]> => ipcRenderer.invoke('saved-searches:list'),
  getSavedSearch: (id: number): Promise<SavedSearchDefinition | null> => ipcRenderer.invoke('saved-searches:get', id),
  createSavedSearch: (input: SavedSearchInput, expectedLibraryPath: string): Promise<SavedSearchDefinition> =>
    ipcRenderer.invoke('saved-searches:create', input, expectedLibraryPath),
  updateSavedSearch: (id: number, criteria: SearchDocumentsOptions, expectedLibraryPath: string): Promise<SavedSearchDefinition> =>
    ipcRenderer.invoke('saved-searches:update', id, criteria, expectedLibraryPath),
  renameSavedSearch: (id: number, name: string, expectedLibraryPath: string): Promise<SavedSearchDefinition> =>
    ipcRenderer.invoke('saved-searches:rename', id, name, expectedLibraryPath),
  deleteSavedSearch: (id: number, expectedLibraryPath: string): Promise<void> =>
    ipcRenderer.invoke('saved-searches:delete', id, expectedLibraryPath),
  setSearchMenuState: (state: SearchMenuState): Promise<void> => ipcRenderer.invoke('search:set-menu-state', state),
  onSearchMenuAction: (callback: (action: SearchMenuAction) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: SearchMenuAction) => callback(action);
    ipcRenderer.on('search:menu-action', listener);
    return () => ipcRenderer.removeListener('search:menu-action', listener);
  },
  listDeletedDocuments: (): Promise<TextDocument[]> => ipcRenderer.invoke('documents:list-deleted'),
  listFolders: (): Promise<Folder[]> => ipcRenderer.invoke('folders:list'),
  createFolder: (parentId: number | null): Promise<Folder> => ipcRenderer.invoke('folders:create', parentId),
  renameFolder: (id: number, name: string): Promise<Folder> => ipcRenderer.invoke('folders:rename', id, name),
  createDocument: (folderId: number | null = null): Promise<TextDocument> =>
    ipcRenderer.invoke('documents:create', folderId),
  getOrCreateSpecialDocument: (role: SpecialDocumentRole): Promise<TextDocument> =>
    ipcRenderer.invoke('documents:get-or-create-special', role),
  getDocument: (id: number): Promise<TextDocument | null> => ipcRenderer.invoke('documents:get', id),
  updateDocument: (id: number, input: DocumentInput, expectedLibraryPath?: string): Promise<TextDocument> =>
    ipcRenderer.invoke('documents:update', id, input, expectedLibraryPath),
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
