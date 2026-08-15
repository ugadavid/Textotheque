# Rapport — Barre de travail et navigation scalable

## Objectif

Réorganiser Textothèque autour d'une barre de travail dédiée à la recherche et aux actions, puis rendre le panneau gauche plus compact, hiérarchique et capable de rester utilisable avec beaucoup de dossiers et de documents, sans modifier SQLite.

Version applicative : passage de `0.1.13` à `0.1.14`.

## Constat UX initial

Le panneau gauche cumulait l'en-tête, un résumé, les vues, la corbeille, l'arbre des dossiers, les documents non classés, la recherche et parfois une seconde liste documentaire. Les documents classés pouvaient donc apparaître deux fois. L'arbre était ouvert par défaut, utilisait les caractères ASCII `>` et `v`, persistait les dossiers fermés et ne disposait pas d'une zone de défilement globale sûre.

La recherche était également liée à la vue courante. Une recherche depuis un dossier, `Non classes` ou la corbeille ne couvrait donc pas toute la bibliothèque active.

## Fichiers modifiés

- `package.json` ;
- `package-lock.json` ;
- `src/App.tsx` ;
- `src/components/EditorPane.tsx` ;
- `src/components/NavigationPane.tsx` ;
- `src/components/StatusBar.tsx` ;
- `src/styles/app.css` ;
- `scripts/electron-ui-safeguards-check.cjs` ;
- `reports/026_toolbar_navigation_scalability_report.md`.

Aucun fichier Electron main/preload, service, type métier, schéma ou migration SQLite n'est modifié.

## Barre de travail

La barre supérieure de l'éditeur est désormais organisée en trois zones :

- à gauche, le titre éditable du document ou l'état neutre `Aucun document sélectionné` ;
- au centre, la recherche globale ;
- à droite, l'état de sauvegarde et les actions existantes `Corbeille`, `Sauvegarder` ou `Restaurer`.

La recherche reste disponible même sans document sélectionné. Sous `1100 px`, elle occupe une seconde ligne complète afin de préserver le titre et les actions. Aucune nouvelle action n'a été ajoutée.

## Recherche globale

Le filtrage reste local au renderer, simple, insensible à la casse et fondé sur le titre ainsi que le contenu sauvegardé. Sa source est maintenant la collection complète des documents actifs, indépendamment de la vue ou du dossier courant.

Les documents en corbeille sont exclus. Chaque résultat affiche seulement son titre et son chemin de dossier, ou `Non classés`. Ouvrir un résultat conserve la recherche. Le bouton `×` et `Escape` vident la requête, conservent la sélection active et reviennent à l'arborescence.

## Modes du panneau gauche

Le panneau possède maintenant des modes exclusifs :

- navigation : dossiers, sous-dossiers, documents classés et pseudo-dossier `Non classés` ;
- recherche : résultats globaux actifs uniquement ;
- Tous les textes : liste globale simple des documents actifs ;
- Corbeille : documents supprimés logiquement et commande de vidage.

Le titre `Textothèque / Bibliothèque` sert de retour explicite à la navigation depuis les vues spéciales. Les raccourcis et les transitions réutilisent les confirmations anti-perte existantes.

## Simplification de l’arborescence

En navigation normale, aucune liste documentaire classique n'est rendue en plus de l'arbre. Les lignes documentaires n'affichent que le titre, une petite forme de document, le favori éventuel et le marqueur dirty éventuel.

Les compteurs restent alignés à droite. L'indentation passe à un pas visuel de 18 px et les anciens préfixes `- ` disparaissent.

## Dossiers fermés par défaut

Un dossier sans état UI enregistré est fermé. Une clé absente correspond donc à un ensemble vide de dossiers ouverts.

La sélection explicite d'un dossier, ou le retour à la navigation avec un document classé sélectionné, ouvre le dossier concerné et ses parents pour rendre le contexte visible.

## Persistance UI

