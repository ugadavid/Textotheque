const path = require('node:path');
const { app } = require('electron');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

const tempDirectory = createTestTempDirectory('auto-title');

function updateDocument(db, document, title, content = document.content) {
  return db.updateDocument(document.id, {
    title,
    content,
    notes: document.notes,
    status: document.status,
    favorite: document.favorite === 1,
    folder_id: document.folder_id,
  });
}

app.whenReady().then(async () => {
  const openDatabases = [];
  let successMessage;
  try {
    const {
      createTextothequeDatabase,
      isAutomaticDocumentTitle,
      localDocumentTitleDate,
      MAX_AUTOMATIC_DOCUMENTS_PER_DAY,
    } = await import('../dist-electron/database.js');
    const { suggestedTextExportFileName } = await import('../dist-electron/text-export.js');
    const openDatabase = (name) => {
      const db = createTextothequeDatabase(path.join(tempDirectory, `${name}.sqlite`));
      openDatabases.push(db);
      return db;
    };
    const closeDatabase = (db) => {
      db.close();
      openDatabases.splice(openDatabases.indexOf(db), 1);
    };
    const day16 = new Date(2026, 7, 16, 10, 30, 0, 0);
    const day17 = new Date(2026, 7, 17, 0, 15, 0, 0);

    const fakeLocalCalendar = {
      getFullYear: () => 2026,
      getMonth: () => 7,
      getDate: () => 17,
    };
    if (localDocumentTitleDate(fakeLocalCalendar) !== '20260817') {
      throw new Error('La date du titre automatique ne repose pas sur les composantes calendaires locales.');
    }

    const firstDb = openDatabase('first');
    const first = firstDb.createDocument(null, day16);
    const second = firstDb.createDocument(null, day16);
    const third = firstDb.createDocument(null, day16);
    if (
      first.title !== 'tot_20260816_01' ||
      second.title !== 'tot_20260816_02' ||
      third.title !== 'tot_20260816_03'
    ) {
      throw new Error(`Premier increment quotidien invalide: ${first.title}, ${second.title}, ${third.title}`);
    }

    const gapDb = openDatabase('gap');
    gapDb.createDocument(null, day16);
    gapDb.createDocument(null, day16);
    const gapSeed = gapDb.createDocument(null, day16);
    updateDocument(gapDb, gapSeed, 'tot_20260816_07');
    const afterGap = gapDb.createDocument(null, day16);
    if (afterGap.title !== 'tot_20260816_08') {
      throw new Error(`Le maximum quotidien avec trou n est pas respecte: ${afterGap.title}`);
    }

    const trashDb = openDatabase('trash');
    trashDb.createDocument(null, day16);
    const trashed = trashDb.createDocument(null, day16);
    trashDb.trashDocument(trashed.id);
    const afterTrash = trashDb.createDocument(null, day16);
    if (afterTrash.title !== 'tot_20260816_03') {
      throw new Error(`La corbeille n est pas incluse dans le compteur: ${afterTrash.title}`);
    }

    const manualDb = openDatabase('manual');
    const manualSeed = manualDb.createDocument(null, day16);
    const manualTitle = updateDocument(manualDb, manualSeed, 'tot_20260816_42');
    const irrelevantTitles = ['Soutenance', 'tot_notes', 'tot_20260816', 'tot_20260816_test'];
    for (const title of irrelevantTitles) {
      updateDocument(manualDb, manualDb.createDocument(null, day16), title);
    }
    const afterManual = manualDb.createDocument(null, day16);
    if (afterManual.title !== 'tot_20260816_43' || manualTitle.title !== 'tot_20260816_42') {
      throw new Error(`Titre manuel ou titres hors motif mal comptes: ${afterManual.title}`);
    }
    if (MAX_AUTOMATIC_DOCUMENTS_PER_DAY !== 99) {
      throw new Error(`La borne metier des titres automatiques est invalide: ${MAX_AUTOMATIC_DOCUMENTS_PER_DAY}`);
    }

    const maximumDb = openDatabase('maximum');
    updateDocument(maximumDb, maximumDb.createDocument(null, day16), 'tot_20260816_98');
    const ninetyNine = maximumDb.createDocument(null, day16);
    const countAtLimit = maximumDb.listDocuments().length + maximumDb.listDeletedDocuments().length;
    let limitError = null;
    try {
      maximumDb.createDocument(null, day16);
    } catch (error) {
      limitError = error;
    }
    const countAfterLimit = maximumDb.listDocuments().length + maximumDb.listDeletedDocuments().length;
    if (
      ninetyNine.title !== 'tot_20260816_99' ||
      !(limitError instanceof Error) ||
      !limitError.message.includes('limite de 99 documents automatiques') ||
      countAfterLimit !== countAtLimit
    ) {
      throw new Error(
        `La limite quotidienne n est pas atomique: title=${ninetyNine.title}, error=${limitError}, before=${countAtLimit}, after=${countAfterLimit}`
      );
    }

    const trashLimitDb = openDatabase('trash-limit');
    const trashMaximum = updateDocument(trashLimitDb, trashLimitDb.createDocument(null, day16), 'tot_20260816_99');
    trashLimitDb.trashDocument(trashMaximum.id);
    const trashCountAtLimit = trashLimitDb.listDocuments().length + trashLimitDb.listDeletedDocuments().length;
    let trashLimitError = null;
    try {
      trashLimitDb.createDocument(null, day16);
    } catch (error) {
      trashLimitError = error;
    }
    if (
      !(trashLimitError instanceof Error) ||
      !trashLimitError.message.includes('limite de 99 documents automatiques') ||
      trashLimitDb.listDocuments().length + trashLimitDb.listDeletedDocuments().length !== trashCountAtLimit
    ) {
      throw new Error('Un suffixe 99 en corbeille doit refuser la creation sans insertion.');
    }

    const outsideDomainDb = openDatabase('outside-domain');
    updateDocument(outsideDomainDb, outsideDomainDb.createDocument(null, day16), 'tot_20260816_100');
    const afterHundred = outsideDomainDb.createDocument(null, day16);
    if (afterHundred.title !== 'tot_20260816_01') {
      throw new Error(`Un titre hors domaine _100 influence le compteur: ${afterHundred.title}`);
    }

    const invalidPatternDb = openDatabase('invalid-patterns');
    for (const title of [
      'tot_20260816_1',
      'tot_20260816_001',
      'tot_20260816_AB',
      'tot_20260816_12foo',
      'tot_20260816_test',
    ]) {
      updateDocument(invalidPatternDb, invalidPatternDb.createDocument(null, day16), title);
    }
    const afterInvalidPatterns = invalidPatternDb.createDocument(null, day16);
    if (afterInvalidPatterns.title !== 'tot_20260816_01') {
      throw new Error(`Un titre hors motif strict influence le compteur: ${afterInvalidPatterns.title}`);
    }
    if (
      !isAutomaticDocumentTitle('tot_20260816_01') ||
      !isAutomaticDocumentTitle('tot_20260816_99') ||
      isAutomaticDocumentTitle('tot_20260816_00') ||
      isAutomaticDocumentTitle('tot_20260816_1') ||
      isAutomaticDocumentTitle('tot_20260816_100')
    ) {
      throw new Error('La reconnaissance du domaine automatique 01-99 est invalide.');
    }

    const nextDayDb = openDatabase('next-day');
    updateDocument(nextDayDb, nextDayDb.createDocument(null, day16), 'tot_20260816_25');
    const nextDay = nextDayDb.createDocument(null, day17);
    if (nextDay.title !== 'tot_20260817_01') {
      throw new Error(`Le compteur ne repart pas au nouveau jour local: ${nextDay.title}`);
    }

    const libraryA = openDatabase('library-a');
    const libraryB = openDatabase('library-b');
    libraryA.createDocument(null, day16);
    libraryA.createDocument(null, day16);
    const firstInB = libraryB.createDocument(null, day16);
    if (firstInB.title !== 'tot_20260816_01') {
      throw new Error(`Les bibliotheques ne possedent pas un compteur independant: ${firstInB.title}`);
    }

    const folderDb = openDatabase('folder');
    const folder = folderDb.createFolder(null);
    const foldered = folderDb.createDocument(folder.id, day16);
    if (foldered.title !== 'tot_20260816_01' || foldered.folder_id !== folder.id) {
      throw new Error(`La creation contextualisee est invalide: ${JSON.stringify(foldered)}`);
    }

    const userTitleDb = openDatabase('user-title');
    const automatic = userTitleDb.createDocument(null, day16);
    const userTitled = updateDocument(userTitleDb, automatic, 'Idées soutenance');
    const userContent = updateDocument(userTitleDb, userTitled, userTitled.title, 'Contenu autosauvegardé');
    if (userContent.title !== 'Idées soutenance' || isAutomaticDocumentTitle(userContent.title)) {
      throw new Error(`Un titre utilisateur a ete remplace: ${userContent.title}`);
    }

    const historicalDbPath = path.join(tempDirectory, 'historical.sqlite');
    let historicalDb = openDatabase('historical');
    const historical = updateDocument(historicalDb, historicalDb.createDocument(null, day16), 'Sans titre');
    closeDatabase(historicalDb);
    historicalDb = openDatabase(path.basename(historicalDbPath, '.sqlite'));
    if (historicalDb.getDocument(historical.id)?.title !== 'Sans titre') {
      throw new Error('Un document historique Sans titre a ete renomme retroactivement.');
    }
    closeDatabase(historicalDb);

    const cleanupDbPath = path.join(tempDirectory, 'cleanup.sqlite');
    let cleanupDb = openDatabase('cleanup');
    const emptyAutomatic = cleanupDb.createDocument(null, day16);
    closeDatabase(cleanupDb);
    cleanupDb = openDatabase(path.basename(cleanupDbPath, '.sqlite'));
    const cleaned = cleanupDb.getDocument(emptyAutomatic.id);
    if (!cleaned?.deleted_at || cleaned.title !== 'tot_20260816_01') {
      throw new Error(`Le brouillon automatique vide n a pas ete nettoye logiquement: ${JSON.stringify(cleaned)}`);
    }
    closeDatabase(cleanupDb);

    if (suggestedTextExportFileName('tot_20260816_03') !== 'tot_20260816_03.txt') {
      throw new Error('Le titre automatique ne produit pas le nom d export attendu.');
    }

    successMessage = 'bounded automatic document titles, SQL maximum, limits and library independence ok';
  } finally {
    for (const db of openDatabases.splice(0)) db.close();
    removeTestTempDirectory(tempDirectory);
  }

  console.log(successMessage);
  console.log(`auto-title temporary resources cleaned: ${tempDirectory}`);
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
