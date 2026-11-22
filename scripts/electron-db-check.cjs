const assert = require('node:assert/strict');
const path = require('node:path');
const Database = require('better-sqlite3');
const { app } = require('electron');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

const tempDirectory = createTestTempDirectory('db-check');

function assertCanonicalIsoUtc(value, label) {
  if (typeof value !== 'string') {
    throw new Error(`${label} doit etre une chaine ISO UTC.`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || value !== parsed.toISOString()) {
    throw new Error(`${label} n utilise pas le format ISO UTC canonique: ${value}`);
  }
}

app
  .whenReady()
  .then(async () => {
    let db = null;
    let diagnosticDb = null;
    let successMessage;

    console.log(`DB check temporary resources: ${tempDirectory}`);

    try {
      const { createTextothequeDatabase } = await import('../dist-electron/database.js');
      const dbPath = path.join(tempDirectory, 'test.sqlite');
      db = createTextothequeDatabase(dbPath);

    const created = db.createDocument();
    if (!/^tot_\d{8}_\d{2,}$/.test(created.title)) {
      throw new Error(`Un nouveau document doit stocker un titre automatique en base: ${created.title}`);
    }
    assertCanonicalIsoUtc(created.created_at, 'documents.created_at apres creation');
    assertCanonicalIsoUtc(created.updated_at, 'documents.updated_at apres creation');

    const saved = db.updateDocument(created.id, {
      title: 'Verification SQLite',
      content: 'Document persistant en base SQLite.',
      notes: 'Controle V0.1',
      status: 'active',
      favorite: true,
    });
    assertCanonicalIsoUtc(saved.updated_at, 'documents.updated_at apres sauvegarde');
    const reopened = db.markOpened(saved.id);
    assertCanonicalIsoUtc(reopened.last_opened_at, 'documents.last_opened_at apres ouverture');
    const listed = db.listDocuments();

    if (!reopened || reopened.title !== 'Verification SQLite') {
      throw new Error('Le document sauvegarde ne peut pas etre relu.');
    }

    if (listed.length !== 1 || listed[0].content !== 'Document persistant en base SQLite.') {
      throw new Error('La liste des documents ne reflete pas la sauvegarde.');
    }

    const rootFolder = db.createFolder(null);
    const childFolder = db.createFolder(rootFolder.id);
    const renamedRoot = db.renameFolder(rootFolder.id, 'Notes memoire');
    const fallbackFolderName = db.renameFolder(childFolder.id, '   ');

    for (const folder of [rootFolder, childFolder]) {
      assertCanonicalIsoUtc(folder.created_at, `folders.created_at apres creation du dossier ${folder.id}`);
      assertCanonicalIsoUtc(folder.updated_at, `folders.updated_at apres creation du dossier ${folder.id}`);
    }
    assertCanonicalIsoUtc(renamedRoot.updated_at, 'folders.updated_at apres renommage');
    assertCanonicalIsoUtc(fallbackFolderName.updated_at, 'folders.updated_at apres renommage vide');

    if (renamedRoot.name !== 'Notes memoire' || fallbackFolderName.name !== 'Nouveau dossier') {
      throw new Error('Le renommage de dossier ou le fallback de nom vide est incorrect.');
    }

    const foldered = db.updateDocument(saved.id, {
      title: saved.title,
      content: saved.content,
      notes: saved.notes,
      status: saved.status,
      favorite: saved.favorite === 1,
      folder_id: childFolder.id,
    });
    const folders = db.listFolders();

    if (folders.length !== 2 || folders[0].parent_id !== null || folders[1].parent_id !== rootFolder.id) {
      throw new Error('La creation de dossiers racine et enfant est incoherente.');
    }

    if (foldered.folder_id !== childFolder.id || db.getDocument(saved.id)?.folder_id !== childFolder.id) {
      throw new Error('Le dossier affecte au document ne persiste pas en base.');
    }

    const unfiledAgain = db.updateDocument(saved.id, {
      title: saved.title,
      content: saved.content,
      notes: saved.notes,
      status: saved.status,
      favorite: saved.favorite === 1,
      folder_id: null,
    });

    if (unfiledAgain.folder_id !== null) {
      throw new Error('Le retour en Non classe ne remet pas folder_id a NULL.');
    }

    const beforeRejectedUpdate = db.getDocument(saved.id);
    let rejectedUpdateError = null;
    try {
      db.updateDocument(saved.id, {
        title: 'Ce titre ne doit pas etre enregistre',
        content: 'Ce contenu ne doit pas etre enregistre.',
        notes: 'Cette note ne doit pas etre enregistree.',
        status: 'archived',
        favorite: false,
        folder_id: 999999,
      });
    } catch (error) {
      rejectedUpdateError = error;
    }

    if (!(rejectedUpdateError instanceof Error) || !rejectedUpdateError.message.includes('dossier 999999 est introuvable')) {
      throw new Error('Une affectation vers un dossier inexistant doit echouer avec un message explicite.');
    }

    const afterRejectedUpdate = db.getDocument(saved.id);
    if (JSON.stringify(afterRejectedUpdate) !== JSON.stringify(beforeRejectedUpdate)) {
      throw new Error('Une affectation invalide a modifie le document existant.');
    }

    const documentCountBeforeRejectedCreate = db.listDocuments().length;
    let rejectedCreateError = null;
    try {
      db.createDocument(999999);
    } catch (error) {
      rejectedCreateError = error;
    }

    if (!(rejectedCreateError instanceof Error) || !rejectedCreateError.message.includes('dossier 999999 est introuvable')) {
      throw new Error('La creation dans un dossier inexistant doit echouer avec un message explicite.');
    }

    if (db.listDocuments().length !== documentCountBeforeRejectedCreate) {
      throw new Error('La creation invalide a laisse un document orphelin.');
    }

    const folderCountBeforeRejectedCreate = db.listFolders().length;
    let rejectedFolderError = null;
    try {
      db.createFolder(999999);
    } catch (error) {
      rejectedFolderError = error;
    }

    if (!(rejectedFolderError instanceof Error) || !rejectedFolderError.message.includes('dossier 999999 est introuvable')) {
      throw new Error('La creation sous un parent inexistant doit echouer avec un message explicite.');
    }

    if (db.listFolders().length !== folderCountBeforeRejectedCreate) {
      throw new Error('La creation invalide a laisse un sous-dossier orphelin.');
    }

    const createdInFolder = db.createDocument(rootFolder.id);
    if (createdInFolder.folder_id !== rootFolder.id) {
      throw new Error('La creation directe dans un dossier ne renseigne pas folder_id.');
    }
    db.updateDocument(createdInFolder.id, {
      title: 'Document cree dans dossier',
      content: 'Document protege du nettoyage des brouillons vides.',
      notes: '',
      status: 'draft',
      favorite: false,
      folder_id: rootFolder.id,
    });

    db.close();
    db = null;

    db = createTextothequeDatabase(dbPath);
    const persisted = db.getDocument(saved.id);
    const persistedFolders = db.listFolders();

    if (!persisted || persisted.content !== 'Document persistant en base SQLite.') {
      throw new Error('Le document ne persiste pas apres reouverture de la base.');
    }

    if (!persistedFolders.some((folder) => folder.name === 'Notes memoire')) {
      throw new Error('Le nom de dossier renomme ne persiste pas apres reouverture de la base.');
    }

    const trashed = db.trashDocument(saved.id);
    if (!trashed.deleted_at) {
      throw new Error('La mise a la corbeille ne renseigne pas deleted_at.');
    }
    assertCanonicalIsoUtc(trashed.deleted_at, 'documents.deleted_at apres mise a la corbeille');
    assertCanonicalIsoUtc(trashed.updated_at, 'documents.updated_at apres mise a la corbeille');

    if (db.listDocuments().some((document) => document.id === saved.id)) {
      throw new Error('Un document mis a la corbeille apparait encore dans la liste active.');
    }

    const deletedList = db.listDeletedDocuments();
    if (deletedList.length !== 1 || deletedList[0].id !== saved.id) {
      throw new Error('Un document mis a la corbeille est absent de la vue corbeille.');
    }

    const restored = db.restoreDocument(saved.id);
    if (restored.deleted_at !== null || restored.content !== 'Document persistant en base SQLite.') {
      throw new Error('La restauration ne conserve pas correctement le document.');
    }
    assertCanonicalIsoUtc(restored.updated_at, 'documents.updated_at apres restauration');

    if (!db.listDocuments().some((document) => document.id === saved.id)) {
      throw new Error('Un document restaure ne reapparait pas dans la liste active.');
    }

    const activeBeforeEmpty = db.updateDocument(db.createDocument().id, {
      title: 'Document actif protege',
      content: 'Ce document ne doit pas etre supprime.',
      notes: '',
      status: 'active',
      favorite: false,
    });
    const trashOne = db.updateDocument(db.createDocument().id, {
      title: 'Corbeille un',
      content: 'A supprimer definitivement.',
      notes: '',
      status: 'draft',
      favorite: false,
    });
    const trashTwo = db.updateDocument(db.createDocument().id, {
      title: 'Corbeille deux',
      content: 'A supprimer aussi.',
      notes: '',
      status: 'draft',
      favorite: false,
    });
    db.trashDocument(trashOne.id);
    db.trashDocument(trashTwo.id);

    const emptiedCount = db.emptyTrash();
    if (emptiedCount !== 2) {
      throw new Error(`Le vidage de corbeille devait supprimer 2 documents, pas ${emptiedCount}.`);
    }

    if (!db.getDocument(activeBeforeEmpty.id)) {
      throw new Error('Le vidage de corbeille a supprime un document actif.');
    }

    if (db.getDocument(trashOne.id) || db.getDocument(trashTwo.id)) {
      throw new Error('Le vidage de corbeille n a pas supprime tous les documents en corbeille.');
    }

    if (db.listDeletedDocuments().length !== 0) {
      throw new Error('La corbeille devrait etre vide apres vidage.');
    }

    db.close();
    db = null;

    db = createTextothequeDatabase(dbPath);
    const emptyDraft = db.createDocument();
    const withContent = db.updateDocument(db.createDocument().id, {
      title: '',
      content: 'Contenu utilisateur',
      notes: '',
      status: 'draft',
      favorite: false,
    });
    const withNotes = db.updateDocument(db.createDocument().id, {
      title: '',
      content: '',
      notes: 'Note interne',
      status: 'draft',
      favorite: false,
    });
    const favoriteDraft = db.updateDocument(db.createDocument().id, {
      title: '',
      content: '',
      notes: '',
      status: 'draft',
      favorite: true,
    });
    const activeDraft = db.updateDocument(db.createDocument().id, {
      title: '',
      content: '',
      notes: '',
      status: 'active',
      favorite: false,
    });

    db.close();
    db = null;

    db = createTextothequeDatabase(dbPath);
    const afterCleanupIds = new Set(db.listDocuments().map((document) => document.id));
    const afterCleanupDeleted = db.listDeletedDocuments();
    const afterCleanupDeletedIds = new Set(afterCleanupDeleted.map((document) => document.id));

    if (afterCleanupIds.has(emptyDraft.id)) {
      throw new Error('Le brouillon vide nettoyable existe encore apres reouverture.');
    }

    if (!afterCleanupDeletedIds.has(emptyDraft.id)) {
      throw new Error('Le brouillon vide nettoyable doit etre deplace en corbeille, pas detruit.');
    }

    const cleanedDraft = afterCleanupDeleted.find((document) => document.id === emptyDraft.id);
    assertCanonicalIsoUtc(cleanedDraft?.deleted_at, 'documents.deleted_at apres nettoyage de brouillon');
    assertCanonicalIsoUtc(cleanedDraft?.updated_at, 'documents.updated_at apres nettoyage de brouillon');

    for (const protectedDocument of [withContent, withNotes, favoriteDraft, activeDraft]) {
      if (!afterCleanupIds.has(protectedDocument.id)) {
        throw new Error(`Un document protege a ete nettoye a tort: ${protectedDocument.id}`);
      }
    }

    const parent = db.createFolder(null);
    const child = db.createFolder(parent.id);
    const member = db.createDocument(child.id);
    assert.throws(() => db.deleteEmptyFolder(parent.id), /doit être vide/);
    assert.throws(() => db.deleteEmptyFolder(child.id), /doit être vide/);
    db.trashDocument(member.id);
    assert.throws(() => db.deleteEmptyFolder(child.id), /doit être vide/);
    assert.equal(db.getDocument(member.id).folder_id, child.id);
    db.emptyTrash();
    db.deleteEmptyFolder(child.id);
    assert.throws(() => db.deleteEmptyFolder(child.id), /introuvable/);
    db.deleteEmptyFolder(parent.id);
    assert.ok(db.listFolders().every(folder => folder.id !== parent.id && folder.id !== child.id));

    db.close();
    db = null;

    diagnosticDb = new Database(dbPath, { readonly: true });
    const orphanDocuments = diagnosticDb
      .prepare(
        `SELECT COUNT(*) AS count
         FROM documents AS document
         LEFT JOIN folders AS folder ON folder.id = document.folder_id
         WHERE document.folder_id IS NOT NULL AND folder.id IS NULL`
      )
      .get().count;
    const orphanFolders = diagnosticDb
      .prepare(
        `SELECT COUNT(*) AS count
         FROM folders AS child
         LEFT JOIN folders AS parent ON parent.id = child.parent_id
         WHERE child.parent_id IS NOT NULL AND parent.id IS NULL`
      )
      .get().count;
    diagnosticDb.close();
    diagnosticDb = null;

    if (orphanDocuments !== 0 || orphanFolders !== 0) {
      throw new Error(
        `Le diagnostic referentiel a trouve ${orphanDocuments} document(s) et ${orphanFolders} dossier(s) orphelin(s).`
      );
    }

      if (process.env.TEXTOTHEQUE_TEST_FORCE_FAILURE === 'db-check') {
        throw new Error('Echec controle demande apres les assertions DB.');
      }

      successMessage = 'DB check OK';
    } finally {
      const cleanupErrors = [];

      for (const openDatabase of [diagnosticDb, db]) {
        if (!openDatabase) {
          continue;
        }
        try {
          openDatabase.close();
        } catch (error) {
          cleanupErrors.push(error);
        }
      }

      try {
        removeTestTempDirectory(tempDirectory);
      } catch (error) {
        cleanupErrors.push(error);
      }

      if (cleanupErrors.length > 0) {
        throw new AggregateError(cleanupErrors, 'Le nettoyage des ressources temporaires du test DB a echoue.');
      }
    }

    console.log(successMessage);
    console.log(`DB check temporary resources cleaned: ${tempDirectory}`);
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
