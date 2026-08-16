# Rapport — Titres automatiques des nouveaux documents

## Objectif

Remplacer le titre initial générique ou vide des nouveaux documents par un titre court, journalier et naturellement triable au format :

```text
tot_YYYYMMDD_NN
```

La génération doit appartenir à la bibliothèque SQLite active, inclure la corbeille dans son calcul et préserver le fonctionnement existant des dossiers, du dirty state, de l’autosave et de l’export.

Le worktree était propre au début de la mission.

## État initial

`TextothequeDatabase.createDocument()` insérait un titre vide `''` dans SQLite. Le texte `Sans titre` visible dans l’éditeur et l’arborescence était seulement un fallback renderer : placeholder dans `EditorPane`, transformation d’affichage dans `NavigationPane` et helper `titleForEditing()` dans `App`.

L’autosave n’attribuait pas le titre initial. Il persistait seulement le draft React après une modification.

## Diagnostic de "Sans titre"

La valeur canonique de création était donc vide, pas littéralement `Sans titre`. Le fallback UI masquait cette distinction, tandis que le nettoyage historique des brouillons vides reconnaissait les deux formes : titre vide ou `Sans titre`.

La génération devait être placée dans `createDocument()`, seul point partagé par le canal `documents:create`, `Ctrl+N`, le bouton Nouveau et la création contextualisée dans un dossier.

Les documents historiques ne font l’objet d’aucune mise à jour. Un test confirme qu’un document existant intitulé `Sans titre` conserve exactement cette valeur.

## Fichiers modifiés

- `electron/database.ts` ;
- `scripts/electron-auto-title-check.cjs` ;
- `scripts/electron-db-check.cjs` ;
- `scripts/electron-ui-safeguards-check.cjs` ;
- `package.json` ;
- `package-lock.json` ;
- `reports/034_automatic_document_titles_report.md`.

## Point canonique de génération

La génération vit exclusivement dans `TextothequeDatabase.createDocument()`.

Le flux est :

```text
documents:create
→ DB active
→ vérification du dossier
→ calcul du jour local
→ lecture des titres correspondants
→ MAX(suffixe) + 1
→ insertion du nouveau document
```

La recherche, le calcul et l’insertion sont regroupés dans une transaction `better-sqlite3`. Cela fournit l’atomicité raisonnable attendue pour l’application locale mono-instance sans table de compteur ni mécanisme distribué.

Le second paramètre optionnel `creationDate` de `createDocument()` sert uniquement à rendre les tests déterministes. Le flux applicatif normal ne le fournit pas et utilise `new Date()`.

## Format du titre

Le titre produit respecte :

```text
tot_YYYYMMDD_NN
```

Le suffixe est complété à deux chiffres au minimum avec `padStart(2, '0')`. Il n’est jamais tronqué : le test confirme le passage de `_99` à `_100`.

Le calcul utilise `BigInt` pour comparer les suffixes numériques sans dépendre d’une limite arbitraire de compteur JavaScript.

## Date locale

`localDocumentTitleDate()` construit le jour avec :

- `getFullYear()` ;
- `getMonth() + 1` ;
- `getDate()`.

Il n’utilise pas `toISOString().slice(...)`. Un test lui fournit un calendrier local contrôlé correspondant au 17 août 2026 et attend `20260817`.

Les timestamps persistés restent en UTC ISO 8601. À la création, la même instance `Date` produit le titre avec ses composantes locales et `created_at` / `updated_at` / `last_opened_at` avec `toISOString()` ; les deux conventions restent donc volontairement distinctes.

## Numérotation journalière

La DB sélectionne les titres commençant par le préfixe exact du jour actif, puis TypeScript applique le motif complet :

```text
^tot_YYYYMMDD_(\d+)$
```

Le prochain suffixe vaut `MAX + 1`, jamais le nombre de lignes.

Le test confirme :

- aucun titre du jour → `_01` ;
- `_01`, `_02` → `_03` ;
- `_01`, `_02`, `_07` → `_08` ;
- nouveau jour → nouveau compteur `_01`.

Les titres `Soutenance`, `tot_notes`, `tot_20260816` et `tot_20260816_test` sont ignorés.

