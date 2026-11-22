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
  const item = "document.querySelector('.character-context-menu [role=menuitem]')";
  async function context(glyph) {
    await read(`[...document.querySelectorAll('.character-tile')].find(b => b.textContent === ${JSON.stringify(glyph)})
      .dispatchEvent(new MouseEvent('contextmenu',{button:2,bubbles:true,cancelable:true,clientX:innerWidth-1,clientY:innerHeight-1}))`);
    await wait(item);
    assert.ok(await read(`(() => { const r = ${item}.parentElement.getBoundingClientRect();
      return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })()`));
  }
  async function favorite(glyph) {
    const remove = (await prefs()).favorites.includes(glyph);
    await context(glyph);
    assert.equal(await read(item + '.textContent'), remove ? 'Retirer des favoris' : 'Ajouter aux favoris');
    await read(item + '.click()');
    await wait('!' + item);
  }
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
    assert.deepEqual(await prefs(), {favorites:[], personal:[], recent:[], manualFavorites:true});
    const empty = path.join(path.dirname(process.env.TEXTOTHEQUE_DB_PATH), 'empty.sqlite');
    const {createNewTextothequeDatabase} = await import('../dist-electron/database.js');
    createNewTextothequeDatabase(empty).close();
    win.webContents.send('library:menu-action', {action:'known', path:empty});
    await wait("document.querySelector('.library-name')?.textContent.includes('empty.sqlite')");
    assert.ok(await read("!document.querySelector('.content-editor') && document.querySelector('.character-tile').ariaDisabled === 'true'"));
    await favorite('🐸');
    assert.deepEqual((await prefs()).favorites, ['🐸']);
    toggle.click();
    await wait('!' + panel);
    assert.equal(await read("document.activeElement.matches('.content-editor')"), false);
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
    assert.deepEqual((await prefs()).favorites, ['🐸']);
    assert.deepEqual(await read('window.textotheque.getDocument(1)'), before);
    await read("localStorage.setItem('textotheque:special-characters:v1', '{')");
    return;
  }

  const allInitial = await glyphs();
  assert.deepEqual(allInitial, initial);
  assert.equal(await read("document.querySelectorAll('.character-star, .character-grid [aria-pressed]').length"), 0);
  assert.equal(allInitial.length, new Set(allInitial).size);
  assert.deepEqual((await prefs()).favorites, []);
  toggle.click();
  await wait('!' + panel);
  const legacy = {favorites:['🦊','🧠'], personal:['🦊','→'], recent:['→','🦊'], position:{x:39,y:41}};
  await read(`localStorage.setItem('${key}', ${JSON.stringify(JSON.stringify({...legacy, favorites:initial}))})`);
  toggle.click(); await wait(panel);
  assert.deepEqual(await prefs(), {...legacy, favorites:[], manualFavorites:true});
  for (const glyph of initial) await favorite(glyph);
  toggle.click(); await wait('!' + panel);
  toggle.click(); await wait(panel);
  assert.deepEqual((await prefs()).favorites, initial);
  toggle.click(); await wait('!' + panel);
  await read(`localStorage.setItem('${key}', ${JSON.stringify(JSON.stringify(legacy))})`);
  function shortcut() {
    for (const type of ['keyDown','keyUp']) win.webContents.sendInputEvent({type,keyCode:'U',modifiers:['control','shift']});
  }
  win.focus();
  shortcut();
  await wait(panel);
  assert.deepEqual(await prefs(), {...legacy, manualFavorites:true});
  assert.deepEqual(new Set(await glyphs()), new Set([...allInitial,'🦊','→']));
  assert.equal((await glyphs()).length, allInitial.length+2);
  await click('.character-remove[aria-label="Supprimer →"]');
  assert.ok(!(await glyphs()).includes('→'));
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
    assert.deepEqual((await prefs()).favorites, []);
    await favorite(composed);
    await category('Favoris');
    await favorite(composed);
    assert.ok(!(await glyphs()).includes(composed));
    await category('Mes caractères');
    assert.ok((await glyphs()).includes(composed));
    await favorite(composed);
    assert.equal(observer.pragma('data_version', {simple:true}), before);
  } finally { observer.close(); }

  await click('.nav-view-button');
  await wait("document.querySelector('.catalog-row')");
  assert.ok(await read("document.querySelector('.character-tile').ariaDisabled === 'true'"));
  toggle.click(); await wait('!' + panel);
  assert.equal(await read("document.activeElement.matches('.content-editor')"), false);
  toggle.click(); await wait(panel);
  await click('.catalog-row');
  const editor = "document.querySelector('.content-editor')";
  await wait(editor + "?.value === 'abcdef'");
  await read(editor + ".focus(); " + editor + ".setSelectionRange(2,2)");
  const point = await read(`(() => {
    const r = document.querySelector('.character-tile[title^="🐸"]').getBoundingClientRect();
    return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)};
  })()`);
  for (const type of ['mouseDown','mouseUp']) win.webContents.sendInputEvent({type, button:'right', clickCount:1, ...point});
  await wait(item);
  for (const type of ['keyDown','keyUp']) win.webContents.sendInputEvent({type, keyCode:'Escape'});
  await wait('!' + item);
  assert.ok(await read(panel + '.contains(document.activeElement)'));
  await context('🐸');
  await read("document.querySelector('.character-controls').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
  await wait('!' + item);
  await category('Flèches');
  await favorite('→'); await favorite('→');
  await category('Mes caractères');
  await favorite('🐸');
  assert.deepEqual(await read(`[${editor}.value,${editor}.selectionStart,${editor}.selectionEnd]`), ['abcdef',2,2]);
  assert.deepEqual((await prefs()).recent, []);
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
  await category('Typographie');
  for (const glyph of lists.Typographie.split(' ')) await tile(glyph);
  await tile('—');
  const expected = ['—', ...lists.Typographie.split(' ').slice(1).reverse(), '🐸'];
  await category('Récents'); assert.deepEqual(await glyphs(), expected);
  await favorite('—');
  await category('Mes caractères'); assert.ok(!(await glyphs()).includes('—'));
  await category('Récents'); await favorite('—');
  await read(editor + ".focus(); document.execCommand('insertText',false,'Z')");
  assert.deepEqual((await prefs()).recent, expected);
  await wait("!document.querySelector('.title-dirty-marker')");
  toggle.click();
  await wait('!' + panel);
  const text = ('Une ligne fictive. '.repeat(25) + '\n').repeat(100);
  await read(`${editor}.focus(); ${editor}.select(); document.execCommand('insertText',false,${JSON.stringify(text)})`);
  await wait(`(async () => (await window.textotheque.getDocument(1)).content === ${JSON.stringify(text)})()`);
  const snapshot = () => read(`(() => {const e=${editor}; return [
    e.selectionStart,e.selectionEnd,e.selectionDirection,e.scrollTop,e.scrollLeft,e.value
  ];})()`);
  const reader = new (require('better-sqlite3'))(process.env.TEXTOTHEQUE_DB_PATH, {readonly:true});
  try {
    const revision = reader.pragma('data_version', {simple:true});
    for (const [close, start, end, direction] of [
      ['cross', 19, 19, 'none'], ['shortcut', 37, 37, 'none'],
      ['menu', 8, 27, 'forward'], ['escape', 12, 20, 'backward'],
    ]) {
      // A long unwrapped fixture exercises both scroll axes independently of the selection.
      await read(`(() => {const e=${editor}; e.style.whiteSpace='pre'; e.focus();
        e.setSelectionRange(${start},${end},'${direction}'); e.scrollTop=170; e.scrollLeft=70;})()`);
      const before = await snapshot();
      assert.ok(before[3] > 0 && before[4] > 0);
      if (close === 'shortcut') shortcut(); else toggle.click();
      await wait(panel);
      if (close === 'cross') {
        await click('.character-palette > button');
        await wait("document.activeElement.matches('.character-palette input')");
        await click('.character-palette header button');
      } else if (close === 'menu') {
        await context('🐸');
        toggle.click();
      } else if (close === 'shortcut') shortcut();
      else {
        await category('Flèches');
        for (const type of ['keyDown','keyUp']) win.webContents.sendInputEvent({type, keyCode:'Escape'});
      }
      await wait('!' + panel);
      assert.ok(await read('document.activeElement === ' + editor), close);
      assert.deepEqual(await snapshot(), before, close);
      assert.ok(!await read("Boolean(document.querySelector('.title-dirty-marker'))"), close);
    }
    await new Promise(resolve => setTimeout(resolve, 1750));
    assert.equal(reader.pragma('data_version', {simple:true}), revision);
  } finally { reader.close(); }
  await win.webContents.insertText('X');
  const replacement = text.slice(0,12) + 'X' + text.slice(20);
  await wait(`(async () => (await window.textotheque.getDocument(1)).content === ${JSON.stringify(replacement)})()`);
  toggle.click();
  await wait(panel);
  await category('Récents');
  await click('.nav-view-button:nth-child(2)');
  await wait(editor + '?.disabled');
  assert.ok(await read("document.querySelector('.character-tile').ariaDisabled === 'true'"));
  await tile('—');
  assert.deepEqual((await prefs()).recent, expected);
  await read("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
  await wait('!' + panel);
  assert.equal(await read('document.activeElement === ' + editor), false);
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
