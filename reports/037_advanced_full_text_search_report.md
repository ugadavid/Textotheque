# Rapport — Recherche plein texte avancée

## Objectif

Remplacer la recherche renderer en mémoire par une recherche documentaire explicite, légère et DB-first, combinant FTS5 pour `title`, `content` et `notes` avec SQL pour la période de création et l’exclusion de la corbeille.

## État initial

Textothèque 0.1.24 utilisait le schéma SQLite 3 et filtrait une liste de documents côté renderer. Le catalogue central SQL de la Mission 036 était déjà disponible et a été conservé comme composant de présentation commun.

Le worktree était propre au démarrage de la mission.

## Fichiers modifiés

- moteur DB, migration et contrats : `electron/database.ts` ;
- IPC et preload : `electron/main.ts`, `electron/preload.cts`, `src/types/electron.d.ts` ;
- service et types renderer : `src/services/search.ts`, `src/types/search.ts` ;
- UI : `src/App.tsx`, `src/components/DocumentCatalog.tsx`, `src/components/EditorPane.tsx`, `src/components/NavigationPane.tsx`, `src/components/StatusBar.tsx`, `src/styles/app.css` ;
- schéma, version et documentation : `db/schema.sql`, `package.json`, `package-lock.json`, `AGENTS.md`, `docs/DB_ROADMAP.md` ;
- tests Electron concernés et nouveau `scripts/electron-search-check.cjs`.

## Architecture de recherche

Le flux est désormais : React → service `searchDocuments()` → preload → IPC commun → `TextothequeDatabase.searchDocuments()` → FTS5 + SQL → résultat catalogue léger.

`listDocumentCatalog()` demeure une API simple et distincte. Le renderer ne reçoit ni les contenus complets ni les notes pour rechercher ou trier.

## Migration SQLite 3 → 4

`CURRENT_SCHEMA_VERSION` passe de 3 à 4. La migration crée la table virtuelle et ses triggers, reconstruit l’index depuis les lignes existantes, exécute la vérification de cohérence external-content, puis seulement le mécanisme de migration positionne `user_version` à 4.

La reconnaissance des schémas connus, l’inspection en lecture seule et la validation finale prennent désormais en compte la table FTS et les trois triggers.

## Table FTS5

`documents_fts` est une table FTS5 external-content reliée à `documents(id)`. `documents` reste l’unique source de vérité métier ; aucune seconde copie documentaire autonome n’a été créée.

Les tables shadow internes sont laissées à FTS5 et ne sont pas présentées dans `db/schema.sql` comme modèle métier.

## Tokenizer CI_AI

Le tokenizer est fixé à `unicode61 remove_diacritics 2`. La recherche latine ignore donc la casse et les diacritiques, sans option UI supplémentaire, stemming, trigramme ou regex.

## Synchronisation par triggers

Trois triggers explicites maintiennent l’index : insertion, suppression physique et mise à jour des seules colonnes `title`, `content` ou `notes`. Le trigger d’UPDATE possède aussi une condition de différence réelle.

Les modifications de favori, statut, dossier, corbeille logique et timestamps ne réindexent pas le texte. La corbeille logique est exclue dans la requête applicative par `d.deleted_at IS NULL`.

## Reconstruction initiale

La migration exécute la commande FTS5 `rebuild` après création des triggers afin d’indexer les documents déjà présents dans une bibliothèque de schéma 3. Aucun rebuild automatique n’est effectué au démarrage normal.

## Vérification de cohérence

La migration et les tests utilisent `integrity-check` avec `rank = 1`, ce qui compare l’index external-content à la table `documents`. Un helper DB explicite permet également aux tests de vérifier cette cohérence après les mutations.

## Zones de recherche

Les domaines fermés `title | content | notes` sont exposés par trois cases à cocher, toutes actives par défaut. Une requête textuelle sans zone sélectionnée ne déclenche aucun IPC et affiche « Choisissez au moins une zone de recherche. ».

Aucun nom de colonne libre provenant du renderer n’est concaténé en SQL ou en FTS.

## Construction sûre des requêtes FTS

Chaque valeur utilisateur est entourée de doubles quotes FTS5 et les doubles quotes internes sont doublés. Les champs sont résolus par une table de correspondance fermée. Des saisies contenant opérateurs, parenthèses, préfixes de colonne ou caractères spéciaux restent du texte et ne deviennent jamais une syntaxe FTS brute.

## Modes all / any / phrase

Les modes sont limités à `all | any | phrase`. Les mots sont cités puis assemblés avec `AND` ou `OR`; le mode phrase cite la saisie complète. Toute valeur hors domaine est refusée.

## Recherche temporelle

Le domaine fermé `all | last7days | last15days | last30days | thisYear` est transmis comme preset. Le filtre `created_at >= borne` est exécuté dans la même requête SQL que le `MATCH` lorsque du texte est présent.

## Bornes locales et timestamps UTC

Le helper part du minuit civil local du jour de référence, recule de 6, 14 ou 29 jours, ou revient au 1er janvier local. La date obtenue est ensuite convertie par `toISOString()` pour rester compatible avec les timestamps UTC persistés.

## Recherche date-only

Une recherche vide avec période utilise une requête SQL classique, sans clause `MATCH`, et trie par défaut sur `created_at DESC`. La même voie légère peut présenter toutes les dates lorsque l’utilisateur ouvre explicitement la recherche avancée sans texte.

## Pertinence BM25

Une recherche textuelle utilise `bm25(documents_fts)` et l’ordre initial `relevance ASC, id ASC`, sans pondération cachée. La mention « Pertinence » est visible dans le catalogue. Les clics sur les colonnes relancent une requête DB avec une expression de tri issue d’une liste fermée.

## Snippets

