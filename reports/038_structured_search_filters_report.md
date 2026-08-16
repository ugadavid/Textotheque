# Rapport — Filtres structurés de recherche

## Objectif

Compléter le moteur FTS5 des Missions 037/037b avec des filtres SQL explicites sur le dossier, le statut, le favori, le rôle spécial et les dates de création/modification, utilisables avec ou sans texte.

## État initial

Textothèque 0.1.25 utilisait le schéma SQLite 4. La recherche savait déjà combiner FTS5, période rapide de création, pertinence, snippets et tris SQL, mais ne possédait aucun autre filtre structuré.

Le worktree était propre au démarrage de la mission.

## Fichiers modifiés

- moteur et contrat DB : `electron/database.ts` ;
- types renderer : `src/types/search.ts` ;
- orchestration et UI : `src/App.tsx`, `src/components/DocumentCatalog.tsx`, `src/styles/app.css` ;
- tests : `scripts/electron-search-check.cjs`, `scripts/electron-preload-api-check.cjs`, `scripts/electron-ui-safeguards-check.cjs`, `scripts/electron-library-check.cjs`, `scripts/electron-legacy-migration-check.cjs`, `scripts/electron-ipc-error-check.cjs` ;
- version et documentation factuelle : `package.json`, `package-lock.json`, `AGENTS.md`.

## Contrat de recherche

`SearchDocumentsOptions` transporte maintenant des domaines fermés pour :

- `folder: 'all' | 'unclassified' | number` ;
- `status: 'all' | DocumentStatus` ;
- `favorite: 'any' | 'yes' | 'no'` ;
- `role: 'all' | 'ordinary' | 'todo'` ;
- `created` et `modified`, chacun contenant un preset et deux dates civiles optionnelles ;
- le tri et sa direction existants.

Le contrat conserve les presets métier (`last7days`, etc.) au lieu de mémoriser leurs bornes calculées. Il pourra donc servir de base aux recherches enregistrées sans stocker de SQL.

## Construction SQL

Un helper local construit une liste réduite de prédicats connus. Les valeurs de dossier, statut, favori, rôle et dates restent paramétrées. Les seuls fragments variables non paramétrables — colonnes de date, colonnes de tri et directions — proviennent de tables de correspondance fermées.

La même liste de prédicats est injectée dans les deux voies :

```text
texte présent    → FTS MATCH AND prédicats structurés
texte absent     → prédicats structurés sans MATCH
```

`d.deleted_at IS NULL` reste systématique. Aucun filtrage des résultats et aucun tri n’est effectué dans React.

## Dossier

Le filtre accepte tous les dossiers, les documents non classés ou un identifiant entier positif. La requête compare toujours `folder_id`, jamais le nom libre.

La sélection est exacte : un dossier parent n’inclut pas ses descendants. L’interface construit seulement des chemins lisibles tels que `M2 › Soutenance` depuis l’arborescence déjà chargée ; ces chemins ne sont pas persistés ni transmis à SQLite.

## Statut, favori et type

Le statut reprend exactement le domaine persistant : `draft`, `active`, `to_review`, `final`, `archived`.

Le favori distingue explicitement `any`, `yes` et `no`. Le type distingue `all`, `ordinary` (`special_role IS NULL`) et `todo` (`special_role = 'todo'`). Une valeur hors domaine est rejetée avant la préparation de la requête.

## Filtres temporels

Le moteur temporel existant a été généralisé. Création et modification utilisent le même helper et les mêmes presets : toutes dates, 7/15/30 derniers jours, cette année et plage personnalisée.

Les presets rapides partent toujours de minuit civil local, puis la borne est convertie en ISO UTC. « Cette année » part du 1er janvier local.

Pour une plage personnalisée :

```text
Du → colonne >= début local du jour
Au → colonne < début local du jour suivant
```

Aucun `23:59:59.999` n’est fabriqué. Les bornes `Du` et `Au` sont indépendamment optionnelles. Une plage inversée est bloquée dans le renderer sans IPC et également refusée par la DB.

## Recherche sans texte

Une recherche vide peut combiner n’importe quels filtres structurés. Elle utilise uniquement la table `documents`, la jointure de dossier et SQL classique, sans clause FTS `MATCH`.

L’ouverture explicite de Recherche avancée sans aucun critère affiche naturellement tous les documents actifs.

## Recherche texte + filtres

La requête FTS conserve les zones, les modes, les préfixes contrôlés, `snippet()` et `bm25()`. Les prédicats structurés sont ajoutés avec `AND` dans la même requête SQLite. Un document correspondant au texte mais échouant à un filtre est donc exclu avant tout transfert au renderer.

## Tri

Avec texte, le tri initial reste la pertinence. Sans texte :

- filtre de modification actif → `updated_at DESC` ;
- sinon filtre de création actif → `created_at DESC` ;
- sinon → `updated_at DESC`.

Un clic manuel sur une colonne continue de relancer la requête DB. Une modification du texte, des zones ou du mode avec texte rétablit la pertinence.

## Interface et réinitialisation

Le panneau compact contient les quatre filtres structurés, les deux filtres temporels et les champs `Du`/`Au` affichés seulement en mode personnalisé. Les dossiers imbriqués utilisent leur chemin d’affichage.

Le bouton « Réinitialiser » remet le texte, les zones, le mode et tous les filtres à leurs valeurs par défaut, puis reste dans le catalogue complet trié par modification décroissante.

