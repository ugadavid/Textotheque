import type { DocumentInput, TextDocument } from '../types/document';

export async function listDocuments(): Promise<TextDocument[]> {
  return window.textotheque.listDocuments();
}

export async function createDocument(): Promise<TextDocument> {
  return window.textotheque.createDocument();
}

export async function selectDocument(id: number): Promise<TextDocument | null> {
  return window.textotheque.markOpened(id);
}

export async function saveDocument(id: number, input: DocumentInput): Promise<TextDocument> {
  return window.textotheque.updateDocument(id, input);
}
