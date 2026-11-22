# Rapport 052 — Qualification de mise à jour STABLE 0.1.28 → 0.1.29

**GO-QUALIF sur CODEX_VM, le 22 novembre 2026.** Le Setup candidat a été exécuté directement sur l’installation Squirrel 0.1.28 fermée. Le raccourci existant a démarré la 0.1.29. Après cette première relance et une fermeture normale, le fichier SQLite principal était encore identique octet pour octet au relevé de référence. La qualification porte uniquement sur la VM. Les deux Setup, les paquets et les copies de contrôle y restent locaux. Aucun transfert vers Zenith Ice.

## Inventaire avant toute installation

Les chemins réels ont été relus via les dossiers spéciaux Windows hors bac à sable, lequel redirigeait la première lecture de LOCALAPPDATA. Sur le poste `CODEX-VM`, les répertoires programme `%LOCALAPPDATA%\Textotheque` et profil `%APPDATA%\Textotheque` étaient tous deux absents. Aucun processus Textotheque, aucune entrée utilisateur de désinstallation, aucun raccourci STABLE dans les menus Démarrer utilisateur et commun. Le seul raccourci Bureau préexistant pointait explicitement vers `START_TEXTOTHEQUE.bat` dans le dépôt DEV. Il a été conservé. La bibliothèque personnelle DEV est restée hors qualification.

Arbre initial propre sur `main`, référence distante synchronisée `9402d61af897200bfd50e2abe434eb5bd14291c0`, version déclarée 0.1.28. Un profil STABLE neuf, identifié par un marqueur de qualification, a été créé après cet inventaire.

## Sources et construction

| | Baseline installée | Candidate installée |
| --- | --- | --- |
| Source exacte | `01a614bd85903555e0c9fca95e12425d182cce83`, commit de packaging 040, worktree détaché | `5f50bfd1406674d59d53fc7a496bf1a26e4d80cb`, arbre propre |
| Fabrication x64 | `npm.cmd ci` ciblant Electron, puis `npm.cmd run make:win` | `npm.cmd run release:win`, manifeste local créé le 22 à 15:45:58 UTC |
| SHA-256 du Setup local | `f5076574eb10b946e08373966814724540ab1b2c0c01199ecf9f550da5539526` | `c18508229f833ae83ddcef155fcb1f291522763940cad052a6bf4aeb0c33906d` |
| Preuve de version active | Smoke sur le lanceur installé, version Squirrel 0.1.28, renderer dans `app-0.1.28` | Smoke sur le lanceur installé, barre d’état v0.1.29, renderer dans `app-0.1.29` |

La baseline est une reconstruction de la source historique. Le Setup historique de Zenith Ice n’a pas été copié ni identifié par comparaison binaire. Au premier `npm ci`, Node 24 a cherché un module natif pour son propre ABI et la compilation C++ a échoué. Le ciblage d’Electron 33.4.11 indiqué dans la procédure a permis l’installation verrouillée de better-sqlite3 11.10.0. Les deux versions ont utilisé le même verrouillage de dépendances, avec pour seule différence la version du projet.

Le Setup candidat fait **116 700 160 octets**. Son manifeste se trouve sur la VM dans `dist-release/Textotheque-0.1.29/manifest.json`. Le script de staging vérifie le paquet complet dans `RELEASES` et calcule les SHA-256 des trois artefacts copiés. Le filtre Forge limite les fichiers de `dist-electron` aux sorties des sources Electron, pour écarter notamment les captures de recettes précédentes. La procédure documente aussi le cas d’échec et la récupération depuis une sauvegarde. [Distribution Windows](../docs/DISTRIBUTION_WINDOWS.md)

## Mise à jour et unicité Windows

1. Exécution du Setup 0.1.28, smoke de l’installation, lancement par le raccourci puis constitution de la fixture dans l’application via son preload. Réouverture de la baseline pour vérifier la persistance, fermeture et copie des fichiers fermés.
2. Vérification du marqueur fictif, de l’absence de processus Textotheque, de la version du lanceur et du SHA-256 du Setup candidat. Exécution de `Textotheque Setup.exe --silent` sur l’installation en place. Les deux Setup ont terminé avec le code 0.
3. Relance via le même raccourci Démarrer. Le processus principal et les processus Chromium provenaient de `%LOCALAPPDATA%\Textotheque\app-0.1.29\Textotheque.exe`. Dans les deux versions, les smokes ont exigé `app.isPackaged === true` et le protocole `file:`. Le renderer réellement installé a aussi été observé sous `resources/app.asar/dist/index.html`. Le port DEV 5173 n’était pas en écoute lors du contrôle de référence.

| Contrôle | Avant | Après |
| --- | --- | --- |
| Package, exécutable, Setup | Textotheque, Textotheque.exe, Textotheque Setup.exe | Identiques |
| Applications installées | Une entrée Textotheque 0.1.28 | Une entrée Textotheque 0.1.29, même clé et même InstallLocation |
| Menu Démarrer utilisateur + commun | Un raccourci `Programs\David\Textotheque.lnk` | Même raccourci, même cible `%LOCALAPPDATA%\Textotheque\Textotheque.exe` |
| Programme local | `app-0.1.28`, packages, app.ico, Squirrel-Shortcut.log, lanceur, Update.exe | Même racine avec `app-0.1.29`. L’ancien sous-dossier a été retiré par Squirrel. |
| Sous-dossier packages | SquirrelTemp, RELEASES, paquet complet 0.1.28 | SquirrelTemp, RELEASES, paquet complet 0.1.29 |
| Profil Chromium | `%APPDATA%\Textotheque`, créé à 15:45:34.636 UTC | Même chemin et même date de création, Local Storage et préférences retrouvés |