Escape conserve le comportement rapide historique : sortie de la recherche et suppression des filtres actifs. Les choix de zones et de mode restent mémorisés pour la session, sauf utilisation du bouton Réinitialiser.

## Dirty state

Les critères sont des états indépendants du brouillon éditorial. Leur modification ne touche ni au document sélectionné, ni au contenu, ni aux notes, ni à la baseline dirty, ni aux timers d’autosave.

L’ouverture d’une ligne de résultat continue de passer par `handleSelectDocument()` et son garde anti-perte.

## Changement de bibliothèque

Une bascule invalide la génération de recherche, vide les résultats et réinitialise entièrement les critères, notamment le dossier. La nouvelle liste de dossiers est chargée depuis la bibliothèque B ; aucun identifiant ni libellé de A ne survit dans le sélecteur.

Le test UI force une recherche avec un dossier de A pendant la bascule, puis vérifie que B présente `folder = all`, sans option de dossier héritée et sans réponse tardive de A.

## Tests filtres

`test:search` couvre :

- dossiers X, Y, non classé et tous ;
- cinq statuts réels et rejet d’un statut inventé ;
- favori `any`, `yes`, `no` ;
- rôles `all`, `ordinary`, `todo` ;
- recherche structurée sans texte ;
- texte combiné à plusieurs critères ;
- exclusion d’un résultat textuel échouant au dossier ;
- maintien du résultat léger sans `content` ni `notes`.

## Tests temporels

Les tests déterministes valident :

- les presets 7/15/30 jours et cette année ;
- les plages personnalisées `from-only`, `to-only` et entre deux dates ;
- l’inclusion exacte de la borne basse ;
- l’exclusion exacte de la borne haute du jour suivant ;
- le rejet de `Du > Au` ;
- la même logique sur `created_at` et `updated_at` ;
- la combinaison création + modification avec `AND`.

## Tests UI

Le parcours Electron vérifie les valeurs par défaut, les sélecteurs, les tris naturels, statut/favori/type, la validation sans IPC d’une plage inversée, les chemins de dossiers, le dossier exact, le reset complet, Escape et la bascule de bibliothèque.

Les scénarios historiques de recherche, snippets, réponses obsolètes, dirty state, autosave, catalogue, corbeille et TODO restent actifs.

## Performance

La requête énumère toujours explicitement les métadonnées légères et ne transfère ni contenu ni notes. Le compteur utilise `results.length`.

Aucun index SQL, index FTS de préfixes, dépendance, ORM ou query builder externe n’a été ajouté. Aucun benchmark artificiel n’a été lancé.

## Découvrabilité

La barre globale, `Ctrl+F` et le bouton Recherche avancée restent les trois accès. Aucun menu natif supplémentaire n’est nécessaire.

## Ressources temporaires

Tous les tests DB et Electron utilisent des ressources sous `%TEMP%\textotheque-test-*`. Le test IPC a également reçu un profil Electron explicitement placé dans son répertoire temporaire afin de ne plus utiliser les caches du profil réel Textothèque.

Aucune bibliothèque ni aucun registre utilisateur réel n’a été ouvert par les tests.

## Vérifications effectuées

Les validations suivantes terminent avec le code 0 : build, recherche, catalogue, preload, UI safeguards, propagation IPC, TODO spécial, DB, migration legacy et bibliothèques.

Le test IPC a dû être exécuté hors bac à sable : Chromium refusait d’y charger même sa page `data:` avant toute assertion. Avec le même code et un profil temporaire, le scénario de propagation atteint son message final de succès.

Les traces `SQLITE_FORCED` et les scénarios d’échec de bibliothèque sont les erreurs volontairement injectées. Les avertissements GPU/os_crypt Windows sont les messages Electron connus lorsque la commande atteint son succès et retourne 0.

## Commandes lancées

```powershell
git status --short
git diff --stat
npm.cmd run build
npm.cmd run test:search
npm.cmd run test:catalog
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
npm.cmd run test:ipc-error
npm.cmd run test:special-todo
npm.cmd run test:db
npm.cmd run test:legacy-migration
npm.cmd run test:library
git status --short
git diff --stat
git diff --name-only
git diff --check
```

## Versionnement

- version applicative : `0.1.25` → `0.1.26` ;
- schéma SQLite : `4`, inchangé.

## Points non traités

- inclusion récursive des sous-dossiers ;
- filtre d’inclusion de la corbeille ;
- recherches enregistrées et persistance des critères ;
- gestion d’un dossier supprimé dans une future recherche enregistrée ;
- pagination et seconde requête de comptage ;
- index supplémentaires et audit de performance à grande échelle.

## Risques / limites

Les filtres utilisent des scans/jointures ordinaires sur une bibliothèque personnelle de petit volume. Si le volume réel augmente, l’indexation devra être guidée par des mesures et des requêtes observées.

Un filtre de dossier est volontairement non récursif. Le chemin affiché dépend de l’arborescence actuellement chargée mais l’identité transmise reste l’ID stable du dossier.

La densité et le confort des deux plages personnalisées doivent être jugés humainement sur la largeur réelle de l’application.

## Suite recommandée

Effectuer le test humain prévu : dossier seul, favori seul, modification récente, plage personnalisée inclusive, combinaison texte + dossier + statut + date, filtre TODO et Réinitialiser. La Mission 039 pourra ensuite persister le contrat structuré sans stocker de SQL ni de bornes calculées pour les presets relatifs.
