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
    folderSelection: { folderIds: [], includeUnclassified: false },
    statuses: [],
    favoriteOnly: false,
    created: { period: 'all', from: null, to: null },
    modified: { period: 'all', from: null, to: null },
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
      searchDateBounds,
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

    const createNamedFolder = (name, parentId = null) => {
      const folder = db.createFolder(parentId);
      return db.renameFolder(folder.id, name);
    };
    const folderA = createNamedFolder('A');
    const folderA1 = createNamedFolder('A1', folderA.id);
    const folderA1a = createNamedFolder('A1a', folderA1.id);
    const folderA2 = createNamedFolder('A2', folderA.id);
    const folderB = createNamedFolder('B');
    const folderB1 = createNamedFolder('B1', folderB.id);
    const branchDocuments = new Map();
    for (const folder of [folderA, folderA1, folderA1a, folderA2, folderB, folderB1]) {
      const document = db.updateDocument(db.createDocument(folder.id).id, {
        title: `branchefiltre ${folder.name}`, content: `termebranche ${folder.name}`, notes: '', status: 'active', favorite: false, folder_id: folder.id,
      });
      branchDocuments.set(folder.name, document.id);
    }
    const allFolders = ids(db.searchDocuments(options('', { sortBy: 'updated_at', direction: 'desc' })));
    assert([...branchDocuments.values()].every((id) => allFolders.has(id)) && allFolders.has(todoDocument.id), 'Une sélection de dossiers vide doit tout conserver.');
    const branchA = ids(db.searchDocuments(options('', { folderSelection: { folderIds: [folderA.id], includeUnclassified: false }, sortBy: 'updated_at', direction: 'desc' })));
    assert(['A', 'A1', 'A1a', 'A2'].every((name) => branchA.has(branchDocuments.get(name))), 'La branche A ne contient pas tous ses descendants.');
    assert(!branchA.has(branchDocuments.get('B')) && !branchA.has(branchDocuments.get('B1')), 'La branche A fuit dans la branche B.');
    const multipleBranches = ids(db.searchDocuments(options('', { folderSelection: { folderIds: [folderA1.id, folderB.id], includeUnclassified: false }, sortBy: 'updated_at', direction: 'desc' })));
    assert(['A1', 'A1a', 'B', 'B1'].every((name) => multipleBranches.has(branchDocuments.get(name))), 'L union A1 + B est incomplete.');
    assert(!multipleBranches.has(branchDocuments.get('A')) && !multipleBranches.has(branchDocuments.get('A2')), 'L union A1 + B inclut un dossier hors portée.');
    const unclassifiedOnly = ids(db.searchDocuments(options('', { folderSelection: { folderIds: [], includeUnclassified: true }, sortBy: 'updated_at', direction: 'desc' })));
    assert(unclassifiedOnly.has(todoDocument.id) && !unclassifiedOnly.has(branchDocuments.get('A')), 'Le filtre Non classé est incorrect.');
    const branchAndUnclassified = ids(db.searchDocuments(options('', { folderSelection: { folderIds: [folderA.id], includeUnclassified: true }, sortBy: 'updated_at', direction: 'desc' })));
    assert(branchAndUnclassified.has(todoDocument.id) && branchAndUnclassified.has(branchDocuments.get('A1a')) && !branchAndUnclassified.has(branchDocuments.get('B')), 'Branche A + Non classé est incorrect.');
    const redundantRoots = db.searchDocuments(options('branchefiltre', { fields: ['title'], folderSelection: { folderIds: [folderA.id, folderA1.id], includeUnclassified: false } }));
    assert(redundantRoots.length === new Set(redundantRoots.map((row) => row.id)).size, 'Un parent et son enfant produisent des doublons.');
    const textInBranch = ids(db.searchDocuments(options('termebranche', { fields: ['content'], folderSelection: { folderIds: [folderA.id], includeUnclassified: false } })));
    assert(textInBranch.has(branchDocuments.get('A1a')) && !textInBranch.has(branchDocuments.get('B1')), 'Texte + branche recursive est incorrect.');

    const statusDocuments = new Map();
    for (const candidateStatus of ['draft', 'active', 'to_review', 'final', 'archived']) {
      const document = db.updateDocument(db.createDocument().id, {
        title: `statutfiltre ${candidateStatus}`, content: '', notes: '', status: candidateStatus, favorite: false, folder_id: null,
      });
      statusDocuments.set(candidateStatus, document.id);
      const matches = ids(db.searchDocuments(options('statutfiltre', { fields: ['title'], statuses: [candidateStatus] })));
      assert(matches.has(document.id), `Le filtre statut ${candidateStatus} echoue.`);
      for (const [otherStatus, otherId] of statusDocuments) {
        if (otherStatus !== candidateStatus) assert(!matches.has(otherId), `Le filtre statut ${candidateStatus} accepte ${otherStatus}.`);
      }
    }
    let invalidStatusError = null;
    const statusUnion = ids(db.searchDocuments(options('statutfiltre', { fields: ['title'], statuses: ['draft', 'active'] })));
    assert(statusUnion.has(statusDocuments.get('draft')) && statusUnion.has(statusDocuments.get('active')) && !statusUnion.has(statusDocuments.get('final')), 'L union draft + active est incorrecte.');
    try { db.searchDocuments(options('', { statuses: ['invente'], sortBy: 'updated_at', direction: 'desc' })); } catch (error) { invalidStatusError = error; }
    assert(invalidStatusError instanceof Error, 'Un statut hors domaine doit etre refuse.');

    const favoriteYesDocument = db.updateDocument(db.createDocument().id, {
      title: 'favorifiltre oui', content: '', notes: '', status: 'active', favorite: true, folder_id: null,
    });
    const favoriteNoDocument = db.updateDocument(db.createDocument().id, {
      title: 'favorifiltre non', content: '', notes: '', status: 'active', favorite: false, folder_id: null,
    });
    const favoriteAll = ids(db.searchDocuments(options('favorifiltre', { fields: ['title'], favoriteOnly: false })));
    assert(favoriteAll.has(favoriteYesDocument.id) && favoriteAll.has(favoriteNoDocument.id), 'favoriteOnly=false ne conserve pas les deux valeurs.');
    const favoriteYes = ids(db.searchDocuments(options('', { favoriteOnly: true, sortBy: 'updated_at', direction: 'desc' })));
    assert(favoriteYes.has(favoriteYesDocument.id) && !favoriteYes.has(favoriteNoDocument.id), 'Favoris seulement est incorrect.');
    assert(ids(db.searchDocuments(options('', { sortBy: 'updated_at', direction: 'desc' }))).has(todoDocument.id), 'Le TODO doit rester inclus sans filtre spécial.');

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
    assert(searchDateBounds({ period: 'custom', from: '2026-08-10', to: '2026-08-15' }, referenceDate).lower === new Date(2026, 7, 10).toISOString(), 'Borne custom basse incorrecte.');
    assert(searchDateBounds({ period: 'custom', from: '2026-08-10', to: '2026-08-15' }, referenceDate).upperExclusive === new Date(2026, 7, 16).toISOString(), 'Borne custom haute exclusive incorrecte.');
    assert(searchDateBounds({ period: 'custom', from: null, to: '2026-08-15' }, referenceDate).lower === null, 'Custom to-only fabrique une borne basse.');
    assert(searchDateBounds({ period: 'custom', from: '2026-08-10', to: null }, referenceDate).upperExclusive === null, 'Custom from-only fabrique une borne haute.');
    let reversedRangeError = null;
    try { searchDateBounds({ period: 'custom', from: '2026-08-16', to: '2026-08-15' }, referenceDate); } catch (error) { reversedRangeError = error; }
    assert(reversedRangeError?.message === 'La date de début doit précéder la date de fin.', 'Une plage inversee doit etre refusee explicitement.');

    const boundary = createdPeriodStartIso('last7days', referenceDate);
    const raw = new Database(dbPath);
    const before = db.createDocument();
    const exact = db.createDocument();
    raw.prepare('UPDATE documents SET created_at = ? WHERE id = ?').run(new Date(new Date(boundary).getTime() - 1).toISOString(), before.id);
    raw.prepare('UPDATE documents SET created_at = ? WHERE id = ?').run(boundary, exact.id);
    raw.close();
    const recent = ids(db.searchDocuments(options('', { created: { period: 'last7days', from: null, to: null } }), referenceDate));
    assert(!recent.has(before.id) && recent.has(exact.id), 'La limite temporelle inclusive est incorrecte.');
    const textAndDate = ids(db.searchDocuments(options('instrumentation', { created: { period: 'last7days', from: null, to: null } }), referenceDate));
    assert(textAndDate.has(1), 'Texte et date devraient trouver le document recent.');
    const oldTextAndDate = ids(db.searchDocuments(options('charlie', { created: { period: 'last7days', from: null, to: null } }), referenceDate));
    assert(!oldTextAndDate.has(zoneDocument.id), 'Texte ancien non exclu par la periode.');

    const customBefore = db.updateDocument(db.createDocument().id, {
      title: 'bornecreation avant', content: '', notes: '', status: 'active', favorite: false, folder_id: null,
    });
    const customStart = db.updateDocument(db.createDocument().id, {
      title: 'bornecreation debut', content: '', notes: '', status: 'active', favorite: false, folder_id: null,
    });
    const customInside = db.updateDocument(db.createDocument().id, {
      title: 'bornecreation milieu', content: '', notes: '', status: 'active', favorite: false, folder_id: null,
    });
    const customAfter = db.updateDocument(db.createDocument().id, {
      title: 'bornecreation apres', content: '', notes: '', status: 'active', favorite: false, folder_id: null,
    });
    const rawCustom = new Database(dbPath);
    const setDates = rawCustom.prepare('UPDATE documents SET created_at = ?, updated_at = ? WHERE id = ?');
    setDates.run(new Date(2026, 7, 9, 23, 59, 59, 999).toISOString(), new Date(2026, 7, 9, 23, 59, 59, 999).toISOString(), customBefore.id);
    setDates.run(new Date(2026, 7, 10, 0, 0, 0, 0).toISOString(), new Date(2026, 7, 10, 0, 0, 0, 0).toISOString(), customStart.id);
    setDates.run(new Date(2026, 7, 15, 18, 0, 0, 0).toISOString(), new Date(2026, 7, 15, 18, 0, 0, 0).toISOString(), customInside.id);
    setDates.run(new Date(2026, 7, 16, 0, 0, 0, 0).toISOString(), new Date(2026, 7, 16, 0, 0, 0, 0).toISOString(), customAfter.id);
    rawCustom.close();
    const customFilter = { period: 'custom', from: '2026-08-10', to: '2026-08-15' };
    const createdCustom = ids(db.searchDocuments(options('bornecreation', { fields: ['title'], created: customFilter }), referenceDate));
    assert(!createdCustom.has(customBefore.id) && createdCustom.has(customStart.id) && createdCustom.has(customInside.id) && !createdCustom.has(customAfter.id), 'La plage custom de creation ne respecte pas >= lower et < upperExclusive.');
    const modifiedCustom = ids(db.searchDocuments(options('bornecreation', { fields: ['title'], modified: customFilter }), referenceDate));
    assert(!modifiedCustom.has(customBefore.id) && modifiedCustom.has(customStart.id) && modifiedCustom.has(customInside.id) && !modifiedCustom.has(customAfter.id), 'La plage custom de modification est incorrecte.');
    const fromOnly = ids(db.searchDocuments(options('bornecreation', { fields: ['title'], created: { period: 'custom', from: '2026-08-15', to: null } }), referenceDate));
    assert(fromOnly.has(customInside.id) && fromOnly.has(customAfter.id) && !fromOnly.has(customStart.id), 'La plage de creation from-only est incorrecte.');
    const toOnly = ids(db.searchDocuments(options('bornecreation', { fields: ['title'], modified: { period: 'custom', from: null, to: '2026-08-10' } }), referenceDate));
    assert(toOnly.has(customBefore.id) && toOnly.has(customStart.id) && !toOnly.has(customInside.id), 'La plage de modification to-only est incorrecte.');
    const combinedDates = ids(db.searchDocuments(options('bornecreation', {
      fields: ['title'],
      created: { period: 'thisYear', from: null, to: null },
      modified: { period: 'last7days', from: null, to: null },
    }), referenceDate));
    assert(combinedDates.has(customStart.id) && combinedDates.has(customInside.id) && combinedDates.has(customAfter.id) && !combinedDates.has(customBefore.id), 'Les filtres creation et modification ne se combinent pas avec AND.');

    const textAndStructured = ids(db.searchDocuments(options('instrument', {
      fields: ['title', 'content'],
      folderSelection: { folderIds: [1, folderA.id], includeUnclassified: false },
      statuses: ['draft', 'active'],
      favoriteOnly: true,
    }), referenceDate));
    assert(textAndStructured.has(1), 'Texte et criteres structures devraient trouver le document migre.');
    const textWrongFolder = ids(db.searchDocuments(options('instrument', {
      fields: ['title', 'content'],
      folderSelection: { folderIds: [folderB.id], includeUnclassified: false },
      statuses: ['draft', 'active'],
      favoriteOnly: true,
    }), referenceDate));
    assert(!textWrongFolder.has(1), 'Un document correspondant au texte mais pas au dossier est conserve.');

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
