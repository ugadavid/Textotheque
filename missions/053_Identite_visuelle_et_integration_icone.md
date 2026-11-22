# Mission 053 — Identité visuelle et intégration de l’icône Textothèque

**Date :** 22 novembre 2026  
**Décision fonctionnelle validée :** Textothèque 0.1.29 adopte comme identité visuelle le symbole **document blanc plongeant dans une base de données cylindrique anthracite/cuivre** validé par David.  
**Nature :** intégration graphique et packaging Windows. **Aucune livraison vers Zenith Ice dans cette mission.**

## Sources déjà présentes dans le dépôt

David a lui-même ajouté et poussé les deux fichiers validés :

- `missions/053-ico/textotheque-0.1.29-icon.png`
- `missions/053-ico/textotheque-0.1.29.ico`

Le PNG est la référence visuelle haute définition / mémoire graphique.  
Le ICO est le fichier Windows multirésolution destiné à l’intégration.

**Ne pas régénérer, redessiner, recolorer ou remplacer ces fichiers.**  
Le visuel validé est la source de cette mission.

## Objectif

Remplacer l’identité Electron générique par la véritable identité Textothèque dans les surfaces Windows pertinentes :

- exécutable packagé ;
- fenêtre Electron / barre des tâches lorsque Windows utilise l’icône de l’application ;
- raccourci menu Démarrer ;
- entrée Applications installées si Squirrel l’expose ;
- installateur Squirrel / Setup lorsque la configuration le permet ;
- icône des artefacts packagés pertinents.

La version reste **0.1.29**. Cette mission ne crée pas une nouvelle version fonctionnelle.

## 1 — Ranger les sources graphiques

Le dossier `missions/053-ico` est un dossier de transmission temporaire.

Créer un emplacement pérenne et explicite dans le dépôt, par exemple :

```text
assets/
  branding/
    textotheque-icon.png
    textotheque.ico
```

ou une organisation équivalente cohérente avec le projet.

Déplacer ou copier proprement les deux fichiers vers cet emplacement. Une fois la source canonique installée ailleurs, le dossier temporaire `missions/053-ico` peut être supprimé si cela ne perd aucune information utile.

Le PNG doit rester versionné comme référence visuelle. Le ICO doit rester versionné comme artefact source de packaging.

## 2 — Intégration Electron / Forge

Inspecter la configuration réelle `forge.config.cjs` et intégrer l’icône avec les mécanismes standards adaptés à Electron Forge / Electron Packager / Squirrel.

Vérifier notamment les points suivants plutôt que de supposer les noms d’options :

- icône de l’exécutable packagé ;
- icône utilisée par Squirrel pour le Setup si supportée ;
- icône du raccourci installé ;
- éventuelle icône de fenêtre Windows si nécessaire explicitement.

Réutiliser **le même ICO canonique** autant que possible. Ne pas créer plusieurs copies divergentes.

Ne pas modifier :

- `productName` ;
- nom Squirrel `Textotheque` ;
- `Textotheque.exe` ;
- `Textotheque Setup.exe` ;
- `appUserModelId` ;
- chemins STABLE / DEV ;
- identité de mise à jour validée en 052.

L’intégration de l’icône ne doit surtout pas casser la compatibilité de mise à jour 0.1.28 → 0.1.29 qualifiée en 052.

## 3 — Fenêtre DEV et STABLE

Si Windows/Electron exige une propriété `icon` explicite sur `BrowserWindow` pour afficher correctement l’identité dans certains contextes, l’ajouter de manière propre.

Attention :

- DEV doit pouvoir démarrer depuis le dépôt ;
- STABLE doit retrouver la ressource dans le package ASAR / ressources packagées ;
- ne pas introduire de chemin absolu vers CODEX_VM ;
- ne pas dépendre du dossier `missions/` au runtime ;
- ne pas casser le renderer `file://`.

Si l’icône packager suffit réellement et qu’une propriété BrowserWindow serait redondante ou fragile, ne pas l’ajouter sans besoin. Documenter le choix.

## 4 — Packaging / filtres ASAR

La mission 052 a resserré le contenu distribué.

Adapter les règles d’inclusion si nécessaire pour que l’icône runtime soit réellement disponible dans le package, sans réintroduire :

- sources inutiles ;
- rapports ;
- missions ;
- bases SQLite ;
- chemins de développement ;
- captures de recette.

Le PNG haute définition n’a pas besoin d’être embarqué dans l’application installée sauf nécessité démontrée. Il peut rester uniquement dans le dépôt comme source graphique.

