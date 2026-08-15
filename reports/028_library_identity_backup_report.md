# Rapport — Identité de bibliothèque et sauvegarde complète

## Objectif

Donner à chaque bibliothèque Textothèque une identité SQLite stable, permettre son inspection sans modification et fournir une commande de snapshot complet, cohérent et vérifié sans changer la bibliothèque active.

## État initial

Les bibliothèques utilisaient `PRAGMA user_version = 2`, mais aucun `application_id`. Le constructeur activait WAL puis reconnaissait les bases historiques à partir de quelques éléments structurels. Le renderer ne connaissait ni le chemin ni le nom du fichier actif. Aucune sauvegarde complète n'était disponible dans l'application.

Le dépôt était propre au début de la mission.

## Fichiers modifiés

- `electron/database.ts`
- `electron/main.ts`
- `electron/preload.cts`
- `src/App.tsx`
- `src/components/EditorPane.tsx`
- `src/components/StatusBar.tsx`
- `src/services/library.ts`
- `src/styles/app.css`
- `src/types/electron.d.ts`
- `src/types/library.ts`
- `scripts/electron-library-check.cjs`
- `scripts/electron-legacy-migration-check.cjs`
- `scripts/electron-preload-api-check.cjs`
- `scripts/electron-ui-safeguards-check.cjs`
- `docs/DB_ROADMAP.md`
- `package.json`
- `package-lock.json`
- `reports/028_library_identity_backup_report.md`

## application_id retenu

La constante définitive est :

```text
TEXTOTHEQUE_APPLICATION_ID
hex       : 0x5445584F
decimal   : 1413830735
mnemonic  : TEXO
```

Elle identifie le format Textothèque. Elle reste indépendante de la version applicative `0.1.16` et de la version de schéma `2`.

## Bases neuves

Le constructeur mémorise si le fichier existait avant l'ouverture. Pour un fichier absent, il crée le schéma courant dans une transaction, puis attribue `user_version = 2` et `application_id = TEXO` avant validation.

`CURRENT_SCHEMA_VERSION` reste strictement à `2`. Aucune table, colonne, migration ou modification de `db/schema.sql` n'est introduite.

## Adoption des bases legacy

Une base non signée n'est adoptable que si ses tables et ensembles de colonnes correspondent exactement à l'un des trois états historiques connus :

- documents v0, avant corbeille ;
- documents v1, avec `deleted_at` ;
- documents et dossiers v2, avec `folder_id`.

La version déclarée doit être cohérente avec cette structure. Les migrations existantes s'exécutent ensuite normalement. La signature TEXO n'est écrite qu'après migration et validation réussies. Une interruption avant cette dernière écriture laisse une base encore reconnaissable au prochain démarrage.

Les quatre scénarios legacy existants sont conservés et vérifient désormais explicitement le passage `application_id = 0` vers TEXO.

## Refus des bases étrangères

Le constructeur lit `application_id` et `user_version` avant `PRAGMA journal_mode = WAL`.

- Une signature non nulle différente de TEXO est refusée immédiatement.
- Une SQLite non signée dont la structure ne correspond pas exactement aux états historiques est refusée.
- Une bibliothèque déclarant un schéma supérieur à 2 est refusée sans downgrade.
- Une bibliothèque signée TEXO mais structurellement incohérente est refusée avant WAL.

Le test dédié compare les octets d'une base étrangère avant et après inspection/refus, puis contrôle sa signature, sa version, sa table et son contenu.

## Inspection non destructive

`inspectTextothequeLibrary()` ouvre le fichier avec `readonly: true` et `fileMustExist: true`. Elle ne construit pas `TextothequeDatabase` et ne déclenche donc ni WAL, ni migration, ni index, ni nettoyage de brouillons, ni opération documentaire.

Elle retourne :

- chemin absolu et nom du fichier ;
- lisibilité SQLite ;
- `application_id` ;
- `user_version` ;
- identité Textothèque ;
- état `compatible`, `legacy-textotheque`, `too-new`, `foreign` ou `invalid`.

## Information bibliothèque courante

