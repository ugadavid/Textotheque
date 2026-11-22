const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runPreferenceSessions } = require('./preference-test-sessions.cjs');

const manual = ['Zéphyr', 'Lot 10', 'Lot 2', 'Églantine', 'abricot'];
const alphabetical = ['abricot', 'Églantine', 'Zéphyr', 'Lot 2', 'Lot 10'];
const titles = ['Carnet 2', 'écho', 'ÉCHO', 'Carnet 10'];
const key = 'textotheque:explorer-order:v1';

async function seed(first, second) {
  const { createNewTextothequeDatabase } = await import('../dist-electron/database.js');
  const db = createNewTextothequeDatabase(first);
  try {
    const folder = (name, parent = null) => db.renameFolder(db.createFolder(parent).id, name).id;
    const root = folder('Zéphyr');
    folder('Lot 10', root);
    folder('Lot 2', root);
    folder('Églantine');
    folder('abricot');
    for (const folderId of [null, root]) {
      for (const title of titles) {
        const doc = db.createDocument(folderId);
        db.updateDocument(doc.id, {title, content: 'Exemple fictif pour la mission 049.', notes: '',
          favorite: false, status: 'draft', folder_id: folderId});
      }
    }
  } finally { db.close(); }
  const other = createNewTextothequeDatabase(second);
  try {
    for (const name of ['Zulu', 'Alpha']) other.renameFolder(other.createFolder().id, name);
  } finally { other.close(); }
}