## Corbeille et collisions

La requête de calcul ne filtre pas `deleted_at`. Un titre en corbeille participe donc au maximum au même titre qu’un document actif.

Le test vérifie :

```text
_01 actif
_02 corbeille
→ nouveau = _03
```

Un titre manuel correspondant exactement au motif, par exemple `tot_20260816_42`, est également pris en compte. Cela évite de produire un futur titre automatique identique.

## Titres manuels

La génération intervient uniquement lors de la création initiale. `updateDocument()` ne rappelle jamais le générateur et continue de persister le titre fourni par le draft après son trim habituel.

Un document renommé `Idées soutenance`, puis autosauvegardé avec du contenu, conserve ce titre. Aucun titre existant n’est remplacé parce qu’il ressemble ou non au format automatique.

Un document neuf ne commence plus avec un titre vide. Si l’utilisateur efface volontairement le titre après la création, la règle historique d’édition reste inchangée : les espaces sont trimés et aucun renommage automatique tardif n’est déclenché. Cette séparation évite d’accrocher le générateur à l’autosave ou d’écraser une action explicite après création.

## Bibliothèques indépendantes

Le calcul lit seulement la connexion détenue par l’instance courante de `TextothequeDatabase`. Aucun compteur n’existe dans le profil, le registre des bibliothèques, `localStorage` ou un fichier externe.

Le test ouvre deux bibliothèques temporaires indépendantes : après `_01` et `_02` dans A, le premier document créé dans B reçoit bien `_01`.

Les protections de bascule atomique existantes ne sont pas modifiées.

## Brouillons vides

Le nettoyage au démarrage aurait ignoré un brouillon vide portant désormais un titre `tot_…`, car son ancienne condition ne reconnaissait que le titre vide et `Sans titre`.

`cleanupEmptyDraftDocuments()` sélectionne maintenant les candidats réellement vides selon les mêmes critères métier :

- `plain` ;
- statut `draft` ;
- non favori ;
- actif ;
- contenu vide ;
- notes vides.

Il ne met à la corbeille que ceux dont le titre est vide, `Sans titre` ou correspond au motif automatique exact. Les mises à jour sont regroupées dans une transaction et restent des suppressions logiques.

Le test ferme puis rouvre une bibliothèque contenant un nouveau brouillon automatique strictement vide. Le document conserve son titre et apparaît en corbeille avec `deleted_at`, sans suppression physique.

Comme historiquement avec `Sans titre`, un titre manuel volontairement identique au motif automatique est indiscernable d’un titre généré. Un tel document strictement vide, draft et non favori est donc considéré comme nettoyable ; contenu, notes, statut ou favori continuent de le protéger.

## Dirty state et autosave

Le titre automatique est déjà persisté dans l’objet renvoyé par la création puis appliqué comme baseline par `App`. Il ne crée pas un faux dirty state et ne programme aucun autosave spécifique.

Les modifications ultérieures de titre, contenu ou métadonnées continuent de passer par le mécanisme de la Mission 031. Le délai, les snapshots, les retours obsolètes et la protection multi-bibliothèque n’ont pas été modifiés.

`test:autosave` reste vert.

## Compatibilité export

L’export utilise déjà le titre courant du draft pour son nom proposé. Le test ciblé appelle le helper existant avec `tot_20260816_03` et obtient :

```text
tot_20260816_03.txt
```

Aucune modification du système d’export n’a été nécessaire. `test:text-export` reste vert.

## Tests

Le nouveau script `electron-auto-title-check.cjs`, exposé par `npm.cmd run test:auto-title`, travaille exclusivement sous un répertoire `%TEMP%\textotheque-test-auto-title-*` créé et supprimé par le helper partagé.

Il couvre :

- premier titre du jour ;
- incrément `_01`, `_02`, `_03` ;
- trou jusqu’à `_07`, puis `_08` ;
- corbeille incluse ;
- titre manuel `_42`, puis `_43` ;
- titres sans rapport ignorés ;
- suffixe `_100` ;
- changement de jour local ;
- bibliothèques A et B indépendantes ;
- création contextualisée dans un dossier ;
- titre utilisateur conservé ;
- document historique `Sans titre` non renommé ;
- nettoyage logique du brouillon automatique vide ;
- nom d’export `.txt` naturel.

