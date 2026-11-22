# 054 — Livraison finale de Textothèque 0.1.29

**GO-LIVRAISON sur CODEX_VM, le 22 novembre 2026.** Les quatre fichiers de remise sont prêts pour la récupération manuelle par David. Le Setup remis fait **117 161 472 octets**. Son SHA-256, recalculé après copie, est **`118acafe639f37ff49aafc6e3cb7454b2938ac8f6696b4ea5f2ce3b3e4e8fa83`**.

## Fichiers locaux

Dossier de remise : `C:\Users\codex\Documents\Livraisons\Textotheque-0.1.29-ZI\`. Son inventaire après copie contient exactement les fichiers suivants.

| Fichier | Usage |
| --- | --- |
| `Textotheque Setup.exe` | Mise à jour manuelle de la STABLE 0.1.28 |
| `manifest.json` | Source, date UTC, taille et empreinte des trois artefacts de fabrication |
| `SHA256SUMS.txt` | Empreintes du Setup, du manifeste et de la fiche |
| `README_TRANSFERT_ZI.txt` | Sauvegarde préalable, fermeture, mise à jour et recette par David |

Sortie technique : `C:\Users\codex\Documents\Projets\Textotheque\dist-release\Textotheque-0.1.29\`. Le paquet complet et `RELEASES` restent dans ce dossier. Les trois fichiers texte remis ont été relus. Le manifeste et le Setup copiés ont chacun la même empreinte que leur original.

## Fabrication et contrôles

Source : `e848834e151ef3ce09ab1171894ad4710e7294cf`. Avant fabrication, `main` et `origin/main` désignaient ce commit, `git status --short` était vide et `git diff --check` ne signalait aucun écart. Le projet et son verrouillage indiquaient 0.1.29. Le manifeste produit par `npm.cmd run release:win` confirme ce commit et `dirty: false`. Les tailles et les SHA-256 des trois artefacts du manifeste ont été recalculés.

| Contrôle | Résultat |
| --- | --- |
| ICO de 053a | Le fichier canonique et les octets téléchargés depuis l’URL immuable Squirrel au commit `c531bfbd297f15aa22d08b6f7823e2e2b6fc18e1` ont le SHA-256 qualifié `8c09033181f9d5af931eaeea24aceebe2614c0cfa5b56b0490b4121f8b52ca85`. |
| `python scripts/check-windows-icon.py` | Les dix images transparentes correspondent octet pour octet dans le Setup final, l’EXE packagé, le lanceur et l’EXE de la STABLE fictive installée. |
| Contenu remis | Le NUPKG extrait en mémoire du Setup est identique au paquet contrôlé. Son EXE, son ASAR et son ICO sont identiques à ceux du package testé. L’inventaire du NUPKG et des 668 entrées ASAR ne révèle aucune bibliothèque SQLite, aucun profil utilisateur, rapport ou capture privée. |
| Identité Squirrel | Package et produit `Textotheque`, exécutable `Textotheque.exe`, installateur `Textotheque Setup.exe`. L’ASAR contient l’AppUserModelID attendu et Windows expose `com.squirrel.Textotheque.Textotheque`. |
| `npm.cmd run test:packaged-smoke` | Réussi sur le package final. Renderer local en `file:`, version 0.1.29 et schéma 5. Un lancement supplémentaire sur profil temporaire a confirmé le texte rendu **v0.1.29** dans la barre de statut. |
| `npm.cmd run test:installer-smoke` | Réussi via le lanceur de la STABLE fictive déjà installée. Son ASAR a la même empreinte que celui du build final. |
| `npm.cmd run test:app-identity` et `npm.cmd run test:runtime-profile` | Réussis. Identité DEV, isolation des profils et renderer STABLE local confirmés. |

## Portée

Le cycle de mise à jour 0.1.28 → 0.1.29 reste celui qualifié en 052. Les différences depuis le build qualifié en 053a portent exclusivement sur la documentation et les captures. Le nouveau Setup a été inspecté directement et son contenu exécuté au niveau du package. Le cycle d’installation complet et les suites métier générales n’ont pas été rejoués.

Seul ce rapport est destiné à GitHub. Aucun binaire publié et aucune Release GitHub créée. Aucun accès à Zenith Ice, transfert ou installation hors de CODEX_VM.
