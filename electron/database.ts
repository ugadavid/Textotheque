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

const schema = `
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

export class TextothequeDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(schema);
    this.runMigrations();
    this.createIndexes();
    this.cleanupEmptyDraftDocuments();
  }

  private runMigrations(): void {
    const columns = this.db.prepare(`PRAGMA table_info(documents)`).all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === 'deleted_at')) {
      this.db.exec(`ALTER TABLE documents ADD COLUMN deleted_at TEXT`);
    }
    if (!columns.some((column) => column.name === 'folder_id')) {
      this.db.exec(`ALTER TABLE documents ADD COLUMN folder_id INTEGER`);
    }
  }

  private createIndexes(): void {
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_last_opened_at ON documents(last_opened_at DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at DESC)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id)`);
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
        folder_id: input.folder_id ?? null,
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
