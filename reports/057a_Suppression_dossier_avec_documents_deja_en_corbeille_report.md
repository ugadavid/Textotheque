# Rapport 057a — Suppression d’un dossier dont les documents sont déjà en corbeille

**Verdict technique GO** sur CODEX_VM.

## Objectif et comportement

Un dossier est supprimable dès qu’il ne contient aucun document actif et aucun sous-dossier. S’il contient uniquement des textes déjà en corbeille, le clic droit et le menu Édition ouvrent la confirmation habituelle. Annuler conserve le dossier et ses liens. Confirmer supprime le dossier et laisse les textes dans la Corbeille. Une restauration ultérieure les fait apparaître dans **Non classés**.

## Fichiers modifiés et choix techniques

- `electron/database.ts` effectue toute l’opération dans une transaction d’écriture immédiate. Elle vérifie l’existence du dossier, cherche un enfant ou un document actif, puis met `folder_id = NULL` uniquement sur les documents du dossier dont `deleted_at IS NOT NULL`. Elle supprime ensuite le dossier. SQLite annule l’ensemble des écritures si une étape échoue.
- `src/App.tsx` applique la même règle de vacuité avant la confirmation et actualise les rattachements en mémoire après le succès en base. La restauration utilise le parcours existant.
- `scripts/electron-db-check.cjs` et `scripts/electron-explorer-order-check.cjs` adaptent les contrôles de 057.

## Vérifications effectuées et commandes lancées

| Commande | Résultat |
| --- | --- |
| `npm.cmd run build` | Compilation réussie en 0.1.29. |
| `npm.cmd run test:db` | Succès sur SQLite temporaire. Un texte actif ou un enfant bloque la suppression et préserve les rattachements. Deux textes en corbeille sont détachés ensemble, seul leur dossier change. Un texte en corbeille dans un autre dossier conserve son rattachement. Le dossier réellement vide reste supprimable. Le contrôle final des documents et dossiers orphelins passe. |
| `node scripts/electron-explorer-order-check.cjs` | Succès dans Electron. Refus avec texte actif, mise en corbeille, annulation de la suppression du dossier, confirmation, restauration et présence du titre dans « Non classés ». La nouvelle mise en corbeille et le vidage global passent également. |
| `git diff --check` | Diff vérifié. |

Un déclencheur réservé à la base fictive a forcé l’échec du DELETE final après le détachement. Le test a retrouvé le dossier et les deux documents avec tous leurs champs d’origine. Le premier lancement du script DB avait échoué au chargement à cause d’un nom de variable en double dans le test. Après correction, le test complet a réussi et nettoyé son répertoire temporaire.

## Versionnement, points non traités et limites

Version applicative **0.1.29**, schéma SQLite **5**. Aucune migration ni fabrication de Setup. Seuls les contrôles ciblés ont été exécutés, sur données fictives. Les suites générales de recherche, catalogue et distribution sont hors périmètre. Après une suppression confirmée, le classement d’origine des textes de ce dossier est perdu.

## Recette humaine proposée

1. Dans une bibliothèque fictive, créer un dossier et un texte. Essayer de supprimer le dossier et vérifier le refus.
2. Mettre le texte en corbeille. Supprimer son dossier et confirmer.
3. Ouvrir la Corbeille, restaurer le texte et le retrouver dans **Non classés**.
