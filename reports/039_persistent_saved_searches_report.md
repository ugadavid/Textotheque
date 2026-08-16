# Rapport — Recherches enregistrées persistantes

## Objectif

Permettre d'enregistrer, rappeler et administrer dans chaque bibliothèque SQLite une définition complète de recherche avancée, sans figer ses résultats ni créer un second moteur de recherche.

## État initial

Textothèque était en version applicative `0.1.26` et au schéma SQLite 4. La recherche FTS5 et les filtres structurés existaient déjà, mais leurs critères n'étaient pas persistés.

## Philosophie : recette dynamique, pas snapshot

Une recherche enregistrée contient uniquement l'intention structurée de l'utilisateur. Aucun ID de résultat, snippet, score, SQL, expression FTS brute, descendant développé ou compteur n'est stocké. Son exécution repasse par `searchDocuments()` et recalcule donc les résultats courants.

## Modèle relationnel

Le schéma 5 ajoute trois tables : `saved_searches` pour les critères scalaires, `saved_search_folders` pour les racines de branches et `saved_search_statuses` pour les statuts. Aucun tableau n'est sérialisé en JSON.

## Migration SQLite 4 → 5

La migration versionnée crée les trois tables dans cet ordre puis positionne `PRAGMA user_version` à 5 via le mécanisme transactionnel existant. Une vraie fixture v4 avec documents, dossiers, FTS5 et TODO vérifie la conservation des données et du moteur de recherche ; elle contient naturellement zéro recherche enregistrée après migration.

## Table saved_searches

Elle persiste le nom, le texte, les zones FTS, le mode, les booléens structurés, les périodes et dates civiles, le tri et les timestamps ISO UTC. La liste légère ne renvoie que `id`, `name` et `updatedAt`, triés par nom avec un tie-breaker stable.

## Dossiers enregistrés

`saved_search_folders` conserve uniquement les racines choisies. Chaque identifiant est validé dans la bibliothèque active ; les descendants restent recalculés par le CTE récursif du moteur existant.

## Statuts enregistrés

`saved_search_statuses` contient une ligne par statut du domaine `DocumentStatus`. Les valeurs sont dédupliquées et normalisées dans l'ordre canonique.

## Domaines et contraintes

Les booléens sont bornés à 0/1. Les modes, périodes, statuts, champs de tri et directions utilisent des domaines fermés. Le nom est trimé, unique, non vide et limité à 120 caractères. Une requête textuelle exige au moins une zone, et le tri par pertinence exige du texte.

## Dates relatives

Seul le preset (`last7days`, `last15days`, `last30days`, `thisYear`) est persisté. Les bornes locales puis UTC sont recalculées à chaque exécution, avec une borne supérieure exclusive au lendemain du jour de référence. Le test contrôlé du 16 puis du 30 août démontre que `last7days` évolue de 10–16 à 24–30 août.

## Dates personnalisées

Les plages personnalisées conservent exactement les dates civiles `YYYY-MM-DD`. Au moins une borne est obligatoire. Pour toute autre période, les deux colonnes de dates doivent rester nulles.

## CRUD

`listSavedSearches()`, `getSavedSearch()`, `createSavedSearch()`, `updateSavedSearch()`, `renameSavedSearch()` et `deleteSavedSearch()` sont exposées de SQLite au renderer via IPC, preload, types explicites et services dédiés.

## Transactions

La création, la mise à jour des critères et la suppression englobent la ligne principale et les deux ensembles de relations dans une transaction. Un test d'update avec dossier inexistant vérifie le rollback complet.

## Exécution via le moteur existant

Le renderer charge la définition, reconstruit les `SearchDocumentsOptions`, puis laisse l'effet de recherche appeler `searchDocuments()`. Aucun SQL d'exécution parallèle n'a été ajouté et le contrat léger des résultats reste inchangé.

## Navigation gauche

Une section « Recherches enregistrées » affiche uniquement les noms et un compteur discret. Un clic charge la définition et ouvre le catalogue central.

## Recherche active et baseline

Le renderer conserve `activeSavedSearchId`, le nom actif et une baseline normalisée des critères. Ouvrir un document résultat ne supprime pas cette association.

## Recherche modifiée

Les critères courants sont comparés à la baseline normalisée, jamais aux résultats. Toute divergence affiche « — modifiée » sans écriture automatique en base.

