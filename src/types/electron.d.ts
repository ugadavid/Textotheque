import type { DocumentInput, Folder, TextDocument } from './document';
import type { LibraryBackupResult, LibraryCreateResult, LibraryCreateSelection, LibraryInfo, LibraryMenuAction, LibraryOpenResult } from './library';

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
      listDocuments: () => Promise<TextDocument[]>;
      listDeletedDocuments: () => Promise<TextDocument[]>;
      listFolders: () => Promise<Folder[]>;
      createFolder: (parentId: number | null) => Promise<Folder>;
      renameFolder: (id: number, name: string) => Promise<Folder>;
      createDocument: (folderId?: number | null) => Promise<TextDocument>;
      getDocument: (id: number) => Promise<TextDocument | null>;
      updateDocument: (id: number, input: DocumentInput) => Promise<TextDocument>;
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
