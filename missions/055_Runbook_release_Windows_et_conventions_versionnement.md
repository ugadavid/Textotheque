# Mission 055 — Runbook de release Windows et conventions de versionnement

**Date :** 22 novembre 2026  
**Nature :** documentation opérationnelle uniquement.  
**Objectif :** capitaliser l’expérience réelle des missions 052 à 054 pour que les prochaines fabrications Windows de Textothèque deviennent routinières, sûres et compréhensibles par un Codex qui ne dispose pas du contexte conversationnel.

## Contexte

Textothèque vient de franchir un premier cycle complet de distribution Windows :

- **052** : qualification de la mise à jour Squirrel 0.1.28 → 0.1.29 sur CODEX_VM ;
- **053 / 053a** : intégration puis correction de l’identité visuelle Windows ;
- **054** : fabrication finale, vérification, staging et remise locale des fichiers destinés à David.

La 0.1.29 réelle a ensuite été installée manuellement sur Zenith Ice par David.

Nous voulons maintenant documenter durablement :

1. le vocabulaire de la chaîne de fabrication ;
2. les responsabilités de chaque étape ;
3. le workflow concret à rejouer pour les prochaines releases Windows ;
4. les règles de versionnement propres au projet ;
5. les contrôles réellement utiles ;
6. la séparation stricte entre CODEX_VM et Zenith Ice ;
7. les pièges déjà rencontrés, notamment l’icône Windows mise en cache par le shell.

Cette mission **ne fabrique aucune nouvelle release**.

---

# 1 — Livrables documentaires

Créer :

`docs/RELEASE_WINDOWS_RUNBOOK.md`

Mettre à jour de façon légère :

`AGENTS.md`

afin qu’un agent sache immédiatement qu’il doit lire ce runbook lorsqu’une mission concerne :

- une nouvelle version Windows ;
- un Setup ;
- Squirrel ;
- une fabrication `release:win` ;
- une préparation de livraison vers Zenith Ice ;
- un changement d’icône ou d’identité Windows susceptible d’affecter le packaging.

Ne pas dupliquer tout le runbook dans `AGENTS.md` : ajouter uniquement les règles invariantes et un lien clair.

Mettre à jour `docs/DISTRIBUTION_WINDOWS.md` uniquement si nécessaire pour éviter une contradiction ou ajouter un renvoi au nouveau runbook. Ce document reste la documentation de fond ; le nouveau runbook devient la procédure opérationnelle.

---

# 2 — Vocabulaire à fixer

Le runbook doit employer explicitement et expliquer ces termes.

## Build

Transformation des sources en sorties applicatives prêtes à être empaquetées.

Dans Textothèque, cela couvre notamment TypeScript, Vite et les sorties Electron.

## Packaging

Assemblage de l’application Electron complète avec son runtime, ses dépendances et ses ressources.

## Fabrication Windows / Make

Étape Electron Forge qui produit les artefacts Windows/Squirrel à partir du package.

## Installateur / Setup

Le fichier :

`Textotheque Setup.exe`

C’est le programme exécuté par David sur Zenith Ice pour installer ou mettre à jour Textothèque.

## Artefacts de build / de distribution

Fichiers produits par la chaîne de fabrication, par exemple :

- `Textotheque Setup.exe`
- `Textotheque-<version>-full.nupkg`
- `RELEASES`
- `manifest.json`

## Release

Version de Textothèque destinée à être distribuée/utilisée.

## Build de release / fabrication de la distribution Windows

Expression préférée pour désigner l’ensemble :

`build → packaging → make Squirrel → staging des artefacts`

## Rebuild

Nouvelle fabrication à partir d’un nouvel état du dépôt, éventuellement avec le même numéro de version tant que David n’a pas décidé d’un nouveau jalon.

## Candidate de release

Build que l’on teste ou qualifie. Ce n’est pas automatiquement le binaire final livré.

## Release qualifiée

Candidate dont les contrôles prévus ont réussi.

## Artefact final de livraison

Build gelé explicitement choisi pour être remis à David et transféré manuellement vers Zenith Ice.

Le runbook doit rappeler qu’un même numéro de version peut avoir plusieurs builds/candidates successifs avec des SHA-256 différents. **Le numéro de version seul n’identifie donc pas un Setup précis.**

---

# 3 — Convention de versionnement — décision produit explicite

Cette partie doit être écrite clairement dans le runbook **et résumée dans AGENTS.md**.

## Règle normale

Textothèque est actuellement dans la série :

`0.1.x`

La progression naturelle est :

`0.1.x → 0.1.(x+1)`

Exemple :

`0.1.29 → 0.1.30`

