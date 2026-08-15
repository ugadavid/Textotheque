# Rapport — Nettoyage des ressources temporaires de test

## Objectif

Garantir que chaque test Textothèque qui crée explicitement une ressource temporaire connaît son chemin exact, ferme ses connexions SQLite, supprime uniquement cette ressource et vérifie sa disparition, en succès comme après exception.

## Diagnostic initial

L'inventaire des scripts a montré deux sources de fichiers SQLite laissés dans `%TEMP%` :

- `electron-db-check.cjs` créait une base horodatée directement à la racine de `%TEMP%`, sans nettoyage ;
- `electron-legacy-migration-check.cjs` créait quatre bases indépendantes directement à la racine de `%TEMP%`, sans nettoyage.

Chaque base utilise le mode WAL du runtime et pouvait donc être accompagnée de fichiers `.sqlite-wal` ou `.sqlite-shm`.

`electron-ipc-error-check.cjs` créait déjà un répertoire unique et le supprimait dans un `finally`. Son approche était sûre, mais ne partageait pas les contrôles de chemin et ne vérifiait pas explicitement que le répertoire avait disparu.

## Scripts concernés

| Script | Ressource temporaire explicite | État initial | Décision |
|---|---|---|---|
| `electron-db-check.cjs` | une base SQLite et ses éventuels WAL/SHM | fichiers dispersés, aucun nettoyage | modifié |
| `electron-legacy-migration-check.cjs` | quatre bases SQLite et leurs éventuels WAL/SHM | fichiers dispersés, aucun nettoyage | modifié |
| `electron-ipc-error-check.cjs` | un répertoire volontairement utilisé comme chemin DB invalide | `finally` déjà présent, sans contrôle commun | modifié légèrement |
| `electron-app-identity-check.cjs` | aucune ; les chemins testés ne sont pas créés | aucun nettoyage nécessaire | inchangé |
| `electron-preload-api-check.cjs` | handlers IPC et données en mémoire | aucune base ou ressource temporaire dédiée | inchangé |
| `electron-ui-safeguards-check.cjs` | handlers IPC et données en mémoire | aucune base ou ressource temporaire dédiée | inchangé |
| `electron-sqlite-smoke.cjs` | base SQLite `:memory:` | connexion déjà fermée | inchangé |
| `rebuild-electron-native.cjs` | aucune ressource temporaire contrôlée par le script | hors tests de données | inchangé |

Les tests Electron graphiques utilisent le profil/cache standard du runtime, mais ne créent pas de profil temporaire dédié dont ils pourraient prouver seuls la propriété. Conformément au brief, aucun fichier sous `%APPDATA%\Textotheque` ou `%APPDATA%\Electron` n'a été supprimé.

## Stratégie retenue

Un petit helper partagé, `scripts/test-temp-directory.cjs`, fournit deux opérations :

- création d'un enfant direct unique de `%TEMP%` avec le préfixe `textotheque-test-` ;
- suppression récursive de ce seul répertoire après validation stricte de son parent et de son préfixe.

Le helper refuse :

- un chemin qui n'est pas un enfant direct de `os.tmpdir()` ;
- un nom qui ne commence pas par `textotheque-test-` ;
- un libellé de création non borné aux lettres minuscules, chiffres et tirets.

Après `fs.rmSync`, il appelle `fs.existsSync` sur le chemin exact et transforme toute présence résiduelle en échec du test. Deux nouvelles tentatives très courtes, espacées de 50 ms, couvrent les verrous Windows brièvement relâchés sans boucle longue.

## Fichiers modifiés

- `scripts/test-temp-directory.cjs` — créé ;
- `scripts/electron-db-check.cjs` ;
- `scripts/electron-legacy-migration-check.cjs` ;
- `scripts/electron-ipc-error-check.cjs` ;
- `reports/025_test_temp_resource_cleanup_report.md` — présent rapport.

Aucun fichier applicatif, schéma, migration, manifeste, lockfile ou composant renderer n'est modifié.

## Répertoires temporaires dédiés

Les structures sont désormais :

```text
%TEMP%\textotheque-test-db-check-<unique>\
└── test.sqlite

%TEMP%\textotheque-test-legacy-migration-<unique>\
├── fresh-schema.sqlite
├── legacy-v0.sqlite
├── legacy-v1.sqlite
└── unversioned-current.sqlite

%TEMP%\textotheque-test-ipc-error-<unique>\
```

