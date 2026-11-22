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
  assert.equal(toggle.accelerator, 'CommandOrControl+Shift+U');
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
  const star = glyph => click('.character-star[aria-label="Favori ' + glyph + '"]');
  const glyphs = () => read("[...document.querySelectorAll('.character-tile')].map(b => b.textContent)");
  const location = () => read(`(() => { const {x,y} = ${panel}.getBoundingClientRect(); return {x,y}; })()`);
  async function dragTo(x,y) {
    const point = await read(`(() => { const r = ${panel}.querySelector('header strong').getBoundingClientRect();
      return {x:Math.round(r.left+5), y:Math.round(r.top+5)}; })()`);
    const start = await location();

    const [width,height] = await read('[innerWidth,innerHeight]');
    const end = {x:Math.min(width-1, Math.round(point.x+x-start.x)), y:Math.min(height-1, Math.round(point.y+y-start.y))};
    const driver = win.webContents.debugger;
    driver.attach();
    try {
      await driver.sendCommand('Input.dispatchMouseEvent', {type:'mousePressed', button:'left', buttons:1, clickCount:1, ...point});
      await driver.sendCommand('Input.dispatchMouseEvent', {type:'mouseMoved', buttons:1, ...end});
      await driver.sendCommand('Input.dispatchMouseEvent', {type:'mouseReleased', button:'left', clickCount:1, ...end});
    } finally { driver.detach(); }
    await wait(`JSON.parse(localStorage.getItem('${key}')).position?.x === ${panel}.getBoundingClientRect().x`);
  }
  assert.equal(await read("document.querySelector('.character-controls select').value"), 'Mes caractères');
  assert.ok(!await read(panel + ".innerText.includes('Organiser')"));
  if (phase === 'invalid') {
    assert.deepEqual(await prefs(), {favorites:initial, personal:[], recent:[]});
    const empty = path.join(path.dirname(process.env.TEXTOTHEQUE_DB_PATH), 'empty.sqlite');
    const {createNewTextothequeDatabase} = await import('../dist-electron/database.js');
    createNewTextothequeDatabase(empty).close();
    win.webContents.send('library:menu-action', {action:'known', path:empty});
    await wait("document.querySelector('.library-name')?.textContent.includes('empty.sqlite')");
    assert.ok(await read("!document.querySelector('.content-editor') && document.querySelector('.character-tile').disabled"));
    await star('🐸');
    assert.deepEqual((await prefs()).favorites, initial.slice(0, -1));
    return;
  }
  if (phase === 'restart') {
    const p = await prefs();
    assert.deepEqual(await location(), p.position);
    assert.ok(await read(`Math.abs(${panel}.offsetLeft-48)<=1 && Math.abs(${panel}.offsetTop-60)<=1`));
    assert.deepEqual(p.personal, [composed]);
    assert.ok(p.favorites.includes(composed));
    assert.equal(p.recent.length, 12);
    assert.equal(p.recent[0], '—');
    const before = await read('window.textotheque.getDocument(1)');
    await category('Mes caractères');
    await click('.character-remove');
    assert.deepEqual((await prefs()).personal, []);
    assert.deepEqual((await prefs()).favorites, initial);
    assert.deepEqual(await read('window.textotheque.getDocument(1)'), before);
    await read("localStorage.setItem('textotheque:special-characters:v1', '{')");
    return;
  }

  const allInitial = await glyphs();
  assert.deepEqual(allInitial.slice(0,11), initial);
  assert.equal(allInitial.length, new Set(allInitial).size);
  assert.deepEqual((await prefs()).favorites, initial);
  toggle.click();
  await wait('!' + panel);
  const legacy = {favorites:['🦊','🧠'], personal:['🦊','→'], recent:['→','🦊']};
  await read(`localStorage.setItem('${key}', ${JSON.stringify(JSON.stringify(legacy))})`);
  function shortcut() {
    for (const type of ['keyDown','keyUp']) win.webContents.sendInputEvent({type,keyCode:'U',modifiers:['control','shift']});
  }
  win.focus();
  shortcut();
  await wait(panel);
  assert.deepEqual(await prefs(), legacy);
  assert.deepEqual(new Set(await glyphs()), new Set([...allInitial,'🦊']));
  assert.equal((await glyphs()).length, allInitial.length+1);
  await click('.character-remove[aria-label="Supprimer →"]');
  assert.ok((await glyphs()).includes('→'));
  assert.equal(await read("document.querySelectorAll('.character-remove').length"), 1);
  shortcut();
  await wait('!' + panel);
  await read(`localStorage.removeItem('${key}')`);
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
    assert.deepEqual(await glyphs(), [composed, ...allInitial]);
    assert.deepEqual((await prefs()).favorites, initial);
    await star(composed);
    await category('Favoris');
    await star(composed);
    assert.ok(!(await glyphs()).includes(composed));
    await category('Mes caractères');
    assert.ok((await glyphs()).includes(composed));
    await star(composed);
    assert.equal(observer.pragma('data_version', {simple:true}), before);
  } finally { observer.close(); }

  await click('.nav-view-button');
  await wait("document.querySelector('.catalog-row')");
  assert.ok(await read("document.querySelector('.character-tile').disabled"));
  await click('.catalog-row');
  const editor = "document.querySelector('.content-editor')";
  await wait(editor + "?.value === 'abcdef'");
  await read(editor + ".focus(); " + editor + ".setSelectionRange(2,2)");
  await star('→'); await star('→');
  await dragTo(2000,2000);
  const inBounds = `(() => {const r=${panel}.getBoundingClientRect();return r.x>=0 && r.y>=0 && r.right<=innerWidth+1 && r.bottom<=innerHeight+1})()`;
  assert.ok(await read(inBounds));
  const size = win.getSize();
  win.setSize(1000,660);
  await wait("innerWidth <= 1000");
  await wait(inBounds);
  win.setSize(...size);
  await dragTo(48,60);
  assert.deepEqual(await location(), (await prefs()).position);
  assert.ok(await read(`Math.abs(${panel}.offsetLeft-48)<=1 && Math.abs(${panel}.offsetTop-60)<=1`));
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
  assert.deepEqual(allInitial, [...new Set([...initial, ...Object.values(lists).flatMap(list => list.split(' '))])]);
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
