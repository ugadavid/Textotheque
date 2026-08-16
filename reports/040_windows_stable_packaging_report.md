# Rapport — Packaging Windows STABLE

## Objectif

Produire une Textotheque STABLE Windows installable, indépendante du dépôt et du serveur Vite, tout en isolant strictement Textotheque DEV et en conservant `%APPDATA%\Textotheque` comme profil historique STABLE.

## État initial

La mission a commencé sur `J:\2026\Textotheque`, HEAD `15d722eb8456d8261f13220b8b5a5162bf393a99`, avec `git status --short` et `git diff --stat` vides. Les Missions 039/039b étaient bien commitées.

Le projet utilisait déjà Vite avec `base: './'`, le port strict 5173, un build renderer `dist/`, un build Electron `dist-electron/`, et une détection dynamique de la version Electron pour reconstruire `better-sqlite3`.

## Séparation DEV / STABLE

La résolution déterministe ajoutée dans `electron/runtime-profile.ts` utilise `app.isPackaged` :

```text
DEV    → Textotheque DEV → %APPDATA%\Textotheque-Dev
STABLE → Textotheque     → %APPDATA%\Textotheque
```

Le choix et les appels `app.setPath('userData'/'sessionData')` interviennent avant `app.whenReady()`, l’ouverture SQLite et la création de fenêtre.

## Profil STABLE

La STABLE conserve exactement le profil `%APPDATA%\Textotheque`, la bibliothèque par défaut `textotheque.sqlite` et le registre `library-history.json`. Aucune donnée réelle de ce profil n’a été ouverte, copiée, migrée, sauvegardée ou modifiée pendant la mission.

## Profil DEV

DEV utilise désormais `%APPDATA%\Textotheque-Dev`, y compris pour SQLite, le registre, la session Chromium, les caches et Local Storage. Le titre de fenêtre est `Textotheque DEV`.

## Protection des données utilisateur

Les overrides `TEXTOTHEQUE_DB_PATH` et `TEXTOTHEQUE_LIBRARY_HISTORY_PATH` conservent leur priorité. Les diagnostics ajoutent un override `TEXTOTHEQUE_TEST_USER_DATA_PATH`, accepté uniquement en mode diagnostic, afin de rediriger aussi Chromium vers `%TEMP%\textotheque-test-*`.

Tous les smokes ont utilisé des bases, registres et profils temporaires précisément connus et nettoyés. Aucun fichier utilisateur n’est intégré aux artefacts.

## Runtime DEV

DEV conserve le pipeline existant : Vite strict sur 5173, `wait-on`, compilation Electron et `loadURL`. Le test simultané a réellement démarré Vite et Electron DEV avec un profil temporaire dédié.

## Runtime packagé

Le runtime packagé utilise `loadFile` sur `dist/index.html`. Il ne démarre ni Vite, ni serveur HTTP, ni processus `wait-on`, et n’utilise aucun port.

## Chargement Vite / loadFile

`resolveRendererTarget()` rend la branche testable : URL en DEV, fichier local en STABLE. Le smoke packagé a confirmé `location.protocol === 'file:'`. L’ASAR final ne contient ni littéral `localhost:5173`, ni chemin `J:\2026\Textotheque`.

## Electron Forge

Electron Forge 7 a été intégré au pipeline existant sans plugin Vite Forge. `npm.cmd run package:win` et `npm.cmd run make:win` commencent par le build TypeScript/Vite existant ; une erreur de build, rebuild natif, package ou maker interrompt donc la commande.

## Squirrel.Windows

`@electron-forge/maker-squirrel` produit uniquement la distribution Squirrel x64. `electron-squirrel-startup` est évalué au début du main process afin de quitter rapidement pendant les événements install/update/uninstall. Aucun auto-update ni canal de publication n’est configuré.

## better-sqlite3 et modules natifs

Forge prépare les dépendances natives pour Electron 33.4.11. Le plugin `@electron-forge/plugin-auto-unpack-natives` place `better_sqlite3.node` dans `app.asar.unpacked`. Aucune ABI ni version Electron n’a été codée en dur.

## ASAR

`asar: true` est actif. L’inspection finale compte 674 entrées et confirme l’absence de `src/`, `scripts/`, `reports/`, `*.sqlite` et `library-history.json`. Les déclarations générées et le `preload.js` non utilisé sont exclus. Le manifeste embarqué ne conserve ni scripts npm ni devDependencies.

## Contenu du package

Le runtime contient uniquement le build renderer, le build Electron, le manifeste minimal et les dépendances de production (`better-sqlite3`, `electron-squirrel-startup` et leurs dépendances nécessaires). `out/` est ignoré par Git.

## Scripts package / make

Commandes ajoutées :

```powershell
npm.cmd run package:win
npm.cmd run make:win
npm.cmd run test:runtime-profile
npm.cmd run test:packaged-smoke
npm.cmd run test:installer-smoke
npm.cmd run test:concurrent-runtime
```

## Installateur produit

Artefacts finaux :

```text
out\make\squirrel.windows\x64\Textotheque Setup.exe
out\make\squirrel.windows\x64\Textotheque-0.1.28-full.nupkg
out\make\squirrel.windows\x64\RELEASES
```

Tailles : Setup 116 713 472 octets ; nupkg 115 928 719 octets ; RELEASES 83 octets.

SHA-256 du Setup final : `05B40A51EAF7C831323A90515F0E280BD88B1999706210BCDB081B2DC38B24C3`.

## Smoke test package

