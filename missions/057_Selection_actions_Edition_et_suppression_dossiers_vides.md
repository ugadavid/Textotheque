# Mission 057 — Sélection exclusive, menu Édition et suppression des dossiers vides

**Date :** 22 novembre 2026  
**Nature :** évolution ergonomique ciblée.  
**Version :** conserver **0.1.29**. Aucun changement de version. Aucun Setup.

## Intention produit

David veut rendre les actions de base plus cohérentes dans l’explorateur Textothèque :

1. lorsqu’un document est sélectionné, son dossier parent ne doit plus rester visuellement sélectionné ;
2. document et dossier doivent disposer d’actions cohérentes au clic droit ;
3. ajouter un menu natif **Édition** avec les actions adaptées à la sélection courante ;
4. conserver la Corbeille pour les documents ;
5. permettre la suppression définitive d’un **dossier vide uniquement**, sans migration SQLite ni corbeille de dossiers.

Cette mission doit rester simple. **Aucun changement de schéma.**

---

# 1 — Sélection exclusive dans l’explorateur

## Problème actuel

Aujourd’hui, lorsqu’un document situé dans un dossier est sélectionné :

- le document est affiché comme sélectionné ;
- le dossier parent conserve aussi son liseré/état visuel de sélection.

Cela vient du fait que le dossier reste le contexte actif de navigation.

## Comportement attendu

Visuellement, **un seul objet est sélectionné à la fois** :

- clic sur un dossier → seul le dossier est sélectionné ;
- clic sur un document → seul le document est sélectionné ;
- le dossier parent peut rester connu comme contexte de navigation, mais il ne doit plus apparaître sélectionné.

Autrement dit :

> contexte de navigation ≠ sélection visuelle.

Ne pas casser :

- développement/repli des dossiers ;
- conservation du document visible dans son dossier ;
- ordre Manuel/Alphabétique ;
- navigation entre vues ;
- sélection d’un document depuis Non classés.

---

# 2 — Modèle de sélection pour les commandes

Introduire ou clarifier un état de **cible courante** utilisable par :

- menu contextuel ;
- menu Édition ;
- renommage ;
- mise à la corbeille ;
- suppression de dossier.

Le modèle doit distinguer au minimum :

- document sélectionné ;
- dossier sélectionné ;
- aucune sélection exploitable.

Éviter de dupliquer plusieurs sources de vérité contradictoires.

Le document ouvert dans l’éditeur et la sélection de l’explorateur restent généralement alignés, mais la logique de commande doit être explicite.

---

# 3 — Clic droit sur un document

Ajouter un menu contextuel sur les documents de l’explorateur.

## Document actif

Proposer :

- `Renommer`
- `Mettre à la corbeille`

### Renommer

Réutiliser le champ titre existant.

Au choix de `Renommer` :

- donner le focus au champ titre ;
- sélectionner le titre actuel pour permettre une saisie immédiate ;
- ne pas créer un second éditeur inline dans l’arbre ;
- conserver le mécanisme normal de dirty/autosave.

Si le document est `Sans titre` / titre automatique selon le comportement actuel, rester cohérent avec la logique existante du champ titre.

### Mettre à la corbeille

Réutiliser strictement le mécanisme actuel de mise à la corbeille.

Ne pas créer une deuxième implémentation de suppression documentaire.

Le document permanent TODO reste protégé comme aujourd’hui.

---

# 4 — Clic droit sur un dossier

Le menu contextuel dossier existe déjà avec :

- `Renommer`

L’étendre avec :

- `Supprimer`

## Suppression autorisée uniquement si le dossier est vide

Un dossier est considéré vide s’il ne contient :

- aucun document actif ;
- aucun sous-dossier.

Ne pas supprimer un dossier non vide.

### Si dossier non vide

Refuser l’opération avec un message simple :

`Le dossier doit être vide avant d’être supprimé.`

ou formulation équivalente claire.

Ne déplacer automatiquement :

- aucun document vers Non classés ;
- aucun sous-dossier ;
- rien vers la Corbeille.

### Si dossier vide

Demander confirmation avant suppression définitive :

Titre possible :

`Supprimer le dossier`

Message :

