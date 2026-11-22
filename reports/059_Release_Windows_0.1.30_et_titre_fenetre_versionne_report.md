# Rapport 059 — Release Windows 0.1.30 et titre de fenêtre versionné

**Verdict GO-LIVRAISON.** Le Setup final a mis à jour la STABLE fictive 0.1.29 sur CODEX_VM. Les quatre fichiers attendent la récupération manuelle de David.

## Remise locale

- Dossier de remise : `C:\Users\codex\Documents\Livraisons\Textotheque-0.1.30-ZI\`
- Staging : `C:\Users\codex\Documents\Projets\Textotheque\dist-release\Textotheque-0.1.30\`
- Source gelée : [632ca9e831d3959f1d251ee0cb1d38fb675c0662](https://github.com/ugadavid/Textotheque/commit/632ca9e831d3959f1d251ee0cb1d38fb675c0662). HEAD et main distant identiques, worktree propre, diff vérifié avant fabrication. Le manifeste indique ce commit et `dirty: false`. Le commit documentaire post-fabrication ajoute uniquement ce rapport.

| Fichier dans le dossier de remise | Octets |
| --- | ---: |
| Textotheque Setup.exe | 117 166 592 |
| manifest.json | 626 |
| SHA256SUMS.txt | 261 |
| README_TRANSFERT_ZI.txt | 1 334 |

SHA-256 du Setup recalculé depuis la remise : **`9a53cb895fdd1a8d13ed411d15fa8725502cf10acbb2f59839d74b89986e447f`**. Taille et empreinte identiques au staging et au manifeste. Le fichier SHA256SUMS contient aussi les empreintes du manifeste et de la fiche.

## Version, titre et fichiers source

David a autorisé le passage de 0.1.29 à **0.1.30**. La version figure dans package.json et aux deux emplacements racine du verrouillage. Les lanceurs DEV de package.json ouvrent le projet avec `electron .` pour donner à Electron ses métadonnées de package. Le main process compose le titre avec `app.getVersion()` et intercepte `page-title-updated` avant le chargement. Le titre HTML porte le nom accentué. La documentation de distribution et les tests d’identité, de runtimes simultanés et de package reflètent cette distinction.

Titre DEV vérifié après chargement puis après tentative de remplacement par le renderer et navigation : **Textothèque DEV · 0.1.30**. Titre STABLE vérifié en package et sur la fenêtre Windows du programme installé : **Textothèque · 0.1.30**. La barre de statut indique **v0.1.30** dans les deux runtimes.

## Fabrication et qualification niveau C

| Commande ou contrôle | Résultat |
| --- | --- |
| `npm.cmd run build`, `test:app-identity` et `test:concurrent-runtime` avant gel | Compilation et identité réussies. Titre et version du renderer DEV concordants. |
| `node scripts/electron-theme-check.cjs` | Trois scénarios sur données fictives réussis, dont Info, favoris, notes, autosave, Corbeille, TODO et thèmes. |
| `npm.cmd run release:win` | Forge et Squirrel x64 réussis. Tailles et SHA-256 des trois artefacts recalculés. Le NUPKG et RELEASES embarqués dans le Setup sont identiques aux fichiers de staging. |
| Inspection du NUPKG et de l’ASAR | L’EXE, l’ASAR et l’ICO embarqués correspondent au package testé. Inventaire du paquet et des 668 entrées ASAR contrôlé pour les bases, profils, rapports et captures privés. |
| `python scripts/check-windows-icon.py` | Les dix images ICO du Setup et de l’EXE correspondent à l’ICO canonique de 053a. |
| `npm.cmd run test:packaged-smoke` | Succès du package final sur profil temporaire. Titre et version en barre de statut, renderer local file://, preload, schéma 5, autosave, TODO, recherche et recherche enregistrée vérifiés. |
| `npm.cmd run test:app-identity`, `test:runtime-profile`, `test:concurrent-runtime` après fabrication | Succès. Séparation DEV/STABLE et chemins historiques vérifiés. |
| Mise à jour effective et `npm.cmd run test:installer-smoke` | Setup final exécuté sur la fixture 0.1.29 fermée, code 0. Test du lanceur installé 0.1.30 réussi sur profil temporaire. ASAR, EXE et ICO installés identiques au package qualifié. |

## Avant et après mise à jour sur CODEX_VM

Le marqueur 052, le registre limité aux deux bibliothèques de qualification, le comparateur historique, l’entrée Windows 0.1.29 et l’absence de processus ont identifié la fixture avant installation. Les relevés locaux sont dans `out/qualification-059/avant`, `apres` et `relance`.

Une seule application et un seul raccourci Démarrer avant et après. Le produit et le package Squirrel restent `Textotheque`, l’exécutable `Textotheque.exe`, l’installation `%LOCALAPPDATA%\Textotheque` et l’AppUserModelID `com.squirrel.Textotheque.Textotheque`. Le profil STABLE `%APPDATA%\Textotheque` conserve sa date de création. DEV utilise `%APPDATA%\Textotheque-Dev`.

Juste après le Setup, les deux SQLite, le registre, Preferences et les fichiers du Local Storage sont identiques octet pour octet aux copies avant installation. Après relance depuis le raccourci et fermeture normale, le comparateur retrouve les données métier, la bibliothèque active, les deux bibliothèques connues et leur intégrité selon les contrôles de 052. Pour la fenêtre lancée masquée par le test, le titre natif a été lu directement sur la fenêtre Windows du processus installé.

## Limites et suite manuelle

La qualification porte sur CODEX_VM et des données fictives. La recette de la bibliothèque personnelle sur Zenith Ice appartient à David. Le Setup local reste non signé. La fiche de transfert décrit la vérification du hash sur la machine de destination, la sauvegarde et la fermeture de la STABLE, puis les contrôles de version, titre, bibliothèque, documents, dossiers, TODO, Info, palette et préférences. Aucun binaire sur GitHub, aucun accès ni transfert vers Zenith Ice.
