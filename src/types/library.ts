export interface LibraryInfo {
  path: string;
  fileName: string;
  applicationId: number;
  userVersion: number;
  isTextotheque: boolean;
}

export interface LibraryBackupResult {
  canceled: boolean;
  path: string | null;
  fileName: string | null;
  error: 'same-source' | null;
}
