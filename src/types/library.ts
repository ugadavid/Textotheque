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

export type LibraryCompatibility = 'compatible' | 'legacy-textotheque' | 'too-new' | 'foreign' | 'invalid';

export interface LibraryInspection {
  path: string;
  fileName: string;
  readable: boolean;
  applicationId: number | null;
  userVersion: number | null;
  isTextotheque: boolean;
  compatibility: LibraryCompatibility;
}

export type LibraryOpenStatus =
  | 'canceled'
  | 'compatible'
  | 'needs-migration'
  | 'opened'
  | 'same'
  | 'too-new'
  | 'foreign'
  | 'invalid'
  | 'backup-failed'
  | 'migration-failed'
  | 'open-failed';

export interface LibraryOpenResult {
  status: LibraryOpenStatus;
  inspection: LibraryInspection | null;
  library: LibraryInfo | null;
  backupPath: string | null;
}

export interface LibraryCreateSelection {
  status: 'canceled' | 'selected' | 'exists';
  path: string | null;
}

export interface LibraryCreateResult {
  status: 'created' | 'exists' | 'create-failed';
  library: LibraryInfo | null;
}

export type LibraryMenuAction =
  | { action: 'new' }
  | { action: 'open' }
  | { action: 'known'; path: string }
  | { action: 'backup' };