`TextothequeDatabase.getLibraryInfo()` expose le chemin résolu, le nom du fichier, la signature et la version de schéma. Le canal `library:get-info` traverse le main process, le preload et un service renderer dédié. Aucun accès au système de fichiers n'est donné au renderer.

## Snapshot SQLite

`TextothequeDatabase.backupTo()` utilise l'API `backup()` de la version déjà installée de `better-sqlite3`. Cette primitive SQLite crée un snapshot cohérent de la base ouverte en WAL ; aucune copie naïve du fichier principal et aucune dépendance supplémentaire ne sont utilisées.

Le chemin actif reste inchangé. La source reste ouverte et utilisable après la sauvegarde. Une comparaison canonique, insensible à la casse sous Windows et résolue par `realpath` lorsque possible, interdit source et destination identiques.

Le canal `library:backup` ouvre un dialogue Electron natif avec :

- un nom proposé `<bibliothèque>_backup_YYYY-MM-DD_HHmm.sqlite` ;
- le filtre SQLite ;
- la confirmation d'écrasement native ;
- un refus utilisateur explicite si la destination est la bibliothèque courante.

Une annulation retourne un résultat neutre et ne crée aucune erreur.

## Vérification du backup

Après `backup()`, la destination est inspectée en lecture seule. Le succès n'est retourné que si elle est :

- lisible ;
- signée TEXO ;
- en `user_version = 2` ;
- structurellement compatible.

Le test dédié vérifie aussi la présence de documents actifs et en corbeille, contenu, notes, favori, affectation et hiérarchie de dossiers. Il confirme ensuite que la source, son chemin, sa version et ses données restent inchangés.

## UI minimale

La barre de statut affiche discrètement `Bibliothèque : <nom>.sqlite` et place le chemin complet dans l'infobulle.

La barre haute propose `Copie bibliothèque…`, distinct de la sauvegarde documentaire. Le bouton reste disponible sans document sélectionné et se désactive pendant la création du snapshot.

Le renderer affiche un message simple après succès, traite l'annulation sans feedback d'erreur et réutilise la gestion d'erreurs de la Mission 022 en cas d'échec. Aucun chemin technique, code SQLite, stack ou framework de notifications n'est exposé.

## Tests identité

`npm.cmd run test:library` couvre :

- base neuve signée TEXO en schéma 2 ;
- information de bibliothèque courante ;
- adoption d'une base v2 non signée ;
- refus sans mutation d'une base signée étrangère ;
- refus sans mutation d'une SQLite arbitraire non signée ;
- inspection `compatible`, `legacy-textotheque`, `foreign`, `too-new` et `invalid` ;
- refus runtime d'une base trop récente ;
- immutabilité de l'identifiant définitif et de `CURRENT_SCHEMA_VERSION`.

## Tests backup

Le même test couvre :

- création du snapshot avec `better-sqlite3.backup()` ;
- inspection compatible de la destination ;
- conservation identité/version ;
- contenu représentatif complet ;
- source encore utilisable et inchangée ;
- source et destination distinctes ;
- refus de sauvegarder par-dessus la source ;
- nettoyage final de la source, du backup et de toutes les fixtures.

Le test UI vérifie l'action, l'annulation neutre, le message de succès et le fallback d'échec sans détail technique. Le test preload verrouille les deux nouvelles méthodes exposées.

## Compatibilité legacy

Les quatre fixtures historiques restent couvertes. Chaque fixture démarre avec `application_id = 0`, conserve ses données et termine signée TEXO en schéma 2. L'adoption de la structure courante non versionnée ne rejoue toujours aucun DDL.

## Ressources temporaires

Le nouveau test réutilise exclusivement `createTestTempDirectory('library')` et `removeTestTempDirectory()`. Toutes les connexions source, inspection et destination sont fermées avant suppression. Le message de succès n'est émis qu'après nettoyage.

Le lancement développement a utilisé un dossier `textotheque-mission-028-dev-*` sous `%TEMP%`, validé par son chemin absolu et son préfixe avant suppression. Résultat final : `TEMP_EXISTS=False`.

## Vérifications effectuées

