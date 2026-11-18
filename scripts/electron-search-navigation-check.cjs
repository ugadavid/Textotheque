const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createTestTempDirectory, removeTestTempDirectory } = require('./test-temp-directory.cjs');

// Executed inside the real renderer. The parent owns the temporary profile and database.
async function exerciseNavigation() {
  const find = (selector) => document.querySelector(selector);
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function waitFor(read, label) {
    for (let attempt = 0; attempt < 150; attempt++) {
      const value = read();
      if (value) return value;
      await pause(20);
    }
    throw new Error(label);
  }
  const advanced = () => find('.advanced-search-button').click();
  const panel = () => find('.advanced-search-panel');
  const toggle = () => find('.search-criteria-toggle');
  const title = () => find('.title-input')?.value;
  const editor = () => find('.content-editor');
  const rows = () => [...document.querySelectorAll('.catalog-row')];
  const row = (name) => rows().find((item) => item.querySelector('.catalog-cell-text').textContent === name);
  await waitFor(() => find('.advanced-search-button') && find('.library-name')?.textContent.includes('fixture.sqlite'), 'Initialisation DEV');
  advanced();
  await waitFor(panel, 'Critères visibles à l’entrée');
  advanced();
  await waitFor(() => find('#catalog-title')?.textContent === 'Tous les textes' && !editor(), 'Sortie sans document');

  const api = window.textotheque;
  for (const name of ['Alpha', 'Beta']) {
    const doc = await api.createDocument();
    await api.updateDocument(doc.id, {title: name, content: name, notes: '', status: 'draft', folder_id: null, favorite: name === 'Beta'});
  }
  advanced();
  (await waitFor(() => row('Alpha'), 'Document Alpha dans les résultats')).click();
  await waitFor(() => title() === 'Alpha' && editor().value === 'Alpha', 'Ouverture de Alpha');
  advanced();
  (await waitFor(() => find('.favorite-only-filter input'), 'Filtre favori')).click();
  await waitFor(() => rows().length === 1 && row('Beta'), 'Beta seul résultat');
  if (find('#catalog-title').textContent !== 'Recherche' || find('.catalog-heading .eyebrow')) throw Error('En-tête redondant');
  const button = find('.advanced-search-button').getBoundingClientRect();
  const chevron = toggle().getBoundingClientRect();
  if (Math.abs(chevron.top - button.top) > 5 || chevron.left < button.right || chevron.left - button.right > 6) throw Error('Chevron éloigné');
  const firstRow = row('Beta');
  toggle().click();
  await waitFor(() => !panel() && toggle().ariaExpanded === 'false', 'Repli indépendant');
  toggle().click();
  await waitFor(() => panel() && toggle().ariaExpanded === 'true' && find('.favorite-only-filter input').checked, 'Dépli et critères conservés');
  if (firstRow !== row('Beta')) throw Error('Résultats remplacés pendant le repli');
  toggle().click();
  await waitFor(() => !panel(), 'Repli avant retour');
  advanced();
  await waitFor(() => title() === 'Alpha' && editor().value === 'Alpha', 'Retour à Alpha malgré le résultat Beta');

  const draft = 'Brouillon de recette';
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(editor(), draft);
  editor().dispatchEvent(new Event('input', { bubbles: true }));
  await waitFor(() => find('.title-dirty-marker'), 'Brouillon modifié');
  advanced();
  (await waitFor(() => row('Beta'), 'Résultat Beta depuis un brouillon')).click();
  (await waitFor(() => find('.confirm-dialog .secondary-button'), 'Garde-fou de changement de document')).click();
  advanced();
  await waitFor(() => title() === 'Alpha' && editor().value === draft, 'Retour au brouillon intact');
  await waitFor(() => !find('.title-dirty-marker'), 'Sauvegarde automatique');
  if (!(await api.listDocuments()).some((doc) => doc.title === 'Alpha' && doc.content === draft)) throw Error('Brouillon non persisté');
  advanced();
  (await waitFor(() => row('Beta'), 'Résultat Beta après sauvegarde')).click();
  await waitFor(() => title() === 'Beta', 'Ouverture volontaire de Beta');
  advanced();
  await waitFor(panel, 'Nouvelle recherche depuis Beta');
  advanced();
  await waitFor(() => title() === 'Beta', 'Origine précédente invalidée');
  advanced();
  await waitFor(panel, 'Recherche avant changement de vue');
  find('.nav-view-button').click();
  await waitFor(() => find('#catalog-title')?.textContent === 'Tous les textes', 'Navigation volontaire vers le catalogue');
  advanced();
  await waitFor(panel, 'Recherche depuis le catalogue');
  advanced();
  await waitFor(() => find('#catalog-title')?.textContent === 'Tous les textes' && row('Beta'), 'Retour au catalogue');
  row('Beta').click();
  await waitFor(() => title() === 'Beta', 'Beta rouvert depuis le catalogue');
  advanced();
  await waitFor(panel, 'Recherche avant Échap');
  window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
  await waitFor(() => title() === 'Beta', 'Échap restaure la navigation');
  advanced();
  await waitFor(panel, 'Recherche avant indisponibilité');
  const beta = (await api.listDocuments()).find((doc) => doc.title === 'Beta');
  await api.trashDocument(beta.id);
  advanced();
  await waitFor(() => find('#catalog-title')?.textContent === 'Tous les textes' && row('Alpha') && !row('Beta') && !editor(), 'Origine supprimée');
}

async function runElectron() {
  const { app } = require('electron');
  app.setPath('appData', path.dirname(process.env.TEXTOTHEQUE_DB_PATH));
  app.once('browser-window-created', (_event, win) => {
    win.webContents.once('did-finish-load', async () => {
      try {
        await win.webContents.executeJavaScript('(' + exerciseNavigation.toString() + ')()');
        console.log('Navigation recherche OK : origine, critères, brouillon, résultat et origine indisponible.');
        win.close();
      } catch (error) {
        console.error(error);
        app.exit(1);
      }
    });
  });
  await import('../dist-electron/main.js');
}

async function runIsolated() {
  const { preview } = await import('vite');
  const server = await preview({ preview: { port: 5173, strictPort: true } });
  const temp = createTestTempDirectory('search-navigation');
  try {
    // Run asynchronously so Vite can serve the renderer on its event loop.
    const child = spawn(require('electron'), [__filename, '--fixture', '--user-data-dir=' + temp], {
      stdio: 'inherit',
      env: { ...process.env, TEXTOTHEQUE_DB_PATH: path.join(temp, 'fixture.sqlite'),
        TEXTOTHEQUE_LIBRARY_HISTORY_PATH: path.join(temp, 'history.json') },
      timeout: 45000,
    });
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    assert.equal(code, 0, 'Échec de la recette Electron');
  } finally {
    await server.close();
    removeTestTempDirectory(temp);
  }
}

(process.argv.includes('--fixture') ? runElectron() : runIsolated()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
