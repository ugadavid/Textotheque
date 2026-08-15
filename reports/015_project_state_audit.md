# Audit de reprise — Textothèque 0.1.13

Date de l'audit : 15 août 2026.

## 1. Résumé exécutif

Textothèque est aujourd'hui un petit éditeur desktop DB-first cohérent et réellement fonctionnel sur son périmètre : documents texte brut, sauvegarde explicite en SQLite, recherche locale, corbeille, dossiers virtuels hiérarchiques, arborescence repliable, métadonnées simples et panneaux redimensionnables.

Les six commandes de validation demandées passent avec un code de sortie `0`. Les tests couvrent utilement la couche SQLite, les migrations legacy, l'exposition preload et de nombreux parcours renderer. Les tests Electron qui ouvrent une base affichent encore des avertissements Windows `os_crypt_win.cc` et `gpu_process_host.cc`, déjà connus et non bloquants.

La version est cohérente à `0.1.13` dans `package.json`, `package-lock.json` et l'interface. Le projet respecte globalement la philosophie « baby steps » du README : les quatorze missions ont consolidé le socle `0.1.x` sans prétendre atteindre un nouveau palier `0.2.0`.

Les principaux points de reprise sont les suivants :

1. Le worktree est très éloigné du dernier commit : 27 fichiers suivis sont modifiés et 13 fichiers sont non suivis avant même cet audit. Les rapports 006 à 014, le test de migration legacy et le composant `StatusBar` sont notamment non suivis.
2. Le build TypeScript émet des `.js` et `.d.ts` directement dans `src/`. Quatorze de ces sorties sont déjà suivies et deux sorties de `StatusBar` sont non suivies. Vite cherche `.js` avant `.ts`/`.tsx`, ce qui rend possible l'utilisation de sorties JavaScript périmées en développement.
3. Le lancement dev suppose strictement `http://localhost:5173`. Si Vite bascule sur un autre port, Electron continue d'attendre puis de charger `5173`.
4. Le schéma runtime est dupliqué entre `electron/database.ts` et `db/schema.sql`, sans registre de migrations. Les migrations actuelles fonctionnent, mais ce dispositif deviendra fragile si le modèle grandit.
5. Le README reste une vision de produit et non une description stricte de l'état courant : plusieurs tables et colonnes qu'il présente n'existent pas encore.

Cet audit n'a modifié aucun fichier applicatif, aucune dépendance, aucune version et aucune donnée utilisateur. Le seul fichier créé dans le dépôt est le présent rapport.

## 2. État du dépôt

### Structure réelle

```text
Textotheque/
├── .agents/                    vide
├── db/
│   ├── migrations/.gitkeep    aucune migration SQL versionnée
│   └── schema.sql              copie déclarative du schéma courant
├── dist/                       build Vite, ignoré
├── dist-electron/              build Electron, ignoré
├── docs/.gitkeep               pas encore de documentation d'architecture séparée
├── electron/
│   ├── database.ts
│   ├── main.ts
│   ├── preload.cts
│   └── tsconfig.json
├── node_modules/               dépendances installées, ignorées
├── reports/                    rapports 001 à 015
├── scripts/                    validations Electron ad hoc
├── src/
│   ├── components/
│   ├── services/
│   ├── styles/
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── README.md
├── tsconfig.app.json
├── tsconfig.json
└── vite.config.ts
```

### Fichiers racine et configuration

- `package.json` déclare une application privée ESM, version `0.1.13`, avec `dist-electron/main.js` comme point d'entrée.
- `vite.config.ts` active React et `base: './'`, nécessaire au chargement du build par `file://`.
- `tsconfig.json` référence le renderer et Electron.
- `tsconfig.app.json` est strict, composite, sans `outDir` ni `noEmit`.
- `electron/tsconfig.json` compile les `.ts` et `.cts` vers `dist-electron` en `NodeNext`.
- Il n'existe pas encore de configuration de packaging/installateur, de CI, de lint ou de formatage automatique.
- `docs/` et `db/migrations/` ne contiennent que leur `.gitkeep`.
- Aucun `AGENTS.md` n'existe à la racine ou ailleurs dans le dépôt, conformément au périmètre de la mission.

### Scripts npm

```text
postinstall             reconstruit better-sqlite3 pour Electron
rebuild:electron        rebuild natif ciblé Electron 33.3.2
dev                     lance Vite et dev:electron en parallèle
dev:electron            attend localhost:5173, compile Electron, lance Electron
build                   compile renderer, Vite, puis Electron
start                   build puis lance Electron
test:db                 test fonctionnel de TextothequeDatabase
test:preload            test de l'API contextBridge/preload
test:ui-safeguards      build puis test renderer Electron semi-automatisé
test:electron-sqlite    smoke test de better-sqlite3 dans Electron
test:legacy-migration   test d'une base antérieure à deleted_at/folder_id
```

### État Git initial

Commandes demandées :

- `git status --short` : 27 fichiers suivis modifiés et 13 fichiers non suivis avant l'audit.
- `git diff --stat` : 27 fichiers, 2 594 insertions et 216 suppressions.
- `git log --oneline -10` : seulement quatre commits sont présents :

```text
54e3d32 feat: add safe draft handling and editor UX polish
6f92617 feat: add initial DB-first text editor shell
ea04ea6 modif README filename
4c5585b init
```

Les modifications suivies concernent le schéma, les trois fichiers Electron, `package.json`/lock, trois scripts de test, `App`, les composants, services, types et styles. Les éléments non suivis initiaux sont :

- `reports/006_...` à `reports/014_...` ;
- `scripts/electron-legacy-migration-check.cjs` ;
- `src/components/StatusBar.tsx`, `StatusBar.js` et `StatusBar.d.ts`.

Cet état traduit l'accumulation cohérente des missions 006 à 014 dans le worktree, mais pas encore un état Git gelé. Il faut éviter de confondre « présent sur disque et testé » avec « historisé dans Git ».

### `.gitignore` et fichiers générés