Le package non installé a été lancé avec un profil totalement temporaire. Vérifications réussies : fenêtre renderer, `file:`, preload context-isolated, SQLite schéma 5, module natif, autosave réel par l’interface, FTS/recherche, TODO et recherche enregistrée.

## Smoke test installateur

`Textotheque Setup.exe` a été exécuté localement. Squirrel a créé `%LOCALAPPDATA%\Textotheque\Textotheque.exe` et le raccourci menu Démarrer `Programs\David\Textotheque.lnk`. Le premier runner silencieux est resté attaché à `Update.exe` après l’installation et a atteint son timeout ; ce processus précis a été arrêté après vérification de l’installation.

L’exécutable installé a ensuite passé le smoke complet en version 0.1.28 avec un profil/base/registre redirigés vers `%TEMP%` et un renderer `file:`. La vraie bibliothèque STABLE n’a pas été utilisée. Les artefacts finaux ont été régénérés après l’ajout des derniers diagnostics et de la documentation ; leur package exact a repassé le smoke package.

## Test simultané DEV / STABLE

Le test a maintenu simultanément deux processus répondants : STABLE packagée (PID 49772 lors du dernier passage) et DEV (PID 61312), avec Vite 5173 réservé à DEV. Chaque runtime a créé et relu un document via son preload et sa base temporaire.

Les chemins `userData`, `sessionData`, SQLite et `library-history.json` ont tous été comparés et sont distincts. STABLE utilisait `file:`, DEV `http://localhost:5173`.

## Mise à jour manuelle future

Cycle documenté : développement, tests, validation humaine, commit, `npm.cmd run make:win`, puis exécution du nouveau Setup. Les données sous `%APPDATA%\Textotheque` restent hors du répertoire applicatif Squirrel `%LOCALAPPDATA%\Textotheque`.

## Signature Windows reportée

Aucun certificat, PFX, signtool ou Azure Trusted Signing n’a été configuré. Windows peut afficher un avertissement d’éditeur inconnu. L’icône est également reportée, aucune ressource Textothèque directement exploitable n’ayant été trouvée.

## Tests

Passent :

- `npm.cmd run build`
- `npm.cmd run test:app-identity`
- `npm.cmd run test:runtime-profile`
- `npm.cmd run test:electron-sqlite`
- `npm.cmd run test:db`
- `npm.cmd run test:preload`
- `npm.cmd run test:ipc-error`
- `npm.cmd run test:library`
- `npm.cmd run test:search`
- `npm.cmd run test:saved-searches`
- `npm.cmd run test:packaged-smoke`
- `npm.cmd run test:installer-smoke`
- `npm.cmd run test:concurrent-runtime`
- `npm.cmd run make:win`

Les messages `os_crypt_win.cc` et `gpu_process_host.cc` observés sur certains tests Electron sont les avertissements Windows connus, avec code de sortie final nul. `test:preload` a dû être relancé hors sandbox après un refus d’accès du sandbox au cache Chromium générique ; il passe alors normalement.

## Vérifications effectuées

- version applicative 0.1.28 ;
- `CURRENT_SCHEMA_VERSION = 5` ;
- runtime DEV/STABLE déterministe ;
- profils, DB, historiques et sessions distincts ;
- renderer packagé local ;
- native SQLite chargeable depuis ASAR unpacked ;
- aucun fichier de données, source ou rapport dans l’ASAR ;
- aucun chemin absolu du dépôt ni URL Vite littérale dans le runtime packagé ;
- installateur et raccourci Windows réels ;
- `out/` ignoré et aucun exécutable suivi par Git.

## Commandes lancées

Les commandes de précondition Git demandées, les lectures documentaires, `npm.cmd install` pour les dépendances Forge/Squirrel, les builds, packages, makes, tests listés ci-dessus, inspections ASAR, recherches de chemins interdits, inventaires d’artefacts et SHA-256 ont été exécutés.

## Versionnement

`package.json` et `package-lock.json` passent de 0.1.27 à 0.1.28. Le schéma SQLite reste 5 et aucune migration métier n’est ajoutée.

## Fichiers modifiés

- `.gitignore`
- `AGENTS.md`
- `README.md`
- `package.json`
- `package-lock.json`
- `forge.config.cjs`
- `electron/main.ts`
- `electron/runtime-profile.ts`
- `scripts/electron-app-identity-check.cjs`
- `scripts/electron-runtime-profile-check.cjs`
- `scripts/electron-packaged-smoke-check.cjs`
- `scripts/electron-installer-smoke-check.cjs`
- `scripts/electron-concurrent-runtime-check.cjs`
- `docs/DISTRIBUTION_WINDOWS.md`
- `reports/040_windows_stable_packaging_report.md`

## Points non traités

- signature Windows ;
- icône applicative dédiée ;
- auto-update et publication ;
- MSI/MSIX ;
- copie ou synchronisation de données STABLE vers DEV.

## Risques / limites

La build locale non signée peut déclencher SmartScreen. Le script de smoke installateur vérifie une installation Squirrel déjà réalisée plutôt que de réinstaller silencieusement à chaque passage, car Squirrel utilise l’emplacement utilisateur Windows réel même lorsque `LOCALAPPDATA` est surchargé pour le processus de test.

Le mainteneur reste seul autorisé à vérifier la vraie bibliothèque `%APPDATA%\Textotheque\textotheque.sqlite` avec l’application installée.

## Suite recommandée

Le mainteneur peut lancer Textotheque depuis le menu Démarrer, confirmer visuellement ses données STABLE, puis lancer `npm.cmd run dev` pour constater l’identité `Textotheque DEV` et son profil vide indépendant. Une future mission pourra traiter l’icône et la signature.
