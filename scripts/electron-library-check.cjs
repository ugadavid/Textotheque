const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { app } = require('electron');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

const tempDirectory = createTestTempDirectory('library');

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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function databasePath(name) {
  return path.join(tempDirectory, `${name}.sqlite`);
}

function withDatabase(db, operation) {
  try {
    return operation(db);
  } finally {
    db.close();
  }
}

app
  .whenReady()
  .then(async () => {
    let sourceDb = null;
    let successMessage;
    try {
      const {
        CURRENT_SCHEMA_VERSION,
        TEXTOTHEQUE_APPLICATION_ID,
        createVerifiedPreMigrationBackup,
        createTextothequeDatabase,
        inspectTextothequeLibrary,
      } = await import('../dist-electron/database.js');
      const { ActiveLibraryManager } = await import('../dist-electron/library-manager.js');

      assert(CURRENT_SCHEMA_VERSION === 4, 'CURRENT_SCHEMA_VERSION doit etre a 4.');
      assert(TEXTOTHEQUE_APPLICATION_ID === 1413830735, 'L application_id TEXO definitif a change.');

      const freshPath = databasePath('fresh');
      sourceDb = createTextothequeDatabase(freshPath);
      const freshInfo = sourceDb.getLibraryInfo();
      assert(freshInfo.applicationId === TEXTOTHEQUE_APPLICATION_ID, 'Une base neuve n est pas signee TEXO.');
      assert(freshInfo.userVersion === CURRENT_SCHEMA_VERSION, 'Une base neuve n utilise pas le schema courant.');
      assert(freshInfo.path === path.resolve(freshPath), 'Le chemin de la bibliotheque courante est incorrect.');

      const rootFolder = sourceDb.createFolder(null);
      sourceDb.renameFolder(rootFolder.id, 'Dossier sauvegarde');
      const childFolder = sourceDb.createFolder(rootFolder.id);
      const document = sourceDb.createDocument(childFolder.id);
      const savedDocument = sourceDb.updateDocument(document.id, {
        title: 'Contenu representatif',
        content: 'Texte complet present dans le snapshot.',
        notes: 'Note interne sauvegardee',
        status: 'active',
        favorite: true,
        folder_id: childFolder.id,
      });
      const sourceTodo = sourceDb.updateDocument(sourceDb.getOrCreateSpecialDocument('todo').id, {
        title: 'TODO sauvegarde',
        content: 'Contenu TODO dans le snapshot.',
        notes: '',
        status: 'active',
        favorite: false,
        folder_id: null,
      });
      const trashedDocument = sourceDb.updateDocument(sourceDb.createDocument().id, {
        title: 'Document en corbeille',
        content: 'Contenu supprime logiquement.',
        notes: '',
        status: 'draft',
        favorite: false,
        folder_id: null,
      });
      sourceDb.trashDocument(trashedDocument.id);

      const backupPath = databasePath('snapshot');
      const backupInspection = await sourceDb.backupTo(backupPath);
      assert(backupInspection.compatibility === 'compatible', 'Le snapshot n est pas inspecte comme compatible.');
      assert(backupInspection.applicationId === TEXTOTHEQUE_APPLICATION_ID, 'Le snapshot a perdu son application_id.');
      assert(backupInspection.userVersion === CURRENT_SCHEMA_VERSION, 'Le snapshot a perdu sa version de schema.');

      withDatabase(new Database(backupPath, { readonly: true, fileMustExist: true }), (backupDb) => {
        const backupDocument = backupDb.prepare('SELECT * FROM documents WHERE id = ?').get(savedDocument.id);
        const backupTrash = backupDb.prepare('SELECT * FROM documents WHERE id = ?').get(trashedDocument.id);
        const backupTodo = backupDb.prepare('SELECT * FROM documents WHERE id = ?').get(sourceTodo.id);
        const backupFolders = backupDb.prepare('SELECT * FROM folders ORDER BY id').all();
        assert(backupDocument.title === 'Contenu representatif', 'Le titre representatif manque dans le backup.');
        assert(backupDocument.content === 'Texte complet present dans le snapshot.', 'Le contenu manque dans le backup.');
        assert(backupDocument.notes === 'Note interne sauvegardee', 'Les notes manquent dans le backup.');
        assert(backupDocument.favorite === 1, 'Le favori manque dans le backup.');
        assert(backupDocument.folder_id === childFolder.id, 'Le classement manque dans le backup.');
        assert(Boolean(backupTrash.deleted_at), 'La corbeille logique manque dans le backup.');
        assert(backupTodo.special_role === 'todo', 'Le role du TODO manque dans le backup.');
        assert(backupTodo.content === 'Contenu TODO dans le snapshot.', 'Le contenu du TODO manque dans le backup.');
        assert(backupFolders.length === 2, 'Les dossiers ne sont pas complets dans le backup.');
      });
      withDatabase(createTextothequeDatabase(backupPath), (searchableBackup) => {
        const results = searchableBackup.searchDocuments({
          query: 'snapshot', fields: ['title', 'content', 'notes'], matchMode: 'all',
          createdPeriod: 'all', sortBy: 'relevance', direction: 'asc',
        });
        assert(results.some((item) => item.id === savedDocument.id), 'Le backup ne conserve pas la recherche FTS.');
        searchableBackup.verifyFullTextIndex();
      });

      assert(sourceDb.getLibraryInfo().path === path.resolve(freshPath), 'Le backup a change la bibliotheque active.');
      assert(sourceDb.getLibraryInfo().userVersion === CURRENT_SCHEMA_VERSION, 'Le backup a modifie user_version source.');
      assert(sourceDb.getDocument(savedDocument.id)?.content === savedDocument.content, 'Le backup a altere la source.');
      assert(sourceDb.listDeletedDocuments().some((item) => item.id === trashedDocument.id), 'Le backup a altere la corbeille source.');

      let samePathError = null;
      try {
        await sourceDb.backupTo(freshPath);
      } catch (error) {
        samePathError = error;
      }
      assert(samePathError instanceof Error, 'Une sauvegarde source = destination doit etre refusee.');

      sourceDb.close();
      sourceDb = null;

      const legacyPath = databasePath('legacy-unsigned-current');
      let legacyDb = createTextothequeDatabase(legacyPath);
      legacyDb.updateDocument(legacyDb.createDocument().id, {
        title: 'Legacy adoptee',
        content: 'Contenu conserve.',
        notes: '',
        status: 'active',
        favorite: false,
        folder_id: null,
      });
      legacyDb.close();
      withDatabase(new Database(legacyPath), (fixtureDb) => fixtureDb.pragma('application_id = 0'));
      const legacyInspection = inspectTextothequeLibrary(legacyPath);
      assert(legacyInspection.compatibility === 'legacy-textotheque', 'La base legacy connue n est pas reconnue.');
      legacyDb = createTextothequeDatabase(legacyPath);
      assert(legacyDb.getLibraryInfo().applicationId === TEXTOTHEQUE_APPLICATION_ID, 'La base legacy n est pas adoptee.');
      assert(legacyDb.listDocuments()[0].title === 'Legacy adoptee', 'L adoption legacy a altere les donnees.');
      legacyDb.close();

      const foreignPath = databasePath('foreign');
      const foreignApplicationId = 0x12345678;
      withDatabase(new Database(foreignPath), (foreignDb) => {
        foreignDb.exec('CREATE TABLE foreign_data (value TEXT); INSERT INTO foreign_data VALUES (\'intact\');');
        foreignDb.pragma('user_version = 1');
        foreignDb.pragma(`application_id = ${foreignApplicationId}`);
      });
      const foreignBefore = fs.readFileSync(foreignPath);
      const foreignInspection = inspectTextothequeLibrary(foreignPath);
      assert(foreignInspection.compatibility === 'foreign', 'Une base signee etrangere doit etre inspectee comme foreign.');
      assert(foreignInspection.applicationId === foreignApplicationId, 'L inspection a perdu l identite etrangere.');
      assert(foreignBefore.equals(fs.readFileSync(foreignPath)), 'L inspection en lecture seule a modifie la base etrangere.');
      let foreignOpenError = null;
      try {
        createTextothequeDatabase(foreignPath);
      } catch (error) {
        foreignOpenError = error;
      }
      assert(foreignOpenError instanceof Error, 'Le runtime doit refuser une base signee etrangere.');
      withDatabase(new Database(foreignPath, { readonly: true }), (foreignDb) => {
        assert(foreignDb.pragma('application_id', { simple: true }) === foreignApplicationId, 'Le refus a modifie application_id.');
        assert(foreignDb.pragma('user_version', { simple: true }) === 1, 'Le refus a modifie user_version.');
        assert(foreignDb.prepare('SELECT value FROM foreign_data').get().value === 'intact', 'Le refus a modifie le schema etranger.');
      });
      assert(foreignBefore.equals(fs.readFileSync(foreignPath)), 'Le refus runtime a modifie le fichier etranger.');

      const unsignedForeignPath = databasePath('foreign-unsigned');
      withDatabase(new Database(unsignedForeignPath), (foreignDb) => {
        foreignDb.exec('CREATE TABLE unrelated (id INTEGER PRIMARY KEY, value TEXT);');
        foreignDb.prepare('INSERT INTO unrelated (value) VALUES (?)').run('intact');
      });
      const unsignedForeignBefore = fs.readFileSync(unsignedForeignPath);
      assert(
        inspectTextothequeLibrary(unsignedForeignPath).compatibility === 'foreign',
        'Une SQLite non signee arbitraire ne doit pas etre adoptee.'
      );
      let unsignedForeignError = null;
      try {
        createTextothequeDatabase(unsignedForeignPath);
      } catch (error) {
        unsignedForeignError = error;
      }
      assert(unsignedForeignError instanceof Error, 'Le runtime doit refuser une SQLite non signee arbitraire.');
      assert(
        unsignedForeignBefore.equals(fs.readFileSync(unsignedForeignPath)),
        'Le refus a modifie la SQLite non signee arbitraire.'
      );

      const tooNewPath = databasePath('too-new');
      let tooNewDb = createTextothequeDatabase(tooNewPath);
      tooNewDb.close();
      withDatabase(new Database(tooNewPath), (fixtureDb) => fixtureDb.pragma(`user_version = ${CURRENT_SCHEMA_VERSION + 1}`));
      const tooNewInspection = inspectTextothequeLibrary(tooNewPath);
      assert(tooNewInspection.compatibility === 'too-new', 'Une base plus recente doit etre inspectee comme too-new.');
      let tooNewError = null;
      try {
        createTextothequeDatabase(tooNewPath);
      } catch (error) {
        tooNewError = error;
      }
      assert(tooNewError instanceof Error, 'Le runtime doit refuser une base plus recente.');

      const invalidPath = path.join(tempDirectory, 'invalid.sqlite');
      fs.writeFileSync(invalidPath, 'ce fichier n est pas une base SQLite');
      const invalidInspection = inspectTextothequeLibrary(invalidPath);
      assert(!invalidInspection.readable && invalidInspection.compatibility === 'invalid', 'Un fichier invalide doit etre refuse.');

      const activeAPath = databasePath('switch-active-a');
      const compatibleBPath = databasePath('switch-compatible-b');
      withDatabase(createTextothequeDatabase(activeAPath), (db) => {
        const created = db.createDocument();
        db.updateDocument(created.id, {
          title: 'Bibliotheque A', content: 'A reste intacte.', notes: '', status: 'active', favorite: false, folder_id: null,
        });
      });
      withDatabase(createTextothequeDatabase(compatibleBPath), (db) => {
        const created = db.createDocument();
        db.updateDocument(created.id, {
          title: 'Bibliotheque B', content: 'B devient active.', notes: '', status: 'active', favorite: false, folder_id: null,
        });
      });
      const switchManager = new ActiveLibraryManager(activeAPath);
      assert(switchManager.getDatabase().listDocuments()[0].title === 'Bibliotheque A', 'La bibliotheque A initiale manque.');
      assert(switchManager.inspectCandidate(activeAPath).status === 'same', 'Le meme chemin doit etre un no-op.');
      assert(switchManager.inspectCandidate(compatibleBPath).status === 'compatible', 'La bibliotheque B compatible est mal classee.');
      const compatibleOpen = await switchManager.openCandidate(compatibleBPath, false);
      assert(compatibleOpen.status === 'opened', 'La bibliotheque B compatible ne s ouvre pas.');
      assert(switchManager.getDatabase().listDocuments()[0].title === 'Bibliotheque B', 'La bibliotheque B n est pas devenue active.');
      withDatabase(createTextothequeDatabase(activeAPath), (db) => {
        assert(db.listDocuments()[0].content === 'A reste intacte.', 'Le changement de bibliotheque a altere A.');
      });
      switchManager.close();

      for (const [rejectedPath, expectedStatus] of [
        [foreignPath, 'foreign'],
        [tooNewPath, 'too-new'],
        [invalidPath, 'invalid'],
      ]) {
        const rejectionManager = new ActiveLibraryManager(activeAPath);
        const rejected = await rejectionManager.openCandidate(rejectedPath, false);
        assert(rejected.status === expectedStatus, `Le candidat ${expectedStatus} n est pas refuse correctement.`);
        assert(rejectionManager.getDatabase().listDocuments()[0].title === 'Bibliotheque A', `Le refus ${expectedStatus} a remplace A.`);
        rejectionManager.close();
      }

      const openFailureManager = new ActiveLibraryManager(activeAPath, {
        createDatabase: (candidatePath) => {
          if (path.resolve(candidatePath) === path.resolve(compatibleBPath)) {
            throw new Error('ouverture candidate forcee en echec');
          }
          return createTextothequeDatabase(candidatePath);
        },
        inspectLibrary: inspectTextothequeLibrary,
        createPreMigrationBackup: createVerifiedPreMigrationBackup,
      });
      assert((await openFailureManager.openCandidate(compatibleBPath, false)).status === 'open-failed', 'L echec d ouverture B est mal classe.');
      assert(openFailureManager.getDatabase().listDocuments()[0].title === 'Bibliotheque A', 'Un echec d ouverture a remplace A.');
      openFailureManager.close();

      const adoptionPath = databasePath('switch-legacy-adoption');
      withDatabase(createTextothequeDatabase(adoptionPath), (db) => {
        const created = db.createDocument();
        db.updateDocument(created.id, {
          title: 'Legacy a adopter', content: 'Donnees preservees.', notes: '', status: 'active', favorite: false, folder_id: null,
        });
      });
      withDatabase(new Database(adoptionPath), (db) => db.pragma('application_id = 0'));
      const adoptionBefore = fs.readFileSync(adoptionPath);
      const adoptionManager = new ActiveLibraryManager(activeAPath);
      const migrationRequest = await adoptionManager.openCandidate(adoptionPath, false);
      assert(migrationRequest.status === 'needs-migration', 'Une adoption legacy doit demander un accord.');
      assert(adoptionBefore.equals(fs.readFileSync(adoptionPath)), 'Le candidat legacy a ete modifie avant accord.');
      const adoptionOpen = await adoptionManager.openCandidate(adoptionPath, true);
      assert(adoptionOpen.status === 'opened' && adoptionOpen.backupPath, 'L adoption approuvee n a pas cree son backup.');
      assert(fs.existsSync(adoptionOpen.backupPath), 'Le backup pre-adoption est introuvable.');
      const adoptionBackup = inspectTextothequeLibrary(adoptionOpen.backupPath);
      assert(adoptionBackup.compatibility === 'legacy-textotheque', 'Le backup pre-adoption a ete migre par erreur.');
      assert(adoptionManager.getDatabase().listDocuments()[0].content === 'Donnees preservees.', 'L adoption a perdu les donnees.');
      adoptionManager.close();

      const backupFailurePath = databasePath('switch-backup-failure');
      fs.copyFileSync(adoptionOpen.backupPath, backupFailurePath);
      const backupFailureBefore = fs.readFileSync(backupFailurePath);
      const backupFailureManager = new ActiveLibraryManager(activeAPath, {
        createDatabase: createTextothequeDatabase,
        inspectLibrary: inspectTextothequeLibrary,
        createPreMigrationBackup: async () => { throw new Error('backup force en echec'); },
      });
      assert((await backupFailureManager.openCandidate(backupFailurePath, true)).status === 'backup-failed', 'L echec du backup est mal classe.');
      assert(backupFailureBefore.equals(fs.readFileSync(backupFailurePath)), 'Un echec de backup a modifie le candidat.');
      assert(backupFailureManager.getDatabase().listDocuments()[0].title === 'Bibliotheque A', 'Un echec de backup a remplace A.');
      backupFailureManager.close();

      const migrationFailurePath = databasePath('switch-migration-failure');
      fs.copyFileSync(adoptionOpen.backupPath, migrationFailurePath);
      const migrationFailureManager = new ActiveLibraryManager(activeAPath, {
        createDatabase: (candidatePath) => {
          if (path.resolve(candidatePath) === path.resolve(migrationFailurePath)) {
            throw new Error('migration forcee en echec');
          }
          return createTextothequeDatabase(candidatePath);
        },
        inspectLibrary: inspectTextothequeLibrary,
        createPreMigrationBackup: createVerifiedPreMigrationBackup,
      });
      const migrationFailure = await migrationFailureManager.openCandidate(migrationFailurePath, true);
      assert(migrationFailure.status === 'migration-failed', 'L echec de migration est mal classe.');
      assert(migrationFailure.backupPath && fs.existsSync(migrationFailure.backupPath), 'Le backup doit survivre a l echec de migration.');
      assert(inspectTextothequeLibrary(migrationFailure.backupPath).compatibility === 'legacy-textotheque', 'Le backup preserve apres echec est invalide.');
      assert(migrationFailureManager.getDatabase().listDocuments()[0].title === 'Bibliotheque A', 'Un echec de migration a remplace A.');
      migrationFailureManager.close();

      const oldSchemaPath = databasePath('switch-old-schema-v0');
      withDatabase(new Database(oldSchemaPath), (db) => {
        db.exec(legacyDocumentsSchema);
        db.prepare(
          `INSERT INTO documents
            (title, content, content_format, status, favorite, created_at, updated_at, last_opened_at, notes)
           VALUES (?, ?, 'plain', 'active', 1, ?, ?, ?, ?)`
        ).run(
          'Ancien schema v0',
          'Contenu a migrer avec accord.',
          '2026-08-15T00:00:00.000Z',
          '2026-08-15T00:00:00.000Z',
          '2026-08-15T00:00:00.000Z',
          'Note historique'
        );
      });
      const oldSchemaBefore = fs.readFileSync(oldSchemaPath);
      const oldSchemaManager = new ActiveLibraryManager(activeAPath);
      assert((await oldSchemaManager.openCandidate(oldSchemaPath, false)).status === 'needs-migration', 'Le schema v0 doit demander un accord.');
      assert(oldSchemaBefore.equals(fs.readFileSync(oldSchemaPath)), 'Le schema v0 a ete modifie avant accord.');
      const oldSchemaOpen = await oldSchemaManager.openCandidate(oldSchemaPath, true);
      assert(oldSchemaOpen.status === 'opened' && oldSchemaOpen.backupPath, 'Le schema v0 approuve ne s ouvre pas avec backup.');
      assert(oldSchemaOpen.library.userVersion === CURRENT_SCHEMA_VERSION, 'Le schema v0 n atteint pas la version courante.');
      assert(oldSchemaManager.getDatabase().listDocuments()[0].content === 'Contenu a migrer avec accord.', 'La migration v0 a perdu le contenu.');
      assert(
        oldSchemaManager.getDatabase().searchDocuments({
          query: 'migrer', fields: ['content'], matchMode: 'all', createdPeriod: 'all', sortBy: 'relevance', direction: 'asc',
        }).length === 1,
        'La migration externe approuvee n a pas construit FTS.'
      );
      oldSchemaManager.getDatabase().verifyFullTextIndex();
      const oldSchemaBackup = inspectTextothequeLibrary(oldSchemaOpen.backupPath);
      assert(oldSchemaBackup.userVersion === 0 && oldSchemaBackup.compatibility === 'legacy-textotheque', 'Le backup v0 ne preserve pas l etat pre-migration.');
      oldSchemaManager.close();

      successMessage = 'library identity, backup and switching workflow ok';
    } finally {
      sourceDb?.close();
      removeTestTempDirectory(tempDirectory);
    }

    console.log(successMessage);
    console.log(`library test temporary resources cleaned: ${tempDirectory}`);
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
