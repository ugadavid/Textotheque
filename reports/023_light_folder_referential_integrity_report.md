# Rapport — Cohérence référentielle légère des dossiers

## Objectif

Empêcher la couche applicative SQLite de créer volontairement des références de dossier orphelines, sans migration, sans activation globale des clés étrangères SQLite et sans modifier le modèle fonctionnel existant.

## Symptôme initial

Les méthodes `createDocument`, `updateDocument` et `createFolder` écrivaient directement les identifiants reçus. Un appel avec un `folder_id` ou un `parent_id` inexistant pouvait donc laisser une référence orpheline dans une base où `PRAGMA foreign_keys` n'est pas activé.

## Diagnostic

- `documents.folder_id` est nullable et ne possède pas de contrainte déclarée dans le schéma exécuté.
- `folders.parent_id` possède une déclaration de clé étrangère, mais celle-ci n'est pas appliquée tant que `PRAGMA foreign_keys` reste désactivé.
- Les API actuelles ne permettent ni déplacement ni changement de parent d'un dossier après sa création : aucun moteur de cycle n'était nécessaire dans cette mission.
- Les scénarios legacy inspectés utilisent des références nulles ou valides ; aucune réparation de données historique n'était requise.

## Fichiers modifiés

- `electron/database.ts`
- `scripts/electron-db-check.cjs`
- `src/App.tsx`
- `reports/023_light_folder_referential_integrity_report.md`

`db/schema.sql`, `package.json` et `package-lock.json` ne sont pas modifiés.

## Fonctionnement ajouté ou correction apportée

La couche `TextothequeDatabase` possède désormais un contrôle commun qui :

- accepte `null`, afin de conserver les documents non classés et les dossiers racine ;
- vérifie par `SELECT 1` l'existence de tout dossier non nul ;
- rejette avant toute écriture la création d'un document dans un dossier inexistant ;
- rejette avant toute écriture l'affectation d'un document à un dossier inexistant ;
- rejette avant le calcul de position et l'insertion la création d'un sous-dossier sous un parent inexistant ;
- retourne un message explicite qui contient l'opération et l'identifiant introuvable.

Le renderer conserve le mécanisme centralisé de la mission 022. Ses fallbacks distinguent maintenant :

- l'échec de création d'un dossier racine de celui d'un sous-dossier ;
- l'échec d'une sauvegarde ordinaire de celui d'une nouvelle affectation à un dossier.

## Choix techniques

Le contrôle reste volontairement applicatif et local aux trois écritures concernées. La mission n'active pas `PRAGMA foreign_keys`, ne change pas le schéma, n'introduit pas de migration et ne tente pas de réparer automatiquement une base historique.

La vérification précède la mutation. Ainsi, une affectation invalide ne peut modifier ni le contenu, ni les métadonnées, ni `updated_at` du document existant.

## Tests ajoutés

`scripts/electron-db-check.cjs` couvre désormais :

- l'affectation valide d'un document à un dossier ;
- le retour valide à `folder_id = NULL` ;
- le rejet d'une mise à jour vers le dossier inexistant `999999` ;
- l'identité complète du document avant et après ce rejet ;
- le rejet de la création d'un document dans ce dossier inexistant, sans nouvelle ligne ;
- la création valide d'un dossier racine et d'un enfant ;
- le rejet d'un enfant sous le parent inexistant `999999`, sans nouvelle ligne ;
- un diagnostic SQL final comptant les documents orphelins, actifs ou supprimés logiquement ;
- un diagnostic SQL final comptant les dossiers dont le parent est absent.

Les deux compteurs d'orphelins doivent être égaux à zéro.

## Migration SQLite

Aucune migration n'est ajoutée. `CURRENT_SCHEMA_VERSION` reste à `2` et l'ordre d'initialisation existant est inchangé.

## Compatibilité legacy

Les quatre scénarios de migration legacy passent sans modification. Le contrôle intervient uniquement lors de nouvelles écritures applicatives ; l'ouverture d'une base existante n'est pas rendue plus stricte et aucune donnée n'est supprimée ou réécrite automatiquement.

## Vérifications effectuées

