# Rapport — Correction migration deleted_at sur base existante

## Objectif

Corriger l'initialisation SQLite afin qu'une base Textotheque creee avant la corbeille, donc sans colonne `deleted_at`, soit migree automatiquement sans erreur au demarrage.

## Symptôme initial

Au lancement avec `npm.cmd run dev` sur une base existante, Electron affichait :

```text
SqliteError: no such column: deleted_at
```

L'erreur apparaissait notamment dans les handlers `documents:list` et `documents:list-deleted`.

## Diagnostic

La Mission 007 avait ajoute `deleted_at` et un index `idx_documents_deleted_at`.

Sur une base neuve, le schema complet fonctionnait. Sur une base legacy deja creee, `CREATE TABLE IF NOT EXISTS documents` ne modifie pas la table existante. Le bloc `schema` tentait ensuite de creer un index sur `deleted_at` avant que la migration `ALTER TABLE documents ADD COLUMN deleted_at TEXT` ait garanti l'existence de la colonne.

La correction devait donc porter sur l'ordre d'initialisation, sans supprimer ni recreer la base utilisateur.

## Fichiers modifiés

- `electron/database.ts`
- `package.json`
- `package-lock.json`
- `scripts/electron-legacy-migration-check.cjs`
- `reports/008_deleted_at_legacy_migration_fix_report.md`

Des fichiers modifies par les missions 006 et 007 restent presents dans le worktree.

## Correction apportée

- Passage de version de `0.1.6` a `0.1.7`.
- Separation de la creation de table et de la creation des index.
- Ajout d'une etape explicite `runMigrations()` appelee avant toute creation d'index dependant de colonnes migrees.
- Conservation de `CREATE INDEX IF NOT EXISTS idx_documents_deleted_at` apres migration.
- Ajout d'un script `test:legacy-migration`.
- Ajout du test Electron `scripts/electron-legacy-migration-check.cjs`.

## Ordre d’initialisation SQLite

Le constructeur de `TextothequeDatabase` suit maintenant cet ordre :

1. ouvrir la base ;
2. appliquer `journal_mode = WAL` ;
3. creer la table `documents` si elle n'existe pas ;
4. executer les migrations de colonnes, dont `deleted_at` ;
5. creer les index ;
6. nettoyer les brouillons vides par mise en corbeille logique.

Aucune requete utilisant `deleted_at` ne doit s'executer avant l'etape de migration.

## Test de migration legacy

Le nouveau test `npm.cmd run test:legacy-migration` :

- cree une base temporaire avec l'ancien schema sans `deleted_at` ;
- insere un document legacy ;
- initialise `TextothequeDatabase` sur cette base ;
- verifie que `deleted_at` est ajoute ;
- verifie que le document reste actif avec `deleted_at = NULL` ;
- verifie que `listDocuments()` le retourne ;
- verifie que `listDeletedDocuments()` est vide ;
- met le document a la corbeille ;
- restaure le document ;
- verifie que le contenu est conserve.

## Vérifications effectuées

- `npm.cmd run build` : OK.
- `npm.cmd run test:legacy-migration` : OK.
- `npm.cmd run test:db` : OK.
- `npm.cmd run test:electron-sqlite` : OK.
- `npm.cmd run test:preload` : OK.
- `npm.cmd run test:ui-safeguards` : OK.
- Lancement court semi-automatise de `npm.cmd run dev` sur la base existante : Vite et Electron demarrent, stderr vide, pas de message `no such column: deleted_at`.
- Verification qu'aucun processus dev Textotheque lance pour le test ne reste actif.

## Commandes lancées

```text
npm.cmd run build
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
npm.cmd run dev
git status --short
git diff --stat
```

## Points non traités

- Pas de suppression definitive.
- Pas de vidage de corbeille.
- Pas de Markdown.
- Pas d'import/export.
- Pas de refonte de l'architecture.
- Pas de changement fonctionnel de la corbeille.

## Risques / limites

- Le test legacy couvre le schema documentaire V0.1 avant `deleted_at`, mais pas toutes les variantes futures possibles de schema.
- Le lancement `npm.cmd run dev` a ete court et semi-automatise ; il valide le demarrage et l'absence de l'erreur observee, pas une session manuelle longue.
- Les messages Windows/GPU/os_crypt non bloquants peuvent encore apparaitre dans certains tests Electron avec code de sortie 0.

## Suite recommandée

- Conserver les migrations futures dans une sequence explicite : creation table, migrations de colonnes, index, puis operations applicatives.
- Ajouter un test legacy a chaque prochaine migration SQLite sensible.
- Eviter de placer dans le bloc initial de schema des index qui dependent de colonnes ajoutees par migration.
