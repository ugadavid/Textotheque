const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { app } = require('electron');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

const tempDirectory = createTestTempDirectory('library-history');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function dbPath(name) {
  return path.join(tempDirectory, `${name}.sqlite`);
}

function closeAfter(database, operation) {
  try { return operation(database); } finally { database.close(); }
}

app.whenReady().then(async () => {
  let managers = [];
  try {
    const databaseModule = await import('../dist-electron/database.js');
    const { createTextothequeDatabase, createVerifiedPreMigrationBackup, inspectTextothequeLibrary, CURRENT_SCHEMA_VERSION, TEXTOTHEQUE_APPLICATION_ID } = databaseModule;
    const { ActiveLibraryManager } = await import('../dist-electron/library-manager.js');
    const { LibraryHistoryRegistry } = await import('../dist-electron/library-history.js');

    let nowValue = new Date('2026-08-15T20:00:00.000Z');
    const historyPath = path.join(tempDirectory, 'library-history.json');
    const registry = new LibraryHistoryRegistry(historyPath, () => nowValue);
    const firstPath = dbPath('same-name-a');
    const secondPath = path.join(tempDirectory, 'nested', 'same-name-a.sqlite');
    fs.mkdirSync(path.dirname(secondPath), { recursive: true });
    closeAfter(createTextothequeDatabase(firstPath), () => {});
    closeAfter(createTextothequeDatabase(secondPath), () => {});
    registry.recordActivation(firstPath);
    const firstOpenedAt = registry.getKnownLibraries()[0].firstOpenedAt;
    nowValue = new Date('2026-08-15T21:00:00.000Z');
    registry.recordActivation(secondPath);
    nowValue = new Date('2026-08-15T22:00:00.000Z');
    registry.recordActivation(firstPath);
    const known = registry.getKnownLibraries();
    assert(known.length === 2, 'Le registre doit conserver toutes les bibliotheques sans doublon ni purge.');
    assert(known[0].path === path.resolve(firstPath), 'Le tri lastOpenedAt DESC est incorrect.');
    assert(known[0].firstOpenedAt === firstOpenedAt, 'firstOpenedAt ne doit pas changer a la reouverture.');
    assert(known[0].lastOpenedAt === '2026-08-15T22:00:00.000Z', 'lastOpenedAt n est pas actualise.');

    fs.unlinkSync(secondPath);
    const missing = registry.getKnownLibraries().find((entry) => entry.path === path.resolve(secondPath));
    assert(missing && !missing.available, 'Une bibliotheque absente doit rester connue et indisponible.');
    assert(!fs.existsSync(secondPath), 'La lecture de l historique a recree une bibliotheque absente.');

    const invalidHistoryPath = path.join(tempDirectory, 'invalid-history.json');
    fs.writeFileSync(invalidHistoryPath, '{ historique invalide', 'utf8');
    const invalidRegistry = new LibraryHistoryRegistry(invalidHistoryPath, () => new Date('2026-08-15T23:00:00.000Z'));
    assert(invalidRegistry.getKnownLibraries().length === 0, 'Un registre invalide ne doit pas etre utilise.');
    assert(fs.readdirSync(tempDirectory).some((name) => name.startsWith('invalid-history.json.invalid-')), 'Le registre invalide original n a pas ete preserve.');

    const defaultPath = dbPath('default');
    const reopenedPath = dbPath('reopened');
    closeAfter(createTextothequeDatabase(defaultPath), (db) => db.updateDocument(db.createDocument().id, {
      title: 'Default', content: 'Bibliotheque de secours', notes: '', status: 'active', favorite: false, folder_id: null,
    }));
    closeAfter(createTextothequeDatabase(reopenedPath), (db) => db.updateDocument(db.createDocument().id, {
      title: 'Derniere', content: 'Reouverte au demarrage', notes: '', status: 'active', favorite: false, folder_id: null,
    }));
    const startupHistoryPath = path.join(tempDirectory, 'startup-history.json');
    const startupRegistry = new LibraryHistoryRegistry(startupHistoryPath);
    startupRegistry.recordActivation(reopenedPath);
    const startupManager = new ActiveLibraryManager(defaultPath, undefined, startupRegistry);
    managers.push(startupManager);
    assert(startupManager.getDatabase().listDocuments()[0].title === 'Derniere', 'La derniere bibliotheque compatible n est pas reouverte.');
    assert(startupManager.getStartupNotice() === null, 'Une reouverture compatible ne doit pas produire de fallback.');
    startupManager.close();

    const missingStartupPath = dbPath('missing-startup');
    const missingRegistry = new LibraryHistoryRegistry(path.join(tempDirectory, 'missing-history.json'));
    missingRegistry.recordActivation(missingStartupPath);
    const missingManager = new ActiveLibraryManager(defaultPath, undefined, missingRegistry);
    managers.push(missingManager);
    assert(missingManager.getDatabase().listDocuments()[0].title === 'Default', 'Une derniere bibliotheque absente doit utiliser le fallback.');
    assert(missingManager.getStartupNotice()?.includes('introuvable'), 'Le fallback absent doit etre signale.');
    assert(missingRegistry.getKnownLibraries().some((entry) => entry.path === path.resolve(missingStartupPath) && !entry.available), 'L entree absente a ete purgee.');
    assert(!fs.existsSync(missingStartupPath), 'Le fallback a recree la bibliotheque absente.');
    missingManager.close();

    const legacyStartupPath = dbPath('legacy-startup');
    closeAfter(createTextothequeDatabase(legacyStartupPath), () => {});
    closeAfter(new Database(legacyStartupPath), (db) => db.pragma('application_id = 0'));
    const legacyBefore = fs.readFileSync(legacyStartupPath);
    const legacyRegistry = new LibraryHistoryRegistry(path.join(tempDirectory, 'legacy-history.json'));
    legacyRegistry.recordActivation(legacyStartupPath);
    const legacyManager = new ActiveLibraryManager(defaultPath, undefined, legacyRegistry);
    managers.push(legacyManager);
    assert(legacyManager.getDatabase().getLibraryInfo().path === path.resolve(defaultPath), 'Une legacy ne doit pas etre migree au demarrage.');
    assert(legacyBefore.equals(fs.readFileSync(legacyStartupPath)), 'Le demarrage a modifie la legacy sans accord.');
    assert(legacyManager.getStartupNotice()?.includes('intervention'), 'Le fallback legacy doit etre signale.');
    legacyManager.close();

    const tooNewStartupPath = dbPath('too-new-startup');
    closeAfter(createTextothequeDatabase(tooNewStartupPath), () => {});
    closeAfter(new Database(tooNewStartupPath), (db) => db.pragma(`user_version = ${CURRENT_SCHEMA_VERSION + 1}`));
    const tooNewBefore = fs.readFileSync(tooNewStartupPath);
    const tooNewRegistry = new LibraryHistoryRegistry(path.join(tempDirectory, 'too-new-history.json'));
    tooNewRegistry.recordActivation(tooNewStartupPath);
    const tooNewManager = new ActiveLibraryManager(defaultPath, undefined, tooNewRegistry);
    managers.push(tooNewManager);
    assert(tooNewManager.getDatabase().getLibraryInfo().path === path.resolve(defaultPath), 'Une base trop recente doit utiliser le fallback.');
    assert(tooNewBefore.equals(fs.readFileSync(tooNewStartupPath)), 'Le demarrage a modifie la base trop recente.');
    assert(tooNewRegistry.getKnownLibraries().some((entry) => entry.path === path.resolve(tooNewStartupPath)), 'La base trop recente a ete purgee.');
    tooNewManager.close();

    const managerHistory = new LibraryHistoryRegistry(path.join(tempDirectory, 'manager-history.json'));
    const manager = new ActiveLibraryManager(defaultPath, undefined, managerHistory);
    managers.push(manager);
    manager.getDatabase();
    const newPath = dbPath('new-library');
    const created = manager.createCandidate(newPath);
    assert(created.status === 'created', 'La nouvelle bibliotheque n est pas creee.');
    assert(created.library.applicationId === TEXTOTHEQUE_APPLICATION_ID, 'La nouvelle bibliotheque n est pas TEXO.');
    assert(created.library.userVersion === CURRENT_SCHEMA_VERSION, 'La nouvelle bibliotheque n utilise pas le schema courant.');
    assert(manager.getDatabase().getLibraryInfo().path === path.resolve(newPath), 'La nouvelle bibliotheque n est pas active.');
    assert(managerHistory.getLastActivePath() === path.resolve(newPath), 'La nouvelle bibliotheque n est pas enregistree.');
    closeAfter(createTextothequeDatabase(defaultPath), (db) => assert(db.listDocuments()[0].title === 'Default', 'La creation a altere l ancienne DB.'));
    const existingBefore = fs.readFileSync(newPath);
    assert(manager.createCandidate(newPath).status === 'exists', 'Nouvelle doit refuser une destination existante.');
    assert(existingBefore.equals(fs.readFileSync(newPath)), 'Le refus a modifie la destination existante.');
    const historyCountBeforeRefusal = managerHistory.getKnownLibraries().length;
    const foreignPath = dbPath('foreign-refused');
    closeAfter(new Database(foreignPath), (db) => {
      db.exec('CREATE TABLE foreign_data (value TEXT);');
      db.pragma('application_id = 305419896');
    });
    assert((await manager.openCandidate(foreignPath, false)).status === 'foreign', 'La base etrangere n est pas refusee.');
    assert(managerHistory.getKnownLibraries().length === historyCountBeforeRefusal, 'Un refus a ajoute une entree a l historique.');
    const backupPath = dbPath('history-excluded-backup');
    await manager.getDatabase().backupTo(backupPath);
    assert(managerHistory.getKnownLibraries().length === historyCountBeforeRefusal, 'Un backup a ete ajoute a l historique.');
    manager.close();

    const failedNewPath = dbPath('failed-new');
    const failureHistory = new LibraryHistoryRegistry(path.join(tempDirectory, 'failure-history.json'));
    const failureManager = new ActiveLibraryManager(defaultPath, {
      createDatabase: (candidatePath) => {
        return createTextothequeDatabase(candidatePath);
      },
      createNewDatabase: () => { throw new Error('creation forcee en echec'); },
      inspectLibrary: inspectTextothequeLibrary,
      createPreMigrationBackup: createVerifiedPreMigrationBackup,
    }, failureHistory);
    managers.push(failureManager);
    failureManager.getDatabase();
    assert(failureManager.createCandidate(failedNewPath).status === 'create-failed', 'L echec de creation est mal classe.');
    assert(!fs.existsSync(failedNewPath), 'Le fichier incomplet cree par Textotheque n a pas ete nettoye.');
    assert(failureManager.getDatabase().listDocuments()[0].title === 'Default', 'L echec de creation a remplace la DB active.');
    assert(!failureHistory.getKnownLibraries().some((entry) => entry.path === path.resolve(failedNewPath)), 'Un echec de creation a pollue l historique.');
    failureManager.close();

    const registryFailurePath = dbPath('registry-write-failure-created');
    const failingRegistry = {
      getLastActivePath: () => null,
      recordActivation: () => { throw new Error('registre inaccessible'); },
    };
    const resilientManager = new ActiveLibraryManager(defaultPath, undefined, failingRegistry);
    managers.push(resilientManager);
    assert(resilientManager.getDatabase().listDocuments()[0].title === 'Default', 'Un registre inaccessible bloque la DB active.');
    assert(resilientManager.createCandidate(registryFailurePath).status === 'created', 'Un registre inaccessible bloque une activation valide.');
    assert(resilientManager.getDatabase().getLibraryInfo().path === path.resolve(registryFailurePath), 'La DB valide n est pas restee active apres echec du registre.');
    resilientManager.close();

    removeTestTempDirectory(tempDirectory);
    console.log('library history, startup and creation ok');
    console.log(`library history temporary resources cleaned: ${tempDirectory}`);
    app.quit();
  } catch (error) {
    for (const manager of managers) {
      try { manager.close(); } catch {}
    }
    console.error(error);
    try { removeTestTempDirectory(tempDirectory); } catch (cleanupError) { console.error(cleanupError); }
    app.exit(1);
  }
});