Le test UI en mémoire génère lui aussi des titres déterministes `tot_20260816_NN` et vérifie leur présence pour `Ctrl+N`, le bouton Nouveau, les dossiers et sous-dossiers avant leur renommage manuel.

## Vérifications effectuées

Les six validations finales ciblées ont terminé avec le code `0` :

| Commande | Résultat |
|---|---|
| `npm.cmd run build` | TypeScript renderer/main et build Vite valides |
| `npm.cmd run test:db` | création DB, timestamps, dossiers, corbeille et nettoyage valides |
| `npm.cmd run test:ui-safeguards` | tous les points d’entrée UI et garde-fous existants préservés |
| `npm.cmd run test:autosave` | autosave et snapshots inchangés |
| `npm.cmd run test:text-export` | export texte inchangé |
| `npm.cmd run test:auto-title` | génération déterministe et multi-bibliothèque validée |

Les rejets forcés visibles dans `test:ui-safeguards` et `test:autosave` sont les scénarios négatifs attendus. Chaque script atteint son message final de succès.

Aucun retry n’a été ajouté ou nécessaire. Les tests DB et auto-title ferment leurs connexions avant de nettoyer uniquement leur répertoire temporaire propriétaire, puis vérifient sa disparition via le helper partagé.

## Commandes lancées

```powershell
Get-Content -Raw README.md
Get-Content -Raw AGENTS.md
Get-Content -Raw docs/DB_ROADMAP.md
Get-Content -Raw reports/015_project_state_audit.md
Get-Content -Raw reports/031_prudent_autosave_report.md
Get-Content -Raw reports/033_editor_tab_insertion_report.md
git status --short
git diff --stat
rg -n "Sans titre|createDocument|cleanup|brouillon|titleForEditing|documents:create" electron src scripts db
npm.cmd run build
node --check scripts/electron-auto-title-check.cjs
npm.cmd run test:auto-title
npm.cmd run test:db
npm.cmd run test:ui-safeguards
npm.cmd run build
npm.cmd run test:db
npm.cmd run test:ui-safeguards
npm.cmd run test:autosave
npm.cmd run test:text-export
npm.cmd run test:auto-title
git status --short
git diff --stat
git diff --name-only
git diff --check
```

## Versionnement

La version applicative passe de `0.1.21` à `0.1.22` dans `package.json` et `package-lock.json`. `package.json` reste la source canonique.

`CURRENT_SCHEMA_VERSION` reste à `2`. Aucune table, colonne, migration, dépendance ou modification de `db/schema.sql` n’est introduite.

## Points non traités

- renommage rétroactif des documents `Sans titre` ;
- compteur global ou persistant hors SQLite ;
- tri ou recherche supplémentaires ;
- préférence de format du titre ;
- gestion multi-instance ou verrou distribué ;
- modification de l’autosave ;
- migration de données.

## Risques / limites

L’atomicité correspond au modèle actuel mono-instance : transaction SQLite locale autour du calcul et de l’insertion. Deux processus distincts travaillant simultanément sur le même fichier ne constituent pas un cas pris en charge par cette mission.

Le compteur reflète les titres qui existent au moment de la création. Si l’utilisateur renomme ensuite le seul `_01` vers un titre ordinaire, `_01` peut naturellement redevenir disponible puisque la règle demandée est `MAX` des titres existants, sans registre externe.

Le nettoyage des brouillons reconnaît la forme générale `tot_` suivie de huit chiffres et d’un suffixe numérique. Il ne tente pas de valider qu’une date calendaire comme `20261340` est réelle, car ces titres manuels restent syntaxiquement dans l’espace réservé et doivent participer aux collisions selon leur motif exact.

## Suite recommandée

Créer humainement deux ou trois documents dans la bibliothèque courante, vérifier l’incrément réel du jour, renommer l’un d’eux puis en créer un autre. La future mission de tri/recherche pourra exploiter ce format naturellement ordonné sans ajouter aujourd’hui une nouvelle logique de classement.