La suppression du répertoire dédié inclut naturellement les éventuels fichiers WAL/SHM sans scanner `%TEMP%` ni utiliser de motif global.

## Fermeture SQLite / Electron

`electron-db-check.cjs` suit les connexions runtime et diagnostic encore ouvertes. Son `finally` :

1. ferme chacune des connexions restantes ;
2. collecte les erreurs de fermeture éventuelles ;
3. tente malgré tout le nettoyage du répertoire ;
4. produit un `AggregateError` si une étape de nettoyage échoue.

`electron-legacy-migration-check.cjs` utilise un helper local `withDatabase()` pour fermer chaque connexion de fixture, runtime ou inspection même si une assertion lève une exception. Le répertoire commun aux quatre scénarios est ensuite supprimé dans le `finally` principal.

`electron-ipc-error-check.cjs` conserve son scénario : le processus Electron enfant se termine complètement via `spawnSync` avant la suppression du répertoire invalide.

## Nettoyage en cas de succès

Les messages de succès ne sont émis qu'après le nettoyage. Si la suppression ou la vérification de disparition échoue, la promesse rejette et le test termine avec un code non nul.

Les trois scripts affichent également le chemin exact nettoyé, ce qui permet une vérification externe ciblée sans inventaire global de `%TEMP%`.

## Nettoyage en cas d'échec

`electron-db-check.cjs` accepte uniquement pour la validation de cette mission :

```text
TEXTOTHEQUE_TEST_FORCE_FAILURE=db-check
```

Lorsque cette valeur est présente, il lève une erreur contrôlée après toutes ses assertions DB mais avant le message de succès. Le `finally` reste exécuté.

Résultat observé :

```text
code de sortie : 1
erreur : Echec controle demande apres les assertions DB.
répertoire : C:\Users\david\AppData\Local\Temp\textotheque-test-db-check-1BlUuz
Test-Path après terminaison : False
```

L'échec reste donc visible et non transformé en succès, tandis que sa ressource est supprimée.

Les callbacks d'erreur DB et legacy retentent aussi le nettoyage borné. Cela couvre un éventuel rejet de préparation Electron avant l'entrée dans le bloc principal ; une seconde suppression d'un chemin déjà absent reste sûre grâce à `force: true`.

## Vérifications avant / après

Après les exécutions finales réussies, les chemins suivants ont été contrôlés individuellement :

| Script | Chemin exact | `Test-Path` final |
|---|---|---:|
| DB | `C:\Users\david\AppData\Local\Temp\textotheque-test-db-check-UpzdzJ` | `False` |
| Legacy | `C:\Users\david\AppData\Local\Temp\textotheque-test-legacy-migration-2cJw4B` | `False` |
| IPC erreur | `C:\Users\david\AppData\Local\Temp\textotheque-test-ipc-error-35hHT3` | `False` |
| DB en échec contrôlé | `C:\Users\david\AppData\Local\Temp\textotheque-test-db-check-1BlUuz` | `False` |

Un contrôle supplémentaire a tenté de passer directement `os.tmpdir()` au helper de suppression. Le chemin a été refusé avant toute suppression avec le message attendu `Refus de nettoyer un chemin temporaire non controle`.

## Vérifications effectuées

| Commande | Résultat | Code |
|---|---|---:|
| `node --check` sur les quatre scripts modifiés/créés | syntaxe valide | 0 |
| `npm.cmd run build` | TypeScript, Vite et Electron compilés | 0 |
| `npm.cmd run test:app-identity` | identité, `userData` et chemin DB cohérents | 0 |
| `npm.cmd run test:legacy-migration` | quatre scénarios et nettoyage réussis | 0 |
| `npm.cmd run test:db` | comportements DB et nettoyage réussis | 0 |
| `npm.cmd run test:electron-sqlite` | base mémoire et ABI Electron valides | 0 |
| `npm.cmd run test:preload` | API preload et rejet contrôlé vérifiés | 0 |
| `npm.cmd run test:ui-safeguards` | parcours UI et erreurs forcées réussis | 0 |
| `npm.cmd run test:ipc-error` | rejet IPC et nettoyage réussis | 0 |
| DB avec `TEXTOTHEQUE_TEST_FORCE_FAILURE=db-check` | échec conservé, répertoire supprimé | 1 attendu |
| `git diff --check` | aucune erreur de whitespace | 0 |

