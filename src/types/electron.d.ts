import type { DocumentInput, Folder, TextDocument } from './document';

declare global {
  interface Window {
    textotheque: {
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