## Enregistrer sous

Le dialogue React crée une nouvelle définition avec les critères courants. La nouvelle recherche devient active avec une baseline propre ; l'ancienne reste inchangée.

## Mettre à jour

La mise à jour n'est disponible que pour une recherche active modifiée et valide. Elle remplace explicitement les critères et relations, puis renouvelle la baseline.

## Renommer

Le dialogue React modifie uniquement le nom et `updated_at`. Les critères sont préservés.

## Supprimer

Une confirmation nomme la recherche ciblée. La suppression retire uniquement sa définition et ses relations ; les critères et résultats affichés restent présents mais ne sont plus associés.

## Menu Recherche

Un menu natif racine regroupe recherche simple, recherche avancée, enregistrer sous, mettre à jour, renommer, supprimer et le sous-menu dynamique des recherches de la bibliothèque. Ses actions envoient des intentions aux mêmes handlers React que l'interface.

## Ctrl+F

`CommandOrControl+F` appartient uniquement au menu natif. L'ancien handler clavier renderer a été retiré afin d'éviter tout double déclenchement.

## Changement de bibliothèque

La bascule efface l'association active, réinitialise les critères selon le flux existant et recharge uniquement la liste de la nouvelle bibliothèque. Les tests couvrent des listes A/B distinctes et des IDs indépendants.

## Protection de contexte

Les écritures create/update/rename/delete transportent le chemin attendu. Le main process le compare à la connexion active avant toute mutation. Une requête A rejouée après bascule vers B est rejetée et ne modifie pas B.

## Backup et migration

Le snapshot `better-sqlite3.backup()` emporte naturellement les trois tables. Le test rouvre la sauvegarde, compare la définition et l'exécute. Les bibliothèques externes v4 restent soumises au flux existant inspection, consentement, backup pré-migration, migration et bascule atomique.

## Tests saved-searches

Le nouveau script couvre migration v4→v5, CRUD, liste légère, contraintes, atomicité, round-trip complet, dates custom et relatives, branches de dossiers, statuts, backup, indépendance A/B, suppression des enfants et états du menu.

## Tests UI

Le scénario Electron couvre save, save as, modification sans autosave, update explicite, rename, delete, reset, chargement depuis navigation et menu, ouverture d'un résultat, bascule de bibliothèque, refus d'une écriture obsolète et propriétaire unique de Ctrl+F.

## Performance

La navigation utilise une requête légère ordonnée. Les clés primaires composites des tables enfants couvrent les lectures par `saved_search_id`; aucun index spéculatif n'a été ajouté.

## Découvrabilité

Les recherches sont accessibles à la fois dans la navigation gauche, dans les contrôles de recherche avancée et dans le menu natif `Recherche`, sans dupliquer les workflows métier.

## Vérifications effectuées

Tous les tests demandés passent avec code 0. Les avertissements Windows `os_crypt_win.cc` et `gpu_process_host.cc` observés sur certains tests Electron sont les bruits non bloquants connus. Le premier lancement sandboxé de `test:ipc-error` a rencontré `ERR_FAILED` sur une URL `data:` ; la relance autorisée hors sandbox a réussi.

## Commandes lancées

```powershell
git status --short
git diff --stat
npm.cmd run build
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
npm.cmd run test:ipc-error
npm.cmd run test:library
npm.cmd run test:catalog
npm.cmd run test:search
npm.cmd run test:special-todo
npm.cmd run test:saved-searches
git status --short
git diff --stat
git diff --name-only
git diff --check
```

## Versionnement

Version applicative : `0.1.26` → `0.1.27` dans `package.json` et `package-lock.json`.

Schéma SQLite : 4 → 5 via `CURRENT_SCHEMA_VERSION` et la migration explicite `add persistent saved searches`.

## Points non traités

Pas d'ordre manuel, favoris ou dossiers de recherches, recherche imbriquée, raccourci individuel, synchronisation externe, SQL persisté ni snapshot de résultats.

## Risques / limites

Les noms sont uniques selon le comportement SQLite simple demandé, sans normalisation Unicode sophistiquée. Les contrôles d'ergonomie fine, densité et placement restent à apprécier humainement.

## Suite recommandée

Faire une vérification humaine rapide du panneau gauche, du dialogue de nommage, de l'indication « modifiée » et du menu natif sur une bibliothèque temporaire ou une copie de test.
