# Rapport — Autosave prudent et fiable

## Objectif

Ajouter à Textothèque `0.1.19` un autosave différé servant de filet de sécurité, sans supprimer `Ctrl+S`, le bouton de sauvegarde, le dirty marker ni les confirmations anti-perte.

## État initial

La sauvegarde manuelle persistait tous les champs documentaires puis appliquait systématiquement la réponse avec `applyDocument(saved)`. Cette approche était correcte sans concurrence, mais une réponse ancienne pouvait réinjecter son contenu dans le renderer après une frappe, une sélection ou un changement de bibliothèque plus récent.

Le worktree était propre au début de la mission.

## Fichiers modifiés

- `src/App.tsx` ;
- `src/services/documents.ts` ;
- `src/types/electron.d.ts` ;
- `electron/preload.cts` ;
- `electron/main.ts` ;
- `scripts/electron-autosave-check.cjs` (nouveau) ;
- `scripts/electron-ui-safeguards-check.cjs` ;
- `package.json` ;
- `package-lock.json` ;
- `reports/031_prudent_autosave_report.md`.

## Déclenchement et délai

La constante explicite `AUTOSAVE_DELAY_MS` vaut `1500`. Un effet React annule le timer précédent à chaque modification de titre, contenu, notes, statut, favori ou dossier, puis programme une sauvegarde après 1,5 seconde d’inactivité.

Aucun timer n’est créé sans document, pour un document en corbeille, pour un état propre, pendant une sauvegarde ou après une erreur non suivie d’une nouvelle modification.

## Partage avec la sauvegarde manuelle

Autosave et sauvegarde manuelle appellent la même primitive `persistCurrentDocument(snapshot)`.

`handleSave()` ne duplique aucune écriture : il annule le timer en attente, capture le snapshot courant puis appelle immédiatement cette primitive. Le bouton et `Ctrl+S` conservent donc leur rôle prioritaire sans autosave identique 1,5 seconde plus tard.

Le contrat persistant reste unique et contient tous les champs du dirty state : titre, contenu, notes, statut, favori et `folder_id`.

## Gestion des snapshots

Chaque requête capture :

- la génération du contexte d’éditeur ;
- l’identifiant du document ;
- le chemin canonique attendu de la bibliothèque ;
- le dossier persisté avant modification, pour le message d’erreur ;
- une copie exacte de tous les champs à sauvegarder.

Les valeurs visibles ne sont jamais relues depuis une closure ancienne au retour IPC. La réponse est comparée au draft courant avant tout changement d’état utilisateur.

## Course modification / sauvegarde

Scénario critique couvert :

```text
snapshot A → sauvegarde en cours
frappe B → draft local plus récent
retour A → baseline persistée mise à jour, champs B intacts, dirty conservé
pause → autosave B
retour B → dirty supprimé
```

Une réponse réussie met à jour uniquement le document persisté servant de baseline et la liste locale. Elle n’appelle plus `applyDocument(saved)` et ne remplace donc jamais le titre, le contenu ou les métadonnées plus récentes du formulaire.

Les requêtes en vol reçoivent un numéro croissant. Si une requête plus récente est encore active, une réponse plus ancienne ne remplace pas l’état visuel `Sauvegarde…`. En cas de retours désordonnés, le draft visible est comparé à la dernière baseline confirmée et reste dirty si nécessaire.

## Changement de document

Chaque application d’un autre document incrémente une génération d’éditeur et annule le timer courant. Une réponse dont la génération ou l’identifiant ne correspond plus est ignorée côté renderer.

Le garde-fou dirty existant reste prioritaire pendant une sauvegarde en cours. Le test force un retour tardif du document A après sélection de B et confirme que titre et contenu de B restent inchangés.

## Changement de bibliothèque

Une bascule réussie invalide le contexte et annule son timer. Les retours IPC de l’ancienne génération sont ignorés.

Une seconde barrière existe dans le main process : `documents:update` reçoit le chemin de bibliothèque attendu et refuse l’écriture si la connexion active a changé. Ainsi, même une requête mise en file avant la bascule ne peut pas écrire un identifiant de A dans B.

Le test retarde une sauvegarde de A, bascule vers B, libère la requête puis vérifie le rejet de contexte, l’absence d’erreur résiduelle dans B, l’absence de sélection ancienne et l’absence de nouveau timer.

## Gestion des erreurs

Un échec conserve le formulaire, la baseline précédente et le dirty marker. L’état devient `Erreur` et réutilise le feedback consolidé de la Mission 022.

Aucun retry n’est programmé par le simple passage à l’état erreur. `Ctrl+S` relance immédiatement une tentative ; une nouvelle frappe replace l’état à `Modifié` et autorise un nouveau debounce.

Une sauvegarde suivante réussie efface l’erreur précédente. L’échec d’une requête devenue étrangère au contexte est seulement neutralisé : il ne pollue pas le nouveau document ou la nouvelle bibliothèque.

