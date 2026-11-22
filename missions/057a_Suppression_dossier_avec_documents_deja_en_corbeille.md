# Mission 057a — Suppression d’un dossier dont les documents sont déjà en corbeille

**Date :** 22 novembre 2026  
**Nature :** micro-ajustement fonctionnel après recette de 057.  
**Version :** conserver **0.1.29**. Aucun changement de version. Aucun Setup.

## Contexte

La mission 057 est techniquement validée. Elle a introduit :

- sélection visuelle exclusive document/dossier ;
- menus contextuels ;
- menu natif **Édition** ;
- renommage commun ;
- mise à la corbeille des documents ;
- suppression définitive des dossiers vides.

La recette met en évidence un comportement techniquement logique mais ergonomiquement étrange :

> un dossier dont le seul document est déjà dans la Corbeille ne peut pas être supprimé tant que ce document n’a pas lui-même été supprimé définitivement de la Corbeille.

La décision produit est de simplifier ce cas **sans changer de schéma SQLite**.

---

# 1 — Nouvelle définition d’un dossier supprimable

Un dossier peut être supprimé si :

- il ne contient **aucun sous-dossier** ;
- il ne contient **aucun document actif**.

Les documents déjà en Corbeille **ne doivent plus bloquer** la suppression du dossier.

Autrement dit, pour la vacuité fonctionnelle :

- document actif rattaché au dossier → bloque ;
- document supprimé (`deleted_at IS NOT NULL`) rattaché au dossier → ne bloque pas ;
- sous-dossier → bloque.

---

# 2 — Que faire des documents déjà en Corbeille ?

Avant de supprimer le dossier, tout document déjà en Corbeille qui pointe encore vers ce dossier doit être détaché :

`folder_id = NULL`

Puis le dossier est supprimé.

Ainsi :

- aucune référence vers un dossier inexistant n’est laissée ;
- un document restauré plus tard revient dans **Non classés** ;
- aucun changement de schéma n’est nécessaire.

Cette opération doit être faite côté DB, de manière atomique.

---

# 3 — Opération transactionnelle

Adapter `deleteEmptyFolder` ou la remplacer par une méthode mieux nommée si nécessaire.

L’opération doit :

1. vérifier que le dossier existe ;
2. refuser si un sous-dossier existe ;
3. refuser si un document actif (`deleted_at IS NULL`) référence le dossier ;
4. mettre `folder_id = NULL` sur les documents supprimés (`deleted_at IS NOT NULL`) qui référencent ce dossier ;
5. supprimer le dossier ;
6. faire tout cela dans une transaction unique.

En cas d’échec avant le `DELETE`, ne laisser aucun détachement partiel.

---

# 4 — UI

Adapter la pré-vérification renderer de 057 pour qu’elle soit cohérente avec la DB :

- sous-dossier → refus ;
- document actif → refus ;
- documents uniquement en Corbeille → autoriser la confirmation puis la suppression.

Ne pas changer le message de confirmation du dossier vide.

Ne pas afficher de message technique sur le détachement des documents supprimés : c’est un détail d’implémentation.

---

# 5 — Restauration après suppression du dossier

Scénario attendu :

1. document `A` dans dossier `D` ;
2. mettre `A` à la Corbeille ;
3. supprimer `D` ;
4. restaurer `A`.

Résultat :

- `A` est restauré ;
- `A.folder_id === null` ;
- `A` apparaît dans **Non classés**.

Ce comportement est volontaire et doit être testé.

---

# 6 — Invariants

Ne pas modifier :

- schéma SQLite 5 ;
- comportement des documents actifs ;
- comportement des sous-dossiers ;
- Corbeille documentaire ;
- restauration documentaire générale ;
- menu Édition ;
- menus contextuels ;
- sélection exclusive ;
- renommage ;
- ordre Manuel/Alphabétique ;
- version 0.1.29.

---

# 7 — Tests ciblés

Adapter les tests 057 existants.

Couvrir au minimum :

1. dossier avec document actif → suppression refusée ;
2. dossier avec sous-dossier → suppression refusée ;
3. dossier avec uniquement un document en Corbeille → suppression autorisée ;
4. après suppression du dossier, le document supprimé a `folder_id = NULL` ;
5. restauration de ce document → apparaît dans Non classés ;
6. plusieurs documents en Corbeille dans le même dossier → tous détachés puis dossier supprimé ;
7. transaction atomique : aucun détachement partiel si suppression refusée ;
8. aucun `folder_id` orphelin ;
9. suppression d’un dossier réellement vide toujours OK ;
10. aucune régression du flux Corbeille / Restaurer.

Pas de suites générales recherche/catalogue/distribution.

---

# 8 — Recette humaine

Proposer à David :

1. créer un dossier avec un document ;
2. mettre le document à la Corbeille ;
3. supprimer le dossier ;
4. vérifier que la suppression fonctionne ;
5. aller dans la Corbeille et restaurer le document ;
6. vérifier qu’il revient dans **Non classés** ;
7. refaire avec un dossier contenant encore un document actif et vérifier que la suppression reste refusée.

---

# 9 — Rapport

Créer :

`reports/057a_Suppression_dossier_avec_documents_deja_en_corbeille_report.md`

Le rapport doit préciser :

- nouvelle définition de vacuité ;
- transaction retenue ;
- détachement des documents supprimés ;
- restauration vers Non classés ;
- tests exécutés / non exécutés ;
- recette humaine ;
- verdict GO / PARTIEL / NO-GO.

Publier code/tests/rapport sur `origin/main`.

Vérifier :

- `git diff --check` ;
- SHA distant ;
- worktree propre/synchronisé.

**S’arrêter après 057a. Conserver la version 0.1.29. Ne fabriquer aucun Setup.**