## 5 — Vérification visuelle Windows

Construire une candidate locale 0.1.29 sur CODEX_VM avec le pipeline qualifié :

```powershell
npm.cmd run release:win
```

Puis vérifier avec données fictives uniquement :

1. EXE packagé : icône Textothèque, plus icône Electron ;
2. fenêtre lancée : identité cohérente dans la barre des tâches ;
3. Setup : icône Textothèque si Squirrel le permet avec la configuration retenue ;
4. installation sur CODEX_VM de qualification : raccourci menu Démarrer avec l’icône Textothèque ;
5. entrée Applications installées : vérifier ce que Windows affiche réellement ;
6. relance depuis le raccourci : application 0.1.29 fonctionnelle ;
7. aucune seconde identité / installation créée ;
8. désinstallation / réinstallation uniquement si nécessaire à la preuve et uniquement sur le profil fictif de qualification laissé par 052.

Captures souhaitées :

- raccourci / menu Démarrer ou zone Windows montrant l’icône ;
- fenêtre / barre des tâches ;
- éventuellement Setup ou Applications installées si l’icône y est visible.

Les captures doivent rester dépourvues de données personnelles.

## 6 — Compatibilité avec la qualification 052

Cette mission intervient **après** un GO-QUALIF 052.

Refaire les contrôles nécessaires pour prouver que l’ajout d’icône n’a pas altéré :

- identité Squirrel ;
- version 0.1.29 ;
- chemin d’installation ;
- profil `%APPDATA%\Textotheque` ;
- raccourci unique ;
- application packagée en `file://`.

Un nouveau test complet 0.1.28 → 0.1.29 n’est pas automatiquement nécessaire si le changement reste strictement graphique/configuration Packager, mais Codex doit utiliser son jugement. Si une option Squirrel modifie l’identité du package ou le mécanisme d’installation, **rejouer le scénario de mise à jour**.

Ne pas annoncer la compatibilité comme acquise si la configuration change un identifiant sensible.

## 7 — Tests proportionnés

Au minimum :

- `npm.cmd run build`;
- `npm.cmd run release:win`;
- `npm.cmd run test:packaged-smoke`;
- `npm.cmd run test:installer-smoke`;
- contrôle de l’identité applicative / runtime pertinent ;
- inspection réelle des ressources / métadonnées Windows pour vérifier que l’icône est embarquée ;
- recette visuelle Windows.

Ne pas rejouer les suites métier SQLite/recherche/autosave sans lien avec l’intégration graphique.

## 8 — Documentation

Mettre à jour `docs/DISTRIBUTION_WINDOWS.md` pour :

- indiquer l’emplacement canonique de l’icône ;
- préciser que le pipeline de release embarque cette identité ;
- supprimer la limite historique disant qu’aucune icône Textothèque exploitable n’existe ;
- conserver la procédure de mise à jour qualifiée en 052.

Si une règle durable est utile aux futurs agents, mettre à jour `AGENTS.md` de manière concise.

## 9 — Frontière stricte

**Aucun transfert vers Zenith Ice.**

Cette mission peut générer un Setup local et l’installer sur CODEX_VM pour recette, mais :

- ne pas copier ce Setup vers ZI ;
- ne pas le qualifier de livraison finale ;
- ne pas intervenir sur l’installation réelle 0.1.28 de ZI ;
- ne pas lancer la mission de livraison suivante.

La future livraison réelle vers ZI sera une mission distincte, désormais **054**, après validation humaine de l’icône intégrée.

## Rapport

Créer :

`reports/053_Identite_visuelle_et_integration_icone_report.md`

Le rapport doit préciser :

- emplacement canonique retenu pour PNG/ICO ;
- paramètres Forge / Squirrel modifiés ;
- surfaces Windows où l’icône est effectivement visible ;
- surfaces où Windows/Squirrel conserve éventuellement un comportement propre ;
- preuves visuelles ;
- tests exécutés / non exécutés ;
- impact ou absence d’impact sur l’identité de mise à jour qualifiée en 052 ;
- SHA-256 du Setup candidat local si construit ;
- limites restantes.

Publier code, assets validés, documentation, tests éventuels et rapport sur `origin/main` quel que soit le verdict. Vérifier SHA distant, `git diff --check`, état propre et synchronisé.

**S’arrêter après 053 pour recette humaine. Ne rien transférer vers Zenith Ice.**