Le `.gitignore` couvre correctement :

```text
node_modules/
dist/
dist-electron/
*.tsbuildinfo
*.sqlite
*.sqlite-shm
*.sqlite-wal
```

Les builds `dist/`, `dist-electron/` et `tsconfig.app.tsbuildinfo` sont donc présents localement mais non suivis.

En revanche, les sorties TypeScript adjacentes à leurs sources ne sont pas ignorées. Les sorties générées suivies sont :

```text
src/App.js
src/App.d.ts
src/main.js
src/main.d.ts
src/components/EditorPane.js
src/components/EditorPane.d.ts
src/components/MetadataPane.js
src/components/MetadataPane.d.ts
src/components/NavigationPane.js
src/components/NavigationPane.d.ts
src/services/documents.js
src/services/documents.d.ts
src/types/document.js
src/types/document.d.ts
```

`src/components/StatusBar.js` et `StatusBar.d.ts` sont générés mais encore non suivis.

La cause est précise : `tsconfig.app.json` utilise `composite: true`, ce qui implique la génération de déclarations, et ne définit ni `noEmit` ni répertoire de sortie. `tsc -b` écrit donc à côté des sources. Ce comportement paraît hérité des premiers choix de build plutôt que volontairement utile à Vite.

La dette est plus importante qu'un simple encombrement : l'ordre de résolution constaté dans Vite 6.4.3 est `.mjs`, `.js`, `.mts`, `.ts`, `.jsx`, `.tsx`, `.json`. Les imports sans extension comme `./App` peuvent donc sélectionner `App.js` avant `App.tsx`. Le build régénère d'abord les sorties et reste cohérent, mais `npm run dev` ne lance pas de compilation renderer en surveillance ; une sortie `.js` périmée peut masquer une modification `.tsx`.

## 3. Architecture technique

### Electron

Le point d'entrée est `electron/main.ts`, compilé en `dist-electron/main.js`.

La fenêtre principale est créée avec :

- taille initiale `1280 × 820` ;
- taille minimale `980 × 640` ;
- `contextIsolation: true` ;
- `nodeIntegration: false` ;
- preload `dist-electron/preload.cjs` ;
- URL fixe `http://localhost:5173` en développement ;
- `dist/index.html` par `loadFile` lorsque l'application est packagée.

Le preload est volontairement un fichier `.cts`. Il devient un CommonJS `.cjs`, ce qui corrige le problème historique de preload ESM décrit dans le rapport 002. Il expose `window.textotheque` via `contextBridge`.

Les handlers IPC sont regroupés dans `registerIpcHandlers()` :

```text
documents:list
documents:list-deleted
documents:create
documents:get
documents:update
documents:mark-opened
documents:trash
documents:restore
documents:empty-trash
folders:list
folders:create
folders:rename
app:approve-close
```

Le main process envoie également l'événement `app:close-requested` au renderer. Le renderer affiche la confirmation anti-perte et rappelle `app:approve-close` si la fermeture est acceptée.

### Base SQLite et emplacement

La base est ouverte paresseusement au premier appel IPC. Le chemin est :

```text
process.env.TEXTOTHEQUE_DB_PATH
```

si cette variable est définie, sinon :

```text
path.join(app.getPath('userData'), 'textotheque.sqlite')
```

Sur la machine auditée, le fichier réel existant est :

```text
C:\Users\david\AppData\Roaming\Electron\textotheque.sqlite
```

Le dossier générique `Electron` vient de l'absence actuelle de nom produit/configuration packagée explicite. L'audit n'a ni ouvert en écriture ni modifié cette base ; les tests et tentatives de lancement ont utilisé des bases temporaires.

### Renderer React

`src/main.tsx` monte `App` sous `React.StrictMode` et charge la feuille de style globale.

`App.tsx` est le composant orchestrateur. Il gère les données chargées, les brouillons édités, les vues, la sélection, les confirmations, la recherche, les raccourcis et les largeurs de panneaux. Il délègue l'affichage à :

- `NavigationPane` : vues globales, corbeille, dossiers, sous-dossiers, documents dans l'arbre, recherche, création et renommage de dossiers ;
- `EditorPane` : titre, contenu texte brut, état de sauvegarde, sauvegarde, mise à la corbeille et restauration ;
- `MetadataPane` : identifiant, dates, compteurs, dossier, statut, favori et notes ;
- `StatusBar` : contexte, compteurs, sélection, format, statut, sauvegarde, mots, caractères, indicateur SQLite et version.

Le flux réel est :

```text
Composants React / App
→ src/services/documents.ts
→ window.textotheque
→ contextBridge du preload
→ ipcRenderer.invoke
→ ipcMain.handle
→ TextothequeDatabase
→ better-sqlite3
→ textotheque.sqlite
```

### État applicatif

Tout l'état courant est local à `App`, sauf le repli des dossiers qui vit dans `NavigationPane` :

- document sélectionné : `selectedDocument` ;
- brouillon en cours : `title`, `content`, `notes`, `status`, `favorite`, `folderId` ;
- modifié/non sauvegardé : comparaison dérivée entre le brouillon et `selectedDocument`, répliquée dans `isDirtyRef` pour la fermeture ;
- état de sauvegarde : `saveState` ;
- contexte de navigation : `documentView` et `selectedFolderId` ;
- recherche : `searchQuery` et filtrage `useMemo` ;
- dossiers repliés : `collapsedFolderIds` dans `NavigationPane` ;
- largeurs de panneaux : `paneWidths` ;
- dialogue : `confirmDialog`, avec résolution par `Promise<boolean>` ;
- focus : requêtes DOM vers l'éditeur, la recherche ou le titre, plus un listener clavier global ;
- erreurs : `error`, mais seul le flux de sauvegarde possède un `try/catch` complet.

Le document sélectionné, la vue, le dossier courant et la recherche ne sont pas persistés au redémarrage.

## 4. Modèle SQLite

### Schéma runtime réel

