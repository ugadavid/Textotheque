import type { DocumentInput, Folder, SpecialDocumentRole, TextDocument } from './document';
import type { CatalogDocument, DocumentCatalogOptions } from './catalog';
import type { SearchDocument, SearchDocumentsOptions } from './search';
import type { LibraryBackupResult, LibraryCreateResult, LibraryCreateSelection, LibraryInfo, LibraryMenuAction, LibraryOpenResult } from './library';
import type { FileMenuAction, TextExportDraft, TextExportResult } from './text-export';

declare global {
  interface Window {
    textotheque: {
      getLibraryInfo: () => Promise<LibraryInfo>;
      getLibraryStartupNotice: () => Promise<string | null>;
      backupLibrary: () => Promise<LibraryBackupResult>;
      chooseOpenLibrary: () => Promise<LibraryOpenResult>;
      openLibrary: (candidatePath: string, migrationApproved: boolean) => Promise<LibraryOpenResult>;
      inspectLibrary: (candidatePath: string) => Promise<LibraryOpenResult>;
      chooseCreateLibrary: () => Promise<LibraryCreateSelection>;
      createLibrary: (candidatePath: string) => Promise<LibraryCreateResult>;
      onLibraryMenuAction: (callback: (action: LibraryMenuAction) => void) => () => void;
      exportTextDocument: (draft: TextExportDraft) => Promise<TextExportResult>;
      setDocumentExportAvailable: (available: boolean) => Promise<void>;
      onFileMenuAction: (callback: (action: FileMenuAction) => void) => () => void;
      listDocuments: () => Promise<TextDocument[]>;
      listDocumentCatalog: (options: DocumentCatalogOptions) => Promise<CatalogDocument[]>;
      searchDocuments: (options: SearchDocumentsOptions) => Promise<SearchDocument[]>;
      listDeletedDocuments: () => Promise<TextDocument[]>;
      listFolders: () => Promise<Folder[]>;
      createFolder: (parentId: number | null) => Promise<Folder>;
      renameFolder: (id: number, name: string) => Promise<Folder>;
      createDocument: (folderId?: number | null) => Promise<TextDocument>;
      getOrCreateSpecialDocument: (role: SpecialDocumentRole) => Promise<TextDocument>;
      getDocument: (id: number) => Promise<TextDocument | null>;
      updateDocument: (id: number, input: DocumentInput, expectedLibraryPath?: string) => Promise<TextDocument>;
      markOpened: (id: number) => Promise<TextDocument>;
      trashDocument: (id: number) => Promise<TextDocument>;
      restoreDocument: (id: number) => Promise<TextDocument>;
      emptyTrash: () => Promise<number>;
      onCloseRequested: (callback: () => void) => () => void;
      approveClose: () => Promise<void>;
    };
  }
}

export {};