FTS5 produit un extrait d’environ 24 tokens avec deux marqueurs Unicode internes. React découpe cet extrait en nœuds texte et éléments `<mark>` ; aucun `dangerouslySetInnerHTML` n’est utilisé.

## Catalogue des résultats

`DocumentCatalog` présente maintenant aussi les résultats de recherche, leurs snippets éventuels, les critères avancés et les tris SQL. L’ancienne liste complète de résultats à gauche a été supprimée : le panneau gauche reste consacré à la navigation.

Le résultat IPC ne contient que les métadonnées de catalogue, `snippet` et `relevance`; il ne contient ni `content` ni `notes`.

## Dirty state et ouverture

L’ouverture d’un résultat repasse par `handleSelectDocument()` et conserve donc le dirty guard existant. Le document complet n’est chargé qu’après cette sélection. Les critères restent en mémoire lorsque l’éditeur est ouvert et peuvent être rouverts depuis le bouton de recherche avancée.

Escape efface le texte et la période, invalide la requête en vol et quitte le mode résultats. Les zones et le mode restent mémorisés pour la session.

## Changement de bibliothèque

Chaque recherche possède un identifiant de génération. Toute modification des critères, sortie des résultats ou bascule de bibliothèque invalide immédiatement les retours antérieurs. Une réponse tardive de la bibliothèque A ne peut donc pas remplacer l’état de B.

## Backup et migration

Le mécanisme existant `better-sqlite3.backup()` suffit à sauvegarder la table virtuelle, ses tables shadow et ses triggers. Le test bibliothèque vérifie qu’un snapshot reste ouvrable et recherchable. Le flux d’inspection, consentement, backup pré-migration, migration puis bascule atomique n’a pas été contourné.

## Tests FTS

Le nouveau `test:search` couvre la migration 3 → 4, l’indexation initiale, INSERT, UPDATE du titre/contenu/notes, mutation de métadonnées sans rebuild, suppression physique, corbeille, restauration, TODO spécial, intégrité et résultat léger.

Les tests legacy et bibliothèque vérifient aussi respectivement la migration des données existantes et la recherche dans un backup.

## Tests CI_AI

Les variantes `Éléphant`, `elephant`, `ELEPHANT`, ainsi que `école`, `ecole`, `ÉCOLE`, retrouvent les mêmes tokens contrôlés.

## Tests temporels

Un jour de référence injectable valide les bornes locales des périodes 7, 15 et 30 jours et de l’année courante. Les cas exactement à la borne et juste avant, date seule, et texte combiné à une période sont couverts.

## Tests UI

Le parcours Electron vérifie les valeurs par défaut, les zones, l’absence de requête sans zone, le mode `any`, la date seule, le tri manuel côté DB, le snippet rendu en `<mark>`, l’absence de doublon à gauche, le TODO, le debounce, une réponse lente obsolète et une bascule de bibliothèque pendant une requête en vol.

## Performance et volume transféré

Le debounce est fixé à 250 ms. Recherche, période et tri sont entièrement exécutés par SQLite. La requête sélectionne explicitement les colonnes légères et n’utilise pas `SELECT d.*`. Aucun index SQL classique ni dépendance n’a été ajouté.

## Découvrabilité

La barre globale et `Ctrl+F` sont conservés. Un bouton « Recherche avancée » est visible dans le catalogue et l’éditeur, y compris pour démarrer une recherche date-only. Aucun menu `Édition` artificiel n’a été ajouté.

## Vérifications effectuées

Toutes les commandes demandées ont terminé avec le code 0 : build, migration legacy, DB, preload, UI safeguards, propagation IPC, bibliothèques, catalogue, TODO spécial, autosave et recherche. Les logs `SQLITE_FORCED` des tests UI/IPC sont les erreurs volontairement injectées et attendues.

Les scénarios utilisent exclusivement des répertoires temporaires contrôlés ; aucune bibliothèque ni aucun registre utilisateur réel n’a été ouvert.

## Commandes lancées

```powershell
git status --short
git diff --stat
npm.cmd run test:search
npm.cmd run test:legacy-migration
npm.cmd run test:library
npm.cmd run test:special-todo
npm.cmd run test:ui-safeguards
npm.cmd run test:db
npm.cmd run test:preload
npm.cmd run test:catalog
npm.cmd run test:autosave
npm.cmd run test:ipc-error
npm.cmd run build
git status --short
git diff --stat
git diff --name-only
git diff --check
```

`test:electron-sqlite` n’a pas été nécessaire séparément : `test:search` est lui-même exécuté dans Electron avec `better-sqlite3` et exerce réellement FTS5, y compris `MATCH`, `snippet`, `bm25`, `rebuild` et `integrity-check`.

## Versionnement

- version applicative : 0.1.24 → 0.1.25 ;
- version de schéma : 3 → 4.

## Points non traités

Les filtres dossier/statut/favori/date personnalisée/date de modification/rôle spécial restent réservés à la Mission 038. Les recherches enregistrées, regex, préfixes, `NEAR`, stemming, trigrammes et pondérations de colonnes ne sont pas ajoutés.

## Risques / limites

Le classement BM25 est volontairement brut et non pondéré. Les règles CI_AI proviennent de `unicode61` et ciblent les diacritiques latins pris en charge par SQLite, sans prétention à une normalisation linguistique universelle.

La migration d’une vraie bibliothèque reste volontairement un test humain via le lancement normal et le flux de consentement existant.

## Suite recommandée

Faire le contrôle humain prévu : variantes accent/casse, combinaisons de zones, trois modes, périodes seules et combinées, lisibilité des snippets, retour éditeur/résultats et confort du catalogue. Les filtres structurés supplémentaires pourront ensuite être ajoutés sans modifier le contrat FTS.