La source effectivement exécutée est la chaîne `schema` dans `electron/database.ts`. `db/schema.sql` en est une copie documentaire ; le runtime ne lit pas ce fichier.

#### Table `documents`

| Colonne | Type / défaut | Règle réelle |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | identifiant |
| `title` | `TEXT NOT NULL DEFAULT ''` | trimé à la sauvegarde |
| `content` | `TEXT NOT NULL DEFAULT ''` | texte brut |
| `content_format` | `TEXT NOT NULL DEFAULT 'plain'` | `plain`, `markdown` ou `rich` par contrainte |
| `status` | `TEXT NOT NULL DEFAULT 'draft'` | `draft`, `active`, `to_review`, `final`, `archived` |
| `favorite` | `INTEGER NOT NULL DEFAULT 0` | `0` ou `1` |
| `folder_id` | `INTEGER NULL` | dossier unique ou non classé ; pas de FK déclarée |
| `created_at` | `TEXT NOT NULL` | date de création |
| `updated_at` | `TEXT NOT NULL` | date de dernière sauvegarde/restauration/corbeille |
| `last_opened_at` | `TEXT NULL` | mise à jour à la sélection |
| `deleted_at` | `TEXT NULL` | `NULL` actif, date non nulle en corbeille |
| `notes` | `TEXT NOT NULL DEFAULT ''` | notes internes |

Même si la contrainte autorise trois formats, l'application crée toujours `plain` et chaque `updateDocument()` réécrit `content_format = 'plain'`. `markdown` et `rich` ne sont donc que préparés dans le contrat, pas utilisables.

Index :

```text
idx_documents_updated_at      updated_at DESC
idx_documents_last_opened_at  last_opened_at DESC
idx_documents_deleted_at      deleted_at DESC
idx_documents_folder_id       folder_id
```

#### Table `folders`

| Colonne | Type / défaut | Règle réelle |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | identifiant |
| `name` | `TEXT NOT NULL` | nom libre, doublons autorisés |
| `parent_id` | `INTEGER NULL` | parent ou racine |
| `position` | `INTEGER NOT NULL DEFAULT 0` | ordre parmi les frères |
| `created_at` | `TEXT NOT NULL` | création |
| `updated_at` | `TEXT NOT NULL` | renommage |

`parent_id` déclare une FK vers `folders(id) ON DELETE SET NULL`, mais le code n'active pas `PRAGMA foreign_keys = ON`. Cette contrainte n'est donc pas garantie dans la connexion actuelle. `documents.folder_id` n'a aucune FK déclarée.

Index : `idx_folders_parent_id` sur `parent_id`.

### Écart avec le README

Le README présente un schéma conceptuel plus large. Ne sont pas présents dans le schéma réel :

- colonnes documentaires `archived_at`, `source_type`, `source_detail`, `export_path` ;
- tables `tags`, `document_tags`, `collections`, `document_collections`, `document_versions`, `app_settings` ;
- toute table de version de schéma/migrations.

Les statuts et formats décrits par le README correspondent en revanche aux contraintes actuelles. `favorite`, `notes`, `last_opened_at`, `deleted_at` et `folder_id` sont réellement utilisés.

### Ordre d'initialisation

L'ordre actuel est correct pour les deux migrations existantes :

1. création du dossier parent du fichier ;
2. ouverture de SQLite ;
3. `PRAGMA journal_mode = WAL` ;
4. création si nécessaire des tables `documents` et `folders` ;
5. `runMigrations()` ;
6. création des index ;
7. nettoyage logique des brouillons vides.

`runMigrations()` inspecte `PRAGMA table_info(documents)` puis ajoute, si absentes :

```sql
ALTER TABLE documents ADD COLUMN deleted_at TEXT;
ALTER TABLE documents ADD COLUMN folder_id INTEGER;
```

Les migrations legacy nécessaires correspondent donc aux missions 007/008 (`deleted_at`) et 011 (`folder_id` plus création de `folders`). Le rapport 008 reste exact : les index dépendant de colonnes migrées sont créés après les migrations.

### Règles indispensables pour une future migration

- Ne jamais recréer ni vider une base existante pour ajouter une colonne.
- Conserver l'ordre « tables de base → colonnes migrées → index → opérations applicatives ».
- Tester la présence des éléments avec les `PRAGMA`/`sqlite_master`, rendre l'opération idempotente et préserver les valeurs existantes.
- Ajouter un scénario legacy contenant un document réel avant toute nouvelle migration sensible.
- Ajouter les index seulement après garantie d'existence de leurs colonnes.
- Encadrer les migrations plus complexes dans une transaction et vérifier les données avant/après ; les deux `ALTER TABLE` actuels sont simples mais ne constituent pas encore un système de migrations complet.
- Décider explicitement de l'activation des clés étrangères et traiter les lignes orphelines avant de renforcer les contraintes.
- Garder `electron/database.ts` et `db/schema.sql` synchronisés tant que les deux existent.
- Ne pas exécuter d'opération applicative comme le nettoyage avant la fin des migrations.

### Formats de date

Les créations applicatives utilisent `new Date().toISOString()`, alors que les défauts SQL utilisent `datetime('now')`. Les deux représentations UTC ont des formes textuelles différentes (`T...Z` contre espace sans suffixe). L'application utilise presque toujours les valeurs ISO explicites, mais cette dualité pourrait perturber un tri lexical si des lignes étaient créées directement avec les défauts SQL.

## 5. Fonctionnalités présentes

### Création de document

- État : **opérationnel**.
- Implémentation principale : `App.handleCreateDocument()` → service → IPC → `TextothequeDatabase.createDocument(folderId)`.
- Tests associés : `test:db`, `test:preload`, `test:ui-safeguards`.
- Limites connues : création vide uniquement en `plain`; un brouillon totalement vide est déplacé automatiquement en corbeille au prochain démarrage.

### Édition du titre et du contenu