## Dirty state

Le dirty marker reste calculé par comparaison exacte entre le formulaire visible et le document confirmé comme persisté. Il disparaît seulement lorsque tous les champs visibles correspondent à cette baseline.

Si l’utilisateur revient exactement aux valeurs persistées avant le timer, aucun autosave inutile n’est lancé et l’affichage ne reste pas faussement sur `Modifié`.

Les confirmations de fermeture, document et bibliothèque restent inchangées. Le backup de bibliothèque continue d’être refusé si le document est encore dirty.

## Feedback utilisateur

Le mécanisme existant affiche uniquement :

```text
Modifié → Sauvegarde… → Sauvegardé
```

ou `Erreur`. Aucun toast ou notification répétitive n’a été ajouté.

## Tests autosave

Le nouveau `test:autosave` utilise une fenêtre Electron cachée et des handlers IPC contrôlés. Il vérifie :

- trois frappes rapides produisent une seule écriture finale ;
- le dirty disparaît après autosave réussi ;
- le timer initial est remplacé par les frappes suivantes ;
- `Ctrl+S` sauvegarde immédiatement sans doublon différé ;
- B reste visible et dirty au retour de A, puis est autosauvegardée ;
- un échec conserve contenu et dirty, affiche l’erreur et ne retry pas ;
- `Ctrl+S` réussit après cette erreur et efface le feedback ;
- un retour tardif ne modifie pas le nouveau document ;
- une sauvegarde de l’ancienne bibliothèque est rejetée et neutralisée après bascule.

Les logs `SQLITE_AUTOSAVE_FORCED` et `contexte bibliotheque modifie` sont les deux échecs volontairement injectés.

## Tests existants

`test:ui-safeguards` reste vert sans allonger artificiellement le délai : les confirmations, sauvegardes manuelles, erreurs IPC, changements de bibliothèque et backups dirty continuent de fonctionner.

Les dix validations historiques restent également vertes.

## Ressources temporaires

Le test autosave utilise exclusivement des handlers IPC factices et des chemins factices `C:\temporary\autosave-*.sqlite` ; aucun fichier SQLite n’est créé à ces chemins. Sa session Chromium utilise une partition dédiée au processus de test.

Les autres tests conservent leurs répertoires propriétaires `%TEMP%\textotheque-test-*` et leurs nettoyages existants. Aucune bibliothèque ou registre utilisateur réel n’a été lu ou écrit par les scénarios autosave.

## Vérifications effectuées

Les onze commandes suivantes ont terminé avec le code `0` :

- `npm.cmd run build` ;
- `npm.cmd run test:app-identity` ;
- `npm.cmd run test:legacy-migration` ;
- `npm.cmd run test:db` ;
- `npm.cmd run test:electron-sqlite` ;
- `npm.cmd run test:preload` ;
- `npm.cmd run test:ui-safeguards` ;
- `npm.cmd run test:ipc-error` ;
- `npm.cmd run test:library` ;
- `npm.cmd run test:library-history` ;
- `npm.cmd run test:autosave`.

Les erreurs visibles dans les tests preload, UI, bibliothèque, historique et autosave sont les rejets négatifs attendus. Chaque script atteint son message final de succès.

## Commandes lancées

```powershell
git status --short
git diff --stat
npm.cmd run build
npm.cmd run test:ui-safeguards
npm.cmd run test:autosave
npm.cmd run build
npm.cmd run test:app-identity
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
npm.cmd run test:ipc-error
npm.cmd run test:library
npm.cmd run test:library-history
npm.cmd run test:autosave
git status --short
git diff --stat
git diff --name-only
git diff --check
```

## Versionnement

La version applicative passe de `0.1.18` à `0.1.19` dans `package.json` et `package-lock.json`. `package.json` reste la source canonique. `CURRENT_SCHEMA_VERSION` reste à `2`. Aucune migration ou dépendance n’est ajoutée.

## Points non traités

- réglage utilisateur d’activation ou de délai ;
- flush automatique complexe à la fermeture ;
- retry périodique ;
- versions ou historique documentaire ;
- queue, worker ou batch de sauvegarde ;
- modification de `AGENTS.md` ou `docs/DB_ROADMAP.md`.

## Risques / limites

Le délai fixe de 1,5 seconde devra être jugé en usage réel. Une frappe intervenue pendant une requête repousse son autosave à 1,5 seconde après le retour ancien afin de rester simple et d’éviter les écritures rapprochées.

Le protocole de chemin attendu protège les bascules entre bibliothèques dans le processus principal actuel. Il ne constitue pas un mécanisme multi-instance ou distribué, qui reste hors architecture de Textothèque.

## Suite recommandée

Le mainteneur peut tester quelques paragraphes naturels, observer `Modifié → Sauvegarde… → Sauvegardé`, fermer/réouvrir et juger le délai. Un réglage ne devrait être ajouté que si cette utilisation réelle montre que 1,5 seconde est trop courte ou trop longue.
