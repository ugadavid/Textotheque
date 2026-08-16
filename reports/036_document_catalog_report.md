# Rapport — Catalogue central des documents

## Objectif

Transformer l’accès existant « Tous les textes » en catalogue central détaillé, dont les lignes et l’ordre sont produits directement par SQLite, sans charger le contenu ni les notes de toute la bibliothèque.

## Fichiers modifiés

- `electron/database.ts`
- `electron/main.ts`
- `electron/preload.cts`
- `src/App.tsx`
- `src/components/DocumentCatalog.tsx`
- `src/services/catalog.ts`
- `src/styles/app.css`
- `src/types/catalog.ts`
- `src/types/electron.d.ts`
- `scripts/electron-catalog-check.cjs`
- `scripts/electron-preload-api-check.cjs`
- `scripts/electron-ui-safeguards-check.cjs`
- `package.json`
- `package-lock.json`

## API DB dédiée

`TextothequeDatabase.listDocumentCatalog(options)` porte une responsabilité distincte de `listDocuments()`. Le renderer envoie uniquement un champ et une direction de tri fermés, puis reçoit un résultat déjà joint et ordonné.

Le contrat traverse le handler IPC `documents:list-catalog`, le preload isolé et le service renderer `listDocumentCatalog()`.

## Colonnes sélectionnées

La requête énumère explicitement `id`, `title`, `folder_id`, le nom du dossier, `status`, `favorite`, `created_at`, `updated_at` et `special_role`.

Elle n’utilise pas `SELECT *` et ne transfère ni `content` ni `notes`.

## Jointure dossiers

La DB effectue un `LEFT JOIN folders` à partir de `documents.folder_id`. Une absence de dossier reste `folderName: null` dans le contrat et devient « Non classé » uniquement à l’affichage.

## Vue centrale

« Tous les textes » affiche désormais `DocumentCatalog` dans la grande zone centrale. La table contient Titre, Dossier, Statut, Favori, Créé et Modifié. Elle conserve les commandes globales de recherche, TODO et masquage des panneaux.

Les proportions privilégient le titre et le dossier. La table possède une largeur minimale raisonnable, des ellipses sur le texte long et un défilement horizontal en dernier recours.

## Tri SQL

Chaque en-tête déclenche une nouvelle requête DB. Le premier clic sur un nouveau champ demande `ASC`, puis les clics suivants alternent `DESC` et `ASC`.

L’ordre initial est `updated_at DESC` (« Modifié ↓ »). Aucun tri du catalogue n’est réalisé dans React.

## Whitelist des tris

Les seuls champs acceptés sont `title`, `folder`, `status`, `favorite`, `created_at` et `updated_at`. Chacun est traduit par une expression SQL interne connue. Les directions acceptées sont strictement `asc` et `desc`, traduites en littéraux `ASC` et `DESC`.

Une valeur inconnue est rejetée avant la préparation SQL.

## Tri stable

Chaque ordre reçoit `documents.id` comme second critère, dans la même direction. Deux documents égaux sur le critère principal conservent ainsi un ordre déterministe.

## TODO et documents spéciaux

La sélection inclut `special_role`. Le TODO permanent apparaît donc dans le catalogue avec un badge discret, tout en restant exclu de l’arborescence normale.

## Corbeille

La clause `WHERE d.deleted_at IS NULL` exclut les documents supprimés. La corbeille reste un mode séparé.

## Dirty state

Ouvrir le catalogue ne passe pas par le garde anti-perte et ne réinitialise ni la sélection, ni le draft React, ni le dirty state, ni le contexte d’autosave.

Choisir une autre ligne réutilise `handleSelectDocument()` et son garde existant. Une annulation laisse le catalogue et le brouillon intacts.

## Ouverture depuis le catalogue

Un clic sur toute la ligne ouvre le document par le flux de sélection existant. La ligne courante porte `aria-selected` et une classe visuelle `selected`. Les lignes sont focalisables et Entrée ouvre également le document.

## Performance et volume transféré

Le catalogue transfère uniquement neuf champs légers par document. Il ne charge aucun grand texte. Aucune pagination, virtualisation ou seconde requête `COUNT(*)` n’a été ajoutée ; le compteur utilise la longueur du résultat.

## Index existants / décision d’indexation

Les index existants couvrent déjà notamment `updated_at` et `folder_id`. Aucun nouvel index n’a été ajouté : aux volumes actuels, les tris complets des autres colonnes ne justifient pas d’alourdir le schéma.

## Tests DB

Le nouveau `test:catalog` vérifie : colonnes exactes, absence de `content`/`notes`, jointure dossier, non-classé, favori booléen, TODO présent, corbeille absente, six tris dans les deux directions, tie-breaker stable et rejet des champs/directions arbitraires. Sa base et son répertoire sont temporaires puis supprimés.

## Tests UI

Le test renderer vérifie la vue centrale, les six colonnes, le tri initial, les requêtes IPC `updated_at DESC`, `updated_at ASC` et `title ASC`, l’exclusion de la corbeille, l’ouverture par clic, l’ouverture par Entrée, la ligne sélectionnée, la conservation d’un draft dirty, le garde sur une autre ligne et la présence du TODO.

## Découvrabilité

L’accès visible « Tous les textes » dans le panneau de navigation reste l’entrée unique. Aucun menu natif supplémentaire n’a été ajouté.

## Vérifications effectuées

- build TypeScript renderer, Vite et Electron : succès ;
- contrat DB catalogue : succès ;
- contrat preload : succès ;
- invariants renderer : succès ;
- non-régression DB : succès ;
- TODO spécial : succès ;
- propagation des erreurs IPC : succès ;
- schéma confirmé à `CURRENT_SCHEMA_VERSION = 3` ;
- aucune dépendance ajoutée ;
- aucune bibliothèque ni donnée utilisateur réelle utilisée.

Les messages d’erreur SQLite forcés affichés par certains tests sont attendus : ils valident les chemins de récupération et les commandes terminent avec le code `0`.

## Commandes lancées

```powershell
git status --short
git diff --stat
npm.cmd run build
npm.cmd run test:catalog
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
npm.cmd run test:db
npm.cmd run test:special-todo
npm.cmd run test:ipc-error
git diff --check
git status --short
git diff --stat
git diff --name-only
```

Le test UI a été relancé pendant l’adaptation de ses références DOM au remplacement temporaire de l’éditeur par le catalogue ; la version finale passe.

## Versionnement

Version applicative : `0.1.23` → `0.1.24` dans `package.json` et `package-lock.json`.

Version de schéma : `3`, inchangée. Aucune migration SQLite.

## Points non traités

- recherche avancée et FTS ;
- filtres combinés ;
- pagination, virtualisation et navigation complexe au clavier ;
- nouvelles colonnes ou statistiques ;
- fonction particulière au double clic.

## Risques / limites

Le catalogue charge toutes les métadonnées actives en une fois. Ce choix est volontaire pour les volumes actuels ; une très grande bibliothèque pourra justifier plus tard pagination ou virtualisation, sans modifier le principe DB-first.

Le confort visuel des proportions, de la densité et du scroll horizontal reste à juger humainement sur une bibliothèque réelle.

## Suite recommandée

Faire un contrôle visuel rapide avec les deux panneaux visibles puis masqués. La Mission 037 pourra réutiliser cette vue pour afficher des résultats produits par le futur moteur de recherche, sans refondre le contrat du catalogue avant que ce besoin soit précis.
