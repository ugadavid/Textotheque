# 056b — Clarification de Mes caractères et des Favoris

**GO pour la recette humaine sur CODEX_VM.** La vue d’ouverture **Mes caractères** contient les ajouts personnels en tête, puis 😂 🤣 🚀 💙 🧠 🗃️ 💝 🪄 🧶 📦 🐸, avec déduplication. Les cinq catégories conservent leurs listes. Une flèche ne rejoint Mes caractères que si David l’ajoute lui-même.

## Gestes

Le clic principal insère le glyphe. Le clic droit ouvre au pointeur une seule commande, **Ajouter aux favoris** ou **Retirer des favoris**, également disponible depuis Récents et les catégories thématiques. Le menu reprend la présentation du menu des dossiers, s’oriente vers l’intérieur de la fenêtre et se ferme après choix, clic extérieur ou Échap. Échap dans le menu laisse la palette ouverte. Le clic droit reste utilisable lorsque le document est en lecture seule ou absent.

Les boutons étoile ont été supprimés. ★ et ☆ restent des caractères insérables dans Symboles pratiques. La croix des seuls ajouts personnels retire aussi leur éventuel favori. Les onze emojis de départ restent disponibles en permanence.

## Préférences existantes

La clé de profil reste `textotheque:special-characters:v1`. Un profil neuf démarre avec Favoris vide. À la première lecture d’une ancienne préférence, une liste identique aux onze anciens favoris automatiques, dans le même ordre, est vidée. Toute liste différente est conservée, y compris un ordre personnalisé. Le stockage garde les ajouts personnels, les récents et les coordonnées de la palette. Il n’importe aucun favori ni récent dans Mes caractères.

Le marqueur `manualFavorites` distingue les choix faits après cette transition. Si David choisit ensuite les onze emojis dans l’ordre historique, cette sélection reste intacte aux ouvertures suivantes. Pour les anciennes préférences, une sélection manuelle strictement identique au défaut historique était impossible à distinguer de ce défaut.

## Contrôles

- `npm.cmd run build` a réussi en 0.1.29.
- `node scripts/electron-character-palette-check.cjs` a réussi ses trois sessions fictives. La recette couvre le profil neuf, la migration du défaut historique, la conservation d’une préférence personnalisée avec position et la recréation volontaire des onze favoris. Elle vérifie les vues, le menu aux bords de fenêtre, sa fermeture et un clic droit suivi d’Échap envoyé à la fenêtre Electron.
- L’insertion et le remplacement de sélection, le focus, l’autosave, les douze récents, les deux thèmes, le déplacement, la restauration de position et Ctrl+Shift+U ont passé les contrôles ciblés. Les commandes contextuelles conservent le texte et le caret.
- Le moteur d’insertion et les raccourcis de l’éditeur sont inchangés. La suite voisine de positions et les suites générales DB, recherche et catalogue n’ont pas été rejouées. Aucun Setup fabriqué.

## Recette de David

1. Ouvrir la palette avec Ctrl+Shift+U. Vérifier les onze emojis et les ajouts personnels, puis retrouver les guillemets dans Typographie.
2. Faire un clic droit sur 🐸 et choisir **Ajouter aux favoris**. Dans Favoris, le retirer par clic droit. Revenir à Mes caractères pour le retrouver.
3. Ajouter 🦊 et vérifier qu’il apparaît dans Mes caractères. Le placer dans Favoris seulement si souhaité.
4. Sélectionner un mot dans un texte fictif, déplacer la palette, faire un clic droit sur 🦊 puis Échap. Cliquer normalement sur 🦊 pour remplacer le mot et poursuivre la frappe.
