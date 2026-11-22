const path = require('node:path');
const { spawn } = require('node:child_process');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

// This function runs in the real renderer. Navigation always goes through the UI.
async function checkEditor(phase, expectedDocuments, closingPosition) {
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

  const inSecondLibrary = phase === 'switch' || phase === 'restart';
  const file = inSecondLibrary ? 'second.sqlite' : 'first.sqlite';
  await wait(() => find('.library-name')?.textContent.includes(file), 'Bibliothèque ' + file);
  const library = await api.getLibraryInfo();
  const key = 'textotheque:editor-positions:v1:' + library.path;
  async function checkDocument(name) {
    const saved = expectedDocuments.find((entry) => entry.title === name);
    const current = await api.getDocument(saved.id);
    check(current.updated_at === saved.updated_at && current.content === saved.content &&
      !find('.title-dirty-marker'), 'Écriture métier à la restauration : ' + name);
  }
  async function showCatalog() {
    find('.nav-view-button').click();
    await wait(() => find('.catalog-row') && !editor(), 'Catalogue visible');
  }
  if (phase === 'restart') {
    // The last open library contains only Gamma: verify its very first mount,
    // before a second navigation could accidentally repair startup restoration.
    await wait(() => title() === 'Gamma' && editor(), 'Gamma au démarrage');
    expectPosition(closingPosition);
    await checkDocument('Gamma');
  }
  find('.nav-view-button').click();
  if (inSecondLibrary) {
    await open('Gamma');
    const gamma = (await api.listDocuments())[0];
    check(gamma.id === 1, 'ID commun à Alpha et Gamma');
    if (phase === 'switch') {
      check(editor().selectionStart === editor().selectionEnd && editor().scrollTop === 0, 'Position héritée sur Gamma');
      const lastPosition = place(6400, 6500, 'backward', 1800);
      find('.advanced-search-button').click();
      await wait(() => find('.advanced-search-panel'), 'Recherche dans la seconde bibliothèque');
      find('.advanced-search-button').click();
      await wait(editor, 'Retour à Gamma');
      expectPosition(lastPosition);
      // Leave the last position only in the live textarea until win.close().
      place(8200, 8400, 'backward', 3400);
      return [gamma];
    }
    return;
  }

  if (phase === 'reopen-first') {
    await open('Alpha');
    expectPosition([7000, 7110, 'backward', 2000, 0]);
    await checkDocument('Alpha');
    await open('Beta');
    expectPosition([1500, 1500, 'forward', 750, 0]);
    await checkDocument('Beta');
    const alpha = expectedDocuments.find((doc) => doc.title === 'Alpha');
    await api.updateDocument(alpha.id, {...alpha, content: 'court'});
    await showCatalog();
    const entries = JSON.parse(localStorage.getItem(key));
    check(Object.keys(entries['1']).sort().join() === 'direction,end,scrollLeft,scrollTop,start',
      'La préférence doit contenir uniquement les coordonnées');
    entries['2'].scrollTop = 'invalide';
    localStorage.setItem(key, JSON.stringify(entries));
    return;
  }
  if (phase === 'short' || phase === 'corrupt') {
    await open('Alpha');
    if (phase === 'short') {
      check(editor().value === 'court' && editor().selectionStart === 5 && editor().selectionEnd === 5 &&
        editor().scrollTop === 0, 'Bornage au redémarrage malgré une entrée voisine invalide');
    }
    await open('Beta');
    check(editor().selectionStart === editor().selectionEnd && editor().scrollTop === 0 &&
      !find('.error-message'), 'Préférence corrompue bloquante');
    if (phase === 'short') {
      await showCatalog();
      localStorage.setItem(key, '{json invalide');
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
  place(7300, 7440, 'backward', 2700);
  for (let i = 0; i < 3; i++) {
    editor().dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', ctrlKey: true, bubbles: true, cancelable: true}));
  }
  const rangeA = position();
  check(rangeA[3] > 2700, 'Défilement avant Alpha → Beta → Alpha');
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
  await api.updateDocument(beta.id, beta);
  await open('Beta');
  place(1500, 1500, 'forward', 750);
  await open('Alpha');
  place(7000, 7110, 'backward', 2000);
  return api.listDocuments();
}

async function checkScrollKeys(win, file, gamma) {
  const assert = require('node:assert/strict');
  const read = code => win.webContents.executeJavaScript(code);
  const state = () => read(`(() => {
    const e = document.querySelector('.content-editor');
    return [e.selectionStart, e.selectionEnd, e.selectionDirection, e.scrollTop, e.scrollLeft];
  })()`);
  const line = await read("parseFloat(getComputedStyle(document.querySelector('.content-editor')).lineHeight)");
  const max = await read("document.querySelector('.content-editor').scrollHeight - document.querySelector('.content-editor').clientHeight");
  async function place(start, end, direction, top) {
    await read(`(() => {
      const e = document.querySelector('.content-editor');
      e.focus();
      e.setSelectionRange(${start}, ${end}, '${direction}');
      e.scrollTop = ${top};
    })()`);
  }
  async function press(keyCode, repeated = false) {
    const before = await state();
    const modifiers = ['control'];
    if (repeated) modifiers.push('isAutoRepeat');
    for (const type of ['keyDown', 'keyUp']) win.webContents.sendInputEvent({type, keyCode, modifiers});
    const after = await state();
    const expectedTop = Math.max(0, Math.min(max, before[3] + (keyCode === 'Down' ? line : -line)));
    assert.ok(Math.abs(after[3] - expectedTop) <= 1, 'Défilement obtenu ' + after[3] + ', attendu ' + expectedTop);
    assert.deepEqual(after.slice(0, 3), before.slice(0, 3));
    assert.equal(after[4], before[4]);
    assert.ok(await read("document.activeElement.matches('.content-editor') && !document.querySelector('.title-dirty-marker')"));
    return after;
  }
  const observer = new (require('better-sqlite3'))(file, {readonly: true});
  try {
    const version = observer.pragma('data_version', {simple: true});
    for (const [end, direction] of [[6200, 'none'], [6350, 'forward'], [6350, 'backward']]) {
      await place(6200, end, direction, 2100);
      await press('Down');
      await press('Up');
    }
    await place(6200, 6350, 'backward', 0);
    await press('Up');
    await place(6200, 6350, 'forward', max);
    await press('Down');
    assert.ok(await read(`['ArrowUp', 'ArrowDown'].every(key =>
      [{}, {shiftKey:true}, {ctrlKey:true, shiftKey:true}, {ctrlKey:true, altKey:true}, {ctrlKey:true, metaKey:true}]
        .every(mods => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key, ...mods, bubbles:true, cancelable:true}))))`));
    await place(8200, 8400, 'backward', 3400);
    await press('Down');
    await press('Down', true);
    const closing = await press('Down', true);
    // Cover the 1.5 s autosave window before the close/navigation guard runs.
    await new Promise(resolve => setTimeout(resolve, 1750));
    assert.deepEqual(await state(), closing);
    assert.equal(await read("document.querySelector('.content-editor').value"), gamma.content);
    const saved = observer.prepare('SELECT updated_at, content FROM documents WHERE id = ?').get(gamma.id);
    assert.deepEqual(saved, {updated_at: gamma.updated_at, content: gamma.content});
    assert.equal(observer.pragma('data_version', {simple: true}), version);
    console.log('Ctrl+flèches OK, pas CSS', line, 'px, position avant fermeture', closing);
    return closing;
  } finally { observer.close(); }
}

async function runElectron(temp, phase) {
  const { app } = require('electron');
  const fs = require('node:fs');
  app.setPath('appData', temp);
  const second = path.join(temp, 'second.sqlite');
  if (phase === 'first') {
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
      const baseline = path.join(temp, 'expected-documents.json');
      const run = (step, docs = [], closingPosition = null) => win.webContents.executeJavaScript(
        '(' + checkEditor.toString() + ')(...' + JSON.stringify([step, docs, closingPosition]) + ')');
      try {
        if (phase === 'first') {
          const firstDocs = await run('first');
          win.webContents.send('library:menu-action', { action: 'known', path: second });
          const secondDocs = await run('switch');
          const closingPosition = await checkScrollKeys(win, second, secondDocs[0]);
          fs.writeFileSync(baseline, JSON.stringify({docs: [...firstDocs, ...secondDocs], closingPosition}));
        } else if (phase === 'restart') {
          const {docs, closingPosition} = JSON.parse(fs.readFileSync(baseline, 'utf8'));
          await run('restart', docs, closingPosition);
          win.webContents.send('library:menu-action', { action: 'known', path: process.env.TEXTOTHEQUE_DB_PATH });
          await run('reopen-first', docs);
        } else await run(phase);
        console.log('Positions éditeur OK : ' + phase);
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
    for (const phase of ['first', 'restart', 'short', 'corrupt']) {
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
  ? runElectron(path.dirname(process.env.TEXTOTHEQUE_DB_PATH), process.argv[process.argv.indexOf('--fixture') + 1])
  : runTest()).catch((error) => { console.error(error); process.exitCode = 1; });
