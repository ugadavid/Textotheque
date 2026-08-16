# Rapport — TODO permanent par bibliothèque

## Objectif

Ajouter à chaque bibliothèque Textothèque un document TODO permanent, stocké comme un document SQLite normal, créé paresseusement au premier accès et accessible depuis toute l’interface sans introduire de stockage, format ou autosave parallèle.

## État initial

Textothèque était en version applicative `0.1.22` et au schéma SQLite `2`. Les documents ne possédaient aucun rôle métier spécial. La numérotation automatique des nouveaux documents, l’autosave, la recherche générale, les backups et le changement atomique de bibliothèque étaient déjà présents et ont été préservés.

Le worktree a été inspecté avant modification avec `git status --short` et `git diff --stat`. Aucun reset, nettoyage ou commit n’a été effectué.

## Choix du modèle

Le TODO reste une ligne de la table `documents`. Il utilise les mêmes champs de titre, contenu, statut, format, classement, notes et timestamps que les autres documents.

La seule distinction persistante est :

```text
special_role = 'todo'
```

Aucun fichier `todo.json` ou `todo.txt`, aucune donnée `localStorage`, aucune table TODO et aucun éditeur spécialisé n’ont été ajoutés.

## Migration SQLite 2 → 3

`CURRENT_SCHEMA_VERSION` passe de `2` à `3`.

La migration explicite et transactionnelle :

1. ajoute `documents.special_role` ;
2. ajoute son domaine fermé avec un `CHECK` ;
3. crée l’index unique partiel après l’existence de la colonne ;
4. met `PRAGMA user_version` à `3` seulement après réussite.

Les lignes historiques reçoivent naturellement `special_role = NULL`. La fixture v2 ciblée confirme la conservation du document, de son titre automatique, de son contenu, de ses notes, de son favori, de son dossier et des dossiers existants.

Une base neuve est créée directement au schéma 3, sans TODO prérempli.

## Domaine `special_role`

Le domaine actuel est strictement :

```text
NULL
'todo'
```

SQLite l’exprime par :

```sql
CHECK (special_role IS NULL OR special_role IN ('todo'))
```

TypeScript l’exprime par :

```ts
type SpecialDocumentRole = 'todo';
```

`TextDocument.special_role` vaut `SpecialDocumentRole | null`. `DocumentInput` n’expose pas ce champ : l’édition documentaire normale ne peut donc pas changer le rôle.

## Contrainte d’unicité

L’invariant « au plus un document par rôle et par bibliothèque » est garanti par SQLite :

```sql
CREATE UNIQUE INDEX idx_documents_special_role_unique
ON documents(special_role)
WHERE special_role IS NOT NULL;
```

Le test ciblé tente une seconde insertion `todo` directement en SQLite et vérifie son refus. Il vérifie également le refus d’un rôle hors domaine tel que `inbox`.

## Création paresseuse

La primitive dédiée `getOrCreateSpecialDocument('todo')` exécute dans une transaction :

```text
recherche par special_role
→ retour de l’existant
ou
→ insertion du TODO
→ relecture et retour
```

Le renderer n’émule pas cette opération avec une liste suivie d’une création normale. Une bibliothèque neuve reste à zéro TODO tant que le bouton ou le raccourci n’est pas utilisé.

Le dirty guard est évalué avant l’appel IPC. Une annulation ne crée donc aucune ligne TODO.

## Document TODO

À sa création, le document possède :

- titre `TODO` ;
- `special_role = 'todo'` ;
- `content_format = 'plain'` ;
- statut `active` ;
- contenu et notes vides ;
- non favori ;
- aucun dossier.

Le titre initial est librement modifiable. Les accès suivants retrouvent le document par son rôle, jamais par son titre.

La création du TODO ne passe pas par `createDocument()` et ne consomme aucun titre `tot_YYYYMMDD_NN`. Le test vérifie la séquence `_01`, création du TODO, puis `_02`.

## Protection contre la corbeille

Dans le renderer, l’action Corbeille n’est pas rendue pour le TODO. Le handler défensif refuse aussi l’opération si elle était appelée autrement.

Dans la couche DB, `trashDocument()` relit le document et lève une erreur lorsqu’un `special_role` est présent. Le test confirme que `deleted_at` reste `NULL` après la tentative.

## Nettoyage des brouillons

`cleanupEmptyDraftDocuments()` impose désormais :

```sql
special_role IS NULL
```

