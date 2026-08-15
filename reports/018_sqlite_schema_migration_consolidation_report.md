# Rapport — Consolidation du schéma et des migrations SQLite

## Objectif

Mettre en place un mécanisme SQLite explicite, simple et testable pour connaître la version réelle du schéma, migrer les bases historiques dans un ordre déterministe et préparer les futures évolutions sans framework externe.

## État initial

Le schéma exécuté vivait dans `electron/database.ts`, tandis que `db/schema.sql` en constituait une copie non exécutée. Toutes les bases utilisaient implicitement `PRAGMA user_version = 0`.

Deux conditions dispersées dans `runMigrations()` ajoutaient `deleted_at` puis `folder_id`. La table `folders` était créée dans le bloc de schéma avant ces conditions. Les index étaient correctement créés après les migrations depuis la correction historique de la mission 008, mais aucune séquence numérotée ne décrivait les états du modèle.

## Stratégie retenue

La stratégie reste intégrée à `electron/database.ts` et repose sur :

- `PRAGMA user_version` ;
- une constante `CURRENT_SCHEMA_VERSION` ;
- un tableau ordonné de migrations `{ version, name, migrate }` ;
- une transaction par migration ;
- des opérations idempotentes fondées sur `PRAGMA table_info` et `sqlite_master` ;
- une adoption structurale unique des anciennes bases qui n'avaient encore aucune version explicite ;
- une validation de cohérence avant et après migration ;
- la création des index seulement après obtention du schéma courant.

Aucune dépendance, table de journal de migrations, ORM ou générateur n'a été ajouté.

## Source canonique du schéma

La source canonique runtime est désormais explicitement :

```text
electron/database.ts
```

Elle contient le schéma de création courant, la version et la séquence de migrations. `db/schema.sql` reste un snapshot documentaire lisible du schéma v2. Un commentaire en tête précise qu'il n'est pas chargé par l'application.

Le dossier `db/migrations/` reste vide hors `.gitkeep` : y ajouter une seconde séquence SQL aurait recréé une double source de vérité. Une future migration doit être ajoutée au tableau versionné de `electron/database.ts`, puis reflétée dans le snapshot.

## Version de schéma

La version SQLite courante est :

```text
CURRENT_SCHEMA_VERSION = 2
PRAGMA user_version = 2
```

Elle est indépendante de la version applicative `0.1.13`.

Une base déclarant une version supérieure à `2` est refusée avec une erreur claire, afin d'éviter qu'une ancienne application ouvre silencieusement un schéma plus récent.

Pour les bases historiques à `user_version = 0`, la structure est reconnue une seule fois :

- absence de `deleted_at` → état v0 ;
- présence de `deleted_at` seulement → état v1 ;
- présence de `deleted_at`, `folder_id` et `folders` → état v2.

Les structures partielles restent réparables grâce aux opérations idempotentes de la migration suivante. Une version déjà déclarée est contrôlée avant toute progression ; si sa structure obligatoire manque, l'ouverture échoue sans avancer davantage la version.

## Migrations formalisées

### Version 0 → 1

```text
ajout de documents.deleted_at
```

La colonne n'est ajoutée que si elle est absente.

### Version 1 → 2

```text
création de folders
ajout de documents.folder_id
```

La table utilise `CREATE TABLE IF NOT EXISTS` et la colonne n'est ajoutée que si elle est absente.

Une base neuve ne rejoue pas artificiellement toute l'histoire : elle crée directement le schéma courant dans une transaction et reçoit `user_version = 2`.

## Ordre d’initialisation

Le constructeur suit désormais cet ordre :

1. création du répertoire parent et ouverture SQLite ;
2. `PRAGMA journal_mode = WAL` ;
3. création transactionnelle directe du schéma courant pour une base neuve, ou détection de la version d'une base existante ;
4. validation de la structure déclarée ;
5. migrations ordonnées jusqu'à la v2 ;
6. validation du schéma courant ;
7. création idempotente des index ;
8. nettoyage applicatif des brouillons vides.

Aucune requête applicative utilisant `deleted_at`, `folder_id` ou `folders` n'est exécutée avant la fin des migrations et des index.

## Transactions

Chaque migration s'exécute dans une transaction `better-sqlite3`. La mise à jour de `PRAGMA user_version` est la dernière opération de la transaction.

La migration v2 regroupe notamment la création de `folders`, l'ajout éventuel de `folder_id` et la mise à jour de version. Un échec restaure donc les opérations de cette migration et ne déclare pas la v2 à tort.

La création d'une base neuve et l'attribution directe de la v2 sont également transactionnelles.

## Compatibilité legacy

Quatre scénarios temporaires sont couverts :

1. base absente → création directe complète en v2 ;
2. base pré-corbeille sans `deleted_at` → migrations v1 puis v2 ;
3. base historique avec `deleted_at`, sans `folder_id` ni `folders`, encore à `user_version = 0` → adoption v1 puis migration v2 ;
4. base structurellement actuelle, encore à `user_version = 0` → adoption v2 sans rejouer de DDL, puis réouverture sans migration.

Dans les scénarios legacy, les documents, contenus et notes sont conservés. Après migration, les API de liste, corbeille, restauration, création de dossier et affectation à un dossier sont exercées.

Pour la base actuelle non versionnée, `PRAGMA schema_version` est comparé avant adoption, après adoption et après une seconde ouverture. Il reste identique, ce qui confirme qu'aucun DDL inutile n'est rejoué.

## Tests ajoutés ou modifiés

`scripts/electron-legacy-migration-check.cjs` a été restructuré autour de petites fonctions communes et vérifie :

