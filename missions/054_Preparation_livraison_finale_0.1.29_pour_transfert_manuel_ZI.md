# Mission 054 — Préparation de la livraison finale 0.1.29 pour transfert manuel vers Zenith Ice

**Date :** 22 novembre 2026  
**Décision :** préparer sur CODEX_VM les fichiers finaux Textothèque 0.1.29 que David transférera lui-même vers Zenith Ice.  
**Nature :** gel, fabrication et remise de livrables. **Codex n’a aucun accès à Zenith Ice et ne doit tenter aucune installation hors CODEX_VM.**

## Contexte

Les étapes préalables sont terminées :

- 052 : **GO-QUALIF** de la mise à jour Squirrel 0.1.28 → 0.1.29 sur installation réelle de qualification ;
- 053 : intégration initiale de l’identité visuelle ;
- 053a : **GO** avec ICO cuivre transparent et diagnostic de la barre des tâches ; l’icône correcte est visible partout après rafraîchissement du shell Windows.

La STABLE réelle de Zenith Ice est encore en **0.1.28**.  
David effectuera lui-même :

1. la récupération des fichiers depuis CODEX_VM ;
2. la sauvegarde de sa vraie bibliothèque sur ZI ;
3. l’exécution du Setup 0.1.29 par-dessus l’installation existante ;
4. la recette humaine finale.

**Cette mission ne fait aucune de ces opérations sur ZI.**

## Principe de gel

054 n’ajoute **aucune fonctionnalité** et ne change **aucun comportement produit**.

La version reste :

`0.1.29`

Ne pas :

- modifier le schéma SQLite ;
- modifier les fonctionnalités 049–051 ;
- modifier les thèmes ;
- modifier l’identité Squirrel ;
- modifier l’AppUserModelID ;
- changer les chemins DEV/STABLE ;
- changer l’icône validée ;
- ajouter une dépendance ;
- augmenter la version.

Si un défaut bloquant est découvert pendant la fabrication, **ne pas le corriger opportunistement** dans 054 : publier un verdict NO-GO/PARTIEL et expliquer le besoin d’une mission corrective.

## 1 — État source obligatoire

Avant fabrication :

- synchroniser avec `origin/main` ;
- vérifier le SHA exact ;
- `git status --short` vide ;
- `git diff --check` ;
- version `0.1.29` dans `package.json` et `package-lock.json` ;
- vérifier que `assets/branding/textotheque.ico` est bien l’ICO transparent qualifié en 053a ;
- SHA-256 attendu de l’ICO canonique :  
  `8c09033181f9d5af931eaeea24aceebe2614c0cfa5b56b0490b4121f8b52ca85`.

Vérifier également que l’`iconUrl` Squirrel immuable pointe vers une révision contenant **exactement ce même ICO**. Si ce n’est pas démontrable, **NO-GO** plutôt que publier un Setup ambigu.

## 2 — Fabrication finale

Depuis l’état propre et synchronisé :

```powershell
npm.cmd run release:win
```

La sortie de référence reste :

```text
dist-release\Textotheque-0.1.29\
```

Le manifeste doit impérativement indiquer :

- version = `0.1.29` ;
- commit exact de fabrication ;
- `dirty: false` ;
- taille et SHA-256 de chaque artefact.

Cette fabrication finale remplace comme référence de livraison les Setup intermédiaires produits pendant 052, 053 et 053a.

## 3 — Contrôles finaux proportionnés

Il ne s’agit pas de refaire toute la qualification, mais de prouver que **le binaire remis est bien celui correspondant à l’état final**.

Exécuter au minimum :

- `npm.cmd run test:packaged-smoke`;
- `npm.cmd run test:installer-smoke`;
- `npm.cmd run test:app-identity`;
- `npm.cmd run test:runtime-profile`;
- `python scripts/check-windows-icon.py ...` sur les artefacts finaux pertinents.

Vérifier en plus :

- renderer STABLE = `file://` ;
- version visible = 0.1.29 ;
- schéma = 5 ;
- nom Squirrel = `Textotheque` ;
- Setup = `Textotheque Setup.exe` ;
- EXE = `Textotheque.exe` ;
- AppUserModelID inchangé = `com.squirrel.Textotheque.Textotheque` ;
- ICO transparent présent dans les PE contrôlés ;
- aucune donnée SQLite, aucun profil, aucun rapport ou capture privée embarqué dans le package.

Il n’est pas nécessaire de rejouer le cycle complet 0.1.28 → 0.1.29 : il est déjà qualifié par 052, tant qu’aucun identifiant/mécanisme sensible n’a changé depuis.