Un TODO rendu volontairement vide, `draft`, non favori et sans notes survit donc à une fermeture/réouverture, même s’il satisfait tous les autres critères historiques de nettoyage.

## Navigation normale

`listDocuments()` reste une API générale et retourne le TODO.

Le filtrage est localisé dans les données utilisées par :

- l’arbre des dossiers ;
- la pseudo-section « Non classés » ;
- les compteurs propres à ces sections.

Le TODO n’apparaît donc pas dans l’arborescence normale, sans être exclu du reste de Textothèque.

## Recherche et Tous les textes

La recherche continue à travailler sur la liste générale des documents actifs. Un mot présent uniquement dans le TODO produit bien un résultat permettant de l’ouvrir.

La vue « Tous les textes » reçoit également la liste générale et inclut le TODO. Les compteurs généraux de documents actifs l’incluent, tandis que les compteurs de dossiers et de « Non classés » l’excluent conformément à leur sens visuel.

## Bouton TODO

Un bouton compact `TODO` est ajouté à la barre de l’éditeur. Son infobulle est :

```text
Ouvrir le TODO — Ctrl+Shift+T
```

Quand le document courant porte `special_role = 'todo'`, le bouton reçoit une classe active discrète et `aria-pressed="true"`.

Un clic lorsque le TODO est déjà courant est un no-op : aucune création, sauvegarde ou recharge inutile.

## Raccourci Ctrl+Shift+T

Le mécanisme clavier existant intercepte `Ctrl+Shift+T`, appelle le même parcours que le bouton et empêche le comportement Chromium associé.

`Ctrl+T`, `Ctrl+Tab` et `Shift+Tab` n’ont pas été modifiés.

## Dirty state et autosave

L’ouverture du TODO réutilise le dirty guard commun aux changements de document. Le test UI vérifie successivement :

- document normal modifié ;
- clic TODO ;
- annulation ;
- absence de TODO créé ;
- second clic et confirmation ;
- création puis ouverture.

Une fois ouvert, le TODO utilise strictement l’autosave commun : dirty state, debounce de 1,5 seconde, `documents:update`, contrôle du contexte et mise à jour de la baseline. Aucun `todoAutosave()` n’existe.

## Changement de bibliothèque

Le rôle est recherché dans la connexion SQLite active. Aucun identifiant TODO global n’est conservé dans React, le preload, le registre de bibliothèques ou `localStorage`.

Le test ciblé crée deux bibliothèques temporaires A et B, puis vérifie que leurs TODO et contenus restent indépendants.

## Backup et migration

Le backup utilise toujours `better-sqlite3.backup()` sans traitement spécial. Les tests vérifient que le snapshot conserve le rôle, l’identifiant et le contenu du TODO.

Le workflow existant d’inspection, consentement, backup pré-migration, migration et bascule atomique n’a pas été contourné. Avec le schéma courant 3, une bibliothèque externe v2 est détectée comme ancienne et passe par le workflow existant. Les règles de fallback au démarrage restent inchangées.

## Tests `special-todo`

La nouvelle commande est :

```powershell
npm.cmd run test:special-todo
```

Elle couvre sur ressources temporaires :

- zéro TODO dans une base neuve ;
- création paresseuse ;
- réouverture du même document ;
- unicité SQLite ;
- domaine SQLite fermé ;
- bibliothèques A et B indépendantes ;
- titre initial et renommage ;
- absence de consommation d’un numéro automatique ;
- persistance par mise à jour documentaire normale ;
- présence dans la liste générale utilisée par la recherche ;
- refus de corbeille ;
- survie au nettoyage startup ;
- conservation dans un backup ;
- migration d’une vraie fixture v2 signée TEXO.

`test:ui-safeguards` couvre les invariants renderer : dirty guard avant création, bouton, état actif, autosave, recherche, arbre, « Tous les textes », raccourci et no-op.

## Tests legacy

`test:legacy-migration` attend désormais le schéma 3, la colonne `special_role`, l’index unique et `special_role = NULL` pour les documents historiques.

Les scénarios v0, v1 et v2 restent migrables. Une réouverture au schéma courant ne rejoue pas les migrations. Les bases plus récentes que 3 restent refusées via `CURRENT_SCHEMA_VERSION + 1` dans les tests existants.

## Ressources temporaires

Tous les tests DB de la mission utilisent uniquement des répertoires :

```text
%TEMP%\textotheque-test-*
```

Les connexions sont fermées avant suppression. Les helpers vérifient que chaque répertoire propriétaire a disparu. Aucun test n’a ouvert une bibliothèque utilisateur réelle ni son registre réel.

