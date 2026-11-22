# Mission 053a — Icône transparente et diagnostic final de la barre des tâches

**Date :** 22 novembre 2026  
**Contexte :** la mission 053 a intégré l’identité visuelle Textothèque 0.1.29 avec succès sur l’EXE, le Setup, le raccourci Démarrer, la fenêtre et Applications installées. Deux points restent à traiter :
1. l’ICO validé en 053 contenait un fond noir alors qu’une transparence est préférable pour Windows ;
2. le bouton de barre des tâches affichait encore l’atome Electron sur CODEX_VM.

**Nature :** correction graphique ciblée + diagnostic Windows final.  
**Aucun transfert vers Zenith Ice.**

## Source fournie par David

David a lui-même ajouté et poussé :

`missions/053a-ico-transparent/textotheque-0.1.29-transparent.ico`

Ce fichier devient la nouvelle source ICO validée pour Textothèque 0.1.29.

**Ne pas le régénérer, redessiner ou recolorer.**

Le PNG haute définition déjà canonique dans :

`assets/branding/textotheque-icon.png`

reste la référence visuelle/mémoire du concept. Cette mission ne demande pas de remplacer ce PNG.

## 1 — Remplacement de l’ICO canonique

Remplacer :

`assets/branding/textotheque.ico`

par le fichier transparent fourni dans `missions/053a-ico-transparent/`.

Conserver le même chemin canonique afin que toute la configuration 053 continue à fonctionner sans duplication.

Après intégration, le dossier temporaire `missions/053a-ico-transparent` peut être supprimé si son contenu est désormais présent à l’identique dans `assets/branding/`.

Vérifier :
- présence des tailles ICO attendues ;
- transparence réelle de la couche alpha ;
- absence de fond noir opaque ajouté lors du packaging ;
- SHA-256 de la source canonique.

## 2 — Rebuild complet obligatoire

L’ICO étant embarqué dans les PE et le package Squirrel, un simple remplacement de fichier ne suffit pas pour les artefacts déjà produits.

Refaire :

```powershell
npm.cmd run release:win
```

Puis contrôler à nouveau :

- EXE packagé ;
- Setup ;
- EXE installé versionné ;
- lanceur Squirrel si pertinent ;
- raccourci ;
- Applications installées ;
- fenêtre ;
- barre des tâches.

Le script `scripts/check-windows-icon.py` de 053 doit être réutilisé/adapté, pas remplacé par une seconde mécanique parallèle.

## 3 — Diagnostic spécifique de la barre des tâches

053 a déjà fait correctement :

- `packagerConfig.icon` ;
- `setupIcon` ;
- ressource runtime `resources/textotheque.ico` ;
- `BrowserWindow({ icon })` ;
- `app.setAppUserModelId('com.squirrel.Textotheque.Textotheque')` ;
- `BrowserWindow.setAppDetails({ appId, appIconPath })`.

Ne pas empiler des contournements au hasard.

Avant de modifier davantage le code, déterminer si l’atome Electron vient :

- d’un cache de shell / taskbar ;
- d’un ancien raccourci épinglé ;
- du groupement AppUserModelID ;
- de la façon dont Squirrel crée/recrée le raccourci ;
- d’une propriété de relaunch command / app details ;
- d’une différence entre raccourci Démarrer et bouton de fenêtre ;
- d’un autre mécanisme Windows démontrable.

Documenter les observations.

## 4 — Autorisation explicite d’essai destructif limité

Contrairement à 053, David autorise explicitement, **uniquement sur CODEX_VM et uniquement sur l’installation/profil fictifs issus de 052–053**, un cycle contrôlé de :

- désinstallation de la STABLE fictive ;
- réinstallation de la candidate 0.1.29 ;
- recréation du raccourci ;
- fermeture / relance ;
- contrôle de la barre des tâches.

Cette autorisation ne s’étend à rien de personnel.

### Garde-fou obligatoire avant toute désinstallation

Avant l’opération, prouver à nouveau :

- machine = CODEX_VM ;
- profil STABLE contient le marqueur fictif de qualification 052 ;
- aucune bibliothèque personnelle réelle n’est utilisée ;
- Textothèque est fermée ;
- snapshot/copie de la fixture fictive si nécessaire.

Si un de ces points n’est pas démontrable : **ne pas désinstaller** et publier PARTIEL/BLOQUÉ.

## 5 — Cache Windows

