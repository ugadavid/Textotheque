import type { LibraryBackupResult, LibraryCreateResult, LibraryCreateSelection, LibraryInfo, LibraryOpenResult } from '../types/library';

export async function getLibraryInfo(): Promise<LibraryInfo> {
  return window.textotheque.getLibraryInfo();
}

export async function getLibraryStartupNotice(): Promise<string | null> {
  return window.textotheque.getLibraryStartupNotice();
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

export async function inspectLibrary(candidatePath: string): Promise<LibraryOpenResult> {
  return window.textotheque.inspectLibrary(candidatePath);
}

export async function chooseCreateLibrary(): Promise<LibraryCreateSelection> {
  return window.textotheque.chooseCreateLibrary();
}

export async function createLibrary(candidatePath: string): Promise<LibraryCreateResult> {
  return window.textotheque.createLibrary(candidatePath);
}
