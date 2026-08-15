const os = require('node:os');
const path = require('node:path');
const { app } = require('electron');

app
  .whenReady()
  .then(async () => {
    const { createTextothequeDatabase } = await import('../dist-electron/database.js');
    const dbPath = path.join(os.tmpdir(), `textotheque-check-${Date.now()}.sqlite`);
    let db = createTextothequeDatabase(dbPath);

    const created = db.createDocument();
    if (created.title !== '') {
      throw new Error('Un nouveau document doit stocker un titre vide en base.');
    }

    const saved = db.updateDocument(created.id, {
      title: 'Verification SQLite',
      content: 'Document persistant en base SQLite.',
      notes: 'Controle V0.1',
      status: 'active',
      favorite: true,
    });
    const reopened = db.markOpened(saved.id);
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

    db = createTextothequeDatabase(dbPath);
    const afterCleanupIds = new Set(db.listDocuments().map((document) => document.id));
    const afterCleanupDeletedIds = new Set(db.listDeletedDocuments().map((document) => document.id));

    if (afterCleanupIds.has(emptyDraft.id)) {
      throw new Error('Le brouillon vide nettoyable existe encore apres reouverture.');
    }

    if (!afterCleanupDeletedIds.has(emptyDraft.id)) {
      throw new Error('Le brouillon vide nettoyable doit etre deplace en corbeille, pas detruit.');
    }

    for (const protectedDocument of [withContent, withNotes, favoriteDraft, activeDraft]) {
      if (!afterCleanupIds.has(protectedDocument.id)) {
        throw new Error(`Un document protege a ete nettoye a tort: ${protectedDocument.id}`);
      }
    }

    db.close();
    console.log(`DB check OK: ${dbPath}`);
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