## Règle absolue

**Codex ne modifie jamais le numéro de version de sa propre initiative.**

Même l’incrément naturel `0.1.x → 0.1.(x+1)` doit être demandé explicitement par David ou par une mission qui relaie explicitement cette décision.

Une correction, un rebuild, une nouvelle candidate, un changement d’icône, une nouvelle fabrication du Setup ou un rapport **ne déclenchent pas automatiquement un bump**.

## Passage à 0.2.0

Le passage à :

`0.2.0`

est un **jalon majeur exceptionnel**, décidé explicitement par David.

Il ne doit jamais être déduit du nombre de missions, du temps passé, de l’ampleur technique perçue ou d’une convention SemVer générique.

Autrement dit :

> le jour où Textothèque passe à 0.2.0, c’est une décision produit consciente — pas un automatisme technique.

Ne pas inventer de politique future 0.3 / 1.0 au-delà de ce qui est décidé ici.

---

# 4 — Responsabilités et frontières machines

Le runbook doit distinguer clairement les rôles.

## CODEX_VM / Codex

Codex peut :

- modifier le dépôt selon la mission ;
- construire et tester Textothèque ;
- produire les artefacts Windows ;
- installer/désinstaller une STABLE **fictive** sur CODEX_VM lorsque la mission l’autorise ;
- calculer les hashes ;
- préparer un dossier local de livraison ;
- publier code/docs/rapports sur GitHub dans le périmètre autorisé.

Codex ne doit pas :

- supposer un accès à Zenith Ice ;
- tenter un transfert réseau vers Zenith Ice ;
- installer une release sur Zenith Ice ;
- manipuler la vraie bibliothèque personnelle de David ;
- publier les binaires sur GitHub sans demande explicite.

## Zenith Ice / David + ChatGPT

La vraie installation STABLE de David vit sur Zenith Ice.

Le transfert CODEX_VM → Zenith Ice est effectué **manuellement par David**.

Sur Zenith Ice, David réalise notamment :

- récupération des fichiers ;
- vérification du SHA-256 ;
- sauvegarde de la vraie bibliothèque ;
- fermeture de Textothèque ;
- exécution du Setup ;
- recette humaine finale.

Le runbook doit éviter toute phrase laissant croire que Codex « livre sur ZI ».

---

# 5 — Chaîne canonique actuelle

Documenter la commande actuelle :

```powershell
npm.cmd run release:win
```

et expliquer qu’elle enchaîne aujourd’hui :

1. build TypeScript / Vite / Electron ;
2. packaging Electron ;
3. fabrication Squirrel Windows via Electron Forge ;
4. staging dans :
   `dist-release\Textotheque-<version>\`
5. création de `manifest.json`.

Le runbook doit citer `scripts/stage-windows-release.cjs` comme mécanisme courant de staging, sans recopier son code.

Le manifeste doit être contrôlé notamment pour :

- version ;
- commit ;
- `dirty: false` ;
- tailles ;
- SHA-256.

Une nouvelle fabrication peut légitimement produire un SHA-256 différent. Le hash de référence est toujours celui de **l’artefact effectivement qualifié/livré**.

---

# 6 — Préconditions avant une fabrication de release

Inclure une checklist courte et opérationnelle.

Au minimum :

- synchroniser avec `origin/main` selon la mission ;
- connaître le SHA source exact ;
- vérifier `git status --short` ;
- vérifier `git diff --check` ;
- vérifier que le numéro de version demandé est cohérent dans `package.json` et `package-lock.json` ;
- vérifier que le numéro n’a pas été modifié sans décision explicite de David ;
- lire les rapports récents liés au packaging si la chaîne a changé ;
- vérifier les ressources d’identité Windows si elles ont été modifiées.

Si l’environnement Node est neuf, rappeler la procédure déjà documentée dans `DISTRIBUTION_WINDOWS.md` pour installer les dépendances natives ciblées Electron. Ne pas dupliquer inutilement tout le bloc si un renvoi suffit.

---

# 7 — Niveaux de fabrication à distinguer

Le runbook doit éviter de traiter toutes les fabrications comme une « release finale ».

Décrire trois situations pratiques.

## A — Build / candidate de développement

But : vérifier une évolution.

Peut conserver le même numéro de version tant que David n’a pas décidé du prochain jalon.

Pas de dossier de livraison nécessaire.

Tests proportionnés au changement.

## B — Candidate de release / qualification

But : qualifier packaging, installation, migration ou comportement Windows.

Peut impliquer :

- Setup réel sur CODEX_VM ;
- profil fictif ;
- inventaire Windows ;
- contrôles Squirrel ;
- comparaison avant/après.

Toujours distinguer les données fictives des données personnelles.

## C — Artefact final de livraison

But : fabriquer depuis un état gelé et propre le Setup réellement remis à David.

Doit :

- repartir d’un SHA explicite ;
- produire un manifeste `dirty: false` ;
- recalculer le SHA après copie dans le dossier de remise ;
- éviter toute confusion avec les candidates précédentes.

---

# 8 — Contrôles proportionnés

Le runbook doit expliquer que la sélection dépend du changement.

Ne pas instaurer une campagne exhaustive obligatoire pour chaque rebuild.

Pour une **fabrication finale Windows**, les contrôles utilisés avec succès en 054 constituent une bonne base actuelle :

- `npm.cmd run test:packaged-smoke`
- `npm.cmd run test:installer-smoke`
- `npm.cmd run test:app-identity`
- `npm.cmd run test:runtime-profile`
- contrôle de l’icône Windows si l’identité visuelle est concernée :
  `python scripts/check-windows-icon.py ...`

Compléter par les contrôles statiques du manifeste et du contenu du package.

Ne pas rejouer automatiquement toutes les suites métier si le code concerné n’a pas changé et qu’une qualification antérieure reste applicable.

Inversement, si une mission modifie :

- le schéma ;
- le moteur de migration ;
- le profil ;
- l’identité Squirrel ;
- les chemins d’installation ;
- le packaging ;
- les dépendances natives ;

alors la qualification doit être élargie de façon adaptée.

Le runbook doit renvoyer à la philosophie « baby steps / tests ciblés » d’`AGENTS.md`.

---

# 9 — Identité Windows à préserver

Documenter les invariants actuels :

- produit/package : `Textotheque`
- exécutable : `Textotheque.exe`
- Setup : `Textotheque Setup.exe`
- AppUserModelID : `com.squirrel.Textotheque.Textotheque`
- profil STABLE : `%APPDATA%\Textotheque`
- profil DEV : `%APPDATA%\Textotheque-Dev`
- renderer STABLE : local `file://`
- icône Windows canonique : `assets/branding/textotheque.ico`

