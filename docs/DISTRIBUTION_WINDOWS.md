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

Depuis un état Git validé :

```powershell
npm.cmd run make:win
```

La commande compile le renderer et Electron, package l’application avec ASAR, reconstruit `better-sqlite3` pour la version Electron réellement installée, puis exécute Squirrel.Windows.

Artefacts x64 :

```text
out\Textotheque-win32-x64\Textotheque.exe
out\make\squirrel.windows\x64\Textotheque Setup.exe
out\make\squirrel.windows\x64\Textotheque-0.1.28-full.nupkg
out\make\squirrel.windows\x64\RELEASES
```

`Textotheque Setup.exe` est l’installateur à remettre au mainteneur. Le `.nupkg` et `RELEASES` sont des artefacts Squirrel, pas l’interface d’installation principale. `out/` est ignoré par Git.

## Installation et mise à jour manuelle

Exécuter `Textotheque Setup.exe`, puis lancer Textotheque depuis le menu Démarrer. La version actuelle est `0.1.28` et le schéma SQLite reste `5`.

Pour une future mise à jour manuelle :

```text
développement → tests → validation humaine → commit → npm.cmd run make:win → nouveau Setup.exe
```

Le programme est installé sous `%LOCALAPPDATA%`; les données vivent séparément sous `%APPDATA%\Textotheque`. Une mise à jour des fichiers applicatifs ne doit donc jamais embarquer ni remplacer la bibliothèque, le registre ou les backups utilisateur.

## Limites actuelles

- Aucun serveur, port Vite ou chemin vers le dépôt source n’est requis par STABLE.
- L’auto-update et la publication distante ne sont pas configurés.
- La build locale n’est pas signée : Windows peut afficher un avertissement d’éditeur inconnu.
- Aucune icône Textothèque exploitable n’existait dans le dépôt ; l’identité graphique est reportée.