- État : **opérationnel** pour le texte brut.
- Implémentation principale : états `title`/`content`, `EditorPane`, `updateDocument()`.
- Tests associés : test UI de saisie, de titre vide/fallback et d'édition après confirmation.
- Limites connues : pas de Markdown, de riche, d'aperçu, d'historique ni d'autosave.

### Sauvegarde

- État : **opérationnel**.
- Implémentation principale : bouton ou `Ctrl+S`, `App.handleSave()`, `documents:update`, transaction unitaire SQLite implicite.
- Tests associés : `test:db` et plusieurs scénarios UI.
- Limites connues : sauvegarde explicite seulement ; les autres actions IPC ne partagent pas la gestion d'erreur détaillée de la sauvegarde.

### Détection des modifications non sauvegardées

- État : **opérationnel**.
- Implémentation principale : comparaison de cinq champs plus `folder_id` avec le document chargé.
- Tests associés : marqueurs, barre de statut, sauvegarde, navigation, création et corbeille dans `test:ui-safeguards`.
- Limites connues : un seul document édité à la fois ; aucun brouillon persistant en cas de crash.

### Confirmations anti-perte

- État : **opérationnel**, avec fermeture réelle encore **partiellement testée**.
- Implémentation principale : dialogue React asynchrone pour navigation/création/vidage/corbeille ; handshake IPC pour fermer la fenêtre.
- Tests associés : annulation, poursuite, édition après dialogue et `Escape` dans le test UI.
- Limites connues : le test UI n'exerce pas de bout en bout l'événement de fermeture du vrai `main.ts`; pas de focus trap ni de gestion `Enter`.

### Recherche

- État : **opérationnel** sur le périmètre actuel.
- Implémentation principale : filtrage renderer insensible à la casse sur titre et contenu sauvegardés, dans la vue active.
- Tests associés : titre, contenu, casse, contexte dossier/non classé/corbeille, effacement et `Ctrl+F`.
- Limites connues : pas de FTS, filtres avancés ou surlignage ; les modifications non sauvegardées ne sont pas recherchées ; toutes les données sont chargées en mémoire.

### Barre de statut

- État : **opérationnel mais indicatif**.
- Implémentation principale : `StatusBar.tsx`.
- Tests associés : compteurs, contexte, recherche, état modifié et visibilité après redimensionnement.
- Limites connues : `SQLite OK` est un libellé statique, pas un contrôle continu ; la ligne très dense masque par overflow ce qui ne tient pas.

### Raccourcis clavier

- État : **opérationnel**.
- Implémentation principale : listener `keydown` global dans `App`.
- Tests associés : `Ctrl+S`, `Ctrl+N`, `Ctrl+F`, `Escape`, `F2`.
- Limites connues : uniquement côté renderer ; aucune barre de menus Electron et aucun panneau d'aide.

### Mise à la corbeille

- État : **opérationnel et réversible**.
- Implémentation principale : `trashDocument()` renseigne `deleted_at` et `updated_at`.
- Tests associés : DB, preload et UI, y compris garde-fou dirty.
- Limites connues : pas de suppression définitive document par document ; le nettoyage de brouillons est automatique.

### Restauration

- État : **opérationnel**.
- Implémentation principale : `restoreDocument()` remet `deleted_at` à `NULL` et actualise `updated_at`.
- Tests associés : migration legacy, DB et UI.
- Limites connues : la restauration fait remonter le document dans l'ordre par mise à jour de `updated_at`.

### Vidage de corbeille

- État : **opérationnel et irréversible**.
- Implémentation principale : confirmation React puis `DELETE FROM documents WHERE deleted_at IS NOT NULL`.
- Tests associés : protection des documents actifs, annulation, confirmation, compteurs.
- Limites connues : confirmation simple ; aucune sauvegarde ni purge ciblée.

### Dossiers virtuels

- État : **opérationnel**.
- Implémentation principale : table `folders`, handlers IPC et `NavigationPane`.
- Tests associés : création, chargement, compteur et affichage UI.
- Limites connues : noms dupliqués possibles ; intégrité référentielle non appliquée ; aucune suppression ou réorganisation.

### Sous-dossiers

- État : **opérationnel mais simple**.
- Implémentation principale : `folders.parent_id`, parcours récursif `buildFolderRows()`.
- Tests associés : création et document dans sous-dossier.
- Limites connues : pas de déplacement, détection de cycle ou vue récursive agrégée ; un dossier orphelin ne serait pas rendu depuis la racine.

### Renommage de dossiers

- État : **opérationnel**.
- Implémentation principale : édition inline, validation au blur/Entrée, `renameFolder()`.
- Tests associés : renommage, persistance et fallback `Nouveau dossier`.
- Limites connues : pas de validation d'unicité ; UX inline minimale ; erreurs IPC non présentées proprement.

### Affectation d'un document à un dossier

- État : **opérationnel**.
- Implémentation principale : select du panneau métadonnées, `documents.folder_id`, sauvegarde explicite.
- Tests associés : affectation, retour en non classé, persistance, déplacement visuel.
- Limites connues : un document ne peut appartenir qu'à un dossier ; aucun glisser-déposer.

### Création contextualisée

- État : **opérationnel**.
- Implémentation principale : création dans la vue dossier ou dans le dossier du document actif ; création depuis la corbeille en non classé.
- Tests associés : bouton `+`, `Ctrl+N`, dossier et sous-dossier.
- Limites connues : le choix de contexte est implicite et n'est pas signalé avant création.

### Documents dans l'arborescence

- État : **opérationnel**.
- Implémentation principale : documents directs sous chaque dossier et section `Non classes`.
- Tests associés : sélection, création, déplacement, séparation de la corbeille et recherche.
- Limites connues : compteurs directs seulement ; recherche remplacée par une liste classique ; duplication voulue entre arbre et vue globale.

### Repli/dépli des dossiers

