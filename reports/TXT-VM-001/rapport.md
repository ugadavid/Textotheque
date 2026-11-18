# TXT-VM-001 — Installation et recette sur CODEX_VM

**18 novembre 2026.** Textothèque 0.1.28 compile et fonctionne en DEV sur la VM. Un document saisi dans la fenêtre Electron a été relu à l’identique après redémarrage. Sur les 17 tests DEV du dépôt, 14 réussissent et 3 échouent. Les 3 tests nécessitant STABLE sont hors périmètre.

## État initial et architecture

Le clone de `ugadavid/Textotheque` se trouvait sur `main`, au commit `01a614bd85903555e0c9fca95e12425d182cce83`, aligné sur la référence locale `origin/main`. Les sorties de `git status --short` et `git diff --stat` étaient vides. Le dépôt contenait `package-lock.json` (format 3). Les dépendances locales et le profil DEV étaient absents. Le processus ne définissait aucune variable `TEXTOTHEQUE_*`.

Le README expose également la vision à terme. Les scripts, le code et les rapports de mission confirment que la version livrée gère déjà l’édition en texte brut, les titres automatiques, la sauvegarde explicite et automatique, l’export texte, les dossiers, le catalogue, la corbeille, le TODO par bibliothèque, la recherche FTS5 avec filtres et les recherches enregistrées.

React appelle les services de `src/services`. Le preload CommonJS expose `window.textotheque` et transmet les appels IPC au processus principal. Celui-ci gère les bibliothèques et SQLite via `better-sqlite3`. Le renderer utilise `contextIsolation: true` et `nodeIntegration: false`. Le schéma runtime est défini dans `electron/database.ts`, avec la signature TEXO et la version de schéma 5. Les tests ciblés et le rapport par mission suivent les conventions d’AGENTS.md.

## Installation depuis le verrou

| Élément | Version ou résultat sur la VM |
|---|---|
| Système | CODEX-VM, Windows 11 Pro x64, 26H2, build 26300 |
| Outils présents | Git 2.56.1.windows.1, Node.js 24.22.2 x64, npm 11.19.1, Python 3.13.17 |
| Runtime du projet | Electron 33.4.11, better-sqlite3 11.10.0 |
| Interface et build | React et React DOM 18.3.1, TypeScript 5.9.3, Vite 6.4.3 |

Le premier `npm.cmd ci` a cherché un binaire SQLite pour Node 24.22.2. Faute de binaire précompilé pour cette cible et de Visual Studio C++ détecté par node-gyp, il a échoué avant le postinstall du projet. Des avertissements de dépréciation et de nettoyage EPERM ont accompagné cet essai.

La seconde installation a ciblé le runtime réellement utilisé par Textothèque. Elle a installé 644 paquets et exécuté le postinstall du dépôt avec succès. Pour reproduire cette installation dans une nouvelle session PowerShell à la racine du clone, utiliser les commandes suivantes puis fermer cette session pour libérer les deux variables de processus.

```powershell
$env:npm_config_runtime = 'electron'
$env:npm_config_target = node -p "require('./package-lock.json').packages['node_modules/electron'].version"
npm.cmd ci --no-audit --no-fund
```

`npm.cmd ls --depth=0` a retrouvé les dépendances directes attendues. Le test natif a créé une table en mémoire, écrit puis relu une ligne avec Electron 33.4.11 et better-sqlite3 11.10.0. La VM utilise le binaire compatible. Une compilation C++ depuis les sources reste non vérifiée.

## Démarrage et recette réelle

Depuis la racine du dépôt, lancer `npm.cmd run dev` ou `.\START_TEXTOTHEQUE.bat`. Le lanceur vérifie d’abord la disponibilité du port 5173. Pour compiler séparément, exécuter `npm.cmd run build`. Pour contrôler le module natif, exécuter `npm.cmd run test:electron-sqlite`.

1. Au premier lancement, la base et le registre ont été explicitement dirigés vers leurs chemins DEV par défaut, après vérification de leur absence. Vite a servi le renderer sur `http://localhost:5173/`. La fenêtre affichait zéro document et « SQLite OK ».
2. Le bouton **+** a créé le document **tot_20261118_01**, ID 1. Le texte saisi était « TXT-VM-001 — Texte fictif créé sur CODEX_VM pour vérifier la sauvegarde et la réouverture. ». Le raccourci Ctrl+S a été envoyé. Le marqueur de modification a disparu et la barre d’état indiquait 14 mots et 90 caractères.
3. Après fermeture de la fenêtre, Electron a quitté avec le code 0. Le lanceur `concurrently -k` a arrêté Vite, qui a renvoyé 1 à l’arrêt. Le deuxième démarrage DEV a repris la même bibliothèque. L’outil de contrôle Windows a ensuite renvoyé `foreground window did not report a process id`.
4. Après fermeture normale, un pilote Electron temporaire a lancé le vrai processus principal avec Vite, ouvert le document depuis « Non classés » dans le renderer et comparé la valeur de l’éditeur au texte attendu. Résultat exact : `RELECTURE_OK ["http://localhost:5173/","Textotheque",90]`, code 0. Le pilote a été supprimé et le port libéré. Le titre visible de la fenêtre est **Textotheque**, même si le diagnostic d’identité indique **Textotheque DEV**. Le titre seul ne permet donc pas d’identifier le profil.

