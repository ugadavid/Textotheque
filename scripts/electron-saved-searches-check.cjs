const path = require('node:path');
const Database = require('better-sqlite3');
const { app } = require('electron');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

const tempDirectory = createTestTempDirectory('saved-searches');
const libraryAPath = path.join(tempDirectory, 'library-a-v4.sqlite');
const libraryBPath = path.join(tempDirectory, 'library-b.sqlite');
const backupPath = path.join(tempDirectory, 'library-a-backup.sqlite');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function baseCriteria(overrides = {}) {
  return {
    query: '',
    fields: ['title', 'content', 'notes'],
    matchMode: 'all',
    folderSelection: { folderIds: [], includeUnclassified: false },
    statuses: [],
    favoriteOnly: false,
    created: { period: 'all', from: null, to: null },
    modified: { period: 'all', from: null, to: null },
    sortBy: 'updated_at',
    direction: 'desc',
    ...overrides,
  };
}

function criteriaOf(definition) {
  const { id, name, createdAt, updatedAt, ...criteria } = definition;
  return criteria;
}

function createSchema4Fixture() {
  const db = new Database(libraryAPath);
  try {
    db.exec(`
      CREATE TABLE documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '',
        content_format TEXT NOT NULL DEFAULT 'plain' CHECK (content_format IN ('plain', 'markdown', 'rich')),
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'to_review', 'final', 'archived')),
        favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)), folder_id INTEGER,
        special_role TEXT CHECK (special_role IS NULL OR special_role IN ('todo')),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_opened_at TEXT, deleted_at TEXT,
        notes TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, parent_id INTEGER,
        position INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX idx_documents_special_role_unique ON documents(special_role) WHERE special_role IS NOT NULL;
      CREATE VIRTUAL TABLE documents_fts USING fts5(
        title, content, notes, content='documents', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
      );
      CREATE TRIGGER documents_fts_after_insert AFTER INSERT ON documents BEGIN
        INSERT INTO documents_fts(rowid, title, content, notes) VALUES (new.id, new.title, new.content, new.notes);
      END;
      CREATE TRIGGER documents_fts_after_delete AFTER DELETE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, title, content, notes)
        VALUES ('delete', old.id, old.title, old.content, old.notes);
      END;
      CREATE TRIGGER documents_fts_after_text_update AFTER UPDATE OF title, content, notes ON documents
      WHEN old.title IS NOT new.title OR old.content IS NOT new.content OR old.notes IS NOT new.notes BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, title, content, notes)
        VALUES ('delete', old.id, old.title, old.content, old.notes);
        INSERT INTO documents_fts(rowid, title, content, notes) VALUES (new.id, new.title, new.content, new.notes);
      END;
      INSERT INTO documents
        (title, content, content_format, status, favorite, folder_id, special_role, created_at, updated_at, last_opened_at, deleted_at, notes)
      VALUES
        ('Document v4', 'instrument historique', 'plain', 'active', 1, NULL, NULL,
         '2026-08-01T08:00:00.000Z', '2026-08-12T08:00:00.000Z', NULL, NULL, 'note migration'),
        ('TODO', '', 'plain', 'active', 0, NULL, 'todo',
         '2026-08-01T08:00:00.000Z', '2026-08-01T08:00:00.000Z', NULL, NULL, '');
    `);
    db.pragma('application_id = 1413830735');
    db.pragma('user_version = 4');
  } finally {
    db.close();
  }
}

