# Distribution Windows de Textothèque

## DEV et STABLE

Textothèque possède deux runtimes indépendants, choisis avec `app.isPackaged` :

| Runtime | Lancement | Nom visible | Profil | Renderer |
|---|---|---|---|---|
| DEV | `npm.cmd run dev` ou `START_TEXTOTHEQUE.bat` | Textotheque DEV | `%APPDATA%\Textotheque-Dev` | Vite, port strict 5173 |
| STABLE | installation Windows | Textotheque | `%APPDATA%\Textotheque` | build local avec `file://` |

La STABLE conserve donc l’emplacement historique de la bibliothèque réelle. DEV crée ses propres `textotheque.sqlite`, `library-history.json`, session Chromium, caches et Local Storage. Aucune donnée STABLE n’est copiée vers DEV.

Les overrides `TEXTOTHEQUE_DB_PATH` et `TEXTOTHEQUE_LIBRARY_HISTORY_PATH` restent prioritaires. Les diagnostics automatisés redirigent aussi `userData` vers un répertoire `%TEMP%\textotheque-test-*` et ne doivent jamais ouvrir `%APPDATA%\Textotheque\textotheque.sqlite`.

## Produire la distribution

Sur Windows x64, partir d’un commit validé et d’un arbre propre. Sur une installation neuve de CODEX_VM, utiliser le verrouillage et cibler Electron dès l’installation du module natif.

```powershell
$env:npm_config_runtime = 'electron'
$env:npm_config_target = node -p "require('./package-lock.json').packages['node_modules/electron'].version"
npm.cmd ci --no-audit --no-fund
```

Après réussite, depuis la racine du dépôt, lancer la fabrication.

```powershell
npm.cmd run release:win
```

Cette commande appelle `make:win` (TypeScript, Vite, ASAR, module natif et Squirrel), vérifie le numéro de version et le paquet référencé dans `RELEASES`, puis copie le Setup, le paquet complet et `RELEASES` dans `dist-release/Textotheque-<version>/`. Le manifeste JSON local donne l’heure UTC, le commit, l’état de l’arbre, les tailles et les SHA-256. Contrôler une sortie construite avec `dirty: false`. Une nouvelle fabrication peut avoir un hash différent. Le hash de référence appartient au binaire effectivement qualifié. Les sorties de 052 restent sur CODEX_VM.

## Mise à jour d’une STABLE existante

Cette procédure est réservée à une intervention ultérieure autorisée par le mainteneur.

1. Relever la version installée, la bibliothèque active et son emplacement réel. Depuis **Bibliothèque → Sauvegarder une copie…**, créer un snapshot vérifié pour chaque bibliothèque précieuse. Sauvegarder d’abord les modifications du document en cours.
2. Fermer Textothèque normalement et attendre la fin de ses processus. Conserver séparément la sauvegarde, une copie du profil fermé si les préférences doivent aussi pouvoir être restaurées, et le Setup de la version en place s’il est disponible. Cette sauvegarde constitue le filet de sécurité de l’utilisateur.
3. Vérifier la provenance, la version, le nom de package Squirrel `Textotheque` et le SHA-256 du nouveau Setup par rapport au manifeste validé. Sous PowerShell, utiliser `Get-FileHash -LiteralPath '.\Textotheque Setup.exe' -Algorithm SHA256`.
4. Exécuter le nouveau Setup sous le même compte Windows, directement sur l’installation en place. Attendre la fin de Squirrel, puis relancer depuis le raccourci habituel du menu Démarrer.
5. Contrôler la version en barre d’état, l’unique entrée Windows et la bibliothèque active. Vérifier quelques documents et dossiers, le TODO, les recherches, les bibliothèques connues et les préférences. Garder les anciens artefacts et les sauvegardes jusqu’à validation.

### En cas d’échec

Si le Setup échoue avant activation, fermer ses processus normalement et relever le message, la version dans Applications installées, les dossiers sous `%LOCALAPPDATA%\Textotheque` et, s’il existe, le journal `%LOCALAPPDATA%\SquirrelTemp\SquirrelSetup.log`. Vérifier depuis le raccourci si la version précédente démarre encore. Préserver les deux Setup et le profil avant toute réparation.

Squirrel utilise un lanceur stable et des fichiers applicatifs versionnés. Il peut retirer l’ancien répertoire et son paquet. Un retour automatique à la version précédente ne fait pas partie du scénario qualifié. Toute réinstallation du programme précédent nécessite un essai séparé et une validation de compatibilité du schéma. Pour récupérer les textes, ouvrir une **copie** du snapshot vérifié depuis le menu Bibliothèque, puis contrôler ses sentinelles. La récupération du profil Chromium et du registre se fait séparément, application fermée, à partir de la copie du profil. Toute substitution à des fichiers personnels exige l’accord du mainteneur.

## Rejouer le contrôle 052 sur un profil jetable

Sur une VM dédiée, inventorier programme, profil, raccourcis, entrée Windows et processus avant de commencer. Une origine incertaine impose l’arrêt. Le rapport 052 donne le commit de référence, les sentinelles et les résultats attendus. Construire puis installer la baseline. Sur le profil de test nouvellement créé uniquement, identifier sa provenance par un fichier `qualification-052.txt` commençant par `CODEX_VM 052 - profil fictif`. Créer les données décrites dans le rapport, dont la seconde bibliothèque `Qualification-052-B.sqlite` dans le profil. Revenir à la bibliothèque principale, fermer normalement et conserver le premier relevé. Installer ensuite la candidate par-dessus, la relancer depuis le raccourci, vérifier l’interface et fermer.

```powershell
# Avant le Setup candidat, avec un dossier de destination neuf
.\scripts\collect-stable-upgrade-snapshot.ps1 -Destination .\out\avant-052
# Après le Setup et la relance, avec la même fixture fermée
.\scripts\collect-stable-upgrade-snapshot.ps1 -Destination .\out\apres-052
python scripts/check-stable-upgrade.py out/avant-052 out/apres-052
```

Le comparateur ouvre les copies en lecture seule, vérifie l’identité et l’intégrité SQLite, les lignes métier, le registre et l’identité Windows. Vérifier séparément dans le renderer les préférences présentes en baseline puis celles initialisées dans la candidate.

## Limites actuelles

- Aucun serveur, port Vite ou chemin vers le dépôt source n’est requis par STABLE.
- L’auto-update et la publication distante ne sont pas configurés.
- La build locale n’est pas signée : Windows peut afficher un avertissement d’éditeur inconnu.
- Aucune icône Textothèque exploitable n’existait dans le dépôt ; l’identité graphique est reportée.
