# Rapport — Numérotation automatique bornée

## Objectif

Recentrer la numérotation automatique introduite par la Mission 034 sur son domaine métier réel :

```text
tot_YYYYMMDD_01
...
tot_YYYYMMDD_99
```

Le calcul du maximum doit être effectué clairement par SQLite, sans charger les titres dans TypeScript, sans `BigInt` et sans permettre au générateur de produire `_100`.

## État hérité de Mission 034

La Mission 034 était terminée mais non commitée. Le worktree contenait ses modifications attendues dans la couche DB, les tests, la version `0.1.22` et son rapport. Aucun nettoyage, reset ou écrasement n’a été effectué.

L’implémentation héritée :

1. sélectionnait en SQLite tous les titres possédant le préfixe du jour ;
2. ramenait ces chaînes dans un tableau TypeScript ;
3. appliquait une expression régulière et une boucle ;
4. calculait le maximum avec `BigInt` ;
5. autorisait naturellement `_100` et au-delà.

La transaction autour du calcul et de l’insertion était déjà correcte et a été conservée.

## Pourquoi le domaine est borné

Textothèque est un outil personnel local. Le besoin fonctionnel est de numéroter au maximum 99 créations automatiques par jour et par bibliothèque, pas de fournir un espace numérique arbitraire.

La constante explicite :

```ts
MAX_AUTOMATIC_DOCUMENTS_PER_DAY = 99
```

exprime cette décision métier. Ce n’est ni une limite technique de JavaScript, ni une contrainte imposée aux titres librement saisis par l’utilisateur.

## Fichiers modifiés

Modifications propres au correctif 034b :

- `electron/database.ts` ;
- `scripts/electron-auto-title-check.cjs` ;
- `scripts/electron-ui-safeguards-check.cjs` ;
- `reports/034b_bounded_automatic_titles_report.md`.

Les autres fichiers déjà modifiés ou ajoutés dans le worktree appartiennent à la Mission 034 non commitée et ont été préservés, notamment `package.json`, `package-lock.json`, `scripts/electron-db-check.cjs` et `reports/034_automatic_document_titles_report.md`.

## Responsabilité SQLite / application

Le calcul du maximum est une opération ensembliste simple : filtrer des lignes, extraire un suffixe numérique borné et calculer `MAX`. SQLite est le niveau naturel pour l’exécuter sans transférer une collection de titres vers l’application.

TypeScript conserve les responsabilités applicatives lisibles :

- construire le préfixe à partir du jour local ;
- fournir la borne métier `99` à la requête ;
- refuser la création si cette borne est atteinte ;
- former le titre suivant sur exactement deux chiffres ;
- effectuer l’insertion dans la transaction existante.

Le principe retenu est équilibré : une base de données n’est pas un dépotoir de valeurs brutes que l’application doit systématiquement aspirer pour reconstruire en mémoire des opérations ensemblistes simples. Inversement, toute logique métier n’a pas vocation à être forcée dans une requête SQL lorsque l’application l’exprime plus clairement.

## Requête de calcul du maximum

La requête utilise :

```sql
SELECT COALESCE(
  MAX(CAST(substr(title, @suffix_start, 2) AS INTEGER)),
  0
) AS maximum_suffix
FROM documents
WHERE length(title) = @title_length
  AND substr(title, 1, @prefix_length) = @prefix
  AND substr(title, @suffix_start, 2) GLOB '[0-9][0-9]'
  AND CAST(substr(title, @suffix_start, 2) AS INTEGER)
      BETWEEN 1 AND @maximum_allowed
```

Les paramètres rendent explicites le préfixe du jour, sa longueur, la position du suffixe, la longueur totale attendue et la borne métier.

La combinaison de la longueur exacte et du `GLOB '[0-9][0-9]'` exclut notamment :

- `_1` ;
- `_001` ;
- `_AB` ;
- `_12foo` ;
- `_test` ;
- `_100`.

