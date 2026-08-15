import type { LibraryBackupResult, LibraryInfo } from '../types/library';

export async function getLibraryInfo(): Promise<LibraryInfo> {
  return window.textotheque.getLibraryInfo();
}

export async function backupLibrary(): Promise<LibraryBackupResult> {
  return window.textotheque.backupLibrary();
}
