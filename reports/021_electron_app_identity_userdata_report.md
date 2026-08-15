# Rapport — Identité et profil utilisateur Electron

## Objectif

Donner à Textothèque une identité Electron explicite afin que ses données de profil et sa base SQLite par défaut ne dépendent plus du nom générique du runtime de développement.

## Diagnostic initial

Avant correction, un diagnostic Electron exécuté depuis le projet a retourné le nom interne `Electron`. Le lancement de `electron dist-electron/main.js` reçoit directement un fichier d'entrée compilé ; dans cette configuration de développement, Electron conservait donc l'identité de son runtime au lieu d'adopter le nom npm `textotheque` du projet.

`electron/main.ts` calculait correctement la base à la première utilisation, dans `getDatabase()`, mais l'identité n'était jamais initialisée avant cet appel. Le chemin par défaut héritait ainsi du `userData` générique.

## Chemins observés avant correction

```text
app.getName()                         Electron
app.getPath('appData')               C:\Users\david\AppData\Roaming
app.getPath('userData')              C:\Users\david\AppData\Roaming\Electron
chemin DB calculé                    C:\Users\david\AppData\Roaming\Electron\textotheque.sqlite
```

La base historique exacte existe à cet ancien emplacement. Aucun fichier `textotheque.sqlite-wal` ou `textotheque.sqlite-shm` n'était présent au moment du contrôle.

## Stratégie retenue

La propriété standard `productName` de `package.json` porte désormais le nom utilisateur `Textotheque`. Au chargement synchrone du main process, `electron/main.ts` lit cette métadonnée puis appelle `app.setName()` avant `app.whenReady()` et avant tout accès à la base.

Cette combinaison couvre les deux besoins :

- `productName` fournit une identité de produit exploitable par un futur outil de packaging ;
- `app.setName()` fixe explicitement l'identité interne du runtime lors des lancements actuels `dev` et `start`.

La documentation officielle Electron consultée confirme que `userData` est, par défaut, `appData` complété par le nom de l'application et que `app.setName()` remplace ce nom interne : <https://www.electronjs.org/docs/latest/api/app>.

## Fichiers modifiés

- `package.json`
- `electron/main.ts`
- `scripts/electron-app-identity-check.cjs`
- `reports/021_electron_app_identity_userdata_report.md`

`package-lock.json`, `electron/database.ts`, le preload, le renderer et `AGENTS.md` n'ont pas été modifiés.

## Initialisation de l’identité

L'ordre réel est désormais :

1. import des modules du main process ;
2. lecture synchrone de `package.json` depuis `electron/main.ts` ;
3. choix de `productName`, avec repli sur `name` ;
4. appel synchrone de `app.setName(applicationName)` ;
5. attente de `app.whenReady()` ;
6. enregistrement des handlers IPC et création de la fenêtre ;
7. ouverture paresseuse de SQLite au premier appel applicatif.

L'identité est donc fixée avant le calcul de `userData` et avant la construction de `TextothequeDatabase`.

Le titre existant de la fenêtre reste `Textotheque`. Aucun travail typographique ou visuel annexe n'a été entrepris.

## Nouveau chemin userData

Le vrai main process compilé retourne après correction :

```text
app.getName()                         Textotheque
app.getPath('appData')               C:\Users\david\AppData\Roaming
app.getPath('userData')              C:\Users\david\AppData\Roaming\Textotheque
app.getPath('sessionData')           C:\Users\david\AppData\Roaming\Textotheque
chemin DB par défaut                 C:\Users\david\AppData\Roaming\Textotheque\textotheque.sqlite
```

Le profil ne se termine plus par `Electron`. `sessionData`, qui porte notamment les données de session Chromium et son cache disque, suit naturellement le nouveau `userData`. Aucun chemin Electron n'a été personnalisé manuellement.

La mission a uniquement confirmé le chemin DB par défaut en mode diagnostic. Le fichier `C:\Users\david\AppData\Roaming\Textotheque\textotheque.sqlite` n'a pas été créé.

## TEXTOTHEQUE_DB_PATH

Le mécanisme existant conserve exactement sa priorité :

```ts
process.env.TEXTOTHEQUE_DB_PATH ?? path.join(app.getPath('userData'), 'textotheque.sqlite')
```

Le calcul a été isolé dans `getDatabasePath()` afin d'être partagé par l'ouverture réelle et le diagnostic ciblé. Le test exécute une seconde fois le vrai main process avec une surcharge et vérifie que le chemin retourné est strictement celui fourni, tandis que `userData` reste le profil Textothèque.

Tous les tests SQLite et le lancement réel ont utilisé des bases temporaires ou en mémoire. Aucune base utilisateur n'a été ouverte par les validations.

## Ancienne base de développement

La stratégie retenue est l'option B : aucune migration automatique.

L'ancienne base est actuellement une base de développement contenant des données de test. Une copie automatique ajouterait une logique ponctuelle au démarrage et devrait raisonner sur l'état WAL, la concurrence et un dossier générique qui ne peut pas être considéré comme appartenant entièrement à Textothèque.

Le fichier historique reste intact à :

```text
C:\Users\david\AppData\Roaming\Electron\textotheque.sqlite
```

Pour relire temporairement ces données, Textothèque peut être lancée, toutes ses autres instances étant fermées, avec :

```powershell
$env:TEXTOTHEQUE_DB_PATH = "$env:APPDATA\Electron\textotheque.sqlite"
npm.cmd run dev
```

Une éventuelle copie manuelle vers le nouveau profil doit également être faite application arrêtée et seulement après vérification de l'absence de fichiers WAL/SHM actifs. Le dossier `%APPDATA%\Electron` ne doit jamais être déplacé ou supprimé en bloc.

