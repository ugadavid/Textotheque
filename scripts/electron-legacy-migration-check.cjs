const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { app } = require('electron');

app
  .whenReady()
  .then(async () => {
    const { createTextothequeDatabase } = await import('../dist-electron/database.js');
    const dbPath = path.join(os.tmpdir(), `textotheque-legacy-migration-${Date.now()}.sqlite`);
    const legacyDb = new Database(dbPath);

    legacyDb.exec(`
      CREATE TABLE documents (
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

      CREATE INDEX idx_documents_updated_at ON documents(updated_at DESC);
      CREATE INDEX idx_documents_last_opened_at ON documents(last_opened_at DESC);
    `);

    legacyDb
      .prepare(
        `INSERT INTO documents
          (title, content, content_format, status, favorite, created_at, updated_at, last_opened_at, notes)
         VALUES
          (@title, @content, 'plain', 'active', 0, @now, @now, @now, @notes)`
      )
      .run({
        title: 'Document legacy',
        content: 'Contenu conserve depuis une base sans deleted_at.',
        notes: 'Note legacy',
        now: '2026-07-09T00:00:00.000Z',
      });

    legacyDb.close();

    let db = createTextothequeDatabase(dbPath);
    const inspectDb = new Database(dbPath);
    const columns = inspectDb.prepare(`PRAGMA table_info(documents)`).all();
    const folderTable = inspectDb
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'folders'`)
      .get();
    inspectDb.close();
    const hasDeletedAt = columns.some((column) => column.name === 'deleted_at');
    const hasFolderId = columns.some((column) => column.name === 'folder_id');
    const activeDocuments = db.listDocuments();
    const deletedDocuments = db.listDeletedDocuments();

    if (!hasDeletedAt) {
      throw new Error('La colonne deleted_at n a pas ete ajoutee a la base legacy.');
    }

    if (!hasFolderId) {
      throw new Error('La colonne folder_id n a pas ete ajoutee a la base legacy.');
    }

    if (!folderTable) {
      throw new Error('La table folders n a pas ete creee sur la base legacy.');
    }

    if (activeDocuments.length !== 1 || activeDocuments[0].title !== 'Document legacy') {
      throw new Error('Le document legacy n est pas retourne comme document actif.');
    }

    if (activeDocuments[0].deleted_at !== null) {
      throw new Error('Le document legacy doit avoir deleted_at a NULL apres migration.');
    }

    if (activeDocuments[0].folder_id !== null) {
      throw new Error('Le document legacy doit rester non classe apres migration.');
    }

    if (deletedDocuments.length !== 0) {
      throw new Error('La corbeille doit etre vide apres migration legacy.');
    }

    const trashed = db.trashDocument(activeDocuments[0].id);
    if (!trashed.deleted_at) {
      throw new Error('Le document legacy ne peut pas etre mis a la corbeille apres migration.');
    }

    if (db.listDocuments().length !== 0 || db.listDeletedDocuments().length !== 1) {
      throw new Error('Les listes actif/corbeille sont incoherentes apres mise a la corbeille.');
    }

    const restored = db.restoreDocument(activeDocuments[0].id);
    if (restored.deleted_at !== null || restored.content !== 'Contenu conserve depuis une base sans deleted_at.') {
      throw new Error('Le document legacy restaure est incorrect.');
    }

    db.close();
    console.log(`legacy migration ok: ${dbPath}`);
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
