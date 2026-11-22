# Mission 052 — Qualification de mise à jour STABLE 0.1.28 → 0.1.29

**Date :** 22 novembre 2026  
**Décision :** avant toute livraison vers Zenith Ice, qualifier sur CODEX_VM une vraie mise à jour Squirrel de Textothèque **0.1.28 vers 0.1.29**, en vérifiant que l’application installée est remplacée proprement et que le profil utilisateur reste intact.  
**Nature :** mission de distribution / qualification. **Aucun artefact de cette mission n’est destiné à Zenith Ice.**

## Contexte sensible

Zenith Ice possède déjà une Textothèque STABLE 0.1.28 installée sous l’identité Squirrel actuelle.

Le but futur n’est pas d’installer une seconde application, mais de mettre à niveau **l’unique Textothèque existante**.

Architecture actuelle :

- programme installé sous `%LOCALAPPDATA%\Textotheque`;
- profil STABLE sous `%APPDATA%\Textotheque`;
- bibliothèque par défaut sous `%APPDATA%\Textotheque\textotheque.sqlite`;
- registre des bibliothèques : `%APPDATA%\Textotheque\library-history.json`;
- préférences Chromium / Local Storage également dans le profil STABLE ;
- identité Squirrel : `Textotheque`;
- exécutable : `Textotheque.exe`;
- version actuellement déclarée : `0.1.28`.

**Cette mission doit prouver le scénario avant toute utilisation sur ZI.**

## Interdiction absolue

- Ne jamais toucher à Zenith Ice.
- Ne jamais transférer d’installateur vers Zenith Ice.
- Ne jamais considérer un Setup généré par 052 comme « livrable final ».
- Ne jamais utiliser une bibliothèque personnelle réelle pour la qualification.
- Ne jamais supprimer ou écraser un profil STABLE existant sur CODEX_VM sans l’avoir qualifié explicitement comme jetable.

Si CODEX_VM contient déjà un profil ou une installation STABLE dont l’origine n’est pas clairement fictive, **arrêter la partie destructive et publier un verdict BLOQUÉ avec inventaire**. Ne pas “nettoyer pour faire passer le test”.

## Objectifs

Qualifier les points suivants :

1. une installation réelle **0.1.28** existe ;
2. elle fonctionne avec un profil STABLE fictif complet ;
3. une candidate **0.1.29** issue de `main` est construite ;
4. son `Textotheque Setup.exe` est lancé **par-dessus** la 0.1.28 ;
5. Windows/Squirrel conserve une seule identité Textothèque ;
6. l’exécutable actif passe bien en 0.1.29 ;
7. le profil STABLE utilisateur est conservé ;
8. les données et préférences attendues survivent ;
9. la procédure est reproductible et documentée.

## 1 — Inventaire préalable obligatoire

Avant toute modification :

- `git status --short`;
- SHA courant de `origin/main`;
- version du dépôt ;
- inventaire de `%LOCALAPPDATA%\Textotheque` s’il existe ;
- inventaire de `%APPDATA%\Textotheque` s’il existe ;
- raccourci(s) Textothèque dans le menu Démarrer ;
- processus Textothèque en cours.

Classer chaque élément en :

- absent ;
- clairement fictif / issu de tests automatisés ;
- potentiellement personnel / indéterminé.

Si un élément est potentiellement personnel ou indéterminé : **ne pas l’écraser**.

## 2 — Baseline 0.1.28

Construire ou retrouver de manière vérifiable une vraie distribution Textothèque **0.1.28** correspondant à l’identité Squirrel actuelle.

Préférence :

- utiliser le commit/tag exact correspondant à 0.1.28 si le dépôt permet de le reconstruire proprement ;
- sinon documenter précisément la source utilisée.

Ne pas modifier l’historique Git.

Installer la 0.1.28 dans l’environnement de qualification.

Après installation, vérifier au minimum :

- version 0.1.28 ;
- `app.isPackaged === true`;
- renderer `file://`;
- raccourci unique ;
- chemin d’installation Squirrel attendu ;
- pas de dépendance Vite/5173.

## 3 — Profil STABLE fictif mais réaliste

Créer uniquement des données fictives et les faire vivre dans le profil STABLE de qualification.

Le profil doit contenir assez de matière pour vérifier la survie réelle :

### SQLite

Créer une bibliothèque avec notamment :

- plusieurs dossiers et sous-dossiers ;
- plusieurs documents avec contenus distinctifs ;
- au moins un document non classé ;
- TODO ;
- favoris / statuts ;
- au moins une recherche enregistrée si supportée par 0.1.28 ;
- corbeille non vide si raisonnable.

Capturer avant mise à jour :

