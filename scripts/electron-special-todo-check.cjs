const path = require('node:path');
const Database = require('better-sqlite3');
const { app } = require('electron');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

const tempDirectory = createTestTempDirectory('special-todo');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function databasePath(name) {
  return path.join(tempDirectory, `${name}.sqlite`);
}

function updateDocument(db, document, changes) {
  return db.updateDocument(document.id, {
    title: changes.title ?? document.title,
    content: changes.content ?? document.content,
    notes: changes.notes ?? document.notes,
    status: changes.status ?? document.status,
    favorite: changes.favorite ?? document.favorite === 1,
    folder_id: changes.folder_id ?? document.folder_id,
  });
}

function createSchemaTwoFixture(db, applicationId) {
  db.exec(`
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
    INSERT INTO folders (name, parent_id, position, created_at, updated_at)
    VALUES ('Dossier v2', NULL, 1, '2026-08-16T08:00:00.000Z', '2026-08-16T08:00:00.000Z');
    INSERT INTO documents
      (title, content, content_format, status, favorite, folder_id, created_at, updated_at, last_opened_at, deleted_at, notes)
    VALUES
      ('tot_20260816_04', 'Contenu v2 conserve', 'plain', 'active', 1, 1,
       '2026-08-16T08:00:00.000Z', '2026-08-16T08:00:00.000Z', NULL, NULL, 'Note v2');
  `);
  db.pragma(`application_id = ${applicationId}`);
  db.pragma('user_version = 2');
}