async function until(fn, label) {
  for (let i = 0; i < 200; i++) {
    if (await fn()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(label);
}

async function check(win, phase, first, second) {
  const { Menu } = require('electron');
  const read = code => win.webContents.executeJavaScript(code);
  const click = selector => read('document.querySelector(' + JSON.stringify(selector) + ').click()');
  const item = id => Menu.getApplicationMenu()?.getMenuItemById(id);
  const stored = () => read('localStorage.getItem(' + JSON.stringify(key) + ')');
  const names = () => read("[...document.querySelectorAll('.folder-list .folder-label')].map(e => e.textContent)");
  const docs = branch => read(`[...document.querySelectorAll(${JSON.stringify(branch + ' .tree-document-title')})].map(e => e.textContent)`);
  const rootDocs = '.folder-list .folder-row:has(.tree-document-button)';
  const unfiled = '.unfiled-tree-section';
  async function order(value) {
    await until(() => item('explorer-order-' + value)?.checked &&
      !item('explorer-order-' + (value === 'manual' ? 'alphabetical' : 'manual'))?.checked, 'Radios ' + value);
  }
  async function choose(value) {
    item('explorer-order-' + value).click();
    await until(async () => await stored() === value, 'Préférence ' + value);
    await order(value);
  }
  async function capture(mode) {
    if (!process.argv.includes('--captures')) return;
    const rect = await read(`new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => {
      const r = document.querySelector('.navigation-pane').getBoundingClientRect();
      done({x: 0, y: 0, width: Math.ceil(r.right), height: Math.ceil(r.bottom)});
    })))`);
    const directory = path.resolve('dist-electron/captures-049');
    fs.mkdirSync(directory, {recursive: true});
    fs.writeFileSync(path.join(directory, mode + '.png'), (await win.webContents.capturePage(rect)).toPNG());
  }
  await until(() => read("Boolean(document.querySelector('.library-name')?.textContent)"), 'Chargement');
  await click('.navigation-home');
  await until(async () => (await names()).length > 0, 'Racines');
  await click('.expand-all-folders');
  const submenu = Menu.getApplicationMenu().items.find(i => i.label === 'Affichage').submenu
    .items.find(i => i.label === 'Ordre de l’explorateur').submenu;
  assert.deepEqual(submenu.items.map(i => [i.label, i.type]), [['Manuel', 'radio'], ['Alphabétique', 'radio']]);
  if (phase === 'restart') {
    await order('alphabetical');
    assert.equal(await stored(), 'alphabetical');
    assert.deepEqual(await names(), ['abricot', 'Brume', 'Lot 2', 'Lot 10', 'Églantine']);
    win.webContents.send('library:menu-action', {action: 'known', path: second});
    await until(async () => (await names()).join() === 'Alpha,Zulu', 'Seconde bibliothèque triée');
    await order('alphabetical');
    await read('localStorage.setItem(' + JSON.stringify(key) + ', "inconnu")');
    return;
  }
  await order('manual');
  if (phase === 'invalid') {
    assert.equal(await stored(), 'inconnu');
    assert.deepEqual(await names(), ['Zulu', 'Alpha']);
    return;
  }
  assert.equal(await stored(), null);
  assert.deepEqual(await names(), manual);
  if (await read("document.querySelector('[aria-label=\"Déplier Non classés\"]') !== null")) {
    await click(unfiled + ' .folder-toggle-button');
  }
  const initialDocs = [...titles].reverse();
  const sortedDocs = ['Carnet 2', 'Carnet 10', 'ÉCHO', 'écho'];
  assert.deepEqual(await docs(rootDocs), initialDocs);
  assert.deepEqual(await docs(unfiled), initialDocs);
  await click(rootDocs + ' .tree-document-button');
  await until(() => read("document.querySelector('.title-input')?.value === 'Carnet 10'"), 'Document actif');
  const sqlite = new (require('better-sqlite3'))(first, {readonly: true});
  try {
    const positions = () => sqlite.prepare('SELECT id, parent_id, position FROM folders ORDER BY id').all();
    const version = () => sqlite.pragma('data_version', {simple: true});
    const original = positions();
    const before = version();
    await capture('manuel');
    await choose('alphabetical');
    assert.deepEqual(await names(), alphabetical);
    assert.deepEqual(await docs(rootDocs), sortedDocs);
    assert.deepEqual(await docs(unfiled), sortedDocs);
    await capture('alphabetique');
    assert.equal(await read("document.querySelector('.tree-document-button.selected .tree-document-title').textContent"), 'Carnet 10');
    await click('.collapse-all-folders');
    await choose('manual');
    assert.deepEqual(await names(), ['Zéphyr', 'Églantine', 'abricot']);
    await click('.expand-all-folders');
    assert.deepEqual(await names(), manual);
    assert.deepEqual(await docs(rootDocs), initialDocs);
    assert.deepEqual(await docs(unfiled), initialDocs);
    assert.equal(await read("Boolean(document.querySelector('.title-dirty-marker'))"), false);
    assert.deepEqual(positions(), original);
    assert.equal(version(), before, 'Une connexion a écrit dans SQLite pendant le changement d’ordre');
  } finally { sqlite.close(); }
  item('theme-dark').click();
  await until(() => read("document.documentElement.dataset.theme === 'dark'"), 'Thème sombre');
  await choose('alphabetical');
  assert.deepEqual(await names(), alphabetical);
  // Rename using the existing editor and inline folder control.
  async function input(selector, value) {
    await read(`(() => {
      const field = document.querySelector(${JSON.stringify(selector)});
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(value)});
      field.dispatchEvent(new Event('input', {bubbles:true}));
    })()`);
  }
  await input('.title-input', 'Zinnia');
  await click('[title="Sauvegarder - Ctrl+S"]');
  await until(async () => (await docs(rootDocs)).at(-1) === 'Zinnia', 'Titre renommé');
  await read(`[...document.querySelectorAll('.folder-button')].find(e => e.querySelector('.folder-label').textContent === 'Zéphyr')
    .dispatchEvent(new MouseEvent('dblclick', {bubbles:true}))`);
  await input('.folder-name-input', 'Brume');
  await read("document.querySelector('.folder-name-input').blur()");
  await until(async () => (await names()).join() === 'abricot,Brume,Lot 2,Lot 10,Églantine', 'Dossier renommé');
}

async function fixture(phase) {
  const { app } = require('electron');
  const first = process.env.TEXTOTHEQUE_DB_PATH;
  const temp = path.dirname(first);
  const second = path.join(temp, 'seconde.sqlite');
  app.setPath('appData', temp);
  if (phase === 'first') await seed(first, second);
  app.once('browser-window-created', (_, win) => {
    win.webContents.once('did-finish-load', async () => {
      try {
        await check(win, phase, first, second);
        console.log('Ordre explorateur OK — ' + phase);
        win.close();
      } catch (error) { console.error(error); app.exit(1); }
    });
  });
  await import('../dist-electron/main.js');
}

const index = process.argv.indexOf('--fixture');
(index >= 0 ? fixture(process.argv[index + 1]) : runPreferenceSessions(__filename, 'explorer-order'))
  .catch(error => { console.error(error); process.exitCode = 1; });