Windows expose l’application sous `com.squirrel.Textotheque.Textotheque`. Le raccourci Bureau STABLE et le raccourci Démarrer ciblent le même lanceur. Le raccourci batch DEV préexistant est distinct. L’inventaire final des profils Textothèque contient STABLE et DEV.

## Données et préférences

Les deux bibliothèques de qualification sont fictives. La principale est `textotheque.sqlite` et la seconde `Qualification-052-B.sqlite`. Le registre utilise le format 1. Sa dernière bibliothèque active est la principale. Les deux chemins et leurs dates de première ouverture ont été retrouvés. Vérification visuelle en 0.1.29 dans **Bibliothèque → Bibliothèques connues** avec les deux noms proposés et la principale cochée.

| Mesure, application fermée | Avant Setup candidat | Après première relance 0.1.29 |
| --- | --- | --- |
| SQLite principale | 114 688 octets, TEXO 1413830735, schéma 5 | Identiques, intégrité SQLite OK |
| SHA-256 principale | `727c0d906d776a466859a0e1f556a04c30fe0336c944f833749c7c2cc88fc947` | Identique |
| SHA-256 seconde, 90 112 octets | `5de06a8ccfcd3bd1432dbac48243723f7ce0b922ec4e486ce472708d465d963a` | Identique, y compris en fin de recette |
| SHA-256 registre, 535 octets | `baad38dd570d4a7a751d3c691b98f50c2b89899828f3a1a0c874205db7d69fa1` | `0463eb38f98fb6fd08bb7a1656a2186b7faea5c052b09cb7fa2a204189436175` ; actualisation de la dernière ouverture |

- **Dossiers et documents.** Trois dossiers, dont Sous-bois 052 (ID 2) sous Zinnia 052 (ID 1), et Aster 052 (ID 3). Quatre documents au total. Lisière 052 (ID 1) est actif, favori, classé dans Sous-bois. Papier 052 (ID 2) est un brouillon non classé. Oublié 052 (ID 3) est archivé et placé en corbeille. Le TODO (ID 4) conserve son rôle et son contenu « Préparer les semis fictifs 052 ». La recherche enregistrée « Recherche 052 » conserve ses critères et relations. Les lignes complètes ont été comparées, y compris les contenus, les notes, les identifiants, les positions et les dates de modification.
- **Après consultation des documents.** La principale reste à 114 688 octets, avec SHA-256 `1c188119a2ae8c908c838ad8fb5c0a38bf20704545303ecdde682f245d838c53`. Parmi les colonnes documentaires, seul `last_opened_at` du document 1 a changé. Le dernier SHA du registre après contrôle du menu est `b114b863c822709378a5fa8aaedacacea1130b1cd905ff387c448046fd0c85f1`. Les dates d’usage expliquent les écarts observés.
- **Préférences héritées de 0.1.28.** Les dossiers développés 1 et 2 et le layout (gauche 28 %, droite 19 %, volet droit masqué) ont été initialisés dans le Local Storage du renderer historique, puis vérifiés après relance de chaque version. L’arbre et le volet affichés correspondent aux valeurs.
- **Préférences introduites après la baseline.** Le thème sombre et l’ordre alphabétique ont été initialisés dans le renderer 0.1.29, puis retrouvés au lancement suivant. L’arbre affiche Aster avant Zinnia, le menu contextuel propose Renommer. Dans Lisière, Ctrl+↓ porte la zone visible de 275 à 301 px. La fermeture Windows normale puis la réouverture restituent la sélection arrière 80–125 et les 301 px. Le premier essai de fermeture par JavaScript n’avait pas restitué cette position. Le résultat annoncé correspond au geste de fermeture Windows, qui passe par le garde-fou applicatif.

## Tests, limites et état laissé

- Build TypeScript/Vite et fabrication Squirrel réussis pour les deux sources. Candidate construite depuis une révision identifiée avant ajout du rapport et des outils de comparaison.
- Candidate, codes 0 pour `test:electron-sqlite`, `test:app-identity`, `test:runtime-profile`, `test:packaged-smoke` et `test:installer-smoke`. Le smoke installé historique passe aussi sur la 0.1.28. Les smokes d’écriture utilisent des profils temporaires séparés de la fixture STABLE.
- Le test de mise à jour combine l’exécution réelle des deux Setup, l’inventaire Windows et le comparateur en lecture seule `scripts/check-stable-upgrade.py`. Il passe sur les copies avant/après Setup, après essais de préférences et après contrôle visuel. Le collecteur reproductible est `scripts/collect-stable-upgrade-snapshot.ps1`. Il exige la fixture marquée et l’application fermée.
- Les suites exhaustives DEV (migrations legacy, recherche, catalogue, autosave, erreurs IPC, sauvegardes, export, UI et coexistence DEV/STABLE) n’ont pas été rejouées. Les smokes packagé et installé couvrent le preload, le schéma, l’autosave, la recherche, le TODO et une recherche enregistrée. Aucun test de downgrade, de panne forcée ou de signature Windows.
- La 0.1.29 est laissée installée et fermée sur CODEX_VM avec son profil explicitement fictif, ses artefacts locaux et les relevés ignorés par Git. Le worktree historique temporaire a été retiré après vérification de la copie locale du Setup. Le résultat qualifie ce chemin de mise à jour manuel sous le même compte Windows. Toute livraison à Zenith Ice relève d’une décision ultérieure.
