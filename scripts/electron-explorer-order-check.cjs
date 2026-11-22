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
  async function capture(mode, mission = '049') {
    if (!process.argv.includes('--captures')) return;
    const rect = await read(`new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => {
      const r = document.querySelector('.navigation-pane').getBoundingClientRect();
      done({x: 0, y: 0, width: Math.ceil(r.right), height: Math.ceil(r.bottom)});
    })))`);
    const directory = path.resolve('dist-electron', 'captures-' + mission);
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
  // Use Chromium mouse/key events in the real window for both rename gestures.
  const menuItem = '.folder-context-menu [role="menuitem"]';
  const field = '.folder-name-input';
  const exists = selector => read('Boolean(document.querySelector(' + JSON.stringify(selector) + '))');
  async function mouse(element, button = 'left', count = 1) {
    const point = await read(`(() => {
      const el = ${element};
      el.scrollIntoView({block:'nearest'});
      const r = el.getBoundingClientRect();
      return {x: Math.floor(r.left + r.width / 2), y: Math.floor(r.top + r.height / 2)};
    })()`);
    for (let clickCount = 1; clickCount <= count; clickCount++) {
      for (const type of ['mouseDown', 'mouseUp']) win.webContents.sendInputEvent({type, button, clickCount, ...point});
    }
  }
  function keyPress(keyCode) {
    win.webContents.sendInputEvent({type: 'keyDown', keyCode});
    if (keyCode === 'Return') win.webContents.sendInputEvent({type: 'char', keyCode: '\r'});
    win.webContents.sendInputEvent({type: 'keyUp', keyCode});
  }
  const folderButton = name => `[...document.querySelectorAll('.folder-row .folder-button')].find(
    e => e.querySelector('.folder-label').textContent === ${JSON.stringify(name)})`;
  async function openMenu(name) {
    await mouse(folderButton(name), 'right');
    await until(() => exists(menuItem), 'Menu contextuel');
    assert.equal(await read('document.activeElement.textContent'), 'Renommer');
    assert.equal(await exists(field), false);
  }
  const positions = () => read('window.textotheque.listFolders().then(rows => rows.map(f => [f.id, f.parent_id, f.position]))');
  const beforeRename = await positions();
  const treeState = () => read(`[document.querySelector('.tree-document-button.selected')?.textContent,
    ...[...document.querySelectorAll('.folder-row .folder-toggle-button')].map(e => e.title)]`);
  const originalTree = await treeState();
  assert.equal(await exists('.folder-rename-button'), false);
  assert.equal(await read(`[...document.querySelectorAll('.folder-row .folder-button')].every(e =>
    Math.abs(e.getBoundingClientRect().right - e.parentElement.getBoundingClientRect().right) < 1)`), true);
  await openMenu('Églantine');
  await capture('manuel-clair', '050');
  keyPress('Escape');
  await until(async () => !await exists(menuItem), 'Fermeture par Échap');
  await openMenu('Églantine');
  await mouse("document.querySelector('.folder-section-header > span')");
  await until(async () => !await exists(menuItem), 'Fermeture par clic ailleurs');
  assert.deepEqual(await treeState(), originalTree);
  assert.equal(await exists('.title-dirty-marker'), false);
  const draft = 'Brouillon fictif conservé pendant le renommage.';
  await read(`(() => {
    const e = document.querySelector('.content-editor');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(e, ${JSON.stringify(draft)});
    e.dispatchEvent(new Event('input', {bubbles:true}));
  })()`);
  await until(() => exists('.title-dirty-marker'), 'Brouillon modifié');
  await openMenu('Églantine');
  await mouse("document.querySelector('.folder-context-menu button')");
  await until(() => exists(field), 'Éditeur inline par menu');
  await input(field, 'Branche');
  keyPress('Return');
  await until(async () => (await names()).includes('Branche'), 'Renommage manuel validé par Entrée');
  assert.deepEqual(await names(), manual.map(n => n === 'Églantine' ? 'Branche' : n));
  assert.equal(await read("document.querySelector('.content-editor').value"), draft);
  await click('[title="Sauvegarder - Ctrl+S"]');
  await until(async () => !await exists('.title-dirty-marker'), 'Sauvegarde du brouillon');
  assert.equal(await read("window.textotheque.listDocuments().then(rows => rows.find(d => d.title === 'Carnet 10' && d.folder_id !== null).content)"), draft);

  await mouse(folderButton('Branche'), 'left', 2);
  await until(() => exists(field), 'Double clic');
  await input(field, 'Annulé');
  keyPress('Escape');
  await until(async () => !await exists(field), 'Annulation inline');
  assert.ok((await names()).includes('Branche'));
  await mouse(folderButton('Branche'), 'left', 2);
  await until(() => exists(field), 'Double clic après annulation');
  await input(field, 'Églantine');
  await mouse("document.querySelector('.folder-section-header > span')");
  await until(async () => (await names()).includes('Églantine'), 'Validation par perte de focus');
  await click(rootDocs + ' .tree-document-button');
  await until(() => read("document.querySelector('.title-input')?.value === 'Carnet 10'"), 'Retour au texte');
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
  await openMenu('Zéphyr');
  await capture('alphabetique-sombre', '050');
  keyPress('Return');
  await until(() => exists(field), 'Commande clavier en sombre');
  await input('.folder-name-input', 'Brume');
  await read("document.querySelector('.folder-name-input').blur()");
  await until(async () => (await names()).join() === 'abricot,Brume,Lot 2,Lot 10,Églantine', 'Dossier renommé');
  assert.deepEqual(await positions(), beforeRename);

  const menuLabels = () => read("[...document.querySelectorAll('.folder-context-menu button')].map(e => e.textContent)");
  const menuAction = label => read(`[...document.querySelectorAll('.folder-context-menu button')].find(e => e.textContent === ${JSON.stringify(label)}).click()`);
  async function editState(enabled) {
    const actions = ['rename', 'trash', 'delete-folder', 'restore'];
    await until(() => actions.every(action => item('edit-' + action)?.enabled === enabled.includes(action)), 'Édition ' + enabled);
  }
  const titleSelected = () => read(`(() => { const e = document.activeElement;
    return e.matches('.title-input') && e.selectionStart === 0 && e.selectionEnd === e.value.length; })()`);
  await click(unfiled + ' .tree-document-button');
  await editState(['rename', 'trash']);
  assert.equal(await exists(unfiled + ' .tree-document-button.selected'), true);
  assert.equal(await exists(unfiled + ' .folder-button.selected'), false);
  await read(folderButton('Brume') + '.click()');
  await editState(['rename', 'delete-folder']);
  assert.equal(await exists('.folder-row .folder-button.selected'), true);
  assert.equal(await exists('.tree-document-button.selected'), false);
  item('edit-rename').click();
  await until(() => exists(field), 'Renommer dossier via Édition');
  keyPress('Escape');
  await until(async () => !await exists(field), 'Annulation');
  item('edit-delete-folder').click();
  await until(() => read("document.querySelector('.error-message')?.textContent.includes('doit être vide')"), 'Refus dossier occupé');
  assert.equal(await exists('.confirm-dialog'), false);

  const doc = rootDocs + ' .tree-document-button';
  await click(doc);
  await editState(['rename', 'trash']);
  assert.equal(await exists('.folder-row .folder-button.selected'), false);
  assert.equal(await exists('.tree-document-button.selected'), true);
  const otherDoc = `document.querySelectorAll(${JSON.stringify(doc)})[1]`;
  const otherTitle = await read(otherDoc + ".querySelector('.tree-document-title').textContent");
  await mouse(otherDoc, 'right');
  await until(() => exists(menuItem), 'Menu document');
  assert.deepEqual(await menuLabels(), ['Renommer', 'Mettre à la corbeille']);
  await menuAction('Renommer');
  await until(titleSelected, 'Titre sélectionné par menu contextuel');
  assert.equal(await read("document.querySelector('.title-input').value"), otherTitle);
  await click('.content-editor');
  item('edit-rename').click();
  await until(titleSelected, 'Titre sélectionné par Édition');
  const title = await read("document.querySelector('.title-input').value");
  await mouse(otherDoc, 'right');
  await until(() => exists(menuItem), 'Menu document pour corbeille');
  await menuAction('Mettre à la corbeille');
  await until(() => exists('.confirm-dialog .danger-button'), 'Confirmation corbeille');
  await click('.confirm-dialog .danger-button');
  await until(() => read(`window.textotheque.listDeletedDocuments().then(d => d.some(t => t.title === ${JSON.stringify(title)}))`), 'Document en corbeille');
  await click('.nav-view-button:last-child');
  await editState(['restore']);
  await mouse("document.querySelector('.document-item')", 'right');
  await until(() => exists(menuItem), 'Menu document supprimé');
  assert.deepEqual(await menuLabels(), ['Restaurer']);
  await menuAction('Restaurer');
  await until(() => read("window.textotheque.listDeletedDocuments().then(d => d.length === 0)"), 'Document restauré');
  await click('.nav-view-button:first-child');
  await editState([]);
  await click('.navigation-home');
  await until(() => exists('.folder-section-header'), 'Navigation');
  await click('[title="Nouveau dossier racine"]');
  await editState(['rename', 'delete-folder']);
  await click('[title="Nouveau document - Ctrl+N"]');
  await editState(['rename', 'trash']);
  async function refuseOccupiedFolder() {
    await openMenu('Nouveau dossier');
    await menuAction('Supprimer');
    await until(() => read("document.querySelector('.error-message')?.textContent.includes('doit être vide')"), 'Refus de suppression');
    assert.equal(await exists('.confirm-dialog'), false);
  }
  await refuseOccupiedFolder();
  await click('.trash-button');
  await until(() => exists('.confirm-dialog .danger-button'), 'Corbeille depuis l’éditeur');
  await click('.confirm-dialog .danger-button');
  await until(() => read("document.querySelector('.trash-button') === null"), 'Éditeur vide');
  await refuseOccupiedFolder();
  await click('.nav-view-button:last-child');
  await editState(['restore']);
  await click('.empty-trash-button');
  await until(() => exists('.confirm-dialog .danger-button'), 'Confirmation de vidage');
  await click('.confirm-dialog .danger-button');
  await until(() => read("document.querySelector('.empty-trash-button').disabled"), 'Corbeille vidée');
  await click('.navigation-home');
  await until(() => exists('.folder-row'), 'Retour aux dossiers');
  await read(folderButton('Nouveau dossier') + '.click()');
  await editState(['rename', 'delete-folder']);
  await openMenu('Nouveau dossier');
  assert.deepEqual(await menuLabels(), ['Renommer', 'Supprimer']);
  await menuAction('Supprimer');
  await until(() => exists('.confirm-dialog .secondary-button'), 'Confirmation dossier');
  await click('.confirm-dialog .secondary-button');
  assert.ok((await names()).includes('Nouveau dossier'));
  await editState(['rename', 'delete-folder']);
  item('edit-delete-folder').click();
  await until(() => exists('.confirm-dialog .danger-button'), 'Confirmation via Édition');
  await click('.confirm-dialog .danger-button');
  await until(async () => !(await names()).includes('Nouveau dossier'), 'Suppression dans l’arbre');
  assert.equal(await read("window.textotheque.listFolders().then(f => f.some(d => d.name === 'Nouveau dossier'))"), false);
  await editState([]);
  await click('.todo-toolbar-button');
  await editState(['rename']);
  await mouse("document.querySelector('.document-item.selected')", 'right');
  await until(() => exists(menuItem), 'Menu TODO');
  assert.deepEqual(await menuLabels(), ['Renommer']);
  keyPress('Escape');
  console.log('057 OK — sélection, menus contextuels et natifs, corbeille, restauration, TODO et suppression confirmée.');
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