Ne jamais modifier ces identités lors d’une release ordinaire sans mission explicite dédiée.

Si l’ICO canonique change :

- mettre à jour la référence Squirrel/Forge correspondante ;
- refaire la fabrication complète ;
- vérifier les ressources PE ;
- ne pas supposer qu’un simple remplacement de fichier modifie un Setup déjà produit.

---

# 10 — Piège Windows déjà rencontré : cache d’icône / shell

Capitaliser le résultat de 053a.

Symptôme observé :

- EXE correct ;
- Setup correct ;
- raccourci correct ;
- Applications installées correct ;
- fenêtre correcte ;
- mais ancienne icône Electron encore visible dans la barre des tâches.

Diagnostic confirmé sur CODEX_VM :

- l’identité et les ressources étaient déjà correctes ;
- une réinstallation propre n’a pas suffi immédiatement ;
- après redémarrage ciblé d’Explorer, la bonne icône a été affichée ;
- aucune modification de l’AppUserModelID n’était nécessaire.

Règle opérationnelle :

> avant de modifier l’identité, Squirrel ou le code pour un problème d’icône isolé dans la barre des tâches, vérifier d’abord l’hypothèse d’un état/cache du shell Windows et rafraîchir/redémarrer Explorer de manière ciblée.

Ne pas documenter une purge agressive des caches Windows comme geste par défaut.

---

# 11 — Petite fenêtre verte lors du Setup

Le runbook peut mentionner comme **comportement visuel actuellement observé** qu’une petite fenêtre/animation verte Squirrel peut apparaître brièvement pendant l’installation.

Ne pas la qualifier de bug de Textothèque sans preuve.

Ne pas engager dans 055 de modification de `loadingGif` ou de personnalisation de l’installateur.

Noter seulement que l’habillage de cette animation pourra faire l’objet d’une mission distincte ultérieure si David le souhaite.

---

# 12 — Dossier de remise à David

Documenter le modèle établi en 054.

Emplacement recommandé :