- SHA-256 du fichier SQLite fermé proprement ;
- taille ;
- `application_id`;
- `user_version`;
- nombre de documents ;
- nombre de dossiers ;
- identifiants / contenus sentinelles ;
- TODO ;
- recherches enregistrées.

### Registre des bibliothèques

Créer ou vérifier un `library-history.json` fictif avec au moins deux entrées de bibliothèques connues si possible.

Capturer son contenu ou son SHA-256.

### Préférences / Local Storage

Avec la version 0.1.28, préparer ce qui existe réellement à cette version, sans inventer des clés futures.

Pour la candidate 0.1.29, après première ouverture avant upgrade final si nécessaire, vérifier ensuite notamment les préférences introduites depuis :

- thème ;
- ordre de l’explorateur ;
- dossiers développés ;
- layout des panneaux ;
- positions d’édition.

L’objectif est de prouver que le **profil Chromium** n’est pas remplacé par la mise à jour.

## 4 — Candidate 0.1.29

Si la qualification peut se poursuivre sans risque :

- passer la version applicative de `0.1.28` à **`0.1.29`** dans la source canonique ;
- conserver l’identité Squirrel exactement identique ;
- ne pas changer `productName`, `name`, `exe`, `setupExe`, `appUserModelId` ni les chemins de profil ;
- conserver le schéma SQLite courant si aucune évolution métier ne l’exige ;
- ne pas modifier les dépendances sauf nécessité démontrée.

Mettre à jour les tests/scripts qui codent encore explicitement `0.1.28` lorsque cela est nécessaire et justifié.

## 5 — Construction reproductible

Créer une commande simple et documentée pour produire la distribution Windows depuis un dépôt validé.

Le flux cible doit rester proche de :

```powershell
npm.cmd run make:win
```

mais fournir au mainteneur une sortie de livraison facile à identifier et à copier.

Créer si utile un script léger du type :

```text
scripts/build-windows-release.*
```

ou une commande npm dédiée, qui :