- État : **opérationnel**.
- Implémentation principale : `collapsedFolderIds`, chevrons séparés et ouverture automatique du chemin sélectionné.
- Tests associés : masquage des enfants/documents, compteur, persistance, sélection inchangée.
- Limites connues : symboles ASCII `>`/`v`, pas de commande globale ; préférence locale au profil.

### Métadonnées, favoris et statuts

- État : **opérationnel**.
- Implémentation principale : `MetadataPane`, champs SQLite `notes`, `favorite`, `status`, dates.
- Tests associés : persistance DB des champs fondamentaux ; dirty state UI.
- Limites connues : libellés de statut techniques en anglais, pas de tags/source/export ; l'archivage n'est qu'une valeur de statut sans vue dédiée.

### Panneaux redimensionnables

- État : **opérationnel**.
- Implémentation principale : pointer events, pourcentages bornés, variables CSS.
- Tests associés : présence des poignées, écriture localStorage et barre de statut visible.
- Limites connues : pas de réinitialisation, poignées étroites, pas de contrôle clavier des tailles.

## 6. Persistance et préférences UI

### Données métier SQLite

Sont persistés en SQLite : documents, contenu, titre, format, statut, favori, dossier, dates, corbeille, notes, dossiers, parenté, position et dates de dossiers.

### Préférences locales renderer

Deux clés `localStorage` existent :

```text
textotheque:pane-widths:v1
textotheque:collapsed-folders:v1
```

La première contient un objet JSON `{ left, right }` en pourcentages, bornés entre 18 et 34 avec une somme latérale limitée. La seconde contient un tableau JSON d'identifiants numériques de dossiers repliés.

Ne sont pas persistés : recherche, vue active, dossier sélectionné, document sélectionné, focus et dialogues.

### Fichiers générés

- `dist/` : HTML/CSS/JS de production Vite, ignoré.
- `dist-electron/` : main, database et preload compilés, ignorés.
- `tsconfig.app.tsbuildinfo` : cache TypeScript, ignoré.
- `.js`/`.d.ts` adjacents dans `src/` : générés mais partiellement suivis, dette décrite plus haut.
- bases temporaires des scripts dans `%TEMP%` : les tests leur donnent un nom horodaté mais ne les suppriment pas après succès.

### Configuration projet

`package.json`, les trois configurations TypeScript, `vite.config.ts`, `index.html`, `.gitignore`, `db/schema.sql` et les scripts sont de la configuration/source projet, pas des données utilisateur.

## 7. Tests et commandes de validation

### Résultats de l'audit

| Commande | Résultat | Code | Avertissements / portée |
|---|---:|---:|---|
| `npm.cmd run build` | OK | 0 | 32 modules ; build Vite 165,82 kB JS, 9,46 kB CSS ; aucun avertissement |
| `npm.cmd run test:legacy-migration` | OK | 0 | `os_crypt_win.cc` et sorties GPU `-1073741515`, non bloquantes |
| `npm.cmd run test:db` | OK | 0 | `os_crypt_win.cc` et une sortie GPU, non bloquantes |
| `npm.cmd run test:electron-sqlite` | OK | 0 | `electron sqlite ok`, aucun avertissement capturé |
| `npm.cmd run test:preload` | OK | 0 | `preload api ok`, aucun avertissement capturé |
| `npm.cmd run test:ui-safeguards` | OK | 0 | reconstruit le projet puis `ui safeguards ok` |

Les avertissements Windows n'ont pas de caractère bloquant dans ces commandes : chaque processus se termine à `0` et les assertions finales sont atteintes.

### Objectif et couverture de chaque test

- `electron-sqlite-smoke.cjs` : vérifie uniquement le chargement ABI de `better-sqlite3` dans Electron et une table en mémoire.
- `electron-legacy-migration-check.cjs` : crée une ancienne table `documents` sans `deleted_at`/`folder_id`, conserve un document réel, vérifie les ajouts, la table `folders`, la corbeille et la restauration.
- `electron-db-check.cjs` : couvre CRUD documentaire utile, persistance après réouverture, dossiers/sous-dossiers/renommage/affectation, corbeille/restauration/vidage et nettoyage prudent des brouillons.
- `electron-preload-api-check.cjs` : charge le vrai preload dans une fenêtre cachée avec handlers IPC factices et vérifie la présence/appel des API principales.
- `electron-ui-safeguards-check.cjs` : charge le build `file://` dans une fenêtre cachée, utilise une couche IPC en mémoire, puis pilote le DOM pour la recherche, les vues, dossiers, renommage, création contextualisée, arbre, repli, raccourcis, dirty state, confirmations, corbeille, restauration, vidage, panneaux et titre vide.

### Limites des tests

- Il ne s'agit pas d'une suite avec framework de tests : chaque script quitte sur une exception ou écrit un message de succès.
- Le test UI ne combine pas le vrai `main.ts`, la vraie couche SQLite et le renderer dans un même scénario ; ses handlers sont factices.
- La fermeture réelle de fenêtre et son handshake anti-perte ne sont pas testés de bout en bout.
- Le test UI est caché et ne remplace pas une observation humaine longue de l'ergonomie, de la sélection et du focus.
- Les erreurs réseau/cache/GPU d'un lancement visible ne sont pas représentées par la fenêtre cachée.
- Il n'existe ni couverture chiffrée, ni test de charge, ni CI.
- Les fichiers SQLite temporaires ne sont pas supprimés par les scripts.

### Lancement de développement observé

Un lancement avec base temporaire a été tenté sans toucher à la base utilisateur. Il n'a pas permis d'observer durablement la fenêtre :

1. le port `5173` était occupé par un processus issu de la première tentative ;
2. Vite a automatiquement choisi `5174` ;
3. `dev:electron` a continué d'attendre puis le main process a continué de charger `http://localhost:5173` ;
4. Electron a ensuite signalé `ERR_FAILED (-2)` ainsi que des erreurs de cache/GPU propres à cet environnement ;
5. les processus d'audit ont été arrêtés, sans nettoyage du dépôt ni accès à la base utilisateur.

