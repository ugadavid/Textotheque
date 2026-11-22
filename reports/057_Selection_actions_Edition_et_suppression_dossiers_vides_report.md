# Rapport 057 — Sélection exclusive, menu Édition et suppression des dossiers vides

**Verdict technique GO** sur CODEX_VM. Recette humaine à effectuer.

## Objectif et diagnostic

Dans l’explorateur, le document ouvert et son dossier parent pouvaient tous deux porter le liseré. Le dossier tirait son état visuel du contexte de navigation, encore nécessaire pour créer un document au bon endroit. Le document tirait le sien de l’éditeur.

## Fonctionnement et choix techniques

Le clic sur une branche cible la branche, même si son premier texte est visible dans l’éditeur. Le clic sur un document lui donne le liseré et conserve le contexte de son dossier. « Non classés » reste une branche virtuelle. Le catalogue et les résultats de recherche ne ciblent pas le document précédemment ouvert pour les commandes Édition.

Le menu contextuel agit sur l’objet cliqué. Ouvrir ce menu sur un autre dossier conserve le brouillon en cours. Renommer un document ouvre le texte si nécessaire, avec la protection des modifications en cours, puis sélectionne le contenu du champ titre existant. Le double clic, le clic droit et Édition utilisent le même champ de renommage de dossier.

Le menu natif **Édition** propose quatre entrées fixes. Le renderer indique la cible à Electron et traite les intentions avec les mêmes opérations que l’explorateur et les boutons de l’éditeur.

| Cible | Commandes actives |
| --- | --- |
| Document | Renommer, Mettre à la corbeille |
| TODO permanent | Renommer |
| Document en corbeille | Restaurer |
| Dossier réel | Renommer, Supprimer le dossier |
| Aucune cible | Aucune |

Au clic droit sur un dossier, **Supprimer** vérifie les listes de documents actifs et supprimés ainsi que les sous-dossiers. Un dossier occupé affiche « Le dossier doit être vide avant d’être supprimé. » Un dossier vide ouvre une confirmation qui reprend son nom. Après accord, le main process vérifie le chemin de la bibliothèque. Dans SQLite, `deleteEmptyFolder` supprime la ligne seulement si deux clauses `NOT EXISTS` garantissent, dans la même instruction, l’absence de document lié (y compris en corbeille) et de dossier enfant. Un refus conserve les relations existantes. La liste des dossiers est actualisée après réussite.

## Fichiers modifiés

- `src/App.tsx`, `src/components/NavigationPane.tsx`, `src/styles/app.css` pour la sélection, les commandes, les menus contextuels et leur affichage.
- `electron/main.ts`, `electron/preload.cts`, `src/types/electron.d.ts`, `src/types/edit-menu.d.ts` pour le menu natif et son dialogue avec le renderer.
- `src/services/documents.ts`, `electron/database.ts` pour la suppression conditionnelle.
- `scripts/electron-db-check.cjs`, `scripts/electron-explorer-order-check.cjs` pour les contrôles ciblés, ainsi que le présent rapport.

## Vérifications effectuées et commandes lancées

| Commande | Résultat sur CODEX_VM |
| --- | --- |
| `npm.cmd run build` | Compilation TypeScript, Vite et Electron réussie. |
| `npm.cmd run test:db` | Succès. Refus avec enfant, texte actif ou texte en corbeille, lien du document préservé, suppression d’un enfant vide puis de son parent, refus d’un ID disparu. Les contrôles SQL finaux d’orphelins sur les documents et les dossiers passent. Répertoire temporaire nettoyé. |
| `node scripts/electron-explorer-order-check.cjs` | Succès en fenêtre Electron sur données fictives. Liserés exclusifs, Non classés, menus natifs selon la cible, titre sélectionné sur le document cliqué, renommage inline, annulation, confirmation et disparition effective du dossier. Refus vérifié avant et après la mise en corbeille du seul texte. Restauration, bouton Corbeille, vidage global et protection du TODO vérifiés. Les scénarios d’ordre manuel, alphabétique, de relance et de préférence invalide passent. |
| `git diff --check` | Contrôle du diff effectué avant publication. |

Les vérifications automatisées ont utilisé des bibliothèques fictives temporaires. La recette couvre les interactions et les états dans Electron. Les suites complètes de recherche, catalogue et distribution n’ont pas été lancées.

## Versionnement, limites et points non traités

Version applicative **0.1.29**, schéma SQLite **5**. Aucune migration, dépendance, fabrication de Setup ou nouvelle touche de suppression. Un dossier vide supprimé est irrécupérable depuis l’application. Les critères des recherches enregistrées restent tels que l’utilisateur les a définis. Si une recherche cible un dossier supprimé, cette branche ne fournit plus de résultats.

## Recette humaine proposée à David

1. Dans une bibliothèque fictive, cliquer sur un dossier contenant un texte puis sur le texte. Vérifier le liseré unique et la branche ouverte.
2. Sur le document, choisir **Renommer** au clic droit, saisir un titre et le retrouver après sauvegarde. Essayer aussi **Édition → Renommer**.
3. Mettre ce texte en corbeille. Vérifier que la suppression de son dossier reste refusée. Dans la Corbeille, restaurer le texte au clic droit et vérifier son retour dans le dossier.
4. Sur un dossier contenant seulement un sous-dossier vide, essayer **Édition → Supprimer le dossier**. Vérifier le refus, renommer le sous-dossier depuis Édition, puis le supprimer au clic droit. Essayer d’abord **Annuler**, puis confirmer.
5. Sélectionner le parent désormais vide, le supprimer depuis **Édition**, puis vérifier les commandes disponibles en ouvrant le catalogue.

La prochaine étape est la validation humaine de 057.