- la version initiale des fixtures historiques ;
- `PRAGMA user_version = 2` après ouverture ;
- `PRAGMA table_info(documents)` ;
- `PRAGMA table_info(folders)` ;
- `PRAGMA index_list(documents)` ;
- `PRAGMA index_list(folders)` ;
- `deleted_at`, `folder_id` et la table `folders` ;
- les cinq index attendus ;
- la préservation des documents ;
- liste, corbeille, restauration et dossiers ;
- l'absence de migration rejouée sur une base déjà actuelle.

Le message final est :

```text
legacy migrations ok: schema 2, 4 scenarios
```

## db/schema.sql

Le snapshot reste synchronisé avec le schéma courant : tables `documents` et `folders`, colonnes actuelles et cinq index.

Son en-tête indique désormais :

```sql
-- Snapshot documentaire du schema SQLite courant (user_version = 2).
-- La source canonique executee et les migrations versionnees vivent dans
-- electron/database.ts. Ce fichier n'est pas charge par l'application.
```

## Clés étrangères

La situation n'a pas été modifiée :

- `folders.parent_id` déclare une FK vers `folders(id) ON DELETE SET NULL` ;
- `documents.folder_id` ne déclare pas de FK ;
- `PRAGMA foreign_keys` n'est pas activé.

Une activation future devra d'abord inventorier et traiter les `parent_id`/`folder_id` orphelins, décider les règles de suppression, synchroniser les deux relations et ajouter des tests legacy dédiés. L'activer brutalement dans cette mission aurait changé le comportement des bases existantes.

## Formats de dates

La dette existante reste inchangée : le schéma utilise `datetime('now')` comme défaut SQL, tandis que les opérations applicatives écrivent principalement `new Date().toISOString()`.

La consolidation des migrations ne dépend pas du format des dates. Leur uniformisation reste une mission séparée.

## Vérifications effectuées

| Commande | Résultat | Code |
|---|---|---:|
| `npm.cmd run build` | build TypeScript/Vite/Electron réussi | 0 |
| `npm.cmd run test:legacy-migration` | schéma v2, 4 scénarios | 0 |
| `npm.cmd run test:db` | `DB check OK` | 0 |
| `npm.cmd run test:electron-sqlite` | `electron sqlite ok` | 0 |
| `npm.cmd run test:preload` | `preload api ok` | 0 |
| `npm.cmd run test:ui-safeguards` | build puis `ui safeguards ok` | 0 |
| `git diff --check` | aucune erreur de whitespace | 0 |

Les tests migration, DB et SQLite ont affiché les avertissements Windows Electron connus `os_crypt_win.cc` et/ou `gpu_process_host.cc`. Leurs assertions ont été atteintes et leurs codes de sortie sont `0`.

Les tests preload et UI ont été exécutés hors sandbox afin que leurs fenêtres cachées puissent charger normalement.

Toutes les bases créées par les tests se trouvent dans `%TEMP%`. La base utilisateur n'a pas été ouverte par la mission.

## Commandes lancées

Lectures et audit :

```powershell
Get-Content -Raw AGENTS.md
Get-Content -Raw README.md
Get-Content -Raw reports\015_project_state_audit.md
Get-Content -Raw reports\007_logical_delete_trash_report.md
Get-Content -Raw reports\008_deleted_at_legacy_migration_fix_report.md
Get-Content -Raw reports\011_virtual_folders_report.md
Get-Content -Raw reports\016_renderer_typescript_output_cleanup_report.md
Get-Content -Raw reports\017_dev_port_reliability_report.md
Get-Content -Raw electron\database.ts
Get-Content -Raw db\schema.sql
Get-Content -Raw scripts\electron-legacy-migration-check.cjs
Get-Content -Raw scripts\electron-db-check.cjs
rg -n "PRAGMA|CREATE TABLE|ALTER TABLE|CREATE INDEX|user_version" ...
git status --short
git diff --stat
```

Validations :

```powershell
npm.cmd run build
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
git status --short
git diff --stat
git diff --name-only
git diff --check
```

## Versionnement applicatif

Textothèque reste en version `0.1.13` dans `package.json`, `package-lock.json` et `src/App.tsx`. Le numéro de schéma SQLite `2` est indépendant. Aucune dépendance n'a été modifiée.

## Points non traités

- Activation et harmonisation des clés étrangères.
- Uniformisation des formats de dates.
- Registre détaillé des migrations appliquées : `user_version` suffit au besoin actuel.
- Suppression automatique des bases temporaires produites par les scripts existants.
- Toute évolution fonctionnelle, UI, IPC, port Vite ou pipeline TypeScript.

## Risques / limites

L'adoption structurale concerne seulement les anciennes bases non versionnées connues. Une base manuellement altérée ou incohérente peut être refusée par les validations ; elle n'est jamais supprimée ou recréée automatiquement.

`db/schema.sql` reste un snapshot maintenu manuellement. Sa fonction est désormais explicite, mais toute future migration doit encore mettre à jour à la fois le runtime canonique et ce document.

Les migrations v1 et v2 reflètent les états historiques observables, pas chaque version applicative intermédiaire.

## Suite recommandée

Pour la prochaine évolution du modèle :

1. incrémenter `CURRENT_SCHEMA_VERSION` ;
2. ajouter une entrée ordonnée et idempotente à `schemaMigrations` ;
3. regrouper les opérations dépendantes dans cette migration ;
4. mettre à jour `currentSchema` et `db/schema.sql` ;
5. ajouter une fixture représentant la version précédente ;
6. vérifier la conservation des données, la nouvelle structure, les index et la version finale.