| Commande | Résultat | Code |
|---|---|---:|
| `npm.cmd run build` | TypeScript, Vite et Electron compilés | 0 |
| `npm.cmd run test:app-identity` | identité, `userData` et chemin DB cohérents | 0 |
| `npm.cmd run test:legacy-migration` | schéma 2, quatre scénarios legacy | 0 |
| `npm.cmd run test:db` | cas valides, rejets atomiques et diagnostics d'orphelins réussis | 0 |
| `npm.cmd run test:electron-sqlite` | Electron 33.4.11 et `better-sqlite3` 11.10.0 compatibles | 0 |
| `npm.cmd run test:preload` | API preload et rejet contrôlé vérifiés | 0 |
| `npm.cmd run test:ui-safeguards` | parcours UI et erreurs forcées réussis | 0 |
| `npm.cmd run test:ipc-error` | rejet IPC attrapé et assaini côté renderer | 0 |
| `git diff --check` | aucune erreur de whitespace | 0 |

Les trois tests ouvrant une fenêtre cachée ont d'abord rencontré un refus d'accès au cache Electron dans le bac à sable (`ERR_FAILED`). Ils ont été relancés hors bac à sable et ont alors atteint toutes leurs assertions avec un code `0`. Les erreurs `SQLITE_FORCED` et `forced preload rejection` affichées pendant ces tests sont les échecs volontairement injectés par leurs scénarios.

Les avertissements Windows Electron connus `os_crypt_win.cc` et `gpu_process_host.cc` sont apparus sur certains tests DB/legacy ; les messages finaux attendus ont été atteints et les codes de sortie sont `0`.

## Test réel en développement

`npm.cmd run dev` a été lancé avec :

```text
TEXTOTHEQUE_DB_PATH=C:\Users\david\AppData\Local\Temp\textotheque-mission-023-dev.sqlite
```

Le parcours effectué dans la fenêtre Electron réelle a confirmé :

1. création d'un document ;
2. saisie et sauvegarde d'un titre et d'un contenu ;
3. création d'un dossier racine ;
4. création d'un sous-dossier ;
5. choix du sous-dossier dans les métadonnées du document ;
6. sauvegarde de l'affectation ;
7. présence du document sous l'enfant dans l'arborescence et compteur `Non classés` ramené à zéro.

La session a ensuite été arrêtée volontairement par `Ctrl+C`. Aucun listener n'est resté sur le port `5173`. La base utilisateur réelle n'a pas été utilisée.

## Commandes lancées

Lectures et diagnostic :

```powershell
Get-Content -Raw AGENTS.md
Get-Content -Raw README.md
Get-Content -Raw reports/015_project_state_audit.md
Get-Content -Raw reports/011_virtual_folders_report.md
Get-Content -Raw reports/012_folder_rename_and_context_creation_report.md
Get-Content -Raw reports/013_documents_in_folder_tree_report.md
Get-Content -Raw reports/018_sqlite_schema_migration_consolidation_report.md
Get-Content -Raw reports/022_ipc_error_handling_consolidation_report.md
Get-Content -Raw electron/database.ts
Get-Content -Raw db/schema.sql
Get-Content -Raw scripts/electron-db-check.cjs
Get-Content -Raw scripts/electron-legacy-migration-check.cjs
rg -n "folder_id|parent_id|createDocument|updateDocument|createFolder" ...
git status --short
git diff --stat
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
npm.cmd run dev
Get-NetTCPConnection -LocalPort 5173 -State Listen
git diff --check
git status --short
git diff --stat
```

## Versionnement

La version applicative reste `0.1.13`. Le numéro de schéma SQLite reste `2`. Aucune dépendance et aucun fichier de lock ne sont modifiés.

## Points non traités

- activation globale de `PRAGMA foreign_keys` ;
- ajout de contraintes ou migration de schéma ;
- réparation automatique d'éventuels orphelins historiques ;
- suppression ou déplacement de dossiers ;
- changement de parent et détection de cycles ;
- refonte générale des erreurs IPC ou de l'architecture dossiers.

## Risques / limites

Le contrôle protège les écritures qui passent par les méthodes applicatives actuelles. Il ne constitue pas une contrainte SQLite globale contre une écriture externe directe et ne corrige pas une référence orpheline qui serait déjà présente dans une autre base historique.

## Suite recommandée

Conserver ces garde-fous tant qu'aucune migration dédiée n'active les clés étrangères après audit et réparation contrôlée des données existantes. Si une API de déplacement ou de changement de parent de dossier est ajoutée plus tard, elle devra vérifier l'existence du parent et prévenir les cycles dans sa propre mission.
