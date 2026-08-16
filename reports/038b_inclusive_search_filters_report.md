# Rapport — Filtres inclusifs de recherche

## Objectif

Simplifier les filtres structurés de la Mission 038 avant son commit : absence de sélection = absence de filtre, sélection = inclusion des valeurs choisies. La recherche reste entièrement DB-first et compatible avec ou sans texte FTS5.

## Retour d’usage sur Mission 038

Les valeurs explicites `Tous`, `Indifférent` et `Non` traduisaient directement le modèle technique sans aider l’usage courant. Le dossier et le statut mono-valeur empêchaient également de chercher dans plusieurs zones ou états en une seule requête.

## Simplification du modèle

Le contrat de recherche transporte désormais :

```ts
folderSelection: {
  folderIds: number[];
  includeUnclassified: boolean;
};
statuses: DocumentStatus[];
favoriteOnly: boolean;
```

Les anciens domaines `folder`, `status`, `favorite` et `role` ont été retirés. Les tableaux vides et `false` expriment directement l’absence de filtre.

## Suppression du filtre Type

Le contrôle Type, son état React, son contrat IPC, ses prédicats SQL et ses tests ont été supprimés. La colonne métier `documents.special_role` et le fonctionnement du TODO ne changent pas.

Le TODO reste inclus comme tout document actif. Il est éligible sans filtre dossier ou avec `Non classé`, puisque son `folder_id` vaut `NULL`.

## Favoris seulement

Le sélecteur à trois valeurs a été remplacé par une case `Favoris seulement`. `false` n’ajoute aucun prédicat ; `true` ajoute `d.favorite = 1`. Il n’existe pas de filtre « non favoris seulement ».

## Statuts multiples

Les cinq statuts persistants sont présentés sous forme de cases à cocher. La DB vérifie que l’entrée est un tableau, déduplique ses valeurs et rejette tout statut hors domaine. Une sélection non vide produit un `IN` composé uniquement de placeholders nommés.

## Dossiers multiples

Le contrôle dossier est un panneau compact à cases à cocher. Son résumé indique le nombre de branches choisies et la sélection indépendante de `Non classé`. Seuls les identifiants des dossiers racines sont transmis à la DB ; aucun nom ni chemin d’affichage n’entre dans le contrat.

## Sémantique des branches

Une racine sélectionnée inclut son dossier et tous ses descendants. Dans l’interface, un descendant couvert par un parent sélectionné reste visible mais est désactivé et marqué `déjà inclus`. Aucune exclusion de sous-branche ni logique tri-state n’a été ajoutée.

## CTE récursif SQLite

Lorsque des racines existent, SQLite construit `selected_folders`, puis `folder_scope` avec `WITH RECURSIVE`. Le membre récursif suit `folders.parent_id`. `UNION`, et non `UNION ALL`, donne un ensemble distinct : une sélection parent + enfant ne duplique donc aucun résultat et une anomalie cyclique ne provoque pas de récursion infinie.

Les identifiants sont des entiers positifs sûrs, dédupliqués et passés par paramètres nommés. React ne calcule jamais la liste finale des descendants.

## Non classé

Sans branche, `includeUnclassified=true` produit `d.folder_id IS NULL`. Avec une ou plusieurs branches, le prédicat devient l’union logique de la portée récursive et de `IS NULL`. Sans branche et avec `includeUnclassified=false`, aucun prédicat dossier n’est ajouté.

## Construction SQL

Les statuts, IDs de dossiers et bornes temporelles restent paramétrés. Les dimensions actives se combinent par `AND`, tandis que branches + Non classé sont regroupés par `OR`. `d.deleted_at IS NULL` reste systématique.

## Combinaisons avec FTS5

La même portée structurée est injectée dans la requête FTS5 et dans la requête SQL sans texte. `MATCH`, statuts, portée récursive, favori et dates sont donc évalués par une seule requête SQLite, sans filtrage ni tri React.

## Réinitialisation

`Réinitialiser` restaure le texte vide, les trois zones, le mode `all`, aucune branche, Non classé décoché, aucun statut, favoris décoché et les deux périodes à `all`. Le catalogue reste trié par modification décroissante.

## Changement de bibliothèque

Une bascule invalide toujours la génération de recherche et remet la sélection de dossiers à vide. Le test UI vérifie qu’un ID de la bibliothèque A n’existe plus dans le contrôle de B et qu’une réponse tardive ne remplace pas le nouvel état.

## Tests statuts

`test:search` couvre le tableau vide, chaque statut réel, l’union `draft + active` et le rejet d’un statut inventé.

## Tests dossiers

Une arborescence contrôlée A/A1/A1a/A2 et B/B1 vérifie : branche A complète, union A1 + B, Non classé seul, branche A + Non classé, absence de filtre, parent + enfant sans doublon et texte FTS limité à une branche.

## Tests favoris

Les scénarios vérifient que `favoriteOnly=false` conserve favoris et non-favoris, et que `favoriteOnly=true` conserve uniquement les favoris.

## Tests UI

Le parcours Electron vérifie la disparition de Type et des valeurs `Indifférent`, les statuts multiples, la case favoris, l’indication sur les sous-dossiers, la couverture visible d’un descendant, la recherche structurée sans texte, le reset, la bascule de bibliothèque et la recherche normale du TODO.

## Performance / indexation

Aucun index ni benchmark artificiel n’a été ajouté. Le CTE utilise les relations de dossiers et les index existants sur `folders.parent_id` et `documents.folder_id`. Les volumes personnels actuels ne justifient pas davantage.

## Vérifications effectuées

Toutes les validations demandées ont terminé avec le code 0 : build, recherche, catalogue, preload, UI safeguards, propagation IPC, TODO spécial et DB.

Le premier lancement de `test:ipc-error` dans le bac à sable a échoué avant les assertions, Chromium refusant de charger la page locale `data:`. La même commande hors bac à sable a atteint `ipc error propagation ok` et nettoyé son profil temporaire.

Les traces `SQLITE_FORCED` des tests UI/IPC sont les erreurs volontairement injectées. Les avertissements Windows GPU/os_crypt sont les messages Electron connus lorsque la commande atteint son succès.

Tous les tests ont utilisé leurs répertoires `%TEMP%\textotheque-test-*`. Aucune bibliothèque ni aucun registre utilisateur réel n’a été ouvert.

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
git status --short
git diff --stat
git diff --name-only
git diff --check
```

## Versionnement

- version applicative conservée : `0.1.26` ;
- version de schéma conservée : `4`.

La Mission 038b ajuste la même évolution non commitée que la Mission 038.

## Points non traités

Les exclusions de sous-branches, états tri-state, filtre non-favoris, recherches enregistrées, pagination et gestion manuelle de sélections persistées restent hors périmètre.

## Risques / limites

Le panneau de dossiers peut devenir plus long avec une arborescence très volumineuse ; il est limité en hauteur et scrollable, sans virtualisation. Une sélection enfant conservée avant la sélection de son parent reste présente dans l’état mais devient visiblement redondante et ne produit aucun doublon SQL.

## Suite recommandée

Effectuer le contrôle humain prévu sur la densité du panneau, plusieurs branches réelles, plusieurs statuts, favoris seulement et une combinaison avec une période de modification. Le principe émergent est : pour un filtre inclusif, absence de sélection = absence de filtre.
