const assert = require('node:assert/strict');
const path = require('node:path');
const {runPreferenceSessions} = require('./preference-test-sessions.cjs');

async function checkPalette(win, phase) {
  const {Menu} = require('electron');
  const read = code => win.webContents.executeJavaScript(code);
  async function wait(code) {
    for (let i = 0; i < 200; i++) {
      if (await read(code)) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw Error(code);
  }
  await wait("document.querySelector('.library-name')");
  const tools = Menu.getApplicationMenu().items.find(item => item.label === 'Outils');
  const toggle = tools.submenu.items.find(item => item.label === 'Caractères spéciaux…');
  const panel = "document.querySelector('.character-palette')";
  toggle.click();
  await wait(panel);
  const key = 'textotheque:special-characters:v1';
  const prefs = () => read('JSON.parse(localStorage.getItem(' + JSON.stringify(key) + '))');
  const initial = '😂 🤣 🚀 💙 🧠 🗃️ 💝 🪄 🧶 📦 🐸'.split(' ');
  const composed = '👩🏽‍🚀';
  const click = selector => read('document.querySelector(' + JSON.stringify(selector) + ').click()');
  const category = name => read(`(() => {
    const select = document.querySelector('.character-controls select');
    select.value = ${JSON.stringify(name)};
    select.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  const tile = glyph => read(`(() => {
    const b = [...document.querySelectorAll('.character-tile')].find(b => b.textContent === ${JSON.stringify(glyph)});
    b.focus(); b.click();
  })()`);
  const manage = () => click('.character-controls button');
  const glyphs = () => read("[...document.querySelectorAll('.character-tile')].map(b => b.textContent)");
  if (phase === 'invalid') {
    assert.deepEqual(await prefs(), {favorites:initial, personal:[], recent:[]});
    const empty = path.join(path.dirname(process.env.TEXTOTHEQUE_DB_PATH), 'empty.sqlite');
    const {createNewTextothequeDatabase} = await import('../dist-electron/database.js');
    createNewTextothequeDatabase(empty).close();
    win.webContents.send('library:menu-action', {action:'known', path:empty});
    await wait("document.querySelector('.library-name')?.textContent.includes('empty.sqlite')");
    assert.ok(await read("!document.querySelector('.content-editor') && document.querySelector('.character-tile').disabled"));
    await manage(); await tile('🐸');
    assert.deepEqual((await prefs()).favorites, initial.slice(0, -1));
    return;
  }
  if (phase === 'restart') {
    const p = await prefs();
    assert.deepEqual(p.personal, [composed]);
    assert.ok(p.favorites.includes(composed));
    assert.equal(p.recent.length, 12);
    assert.equal(p.recent[0], '—');
    const before = await read('window.textotheque.getDocument(1)');
    await category('Mes caractères');
    await manage();
    await click('.character-remove');
    assert.deepEqual((await prefs()).personal, []);
    assert.deepEqual((await prefs()).favorites, initial);
    assert.deepEqual(await read('window.textotheque.getDocument(1)'), before);
    await read("localStorage.setItem('textotheque:special-characters:v1', '{')");
    return;
  }

  assert.deepEqual(await glyphs(), initial);
  toggle.click();
  await wait('!' + panel);
  toggle.click();
  await wait(panel);
  const color = () => read('getComputedStyle(' + panel + ').backgroundColor');
  const light = await color();
  Menu.getApplicationMenu().getMenuItemById('theme-dark').click();
  await wait("document.documentElement.dataset.theme === 'dark'");
  assert.notEqual(await color(), light);

  const observer = new (require('better-sqlite3'))(process.env.TEXTOTHEQUE_DB_PATH, {readonly:true});
  try {
    const before = observer.pragma('data_version', {simple:true});
    await click('.character-palette > button');
    const type = text => read(`(() => {
      const input = document.querySelector('.character-palette input');
      input.focus(); input.select(); document.execCommand('insertText', false, ${JSON.stringify(text)});
    })()`);
    assert.ok(await read("document.querySelector('.character-palette [type=submit]').disabled"));
    await type('ab');
    assert.ok(await read("document.querySelector('.character-palette [type=submit]').disabled"));
    await type(composed);
    await click('.character-palette [type=submit]');
    assert.deepEqual(await glyphs(), [composed]);
    await manage(); await tile(composed); await manage();
    assert.equal(observer.pragma('data_version', {simple:true}), before);
  } finally { observer.close(); }

  await click('.nav-view-button');
  await wait("document.querySelector('.catalog-row')");
  assert.ok(await read("document.querySelector('.character-tile').disabled"));
  await click('.catalog-row');
  const editor = "document.querySelector('.content-editor')";
  await wait(editor + "?.value === 'abcdef'");
  await read(editor + ".focus(); " + editor + ".setSelectionRange(2,2)");
  await tile(composed);
  await wait(editor + ".value === 'ab👩🏽‍🚀cdef'");
  assert.equal(await read(editor + '.selectionStart'), 2 + composed.length);
  assert.ok(await read('document.activeElement === ' + editor));
  await category('Favoris');
  await read(editor + ".setSelectionRange(1, " + (2 + composed.length) + ", 'backward')");
  await tile('🐸');
  await wait(editor + ".value === 'a🐸cdef'");
  assert.deepEqual(await read('[' + editor + '.selectionStart,' + editor + '.selectionEnd]'), [3,3]);
  assert.ok(await read("document.querySelector('.title-dirty-marker') !== null"));
  await wait("(async () => (await window.textotheque.getDocument(1)).content === 'a🐸cdef')()");
  const doc = await read('window.textotheque.getDocument(1)');
  assert.equal(doc.title, 'Fixture');
  assert.equal(doc.notes, 'Notes fictives');
  const lists = {
    Typographie:'— – … « » “ ” ‘ ’ ° №', Flèches:'← → ↑ ↓ ↔ ↕ ⇒ ⇐ ⇔',
    'Symboles pratiques':'✓ ✔ ✗ ✘ ★ ☆ ♥ ♡ ⚠ ⚙ ⌛ ⏱',
    'Marqueurs visuels':'• ◦ ▪ ▫ ◆ ◇ ○ ● □ ■', 'Maths / technique':'± × ÷ ≠ ≤ ≥ ≈ ∞',
  };
  for (const [name, list] of Object.entries(lists)) {
    await category(name); assert.deepEqual(await glyphs(), list.split(' '));
  }
  await category('Typographie');
  for (const glyph of lists.Typographie.split(' ')) await tile(glyph);
  await tile('—');
  const expected = ['—', ...lists.Typographie.split(' ').slice(1).reverse(), '🐸'];
  await category('Récents'); assert.deepEqual(await glyphs(), expected);
  await read(editor + ".focus(); document.execCommand('insertText',false,'Z')");
  assert.deepEqual((await prefs()).recent, expected);
  await wait("!document.querySelector('.title-dirty-marker')");
  await click('.nav-view-button:nth-child(2)');
  await wait(editor + '?.disabled');
  assert.ok(await read("document.querySelector('.character-tile').disabled"));
  await tile('—');
  assert.deepEqual((await prefs()).recent, expected);
  await read("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
  await wait('!' + panel);
}

async function runWindow(phase) {
  const {app} = require('electron');
  app.setPath('appData', path.dirname(process.env.TEXTOTHEQUE_DB_PATH));
  if (phase === 'first') {
    const {createNewTextothequeDatabase} = await import('../dist-electron/database.js');
    const db = createNewTextothequeDatabase(process.env.TEXTOTHEQUE_DB_PATH);
    try {
      for (const title of ['Fixture', 'Supprimé']) {
        const doc = db.createDocument();
        db.updateDocument(doc.id, {title, content:'abcdef', notes:'Notes fictives', status:'draft', favorite:false, folder_id:null});
        if (title === 'Supprimé') db.trashDocument(doc.id);
      }
    } finally { db.close(); }
  }
  app.once('browser-window-created', (_, win) => {
    win.webContents.once('did-finish-load', async () => {
      try {
        await checkPalette(win, phase);
        console.log('Palette OK', phase);
        win.close();
      } catch (error) { console.error(error); app.exit(1); }
    });
  });
  await import('../dist-electron/main.js');
}

const fixture = process.argv.indexOf('--fixture');
(fixture < 0 ? runPreferenceSessions(__filename, 'characters') : runWindow(process.argv[fixture + 1]))
  .catch(error => { console.error(error); process.exitCode = 1; });
