import type { DocumentInput, Folder, SpecialDocumentRole, TextDocument } from '../types/document';

export async function listDocuments(): Promise<TextDocument[]> {
  return window.textotheque.listDocuments();
}

export async function listDeletedDocuments(): Promise<TextDocument[]> {
  return window.textotheque.listDeletedDocuments();
}

export async function listFolders(): Promise<Folder[]> {
  return window.textotheque.listFolders();
}

export async function createFolder(parentId: number | null = null): Promise<Folder> {
  return window.textotheque.createFolder(parentId);
}

export async function renameFolder(id: number, name: string): Promise<Folder> {
  return window.textotheque.renameFolder(id, name);
}

export async function createDocument(folderId: number | null = null): Promise<TextDocument> {
  return window.textotheque.createDocument(folderId);
}

export async function getOrCreateSpecialDocument(role: SpecialDocumentRole): Promise<TextDocument> {
  return window.textotheque.getOrCreateSpecialDocument(role);
}

export async function getDocument(id: number): Promise<TextDocument | null> {
  return window.textotheque.getDocument(id);
}

export async function selectDocument(id: number): Promise<TextDocument | null> {
  return window.textotheque.markOpened(id);
}

export async function saveDocument(id: number, input: DocumentInput, expectedLibraryPath?: string): Promise<TextDocument> {
  return window.textotheque.updateDocument(id, input, expectedLibraryPath);
}

export async function trashDocument(id: number): Promise<TextDocument> {
  return window.textotheque.trashDocument(id);
}

export async function restoreDocument(id: number): Promise<TextDocument> {
  return window.textotheque.restoreDocument(id);
}

export async function emptyTrash(): Promise<number> {
  return window.textotheque.emptyTrash();
}
