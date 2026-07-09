# Rapport — Initialisation Textothèque V0.1

## Objectif

Créer le socle initial de Textothèque : une application desktop locale Electron + Vite + React + TypeScript, DB-first, permettant de créer, éditer, sauvegarder et retrouver des documents texte brut stockés en SQLite.

## Fichiers créés

- `.gitignore`
- `package.json`
- `package-lock.json`
- `index.html`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.app.json`
- `electron/tsconfig.json`
- `electron/main.ts`
- `electron/preload.ts`
- `electron/database.ts`
- `src/main.tsx`
- `src/App.tsx`
- `src/components/NavigationPane.tsx`
- `src/components/EditorPane.tsx`
- `src/components/MetadataPane.tsx`
- `src/services/documents.ts`
- `src/types/document.ts`
- `src/types/electron.d.ts`
- `src/styles/app.css`
- `db/schema.sql`
- `db/migrations/.gitkeep`
- `docs/.gitkeep`
- `scripts/electron-db-check.cjs`
- `scripts/electron-sqlite-smoke.cjs`
- `reports/001_initial_textotheque_v0.1_report.md`

## Fichiers modifiés

- `README.md` apparaît modifié dans le worktree, mais n'a pas été modifié par cette mission applicative.
- `package.json` a été ajusté après le premier test pour ajouter le rebuild Electron de `better-sqlite3` et les smoke tests Electron.

## Fonctionnement ajouté

- Fenêtre Electron fonctionnelle.
- Interface React en trois volets :
  - volet gauche : liste des documents et création d'un nouveau document ;
  - volet central : édition du titre et du contenu en texte brut ;
  - volet droit : métadonnées minimales, statut, favori et notes internes.
- Création d'un document en base SQLite.
- Sauvegarde explicite du titre, du contenu, du statut, du favori et des notes.
- Affichage de la liste des documents existants.
- Sélection d'un document depuis la liste.
- Mise à jour de `last_opened_at` lors de l'ouverture d'un document.
- Persistance SQLite vérifiée par fermeture et réouverture de la base.

## Choix techniques

- La base SQLite est créée dans le dossier applicatif Electron `userData`, sous le nom `textotheque.sqlite`.
- La logique SQLite reste côté processus principal Electron, exposée au renderer via `ipcMain` / `contextBridge`.
- `content_format` est toujours forcé à `plain` pour cette mission.
- Les valeurs futures `markdown` et `rich` sont prévues par le schéma, mais aucune interface Markdown ou riche n'a été ajoutée.
- Le stockage documentaire ne crée aucun fichier texte externe.
- L'interface utilise des composants simples et séparés pour garder une base lisible.
- `better-sqlite3` est reconstruit pour le runtime Electron via le script `postinstall`, afin d'éviter un décalage d'ABI entre Node et Electron.

## Base de données

Table minimale `documents` créée avec :

- `id`
- `title`
- `content`
- `content_format`
- `status`
- `favorite`
- `created_at`
- `updated_at`
- `last_opened_at`
- `notes`

Contraintes ajoutées :

- `content_format IN ('plain', 'markdown', 'rich')`
- `status IN ('draft', 'active', 'to_review', 'final', 'archived')`
- `favorite IN (0, 1)`

Index ajoutés :

- `idx_documents_updated_at`
- `idx_documents_last_opened_at`

## Vérifications effectuées

- Lecture préalable de `README.md`.
- Installation des dépendances.
- Compilation TypeScript renderer + Electron.
- Build Vite.
- Test SQLite automatisé :
  - création d'un document ;
  - modification du titre, contenu, statut, favori et notes ;
  - sauvegarde ;
  - lecture directe ;
  - affichage via liste ;
  - fermeture et réouverture de la base ;
  - vérification de la persistance.
- Smoke test Electron vérifiant que `better-sqlite3` se charge dans le runtime Electron.
- Démarrage court de l'application Electron buildée, avec arrêt manuel du processus après validation.

## Commandes lancées

```powershell
Get-Content -Raw README.md
Get-ChildItem -Force
rg --files
npm.cmd install
npm.cmd rebuild better-sqlite3 --runtime=electron --target=33.3.2 --disturl=https://electronjs.org/headers
npm.cmd run build
npm.cmd run test:db
npm.cmd run test:electron-sqlite
$proc = Start-Process -FilePath .\node_modules\.bin\electron.cmd -ArgumentList 'dist-electron/main.js' -WorkingDirectory 'J:\2026\Textotheque' -PassThru -WindowStyle Hidden; Start-Sleep -Seconds 5; if ($proc.HasExited) { throw "Electron exited early with code $($proc.ExitCode)" } else { "Electron start OK pid=$($proc.Id)"; Stop-Process -Id $proc.Id }
git status --short
```

## Points non traités

- Aucun éditeur riche.
- Aucun rendu Markdown.
- Aucun import.
- Aucun export.
- Aucune suppression de document.
- Aucun système de tags ou collections.
- Aucune recherche.
- Aucune IA.
- Aucun packaging installable.

## Risques / limites

- La sauvegarde est volontairement explicite par bouton ; pas encore d'autosave.
- Les erreurs IPC sont affichées simplement.
- Le test fonctionnel UI complet n'a pas encore été automatisé.
- `npm install` signale une vulnérabilité haute dans l'arbre de dépendances ; aucune correction automatique forcée n'a été appliquée pour éviter un changement de dépendances non maîtrisé.
- Le test DB Electron émet sur cette machine deux messages Windows/GPU non bloquants à la fermeture, avec un code de sortie 0.
- Le schéma est minimal ; les migrations devront devenir plus prudentes dès que des textes réels seront stockés.

## Suite recommandée

- Ajouter un test UI automatisé léger pour création/sélection/sauvegarde depuis l'interface.
- Ajouter une recherche simple titre/contenu.
- Ajouter une suppression logique ou un archivage confirmé.
- Ajouter une sauvegarde automatique prudente après stabilisation du flux d'édition.
- Préparer une mission séparée pour tags et collections.
