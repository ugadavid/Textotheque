import type { LibraryBackupResult, LibraryInfo, LibraryOpenResult } from '../types/library';

export async function getLibraryInfo(): Promise<LibraryInfo> {
  return window.textotheque.getLibraryInfo();
}

export async function backupLibrary(): Promise<LibraryBackupResult> {
  return window.textotheque.backupLibrary();
}

export async function chooseOpenLibrary(): Promise<LibraryOpenResult> {
  return window.textotheque.chooseOpenLibrary();
}

export async function openLibrary(candidatePath: string, migrationApproved: boolean): Promise<LibraryOpenResult> {
  return window.textotheque.openLibrary(candidatePath, migrationApproved);
}