Ce résultat ne contredit pas le build ou le test UI `file://`, tous deux réussis. Il met en évidence le couplage fragile au port fixe et confirme que l'observation ergonomique de cette mission doit principalement reposer sur le code/CSS et le test UI semi-automatisé.

## 8. Versionnement

La version `0.1.13` apparaît aux endroits suivants :

- `package.json` : `version: 0.1.13` ;
- `package-lock.json` : version racine et paquet racine `0.1.13` ;
- `src/App.tsx` : `APP_VERSION = '0.1.13'` ;
- `src/App.js` généré : même constante ;
- barre de statut : affiche `v0.1.13` via la prop `version`.

Il n'y a pas d'autre déclaration contradictoire détectée. `index.html` et le titre de fenêtre affichent seulement `Textotheque` sans version.

La cohérence est bonne, mais la valeur est dupliquée manuellement entre le manifeste et le renderer. Une future mission pourra établir une source unique sans changer la politique de version.

La règle README est respectée dans l'esprit : `0.1.x` consolide le socle DB-first et une mission ne provoque pas automatiquement un saut de version majeur. Les versions ont néanmoins progressé presque à chaque mission 004–014 ; cela reste acceptable car chaque incrément correspond à un état fonctionnel identifiable, mais le prochain agent ne doit pas déduire la version du numéro de rapport.

## 9. Dette technique / incohérences

### Priorité haute pour la reprise

1. **État Git cumulatif** : la majorité des fonctionnalités récentes n'est pas dans un commit. Avant une évolution importante, il faut décider comment geler proprement l'état `0.1.13` sans perdre ni mélanger le travail existant.
2. **Sorties TypeScript dans `src/`** : doublons suivis et risque de résolution `.js` avant `.tsx`, particulièrement en dev sans compilation renderer en surveillance.
3. **Port dev fixe** : Vite peut choisir un autre port alors qu'Electron attend/charge toujours `5173`; le lancement devient incohérent.

### Dette de consolidation

- Le schéma est dupliqué et seul celui de `electron/database.ts` est exécuté.
- Les migrations sont des tests de colonnes sans registre, numéro de schéma ni transaction explicite.
- `folders.parent_id` déclare une FK mais `foreign_keys` n'est pas activé ; `documents.folder_id` n'en déclare pas.
- Le nom de profil Electron reste générique ; la base actuelle se trouve sous `Roaming\Electron`.
- `APP_VERSION` duplique `package.json`.
- Le rebuild natif cible en dur Electron `33.3.2`, tandis que l'installation réelle auditée contient Electron `33.4.11`. Les tests ABI passent, mais la cible devrait suivre explicitement la version réellement résolue ou verrouillée.
- Les dépendances installées sont plus récentes à l'intérieur des plages du manifeste, par exemple Vite `6.4.3`, TypeScript `5.9.3` et `better-sqlite3` `11.10.0`. C'est cohérent avec le lock actuel, mais il faut distinguer versions minimales déclarées et versions installées.
- Seule la sauvegarde capture proprement les erreurs. Chargement, création, dossier, renommage, corbeille et restauration peuvent produire des promesses rejetées sans message utilisateur cohérent.
- `SQLite OK` n'est pas un test de santé.
- Les dates ont deux formats textuels possibles.
- Les scripts laissent leurs bases de test horodatées dans `%TEMP%`.
- Le README mélange vision cible et état réel ; `docs/` ne contient encore aucune synthèse d'architecture.
- Aucun lint, formatage, test runner, CI ou packaging n'est configuré.

### Sécurité et réversibilité des données

- Création/sauvegarde : écriture normale en SQLite, réversible par nouvelle sauvegarde mais sans historique.
- Sélection : écrit `last_opened_at`.
- Mise à la corbeille : logique, réversible, conserve tous les champs.
- Nettoyage au démarrage : logique et réversible, mais automatique pour tout document strictement vide répondant aux critères.
- Restauration : réversible fonctionnellement, mais change `updated_at`.
- Vidage de corbeille : suppression physique et irréversible des seules lignes avec `deleted_at IS NOT NULL`.
- Dossiers : création et renommage uniquement ; aucune suppression physique/logique de dossier n'existe.
- Aucun fichier texte externe n'est créé pour un document ; le principe DB-first est respecté.

Les données sont encore décrites comme données de test. Les risques restent donc mesurés, mais le vidage de corbeille et le nettoyage automatique devront être réévalués avant l'utilisation de textes importants.

## 10. Ergonomie actuelle

L'interface est sobre, cohérente et structurée en trois volets avec une palette claire et une sélection verte homogène. Le centre offre un titre bien visible, un éditeur monospace spacieux et des actions explicites. Le panneau de métadonnées regroupe les informations utiles sans complexité inutile. Les panneaux latéraux sont redimensionnables avec des bornes qui préservent le centre.

Le volet gauche est fonctionnel mais encore provisoire :

- il cumule résumé, vues, corbeille, dossiers, actions, documents non classés, recherche et parfois liste classique ;
- seuls les résultats classiques disposent explicitement d'un conteneur scrollable, alors qu'une longue arborescence peut densifier ou déborder le volet entier ;
- les chevrons ASCII `>` et `v` sont petits et peu élégants ;
- l'indentation de 14 px, le préfixe `- ` des sous-dossiers et l'indentation des documents rendent la hiérarchie lisible mais visuellement rudimentaire ;
- le favori et l'état non sauvegardé utilisent tous deux un astérisque, ce qui peut être ambigu ;
- le bouton `+/` pour un sous-dossier est compact mais peu explicite sans son infobulle ;
- le renommage inline fonctionne, mais son bouton n'apparaît que sur le dossier sélectionné.

Le panneau central fonctionne bien pour le texte brut. Les libellés sans accents (`Pret`, `Modifie`, `Ecrire`) et les statuts techniques (`draft`, `to_review`) rappellent toutefois le caractère prototype.

Le panneau droit est utile, mais très technique : identifiant interne, format brut et valeurs de statut non traduites. Les dates et compteurs sont clairs.

