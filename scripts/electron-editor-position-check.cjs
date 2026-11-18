const path = require('node:path');
const { spawn } = require('node:child_process');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

// This function runs in the real renderer. Navigation always goes through the UI.
async function checkEditor(phase) {
  const find = (selector) => document.querySelector(selector);
  const editor = () => find('.content-editor');
  const title = () => find('.title-input')?.value;
  const api = window.textotheque;
  const check = (condition, message) => { if (!condition) throw Error(message); };
  async function wait(read, label) {
    for (let i = 0; i < 250; i++) {
      const value = await read();
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw Error(label);
  }
  async function open(name) {
    const link = await wait(() => [...document.querySelectorAll('.document-item, .catalog-row')]
      .find((item) => item.textContent.includes(name)), 'Lien ' + name);
    link.click();
    await wait(() => title() === name && editor(), 'Éditeur ' + name);
    // Include the normal deferred focus after IPC and document refresh.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
  function position() {
    const e = editor();
    return [e.selectionStart, e.selectionEnd, e.selectionDirection, e.scrollTop, e.scrollLeft];
  }
  function place(start, end, direction, top) {
    const e = editor();
    e.focus();
    e.setSelectionRange(start, end, direction);
    e.scrollTop = top;
    check(e.scrollTop >= top - 1, 'Fixture insuffisamment longue');
    return position();
  }
  function expectPosition(expected) {
    const actual = position();
    check(actual.slice(0, 3).every((v, i) => v === expected[i]) &&
      Math.abs(actual[3] - expected[3]) <= 1 && Math.abs(actual[4] - expected[4]) <= 1,
      'Position attendue ' + expected + ', obtenue ' + actual);
    check(!find('.title-dirty-marker'), 'Faux dirty après restauration');
  }

  const inSecondLibrary = phase !== 'first';
  const file = inSecondLibrary ? 'second.sqlite' : 'first.sqlite';
  await wait(() => find('.library-name')?.textContent.includes(file), 'Bibliothèque ' + file);
  find('.nav-view-button').click();
  if (inSecondLibrary) {
    await open('Gamma');
    const gamma = (await api.listDocuments())[0];
    check(gamma.id === 1 && editor().selectionStart === editor().selectionEnd &&
      editor().scrollTop === 0, 'Position héritée sur Gamma');
    if (phase === 'switch') {
      const lastPosition = place(6400, 6500, 'backward', 1800);
      find('.advanced-search-button').click();
      await wait(() => find('.advanced-search-panel'), 'Recherche dans la seconde bibliothèque');
      find('.advanced-search-button').click();
      await wait(editor, 'Retour à Gamma');
      expectPosition(lastPosition);
    }
    return;
  }

  await open('Alpha');
  const alpha = (await api.listDocuments()).find((doc) => doc.title === 'Alpha');
  check(alpha.id === 1, 'Identité de la fixture Alpha');
  const caretA = place(6200, 6200, 'none', 2100);
  await open('Beta');
  const rangeB = place(1500, 1620, 'forward', 750);
  await open('Alpha');
  expectPosition(caretA);
  const rangeA = place(7300, 7440, 'backward', 2700);
  await open('Beta');
  expectPosition(rangeB);
  await open('Alpha');
  expectPosition(rangeA);
  check(document.activeElement === editor(), 'Focus normal après ouverture');

  find('.advanced-search-button').click();
  await wait(() => find('.advanced-search-panel'), 'Recherche ouverte');
  find('.notes-editor').focus();
  find('.advanced-search-button').click();
  await wait(editor, 'Retour depuis la recherche');
  expectPosition(rangeA);
  check(document.activeElement === find('.notes-editor'), 'Focus volé au retour de la recherche');
  check((await api.getDocument(alpha.id)).updated_at === alpha.updated_at, 'Écriture lors de la navigation');

  editor().focus();
  editor().dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', bubbles: true, cancelable: true}));
  await wait(() => editor().value[rangeA[0]] === '\t', 'Insertion Tab');
  check(editor().selectionStart === rangeA[0] + 1 && editor().selectionEnd === editor().selectionStart, 'Caret après Tab');
  editor().setSelectionRange(rangeA[0], rangeA[0] + 1);
  editor().dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', bubbles: true, cancelable: true}));
  document.execCommand('insertText', false, 'X');
  const edited = editor().value;
  check(edited.slice(rangeA[0], rangeA[0] + 2) === '\tX' && editor().selectionStart === rangeA[0] + 2, 'Frappe après Tab');
  const afterEdit = place(rangeA[0] + 2, rangeA[0] + 2, 'none', 2600);
  await wait(async () => !find('.title-dirty-marker') && (await api.getDocument(alpha.id)).content === edited, 'Autosave');
  await open('Beta');
  expectPosition(rangeB);
  await open('Alpha');
  expectPosition(afterEdit);
  check(editor().value === edited, 'Contenu modifié perdu');
  // Change the inactive fixture to exercise selection and scroll clamping.
  const beta = (await api.listDocuments()).find((doc) => doc.title === 'Beta');
  await api.updateDocument(beta.id, {...beta, content: 'court'});
  await open('Beta');
  check(editor().selectionStart === 5 && editor().selectionEnd === 5 && editor().scrollTop === 0, 'Bornage du texte raccourci');
  await open('Alpha');
  place(7000, 7110, 'backward', 2000);
}

async function runElectron(temp, restart) {
  const { app } = require('electron');
  app.setPath('appData', temp);
  const second = path.join(temp, 'second.sqlite');
  if (!restart) {
    const { createNewTextothequeDatabase } = await import('../dist-electron/database.js');
    for (const [file, names] of [[process.env.TEXTOTHEQUE_DB_PATH, ['Alpha', 'Beta']], [second, ['Gamma']]]) {
      const db = createNewTextothequeDatabase(file);
      try {
        for (const title of names) {
          const content = Array.from({length: 600}, (_, i) => title + ' — Ligne fictive ' + i).join('\n');
          db.updateDocument(db.createDocument().id, {title, content, notes: '', status: 'draft', favorite: false, folder_id: null});
        }
      } finally { db.close(); }
    }
  }
  app.once('browser-window-created', (_, win) => {
    win.webContents.once('did-finish-load', async () => {
      const run = (phase) => win.webContents.executeJavaScript('(' + checkEditor.toString() + ')(' + JSON.stringify(phase) + ')');
      try {
        if (restart) await run('restart');
        else {
          await run('first');
          win.webContents.send('library:menu-action', { action: 'known', path: second });
          await run('switch');
        }
        console.log(restart ? 'Nouvelle session OK' : 'Positions, Tab, autosave, recherche et changement de bibliothèque OK');
        win.close();
      } catch (error) { console.error(error); app.exit(1); }
    });
  });
  await import('../dist-electron/main.js');
}

async function runTest() {
  const { preview } = await import('vite');
  const server = await preview({ preview: { port: 5173, strictPort: true } });
  const temp = createTestTempDirectory('editor-position');
  try {
    for (const phase of ['first', 'restart']) {
      const child = spawn(require('electron'), [__filename, '--fixture', phase, '--user-data-dir=' + temp], {
        stdio: 'inherit', timeout: 45000,
        env: {...process.env, TEXTOTHEQUE_DB_PATH: path.join(temp, 'first.sqlite'),
          TEXTOTHEQUE_LIBRARY_HISTORY_PATH: path.join(temp, 'history.json')},
      });
      const code = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });
      if (code !== 0) throw Error('Recette Electron en échec : ' + phase + ' (' + code + ')');
    }
  } finally {
    await server.close();
    removeTestTempDirectory(temp);
  }
}

(process.argv.includes('--fixture')
  ? runElectron(path.dirname(process.env.TEXTOTHEQUE_DB_PATH), process.argv.includes('restart'))
  : runTest()).catch((error) => { console.error(error); process.exitCode = 1; });