Le nouvel état est enregistré dans :

```text
textotheque:expanded-folders:v2
```

Il contient les identifiants des dossiers explicitement ouverts. L'ancienne clé `textotheque:collapsed-folders:v1` est laissée intacte et ignorée. Aucune migration complexe de `localStorage` n'est introduite.

## Chevrons et hiérarchie visuelle

Les caractères ASCII sont remplacés par `▸` et `▾`. Le bouton du chevron reste séparé du bouton portant le nom du dossier.

Des formes CSS locales distinguent les dossiers et documents sans dépendance d'icônes. Le dirty utilise `*` en orange et le favori `★` en ocre, ce qui lève l'ambiguïté historique.

## Non classés

`Non classés` est présenté comme un pseudo-dossier avec chevron, compteur et documents enfants. Son ouverture reste un état UI local simple et n'affecte pas le modèle SQLite.

## Tout replier / Tout déplier

Deux boutons compacts avec infobulles sont ajoutés à l'en-tête `Dossiers` :

- `Tout replier` vide l'ensemble des dossiers ouverts ;
- `Tout déplier` ajoute tous les identifiants de dossiers présents.

Le pseudo-dossier `Non classés` conserve volontairement sa logique séparée.

## Scrolling et redimensionnement

L'en-tête de la bibliothèque et les accès `Tous les textes` / `Corbeille` restent fixes. Une unique région `.navigation-scroll-region` fait défiler l'arbre, les résultats ou la liste spéciale, sans scrollbar documentaire imbriquée.

Les poignées de redimensionnement gauche/droite et leurs bornes ne sont pas modifiées. Le test UI final utilise une fenêtre de `1020 × 680`, ce qui exerce la disposition compacte de la barre. Une observation réelle a aussi confirmé la disposition large à `1280 × 820`.

## Raccourcis

- `Ctrl+F` bloque la recherche native et focalise la recherche de la barre haute ;
- `Escape` vide toute recherche active, quel que soit le focus, et restaure la navigation ;
- `Ctrl+S`, `Ctrl+N` et `F2` conservent leurs comportements existants.

## Tests UI ajoutés ou modifiés

Le scénario UI vérifie désormais notamment :

- l'absence de recherche dans le panneau gauche et sa présence dans la barre haute ;
- `Ctrl+F`, `Escape` et les autres raccourcis ;
- la recherche globale depuis un dossier, `Non classés` et la corbeille ;
- l'exclusion des documents supprimés des résultats ;
- les résultats et chemins secondaires ;
- les modes exclusifs navigation, Tous les textes et Corbeille ;
- l'absence de liste documentaire redondante en navigation ;
- l'état ouvert vide par défaut et la clé `expanded-folders:v2` ;
- l'ouverture, le repli, `Tout replier` et `Tout déplier` ;
- la réouverture automatique du chemin du document sélectionné ;
- le pseudo-dossier `Non classés` ;
- la version `0.1.14` ;
- la mise en page dans une fenêtre réduite à `1020 × 680`.

Le BrowserWindow de test utilise une partition Chromium mémoire propre au PID. Cela rend l'assertion de clé absente déterministe sans nettoyer un profil partagé.

## Vérifications effectuées

| Commande | Résultat | Code |
|---|---|---:|
| `npm.cmd run build` | TypeScript, Vite et Electron compilés | 0 |
| `npm.cmd run test:app-identity` | identité, `userData`, chemin DB et version cohérents | 0 |
| `npm.cmd run test:legacy-migration` | quatre scénarios legacy, schéma 2 et nettoyage temporaire | 0 |
| `npm.cmd run test:db` | comportements DB et nettoyage temporaire | 0 |
| `npm.cmd run test:electron-sqlite` | ABI Electron / better-sqlite3 valide | 0 |
| `npm.cmd run test:preload` | API preload et rejet forcé contrôlé | 0 |
| `npm.cmd run test:ui-safeguards` | parcours renderer 0.1.14, fenêtre réduite et erreurs injectées | 0 |
| `npm.cmd run test:ipc-error` | propagation d'erreur IPC et nettoyage temporaire | 0 |
| `git diff --check` | aucune erreur de whitespace | 0 |