La barre de statut fournit beaucoup d'informations sur une hauteur de 30 px. Elle tronque silencieusement les segments excédentaires et peut devenir trop dense sur la largeur minimale.

Les dialogues React évitent le blocage historique de `window.confirm`, mais restent minimaux : pas de focus trap, pas de focus initial explicitement géré et pas de validation par Entrée. `Escape` est géré.

## 11. Fonctionnalités absentes ou reportées

### Prévues dans le README, totalement absentes fonctionnellement

- import `.txt`, `.md`, `.html` ;
- export `.txt`, `.md`, `.html` et formats ultérieurs ;
- tags et tables d'association ;
- collections et tables d'association ;
- historique/versionnement documentaire ;
- métadonnées de source et chemin d'export ;
- IA optionnelle ;
- liens internes/backlinks, templates et statistiques avancées.

### Préparées techniquement mais non implémentées

- Markdown : valeur de schéma/type autorisée, mais aucune création, édition dédiée, prévisualisation ou export ; les mises à jour reforcent `plain`.
- Texte enrichi : valeur `rich` autorisée seulement par le type et la contrainte.
- Archivage : statut `archived` disponible, sans vue ni comportement d'archive dédié.
- Tri de dossiers : colonne `position` alimentée à la création, sans interface de réorganisation.

### Évoquées par les rapports mais reportées

- suppression non destructive de dossier avec retour des documents en non classés ;
- déplacement de dossiers ;
- glisser-déposer ;
- documents dans plusieurs dossiers ;
- vue/compteurs récursifs de sous-dossiers ;
- tri manuel/avancé ;
- commande globale tout replier/tout déplier ;
- aide clavier ou menu Electron ;
- suppression définitive document par document.

### Absences confirmées dans le socle actuel

- autosave ;
- brouillon persistant hors sauvegarde ;
- recherche SQLite FTS, filtres combinés, surlignage ;
- packaging/installateur ;
- thème ou réglages généraux ;
- réinitialisation des panneaux ;
- multi-fenêtres ;
- synchronisation/cloud.

Markdown ne doit pas être considéré automatiquement comme la prochaine mission : le dépôt présente d'abord plusieurs consolidations courtes et utiles.

## 12. Recommandations pour AGENTS.md

Le futur `AGENTS.md` devrait transmettre les faits et règles suivants, sans recopier tout le README :

1. Lire `README.md` puis les rapports chronologiques pertinents avant toute modification, avec priorité au rapport d'audit le plus récent.
2. Vérifier systématiquement le code : les rapports décrivent l'intention historique et peuvent être dépassés.
3. Respecter « une mission, un objectif clair, un rapport » et la logique baby steps.
4. Ne jamais modifier la version par réflexe ; `0.1.x` reste le socle et un rapport n'implique pas un incrément.
5. Préserver le principe DB-first : SQLite est la source de vérité, les fichiers externes ne sont que des imports/exports volontaires.
6. La couche SQLite vit dans le main process. Le renderer passe par services → preload → IPC ; ne pas exposer Node au renderer.
7. Conserver `contextIsolation: true`, `nodeIntegration: false` et le preload `.cts` compilé en `.cjs`.
8. Le chemin de base par défaut est `app.getPath('userData')/textotheque.sqlite`; utiliser `TEXTOTHEQUE_DB_PATH` et un profil temporaire pour les tests/lancements d'audit.
9. Pour SQLite, respecter l'ordre tables → migrations → index → opérations applicatives et ajouter un test legacy à chaque migration.
10. Ne pas supprimer/recréer une base existante ; préserver les documents et vérifier les données avant/après.
11. Distinguer mise à la corbeille logique, restauration et `emptyTrash()` physique irréversible.
12. Se souvenir que le nettoyage des brouillons vides s'exécute au démarrage après les migrations.
13. Considérer `electron/database.ts` comme schéma runtime tant qu'aucune source canonique n'a été établie ; synchroniser `db/schema.sql`.
14. Exécuter au minimum les six commandes validées par cet audit après un changement transversal ; choisir les tests ciblés pour une petite intervention.
15. Les tests Electron Windows peuvent produire `os_crypt_win.cc`/GPU avec code `0`; distinguer ces messages connus d'un vrai échec d'assertion.
16. Le test UI utilise des handlers IPC factices et ne remplace pas un test réel main + SQLite + renderer.
17. Ne pas éditer à la main les `.js`/`.d.ts` générés ; tant que la dette n'est pas résolue, le build peut les régénérer et Vite peut préférer les `.js`.
18. Avant toute modification, relever `git status --short` et préserver le worktree cumulatif de l'utilisateur.
19. Ne pas lancer `npm install`, `npm audit fix`, un rebuild natif ou une mise à jour de dépendance sans mission explicite.
20. Attention au port fixe `5173` du dev et à la cible Electron `33.3.2` codée dans le rebuild.
21. Les préférences UI locales sont limitées aux deux clés `localStorage` documentées ; ne pas déplacer une donnée métier dans `localStorage`.
22. Ne pas ajouter Markdown, import/export, autosave, tags ou suppression de dossier au détour d'une mission de consolidation.
23. Ne pas modifier des données utilisateur pour tester : employer une base temporaire.
24. Terminer chaque mission en vérifiant que seuls les fichiers autorisés diffèrent de l'état initial.

## 13. Pistes de reprise

### Petites améliorations / UX

#### Clarifier l'arborescence et son défilement

- Objectif : rendre tout le volet gauche scrollable de façon sûre, remplacer les chevrons ASCII et distinguer visuellement favori/dirty.
- Intérêt : amélioration immédiate avec beaucoup de dossiers.
- Ampleur : **petite**.
- Dépendances : conserver les tests de repli, sélection et recherche.

#### Renforcer l'accessibilité des dialogues

- Objectif : focus initial, focus trap, `Enter`, restitution fiable du focus.
- Intérêt : sécurise les confirmations anti-perte et destructives.
- Ampleur : **petite**.
- Dépendances : étendre `test:ui-safeguards`.