## Vérifications effectuées

Les quatorze commandes demandées ont terminé avec le code `0` :

| Commande | Résultat |
|---|---|
| `npm.cmd run build` | build TypeScript, Vite et Electron valide |
| `npm.cmd run test:app-identity` | identité et chemins applicatifs valides |
| `npm.cmd run test:legacy-migration` | migrations historiques vers le schéma 3 valides |
| `npm.cmd run test:db` | opérations DB historiques préservées |
| `npm.cmd run test:electron-sqlite` | ABI Electron / better-sqlite3 valide |
| `npm.cmd run test:preload` | nouvelle API et rejets récupérables valides |
| `npm.cmd run test:ui-safeguards` | parcours TODO et garde-fous UI valides |
| `npm.cmd run test:ipc-error` | propagation IPC historique valide |
| `npm.cmd run test:library` | backup, migration et bascule valides |
| `npm.cmd run test:library-history` | historique et startup valides |
| `npm.cmd run test:autosave` | autosave et contextes concurrents valides |
| `npm.cmd run test:text-export` | export texte partagé valide |
| `npm.cmd run test:auto-title` | numérotation bornée inchangée |
| `npm.cmd run test:special-todo` | invariants TODO complets valides |

Les traces d’erreurs forcées visibles dans plusieurs tests sont leurs scénarios négatifs attendus. Chaque script atteint son message final de succès.

## Commandes lancées

```powershell
Get-Content -Raw README.md
Get-Content -Raw AGENTS.md
Get-Content -Raw docs/DB_ROADMAP.md
Get-Content -Raw reports/015_project_state_audit.md
Get-Content -Raw reports/018_schema_migrations_report.md
Get-Content -Raw reports/028_library_identity_backup_report.md
Get-Content -Raw reports/029_open_library_migration_workflow_report.md
Get-Content -Raw reports/030_persistent_library_management_report.md
Get-Content -Raw reports/031_prudent_autosave_report.md
Get-Content -Raw reports/034_automatic_document_titles_report.md
Get-Content -Raw reports/034b_bounded_automatic_titles_report.md
git status --short
git diff --stat
rg --files
rg -n "..." electron src scripts db AGENTS.md docs/DB_ROADMAP.md
npm.cmd run build
npm.cmd run test:special-todo
npm.cmd run test:legacy-migration
npm.cmd run test:preload
npm.cmd run test:library
npm.cmd run test:ui-safeguards
npm.cmd run test:app-identity
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:ipc-error
npm.cmd run test:library-history
npm.cmd run test:autosave
npm.cmd run test:text-export
npm.cmd run test:auto-title
```

## Versionnement

La version applicative passe de `0.1.22` à `0.1.23` dans `package.json` et `package-lock.json`.

Le schéma SQLite passe de `2` à `3`. `db/schema.sql`, `AGENTS.md` et l’état courant explicite de `docs/DB_ROADMAP.md` sont synchronisés.

Aucune dépendance n’a été ajoutée ou modifiée.

## Points non traités

- raccourcis métier propres au TODO ;
- insertion de date, checkbox ou séparateur ;
- réinitialisation ou suppression volontaire du TODO ;
- rôles futurs tels que `inbox` ou `scratchpad` ;
- syntaxe structurée, Markdown, JSON ou AST ;
- jugement esthétique du placement, réservé au mainteneur.

## Risques / limites

Le TODO est permanent au travers des API applicatives actuelles et de la protection renderer. Comme toute base SQLite locale, une modification manuelle avec un outil SQL externe reste hors du contrat de l’application.

Le `CHECK` ferme volontairement le domaine à `todo`. L’introduction future d’un autre rôle nécessitera une migration contrôlée du schéma, ce qui est le comportement souhaité.

L’index unique partiel garantit un seul document par rôle, mais il ne constitue pas un mécanisme multi-instance distribué. Le modèle d’usage reste celui de l’application desktop locale actuelle.

## Suite recommandée

Effectuer le test humain prévu : placement et état du bouton, création au premier clic, quelques lignes laissées à l’autosave, retour par `Ctrl+Shift+T`, recherche d’un mot propre au TODO, absence de l’arbre et indépendance lors d’un changement de bibliothèque.

Les futures aides d’édition TODO devront continuer à produire du contenu texte normal et ne justifieront un nouveau rôle ou format persistant qu’en présence d’un besoin réel observé.