Les traces `forced preload rejection` et `SQLITE_FORCED` sont injectées volontairement par les tests concernés. Chaque test atteint son message final de succès.

## Commandes lancées

Lectures et audit :

```powershell
Get-Content -Raw AGENTS.md
Get-Content -Raw README.md
Get-Content -Raw reports/013_documents_in_folder_tree_report.md
Get-Content -Raw reports/014_collapsible_folder_tree_report.md
Get-Content -Raw reports/015_project_state_audit.md
Get-Content -Raw reports/025_test_temp_resource_cleanup_report.md
git status --short
git diff --stat
rg -n "..." src scripts
```

Validations :

```powershell
npm.cmd run build
npm.cmd run test:app-identity
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
npm.cmd run test:ipc-error
git status --short
git diff --stat
git diff --name-only
git diff --check
```

## Test développement

`npm.cmd run dev` a été lancé avec :

```text
TEXTOTHEQUE_DB_PATH=C:\Users\david\AppData\Local\Temp\textotheque-mission-026-dev-22e1cc4ea46e46da8f0763ca3ecb1a66\test.sqlite
```

Le premier lancement a été refusé proprement par Vite, car un ancien processus Vite Textothèque (PID `14296`) occupait `5173`. Après identification de sa commande exacte et arrêt de ce seul processus, le lancement a réussi sur `http://localhost:5173`.

La fenêtre réelle a été observée avec une base vide puis deux documents temporaires :

- barre haute lisible sans et avec document sélectionné ;
- recherche centrale focalisée par `Ctrl+F` ;
- bascule immédiate vers `RÉSULTATS` ;
- chemins `Non classés` visibles sous les résultats ;
- retour à l'arbre par `Escape` ;
- chevrons, formes dossier/document et compteurs lisibles ;
- version `v0.1.14` visible ;
- aucune nouvelle erreur applicative observée dans la sortie de développement.

La session a été arrêtée, l'absence de listener sur `5173` a été vérifiée, puis le seul répertoire temporaire contrôlé a été supprimé. Résultat :

```text
TEMP_EXISTS=False
```

La base utilisateur réelle n'a pas été ouverte ni modifiée.

## Versionnement

`package.json`, source canonique, passe à `0.1.14`. Les deux métadonnées racine de `package-lock.json` sont synchronisées. Le renderer reçoit toujours la version par `__APP_VERSION__` et affiche `v0.1.14`.

Aucun tag ou commit Git n'est créé.

## Points non traités

- recherche FTS ou filtres avancés ;
- surlignage des termes trouvés ;
- drag and drop, déplacement ou suppression de dossiers ;
- tri manuel ;
- tags et collections ;
- autosave, Markdown, import/export ;
- redesign du panneau droit ou de la barre de statut.

## Risques / limites

- La recherche charge et filtre toujours les documents actifs en mémoire ; cette solution reste adaptée au volume visé pour cette mission, mais n'est pas un substitut à FTS pour une bibliothèque beaucoup plus grande.
- Les compteurs de dossiers restent directs et non récursifs, conformément au comportement existant.
- `Non classés` n'est pas inclus dans `Tout replier` / `Tout déplier` afin de conserver une logique simple.
- Le test UI reste fondé sur des handlers IPC factices et ne remplace pas un test complet main + preload + renderer + SQLite.

## Suite recommandée

Faire tester la version `0.1.14` par le mainteneur avec sa base réelle, en particulier avec ses dossiers représentatifs et différentes largeurs de panneau gauche. Reporter toute optimisation FTS ou enrichissement de navigation à une mission distincte fondée sur le volume réellement observé.
