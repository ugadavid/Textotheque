const path = require('node:path');
const Database = require('better-sqlite3');
const { app } = require('electron');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

const tempDirectory = createTestTempDirectory('catalog');
const dbPath = path.join(tempDirectory, 'catalog.sqlite');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function save(db, document, input) {
  return db.updateDocument(document.id, {
    title: input.title,
    content: input.content ?? 'Contenu catalogue',
    notes: '',
    status: input.status,
    favorite: input.favorite,
    folder_id: input.folderId,
  });
}

function titles(rows) {
  return rows.map((row) => row.title);
}

function assertFirst(rows, expected, label) {
  assert(rows[0]?.title === expected, `${label}: premier titre ${rows[0]?.title}, attendu ${expected}.`);
}

app.whenReady().then(async () => {
  let db = null;
  let successMessage;
  try {
    const { createTextothequeDatabase } = await import('../dist-electron/database.js');
    db = createTextothequeDatabase(dbPath);
    const alphaFolder = db.renameFolder(db.createFolder(null).id, 'Alpha');
    const betaFolder = db.renameFolder(db.createFolder(null).id, 'Beta');

    const zebra = save(db, db.createDocument(betaFolder.id), {
      title: 'Zebra', status: 'draft', favorite: false, folderId: betaFolder.id,
    });
    const alpha = save(db, db.createDocument(null), {
      title: 'alpha', status: 'final', favorite: true, folderId: null,
    });
    const bravo = save(db, db.createDocument(alphaFolder.id), {
      title: 'Bravo', status: 'active', favorite: false, folderId: alphaFolder.id,
    });
    const deleted = save(db, db.createDocument(null), {
      title: 'Supprime', status: 'archived', favorite: true, folderId: null,
    });
    db.trashDocument(deleted.id);
    const todo = save(db, db.getOrCreateSpecialDocument('todo'), {
      title: 'TODO-mgolo', status: 'active', favorite: false, folderId: null, content: 'TODO catalogue',
    });
    db.close();
    db = null;

    const raw = new Database(dbPath);
    const setDates = raw.prepare(
      `UPDATE documents SET created_at = @created, updated_at = @updated WHERE id = @id`
    );
    setDates.run({ id: zebra.id, created: '2026-01-02T08:00:00.000Z', updated: '2026-02-01T09:00:00.000Z' });
    setDates.run({ id: alpha.id, created: '2026-01-01T08:00:00.000Z', updated: '2026-02-03T09:00:00.000Z' });
    setDates.run({ id: bravo.id, created: '2026-01-03T08:00:00.000Z', updated: '2026-02-01T09:00:00.000Z' });
    setDates.run({ id: deleted.id, created: '2025-01-01T08:00:00.000Z', updated: '2026-03-01T09:00:00.000Z' });
    setDates.run({ id: todo.id, created: '2026-01-04T08:00:00.000Z', updated: '2026-02-04T09:00:00.000Z' });
    raw.close();

    db = createTextothequeDatabase(dbPath);
    const defaultRows = db.listDocumentCatalog({ sortBy: 'updated_at', direction: 'desc' });
    assert(defaultRows.length === 4, `Le catalogue actif contient ${defaultRows.length} lignes au lieu de 4.`);
    assert(!titles(defaultRows).includes('Supprime'), 'La corbeille apparait dans le catalogue actif.');
    assertFirst(defaultRows, 'TODO-mgolo', 'Tri modification DESC');
    const todoRow = defaultRows.find((row) => row.id === todo.id);
    assert(todoRow?.specialRole === 'todo', 'Le TODO ou son role manque dans le catalogue.');
    const bravoRow = defaultRows.find((row) => row.id === bravo.id);
    assert(bravoRow?.folderId === alphaFolder.id && bravoRow.folderName === 'Alpha', 'La jointure dossier est incorrecte.');
    const alphaRow = defaultRows.find((row) => row.id === alpha.id);
    assert(alphaRow?.folderId === null && alphaRow.folderName === null, 'Le document non classe est incorrect.');
    assert(typeof alphaRow.favorite === 'boolean' && alphaRow.favorite, 'Le favori catalogue doit etre un booleen.');
    const expectedKeys = ['createdAt', 'favorite', 'folderId', 'folderName', 'id', 'specialRole', 'status', 'title', 'updatedAt'];
    assert(JSON.stringify(Object.keys(alphaRow).sort()) === JSON.stringify(expectedKeys.sort()),
      `Le catalogue transfere des colonnes inattendues: ${Object.keys(alphaRow).join(', ')}.`);
    assert(!Object.hasOwn(alphaRow, 'content') && !Object.hasOwn(alphaRow, 'notes'), 'Le catalogue charge content ou notes.');

    assertFirst(db.listDocumentCatalog({ sortBy: 'title', direction: 'asc' }), 'alpha', 'Titre ASC');
    assertFirst(db.listDocumentCatalog({ sortBy: 'title', direction: 'desc' }), 'Zebra', 'Titre DESC');
    assertFirst(db.listDocumentCatalog({ sortBy: 'folder', direction: 'asc' }), 'Bravo', 'Dossier ASC');
    assert(['alpha', 'TODO-mgolo'].includes(db.listDocumentCatalog({ sortBy: 'folder', direction: 'desc' })[0]?.title),
      'Dossier DESC doit placer les non classes en premier.');
    assertFirst(db.listDocumentCatalog({ sortBy: 'status', direction: 'asc' }), 'Bravo', 'Statut ASC');
    assertFirst(db.listDocumentCatalog({ sortBy: 'status', direction: 'desc' }), 'alpha', 'Statut DESC');
    assert(!db.listDocumentCatalog({ sortBy: 'favorite', direction: 'asc' })[0]?.favorite, 'Favori ASC doit commencer par non favori.');
    assert(db.listDocumentCatalog({ sortBy: 'favorite', direction: 'desc' })[0]?.favorite, 'Favori DESC doit commencer par favori.');
    assertFirst(db.listDocumentCatalog({ sortBy: 'created_at', direction: 'asc' }), 'alpha', 'Creation ASC');
    assertFirst(db.listDocumentCatalog({ sortBy: 'created_at', direction: 'desc' }), 'TODO-mgolo', 'Creation DESC');
    assertFirst(db.listDocumentCatalog({ sortBy: 'updated_at', direction: 'asc' }), 'Zebra', 'Modification ASC');
    assertFirst(db.listDocumentCatalog({ sortBy: 'updated_at', direction: 'desc' }), 'TODO-mgolo', 'Modification DESC');

    const tiedAsc = db.listDocumentCatalog({ sortBy: 'updated_at', direction: 'asc' })
      .filter((row) => row.updatedAt === '2026-02-01T09:00:00.000Z');
    const tiedDesc = db.listDocumentCatalog({ sortBy: 'updated_at', direction: 'desc' })
      .filter((row) => row.updatedAt === '2026-02-01T09:00:00.000Z');
    assert(tiedAsc[0].id < tiedAsc[1].id, 'Le tie-breaker ASC par id n est pas stable.');
    assert(tiedDesc[0].id > tiedDesc[1].id, 'Le tie-breaker DESC par id n est pas stable.');

    let fieldError = null;
    let directionError = null;
    try {
      db.listDocumentCatalog({ sortBy: 'title; DELETE FROM documents', direction: 'asc' });
    } catch (error) {
      fieldError = error;
    }
    try {
      db.listDocumentCatalog({ sortBy: 'title', direction: 'desc; DROP TABLE documents' });
    } catch (error) {
      directionError = error;
    }
    assert(fieldError instanceof Error && directionError instanceof Error, 'La whitelist de tri ne rejette pas les valeurs inconnues.');
    assert(db.listDocuments().length === 4, 'Une valeur de tri arbitraire a altere les documents.');

    successMessage = 'document catalog columns, joins, SQL sorts, stability and whitelist ok';
  } finally {
    db?.close();
    removeTestTempDirectory(tempDirectory);
  }

  console.log(successMessage);
  console.log(`catalog temporary resources cleaned: ${tempDirectory}`);
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