La bibliothèque fictive reste disponible dans `%APPDATA%\Textotheque-Dev\textotheque.sqlite`. Le registre DEV adjacent contient cette unique entrée. Un lancement DEV ordinaire permet de retrouver le texte.

## Résultats des vérifications

Le build TypeScript/Vite/Electron a terminé avec le code 0. Sous `src/`, les seules déclarations trouvées sont les deux fichiers source prévus, sans JavaScript généré adjacent. Chaque test ci-dessous a été exécuté par son script `npm.cmd run test:<nom>`.

| Résultat | Tests |
|---|---|
| 14 réussites, code 0 | electron-sqlite, app-identity, runtime-profile, legacy-migration, db, preload, ipc-error, library, library-history, text-export, auto-title, special-todo, catalog, search |
| 3 échecs, code 1 | ui-safeguards, autosave, saved-searches |
| 3 non exécutés | packaged-smoke et concurrent-runtime exigent un package STABLE. installer-smoke vise une installation STABLE. |

- **ui-safeguards** s’arrête à la ligne 605 du script. L’assertion exige littéralement `0.1.27` alors que le manifeste et l’interface indiquent `0.1.28`. Les assertions suivantes restent non vérifiées.
- **autosave** échoue dans le scénario de changement de bibliothèque. La bibliothèque B est active et la sélection vide, mais le renderer affiche « Impossible de charger les recherches enregistrées ». Le double IPC du test omet `saved-searches:list` et `search:set-menu-state`, tous deux présents dans le vrai main. Cette exécution ne valide pas le scénario de sauvegarde en vol pendant une bascule.
- **saved-searches** échoue à la ligne 143. Le document témoin porte une modification au 15 août 2026 et la recherche exige une modification dans les 15 derniers jours. Au 18 novembre, ce document est hors période. La migration 4→5, la préservation du TODO et de FTS ainsi que la relecture des critères avaient passé leurs assertions avant cet arrêt.

Les tests utilisent des fixtures, des profils de diagnostic et des chemins temporaires. Les erreurs IPC forcées font partie des scénarios négatifs. La recette interactive utilise uniquement la bibliothèque fictive DEV. Aucun test n’a employé les données du mainteneur.

## Transfert ultérieur depuis Zenith Ice

1. Sur Zenith Ice, vérifier le nom et le chemin de la bibliothèque active. Le registre peut désigner un fichier hors du profil par défaut. Sauvegarder le texte en cours puis utiliser **Bibliothèque → Sauvegarder une copie…** pour produire un snapshot SQLite cohérent et vérifié.
2. Transférer manuellement ce snapshot vers un nouveau chemin sur la VM. Conserver le snapshot intact et en faire une copie de travail avec un nom distinct, par exemple `Documents\Bibliotheques-DEV\Zenith-travail.sqlite`. Conserver le registre et la session Chromium propres à chaque machine.
3. Démarrer DEV sur la bibliothèque fictive et choisir **Bibliothèque → Ouvrir une bibliothèque…** pour sélectionner uniquement la copie de travail. Ce passage par le menu déclenche l’inspection en lecture seule. Éviter de placer la copie au chemin de la base par défaut ou de la désigner comme base par défaut via `TEXTOTHEQUE_DB_PATH`, car l’initialisation de cette base suit un autre flux.
4. Une copie compatible peut être ouverte après vérification du chemin. Si Textothèque propose une migration ou une adoption, laisser le mainteneur décider. Son accord déclenche un backup pré-migration vérifié. Une base étrangère ou trop récente doit être refusée. Vérifier ensuite quelques textes connus et le TODO sur la copie de travail.

Le profil STABLE par défaut est `%APPDATA%\Textotheque`. En DEV, `TEXTOTHEQUE_DB_PATH` désigne la base par défaut et `TEXTOTHEQUE_LIBRARY_HISTORY_PATH` le registre. Une dernière bibliothèque compatible rappelée par le registre peut être ouverte au démarrage. Le transfert personnel reste à effectuer par le mainteneur.

## Périmètre livré pour validation

Seul ce rapport est ajouté au dépôt. Le code, les tests, le manifeste et le verrou conservent leur état initial. Les dépendances et sorties de compilation sont locales et ignorées par Git. Aucune opération de packaging, installation STABLE, publication, migration de bibliothèque personnelle ou intervention sur Zenith Ice n’a été effectuée.