Les tests preload, UI et IPC ont été exécutés hors bac à sable afin que leurs fenêtres cachées puissent utiliser le cache Electron. Les traces `forced preload rejection` et `SQLITE_FORCED` sont volontairement injectées par ces scénarios.

Les avertissements Windows Electron connus `os_crypt_win.cc` et `gpu_process_host.cc` sont apparus sur certains tests. Les messages de succès attendus ont été atteints et les codes des validations normales sont `0`.

## Commandes lancées

Lectures et inventaire :

```powershell
Get-Content -Raw AGENTS.md
Get-Content -Raw README.md
Get-Content -Raw reports/015_project_state_audit.md
Get-Content -Raw reports/018_sqlite_schema_migration_consolidation_report.md
Get-Content -Raw reports/022_ipc_error_handling_consolidation_report.md
Get-Content -Raw reports/024_iso_datetime_consistency_report.md
Get-Content -Raw scripts/*.cjs
rg -n "tmpdir|mkdtemp|TEMP|sqlite|userData|sessionData|rmSync|BrowserWindow" scripts
git status --short
git diff --stat
```

Validations principales :

```powershell
node --check scripts/test-temp-directory.cjs
node --check scripts/electron-db-check.cjs
node --check scripts/electron-legacy-migration-check.cjs
node --check scripts/electron-ipc-error-check.cjs
npm.cmd run build
npm.cmd run test:app-identity
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
npm.cmd run test:ipc-error
Test-Path -LiteralPath <chemin exact créé par le test>
```

Échec et sécurité :

```powershell
$env:TEXTOTHEQUE_TEST_FORCE_FAILURE = 'db-check'
npm.cmd run test:db
Test-Path -LiteralPath <chemin exact du scénario en échec>
node -e "... removeTestTempDirectory(os.tmpdir()) ..."
```

## Test développement

La mission a créé explicitement :

```text
C:\Users\david\AppData\Local\Temp\textotheque-mission-025-dev-6004ebeefc564f46be0fa3c3e333575a
└── test.sqlite
```

`npm.cmd run dev` a été lancé avec ce fichier comme `TEXTOTHEQUE_DB_PATH`. La fenêtre Textothèque s'est ouverte sur `5173`, avec une bibliothèque vide, `SQLite OK` et `v0.1.13` visibles.

La session a ensuite été arrêtée volontairement par `Ctrl+C`. Avant suppression, les contrôles ont confirmé l'absence du processus Electron du projet et de listener sur `5173`. Le chemin absolu, son parent `%TEMP%` et son préfixe propre à la mission ont été validés, puis seul ce répertoire a été supprimé.

Résultat final :

```text
TEMP_EXISTS=False
```

La base utilisateur réelle n'a pas été utilisée et aucun nettoyage automatique de `TEXTOTHEQUE_DB_PATH` n'a été ajouté à l'application.

## Versionnement

Textothèque reste en version `0.1.13`. `CURRENT_SCHEMA_VERSION` reste à `2`. Aucun package, lockfile ou dépendance n'est modifié.

## Points non traités

- suppression d'anciens résidus laissés par les versions précédentes des tests ;
- scan global ou nettoyage par motif de `%TEMP%` ;
- caches ou profils sous `%APPDATA%` ;
- nettoyage automatique de toute base fournie par `TEXTOTHEQUE_DB_PATH` ;
- refonte du test runner ou de la gestion générale des processus ;
- nettoyage des builds `dist` et `dist-electron`.

## Risques / limites

Un arrêt brutal du processus par le système, avant l'exécution de JavaScript `finally`, peut toujours laisser le répertoire du test concerné. La mission couvre les succès, assertions, exceptions et échecs contrôlés ordinaires, pas une terminaison forcée du processus.

Les tests graphiques Electron n'ont pas été déplacés vers un profil temporaire, car ils ne possèdent actuellement aucun processus parent dédié capable d'attendre la sortie complète d'Electron puis de supprimer sans ambiguïté ce profil. Aucun nettoyage du profil partagé n'a été tenté.

## Suite recommandée

Réutiliser `createTestTempDirectory()` et `removeTestTempDirectory()` pour tout nouveau script qui crée des fichiers temporaires. Si les tests graphiques doivent un jour isoler leur cache Chromium, introduire une mission dédiée avec un processus parent propriétaire du profil, plutôt que de supprimer des éléments d'un profil partagé.
