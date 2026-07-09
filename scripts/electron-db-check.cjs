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

    db.close();

    db = createTextothequeDatabase(dbPath);
    const persisted = db.getDocument(saved.id);

    if (!persisted || persisted.content !== 'Document persistant en base SQLite.') {
      throw new Error('Le document ne persiste pas apres reouverture de la base.');
    }

    db.close();
    console.log(`DB check OK: ${dbPath}`);
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
