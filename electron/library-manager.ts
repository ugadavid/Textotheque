import {
  createTextothequeDatabase,
  createVerifiedPreMigrationBackup,
  inspectTextothequeLibrary,
  type LibraryInfo,
  type LibraryInspection,
  type PreMigrationBackupResult,
  type TextothequeDatabase,
} from './database.js';

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

interface LibraryManagerDependencies {
  createDatabase: (dbPath: string) => TextothequeDatabase;
  inspectLibrary: (dbPath: string) => LibraryInspection;
  createPreMigrationBackup: (inspection: LibraryInspection) => Promise<PreMigrationBackupResult>;
}

const defaultDependencies: LibraryManagerDependencies = {
  createDatabase: createTextothequeDatabase,
  inspectLibrary: inspectTextothequeLibrary,
  createPreMigrationBackup: createVerifiedPreMigrationBackup,
};

export class ActiveLibraryManager {
  private database: TextothequeDatabase | null = null;

  constructor(
    private readonly defaultDatabasePath: string,
    private readonly dependencies: LibraryManagerDependencies = defaultDependencies
  ) {}

  getDatabase(): TextothequeDatabase {
    if (!this.database) {
      this.database = this.dependencies.createDatabase(this.defaultDatabasePath);
    }
    return this.database;
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
      candidateDatabase.listDocuments();
      candidateDatabase.listDeletedDocuments();
      candidateDatabase.listFolders();
      const library = candidateDatabase.getLibraryInfo();
      const previousDatabase = this.database;
      this.database = candidateDatabase;
      candidateDatabase = null;
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

  close(): void {
    this.database?.close();
    this.database = null;
  }
}