`Supprimer définitivement le dossier « <nom> » ?`

Puis supprimer physiquement la ligne dans `folders`.

Il n’y a volontairement :

- aucune corbeille de dossiers ;
- aucune restauration ;
- aucun `deleted_at` dossier ;
- aucune migration de schéma.

Un dossier vide supprimé est perdu définitivement : c’est la décision produit retenue.

---

# 5 — Vérification côté base : défense en profondeur légère

Ne pas se contenter d’une vérification UI.

Ajouter une méthode DB dédiée de suppression d’un dossier vide, par exemple :

`deleteEmptyFolder(id)`

ou nom équivalent.

La couche DB doit elle-même vérifier juste avant le `DELETE` :

- existence du dossier ;
- absence de sous-dossier `parent_id = id` ;
- absence de document actif lié au dossier.

Concernant les documents déjà en Corbeille :

- ils restent des documents réels rattachés au dossier ;
- donc, par simplicité et sécurité, **un dossier contenant même un document en Corbeille est considéré non vide** tant que ce document référence encore ce dossier.

Ainsi, aucune suppression de dossier ne laisse un `folder_id` orphelin.

Ne pas activer de cascade ni de clés étrangères nouvelles.

---

# 6 — Menu natif « Édition »

Ajouter un menu de niveau supérieur :

`Édition`

Il doit contenir au minimum :

- `Renommer`
- une action destructive adaptée à la cible :
  - document → `Mettre à la corbeille`
  - dossier → `Supprimer`

Deux approches acceptables :

### Option A — libellé dynamique

Le menu affiche selon la cible :

- `Mettre à la corbeille`
- ou `Supprimer le dossier`

### Option B — deux entrées fixes

- `Mettre à la corbeille`
- `Supprimer le dossier`

avec activation/désactivation selon la cible.

Choisir la solution la plus claire et la moins fragile.

## Renommer via menu Édition

Si la cible est :

- document → focus + sélection du champ titre ;
- dossier → déclencher le même renommage inline que le double clic / clic droit actuel.

Si aucune cible exploitable :

- désactiver les actions correspondantes.

Le menu doit se rafraîchir lorsque la sélection change.

---

# 7 — Raccourcis clavier

Ne pas ajouter automatiquement de nouveaux raccourcis sauf si un choix simple et non conflictuel est évident.

Cette mission demande d’abord la cohérence fonctionnelle.

Si Codex choisit d’ajouter un raccourci pour Renommer, il doit utiliser une convention Windows standard et vérifier les conflits existants. Sinon, laisser sans raccourci et le signaler dans le rapport.

Ne pas ajouter `Delete` comme suppression directe sans demande explicite : ce serait trop facile à déclencher accidentellement.

---

# 8 — Corbeille documentaire existante

Conserver le fonctionnement actuel :

- document actif → `Mettre à la corbeille` ;
- document supprimé → `Restaurer` ;
- `Vider la corbeille` → suppression physique des documents déjà en corbeille.

Le bouton `Corbeille` dans l’éditeur reste présent et inchangé.

Les nouveaux accès par menu contextuel et menu Édition doivent réutiliser la même logique.

---

# 9 — Documents déjà dans la Corbeille

Dans la vue Corbeille, le clic droit sur un document supprimé doit être cohérent avec son état.

Proposer au minimum :

- `Restaurer`

Ne pas proposer `Mettre à la corbeille` puisqu’il y est déjà.

L’ajout d’une action `Supprimer définitivement` document par document est **hors périmètre de 057** ; le vidage global de la Corbeille existe déjà.

Le menu Édition peut rester limité aux actions pertinentes actuelles.

---

# 10 — Renommage dossier : réutiliser l’existant

Le renommage dossier existe déjà :

- double clic ;
- clic droit → `Renommer`.

Le menu Édition doit appeler **le même mécanisme**.

Ne pas dupliquer la logique de saisie/validation du nom.

---

# 11 — Renommage document : comportement attendu

Le document n’a pas besoin d’un renommage inline dans l’arbre.

`Renommer` signifie :

1. conserver le document sélectionné ;
2. focus sur le champ titre de l’éditeur ;
3. sélectionner le texte du titre ;
4. la saisie passe par le mécanisme normal existant ;
5. autosave normal.

