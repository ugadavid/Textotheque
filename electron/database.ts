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
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  notes: string;
}

export interface DocumentInput {
  title: string;
  content: string;
  notes: string;
  status: DocumentStatus;
  favorite: boolean;
}

const schema = `
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  content_format TEXT NOT NULL DEFAULT 'plain' CHECK (content_format IN ('plain', 'markdown', 'rich')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'to_review', 'final', 'archived')),
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_opened_at TEXT,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_last_opened_at ON documents(last_opened_at DESC);
`;

export class TextothequeDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(schema);
    this.cleanupEmptyDraftDocuments();
  }

  cleanupEmptyDraftDocuments(): number {
    const result = this.db
      .prepare(
        `DELETE FROM documents
         WHERE content_format = 'plain'
           AND status = 'draft'
           AND favorite = 0
           AND (trim(title) = '' OR title = 'Sans titre')
           AND trim(content) = ''
           AND trim(notes) = ''`
      )
      .run();

    return result.changes;
  }

  listDocuments(): TextDocument[] {
    return this.db
      .prepare(
        `SELECT id, title, content, content_format, status, favorite, created_at, updated_at, last_opened_at, notes
         FROM documents
         ORDER BY updated_at DESC, id DESC`
      )
      .all() as TextDocument[];
  }

  getDocument(id: number): TextDocument | null {
    const document = this.db
      .prepare(
        `SELECT id, title, content, content_format, status, favorite, created_at, updated_at, last_opened_at, notes
         FROM documents
         WHERE id = ?`
      )
      .get(id) as TextDocument | undefined;

    return document ?? null;
  }

  createDocument(): TextDocument {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO documents (title, content, content_format, status, favorite, created_at, updated_at, last_opened_at, notes)
         VALUES (@title, @content, 'plain', 'draft', 0, @now, @now, @now, '')`
      )
      .run({ title: '', content: '', now });

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
        now,
      });

    const document = this.getDocument(id);
    if (!document) {
      throw new Error('Le document a mettre a jour est introuvable.');
    }
    return document;
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

  close(): void {
    this.db.close();
  }
}

export function createTextothequeDatabase(dbPath: string): TextothequeDatabase {
  return new TextothequeDatabase(dbPath);
}
