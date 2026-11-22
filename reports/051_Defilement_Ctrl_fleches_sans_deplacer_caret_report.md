# Rapport 051 — Ctrl+↑ / Ctrl+↓ dans l’éditeur

**GO pour la recette humaine.** Sur CODEX_VM, Ctrl+↑ et Ctrl+↓ déplacent la zone visible d’environ une ligne par pression. Le point d’édition peut ainsi rester hors écran pendant la lecture. Le focus, les bornes et le sens de la sélection sont conservés.

## Geste et mémoire d’édition

Dans `src/components/EditorPane.tsx`, le gestionnaire de Tab reconnaît désormais les deux flèches verticales avec Ctrl seul. Il appelle `preventDefault()`, lit le `line-height` calculé du textarea et soustrait ou ajoute cette hauteur à `scrollTop`. Chromium applique les limites du défilement en haut et en bas. Chaque répétition clavier passe par le même gestionnaire.

La commande porte uniquement sur le textarea principal. Elle laisse les événements des autres combinaisons suivre leur traitement habituel. Elle n’appelle ni le setter de sélection ni le gestionnaire de modification du texte. La mémoire 046–047 capture la nouvelle zone visible en quittant le document ou en fermant la fenêtre.

## Recette Electron sous Windows

`scripts/electron-editor-position-check.cjs` exerce le vrai renderer avec deux bibliothèques fictives et des textes de 600 lignes. Un observateur SQLite en lecture seule suit la bibliothèque active pendant la recette clavier.

| Parcours | Résultat |
| --- | --- |
| Ctrl+↓ puis Ctrl+↑ au milieu du texte | Pas CSS mesuré de 26,4 px. Le test compare le déplacement à ce pas avec une tolérance d’un pixel. Caret à 6 200, puis sélection 6 200–6 350 vers l’avant et vers l’arrière, identiques après chaque pression. Focus et défilement horizontal conservés. |
| Limites et variantes | Ctrl+↑ en haut et Ctrl+↓ en bas conservent la position. Les événements de flèches seules, avec Maj, Ctrl+Maj, Ctrl+Alt ou Ctrl+Meta restent disponibles pour le comportement natif. |
| Répétition et relance | Une pression et deux répétitions vers le bas font passer la zone visible de 3 400 à 3 478 px. À la première ouverture après fermeture normale, le test retrouve cette position et la sélection arrière 8 200–8 400. |
| Alpha → Beta → Alpha | Après trois défilements sur Alpha, le retour depuis Beta restitue la sélection arrière et le défilement relevés avant le départ. |
| Contenu et autosauvegarde | Aucun marqueur de modification après chaque raccourci. Au-delà du délai d’autosauvegarde, le contenu affiché, le contenu en base et `updated_at` correspondent aux valeurs initiales. Le `PRAGMA data_version` de la connexion témoin reste identique. |
| Édition avec Tab | L’insertion, le remplacement d’une tabulation sélectionnée, la frappe suivante et l’autosauvegarde de cette édition passent le contrôle 046–047. |

## Commandes et limites

- `npm.cmd run build` — réussi.
- `node scripts/electron-editor-position-check.cjs` — quatre sessions réussies, avec relance, texte raccourci et préférence corrompue.
- `node scripts/electron-search-navigation-check.cjs` — réussi, y compris le retour au document depuis la recherche.

La répétition est injectée dans la fenêtre Electron avec le modificateur de répétition clavier. La cadence d’un clavier physique relève de la recette humaine. Les suites générales de migrations, de recherche et de packaging n’ont pas été rejouées. La livraison comprend le gestionnaire local, l’extension du test et ce rapport. Version applicative 0.1.28, schéma SQLite 5.