`C:\Users\codex\Documents\Livraisons\Textotheque-<version>-ZI\`

Contenu minimal utile :

- `Textotheque Setup.exe`
- `manifest.json`
- `SHA256SUMS.txt`
- `README_TRANSFERT_ZI.txt`

Le NUPKG et `RELEASES` peuvent rester dans `dist-release` sauf besoin explicite.

Le README de transfert doit rappeler :

- version ;
- commit source ;
- SHA-256 du Setup ;
- taille ;
- sauvegarde préalable ;
- fermeture de Textothèque ;
- installation par-dessus la STABLE existante ;
- vérifications humaines après installation ;
- éventuel rafraîchissement d’Explorer si seule l’icône de barre des tâches paraît ancienne.

Le dossier `Livraisons` et les binaires ne sont pas destinés à Git.

---

# 13 — Sauvegarde et mise à jour réelle sur Zenith Ice

Le runbook doit résumer, sans réinventer `DISTRIBUTION_WINDOWS.md`, la séquence humaine :

1. récupérer les fichiers depuis CODEX_VM ;
2. vérifier le SHA-256 du Setup ;
3. dans la STABLE existante, sauvegarder la vraie bibliothèque ;
4. fermer Textothèque ;
5. exécuter le Setup sous le même compte Windows ;
6. relancer depuis le raccourci habituel ;
7. contrôler version, bibliothèque active, documents/dossiers, TODO et préférences ;
8. conserver sauvegardes et ancien artefact tant que la recette n’est pas validée.

Pour le détail et les procédures d’échec/récupération, renvoyer à `docs/DISTRIBUTION_WINDOWS.md`.

---

# 14 — Ce que le runbook ne doit pas devenir

Éviter :

- une duplication complète de `DISTRIBUTION_WINDOWS.md` ;
- un historique exhaustif des missions 052–054 ;
- une théorie générale de SemVer ;
- une infrastructure sophistiquée de release ;
- un script automatique de bump de version ;
- une publication automatique GitHub Release ;
- un auto-update ;
- un transfert automatisé vers Zenith Ice ;
- une obligation de rejouer toutes les suites de tests pour chaque rebuild.

Le document doit rester **court, actionnable et maintenable**.

Un agent doit pouvoir l’utiliser comme checklist et comprendre les décisions derrière les étapes sans relire toute l’histoire du projet.

---

# 15 — Mise à jour d’AGENTS.md

Ajouter une section courte, à l’endroit pertinent, indiquant au minimum :

1. toute mission de release/distribution Windows doit lire `docs/RELEASE_WINDOWS_RUNBOOK.md` et `docs/DISTRIBUTION_WINDOWS.md` ;
2. Codex ne change jamais le numéro de version sans décision explicite de David relayée par la mission ;
3. progression normale actuelle : `0.1.x → 0.1.(x+1)` ;
4. `0.2.0` est un jalon produit exceptionnel qui ne doit jamais être choisi automatiquement ;
5. Codex prépare les artefacts sur CODEX_VM ; David assure le transfert et l’installation réelle sur Zenith Ice ;
6. les binaires de livraison restent hors Git sauf demande explicite.

Ne pas bouleverser les autres sections d’AGENTS.md.

---

# 16 — Sources à consulter avant rédaction

Relire impérativement :

- `AGENTS.md`
- `docs/DISTRIBUTION_WINDOWS.md`
- `reports/052_Qualification_mise_a_jour_STABLE_0.1.28_vers_0.1.29_report.md`
- `reports/053a_Icone_transparente_et_diagnostic_barre_des_taches_report.md`
- `reports/054_Preparation_livraison_finale_0.1.29_pour_transfert_manuel_ZI_report.md`
- `package.json`
- `forge.config.cjs`
- `scripts/stage-windows-release.cjs`

Vérifier le code/configuration réelle avant de transformer une observation historique en règle actuelle.

---

# 17 — Tests / vérifications de la mission 055

Mission documentaire : pas de build Windows ni de Setup à produire.

Faire au minimum :

- relire les liens et chemins cités ;
- vérifier que les commandes documentées existent encore ;
- vérifier que le runbook ne contredit pas `AGENTS.md` ni `DISTRIBUTION_WINDOWS.md` ;
- `git diff --check` ;
- inspection du diff documentaire final.

Ne pas lancer les suites Electron/SQLite sans nécessité : aucun comportement produit n’est modifié.

---

# 18 — Rapport

Créer :

`reports/055_Runbook_release_Windows_et_conventions_versionnement_report.md`

Le rapport doit préciser :

- documents lus ;
- fichiers créés/modifiés ;
- structure retenue pour le runbook ;
- règles de versionnement inscrites ;
- frontière CODEX_VM / Zenith Ice inscrite ;
- contradictions éventuelles corrigées ;
- vérifications effectuées ;
- limites éventuelles ;
- verdict GO / PARTIEL / NO-GO.

Publier documentation et rapport sur `origin/main`.

Vérifier :

- SHA distant ;
- `git diff --check` ;
- worktree propre et synchronisé.

**S’arrêter après 055. Ne lancer aucune fabrication 0.1.30 et ne commencer aucune des prochaines évolutions produit.**