## WAL / SHM

Aucune copie automatique n'étant effectuée, la mission ne risque pas de séparer le fichier principal SQLite d'un journal WAL actif.

Le contrôle ponctuel de l'ancienne base n'a trouvé ni `textotheque.sqlite-wal` ni `textotheque.sqlite-shm`. Ce constat n'est pas transformé en hypothèse permanente : ces fichiers peuvent apparaître lors d'une prochaine ouverture SQLite.

## Tests ajoutés ou modifiés

La nouvelle commande ciblée est :

```powershell
npm.cmd run test:app-identity
```

Elle :

1. compile l'application ;
2. lance le vrai `dist-electron/main.js` dans un mode diagnostic sans fenêtre ni ouverture SQLite ;
3. lit les chemins réellement retournés par Electron ;
4. compare le nom à `productName` ;
5. vérifie `userData = appData/Textotheque` ;
6. refuse explicitement un profil se terminant par `Electron` ;
7. vérifie `sessionData` ;
8. vérifie le chemin DB par défaut ;
9. relance le diagnostic avec `TEXTOTHEQUE_DB_PATH` et contrôle sa priorité.

Résultat observé :

```text
app identity ok: Textotheque, userData=C:\Users\david\AppData\Roaming\Textotheque, database=C:\Users\david\AppData\Roaming\Textotheque\textotheque.sqlite
```

## Vérifications effectuées

| Commande | Résultat | Code |
|---|---|---:|
| `node --check scripts/electron-app-identity-check.cjs` | syntaxe valide | 0 |
| `npm.cmd run test:app-identity` | identité, profil, DB par défaut et surcharge validés | 0 |
| `npm.cmd run build` | build TypeScript/Vite/Electron réussi dans le test ciblé et le test UI | 0 |
| `npm.cmd run test:legacy-migration` | schéma 2, 4 scénarios | 0 |
| `npm.cmd run test:db` | `DB check OK` sur base temporaire | 0 |
| `npm.cmd run test:electron-sqlite` | Electron 33.4.11, better-sqlite3 11.10.0 | 0 |
| `npm.cmd run test:preload` | `preload api ok` | 0 |
| `npm.cmd run test:ui-safeguards` | `ui safeguards ok` | 0 |

Un premier build intermédiaire a détecté que `cache` n'est pas une valeur acceptée par `app.getPath()` dans les types Electron 33. Cette instrumentation invalide a été retirée immédiatement ; le build final et toutes les validations ont ensuite réussi.

## Commandes lancées

```powershell
git status --short
git diff --stat
rg -n "getPath\(|setPath\(|setName\(|TEXTOTHEQUE_DB_PATH|textotheque\.sqlite|productName|name" electron scripts package.json package-lock.json
node --check scripts\electron-app-identity-check.cjs
npm.cmd run test:app-identity
npm.cmd run build
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
npm.cmd run dev
.\node_modules\.bin\electron.cmd dist-electron\main.js --textotheque-check-app-identity
git status --short
git diff --stat
git diff --name-only
git diff --check
```

Des commandes PowerShell en lecture seule ont aussi contrôlé le port `5173`, les processus Electron, les bases ancienne/nouvelle et les éventuels compagnons WAL/SHM.

## Test développement

Le lancement réel a utilisé :

```text
TEXTOTHEQUE_DB_PATH=C:\Users\david\AppData\Local\Temp\textotheque-m021-dev-1786807860694.sqlite
```

Résultats :

- Vite 6.4.3 prêt sur `http://localhost:5173/` en 214 ms ;
- une seule instance principale Electron `dist-electron/main.js` ;
- base temporaire effectivement créée ;
- processus Chromium lancés avec `--user-data-dir=C:\Users\david\AppData\Roaming\Textotheque` ;
- fenêtre `Textotheque` fonctionnelle ;
- aucune erreur SQLite ou liée à l'identité ;
- barre de statut visible avec `SQLite OK` et `v0.1.13`.

La session a été interrompue volontairement avec `Ctrl+C`, ce qui explique le code non nul du lanceur `concurrently`. Après arrêt, le port `5173` était libre et aucune instance principale Electron de cette session ne subsistait.

## Versionnement applicatif

Textothèque reste en version `0.1.13`. `package-lock.json` et les dépendances sont inchangés.

## Points non traités

- migration automatique de l'ancienne base de développement ;
- packaging ou installateur ;
- identité visible au niveau d'un exécutable Windows packagé ;
- icône et AppUserModelID ;
- personnalisation manuelle des chemins Electron ;
- suppression des bases temporaires ;
- toute évolution SQLite, IPC, preload, renderer ou fonctionnelle.

## Risques / limites

Le mode diagnostic `--textotheque-check-app-identity` fait partie du main process, mais il est strictement borné : il affiche les chemins, n'enregistre pas les handlers, ne crée pas de fenêtre et n'ouvre aucune base. Il permet de tester le véritable ordre d'initialisation sans toucher aux données utilisateur.

Le nom interne est lu depuis le `package.json` situé à la racine de l'application. Cette disposition correspond au projet actuel et à la structure habituelle d'une application packagée ; un futur changement de structure de packaging devra conserver cette métadonnée ou adapter sa lecture.

L'ancien fichier de base demeure volontairement séparé. Un utilisateur qui souhaite récupérer ces données doit employer la surcharge documentée ou effectuer une copie contrôlée, application arrêtée.

## Suite recommandée

Conserver `productName` comme source de l'identité utilisateur Electron et exécuter `npm.cmd run test:app-identity` après toute modification du point d'entrée main ou d'un futur packaging. Ne migrer l'ancienne base que sur demande explicite si ses données doivent finalement être conservées.
