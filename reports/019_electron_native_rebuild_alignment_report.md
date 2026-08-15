# Rapport — Fiabilisation du rebuild natif Electron

## Objectif

Faire reconstruire `better-sqlite3` pour la version Electron réellement installée dans le projet, sans conserver une cible Electron codée en dur et sans modifier les dépendances.

## Diagnostic initial

Le mécanisme initial était :

```json
"postinstall": "npm run rebuild:electron",
"rebuild:electron": "npm rebuild better-sqlite3 --runtime=electron --target=33.3.2 --disturl=https://electronjs.org/headers"
```

Le `postinstall` et le rebuild manuel utilisaient donc toujours Electron `33.3.2`, même lorsque la plage `^33.3.2` avait résolu et installé une version plus récente.

La recherche dans le dépôt a confirmé que cette cible active ne se trouvait que dans `package.json`. Les autres occurrences de `33.3.2` sont la plage de dépendance volontaire ou des rapports historiques.

## Versions observées

| Élément | Valeur observée |
|---|---:|
| Electron déclaré dans `package.json` | `^33.3.2` |
| Electron verrouillé dans `package-lock.json` | `33.4.11` |
| Electron installé dans `node_modules/electron/package.json` | `33.4.11` |
| Electron retourné par `electron --version` | `v33.4.11` |
| Electron ciblé avant correction | `33.3.2` |
| Electron détecté/ciblé après correction | `33.4.11` |
| `better-sqlite3` déclaré | `^11.8.1` |
| `better-sqlite3` verrouillé et installé | `11.10.0` |

La version Electron installée, la version verrouillée et le runtime exécuté sont donc alignés à `33.4.11`.

## Fichiers modifiés

- `package.json` : le script `rebuild:electron` appelle désormais le script local dynamique.
- `scripts/rebuild-electron-native.cjs` : détection des paquets installés et orchestration du rebuild.
- `scripts/electron-sqlite-smoke.cjs` : assertion d'alignement entre paquet Electron installé et runtime, puis affichage des versions réellement testées.
- `reports/019_electron_native_rebuild_alignment_report.md` : présent rapport.

`package-lock.json` n'a pas été modifié.

## Stratégie retenue

Le script CommonJS `scripts/rebuild-electron-native.cjs` :

1. résout `electron/package.json` depuis la racine du projet ;
2. lit sa version installée ;
3. lit également la version installée de `better-sqlite3` pour le diagnostic ;
4. récupère le CLI npm courant via `npm_execpath` ;
5. lance `npm rebuild better-sqlite3` avec le runtime Electron et une cible construite depuis la version détectée ;
6. hérite des sorties du processus enfant et propage son code d'échec ;
7. affiche un message court avec les versions ciblées.

Aucune version Electron n'est recopiée dans le script, aucun lockfile n'est parsé pour piloter le rebuild et aucune dépendance supplémentaire n'est nécessaire.

## Détection de la version Electron

La source de vérité du rebuild est le paquet réellement présent dans :

```text
node_modules/electron/package.json
```

La résolution passe par `require.resolve('electron/package.json')`. Si Electron ou `better-sqlite3` n'est pas installé, ou si sa version est absente, le script échoue avec un message explicite.

Lors de la mission, le script a affiché :

```text
Electron detecte : 33.4.11
Rebuild better-sqlite3 11.10.0 pour Electron 33.4.11
```

## Rebuild better-sqlite3

La commande publique reste :

```powershell
npm.cmd run rebuild:electron
```

Elle appelle maintenant :

```text
node scripts/rebuild-electron-native.cjs
```

Le script transmet à npm les options existantes :

```text
--runtime=electron
--target=<version Electron détectée>
--disturl=https://electronjs.org/headers
```

Le premier essai dans le sandbox a détecté correctement `33.4.11`, mais npm/node-gyp ne pouvait pas écrire dans les caches sous `%LOCALAPPDATA%` et a échoué avec `EPERM`. Conformément aux règles d'exécution, la même commande a été relancée hors sandbox. Elle a terminé avec :

```text
rebuilt dependencies successfully
```

et un code `0`.

## Postinstall

Le `postinstall` reste inchangé :

```json
"postinstall": "npm run rebuild:electron"
```

Un futur véritable `npm install` appellera donc le même script dynamique après installation des dépendances. La mission n'a pas exécuté `npm install`.

Le rebuild manuel et le `postinstall` partagent une seule implémentation ; il n'existe plus de seconde constante Electron à synchroniser.

## Vérification ABI

Le smoke test charge toujours réellement `better-sqlite3` dans Electron, crée une base en mémoire, crée une table, écrit puis relit une ligne.

Il vérifie désormais en plus :

```text
process.versions.electron
= version de node_modules/electron/package.json
```

Résultat après rebuild :

