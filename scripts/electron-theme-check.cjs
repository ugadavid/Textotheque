const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

async function wait(read, label) {
  for (let i = 0; i < 200; i++) {
    if (await read()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw Error(label);
}

async function checkWindow(win, phase, second) {
  const { Menu, nativeTheme } = require('electron');
  const read = (code) => win.webContents.executeJavaScript(code);
  const has = (selector) => wait(() => read('Boolean(document.querySelector(' + JSON.stringify(selector) + '))'), selector);
  const click = (selector) => read('document.querySelector(' + JSON.stringify(selector) + ').click()');
  const menu = () => Menu.getApplicationMenu();
  const item = (theme) => menu()?.getMenuItemById('theme-' + theme);
  async function checkTheme(theme) {
    await wait(async () => item(theme)?.checked && !item(theme === 'dark' ? 'light' : 'dark')?.checked &&
      nativeTheme.themeSource === theme && await read('document.documentElement.dataset.theme') === theme,
    'Désaccord fenêtre/menu : ' + theme);
  }
  async function choose(theme) {
    item(theme).click();
    await checkTheme(theme);
  }
  async function capture(label) {
    if (!process.argv.includes('--captures')) return;
    await read('new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))');
    const directory = path.resolve('dist-electron', 'captures-048');
    fs.mkdirSync(directory, {recursive: true});
    fs.writeFileSync(path.join(directory, label + '.png'), (await win.webContents.capturePage()).toPNG());
  }
  const geometry = () => read(`[...document.querySelectorAll(
    '.pane, .editor-toolbar > *, .content-editor, .advanced-search-panel, .catalog-table-region, .status-bar, .confirm-dialog'
  )].map(e => e.getBoundingClientRect().toJSON())`);
  const position = () => read(`(() => {
    const e = document.querySelector('.content-editor');
    return [e.selectionStart, e.selectionEnd, e.selectionDirection, e.scrollTop, document.activeElement === e];
  })()`);
  const snapshot = () => read("window.textotheque.listDocuments().then(rows => rows.map(({id, content, updated_at}) => ({id, content, updated_at})))");

  await has('.library-name');
  await checkTheme(phase === 'restart' ? 'dark' : 'light');
  const display = menu().items.find((entry) => entry.label === 'Affichage');
  const themes = display.submenu.items.find((entry) => entry.label === 'Thème');
  assert.deepEqual(themes.submenu.items.map(({label, type}) => [label, type]), [['Clair','radio'], ['Sombre','radio']]);
  if (phase === 'restart') {
    assert.equal(await read("localStorage.getItem('textotheque:theme:v1')"), 'dark');
    await read("localStorage.setItem('textotheque:theme:v1', 'inconnu')");
    return;
  }
  if (phase === 'invalid') {
    await choose('dark');
    await choose('light');
    return;
  }
  assert.equal(await read("localStorage.getItem('textotheque:theme:v1')"), null);
  await click('.nav-view-button');
  await has('.catalog-row');
  await read("Array.from(document.querySelectorAll('.catalog-row')).find(row => row.textContent.includes('Le jardin des heures')).click()");
  await has('.content-editor');
  await wait(() => read("document.activeElement === document.querySelector('.content-editor')"), 'Focus éditeur');
  await click('.navigation-home');
  await has('.folder-section');
  await click('.expand-all-folders');
  await has('.tree-document-button');
  await read(`(() => {
    const e = document.querySelector('.content-editor');
    e.setSelectionRange(440, 486, 'backward');
    e.scrollTop = 95;
  })()`);
  const coordinates = await position();
  const before = await snapshot();
  const editorLayout = await geometry();
  const editorColor = () => read("getComputedStyle(document.querySelector('.content-editor')).backgroundColor");
  const lightColor = await editorColor();
  await capture('edition-light');
  await choose('dark');
  assert.deepEqual(await geometry(), editorLayout);
  assert.deepEqual(await position(), coordinates);
  assert.notEqual(await editorColor(), lightColor);
  await capture('edition-dark');
  const handleColor = () => read("getComputedStyle(document.querySelector('.left-resize-handle')).backgroundColor");
  const handlePoint = await read(`(() => {
    const rect = document.querySelector('.left-resize-handle').getBoundingClientRect();
    return {x: Math.floor(rect.left + rect.width / 2), y: Math.floor(rect.top + rect.height / 2)};
  })()`);
  win.webContents.sendInputEvent({type: 'mouseMove', x: 1, y: 1});
  await wait(() => read("!document.querySelector('.left-resize-handle').matches(':hover')"), 'Poignée au repos');
  const restingColor = await handleColor();
  win.webContents.sendInputEvent({type: 'mouseMove', ...handlePoint});
  await wait(async () => await handleColor() !== restingColor, 'Survol de la poignée');
  win.webContents.sendInputEvent({type: 'mouseMove', x: 1, y: 1});
  await choose('light');
  assert.equal(await editorColor(), lightColor);
  assert.deepEqual(await position(), coordinates);
  assert.equal(await read("Boolean(document.querySelector('.title-dirty-marker'))"), false);
  assert.deepEqual(await snapshot(), before);

  await click('.trash-button');
  await has('.confirm-dialog');
  const dialogLayout = await geometry();
  await capture('dialogue-light');
  await choose('dark');
  assert.deepEqual(await geometry(), dialogLayout);
  await capture('dialogue-dark');
  await click('.confirm-dialog .secondary-button');
  await click('.advanced-search-button');
  await has('.catalog-row');
  const searchLayout = await geometry();
  await capture('recherche-dark');
  assert.equal(await read("getComputedStyle(document.querySelector('.catalog-table th')).position"), 'sticky');
  await read("document.querySelector('.catalog-sort-button').focus()");
  win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'Tab'});
  win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'Tab'});
  await wait(() => read("document.activeElement.matches('.catalog-sort-button:focus-visible')"), 'Focus clavier du catalogue');
  await read("document.activeElement.blur()");
  await choose('light');
  assert.deepEqual(await geometry(), searchLayout);
  await capture('recherche-light');
  await click('.nav-view-button');
  await wait(() => read("document.querySelector('#catalog-title')?.textContent === 'Tous les textes'"), 'Catalogue');
  await has('.catalog-row');
  const catalogLayout = await geometry();
  await choose('dark');
  assert.deepEqual(await geometry(), catalogLayout);
  await capture('catalogue-dark');
  await click('.todo-toolbar-button');
  await has('.todo-toolbar-button.active');
  await capture('todo-dark');
  await click('.nav-view-button:nth-child(2)');
  await has('.content-editor:disabled');
  await has('.empty-trash-button');
  await capture('corbeille-dark');
  win.webContents.send('library:menu-action', {action: 'known', path: second});
  await wait(() => read("document.querySelector('.library-name')?.textContent.includes('seconde.sqlite')"), 'Bascule bibliothèque');
  await checkTheme('dark');
}