1. vérifie la version ;
2. nettoie uniquement les anciens artefacts de build `out/` si nécessaire ;
3. compile ;
4. fabrique Squirrel ;
5. identifie le Setup produit ;
6. copie les artefacts utiles vers un dossier clairement nommé, par exemple :
   `dist-release\Textotheque-0.1.29\`
7. calcule un SHA-256 ;
8. produit un petit manifeste texte/JSON/Markdown avec version, date, commit SHA, nom du fichier et hash.

**Ne jamais inclure de données utilisateur dans ce dossier de livraison.**

Le nom exact du dossier est libre si plus cohérent avec le dépôt.

## 6 — Test réel de mise à jour 0.1.28 → 0.1.29

Avec Textothèque 0.1.28 installée et le profil fictif préparé :

1. fermer proprement Textothèque ;
2. capturer l’état avant mise à jour ;
3. lancer le Setup 0.1.29 ;
4. attendre la fin du mécanisme Squirrel ;
5. relancer Textothèque depuis son raccourci / entrée normale ;
6. vérifier version 0.1.29.

### Unicité de l’application

Vérifier après mise à jour :

- une seule entrée/raccourci Textothèque exploitable ;
- une seule identité Squirrel ;
- pas de nouvelle application « Textotheque 0.1.29 » parallèle ;
- pas de second profil utilisateur ;
- l’exécutable de lancement pointe vers la version active.

**Important :** Squirrel peut conserver plusieurs dossiers internes `app-0.1.xx` ou packages historiques. Cela ne constitue pas à lui seul une double installation. Distinguer clairement :

- historique technique Squirrel ;
- application visible/utilisable.

Documenter ce qui reste réellement dans `%LOCALAPPDATA%\Textotheque`.

## 7 — Préservation du profil utilisateur

Après la mise à jour, vérifier :

### Bibliothèque SQLite

- fichier toujours présent ;
- identité TEXO ;
- schéma attendu ;
- documents sentinelles présents ;
- arborescence préservée ;
- TODO préservé ;
- recherches enregistrées préservées ;
- corbeille / favoris / statuts préservés.

Ne pas exiger un SHA identique si l’application effectue légitimement des écritures de démarrage comme `last_opened_at`. Dans ce cas, comparer le contenu métier et expliquer les différences.

### Registre

- `library-history.json` préservé ;
- bibliothèques connues encore proposées ;
- dernière bibliothèque cohérente.

### Préférences

Vérifier que le profil Chromium existant n’a pas été remplacé.

Pour les préférences présentes dans la candidate :

- thème ;
- ordre explorateur ;
- layout ;
- dossiers développés ;
- positions d’édition.

Si certaines n’existaient pas en 0.1.28, les initialiser dans la 0.1.29, fermer, relancer et vérifier leur persistance **dans le même profil**. Ne pas prétendre qu’elles ont « survécu depuis 0.1.28 » si elles n’existaient pas alors.

## 8 — Retour arrière / échec

La mission ne doit pas inventer un downgrade automatique.

Documenter :

- que faire si le Setup 0.1.29 échoue avant activation ;
- où se trouvent les données ;
- comment préserver/restaurer la bibliothèque ;
- ce que Squirrel permet ou non concernant un retour vers 0.1.28 ;
- la différence entre restaurer les fichiers applicatifs et restaurer les données.

Ne jamais tester un scénario destructif sur des données non jetables.

## 9 — Procédure future pour Zenith Ice

Mettre à jour `docs/DISTRIBUTION_WINDOWS.md` avec une section **Mise à jour d’une STABLE existante**.

Cette section doit rester une procédure, **pas une autorisation d’exécuter sur ZI**.

Elle doit prévoir au minimum :

1. Textothèque fermée ;
2. sauvegarde explicite de la bibliothèque avant mise à jour ;
3. conserver une copie du Setup actuellement installé si disponible ;
4. vérifier version/hash du nouveau Setup ;
5. exécuter le nouveau Setup ;
6. lancer Textothèque ;
7. vérifier version ;
8. ouvrir la bibliothèque habituelle ;
9. contrôler quelques documents, dossiers, TODO et préférences ;
10. ne supprimer les artefacts précédents qu’après validation.

### Important

La sauvegarde avant mise à jour doit être décrite comme un **filet de sécurité utilisateur**, même si l’architecture sépare déjà application et données.

## 10 — Tests attendus

Cette mission est une vraie mission de distribution : niveau de contrôle proche d’un **L3**.

Exécuter au minimum les contrôles pertinents suivants, en corrigeant uniquement les attentes de version devenues obsolètes :

- `npm.cmd run build`;
- `npm.cmd run test:electron-sqlite`;
- `npm.cmd run test:app-identity`;
- `npm.cmd run test:runtime-profile`;
- `npm.cmd run test:packaged-smoke`;
- `npm.cmd run test:installer-smoke`;
- test réel de mise à jour 0.1.28 → 0.1.29 ajouté par 052 ;
- contrôles fonctionnels ciblés des nouveautés 049–051 dans la candidate packagée si raisonnable.

Pour les autres suites, utiliser le jugement proportionné mais **documenter explicitement celles non rejouées**.

## 11 — Artefacts de 052

Les artefacts générés restent locaux à CODEX_VM.

Ils peuvent servir à la qualification, mais **ne sont pas la livraison ZI**.

Ne pas :

- les publier dans GitHub si binaires volumineux ;
- les transférer ailleurs ;
- les présenter comme release officielle.

Le dépôt doit seulement contenir :

- code/scripts nécessaires ;
- documentation ;
- tests ;
- rapports ;
- éventuellement manifestes textuels d’exemple ne contenant aucune donnée privée.

## 12 — Verdict

Le rapport doit donner l’un de ces verdicts :

- **GO-QUALIF** : la chaîne 0.1.28 → 0.1.29 est prouvée sur CODEX_VM et une future mission de livraison ZI peut être préparée ;
- **PARTIEL** : build valide mais certains invariants de mise à jour n’ont pas été prouvés ;
- **NO-GO** : la mise à jour risque de créer une seconde application, de casser l’identité ou de toucher au profil ;
- **BLOQUÉ** : l’environnement de test ne peut pas être utilisé sans risquer des données existantes.

Un GO-QUALIF **n’autorise pas** l’installation sur Zenith Ice.

## Rapport

Créer :

`reports/052_Qualification_mise_a_jour_STABLE_0.1.28_vers_0.1.29_report.md`

Le rapport doit contenir :

- inventaire avant test ;
- source exacte de la baseline 0.1.28 ;
- procédure de construction 0.1.29 ;
- preuve de version ;
- preuve de mise à jour réelle ;
- état de `%LOCALAPPDATA%\Textotheque` avant/après ;
- état de `%APPDATA%\Textotheque` avant/après ;
- contrôles données / registre / préférences ;
- unicité visible de l’application ;
- SHA-256 du Setup candidat local ;
- tests exécutés / non exécutés ;
- limites / risques résiduels ;
- verdict explicite.

Publier code, tests, documentation et rapport sur `origin/main` quel que soit le verdict. Vérifier SHA distant, `git diff --check`, état propre et synchronisé.

**S’arrêter après 052. Ne rien transférer vers Zenith Ice et ne pas commencer une mission 053 sans validation humaine.**