#### Alléger la barre de statut et traduire les libellés

- Objectif : hiérarchiser les informations, éviter la troncature, présenter les statuts en français sans changer leurs valeurs SQLite.
- Intérêt : interface plus lisible et moins prototype.
- Ampleur : **petite**.
- Dépendances : tests de compteurs/version.

### Consolidation technique

#### Assainir les sorties TypeScript du renderer

- Objectif : définir un build sans émission dans `src/`, retirer prudemment les sorties suivies et garantir que Vite utilise les sources `.tsx`.
- Intérêt : élimine le risque de code généré périmé en développement.
- Ampleur : **moyenne**.
- Dépendances : gel Git préalable, build complet, test UI `file://`, test dev/HMR.

#### Fiabiliser le lancement développement

- Objectif : partager réellement l'URL/port Vite avec Electron ou imposer `strictPort`, isoler clairement le profil applicatif et gérer l'échec de `loadURL`.
- Intérêt : démarrage prévisible et diagnostic plus clair.
- Ampleur : **petite à moyenne**.
- Dépendances : test de lancement réel Windows.

#### Geler proprement l'état Git 0.1.13

- Objectif : examiner puis historiser séparément les missions cumulées et leurs rapports, sans écraser le travail existant.
- Intérêt : point de reprise fiable avant toute grande évolution.
- Ampleur : **petite à moyenne** selon la stratégie de commits.
- Dépendances : décision explicite du mainteneur ; audit présent comme référence.

#### Établir une stratégie de schéma/migrations

- Objectif : source de schéma canonique, version de schéma, transactions, tests legacy et décision sur les FK.
- Intérêt : sécurise les prochaines colonnes/tables avant l'arrivée de données importantes.
- Ampleur : **moyenne**.
- Dépendances : aucun changement fonctionnel simultané ; sauvegarde de test et réconciliation.

#### Uniformiser les erreurs et ajouter un test de fermeture réel

- Objectif : présenter les échecs IPC sans promesses rejetées et tester main + preload + renderer + SQLite, dont fermeture dirty.
- Intérêt : fiabilité quotidienne et meilleure observabilité.
- Ampleur : **moyenne**.
- Dépendances : base/profil temporaires, prise en compte des avertissements Windows.

### Fonctionnalités futures

#### Gestion non destructive des dossiers

- Objectif : supprimer/déplacer un dossier avec règle explicite pour enfants et documents.
- Intérêt : complète le rangement actuel avant le drag and drop.
- Ampleur : **moyenne à importante**.
- Dépendances : intégrité référentielle et migrations consolidées.

#### Autosave prudent

- Objectif : sauvegarde différée explicite, état visible et stratégie en cas d'erreur.
- Intérêt : réduit le risque de perte sans rendre le flux ambigu.
- Ampleur : **moyenne**.
- Dépendances : confirmations, erreurs IPC et tests de concurrence stabilisés.

#### Audit puis mode Markdown

- Objectif : auditer le lecteur existant mentionné par le README avant toute intégration, puis définir source/aperçu/export.
- Intérêt : futur palier fonctionnel réel.
- Ampleur : **importante**.
- Dépendances : mission d'audit séparée, choix de renderer/sanitisation, stratégie d'export.

#### Import/export contrôlés

- Objectif : importer une copie interne et exporter volontairement sans remettre en cause SQLite.
- Intérêt : échanges avec les fichiers externes tout en restant DB-first.
- Ampleur : **moyenne à importante**.
- Dépendances : dialogues fichiers Electron, métadonnées de source/export, confirmations d'écrasement.

#### Tags/collections ou recherche FTS

- Objectif : améliorer le classement ou les performances de recherche selon le besoin réel.
- Intérêt : montée en charge au-delà des dossiers simples.
- Ampleur : **importante**.
- Dépendances : modèle/migrations consolidés et volume réel de documents ; ne pas lancer les deux axes simultanément.

## 14. Commandes exécutées

Principales commandes de lecture et d'inventaire :

```powershell
Get-Content -Raw README.md
Get-Content -Raw reports\001_... à reports\014_...
rg --files
Get-ChildItem -Force
git status --short
git diff --stat
git log --oneline -10
git ls-files ...
git check-ignore -v ...
rg -n "localStorage|sessionStorage" src electron
rg -n "0\.1\.13|APP_VERSION|version" ...
npm.cmd ls --depth=0
```

Validations demandées :

```powershell
npm.cmd run build
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
```

Contrôles complémentaires :

```powershell
node -e "... resolveConfig(...).resolve.extensions ..."
npm.cmd run dev
git status --short
git diff --stat
git diff --name-only
git ls-files --others --exclude-standard
```

Le lancement a utilisé `TEXTOTHEQUE_DB_PATH` vers `%TEMP%`. Aucune commande de nettoyage du dépôt, mise à jour de dépendance, migration de base utilisateur, changement de version ou correction n'a été exécutée.

## 15. Conclusion

Textothèque `0.1.13` est un socle crédible, lisible et déjà utile. Les rapports 006–014 correspondent globalement au code réel : recherche, corbeille, migration `deleted_at`, vidage, raccourcis, dossiers, renommage, création contextualisée, documents dans l'arbre et repli persistent bien dans l'implémentation et les tests.

Le projet n'a pas besoin d'une refonte avant reprise. Il a surtout besoin d'un gel propre et de quelques missions de consolidation ciblées : résoudre les sorties TypeScript dans `src/`, fiabiliser le dev server, formaliser les migrations et uniformiser les erreurs. Ces travaux réduiraient nettement le risque avant l'arrivée de données importantes ou d'un nouveau palier fonctionnel.

Le futur `AGENTS.md` pourra s'appuyer sur la section 12 de ce rapport. Il ne doit pas être créé tant que les règles de reprise et la stratégie de gel Git n'ont pas été validées par le mainteneur.