`CAST` ne s’applique donc qu’à deux caractères déjà validés comme chiffres. La condition `BETWEEN 1 AND 99` exclut aussi `_00`.

Aucun `SELECT title ...` suivi d’une boucle TypeScript ne subsiste dans le calcul principal. `BigInt` a été entièrement supprimé de cette fonctionnalité.

## Domaine 01–99

Le helper `isAutomaticDocumentTitle()` reconnaît désormais strictement :

```text
^tot_\d{8}_(?:0[1-9]|[1-9]\d)$
```

Il accepte `_01` à `_99` et refuse `_00`, `_1`, `_001` et `_100`.

La génération continue d’utiliser `MAX + 1` sans combler les trous :

```text
01, 02, 07
→ 08
```

Le test confirme également :

```text
98
→ 99
```

## Limite atteinte

Après le calcul SQL, si le maximum vaut `99`, `createDocument()` lève une erreur applicative simple avant toute insertion :

```text
Impossible de créer un nouveau document :
la limite de 99 documents automatiques pour aujourd'hui est atteinte.
```

Le test mesure le nombre total de documents actifs et supprimés logiquement avant et après la tentative. Les deux valeurs restent identiques : aucune ligne partielle ou mutation n’est produite.

Le mécanisme IPC existant conserve sa journalisation et son fallback utilisateur standard en cas d’appel depuis l’interface. Le détail de la limite reste présent à la source DB et dans les logs techniques, tandis que le renderer ne présente pas de faux succès.

## Corbeille

La requête ne contient volontairement aucune condition sur `deleted_at`. Les documents actifs et en corbeille appartiennent au même espace réservé.

Le scénario ciblé place `tot_20260816_99` en corbeille, tente une création, vérifie le refus et confirme que le nombre total de lignes reste inchangé. La corbeille ne libère donc aucun numéro.

## Titres manuels

Un titre manuel strictement compris dans le domaine participe au maximum :

```text
tot_20260816_42
→ prochain automatique = tot_20260816_43
```

Un titre manuel hors domaine reste autorisé comme donnée utilisateur, mais n’étend pas le générateur :

```text
tot_20260816_100 seul
→ prochain automatique = tot_20260816_01
```

Aucune contrainte SQLite globale, validation de champ ou modification de `updateDocument()` n’a été ajoutée.

Le resserrement du helper automatique aligne aussi le nettoyage des brouillons : seuls les titres automatiques stricts `_01` à `_99` sont reconnus comme tels. Un titre manuel `_100` ne devient pas un brouillon automatique par simple ressemblance.

## Atomicité

La transaction de Mission 034 est conservée autour de :

```text
vérification du dossier
→ calcul SQL du maximum
→ vérification de la borne
→ insertion
→ relecture du document créé
```

Une exception à la limite interrompt la transaction avant l’`INSERT`. Aucun compteur externe, cache, table, trigger, index ou verrou supplémentaire n’est introduit.

## Tests

`test:auto-title` couvre désormais :

- séquence normale `_01`, `_02`, `_03` ;
- trou `_01`, `_02`, `_07` puis `_08` ;
- maximum valide `_98` puis `_99` ;
- refus après `_99` actif, sans nouvelle ligne ;
- refus après `_99` en corbeille, sans nouvelle ligne ;
- titre manuel valide `_42` puis `_43` ;
- `_100` seul ignoré, puis génération `_01` ;
- motifs `_1`, `_001`, `_AB`, `_12foo`, `_test` ignorés ;
- reconnaissance stricte du helper `_01–_99` ;
- nouveau jour local ;
- bibliothèques indépendantes ;
- dossiers, titres utilisateur, anciens `Sans titre` et nettoyage des brouillons hérités de Mission 034.

Le mock de création de `test:ui-safeguards` utilise lui aussi un suffixe strict à deux chiffres et refuse son maximum interne à `99`, sans alourdir le parcours UI avec 99 créations artificielles.

## Vérifications effectuées

Les cinq validations demandées terminent avec le code `0` :

