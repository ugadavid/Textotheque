# Rapport — Fiabilisation du port de développement

## Objectif

Rendre `npm.cmd run dev` déterministe : Textothèque doit utiliser le port `5173` et Vite doit refuser clairement de démarrer si ce port est indisponible sur son interface d'écoute, sans basculer vers `5174`.

## Symptôme historique

Vite utilisait son comportement par défaut. Lorsque `5173` était occupé, il pouvait sélectionner automatiquement `5174`, alors que le script Electron attendait toujours `http://localhost:5173` et que le main process chargeait toujours cette même URL. Une session pouvait donc rester incohérente ou viser une autre instance.

## Diagnostic confirmé

Avant correction :

- `vite.config.ts` ne définissait ni `server.port` ni `server.strictPort` ;
- `package.json` utilisait `wait-on http://localhost:5173` dans `dev:electron` ;
- `electron/main.ts` chargeait `http://localhost:5173` en développement ;
- `START_TEXTOTHEQUE.bat` vérifiait déjà la présence d'un listener sur le port `5173` avant de lancer `npm.cmd run dev`.

La seule incohérence était donc la possibilité de repli automatique de Vite.

## Fichiers modifiés

- `vite.config.ts` : configuration explicite du serveur de développement.
- `reports/017_dev_port_reliability_report.md` : présent rapport.

`package.json`, `electron/main.ts` et `START_TEXTOTHEQUE.bat` n'ont pas été modifiés.

## Correction appliquée

La configuration suivante a été ajoutée à `vite.config.ts` :

```ts
server: {
  port: 5173,
  strictPort: true,
},
```

La configuration Vite résolue a ensuite été inspectée et retourne :

```json
{"port":5173,"strictPort":true}
```

Aucun mécanisme dynamique de découverte de port, script supplémentaire ou dépendance n'a été ajouté.

## Cohérence Vite / wait-on / Electron

Les trois éléments utilisent désormais le même port :

```text
Vite server.port             5173
wait-on                      http://localhost:5173
Electron mainWindow.loadURL  http://localhost:5173
```

Avec `strictPort: true`, Vite ne peut plus remplacer silencieusement `5173` par `5174` lorsqu'un listener concurrent occupe l'adresse `localhost` utilisée par le serveur.

## Test port libre

Avant le test, aucun listener `5173` et aucun arbre `npm run dev` de Textothèque n'étaient actifs.

`TEXTOTHEQUE_DB_PATH` a été défini vers une base temporaire dans `%TEMP%`, puis `npm.cmd run dev` a été lancé.

Résultats :

- Vite 6.4.3 prêt en 208 ms ;
- URL annoncée exactement : `http://localhost:5173/` ;
- listener constaté sur `5173` ;
- requête HTTP : code `200` ;
- page servie : titre `Textotheque` ;
- processus Electron constaté avec `dist-electron/main.js` ;
- aucune erreur nouvelle de port ou de résolution.

La session a été arrêtée volontairement par `Ctrl+C` via son superviseur `concurrently`. Aucun listener ni processus créé par ce scénario n'est resté actif.

## Test port occupé

Un petit serveur HTTP Node contrôlé par la mission a été lancé temporairement sur `::1:5173`, l'interface effectivement utilisée ici par `localhost` et Vite.

Le lancement de `npm.cmd run dev` a produit :

```text
Error: Port 5173 is already in use
vite exited with code 1
Sending SIGTERM to other processes
```

Résultats :

- sortie globale non nulle attendue ;
- aucun basculement vers `5174` ;
- aucun listener sur `5174` ;
- `dev:electron` arrêté par `concurrently` ;
- aucune instance Electron `dist-electron/main.js` incorrecte restante ;
- le serveur occupant n'a pas été arrêté par le projet et est resté vivant jusqu'à son arrêt explicite par sa propre session.

Un premier essai avec un occupant lié uniquement à `127.0.0.1:5173` n'entrait pas en conflit avec Vite, qui utilise `::1` pour `localhost` sur cette machine. Les deux sessions de cet essai ont été arrêtées proprement avant de reproduire le conflit réel sur `::1`.

## Vérification START_TEXTOTHEQUE.bat

Le lanceur a été validé sans modification, en suivant les règles de sécurité du skill `windows-one-click-launcher` : aucun processus n'a été ciblé ou arrêté à partir de son port seul.

