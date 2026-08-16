-- Snapshot documentaire du schema SQLite courant (user_version = 4).
-- La source canonique executee et les migrations versionnees vivent dans
-- electron/database.ts. Ce fichier n'est pas charge par l'application.
-- Les ecritures applicatives fournissent des timestamps ISO UTC explicites ; les defaults SQL restent des filets de secours.

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  content_format TEXT NOT NULL DEFAULT 'plain' CHECK (content_format IN ('plain', 'markdown', 'rich')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'to_review', 'final', 'archived')),
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
  folder_id INTEGER,
  special_role TEXT CHECK (special_role IS NULL OR special_role IN ('todo')),
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

CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_last_opened_at ON documents(last_opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_special_role_unique
ON documents(special_role)
WHERE special_role IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  title,
  content,
  notes,
  content='documents',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS documents_fts_after_insert
AFTER INSERT ON documents
BEGIN
  INSERT INTO documents_fts(rowid, title, content, notes)
  VALUES (new.id, new.title, new.content, new.notes);
END;

CREATE TRIGGER IF NOT EXISTS documents_fts_after_delete
AFTER DELETE ON documents
BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, content, notes)
  VALUES ('delete', old.id, old.title, old.content, old.notes);
END;

CREATE TRIGGER IF NOT EXISTS documents_fts_after_text_update
AFTER UPDATE OF title, content, notes ON documents
WHEN old.title IS NOT new.title OR old.content IS NOT new.content OR old.notes IS NOT new.notes
BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, content, notes)
  VALUES ('delete', old.id, old.title, old.content, old.notes);
  INSERT INTO documents_fts(rowid, title, content, notes)
  VALUES (new.id, new.title, new.content, new.notes);
END;