| Commande | Résultat |
|---|---|
| `npm.cmd run build` | TypeScript renderer/main et build Vite valides |
| `npm.cmd run test:db` | comportements DB et nettoyage valides |
| `npm.cmd run test:auto-title` | SQL `MAX`, domaine strict, limites et atomicité validés |
| `npm.cmd run test:ui-safeguards` | création UI et erreurs existantes préservées |
| `npm.cmd run test:autosave` | autosave et snapshots inchangés |

Les rejets visibles dans les tests UI et autosave sont leurs scénarios négatifs attendus. Chaque commande atteint son message final de succès.

`test:text-export` n’a pas été relancé dans la matrice finale : ni le code d’export, ni le titre proposé par l’export n’ont été modifiés par 034b. Sa compatibilité avait déjà été validée par la Mission 034.

Les tests DB utilisent uniquement leurs répertoires `%TEMP%\textotheque-test-*`, ferment les connexions avant nettoyage et confirment la suppression via le helper partagé. Aucun retry nouveau n’a été ajouté ou nécessaire.

## Commandes lancées

```powershell
Get-Content -Raw README.md
Get-Content -Raw AGENTS.md
Get-Content -Raw docs/DB_ROADMAP.md
Get-Content -Raw reports/015_project_state_audit.md
Get-Content -Raw reports/034_automatic_document_titles_report.md
git status --short
git diff --stat
rg -n "BigInt|matchingTitles|SELECT title|maximum_suffix|MAX_AUTOMATIC" electron/database.ts scripts/electron-auto-title-check.cjs
npm.cmd run build
node --check scripts/electron-auto-title-check.cjs
npm.cmd run test:auto-title
npm.cmd run build
npm.cmd run test:db
npm.cmd run test:auto-title
npm.cmd run test:ui-safeguards
npm.cmd run test:autosave
git status --short
git diff --stat
git diff --name-only
git diff --check
```

## Versionnement

La version reste `0.1.22`. La Mission 034 n’étant pas encore commitée, 034b consolide le même état fonctionnel avant commit.

`CURRENT_SCHEMA_VERSION` reste à `2`. Aucune migration, table, colonne, dépendance ou modification de `db/schema.sql` n’est introduite.

## Points non traités

- remplissage des trous dans la séquence ;
- compteurs externes ou persistants ;
- support multi-instance concurrent ;
- contrainte globale sur les titres utilisateur ;
- index spécialisé ou optimisation prématurée ;
- changement du mécanisme commun d’erreur IPC ;
- modification rétroactive des bibliothèques existantes.

## Risques / limites

La limite repose sur le maximum existant, conformément au contrat. Si `_99` existe, la création est refusée même si des trous plus bas sont disponibles. Si `_99` est renommé vers un titre hors domaine, le maximum peut redescendre et la séquence reprendre après le nouveau maximum réel.

Le message détaillé de limite appartient à la couche DB. Le wrapper IPC commun protège toujours les détails techniques et le renderer conserve son fallback générique de création ; une future mission dédiée aux erreurs métier pourrait transporter des codes publics structurés si le besoin UX se confirme, sans affaiblir la consolidation IPC existante.

La requête répète l’expression `CAST(substr(...))` dans `MAX` et dans la borne. À l’échelle personnelle actuelle, cette répétition reste plus lisible qu’une sous-requête ou un CTE ajouté uniquement pour éviter quelques caractères.

## Recommandation AGENTS.md

Proposition de formulation pérenne, à intégrer dans une mission séparée :

> Utiliser SQLite pour les opérations ensemblistes simples qu’il exprime clairement — filtrage, agrégation, existence, maximum, comptage — plutôt que de charger systématiquement des lignes pour les retraiter en mémoire. Garder dans TypeScript la logique applicative, les décisions métier et les transformations qui y restent plus lisibles. Ne jamais forcer une logique complexe dans SQL uniquement par principe : placer chaque responsabilité là où elle est la plus claire, bornée, testable et efficace.

`AGENTS.md` n’a pas été modifié pendant cette mission.
