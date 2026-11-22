# Mission 059 — Release Windows 0.1.30 et titre de fenêtre versionné

**Date :** 22 novembre 2026
**Nature :** petite évolution d’identité visible + release Windows finale.
**Décision explicite de David :** passage **0.1.29 → 0.1.30**.
**Schéma SQLite :** reste **5**.
**Niveau runbook :** **C — artefact final de livraison**.

## 1 — Références obligatoires

Avant intervention, lire au minimum :
- `AGENTS.md` ;
- `docs/RELEASE_WINDOWS_RUNBOOK.md` ;
- `docs/DISTRIBUTION_WINDOWS.md` ;
- rapports 052, 054, 055 et les rapports récents 056–058 utiles à la release.

Appliquer le runbook existant ; ne pas inventer un nouveau processus de distribution.

# 2 — Version 0.1.30

David autorise explicitement ce bump.

Mettre à jour de façon cohérente :
- `package.json` → `0.1.30` ;
- `package-lock.json` → version racine et `packages[""]` à `0.1.30`.

Ne pas toucher à `CURRENT_SCHEMA_VERSION` : SQLite reste en schéma 5.

Ne pas modifier les identités historiques de distribution :
- `productName: Textotheque` ;
- EXE `Textotheque.exe` ;
- Setup `Textotheque Setup.exe` ;
- package Squirrel `Textotheque` ;
- AppUserModelID `com.squirrel.Textotheque.Textotheque` ;
- profil STABLE `%APPDATA%\Textotheque` ;
- profil DEV `%APPDATA%\Textotheque-Dev` ;
- installation `%LOCALAPPDATA%\Textotheque`.

# 3 — Titre visible de la fenêtre

David veut voir dans la barre de titre Windows :

**STABLE :** `Textothèque · 0.1.30`

et pour DEV, conserver la distinction explicite :

**DEV :** `Textothèque DEV · 0.1.30`

Le caractère séparateur peut être `·` comme ci-dessus.

## Important — séparer identité technique et présentation

Ne pas remplacer les identités Squirrel / package / profil par `Textothèque` accentué.

`app.setName(...)`, les profils, le maker Squirrel, l’EXE et l’AppUserModelID doivent rester compatibles avec l’identité historique qualifiée.

Le **titre de BrowserWindow** est une présentation indépendante.

# 4 — Empêcher le renderer d’écraser le titre

`index.html` possède actuellement `<title>Textotheque</title>`. Electron peut donc recevoir un `page-title-updated` après chargement du renderer.

Le titre visible final doit rester autoritairement :
- `Textothèque · 0.1.30` en STABLE ;
- `Textothèque DEV · 0.1.30` en DEV.

Choisir une implémentation simple et robuste, par exemple :
- construire le titre dans le main process à partir de `app.getVersion()` ;
- l’utiliser à la création de `BrowserWindow` ;
- empêcher/réappliquer proprement tout `page-title-updated` du renderer si nécessaire.

Il est également acceptable de corriger le `<title>` HTML vers `Textothèque` pour cohérence, mais **la version ne doit pas être dupliquée manuellement dans plusieurs fichiers**.

Pas de version hardcodée `0.1.30` dans le code de titre : utiliser la version du package via Electron.

# 5 — Icône

Conserver l’icône actuelle validée 053a.

Aucun changement de fichier ICO, `iconUrl`, AppUserModelID ou configuration Forge n’est demandé.

La barre de titre doit naturellement montrer l’icône existante puis le texte versionné.

# 6 — Vérifications fonctionnelles ciblées avant fabrication

Avant la fabrication finale :
- `npm.cmd run build` ;
- test d’identité/runtime pertinent ;
- vérifier en DEV le titre exact accentué et versionné ;
- vérifier que le titre reste exact après chargement complet du renderer et navigation interne ;
- vérifier que la barre de statut générale affiche bien 0.1.30 ;
- contrôles ciblés récents utiles à 058 si nécessaire, sans rejouer arbitrairement toutes les suites.

Le bump de version et le titre ne doivent pas casser autosave, menus, TODO, recherche, palette, Info, Corbeille ni sélection.

# 7 — Geler la source avant la release

