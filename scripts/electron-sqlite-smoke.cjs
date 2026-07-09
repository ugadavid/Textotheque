const { app } = require('electron');
const Database = require('better-sqlite3');

app
  .whenReady()
  .then(() => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE smoke (id INTEGER PRIMARY KEY, title TEXT NOT NULL)');
    db.prepare('INSERT INTO smoke (title) VALUES (?)').run('electron sqlite ok');
    const row = db.prepare('SELECT title FROM smoke WHERE id = 1').get();

    if (!row || row.title !== 'electron sqlite ok') {
      throw new Error('Electron SQLite smoke test failed.');
    }

    db.close();
    console.log(row.title);
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