Ne pas modifier directement la DB depuis l’action Renommer.

---

# 12 — Messages de confirmation / erreurs

## Dossier vide

Confirmation obligatoire avant suppression définitive.

## Dossier non vide

Pas de confirmation destructive : afficher simplement le refus.

## Document vers Corbeille

Conserver le mécanisme actuel de confirmation s’il existe déjà.

Réutiliser les dialogues renderer existants plutôt que des `window.confirm()` natifs improvisés.

---

# 13 — Schéma / migrations

**Aucun changement de schéma SQLite.**

Ne pas :

- incrémenter `CURRENT_SCHEMA_VERSION` ;
- modifier `db/schema.sql` sauf correction documentaire réellement nécessaire ;
- ajouter `deleted_at` aux dossiers ;
- créer de table de corbeille ;
- ajouter de cascade.

La suppression d’un dossier vide doit fonctionner avec le schéma 5 actuel.

---

# 14 — Tests ciblés

Ajouter ou adapter les contrôles utiles.

Couvrir au minimum :

## Sélection

1. clic dossier → dossier seul visuellement sélectionné ;
2. clic document dans ce dossier → document seul visuellement sélectionné ;
3. contexte du dossier toujours utilisable pour l’arbre/navigation.

## Document

4. clic droit document → `Renommer` + `Mettre à la corbeille` ;
5. Renommer → focus + sélection du champ titre ;
6. Corbeille → utilise le flux existant et le document apparaît dans Corbeille ;
7. TODO protégé.

## Dossier

8. clic droit dossier → `Renommer` + `Supprimer` ;
9. suppression dossier vide après confirmation → ligne réellement supprimée ;
10. dossier contenant document actif → refus ;
11. dossier contenant document en Corbeille → refus ;
12. dossier contenant sous-dossier → refus ;
13. suppression d’un sous-dossier vide → OK ;
14. aucun `folder_id` orphelin après suppression.

## Menu Édition

15. document sélectionné → actions document correctes ;
16. dossier sélectionné → actions dossier correctes ;
17. aucune cible → actions désactivées ;
18. Renommer via menu appelle bien le même comportement que les menus contextuels.

## Régressions voisines

19. double clic dossier → renommage toujours OK ;
20. clic droit dossier → renommage toujours OK ;
21. bouton Corbeille de l’éditeur toujours OK ;
22. Vider la corbeille toujours OK ;
23. ordre Manuel/Alphabétique inchangé.

Tests proportionnés : pas besoin de rejouer toutes les suites recherche/catalogue si ces domaines ne sont pas touchés.

---

# 15 — Recette humaine demandée

Proposer une recette courte à David :

1. sélectionner un dossier puis un document dedans et vérifier que seul le document garde le liseré de sélection ;
2. clic droit document → Renommer → taper un nouveau titre ;
3. clic droit document → Mettre à la corbeille ;
4. restaurer le document depuis la Corbeille ;
5. créer un dossier vide, clic droit → Supprimer → confirmer ;
6. créer un dossier contenant un document et vérifier que Supprimer refuse ;
7. créer un dossier contenant un sous-dossier et vérifier le refus ;
8. tester `Édition → Renommer` sur document puis sur dossier ;
9. tester l’action destructive du menu Édition selon la cible.

---

# 16 — Rapport

Créer :

`reports/057_Selection_actions_Edition_et_suppression_dossiers_vides_report.md`

Le rapport doit préciser :

- cause de la double sélection visuelle ;
- modèle de sélection retenu ;
- architecture des commandes communes ;
- comportement clic droit document ;
- comportement clic droit dossier ;
- menu Édition ;
- règle exacte de vacuité d’un dossier ;
- méthode DB de suppression ;
- tests exécutés / non exécutés ;
- recette humaine ;
- verdict GO / PARTIEL / NO-GO.

Publier code/tests/rapport sur `origin/main`.

Vérifier :

- `git diff --check` ;
- SHA distant ;
- worktree propre/synchronisé.

**S’arrêter après 057. Conserver la version 0.1.29. Ne fabriquer aucun Setup.**
