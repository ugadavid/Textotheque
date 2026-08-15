const path = require('node:path');
const Database = require('better-sqlite3');
const { app } = require('electron');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

const tempDirectory = createTestTempDirectory('legacy-migration');

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
  return path.join(tempDirectory, `${label}.sqlite`);
}

function withDatabase(db, operation) {
  try {
    return operation(db);
  } finally {
    db.close();
  }
}

function getUserVersion(db) {
  return db.pragma('user_version', { simple: true });
}

function getApplicationId(db) {
  return db.pragma('application_id', { simple: true });
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

function inspectCurrentSchema(dbPath, expectedVersion, expectedApplicationId) {
  const schema = withDatabase(new Database(dbPath, { readonly: true }), (inspectDb) => ({
    version: getUserVersion(inspectDb),
    applicationId: getApplicationId(inspectDb),
    documentColumns: new Set(inspectDb.pragma('table_info(documents)').map((column) => column.name)),
    folderColumns: new Set(inspectDb.pragma('table_info(folders)').map((column) => column.name)),
    documentIndexes: new Set(inspectDb.pragma('index_list(documents)').map((index) => index.name)),
    folderIndexes: new Set(inspectDb.pragma('index_list(folders)').map((index) => index.name)),
  }));

  assert(schema.version === expectedVersion, `La version finale attendue est ${expectedVersion}, pas ${schema.version}.`);
  assert(
    schema.applicationId === expectedApplicationId,
    `L application_id final attendu est ${expectedApplicationId}, pas ${schema.applicationId}.`
  );
  for (const column of ['deleted_at', 'folder_id']) {
    assert(schema.documentColumns.has(column), `La colonne documents.${column} est absente.`);
  }
  for (const column of ['id', 'name', 'parent_id', 'position', 'created_at', 'updated_at']) {
    assert(schema.folderColumns.has(column), `La colonne folders.${column} est absente.`);
  }
  for (const index of [
    'idx_documents_updated_at',
    'idx_documents_last_opened_at',
    'idx_documents_deleted_at',
    'idx_documents_folder_id',
  ]) {
    assert(schema.documentIndexes.has(index), `L index ${index} est absent.`);
  }
  assert(schema.folderIndexes.has('idx_folders_parent_id'), 'L index idx_folders_parent_id est absent.');
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

function testFreshDatabase(createTextothequeDatabase, currentVersion, applicationId) {
  const dbPath = temporaryDatabasePath('fresh-schema');
  withDatabase(createTextothequeDatabase(dbPath), (db) => {
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
  });
  inspectCurrentSchema(dbPath, currentVersion, applicationId);
}

function testPreTrashLegacyDatabase(createTextothequeDatabase, currentVersion, applicationId) {
  const dbPath = temporaryDatabasePath('legacy-v0');
  withDatabase(new Database(dbPath), (fixtureDb) => {
    fixtureDb.exec(legacyDocumentsSchema);
    insertLegacyDocument(fixtureDb, 'Document legacy v0', 'Contenu conserve depuis une base sans deleted_at.');
    assert(getUserVersion(fixtureDb) === 0, 'La fixture legacy v0 doit commencer a user_version 0.');
    assert(getApplicationId(fixtureDb) === 0, 'La fixture legacy v0 doit commencer sans application_id.');
  });

  withDatabase(createTextothequeDatabase(dbPath), (db) => {
    exerciseMigratedDocument(db, 'Document legacy v0', 'Contenu conserve depuis une base sans deleted_at.');
  });
  inspectCurrentSchema(dbPath, currentVersion, applicationId);
}

function testTrashOnlyDatabase(createTextothequeDatabase, currentVersion, applicationId) {
  const dbPath = temporaryDatabasePath('legacy-v1');
  withDatabase(new Database(dbPath), (fixtureDb) => {
    fixtureDb.exec(legacyDocumentsSchema);
    fixtureDb.exec('ALTER TABLE documents ADD COLUMN deleted_at TEXT');
    insertLegacyDocument(fixtureDb, 'Document legacy v1', 'Contenu conserve depuis une base avec corbeille.');
    assert(getUserVersion(fixtureDb) === 0, 'La fixture historique avec corbeille doit commencer sans version explicite.');
    assert(getApplicationId(fixtureDb) === 0, 'La fixture historique avec corbeille doit commencer sans application_id.');
  });

  withDatabase(createTextothequeDatabase(dbPath), (db) => {
    exerciseMigratedDocument(db, 'Document legacy v1', 'Contenu conserve depuis une base avec corbeille.');
  });
  inspectCurrentSchema(dbPath, currentVersion, applicationId);
}

function testUnversionedCurrentDatabase(createTextothequeDatabase, currentVersion, applicationId) {
  const dbPath = temporaryDatabasePath('unversioned-current');
  const schemaVersionBeforeAdoption = withDatabase(new Database(dbPath), (fixtureDb) => {
    fixtureDb.exec(currentSchemaFixture);
    insertLegacyDocument(fixtureDb, 'Document structure actuelle', 'Contenu deja au schema courant.');
    assert(getUserVersion(fixtureDb) === 0, 'La base actuelle historique doit commencer sans version explicite.');
    assert(getApplicationId(fixtureDb) === 0, 'La base actuelle historique doit commencer sans application_id.');
    return fixtureDb.pragma('schema_version', { simple: true });
  });

  withDatabase(createTextothequeDatabase(dbPath), (db) => {
    const adoptedDocument = db.listDocuments().find((document) => document.title === 'Document structure actuelle');
    assert(adoptedDocument?.content === 'Contenu deja au schema courant.', 'L adoption a perdu le document courant.');
  });

  const schemaVersionAfterAdoption = withDatabase(
    new Database(dbPath, { readonly: true }),
    (adoptedDb) => adoptedDb.pragma('schema_version', { simple: true })
  );
  assert(
    schemaVersionAfterAdoption === schemaVersionBeforeAdoption,
    'L adoption de la structure actuelle ne doit pas rejouer de DDL.'
  );
  inspectCurrentSchema(dbPath, currentVersion, applicationId);

  withDatabase(createTextothequeDatabase(dbPath), () => undefined);
  const schemaVersionAfterReopen = withDatabase(
    new Database(dbPath, { readonly: true }),
    (reopenedDb) => reopenedDb.pragma('schema_version', { simple: true })
  );
  assert(schemaVersionAfterReopen === schemaVersionAfterAdoption, 'Une base actuelle ne doit pas rejouer les migrations.');
}

app
  .whenReady()
  .then(async () => {
    let successMessage;
    try {
      const { createTextothequeDatabase, CURRENT_SCHEMA_VERSION, TEXTOTHEQUE_APPLICATION_ID } = await import('../dist-electron/database.js');

      assert(CURRENT_SCHEMA_VERSION === 2, 'Le test legacy doit etre synchronise avec le schema courant v2.');
      assert(TEXTOTHEQUE_APPLICATION_ID === 1413830735, 'L application_id Textotheque definitif a change.');
      testFreshDatabase(createTextothequeDatabase, CURRENT_SCHEMA_VERSION, TEXTOTHEQUE_APPLICATION_ID);
      testPreTrashLegacyDatabase(createTextothequeDatabase, CURRENT_SCHEMA_VERSION, TEXTOTHEQUE_APPLICATION_ID);
      testTrashOnlyDatabase(createTextothequeDatabase, CURRENT_SCHEMA_VERSION, TEXTOTHEQUE_APPLICATION_ID);
      testUnversionedCurrentDatabase(createTextothequeDatabase, CURRENT_SCHEMA_VERSION, TEXTOTHEQUE_APPLICATION_ID);
      successMessage = `legacy migrations ok: schema ${CURRENT_SCHEMA_VERSION}, 4 scenarios`;
    } finally {
      removeTestTempDirectory(tempDirectory);
    }

    console.log(successMessage);
    console.log(`legacy migration temporary resources cleaned: ${tempDirectory}`);
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    try {
      removeTestTempDirectory(tempDirectory);
    } catch (cleanupError) {
      console.error(cleanupError);
    }
    app.exit(1);
  });