| Commande | Résultat | Code |
|---|---|---:|
| `npm.cmd run build` | TypeScript, Vite et Electron compilés | 0 |
| `npm.cmd run test:app-identity` | identité Electron et chemin DB | 0 |
| `npm.cmd run test:legacy-migration` | schéma 2, TEXO, 4 scénarios | 0 |
| `npm.cmd run test:db` | comportements DB existants | 0 |
| `npm.cmd run test:electron-sqlite` | Electron 33.4.11 / better-sqlite3 11.10.0 | 0 |
| `npm.cmd run test:preload` | API preload enrichie | 0 |
| `npm.cmd run test:ui-safeguards` | UI existante et backup minimal | 0 |
| `npm.cmd run test:ipc-error` | propagation réelle des erreurs | 0 |
| `npm.cmd run test:library` | identité, inspection et snapshot | 0 |

Les traces `forced preload rejection` et `SQLITE_FORCED` sont volontairement injectées. Tous les messages finaux attendus sont atteints.

## Commandes lancées

```powershell
git status --short
git diff --stat
rg --files electron src scripts db
rg -n "CURRENT_SCHEMA_VERSION|user_version|application_id|backup|ipcMain|contextBridge" electron src scripts db
node --check scripts/electron-library-check.cjs
node --check scripts/electron-legacy-migration-check.cjs
node --check scripts/electron-preload-api-check.cjs
node --check scripts/electron-ui-safeguards-check.cjs
npm.cmd run build
npm.cmd run test:app-identity
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
npm.cmd run test:ipc-error
npm.cmd run test:library
npm.cmd run dev
git status --short
git diff --stat
git diff --name-only
git diff --check
```

## Versionnement

La version applicative passe de `0.1.15` à `0.1.16` dans `package.json` et `package-lock.json`. `CURRENT_SCHEMA_VERSION` reste à `2`. Aucun package ni numéro de dépendance n'est modifié.

## Recommandations futures pour AGENTS.md

- Considérer `TEXTOTHEQUE_APPLICATION_ID = 0x5445584F` comme un invariant permanent du format.
- Distinguer systématiquement version applicative, `application_id` et `user_version`.
- Inspecter en lecture seule toute base choisie manuellement avant migration ou écriture.
- Refuser sans downgrade une base plus récente ou une signature étrangère.
- Exiger un snapshot SQLite vérifié avant toute future migration utilisateur explicite.
- Interdire tout test sur une bibliothèque utilisateur réelle.

`AGENTS.md` n'a pas été modifié dans cette mission.

## Points non traités

- Ouverture ou création manuelle d'une autre bibliothèque.
- Bibliothèques récentes et changement de base.
- UX de migration utilisateur et backup pré-migration automatique.
- Backup périodique, rotation, fusion, synchronisation ou cloud.
- Import/export documentaire.
- Nouvelle version de schéma ou modification structurelle SQLite.
- Inspection ergonomique longue du dialogue et du placement, réservée au mainteneur.

## Risques / limites

La reconnaissance des anciennes bases non signées est volontairement stricte. Une base Textothèque historique modifiée manuellement avec des tables ou colonnes supplémentaires sera refusée au lieu d'être adoptée silencieusement ; cette prudence protège les bases étrangères.

Le snapshot contient l'état persistant SQLite au moment de l'appel. Comme Textothèque conserve une sauvegarde documentaire explicite, un texte encore uniquement présent dans le dirty state du renderer ne fait pas partie de la base avant `Ctrl+S`.

Le message de succès reste visible jusqu'à une nouvelle sauvegarde ou un changement d'état pertinent ; aucun système de notifications temporisées n'a été ajouté.

## Suite recommandée

Le mainteneur peut maintenant effectuer son test humain avec la bibliothèque réelle : ouverture/adoption TEXO au premier lancement, lisibilité du nom courant, dialogue Windows et création d'une copie choisie. La Mission 029 pourra ensuite s'appuyer sur l'inspection et le snapshot pour introduire l'ouverture explicite d'une bibliothèque et l'UX de migration sans dupliquer ces fondations.
