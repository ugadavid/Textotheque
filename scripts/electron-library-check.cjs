const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { app } = require('electron');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

const tempDirectory = createTestTempDirectory('library');

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
        createTextothequeDatabase,
        inspectTextothequeLibrary,
      } = await import('../dist-electron/database.js');

      assert(CURRENT_SCHEMA_VERSION === 2, 'CURRENT_SCHEMA_VERSION doit rester a 2.');
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
        const backupFolders = backupDb.prepare('SELECT * FROM folders ORDER BY id').all();
        assert(backupDocument.title === 'Contenu representatif', 'Le titre representatif manque dans le backup.');
        assert(backupDocument.content === 'Texte complet present dans le snapshot.', 'Le contenu manque dans le backup.');
        assert(backupDocument.notes === 'Note interne sauvegardee', 'Les notes manquent dans le backup.');
        assert(backupDocument.favorite === 1, 'Le favori manque dans le backup.');
        assert(backupDocument.folder_id === childFolder.id, 'Le classement manque dans le backup.');
        assert(Boolean(backupTrash.deleted_at), 'La corbeille logique manque dans le backup.');
        assert(backupFolders.length === 2, 'Les dossiers ne sont pas complets dans le backup.');
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

      successMessage = 'library identity and backup ok';
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