Ordre attendu :

1. implémenter version + titre ;
2. lancer les tests ciblés ;
3. publier le code source sur `origin/main` ;
4. relever le commit source ;
5. vérifier `git status --short` vide et `git diff --check` ;
6. **fabriquer la release depuis ce commit propre et gelé**.

Le `manifest.json` de staging doit donc référencer ce commit source propre avec `dirty: false`.

Si le rapport final est publié ensuite dans un commit distinct, le rapport doit distinguer clairement :
- **commit source de la release** ;
- **commit rapport/documentation post-fabrication**.

# 8 — Fabrication Windows

Depuis CODEX_VM, lancer selon le runbook :

`npm.cmd run release:win`

Attendu dans le staging :

`dist-release\Textotheque-0.1.30\`

avec au minimum :
- `Textotheque Setup.exe` ;
- `Textotheque-0.1.30-full.nupkg` ;
- `RELEASES` ;
- `manifest.json`.

Vérifier version, commit, `dirty: false`, tailles et SHA-256.

# 9 — Qualification du binaire final

Appliquer la qualification proportionnée de niveau C du runbook.

Exécuter au minimum :
- `npm.cmd run test:packaged-smoke` ;
- `npm.cmd run test:app-identity` ;
- `npm.cmd run test:runtime-profile` ;
- `npm.cmd run test:installer-smoke` si son prérequis STABLE fictif est disponible et identifié.

Vérifier dans le package final :
- version 0.1.30 ;
- schéma 5 ;
- renderer local `file://` ;
- profil STABLE historique ;
- titre `Textothèque · 0.1.30` ;
- icône actuelle ;
- absence de bases/profils/captures privées embarqués.

Si une STABLE fictive 0.1.29 de provenance connue est disponible sur CODEX_VM, il est souhaitable de qualifier la mise à jour vers 0.1.30 conformément au runbook, avec conservation des données/préférences.

Si cette fixture n’est pas disponible ou si sa provenance n’est pas certaine, **ne pas improviser de mutation** : documenter la limite.

# 10 — Dossier final de remise à David

Créer :

`C:\Users\codex\Documents\Livraisons\Textotheque-0.1.30-ZI\`

avec exactement le modèle de 054 :
- `Textotheque Setup.exe` ;
- `manifest.json` ;
- `SHA256SUMS.txt` ;
- `README_TRANSFERT_ZI.txt`.

Le README doit indiquer :
- version 0.1.30 ;
- commit source exact ;
- taille du Setup ;
- SHA-256 du Setup ;
- rappel sauvegarde / fermeture de la STABLE réelle avant installation ;
- installation manuelle sur Zenith Ice par David ;
- vérifications post-install : version, titre `Textothèque · 0.1.30`, bibliothèque active, quelques documents/dossiers, TODO, Info, palette de caractères et préférences.

Recalculer le hash **depuis le dossier de remise** et comparer avec le staging/manifeste.

Les binaires restent **hors GitHub**.

# 11 — Frontière CODEX_VM / Zenith Ice

Codex travaille uniquement sur CODEX_VM.

Il ne transfère rien vers Zenith Ice et n’y installe rien.

David réalisera manuellement :
- transfert ;
- vérification SHA-256 ;
- sauvegarde de la vraie bibliothèque ;
- fermeture de la STABLE ;
- installation du Setup ;
- recette réelle.

# 12 — Rapport

Créer :

`reports/059_Release_Windows_0.1.30_et_titre_fenetre_versionne_report.md`

Le rapport doit donner :
- commit source de release ;
- éventuel commit final du rapport ;
- version 0.1.30 ;
- titre DEV et STABLE vérifiés ;
- confirmation que les identités techniques historiques sont inchangées ;
- commandes de tests et résultats ;
- chemin du staging ;
- chemin du dossier de remise ;
- taille et SHA-256 du Setup final ;
- contenu exact du dossier de remise ;
- limites éventuelles de qualification ;
- verdict GO-LIVRAISON / PARTIEL / NO-GO.

Publier sources et rapport sur `origin/main`, vérifier le SHA distant et le worktree final propre.

**S’arrêter après 059. Ne lancer aucune mission suivante.**