app.whenReady().then(async () => {
  const openDatabases = [];
  let successMessage;
  try {
    const {
      createTextothequeDatabase,
      CURRENT_SCHEMA_VERSION,
      TEXTOTHEQUE_APPLICATION_ID,
    } = await import('../dist-electron/database.js');
    assert(CURRENT_SCHEMA_VERSION === 4, 'Le test TODO doit utiliser le schema 4.');

    const openDatabase = (name) => {
      const db = createTextothequeDatabase(databasePath(name));
      openDatabases.push(db);
      return db;
    };
    const closeDatabase = (db) => {
      db.close();
      openDatabases.splice(openDatabases.indexOf(db), 1);
    };
    const day = new Date(2026, 7, 16, 10, 0, 0, 0);

    const primaryPath = databasePath('primary');
    let primary = openDatabase('primary');
    assert(primary.listDocuments().filter((document) => document.special_role === 'todo').length === 0,
      'Une base neuve ne doit pas creer de TODO automatiquement.');

    const firstNormal = primary.createDocument(null, day);
    assert(firstNormal.title === 'tot_20260816_01', 'Le premier titre automatique est incorrect.');
    const todo = primary.getOrCreateSpecialDocument('todo');
    assert(todo.title === 'TODO', 'Le titre initial du TODO est incorrect.');
    assert(todo.special_role === 'todo', 'Le role special du TODO est absent.');
    assert(todo.status === 'active' && todo.content_format === 'plain', 'Le TODO doit etre un document plain actif.');
    assert(todo.folder_id === null && todo.favorite === 0 && todo.notes === '', 'Les metadonnees initiales du TODO sont incorrectes.');

    const secondNormal = primary.createDocument(null, day);
    assert(secondNormal.title === 'tot_20260816_02', 'Le TODO a consomme un numero automatique.');
    const reopenedTodo = primary.getOrCreateSpecialDocument('todo');
    assert(reopenedTodo.id === todo.id, 'Le second acces ne retourne pas le meme TODO.');
    assert(primary.listDocuments().filter((document) => document.special_role === 'todo').length === 1,
      'Plus d un TODO est present dans la bibliotheque.');

    const renamedTodo = updateDocument(primary, reopenedTodo, {
      title: 'Mon planning',
      content: 'Mot unique TODO: hippocampe.',
    });
    assert(renamedTodo.special_role === 'todo', 'updateDocument a modifie le role special.');
    assert(primary.getOrCreateSpecialDocument('todo').id === todo.id, 'Le TODO est recherche par son titre au lieu de son role.');
    assert(primary.listDocuments().some((document) => document.content.includes('hippocampe')),
      'Le TODO n est pas retrouve dans la liste generale utilisee par la recherche.');

    let trashError = null;
    try {
      primary.trashDocument(todo.id);
    } catch (error) {
      trashError = error;
    }
    assert(trashError instanceof Error && /permanent/i.test(trashError.message),
      'La couche DB doit refuser la mise a la corbeille du TODO.');
    assert(primary.getDocument(todo.id)?.deleted_at === null, 'Le refus de corbeille a mute le TODO.');

    const emptyDraftTodo = updateDocument(primary, primary.getDocument(todo.id), {
      title: 'TODO vide',
      content: '',
      notes: '',
      status: 'draft',
      favorite: false,
      folder_id: null,
    });
    assert(emptyDraftTodo.special_role === 'todo', 'Le TODO vide a perdu son role.');
    closeDatabase(primary);
    primary = openDatabase('primary');
    assert(primary.getDocument(todo.id)?.deleted_at === null, 'Le nettoyage startup a mis le TODO vide en corbeille.');

    const backupTodo = updateDocument(primary, primary.getDocument(todo.id), {
      title: 'TODO sauvegarde',
      content: 'Contenu preserve dans le snapshot.',
      status: 'active',
    });
    const backupPath = databasePath('backup');
    const backupInspection = await primary.backupTo(backupPath);
    assert(backupInspection.compatibility === 'compatible', 'Le backup du TODO n est pas compatible.');
    const backupDb = createTextothequeDatabase(backupPath);
    openDatabases.push(backupDb);
    const backedUpTodo = backupDb.getOrCreateSpecialDocument('todo');
    assert(backedUpTodo.id === backupTodo.id && backedUpTodo.special_role === 'todo', 'Le backup a perdu l identite du TODO.');
    assert(backedUpTodo.content === 'Contenu preserve dans le snapshot.', 'Le backup a perdu le contenu du TODO.');

    closeDatabase(primary);
    let uniqueError = null;
    let domainError = null;
    const rawPrimary = new Database(primaryPath);
    try {
      rawPrimary.prepare(
        `INSERT INTO documents (title, content, content_format, status, favorite, folder_id, special_role, created_at, updated_at, notes)
         VALUES ('Second TODO', '', 'plain', 'active', 0, NULL, 'todo', @now, @now, '')`
      ).run({ now: '2026-08-16T11:00:00.000Z' });
    } catch (error) {
      uniqueError = error;
    }
    try {
      rawPrimary.prepare(
        `INSERT INTO documents (title, content, content_format, status, favorite, folder_id, special_role, created_at, updated_at, notes)
         VALUES ('Role inconnu', '', 'plain', 'active', 0, NULL, 'inbox', @now, @now, '')`
      ).run({ now: '2026-08-16T11:00:00.000Z' });
    } catch (error) {
      domainError = error;
    }
    rawPrimary.close();
    assert(uniqueError instanceof Error, 'L index SQLite n interdit pas un second TODO.');
    assert(domainError instanceof Error, 'Le CHECK SQLite accepte un role hors domaine.');

    const libraryA = openDatabase('library-a');
    const libraryB = openDatabase('library-b');
    const todoA = updateDocument(libraryA, libraryA.getOrCreateSpecialDocument('todo'), { content: 'TODO A' });
    const todoB = updateDocument(libraryB, libraryB.getOrCreateSpecialDocument('todo'), { content: 'TODO B' });
    assert(todoA.content !== todoB.content, 'Les contenus TODO de deux bibliotheques ne sont pas independants.');
    assert(libraryA.getOrCreateSpecialDocument('todo').content === 'TODO A', 'Le TODO A a ete remplace par le TODO B.');
    assert(libraryB.getOrCreateSpecialDocument('todo').content === 'TODO B', 'Le TODO B a ete remplace par le TODO A.');

    const migrationPath = databasePath('schema-v2');
    const fixture = new Database(migrationPath);
    createSchemaTwoFixture(fixture, TEXTOTHEQUE_APPLICATION_ID);
    fixture.close();
    const migrated = createTextothequeDatabase(migrationPath);
    openDatabases.push(migrated);
    assert(migrated.getLibraryInfo().userVersion === 4, 'La migration v2 vers v4 n a pas abouti.');
    const migratedDocument = migrated.listDocuments().find((document) => document.title === 'tot_20260816_04');
    assert(migratedDocument?.content === 'Contenu v2 conserve' && migratedDocument.notes === 'Note v2',
      'La migration v2 vers v3 a altere le document existant.');
    assert(migratedDocument.special_role === null && migratedDocument.folder_id === 1,
      'La migration n a pas conserve le classement ou initialise special_role a NULL.');
    assert(migrated.listFolders()[0]?.name === 'Dossier v2', 'La migration a perdu le dossier v2.');
    assert(migrated.getOrCreateSpecialDocument('todo').special_role === 'todo',
      'La creation du TODO echoue apres migration v2 vers v3.');

    successMessage = 'special TODO: schema 4, lazy creation, permanence, backup and independent libraries ok';
  } finally {
    for (const db of openDatabases.splice(0)) db.close();
    removeTestTempDirectory(tempDirectory);
  }

  console.log(successMessage);
  console.log(`special-todo temporary resources cleaned: ${tempDirectory}`);
  app.quit();
}).catch((error) => {
  console.error(error);
  try {
    removeTestTempDirectory(tempDirectory);
  } catch (cleanupError) {
    console.error(cleanupError);
  }
  app.exit(1);
});
