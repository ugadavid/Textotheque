const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { app } = require('electron');

const legacyDocumentsSchema = `
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
`;

const currentSchemaFixture = `
  CREATE TABLE documents (
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

  CREATE TABLE folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
  );

  CREATE INDEX idx_documents_updated_at ON documents(updated_at DESC);
  CREATE INDEX idx_documents_last_opened_at ON documents(last_opened_at DESC);
  CREATE INDEX idx_documents_deleted_at ON documents(deleted_at DESC);
  CREATE INDEX idx_documents_folder_id ON documents(folder_id);
  CREATE INDEX idx_folders_parent_id ON folders(parent_id);
`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function temporaryDatabasePath(label) {
  return path.join(os.tmpdir(), `textotheque-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
}

function getUserVersion(db) {
  return db.pragma('user_version', { simple: true });
}

function insertLegacyDocument(db, title, content) {
  db.prepare(
    `INSERT INTO documents
      (title, content, content_format, status, favorite, created_at, updated_at, last_opened_at, notes)
     VALUES
      (@title, @content, 'plain', 'active', 0, @now, @now, @now, @notes)`
  ).run({
    title,
    content,
    notes: 'Note legacy conservee',
    now: '2026-07-09T00:00:00.000Z',
  });
}

function inspectCurrentSchema(dbPath, expectedVersion) {
  const inspectDb = new Database(dbPath, { readonly: true });
  const version = getUserVersion(inspectDb);
  const documentColumns = new Set(inspectDb.pragma('table_info(documents)').map((column) => column.name));
  const folderColumns = new Set(inspectDb.pragma('table_info(folders)').map((column) => column.name));
  const documentIndexes = new Set(inspectDb.pragma('index_list(documents)').map((index) => index.name));
  const folderIndexes = new Set(inspectDb.pragma('index_list(folders)').map((index) => index.name));
  inspectDb.close();

  assert(version === expectedVersion, `La version finale attendue est ${expectedVersion}, pas ${version}.`);
  for (const column of ['deleted_at', 'folder_id']) {
    assert(documentColumns.has(column), `La colonne documents.${column} est absente.`);
  }
  for (const column of ['id', 'name', 'parent_id', 'position', 'created_at', 'updated_at']) {
    assert(folderColumns.has(column), `La colonne folders.${column} est absente.`);
  }
  for (const index of [
    'idx_documents_updated_at',
    'idx_documents_last_opened_at',
    'idx_documents_deleted_at',
    'idx_documents_folder_id',
  ]) {
    assert(documentIndexes.has(index), `L index ${index} est absent.`);
  }
  assert(folderIndexes.has('idx_folders_parent_id'), 'L index idx_folders_parent_id est absent.');
}

function exerciseMigratedDocument(db, title, expectedContent) {
  const document = db.listDocuments().find((candidate) => candidate.title === title);
  assert(document, `Le document ${title} n est pas retourne apres migration.`);
  assert(document.content === expectedContent, `Le contenu du document ${title} n a pas ete conserve.`);
  assert(document.deleted_at === null, `Le document ${title} ne doit pas etre en corbeille.`);
  assert(document.folder_id === null, `Le document ${title} doit rester non classe.`);

  const trashed = db.trashDocument(document.id);
  assert(Boolean(trashed.deleted_at), `Le document ${title} ne peut pas etre mis a la corbeille.`);
  assert(db.listDocuments().every((candidate) => candidate.id !== document.id), 'La liste active est incoherente.');
  assert(db.listDeletedDocuments().some((candidate) => candidate.id === document.id), 'La corbeille est incoherente.');

  const restored = db.restoreDocument(document.id);
  assert(restored.deleted_at === null, `Le document ${title} ne peut pas etre restaure.`);
  assert(restored.content === expectedContent, `La restauration de ${title} a altere son contenu.`);

  const folder = db.createFolder(null);
  const foldered = db.updateDocument(document.id, {
    title: restored.title,
    content: restored.content,
    notes: restored.notes,
    status: restored.status,
    favorite: restored.favorite === 1,
    folder_id: folder.id,
  });
  assert(foldered.folder_id === folder.id, `Le document ${title} ne peut pas utiliser les dossiers apres migration.`);
  assert(db.listFolders().some((candidate) => candidate.id === folder.id), 'Le dossier cree est absent de la liste.');
}

function testFreshDatabase(createTextothequeDatabase, currentVersion) {
  const dbPath = temporaryDatabasePath('fresh-schema');
  const db = createTextothequeDatabase(dbPath);
  const created = db.createDocument();
  const saved = db.updateDocument(created.id, {
    title: 'Document base neuve',
    content: 'Creation directe au schema courant.',
    notes: '',
    status: 'active',
    favorite: false,
    folder_id: null,
  });
  assert(saved.content === 'Creation directe au schema courant.', 'La base neuve ne permet pas une sauvegarde normale.');
  db.close();
  inspectCurrentSchema(dbPath, currentVersion);
}

function testPreTrashLegacyDatabase(createTextothequeDatabase, currentVersion) {
  const dbPath = temporaryDatabasePath('legacy-v0');
  const fixtureDb = new Database(dbPath);
  fixtureDb.exec(legacyDocumentsSchema);
  insertLegacyDocument(fixtureDb, 'Document legacy v0', 'Contenu conserve depuis une base sans deleted_at.');
  assert(getUserVersion(fixtureDb) === 0, 'La fixture legacy v0 doit commencer a user_version 0.');
  fixtureDb.close();

  const db = createTextothequeDatabase(dbPath);
  exerciseMigratedDocument(db, 'Document legacy v0', 'Contenu conserve depuis une base sans deleted_at.');
  db.close();
  inspectCurrentSchema(dbPath, currentVersion);
}

function testTrashOnlyDatabase(createTextothequeDatabase, currentVersion) {
  const dbPath = temporaryDatabasePath('legacy-v1');
  const fixtureDb = new Database(dbPath);
  fixtureDb.exec(legacyDocumentsSchema);
  fixtureDb.exec('ALTER TABLE documents ADD COLUMN deleted_at TEXT');
  insertLegacyDocument(fixtureDb, 'Document legacy v1', 'Contenu conserve depuis une base avec corbeille.');
  assert(getUserVersion(fixtureDb) === 0, 'La fixture historique avec corbeille doit commencer sans version explicite.');
  fixtureDb.close();

  const db = createTextothequeDatabase(dbPath);
  exerciseMigratedDocument(db, 'Document legacy v1', 'Contenu conserve depuis une base avec corbeille.');
  db.close();
  inspectCurrentSchema(dbPath, currentVersion);
}

function testUnversionedCurrentDatabase(createTextothequeDatabase, currentVersion) {
  const dbPath = temporaryDatabasePath('unversioned-current');
  const fixtureDb = new Database(dbPath);
  fixtureDb.exec(currentSchemaFixture);
  insertLegacyDocument(fixtureDb, 'Document structure actuelle', 'Contenu deja au schema courant.');
  assert(getUserVersion(fixtureDb) === 0, 'La base actuelle historique doit commencer sans version explicite.');
  const schemaVersionBeforeAdoption = fixtureDb.pragma('schema_version', { simple: true });
  fixtureDb.close();

  let db = createTextothequeDatabase(dbPath);
  const adoptedDocument = db.listDocuments().find((document) => document.title === 'Document structure actuelle');
  assert(adoptedDocument?.content === 'Contenu deja au schema courant.', 'L adoption a perdu le document courant.');
  db.close();

  const adoptedDb = new Database(dbPath, { readonly: true });
  const schemaVersionAfterAdoption = adoptedDb.pragma('schema_version', { simple: true });
  adoptedDb.close();
  assert(
    schemaVersionAfterAdoption === schemaVersionBeforeAdoption,
    'L adoption de la structure actuelle ne doit pas rejouer de DDL.'
  );
  inspectCurrentSchema(dbPath, currentVersion);

  db = createTextothequeDatabase(dbPath);
  db.close();
  const reopenedDb = new Database(dbPath, { readonly: true });
  const schemaVersionAfterReopen = reopenedDb.pragma('schema_version', { simple: true });
  reopenedDb.close();
  assert(schemaVersionAfterReopen === schemaVersionAfterAdoption, 'Une base actuelle ne doit pas rejouer les migrations.');
}

app
  .whenReady()
  .then(async () => {
    const { createTextothequeDatabase, CURRENT_SCHEMA_VERSION } = await import('../dist-electron/database.js');

    assert(CURRENT_SCHEMA_VERSION === 2, 'Le test legacy doit etre synchronise avec le schema courant v2.');
    testFreshDatabase(createTextothequeDatabase, CURRENT_SCHEMA_VERSION);
    testPreTrashLegacyDatabase(createTextothequeDatabase, CURRENT_SCHEMA_VERSION);
    testTrashOnlyDatabase(createTextothequeDatabase, CURRENT_SCHEMA_VERSION);
    testUnversionedCurrentDatabase(createTextothequeDatabase, CURRENT_SCHEMA_VERSION);

    console.log(`legacy migrations ok: schema ${CURRENT_SCHEMA_VERSION}, 4 scenarios`);
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