```text
electron sqlite ok: Electron 33.4.11, better-sqlite3 11.10.0
```

Le succès du rebuild n'est donc pas accepté seul : le module natif a effectivement été chargé et utilisé par le runtime Electron ciblé.

## Vérifications effectuées

| Commande | Résultat | Code |
|---|---|---:|
| `npm.cmd run rebuild:electron` | rebuild pour Electron `33.4.11` | 0 |
| `npm.cmd run test:electron-sqlite` | chargement ABI et requête SQLite réussis | 0 |
| `npm.cmd run build` | build TypeScript/Vite/Electron réussi | 0 |
| `npm.cmd run test:legacy-migration` | schéma v2, 4 scénarios | 0 |
| `npm.cmd run test:db` | `DB check OK` | 0 |
| `npm.cmd run test:preload` | `preload api ok` | 0 |
| `npm.cmd run test:ui-safeguards` | build puis `ui safeguards ok` | 0 |
| `git diff --check` | aucune erreur de whitespace | 0 |

Les tests migration et DB ont affiché les avertissements Electron Windows connus concernant `os_crypt_win.cc` et/ou le processus GPU. Leurs assertions ont été atteintes et leurs codes de sortie sont `0`.

Les tests preload et UI ont été exécutés hors sandbox afin que leurs fenêtres cachées puissent charger normalement.

## Commandes lancées

Diagnostic :

```powershell
Get-Content -Raw AGENTS.md
Get-Content -Raw README.md
Get-Content -Raw reports\015_project_state_audit.md
Get-Content -Raw reports\016_renderer_typescript_output_cleanup_report.md
Get-Content -Raw reports\017_dev_port_reliability_report.md
Get-Content -Raw reports\018_sqlite_schema_migration_consolidation_report.md
Get-Content -Raw package.json
Get-Content -Raw scripts\electron-sqlite-smoke.cjs
npm.cmd ls electron better-sqlite3 --depth=0
node -e "... lire les package.json installés et le lock ..."
electron --version
rg -n "33\.|target|runtime=electron|better-sqlite3|disturl" ...
git status --short
git diff --stat
```

Validations :

```powershell
node --check scripts/rebuild-electron-native.cjs
npm.cmd run rebuild:electron
npm.cmd run test:electron-sqlite
npm.cmd run build
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
npm.cmd run dev
git status --short
git diff --stat
git diff --name-only
git diff --check
```

## Test développement

Le port `5173` était libre. `TEXTOTHEQUE_DB_PATH` a été dirigé vers une base temporaire dans `%TEMP%`, puis `npm.cmd run dev` a été lancé.

Résultats :

- Vite 6.4.3 prêt sur `http://localhost:5173/` en 202 ms ;
- réponse HTTP `200` ;
- exactement une instance Electron `dist-electron/main.js` ;
- création effective de la base SQLite temporaire ;
- aucune erreur ABI, `NODE_MODULE_VERSION` ou chargement `better-sqlite3`.

La session a été arrêtée volontairement par `Ctrl+C` via `concurrently`. Aucun listener ou processus de développement créé par la mission n'est resté actif.

## Versionnement applicatif

Textothèque reste en version `0.1.13`. Les plages de dépendances restent `electron ^33.3.2` et `better-sqlite3 ^11.8.1` ; les versions verrouillées restent respectivement `33.4.11` et `11.10.0`.

`package-lock.json` ne présente aucun diff. Aucune résolution ou mise à jour de dépendance n'a été lancée.

## Points non traités

- Modification des plages semver Electron ou `better-sqlite3`.
- Installation ou mise à jour de dépendances.
- Profil/cache Electron générique.
- Packaging et distribution des modules natifs.
- Version applicative unique, clés étrangères SQLite et nettoyage des bases temporaires.

## Risques / limites

Le script doit être appelé via npm, car il réutilise `npm_execpath`. C'est le cas du `postinstall` et de la commande manuelle documentée. Un appel direct avec `node scripts/rebuild-electron-native.cjs` échoue volontairement avec un message indiquant la commande correcte.

Le rebuild dépend toujours de la disponibilité d'un prébuild compatible ou, à défaut, de l'environnement `node-gyp` et des en-têtes Electron. Cette mission aligne la cible ; elle ne remplace pas la chaîne native de npm.

La plage `^33.3.2` reste visible dans `package.json` parce qu'elle décrit la dépendance autorisée. Elle n'est plus utilisée comme cible statique du rebuild. Les anciennes commandes codées en dur restent uniquement dans les rapports historiques, qui n'ont pas été réécrits.

## Suite recommandée

Conserver `npm.cmd run test:electron-sqlite` immédiatement après tout rebuild, changement de lockfile Electron, restauration de `node_modules` ou préparation future du packaging.
