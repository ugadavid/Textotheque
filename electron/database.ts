import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type ContentFormat = 'plain' | 'markdown' | 'rich';
export type DocumentStatus = 'draft' | 'active' | 'to_review' | 'final' | 'archived';

export interface TextDocument {
  id: number;
  title: string;
  content: string;
  content_format: ContentFormat;
  status: DocumentStatus;
  favorite: number;
  folder_id: number | null;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  deleted_at: string | null;
  notes: string;
}

export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentInput {
  title: string;
  content: string;
  notes: string;
  status: DocumentStatus;
  favorite: boolean;
  folder_id: number | null;
}

export const CURRENT_SCHEMA_VERSION = 2;

const currentSchema = `
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  content_format TEXT NOT NULL DEFAULT 'plain' CHECK (content_format IN ('plain', 'markdown', 'rich')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'to_review', 'final', 'archived')),
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
  folder_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_opened_at TEXT,
  deleted_at TEXT,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
);
`;

interface SchemaMigration {
  version: number;
  name: string;
  migrate: (db: Database.Database) => void;
}

function tableExists(db: Database.Database, tableName: string): boolean {
  return Boolean(
    db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(tableName)
  );
}

function columnExists(db: Database.Database, tableName: string, columnName: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

const schemaMigrations: SchemaMigration[] = [
  {
    version: 1,
    name: 'add documents.deleted_at',
    migrate: (db) => {
      if (!columnExists(db, 'documents', 'deleted_at')) {
        db.exec(`ALTER TABLE documents ADD COLUMN deleted_at TEXT`);
      }
    },
  },
  {
    version: 2,
    name: 'add folders and documents.folder_id',
    migrate: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          parent_id INTEGER,
          position INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
        )
      `);
      if (!columnExists(db, 'documents', 'folder_id')) {
        db.exec(`ALTER TABLE documents ADD COLUMN folder_id INTEGER`);
      }
    },
  },
];

export class TextothequeDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeSchema();
    this.createIndexes();
    this.cleanupEmptyDraftDocuments();
  }

  private initializeSchema(): void {
    const declaredVersion = this.getSchemaVersion();
    if (declaredVersion > CURRENT_SCHEMA_VERSION) {
      throw new Error(
        `La base utilise le schema ${declaredVersion}, plus recent que le schema ${CURRENT_SCHEMA_VERSION} pris en charge.`
      );
    }

    if (!tableExists(this.db, 'documents')) {
      const createLatestSchema = this.db.transaction(() => {
        this.db.exec(currentSchema);
        this.setSchemaVersion(CURRENT_SCHEMA_VERSION);
      });
      createLatestSchema();
      this.validateCurrentSchema();
      return;
    }

    if (declaredVersion === 0) {
      this.setSchemaVersion(this.inferUnversionedSchemaVersion());
    }

    this.validateSchemaVersion(this.getSchemaVersion());
    this.runMigrations();
    this.validateCurrentSchema();
  }

  private getSchemaVersion(): number {
    return this.db.pragma('user_version', { simple: true }) as number;
  }

  private setSchemaVersion(version: number): void {
    this.db.pragma(`user_version = ${version}`);
  }

  private inferUnversionedSchemaVersion(): number {
    const hasDeletedAt = columnExists(this.db, 'documents', 'deleted_at');
    const hasFolderId = columnExists(this.db, 'documents', 'folder_id');
    const hasFolders = tableExists(this.db, 'folders');

    if (hasDeletedAt && hasFolderId && hasFolders) {
      return 2;
    }
    if (hasDeletedAt) {
      return 1;
    }
    return 0;
  }

  private runMigrations(): void {
    let currentVersion = this.getSchemaVersion();

    for (const migration of schemaMigrations) {
      if (migration.version <= currentVersion) {
        continue;
      }

      const applyMigration = this.db.transaction(() => {
        migration.migrate(this.db);
        this.setSchemaVersion(migration.version);
      });
      applyMigration();
      currentVersion = migration.version;
    }

    if (currentVersion !== CURRENT_SCHEMA_VERSION) {
      throw new Error(
        `La base utilise le schema ${currentVersion}; le schema attendu est ${CURRENT_SCHEMA_VERSION}.`
      );
    }
  }

  private validateSchemaVersion(version: number): void {
    const missingStructures: string[] = [];
    if (version >= 1 && !columnExists(this.db, 'documents', 'deleted_at')) {
      missingStructures.push('documents.deleted_at');
    }
    if (version >= 2 && !columnExists(this.db, 'documents', 'folder_id')) {
      missingStructures.push('documents.folder_id');
    }
    if (version >= 2 && !tableExists(this.db, 'folders')) {
      missingStructures.push('folders');
    }

    if (missingStructures.length > 0) {
      throw new Error(
        `Le schema declare la version ${version}, mais il manque: ${missingStructures.join(', ')}.`
      );
    }
  }

  private validateCurrentSchema(): void {
    const missingStructures: string[] = [];
    if (!columnExists(this.db, 'documents', 'deleted_at')) {
      missingStructures.push('documents.deleted_at');
    }
    if (!columnExists(this.db, 'documents', 'folder_id')) {
      missingStructures.push('documents.folder_id');
    }
    if (!tableExists(this.db, 'folders')) {
      missingStructures.push('folders');
    }

    if (missingStructures.length > 0) {
      throw new Error(`Schema SQLite incomplet: ${missingStructures.join(', ')}.`);
    }
  }

  private createIndexes(): void {
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_last_opened_at ON documents(last_opened_at DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id)`);
  }

  private assertFolderExists(folderId: number | null, operation: string): void {
    if (folderId === null) {
      return;
    }

    const folder = this.db.prepare(`SELECT 1 FROM folders WHERE id = ?`).get(folderId);
    if (!folder) {
      throw new Error(`${operation} : le dossier ${folderId} est introuvable.`);
    }
  }

  cleanupEmptyDraftDocuments(): number {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `UPDATE documents
         SET deleted_at = @now,
             updated_at = @now
         WHERE content_format = 'plain'
           AND status = 'draft'
           AND favorite = 0
           AND deleted_at IS NULL
           AND (trim(title) = '' OR title = 'Sans titre')
           AND trim(content) = ''
           AND trim(notes) = ''`
      )
      .run({ now });

    return result.changes;
  }

  listDocuments(): TextDocument[] {
    return this.db
      .prepare(
        `SELECT id, title, content, content_format, status, favorite, folder_id, created_at, updated_at, last_opened_at, deleted_at, notes
         FROM documents
         WHERE deleted_at IS NULL
         ORDER BY updated_at DESC, id DESC`
      )
      .all() as TextDocument[];
  }

  listDeletedDocuments(): TextDocument[] {
    return this.db
      .prepare(
        `SELECT id, title, content, content_format, status, favorite, folder_id, created_at, updated_at, last_opened_at, deleted_at, notes
         FROM documents
         WHERE deleted_at IS NOT NULL
         ORDER BY deleted_at DESC, updated_at DESC, id DESC`
      )
      .all() as TextDocument[];
  }

  getDocument(id: number): TextDocument | null {
    const document = this.db
      .prepare(
        `SELECT id, title, content, content_format, status, favorite, folder_id, created_at, updated_at, last_opened_at, deleted_at, notes
         FROM documents
         WHERE id = ?`
      )
      .get(id) as TextDocument | undefined;

    return document ?? null;
  }

  createDocument(folderId: number | null = null): TextDocument {
    this.assertFolderExists(folderId, 'Impossible de creer le document');
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO documents (title, content, content_format, status, favorite, folder_id, created_at, updated_at, last_opened_at, notes)
         VALUES (@title, @content, 'plain', 'draft', 0, @folder_id, @now, @now, @now, '')`
      )
      .run({ title: '', content: '', folder_id: folderId, now });

    const document = this.getDocument(Number(result.lastInsertRowid));
    if (!document) {
      throw new Error('Le document cree est introuvable.');
    }
    return document;
  }

  updateDocument(id: number, input: DocumentInput): TextDocument {
    const folderId = input.folder_id ?? null;
    this.assertFolderExists(folderId, 'Impossible de mettre a jour le document');
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE documents
         SET title = @title,
             content = @content,
             notes = @notes,
             status = @status,
             favorite = @favorite,
             folder_id = @folder_id,
             content_format = 'plain',
             updated_at = @now
         WHERE id = @id`
      )
      .run({
        id,
        title: input.title.trim(),
        content: input.content,
        notes: input.notes,
        status: input.status,
        favorite: input.favorite ? 1 : 0,
        folder_id: folderId,
        now,
      });

    const document = this.getDocument(id);
    if (!document) {
      throw new Error('Le document a mettre a jour est introuvable.');
    }
    return document;
  }

  listFolders(): Folder[] {
    return this.db
      .prepare(
        `SELECT id, name, parent_id, position, created_at, updated_at
         FROM folders
         ORDER BY parent_id IS NOT NULL, parent_id, position, name COLLATE NOCASE, id`
      )
      .all() as Folder[];
  }

  createFolder(parentId: number | null = null): Folder {
    this.assertFolderExists(parentId, 'Impossible de creer le sous-dossier');
    const now = new Date().toISOString();
    const position = this.db
      .prepare(
        `SELECT COALESCE(MAX(position), 0) + 1 AS next_position
         FROM folders
         WHERE (parent_id IS NULL AND @parent_id IS NULL) OR parent_id = @parent_id`
      )
      .get({ parent_id: parentId }) as { next_position: number };
    const result = this.db
      .prepare(
        `INSERT INTO folders (name, parent_id, position, created_at, updated_at)
         VALUES ('Nouveau dossier', @parent_id, @position, @now, @now)`
      )
      .run({ parent_id: parentId, position: position.next_position, now });

    const folder = this.db
      .prepare(`SELECT id, name, parent_id, position, created_at, updated_at FROM folders WHERE id = ?`)
      .get(Number(result.lastInsertRowid)) as Folder | undefined;
    if (!folder) {
      throw new Error('Le dossier cree est introuvable.');
    }
    return folder;
  }

  renameFolder(id: number, name: string): Folder {
    const now = new Date().toISOString();
    const normalizedName = name.trim() || 'Nouveau dossier';
    this.db
      .prepare(
        `UPDATE folders
         SET name = @name,
             updated_at = @now
         WHERE id = @id`
      )
      .run({ id, name: normalizedName, now });

    const folder = this.db
      .prepare(`SELECT id, name, parent_id, position, created_at, updated_at FROM folders WHERE id = ?`)
      .get(id) as Folder | undefined;
    if (!folder) {
      throw new Error('Le dossier a renommer est introuvable.');
    }
    return folder;
  }

  markOpened(id: number): TextDocument {
    const now = new Date().toISOString();
    this.db.prepare(`UPDATE documents SET last_opened_at = @now WHERE id = @id`).run({ id, now });

    const document = this.getDocument(id);
    if (!document) {
      throw new Error('Le document ouvert est introuvable.');
    }
    return document;
  }

  trashDocument(id: number): TextDocument {
    const now = new Date().toISOString();
    this.db
      .prepare(`UPDATE documents SET deleted_at = @now, updated_at = @now WHERE id = @id AND deleted_at IS NULL`)
      .run({ id, now });

    const document = this.getDocument(id);
    if (!document) {
      throw new Error('Le document a mettre a la corbeille est introuvable.');
    }
    return document;
  }

  restoreDocument(id: number): TextDocument {
    const now = new Date().toISOString();
    this.db
      .prepare(`UPDATE documents SET deleted_at = NULL, updated_at = @now WHERE id = @id AND deleted_at IS NOT NULL`)
      .run({ id, now });

    const document = this.getDocument(id);
    if (!document) {
      throw new Error('Le document a restaurer est introuvable.');
    }
    return document;
  }

  emptyTrash(): number {
    const result = this.db.prepare(`DELETE FROM documents WHERE deleted_at IS NOT NULL`).run();
    return result.changes;
  }

  close(): void {
    this.db.close();
  }
}

export function createTextothequeDatabase(dbPath: string): TextothequeDatabase {
  return new TextothequeDatabase(dbPath);
}
