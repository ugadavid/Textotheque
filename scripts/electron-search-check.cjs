const path = require('node:path');
const Database = require('better-sqlite3');
const { app } = require('electron');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

const tempDirectory = createTestTempDirectory('search');
const dbPath = path.join(tempDirectory, 'schema-3.sqlite');
const backupPath = path.join(tempDirectory, 'search-backup.sqlite');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ids(rows) {
  return new Set(rows.map((row) => row.id));
}

function options(query, overrides = {}) {
  const hasText = query.trim().length > 0;
  return {
    query,
    fields: ['title', 'content', 'notes'],
    matchMode: 'all',
    createdPeriod: 'all',
    sortBy: hasText ? 'relevance' : 'created_at',
    direction: hasText ? 'asc' : 'desc',
    ...overrides,
  };
}

function createSchema3Fixture() {
  const db = new Database(dbPath);
  try {
    db.exec(`
      CREATE TABLE documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        content_format TEXT NOT NULL DEFAULT 'plain' CHECK (content_format IN ('plain', 'markdown', 'rich')),
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'to_review', 'final', 'archived')),
        favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
        folder_id INTEGER,
        special_role TEXT CHECK (special_role IS NULL OR special_role IN ('todo')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_opened_at TEXT,
        deleted_at TEXT,
        notes TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parent_id INTEGER,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
      );
      CREATE UNIQUE INDEX idx_documents_special_role_unique
      ON documents(special_role) WHERE special_role IS NOT NULL;
    `);
    db.prepare(`INSERT INTO folders (name, parent_id, position, created_at, updated_at) VALUES (?, NULL, 1, ?, ?)`).run(
      'Recherche', '2026-08-01T10:00:00.000Z', '2026-08-01T10:00:00.000Z'
    );
    const insert = db.prepare(`
      INSERT INTO documents
        (title, content, content_format, status, favorite, folder_id, special_role, created_at, updated_at, last_opened_at, deleted_at, notes)
      VALUES
        (@title, @content, 'plain', @status, @favorite, @folderId, @specialRole, @createdAt, @updatedAt, NULL, NULL, @notes)
    `);
    insert.run({
      title: 'École instrumentale', content: 'Rabardel instrumentation', notes: 'Note alpha', status: 'active',
      favorite: 1, folderId: 1, specialRole: null, createdAt: '2026-08-10T08:00:00.000Z', updatedAt: '2026-08-15T08:00:00.000Z',
    });
    insert.run({
      title: 'Document zones', content: 'bravo', notes: 'charlie', status: 'draft',
      favorite: 0, folderId: null, specialRole: null, createdAt: '2025-12-31T23:00:00.000Z', updatedAt: '2026-08-14T08:00:00.000Z',
    });
    insert.run({
      title: 'TODO', content: 'motuniquetodo', notes: '', status: 'active',
      favorite: 0, folderId: null, specialRole: 'todo', createdAt: '2026-08-16T08:00:00.000Z', updatedAt: '2026-08-16T08:00:00.000Z',
    });
    db.pragma('application_id = 1413830735');
    db.pragma('user_version = 3');
  } finally {
    db.close();
  }
}

