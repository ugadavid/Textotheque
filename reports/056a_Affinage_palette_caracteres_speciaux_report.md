# 056a — Affinage de la palette de caractères spéciaux

**GO pour la recette humaine sur CODEX_VM.** À chaque ouverture, **Mes caractères** présente les ajouts personnels puis les onze emojis de départ et les caractères des cinq catégories. Chaque graphème apparaît une seule fois. Un ajout apparaît en tête de la liste et conserve son statut de favori antérieur, s’il en avait un.

## Gestes et préférences

- Le clic sur le glyphe insère le caractère. L’étoile voisine ajoute ou retire le favori, même sans document éditable. La croix, dans **Mes caractères**, supprime uniquement un ajout personnel et son éventuel favori. Un glyphe livré d’origine reste disponible. Les récents conservent l’historique des insertions.
- **Ctrl+Shift+U** et **Outils → Caractères spéciaux…** utilisent la même action native Electron. La palette utilise toujours le moteur d’insertion de 056. Le mode Organiser a été retiré.
- Le glisser commence sur l’en-tête, en dehors du bouton de fermeture. La position est bornée aux dimensions du panneau et de la fenêtre, puis enregistrée au relâchement. Un changement de taille recale le panneau affiché. La grille défile à l’intérieur de la palette.
- La préférence de profil `textotheque:special-characters:v1` conserve `favorites`, `personal` et `recent`. Le champ facultatif `position` contient les coordonnées en pixels CSS. Sans position, l’ouverture se fait en haut à droite. Un ancien favori personnel conservé uniquement dans les favoris est réintégré à la collection pour rester accessible après retrait de son étoile.

## Vérifications

`npm.cmd run build` a réussi en 0.1.29. Le contrôle existant `node scripts/electron-character-palette-check.cjs` a été adapté et a réussi sur trois sessions Electron fictives. Il vérifie le raccourci dans les deux sens, la vue initiale, une préférence de 056 préremplie, les étoiles, la suppression, la déduplication, le glisser par l’en-tête, le recalage sur une fenêtre réduite et la position à la relance. Il couvre aussi les thèmes, l’insertion d’un emoji composé, le remplacement de sélection, le retour du focus, l’autosave, les récents et les cas non éditables.

Le contrôle voisin `node scripts/electron-editor-position-check.cjs` a manqué un défilement Ctrl+↓ lors d’un premier passage enchaîné. Rejoué isolément sans changement de code, il a réussi ses quatre phases, dont Tab, Ctrl+flèches et le retour à une sélection après relance. La cause de cet écart ponctuel n’a pas été établie.

Les suites générales DB, recherche et catalogue sont hors de cette recette ciblée. Aucun changement SQLite, de version ou de dépendance. Aucun Setup fabriqué.

## Recette de David

1. Dans un texte fictif, ouvrir avec **Ctrl+Shift+U**. Depuis **Mes caractères**, déplacer la palette vers la gauche par son titre. Fermer puis relancer Textothèque et vérifier l’emplacement.
2. Ajouter 🦊. Vérifier sa présence dans **Mes caractères**, puis cliquer sur son étoile. Dans **Favoris**, retirer l’étoile et retrouver 🦊 dans **Mes caractères**.
3. Placer le caret au milieu d’une phrase et insérer 🦊. Sélectionner un mot, déplacer la palette et cliquer sur 🧠. Vérifier le remplacement et poursuivre la frappe.
4. Supprimer 🦊 avec sa croix et vérifier que le texte déjà écrit est conservé. Refermer la palette au clavier.