app.whenReady().then(async () => {
  const openDatabases = [];
  try {
    createSchema4Fixture();
    const {
      CURRENT_SCHEMA_VERSION,
      createTextothequeDatabase,
      inspectTextothequeLibrary,
    } = await import('../dist-electron/database.js');
    const { buildSearchMenu } = await import('../dist-electron/search-menu.js');

    assert(CURRENT_SCHEMA_VERSION === 5, 'Le schema courant doit etre 5.');
    const before = inspectTextothequeLibrary(libraryAPath);
    assert(before.compatibility === 'legacy-textotheque' && before.userVersion === 4, 'La fixture v4 doit demander une migration.');
    const dbA = createTextothequeDatabase(libraryAPath);
    openDatabases.push(dbA);
    assert(dbA.getLibraryInfo().userVersion === 5, 'La migration 4 vers 5 n a pas abouti.');
    assert(dbA.listSavedSearches().length === 0, 'Une base v4 migree doit commencer sans recherche enregistree.');
    assert(dbA.searchDocuments(baseCriteria({ query: 'instrument', fields: ['content'], sortBy: 'relevance', direction: 'asc' })).some((row) => row.title === 'Document v4'), 'FTS ou document v4 perdu pendant la migration.');
    assert(dbA.listDocuments().some((document) => document.special_role === 'todo'), 'Le TODO v4 a ete perdu.');

    const folderA = dbA.renameFolder(dbA.createFolder(null).id, 'A');
    const folderA1 = dbA.renameFolder(dbA.createFolder(folderA.id).id, 'A1');
    const folderB = dbA.renameFolder(dbA.createFolder(null).id, 'B');
    const branchDocument = dbA.updateDocument(dbA.createDocument(folderA1.id).id, {
      title: 'Instrument branche A1', content: 'instrument dynamique', notes: 'note cible',
      status: 'draft', favorite: true, folder_id: folderA1.id,
    });
    dbA.updateDocument(dbA.createDocument(folderB.id).id, {
      title: 'Instrument branche B', content: 'instrument ailleurs', notes: '',
      status: 'active', favorite: true, folder_id: folderB.id,
    });
    const branchDates = new Database(libraryAPath);
    branchDates.prepare(`UPDATE documents SET created_at = ?, updated_at = ? WHERE id = ?`).run(
      '2026-08-10T08:00:00.000Z', '2026-08-15T08:00:00.000Z', branchDocument.id
    );
    branchDates.close();

    const complexInput = {
      name: 'Soutenance récente',
      ...baseCriteria({
        query: 'instrument', fields: ['content', 'notes'], matchMode: 'any',
        folderSelection: { folderIds: [folderB.id, folderA.id, folderA.id], includeUnclassified: true },
        statuses: ['active', 'draft', 'active'], favoriteOnly: true,
        created: { period: 'custom', from: '2026-08-01', to: '2026-08-15' },
        modified: { period: 'last15days', from: null, to: null },
        sortBy: 'updated_at', direction: 'desc',
      }),
    };
    const created = dbA.createSavedSearch(complexInput);
    const expectedRoundTrip = {
      ...complexInput,
      folderSelection: { folderIds: [folderA.id, folderB.id], includeUnclassified: true },
      statuses: ['draft', 'active'],
    };
    assert(JSON.stringify({ name: created.name, ...criteriaOf(created) }) === JSON.stringify(expectedRoundTrip), 'Le round-trip complet a modifie la definition.');
    assert(dbA.listSavedSearches()[0]?.name === 'Soutenance récente' && !Object.hasOwn(dbA.listSavedSearches()[0], 'query'), 'La liste des recherches n est pas legere.');
    assert(dbA.searchDocuments(criteriaOf(created)).some((row) => row.id === branchDocument.id), 'La recherche enregistree ne reutilise pas correctement le moteur existant.');

    let duplicateError = null;
    try { dbA.createSavedSearch({ ...complexInput, folderSelection: { folderIds: [], includeUnclassified: false } }); } catch (error) { duplicateError = error; }
    assert(duplicateError instanceof Error && dbA.listSavedSearches().length === 1, 'Un nom identique doit etre refuse atomiquement.');
    let invalidFolderError = null;
    try { dbA.createSavedSearch({ ...complexInput, name: 'Dossier invalide', folderSelection: { folderIds: [999999], includeUnclassified: false } }); } catch (error) { invalidFolderError = error; }
    assert(invalidFolderError instanceof Error && dbA.listSavedSearches().length === 1, 'Un dossier absent doit etre refuse sans ligne partielle.');
    const beforeInvalidUpdate = dbA.getSavedSearch(created.id);
    let invalidUpdateError = null;
    try { dbA.updateSavedSearch(created.id, baseCriteria({ folderSelection: { folderIds: [999999], includeUnclassified: false }, statuses: ['final'] })); } catch (error) { invalidUpdateError = error; }
    assert(invalidUpdateError instanceof Error && JSON.stringify(dbA.getSavedSearch(created.id)) === JSON.stringify(beforeInvalidUpdate), 'Un update invalide doit restaurer la definition et ses relations.');

    const updated = dbA.updateSavedSearch(created.id, baseCriteria({
      folderSelection: { folderIds: [folderA.id], includeUnclassified: false },
      statuses: ['final'], modified: { period: 'last7days', from: null, to: null },
    }));
    assert(updated.folderSelection.folderIds.join(',') === String(folderA.id) && updated.statuses.join(',') === 'final', 'Update ne remplace pas les relations enfants.');
    const renamed = dbA.renameSavedSearch(created.id, 'Hebdomadaire');
    assert(renamed.name === 'Hebdomadaire' && JSON.stringify(criteriaOf(renamed)) === JSON.stringify(criteriaOf(updated)), 'Rename a modifie les criteres.');

    const dynamicDefinition = dbA.updateSavedSearch(created.id, baseCriteria({
      statuses: ['final'], modified: { period: 'last7days', from: null, to: null },
    }));

    const datedOld = dbA.updateDocument(dbA.createDocument().id, {
      title: 'Dynamique ancien', content: '', notes: '', status: 'final', favorite: false, folder_id: null,
    });
    const datedNew = dbA.updateDocument(dbA.createDocument().id, {
      title: 'Dynamique nouveau', content: '', notes: '', status: 'final', favorite: false, folder_id: null,
    });
    const raw = new Database(libraryAPath);
    raw.prepare(`UPDATE documents SET updated_at = ? WHERE id = ?`).run('2026-08-12T08:00:00.000Z', datedOld.id);
    raw.prepare(`UPDATE documents SET updated_at = ? WHERE id = ?`).run('2026-08-28T08:00:00.000Z', datedNew.id);
    raw.close();
    const dynamicCriteria = criteriaOf(dynamicDefinition);
    const august16 = new Set(dbA.searchDocuments(dynamicCriteria, new Date(2026, 7, 16, 12)).map((row) => row.id));
    const august30 = new Set(dbA.searchDocuments(dynamicCriteria, new Date(2026, 7, 30, 12)).map((row) => row.id));
    assert(august16.has(datedOld.id) && !august16.has(datedNew.id), 'last7days est faux au 16 aout.');
    assert(!august30.has(datedOld.id) && august30.has(datedNew.id), 'Le preset last7days a ete fige au lieu d etre recalcuble.');

    await dbA.backupTo(backupPath);
    const backupDb = createTextothequeDatabase(backupPath);
    openDatabases.push(backupDb);
    const backupSearch = backupDb.getSavedSearch(created.id);
    assert(backupSearch?.name === 'Hebdomadaire' && JSON.stringify(criteriaOf(backupSearch)) === JSON.stringify(dynamicCriteria), 'Le backup a perdu la recherche enregistree.');
    assert(backupDb.searchDocuments(criteriaOf(backupSearch), new Date(2026, 7, 30, 12)).some((row) => row.id === datedNew.id), 'La recherche du backup ne s execute pas.');

    const dbB = createTextothequeDatabase(libraryBPath);
    openDatabases.push(dbB);
    const bSearch = dbB.createSavedSearch({ name: 'Gaming', ...baseCriteria() });
    assert(bSearch.id === 1 && dbB.listSavedSearches().map((item) => item.name).join(',') === 'Gaming', 'La bibliotheque B ne possede pas sa liste independante.');
    assert(dbA.listSavedSearches().map((item) => item.name).join(',') === 'Hebdomadaire', 'La bibliotheque A a ete contaminee par B.');

    const menuActions = [];
    const searchMenu = buildSearchMenu(
      [{ id: created.id, name: 'Hebdomadaire', updatedAt: created.updatedAt }],
      { activeSavedSearchId: created.id, modified: true, canSave: true },
      (action) => menuActions.push(action)
    );
    const menuItems = searchMenu.submenu;
    const byLabel = (label) => menuItems.find((item) => item.label === label);
    assert(searchMenu.label === 'Recherche', 'Le menu racine Recherche est absent.');
    assert(menuItems.filter((item) => item.accelerator === 'CommandOrControl+F').length === 1, 'Ctrl+F doit avoir un proprietaire natif unique.');
    assert(byLabel('Mettre à jour la recherche').enabled && byLabel('Renommer la recherche…').enabled && byLabel('Supprimer la recherche…').enabled, 'Les actions actives du menu sont mal calculees.');
    byLabel('Mettre à jour la recherche').click();
    const savedSubmenu = byLabel('Recherches enregistrées').submenu;
    assert(savedSubmenu[0].checked === true, 'Le marqueur de recherche active manque dans le sous-menu.');
    savedSubmenu[0].click();
    assert(menuActions.some((action) => action.action === 'update') && menuActions.some((action) => action.action === 'open' && action.id === created.id), 'Les intentions du menu ne convergent pas vers les actions renderer.');
    const inactiveMenu = buildSearchMenu([], { activeSavedSearchId: null, modified: false, canSave: true }, () => {}).submenu;
    assert(!inactiveMenu.find((item) => item.label === 'Mettre à jour la recherche').enabled && !inactiveMenu.find((item) => item.label === 'Renommer la recherche…').enabled, 'Les actions sans recherche active devraient etre desactivees.');
    const unmodifiedMenu = buildSearchMenu([], { activeSavedSearchId: created.id, modified: false, canSave: true }, () => {}).submenu;
    assert(!unmodifiedMenu.find((item) => item.label === 'Mettre à jour la recherche').enabled && unmodifiedMenu.find((item) => item.label === 'Renommer la recherche…').enabled, 'Update doit etre desactive pour une recherche active non modifiee.');

    dbA.deleteSavedSearch(created.id);
    assert(dbA.getSavedSearch(created.id) === null && dbA.listSavedSearches().length === 0, 'Delete ne supprime pas la definition.');
    const verifyDelete = new Database(libraryAPath, { readonly: true });
    assert(verifyDelete.prepare(`SELECT count(*) AS count FROM saved_search_folders`).get().count === 0, 'Delete laisse des dossiers enfants.');
    assert(verifyDelete.prepare(`SELECT count(*) AS count FROM saved_search_statuses`).get().count === 0, 'Delete laisse des statuts enfants.');
    verifyDelete.close();

    console.log('saved searches migration, CRUD, round-trip, dynamic dates, branches, backup and libraries ok');
  } finally {
    while (openDatabases.length) openDatabases.pop().close();
    await app.quit();
    removeTestTempDirectory(tempDirectory);
    console.log(`saved-searches temporary resources cleaned: ${tempDirectory}`);
  }
}).catch((error) => {
  console.error(error);
  try { removeTestTempDirectory(tempDirectory); } catch (cleanupError) { console.error(cleanupError); }
  app.exit(1);
});