app.whenReady().then(async () => {
  let db = null;
  let backupDb = null;
  try {
    createSchema3Fixture();
    const {
      CURRENT_SCHEMA_VERSION,
      SEARCH_SNIPPET_END,
      SEARCH_SNIPPET_START,
      buildSafeFtsQuery,
      createTextothequeDatabase,
      createdPeriodStartIso,
      inspectTextothequeLibrary,
      quoteFts5Value,
    } = await import('../dist-electron/database.js');

    assert(CURRENT_SCHEMA_VERSION === 4, 'La recherche doit utiliser le schema 4.');
    assert(quoteFts5Value('a"b') === '"a""b"', 'Le quoting FTS5 est incorrect.');
    assert(
      buildSafeFtsQuery('rab instrum', ['title', 'content'], 'all') === '{title content} : ("rab"* AND "instrum"*)',
      'La syntaxe de prefixes all est incorrecte.'
    );
    assert(
      buildSafeFtsQuery('rab instrum', ['title', 'content'], 'any') === '{title content} : ("rab"* OR "instrum"*)',
      'La syntaxe de prefixes any est incorrecte.'
    );
    assert(
      buildSafeFtsQuery('genèse instrumentale', ['content'], 'phrase') === '{content} : ("genèse instrumentale")',
      'Le mode phrase ne doit pas devenir une recherche par prefixe.'
    );
    db = createTextothequeDatabase(dbPath);
    assert(db.getLibraryInfo().userVersion === 4, 'La migration 3 vers 4 n a pas abouti.');
    assert(inspectTextothequeLibrary(dbPath).compatibility === 'compatible', 'La base v4 n est pas reconnue.');
    db.verifyFullTextIndex();

    const migrated = db.searchDocuments(options('instrumentation'));
    assert(migrated.length === 1 && migrated[0].title === 'École instrumentale', 'Les documents existants n ont pas ete indexes.');
    assert(migrated[0].folderName === 'Recherche' && migrated[0].favorite === true, 'Les metadonnees migrees ont change.');
    assert(migrated[0].snippet.includes(SEARCH_SNIPPET_START) && migrated[0].snippet.includes(SEARCH_SNIPPET_END), 'Le snippet ne contient pas ses marqueurs surs.');
    assert(!Object.hasOwn(migrated[0], 'content') && !Object.hasOwn(migrated[0], 'notes'), 'La recherche transfere les textes complets.');
    assert(db.searchDocuments(options('ecole')).length === 1, 'La recherche sans accent echoue.');
    assert(db.searchDocuments(options('ÉCOLE')).length === 1, 'La recherche casse/accent normalises echoue.');
    assert(db.searchDocuments(options('ELEPHANT')).length === 0, 'Le controle negatif CI_AI est incoherent.');
    assert(db.searchDocuments(options('motuniquetodo'))[0]?.specialRole === 'todo', 'Le TODO est absent de la recherche.');

    const todoDocument = db.getOrCreateSpecialDocument('todo');
    db.updateDocument(todoDocument.id, {
      title: 'TODO-Ophioglosse', content: todoDocument.content, notes: '', status: 'active', favorite: false, folder_id: null,
    });
    assert(ids(db.searchDocuments(options('ophio', { fields: ['title'] }))).has(todoDocument.id), 'Le prefixe ophio ne trouve pas Ophioglosse.');
    assert(!ids(db.searchDocuments(options('phiog', { fields: ['title'] }))).has(todoDocument.id), 'Une sous-chaine interne est traitee comme un prefixe.');
    assert(!ids(db.searchDocuments(options('ophio', { fields: ['title'], matchMode: 'phrase' }))).has(todoDocument.id), 'Le mode phrase accepte un prefixe incomplet.');

    const instrumentWords = ['Instrumentation', 'Instrumentale', 'Instrument'].map((title) => db.updateDocument(db.createDocument().id, {
      title, content: '', notes: '', status: 'active', favorite: false, folder_id: null,
    }));
    const instrumentPrefixMatches = ids(db.searchDocuments(options('instru', { fields: ['title'] })));
    assert(instrumentWords.every((document) => instrumentPrefixMatches.has(document.id)), 'Le prefixe instru ne retrouve pas toutes ses variantes.');

    const progressiveAll = db.updateDocument(db.createDocument().id, {
      title: 'Préfixes all', content: 'approche instrumentale', notes: '', status: 'active', favorite: false, folder_id: null,
    });
    assert(
      ids(db.searchDocuments(options('appro instr', { fields: ['content'], matchMode: 'all' }))).has(progressiveAll.id),
      'Le mode all n exige pas correctement tous les prefixes.'
    );
    const progressiveAnyOne = db.updateDocument(db.createDocument().id, {
      title: 'Préfixes any un', content: 'ophtalmologie', notes: '', status: 'active', favorite: false, folder_id: null,
    });
    const progressiveAnyTwo = db.updateDocument(db.createDocument().id, {
      title: 'Préfixes any deux', content: 'archéologie', notes: '', status: 'active', favorite: false, folder_id: null,
    });
    const progressiveAnyMatches = ids(db.searchDocuments(options('opht arche', { fields: ['content'], matchMode: 'any' })));
    assert(progressiveAnyMatches.has(progressiveAnyOne.id) && progressiveAnyMatches.has(progressiveAnyTwo.id), 'Le mode any ne forme pas l union des prefixes.');

    const notesPrefix = db.updateDocument(db.createDocument().id, {
      title: 'Zone notes préfixe', content: '', notes: 'notesecreteprefixe', status: 'active', favorite: false, folder_id: null,
    });
    assert(ids(db.searchDocuments(options('notesecrete', { fields: ['notes'] }))).has(notesPrefix.id), 'Le prefixe present dans les notes est absent.');
    assert(!ids(db.searchDocuments(options('notesecrete', { fields: ['title', 'content'] }))).has(notesPrefix.id), 'Le prefixe des notes fuit dans une zone non selectionnee.');

    const zoneDocument = db.listDocuments().find((item) => item.title === 'Document zones');
    assert(zoneDocument, 'Fixture zones absente.');
    db.updateDocument(zoneDocument.id, {
      title: 'alpha', content: 'bravo', notes: 'charlie', status: 'draft', favorite: false, folder_id: null,
    });
    assert(ids(db.searchDocuments(options('alpha', { fields: ['title'] }))).has(zoneDocument.id), 'Titre seul ne trouve pas le titre.');
    assert(!ids(db.searchDocuments(options('bravo', { fields: ['title'] }))).has(zoneDocument.id), 'Titre seul trouve le corps.');
    assert(ids(db.searchDocuments(options('bravo', { fields: ['content'] }))).has(zoneDocument.id), 'Corps seul ne trouve pas le corps.');
    assert(!ids(db.searchDocuments(options('charlie', { fields: ['content'] }))).has(zoneDocument.id), 'Corps seul trouve les notes.');
    assert(ids(db.searchDocuments(options('charlie', { fields: ['notes'] }))).has(zoneDocument.id), 'Notes seules ne trouvent pas les notes.');

    const phraseOne = db.updateDocument(db.createDocument().id, {
      title: 'Modes un', content: 'alpha bravo', notes: '', status: 'active', favorite: false, folder_id: null,
    });
    const phraseTwo = db.updateDocument(db.createDocument().id, {
      title: 'Modes deux', content: 'alpha intermediaire bravo', notes: '', status: 'active', favorite: false, folder_id: null,
    });
    const onlyAlpha = db.updateDocument(db.createDocument().id, {
      title: 'Modes trois', content: 'alpha seulement', notes: '', status: 'active', favorite: false, folder_id: null,
    });
    const allMatches = ids(db.searchDocuments(options('alpha bravo', { fields: ['content'], matchMode: 'all' })));
    assert(allMatches.has(phraseOne.id) && allMatches.has(phraseTwo.id) && !allMatches.has(onlyAlpha.id), 'Mode all incorrect.');
    const anyMatches = ids(db.searchDocuments(options('alpha bravo', { fields: ['content'], matchMode: 'any' })));
    assert(anyMatches.has(phraseOne.id) && anyMatches.has(phraseTwo.id) && anyMatches.has(onlyAlpha.id), 'Mode any incorrect.');
    const phraseMatches = ids(db.searchDocuments(options('alpha bravo', { fields: ['content'], matchMode: 'phrase' })));
    assert(phraseMatches.has(phraseOne.id) && !phraseMatches.has(phraseTwo.id), 'Mode phrase incorrect.');

    const updated = db.updateDocument(phraseOne.id, {
      title: 'Éléphant nouveau', content: 'motnouveau', notes: 'notenouvelle', status: 'final', favorite: true, folder_id: 1,
    });
    assert(db.searchDocuments(options('alpha', { fields: ['content'] })).every((item) => item.id !== updated.id), 'Ancien contenu encore indexe.');
    assert(ids(db.searchDocuments(options('motnouveau', { fields: ['content'] }))).has(updated.id), 'Nouveau contenu absent.');
    assert(ids(db.searchDocuments(options('elephant', { fields: ['title'] }))).has(updated.id), 'Nouveau titre CI_AI absent.');
    assert(ids(db.searchDocuments(options('eleph', { fields: ['title'] }))).has(updated.id), 'Le prefixe CI_AI eleph ne trouve pas Éléphant.');
    assert(ids(db.searchDocuments(options('notenouvelle', { fields: ['notes'] }))).has(updated.id), 'Nouvelles notes absentes.');
    db.updateDocument(updated.id, { ...updated, favorite: false, folder_id: null });
    db.verifyFullTextIndex();
    assert(ids(db.searchDocuments(options('motnouveau'))).has(updated.id), 'Une mise a jour structuree a perdu l index texte.');

    for (const special of ['"bonjour"', 'AND', '(a+b)', 'title:test', '?', '*']) {
      const result = db.searchDocuments(options(special));
      assert(Array.isArray(result), `La saisie speciale ${special} a casse la recherche.`);
    }
    let missingFieldsError = null;
    try { db.searchDocuments(options('alpha', { fields: [] })); } catch (error) { missingFieldsError = error; }
    assert(missingFieldsError instanceof Error, 'Une recherche textuelle sans zone doit etre refusee.');

    const referenceDate = new Date(2026, 7, 16, 12, 0, 0, 0);
    assert(createdPeriodStartIso('last7days', referenceDate) === new Date(2026, 7, 10, 0, 0, 0, 0).toISOString(), 'Borne locale 7 jours incorrecte.');
    assert(createdPeriodStartIso('last15days', referenceDate) === new Date(2026, 7, 2, 0, 0, 0, 0).toISOString(), 'Borne locale 15 jours incorrecte.');
    assert(createdPeriodStartIso('last30days', referenceDate) === new Date(2026, 6, 18, 0, 0, 0, 0).toISOString(), 'Borne locale 30 jours incorrecte.');
    assert(createdPeriodStartIso('thisYear', referenceDate) === new Date(2026, 0, 1, 0, 0, 0, 0).toISOString(), 'Borne locale annee incorrecte.');

    const boundary = createdPeriodStartIso('last7days', referenceDate);
    const raw = new Database(dbPath);
    const before = db.createDocument();
    const exact = db.createDocument();
    raw.prepare('UPDATE documents SET created_at = ? WHERE id = ?').run(new Date(new Date(boundary).getTime() - 1).toISOString(), before.id);
    raw.prepare('UPDATE documents SET created_at = ? WHERE id = ?').run(boundary, exact.id);
    raw.close();
    const recent = ids(db.searchDocuments(options('', { createdPeriod: 'last7days' }), referenceDate));
    assert(!recent.has(before.id) && recent.has(exact.id), 'La limite temporelle inclusive est incorrecte.');
    const textAndDate = ids(db.searchDocuments(options('instrumentation', { createdPeriod: 'last7days' }), referenceDate));
    assert(textAndDate.has(1), 'Texte et date devraient trouver le document recent.');
    const oldTextAndDate = ids(db.searchDocuments(options('charlie', { createdPeriod: 'last7days' }), referenceDate));
    assert(!oldTextAndDate.has(zoneDocument.id), 'Texte ancien non exclu par la periode.');

    db.trashDocument(updated.id);
    assert(!ids(db.searchDocuments(options('motnouveau'))).has(updated.id), 'La corbeille logique fuit dans la recherche.');
    db.restoreDocument(updated.id);
    assert(ids(db.searchDocuments(options('motnouveau'))).has(updated.id), 'La restauration ne retablit pas la recherche.');
    db.trashDocument(updated.id);
    db.emptyTrash();
    assert(!ids(db.searchDocuments(options('motnouveau'))).has(updated.id), 'La suppression physique reste dans FTS.');
    db.verifyFullTextIndex();

    const backupInspection = await db.backupTo(backupPath);
    assert(backupInspection.userVersion === 4, 'Le backup n est pas au schema 4.');
    backupDb = createTextothequeDatabase(backupPath);
    assert(
      backupDb.searchDocuments(options('instrumentation')).some((item) => item.title === 'École instrumentale'),
      'La recherche FTS du backup echoue.'
    );
    backupDb.verifyFullTextIndex();
    backupDb.close();
    backupDb = null;
    db.close();
    db = null;

    console.log('search FTS5 migration, sync, CI_AI, fields, modes, dates, safety and backup ok');
  } finally {
    backupDb?.close();
    db?.close();
    removeTestTempDirectory(tempDirectory);
  }
  console.log(`search temporary resources cleaned: ${tempDirectory}`);
  app.quit();
}).catch((error) => {
  console.error(error);
  try { removeTestTempDirectory(tempDirectory); } catch (cleanupError) { console.error(cleanupError); }
  app.exit(1);
});
