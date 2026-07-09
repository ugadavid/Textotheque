import type { DocumentInput, TextDocument } from './document';

declare global {
  interface Window {
    textotheque: {
      listDocuments: () => Promise<TextDocument[]>;
      createDocument: () => Promise<TextDocument>;
      getDocument: (id: number) => Promise<TextDocument | null>;
      updateDocument: (id: number, input: DocumentInput) => Promise<TextDocument>;
      markOpened: (id: number) => Promise<TextDocument>;
      onCloseRequested: (callback: () => void) => () => void;
      approveClose: () => Promise<void>;
    };
  }
}

export {};
