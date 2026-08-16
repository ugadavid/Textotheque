# Rapport — Sélecteur des recherches enregistrées

## Objectif

Replacer l'accès contextuel aux recherches enregistrées dans le panneau Recherche avancée et rendre au panneau gauche son rôle exclusivement documentaire, sans modifier le stockage SQLite ni les workflows de la Mission 039.

## Fichiers modifiés

- `src/components/NavigationPane.tsx`
- `src/components/DocumentCatalog.tsx`
- `src/App.tsx`
- `src/styles/app.css`
- `scripts/electron-ui-safeguards-check.cjs`
- `AGENTS.md`
- `reports/039b_saved_search_selector_report.md`

## Colonne gauche

La section « Recherches enregistrées » et tous ses props, types et styles propres ont été retirés de `NavigationPane`. La colonne gauche contient de nouveau uniquement les accès structurels, dossiers et documents. Aucune recherche ni donnée n'a été supprimée.

## Sélecteur dans Recherche avancée

Un select compact « Recherche enregistrée » a été ajouté sur la ligne des dates, avant les actions. Il réutilise directement la liste légère `savedSearches` déjà chargée par `App`, dans son ordre `name ASC`, sans requête DB supplémentaire.

Sans recherche active, il affiche « Recherches enregistrées… ». Avec une recherche active, il affiche son nom. Si les critères divergent de la baseline, l'option active porte un `*` et le contrôle expose le tooltip « Critères modifiés depuis la dernière sauvegarde ».

## Chargement

Le `change` du select transmet l'identifiant au callback `onOpenSavedSearch`. Dans `App`, ce callback pointe sur l'unique `handleOpenSavedSearch`, déjà utilisé par le menu natif. Il charge la définition, applique les critères, déclenche le moteur existant et installe la baseline propre.

## Mise à jour

Le comportement existant est conservé : aucune modification de critère n'écrit automatiquement en DB. Le select garde la recherche active et affiche `*`. Après « Mettre à jour », la baseline est renouvelée et le marqueur disparaît immédiatement.

## Renommer

Après renommage, la liste légère est rechargée puis retriée. Le select affiche immédiatement le nouveau nom, tandis que le menu natif reste rafraîchi par le main process comme en Mission 039.

## Supprimer

Après confirmation et suppression de la recherche active, le select revient au placeholder. Les critères et résultats affichés restent intacts et deviennent une recherche non enregistrée.

## Réinitialiser

« Réinitialiser » continue de vider les critères et l'association `activeSavedSearchId`. Le select revient donc au placeholder sans persistance implicite.

## Enregistrer sous

Le dialogue et le CRUD existants sont inchangés. Après création, la liste déjà partagée est rafraîchie et la nouvelle recherche devient immédiatement l'option active du select.

## Changement de bibliothèque

La bascule A→B vide toujours l'association active, recharge la liste de B et laisse le select sur son placeholder. Le test vérifie que la recherche de A est absente, que celle de B est présente et qu'aucun nom de recherche n'apparaît dans la navigation gauche.

## Menu natif conservé

Le menu `Recherche`, son sous-menu dynamique, `Ctrl+F` et ses états d'activation n'ont pas été modifiés. Il reste l'accès global et découvrable.

## Workflow partagé

Le select et le menu natif convergent vers `handleOpenSavedSearch`. Aucun second chargeur, moteur, état, appel SQLite ou chemin de validation n'a été créé.

## Règle de navigation structurelle

`AGENTS.md` précise désormais que le panneau gauche représente prioritairement la structure documentaire. Les outils applicatifs comme les recherches enregistrées doivent vivre avec la fonction qu'ils configurent, tout en restant découvrables par les menus natifs lorsque pertinent.

## Tests

Le scénario UI vérifie :

- absence de recherches enregistrées dans `NavigationPane` ;
- présence du select et du placeholder dans Recherche avancée ;
- création et sélection immédiate ;
- chargement par le select avec critères et résultats attendus ;
- état modifié `*`, update et disparition du marqueur ;
- save-as, renommage et rafraîchissement ;
- suppression avec conservation des critères/résultats ;
- reset vers le placeholder ;
- ouverture d'un résultat sans perte du contexte ;
- bascule A→B sans fuite de nom ou d'ID ;
- chargement natif et chargement select vers le même handler.

## Vérifications effectuées

Les quatre validations ciblées ont terminé avec un code de sortie 0. Les traces `SQLITE_FORCED` et « contexte bibliothèque modifié » du test UI sont des erreurs volontairement injectées. Les avertissements Windows `os_crypt_win.cc` et `gpu_process_host.cc` de `test:saved-searches` restent les avertissements Electron connus et non bloquants.

## Commandes lancées

```powershell
git status --short
git diff --stat
npm.cmd run build
npm.cmd run test:ui-safeguards
npm.cmd run test:saved-searches
npm.cmd run test:preload
git status --short
git diff --stat
git diff --name-only
git diff --check
```

## Versionnement

- version applicative conservée : `0.1.27` ;
- schéma SQLite conservé : 5 ;
- aucune migration ni dépendance ajoutée.

La Mission 039b complète la Mission 039 avant leur commit commun.

## Points non traités

Aucun ordre manuel, dossier de recherches, favori de recherche, nouvelle persistance UI ou changement du menu natif n'a été ajouté.

## Risques / limites

La largeur, la densité et le placement exacts du select restent volontairement soumis au contrôle humain. Les noms très longs sont bornés à 120 caractères par le modèle existant et le select possède une largeur maximale raisonnable, sans traitement visuel sophistiqué.

## Suite recommandée

Vérifier humainement le confort du select avec quelques noms courts et longs, ainsi que l'équilibre de la ligne « Créé / Modifié / Recherche enregistrée / actions » à la largeur de fenêtre habituelle.