Il est permis d’effectuer des actions non destructives raisonnables pour rafraîchir le shell sur CODEX_VM, par exemple :

- fermeture/reouverture de l’application ;
- recréation du raccourci via réinstallation ;
- notification de changement au shell ;
- redémarrage d’Explorer si cela reste borné et documenté ;
- déconnexion/reconnexion uniquement si cela est réellement utile et sans risque sur la VM.

Ne pas supprimer aveuglément des caches système ou profils utilisateur entiers.

Si une purge ciblée de cache d’icônes est envisagée, documenter précisément le fichier/commande et le risque avant exécution. Préférer d’abord la réinstallation propre autorisée.

## 6 — Critère de succès barre des tâches

GO si, après reconstruction et si nécessaire réinstallation propre sur la fixture fictive :

- le bouton de barre des tâches affiche l’icône Textothèque cuivre/transparente ;
- le titre/fenêtre reste correct ;
- l’AppUserModelID reste identique ;
- une seule application Textothèque est visible/installée ;
- aucun nouveau profil n’est créé.

PARTIEL acceptable si :

- toutes les autres surfaces utilisent correctement l’icône transparente ;
- la barre des tâches reste Electron malgré une investigation raisonnable et documentée ;
- aucune cause sûre ne justifie un hack ou un changement d’identité.

**Ne pas modifier l’AppUserModelID pour “faire marcher l’icône”** : ce serait une régression de compatibilité Squirrel beaucoup plus grave qu’un défaut cosmétique.

## 7 — Transparence : recette visuelle

Faire au minimum une vérification sur :

- fond clair Windows ;
- fond sombre Windows si facilement disponible ;
- raccourci / Explorer ;
- barre des tâches ;
- Setup ou EXE.

Le symbole doit apparaître sans carré noir ajouté autour.

## 8 — Compatibilité 052 / 053

Vérifier que restent inchangés :

- version 0.1.29 ;
- `productName` ;
- identité Squirrel ;
- `appUserModelId` ;
- chemins STABLE/DEV ;
- profil `%APPDATA%\Textotheque` ;
- nom des artefacts ;
- mécanisme de mise à jour qualifié en 052.

La base fictive ne doit subir aucune perte métier.

Si une désinstallation/reinstallation est effectuée, vérifier explicitement si Squirrel laisse ou supprime le profil `%APPDATA%\Textotheque`, et restaurer uniquement la fixture fictive si nécessaire pour poursuivre les contrôles. Ne rien extrapoler sans preuve vers ZI.

## 9 — Tests proportionnés

Au minimum :

- `npm.cmd run build`;
- `npm.cmd run release:win`;
- `npm.cmd run test:packaged-smoke`;
- `npm.cmd run test:installer-smoke`;
- `npm.cmd run test:app-identity`;
- `npm.cmd run test:runtime-profile`;
- `python scripts/check-windows-icon.py ...`;
- contrôle visuel Windows des surfaces pertinentes.

Pas de suite métier générale sauf impact observé.

## 10 — Documentation

Mettre à jour le rapport 053a et, seulement si une information durable change, `docs/DISTRIBUTION_WINDOWS.md`.

Ne pas effacer l’historique de 053 : son verdict PARTIEL reste une trace utile de la première intégration.

## 11 — Frontière stricte

**Aucun transfert vers Zenith Ice.**

Cette mission peut reconstruire et réinstaller Textothèque sur CODEX_VM fictive, mais :

- ne pas copier le Setup sur ZI ;
- ne pas intervenir sur la STABLE 0.1.28 réelle de ZI ;
- ne pas lancer 054.

## Rapport

Créer :

`reports/053a_Icone_transparente_et_diagnostic_barre_des_taches_report.md`

Le rapport doit préciser :

- SHA-256 du nouvel ICO transparent ;
- preuve de transparence ;
- artefacts reconstruits ;
- surfaces Windows vérifiées ;
- résultat barre des tâches ;
- éventuelle désinstallation/réinstallation exécutée et garde-fous ;
- cause identifiée ou hypothèses restantes ;
- impact nul ou non sur l’identité Squirrel ;
- tests exécutés / non exécutés ;
- verdict GO / PARTIEL / NO-GO / BLOQUÉ.

Publier code/assets/docs/rapport sur `origin/main`, vérifier SHA distant, `git diff --check`, état propre et synchronisé.

**S’arrêter après 053a. Ne rien transférer vers Zenith Ice.**