async function runWindow(temp, phase) {
  const { app } = require('electron');
  app.setPath('appData', temp);
  const second = path.join(temp, 'seconde.sqlite');
  if (phase === 'first') {
    const { createNewTextothequeDatabase } = await import('../dist-electron/database.js');
    createNewTextothequeDatabase(second).close();
    const db = createNewTextothequeDatabase(process.env.TEXTOTHEQUE_DB_PATH);
    try {
      const folder = db.renameFolder(db.createFolder().id, 'Carnet de printemps');
      for (const title of ['Le jardin des heures', 'Les premières graines', 'Ancien brouillon']) {
        const doc = db.createDocument(folder.id);
        db.updateDocument(doc.id, {title, status: 'draft', favorite: true, folder_id: folder.id,
          notes: 'Texte fictif pour la recette des thèmes.',
          content: ('À la lisière du jardin, les herbes gardent encore la rosée.\n' +
            'Une abeille traverse le sentier et disparaît entre les sauges.\n\n').repeat(24)});
        if (title === 'Ancien brouillon') db.trashDocument(doc.id);
      }
    } finally { db.close(); }
  }
  app.once('browser-window-created', (_, win) => {
    win.setSize(1600, 900);
    const initialTheme = new Promise((resolve) => win.once('show', () =>
      resolve(win.webContents.executeJavaScript('document.documentElement.dataset.theme'))));
    win.webContents.once('did-finish-load', async () => {
      try {
        assert.equal(await initialTheme, phase === 'restart' ? 'dark' : 'light');
        await checkWindow(win, phase, second);
        console.log('Thème OK : ' + phase);
        win.close();
      } catch (error) { console.error(error); app.exit(1); }
    });
  });
  await import('../dist-electron/main.js');
}

async function runTest() {
  const { preview } = await import('vite');
  const server = await preview({preview: {port: 5173, strictPort: true}});
  const temp = createTestTempDirectory('theme');
  try {
    for (const phase of ['first', 'restart', 'invalid']) {
      const args = [__filename, '--fixture', phase, '--user-data-dir=' + temp];
      if (process.argv.includes('--captures')) args.push('--captures');
      const child = spawn(require('electron'), args, {stdio: 'inherit', timeout: 45000,
        env: {...process.env, TEXTOTHEQUE_DB_PATH: path.join(temp, 'fixture.sqlite'),
          TEXTOTHEQUE_LIBRARY_HISTORY_PATH: path.join(temp, 'history.json')}});
      const code = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });
      assert.equal(code, 0, phase);
    }
  } finally {
    await server.close();
    removeTestTempDirectory(temp);
  }
}

const fixture = process.argv.indexOf('--fixture');
(fixture >= 0 ? runWindow(path.dirname(process.env.TEXTOTHEQUE_DB_PATH), process.argv[fixture + 1]) : runTest())
  .catch((error) => { console.error(error); process.exitCode = 1; });