## 4 — Dossier de transfert pour David

Préparer un dossier local simple, clairement identifiable, hors de toute ambiguïté avec les artefacts de test antérieurs.

Emplacement recommandé :

```text
C:\Users\codex\Documents\Livraisons\Textotheque-0.1.29-ZI\
```

ou un emplacement utilisateur équivalent si ce chemin n’est pas disponible.

Ce dossier doit contenir **uniquement ce qui aide réellement David à transférer et vérifier la livraison** :

1. `Textotheque Setup.exe`
2. `manifest.json`
3. `SHA256SUMS.txt`
4. `README_TRANSFERT_ZI.txt`

Le `.nupkg` et `RELEASES` restent dans `dist-release` comme artefacts techniques Squirrel ; ne les dupliquer dans le dossier de transfert que si une raison concrète l’exige.

### SHA256SUMS.txt

Contenir au minimum le SHA-256 exact de :

`Textotheque Setup.exe`

et éventuellement des autres fichiers transférés.

### README_TRANSFERT_ZI.txt

Fiche très courte, destinée à David, sans jargon inutile. Elle doit indiquer :

- version : 0.1.29 ;
- commit source ;
- SHA-256 du Setup ;
- taille du Setup ;
- que ce Setup est destiné à **mettre à jour** l’unique Textothèque 0.1.28 existante, pas à créer une seconde application ;
- que les données STABLE vivent séparément sous `%APPDATA%\Textotheque`;
- que la mise à jour 0.1.28 → 0.1.29 a été qualifiée sur CODEX_VM ;
- rappel : faire une sauvegarde de la vraie bibliothèque **avant** installation ;
- rappel : fermer Textothèque avant d’exécuter le Setup ;
- après installation : contrôler la version 0.1.29, la bibliothèque, quelques documents/dossiers, TODO et préférences ;
- si l’ancienne icône Electron reste temporairement dans la barre des tâches, fermer Textothèque et rafraîchir/redémarrer Explorer avant de conclure à un défaut.

Cette fiche **n’autorise aucune automatisation sur ZI** ; elle accompagne seulement notre manipulation manuelle.

## 5 — Ne pas publier les binaires sur GitHub

Les binaires finaux restent sur CODEX_VM pour transfert manuel par David.

Ne pas :

- committer le Setup ;
- committer le NUPKG ;
- committer le dossier `dist-release` ;
- committer le dossier `Livraisons`;
- créer de GitHub Release ;
- uploader les binaires vers un service externe.

Le dépôt reçoit uniquement le rapport 054 et, si nécessaire, une correction documentaire sans modification produit.

## 6 — Vérification du dossier remis

Avant de conclure :

- recalculer le SHA-256 du Setup **dans le dossier de transfert**, après copie ;
- vérifier qu’il correspond au Setup de `dist-release`;
- vérifier la taille ;
- ouvrir/lire `manifest.json`, `SHA256SUMS.txt` et `README_TRANSFERT_ZI.txt`;
- lister exactement les fichiers présents dans le dossier ;
- ne laisser aucune ancienne candidate 052/053/053a dans ce même dossier de transfert.

## 7 — Verdict

- **GO-LIVRAISON** : dossier final prêt à être récupéré manuellement par David ;
- **PARTIEL** : artefacts produits mais une preuve finale manque ;
- **NO-GO** : divergence de version, identité, hash, icône, packaging ou tests ;
- **BLOQUÉ** : environnement incapable de produire une sortie sûre sans toucher à des données non jetables.

Un **GO-LIVRAISON n’exécute rien sur Zenith Ice**. Il signifie uniquement : « les fichiers sont prêts à être copiés ».

## Rapport

Créer :

`reports/054_Preparation_livraison_finale_0.1.29_pour_transfert_manuel_ZI_report.md`

Le rapport doit contenir :

- SHA source exact ;
- état Git avant fabrication ;
- version ;
- SHA-256 ICO ;
- commandes/tests exécutés et résultats ;
- chemin exact de `dist-release`;
- chemin exact du dossier de transfert ;
- liste des fichiers remis ;
- taille + SHA-256 du Setup final ;
- confirmation `dirty: false` ;
- confirmation qu’aucun binaire n’a été publié sur GitHub ;
- limites résiduelles éventuelles ;
- verdict explicite.

Publier le rapport sur `origin/main`, vérifier le SHA distant et l’état propre/synchronisé.

**S’arrêter après 054. Ne tenter aucun accès, transfert ni installation sur Zenith Ice.**
