import {
  createTextothequeDatabase,
  createNewTextothequeDatabase,
  createVerifiedPreMigrationBackup,
  inspectTextothequeLibrary,
  type LibraryInfo,
  type LibraryInspection,
  type PreMigrationBackupResult,
  type TextothequeDatabase,
} from './database.js';
import fs from 'node:fs';
import path from 'node:path';
import type { LibraryHistoryRegistry } from './library-history.js';

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

export type LibraryCreateStatus = 'created' | 'exists' | 'create-failed';

export interface LibraryCreateResult {
  status: LibraryCreateStatus;
  library: LibraryInfo | null;
}

export interface LibraryCreateSelection {
  status: 'canceled' | 'selected' | 'exists';
  path: string | null;
}

export type LibraryMenuAction =
  | { action: 'new' }
  | { action: 'open' }
  | { action: 'known'; path: string }
  | { action: 'backup' };

interface LibraryManagerDependencies {
  createDatabase: (dbPath: string) => TextothequeDatabase;
  createNewDatabase?: (dbPath: string) => TextothequeDatabase;
  inspectLibrary: (dbPath: string) => LibraryInspection;
  createPreMigrationBackup: (inspection: LibraryInspection) => Promise<PreMigrationBackupResult>;
}

const defaultDependencies: LibraryManagerDependencies = {
  createDatabase: createTextothequeDatabase,
  createNewDatabase: createNewTextothequeDatabase,
  inspectLibrary: inspectTextothequeLibrary,
  createPreMigrationBackup: createVerifiedPreMigrationBackup,
};

export class ActiveLibraryManager {
  private database: TextothequeDatabase | null = null;
  private startupNotice: string | null = null;

  constructor(
    private readonly defaultDatabasePath: string,
    private readonly dependencies: LibraryManagerDependencies = defaultDependencies,
    private readonly history: LibraryHistoryRegistry | null = null
  ) {}

  getDatabase(): TextothequeDatabase {
    if (!this.database) {
      this.database = this.openStartupDatabase();
    }
    return this.database;
  }

  private openStartupDatabase(): TextothequeDatabase {
    const lastActivePath = this.history?.getLastActivePath();
    if (lastActivePath && !this.samePath(lastActivePath, this.defaultDatabasePath)) {
      if (!fs.existsSync(lastActivePath)) {
        this.startupNotice = 'La dernière bibliothèque est introuvable. La bibliothèque par défaut a été ouverte.';
      } else {
        let candidate: TextothequeDatabase | null = null;
        try {
          const inspection = this.dependencies.inspectLibrary(lastActivePath);
          if (inspection.compatibility === 'compatible') {
            candidate = this.dependencies.createDatabase(lastActivePath);
            this.validateDatabase(candidate);
            this.recordActivation(candidate.getLibraryInfo().path);
            return candidate;
          }
          this.startupNotice = 'La dernière bibliothèque nécessite une intervention. La bibliothèque par défaut a été ouverte.';
        } catch (error) {
          candidate?.close();
          console.error('[Library startup]', error);
          this.startupNotice = 'La dernière bibliothèque ne peut pas être ouverte. La bibliothèque par défaut a été ouverte.';
        }
      }
    }

    const fallback = this.dependencies.createDatabase(this.defaultDatabasePath);
    this.validateDatabase(fallback);
    this.recordActivation(fallback.getLibraryInfo().path);
    return fallback;
  }

  private samePath(firstPath: string, secondPath: string): boolean {
    const first = path.resolve(firstPath);
    const second = path.resolve(secondPath);
    return process.platform === 'win32' ? first.toLocaleLowerCase('en-US') === second.toLocaleLowerCase('en-US') : first === second;
  }

  private validateDatabase(database: TextothequeDatabase): void {
    database.listDocuments();
    database.listDeletedDocuments();
    database.listFolders();
  }

  private recordActivation(libraryPath: string): void {
    try {
      this.history?.recordActivation(libraryPath);
    } catch (error) {
      console.error('[Library history write]', error);
    }
  }

  getStartupNotice(): string | null {
    this.getDatabase();
    return this.startupNotice;
  }

  inspectCandidate(candidatePath: string): LibraryOpenResult {
    const activeDatabase = this.getDatabase();
    if (activeDatabase.isCurrentLibraryPath(candidatePath)) {
      return {
        status: 'same',
        inspection: null,
        library: activeDatabase.getLibraryInfo(),
        backupPath: null,
      };
    }

    const inspection = this.dependencies.inspectLibrary(candidatePath);
    return {
      status: inspection.compatibility === 'compatible' ? 'compatible' :
        inspection.compatibility === 'legacy-textotheque' ? 'needs-migration' : inspection.compatibility,
      inspection,
      library: null,
      backupPath: null,
    };
  }

  async openCandidate(candidatePath: string, migrationApproved: boolean): Promise<LibraryOpenResult> {
    const initialDecision = this.inspectCandidate(candidatePath);
    if (initialDecision.status === 'same') {
      return initialDecision;
    }
    if (
      initialDecision.status === 'too-new' ||
      initialDecision.status === 'foreign' ||
      initialDecision.status === 'invalid'
    ) {
      return initialDecision;
    }
    if (initialDecision.status === 'needs-migration' && !migrationApproved) {
      return initialDecision;
    }

    let backupPath: string | null = null;
    if (initialDecision.status === 'needs-migration') {
      try {
        const backup = await this.dependencies.createPreMigrationBackup(initialDecision.inspection!);
        backupPath = backup.path;
      } catch (error) {
        console.error('[Library pre-migration backup]', error);
        return { ...initialDecision, status: 'backup-failed', backupPath: null };
      }
    }

    let candidateDatabase: TextothequeDatabase | null = null;
    try {
      candidateDatabase = this.dependencies.createDatabase(candidatePath);
      this.validateDatabase(candidateDatabase);
      const library = candidateDatabase.getLibraryInfo();
      const previousDatabase = this.database;
      this.database = candidateDatabase;
      candidateDatabase = null;
      this.recordActivation(library.path);
      try {
        previousDatabase?.close();
      } catch (error) {
        console.error('[Library previous close]', error);
      }
      return {
        status: 'opened',
        inspection: this.dependencies.inspectLibrary(library.path),
        library,
        backupPath,
      };
    } catch (error) {
      candidateDatabase?.close();
      console.error(
        initialDecision.status === 'needs-migration' ? '[Library migration/open]' : '[Library open]',
        error
      );
      return {
        ...initialDecision,
        status: initialDecision.status === 'needs-migration' ? 'migration-failed' : 'open-failed',
        backupPath,
      };
    }
  }

  createCandidate(candidatePath: string): LibraryCreateResult {
    const resolvedPath = path.resolve(candidatePath);
    let candidateDatabase: TextothequeDatabase | null = null;
    try {
      candidateDatabase = (this.dependencies.createNewDatabase ?? createNewTextothequeDatabase)(resolvedPath);
      this.validateDatabase(candidateDatabase);
      const library = candidateDatabase.getLibraryInfo();
      const previousDatabase = this.database;
      this.database = candidateDatabase;
      candidateDatabase = null;
      this.recordActivation(library.path);
      try {
        previousDatabase?.close();
      } catch (error) {
        console.error('[Library previous close]', error);
      }
      return { status: 'created', library };
    } catch (error) {
      candidateDatabase?.close();
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return { status: 'exists', library: null };
      }
      console.error('[Library create/open]', error);
      return { status: 'create-failed', library: null };
    }
  }

  close(): void {
    this.database?.close();
    this.database = null;
  }
}