### Port occupé

- détection du listener `5173` et affichage de son PID ;
- avertissement lisible ;
- aucun lancement de Vite ou Electron ;
- occupant étranger laissé intact ;
- sortie après confirmation du message.

### Port libre

- message `[OK] Port 5173 disponible` ;
- lancement de `npm.cmd run dev` ;
- Vite prêt sur `5173` ;
- réponse HTTP `200` avec le titre Textothèque ;
- exactement une instance Electron de développement constatée ;
- utilisation d'une base SQLite temporaire ;
- arrêt de la session par `Ctrl+C`, sans processus restant.

Le lanceur dérive déjà son répertoire avec `%~dp0`, vérifie `package.json` et `node_modules`, n'installe rien et ne tue aucun propriétaire de port. Aucune adaptation n'était nécessaire pour cette mission.

## Vérifications effectuées

| Commande | Résultat | Code |
|---|---|---:|
| `npm.cmd run build` | build TypeScript/Vite/Electron réussi | 0 |
| `npm.cmd run test:legacy-migration` | `legacy migration ok` | 0 |
| `npm.cmd run test:db` | `DB check OK` | 0 |
| `npm.cmd run test:electron-sqlite` | `electron sqlite ok` | 0 |
| `npm.cmd run test:preload` | `preload api ok` | 0 |
| `npm.cmd run test:ui-safeguards` | build puis `ui safeguards ok` | 0 |
| `npm.cmd run dev` — port libre | démarrage confirmé puis interruption volontaire | n/a |
| `npm.cmd run dev` — port occupé | refus attendu, sans repli | 1 |
| `git diff --check` | aucune erreur de whitespace | 0 |

Les tests migration, DB et SQLite ont affiché les avertissements Windows Electron connus `os_crypt_win.cc` et/ou `gpu_process_host.cc`. Leurs assertions ont été atteintes et leurs codes de sortie sont `0`.

Les tests graphiques preload/UI ont été exécutés hors sandbox afin que leurs fenêtres cachées puissent charger normalement.

## Commandes lancées

Lectures et diagnostic :

```powershell
Get-Content -Raw AGENTS.md
Get-Content -Raw README.md
Get-Content -Raw reports\015_project_state_audit.md
Get-Content -Raw reports\016_renderer_typescript_output_cleanup_report.md
Get-Content -Raw package.json
Get-Content -Raw vite.config.ts
Get-Content -Raw electron\main.ts
Get-Content -Raw START_TEXTOTHEQUE.bat
rg -n "5173|5174|strictPort|wait-on|loadURL" ...
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
npm.cmd run dev
Invoke-WebRequest http://localhost:5173/
Get-NetTCPConnection ...
Get-CimInstance Win32_Process ...
node -e "... resolveConfig ..."
START_TEXTOTHEQUE.bat
git status --short
git diff --stat
git diff --name-only
git diff --check
```

## Versionnement

La version reste `0.1.13` dans `package.json`, `package-lock.json` et `src/App.tsx`. Aucun numéro de version et aucune dépendance n'ont été modifiés.

## Points non traités

- Profil/cache Electron générique.
- Cible du rebuild natif `better-sqlite3`/Electron.
- Migrations SQLite, gestion globale des erreurs IPC et packaging.
- Toute évolution fonctionnelle ou UX.

## Risques / limites

Comme tout serveur réseau, l'occupation d'un numéro de port est liée à une adresse/interface. Sur cette machine, `localhost` est servi par Vite sur `::1`; un processus lié uniquement à `127.0.0.1:5173` peut coexister sur l'autre pile réseau. Le conflit représentatif d'une ancienne instance Vite a donc été testé sur `::1:5173`.

Le lanceur Windows est plus conservateur : sa vérification `Get-NetTCPConnection -LocalPort 5173` refuse le lancement si le numéro est écouté sur n'importe quelle adresse locale.

L'arrêt volontaire par `Ctrl+C` fait naturellement sortir la commande de développement avec un code non nul sous Windows ; cela ne correspond pas à un échec de démarrage.

## Suite recommandée

Conserver la configuration fixe `5173` avec `strictPort: true`. Aucun travail supplémentaire sur le port n'est nécessaire tant que `wait-on` et `mainWindow.loadURL()` restent alignés sur `http://localhost:5173`.
