# Mission 056a — Affinage ergonomique de la palette de caractères spéciaux

**Date :** 22 novembre 2026  
**Nature :** correction ergonomique ciblée après recette humaine de 056.  
**Version :** conserver **0.1.29**. Aucun changement de version ni Setup.

## Contexte

La mission 056 est techniquement validée :

- ouverture depuis `Outils → Caractères spéciaux…` ;
- insertion exacte au caret ;
- remplacement de sélection ;
- focus/caret restaurés ;
- autosave normal ;
- favoris, récents et caractères personnels persistants ;
- validation d’un graphe Unicode unique ;
- aucun changement SQLite.

La recette humaine de David révèle cependant cinq ajustements d’ergonomie :

1. `Mes caractères` et `Favoris` sont trop séparés conceptuellement ;
2. `Favoris` doit être un vrai sous-ensemble choisi parmi les caractères disponibles ;
3. la palette doit pouvoir être déplacée ;
4. le bouton `Organiser` est ambigu ;
5. il faut un raccourci clavier pour ouvrir/fermer la palette.

Cette mission **préserve le moteur d’insertion de 056** et ne le réécrit pas.

---

# 1 — Nouveau modèle mental

Le modèle devient :

- **Mes caractères** = vue principale de tous les caractères disponibles pour David ;
- **Favoris** = sous-ensemble des caractères de `Mes caractères` qu’il utilise très souvent ;
- **Récents** = historique court des insertions via la palette ;
- catégories thématiques = vues de filtrage pratiques, pas collections indépendantes.

## Mes caractères

`Mes caractères` doit rassembler :

- les caractères initiaux livrés par Textothèque ;
- les caractères ajoutés manuellement par David.

Autrement dit, un caractère ajouté via `Ajouter un caractère…` n’est plus une curiosité dans une collection séparée : il rejoint simplement **Mes caractères**.

Les catégories `Typographie`, `Flèches`, `Symboles pratiques`, `Marqueurs visuels`, `Maths / technique` restent disponibles comme filtres spécialisés.

Les onze emoji initiaux de 056 font également partie de `Mes caractères`.

Éviter les doublons dans cette vue agrégée.

---

# 2 — Favoris explicites

`Favoris` est une sélection rapide parmi les caractères déjà disponibles dans `Mes caractères`.

Conserver les onze favoris initiaux actuels au premier lancement :

`😂 🤣 🚀 💙 🧠 🗃️ 💝 🪄 🧶 📦 🐸`

mais permettre ensuite à David de les modifier.

## Interaction

Supprimer le mode `Organiser`.

À la place, chaque tuile de caractère doit proposer une action de favori **explicite et compréhensible**, par exemple :

- petite étoile ☆ / ★ ;
- ou autre contrôle visuel équivalent clairement identifiable.

Règles :

- clic principal sur le caractère = insertion ;
- clic sur l’étoile = ajout/retrait des Favoris ;
- retirer un caractère des Favoris ne le retire jamais de `Mes caractères` ;
- dans la vue Favoris, retirer l’étoile peut naturellement faire disparaître la tuile de cette vue, mais l’action doit être visuellement compréhensible car elle vient du contrôle étoile, pas du clic principal sur le caractère.

Ne pas réintroduire un mode global `Organiser / Terminer`.

---

# 3 — Ajout d’un caractère

Conserver la validation grapheme de 056.

`Ajouter un caractère…` doit :

- ajouter le caractère à la collection personnelle persistée ;
- le faire apparaître immédiatement dans **Mes caractères** ;
- ne pas l’ajouter automatiquement aux Favoris.

Après ajout, rester si possible dans `Mes caractères` afin que David voie immédiatement le résultat.

Un doublon exact ne doit pas créer une seconde tuile.

---

# 4 — Suppression d’un caractère personnel

Seuls les caractères ajoutés manuellement par David peuvent être supprimés de la collection personnelle.

Les caractères initiaux livrés par Textothèque restent disponibles.

La suppression d’un caractère personnel :

- le retire de `Mes caractères` s’il n’existe dans aucune catégorie initiale ;
- le retire aussi des Favoris ;
- ne modifie évidemment jamais les documents où il a déjà été inséré.

Présenter l’action de suppression de façon explicite, idéalement via un petit `×` ou une corbeille visible uniquement pour les caractères personnels.

Ne pas confondre suppression et gestion des Favoris.

---

# 5 — Palette déplaçable

La palette est actuellement fixée en haut à droite. David veut pouvoir la déplacer.

Rendre le panneau **déplaçable par glisser-déposer de son en-tête**.

## Comportement attendu

- clic-glissé sur l’en-tête `Caractères spéciaux` déplace la palette ;
- les boutons et contrôles de l’en-tête restent cliquables normalement ;
- la palette ne doit pas pouvoir être perdue totalement hors de la fenêtre ;
- conserver au minimum une zone suffisante de l’en-tête visible ;
- lors d’un redimensionnement de la fenêtre, recaler la palette si sa position devient inaccessible.

## Persistance

Mémoriser la dernière position de la palette dans le profil renderer afin de la retrouver après relance.

Utiliser une clé versionnée claire ou étendre proprement la préférence de palette existante.

La position appartient au profil Textothèque, pas à la bibliothèque SQLite.

Ne pas ajouter de dépendance de drag-and-drop.

---

# 6 — Raccourci clavier

Ajouter au menu natif :

`Outils → Caractères spéciaux…`

l’accélérateur :

`Ctrl+Shift+U`

Sur Electron, utiliser le pattern portable :

`CommandOrControl+Shift+U`

Ce raccourci est actuellement libre dans Textothèque ; `CommandOrControl+Shift+T` est déjà utilisé par le TODO.

Le raccourci doit :

- ouvrir la palette si elle est fermée ;
- la fermer si elle est ouverte ;
- produire exactement le même comportement que le menu natif.

Afficher le raccourci naturellement dans le menu Windows via `accelerator`.

Ne pas implémenter un second listener clavier renderer si le menu natif Electron suffit.

---

# 7 — Catégorie par défaut

À l’ouverture de la palette, afficher **Mes caractères** par défaut plutôt que Favoris.

Raison : cette vue devient la bibliothèque personnelle complète de David.

Conserver la dernière catégorie sélectionnée pendant la session si cela tombe naturellement de l’implémentation, mais ne pas ajouter une persistance supplémentaire juste pour cela sauf si déjà simple.

---

# 8 — Récents

Conserver le comportement actuel :

- maximum 12 ;
- distincts ;
- plus récent en tête ;
- uniquement les insertions via la palette.

Aucun changement fonctionnel demandé ici.

---

# 9 — Insertion / caret : invariant strict

Ne pas réécrire le moteur validé en 056.

Doivent rester vrais :

- insertion au caret ;
- remplacement exact de sélection ;
- caret après le graphe ;
- focus rendu à l’éditeur ;
- autosave normal ;
- aucune insertion dans un document non éditable ;
- Tab inchangé ;
- Ctrl+↑ / Ctrl+↓ inchangé ;
- mémoire caret/sélection inchangée.

Le déplacement de la palette et les contrôles étoile/suppression ne doivent pas perturber la dernière sélection valide de l’éditeur.

---

# 10 — Persistance et compatibilité avec les préférences 056

La clé actuelle est :

`textotheque:special-characters:v1`

Préserver les données déjà créées pendant 056.

Un profil qui contient déjà :

- `favorites`
- `personal`
- `recent`

doit continuer à fonctionner sans perte.

Si la position de la palette exige un nouveau champ, préférer une évolution rétrocompatible du JSON existant si cela reste propre.

Ne pas casser les favoris/personnels/récents existants juste pour changer l’UI.

---

# 11 — Apparence

Conserver l’esthétique actuelle générale : elle est validée.

Ajuster seulement ce qui est nécessaire pour :

- poignée de déplacement via l’en-tête ;
- étoile favori ;
- suppression des caractères personnels ;
- disparition du bouton `Organiser`.

La palette doit rester compacte en thème clair et sombre.

Ne pas agrandir fortement le panneau.

---

# 12 — Tests ciblés

Adapter `scripts/electron-character-palette-check.cjs` plutôt que créer une infrastructure parallèle.

Couvrir au minimum :

1. catégorie par défaut = `Mes caractères`;
2. `Mes caractères` contient les caractères initiaux + personnels sans doublon ;
3. ajout manuel → apparaît dans `Mes caractères`, pas automatiquement dans Favoris ;
4. étoile → ajout/retrait Favoris ;
5. retrait Favoris ne supprime pas le caractère ;
6. suppression personnelle retire le caractère personnel et son éventuel favori ;
7. disparition de `Organiser`;
8. déplacement par en-tête ;
9. palette reste récupérable dans les limites de la fenêtre ;
10. position persistée après relance ;
11. `CommandOrControl+Shift+U` ouvre/ferme la palette ;
12. menu `Outils` affiche l’accélérateur ;
13. insertion/caret/autosave de 056 toujours valides ;
14. préférence 056 existante relue sans perte ;
15. thème clair/sombre toujours lisible.

Rejouer aussi le contrôle ciblé de positions éditeur si nécessaire pour prouver l’absence de régression.

Pas de suites DB/search/catalogue générales.

---

# 13 — Recette humaine

Proposer une recette courte à David :

1. ouvrir la palette avec `Ctrl+Shift+U` ;
2. vérifier qu’elle s’ouvre sur `Mes caractères` ;
3. la déplacer à gauche puis ailleurs ;
4. fermer/réouvrir Textothèque et vérifier sa position ;
5. ajouter `🦊` ;
6. vérifier qu’il apparaît dans `Mes caractères` mais pas dans Favoris ;
7. cliquer sur son étoile et le retrouver dans Favoris ;
8. retirer l’étoile depuis Favoris et vérifier qu’il reste dans Mes caractères ;
9. supprimer `🦊` de la collection personnelle ;
10. vérifier rapidement une insertion au caret et un remplacement de sélection.

---

# 14 — Rapport

Créer :

`reports/056a_Affinage_palette_caracteres_speciaux_report.md`

Le rapport doit préciser :

- nouveau modèle `Mes caractères / Favoris` ;
- interaction retenue pour les Favoris ;
- comportement de suppression ;
- mécanisme de déplacement ;
- persistance de position ;
- raccourci ajouté ;
- compatibilité avec les préférences 056 ;
- tests exécutés / non exécutés ;
- recette humaine ;
- verdict GO / PARTIEL / NO-GO.

Publier code/tests/rapport sur `origin/main`.

Vérifier :

- `git diff --check` ;
- SHA distant ;
- worktree propre/synchronisé.

**S’arrêter après 056a. Conserver la version 0.1.29. Ne fabriquer aucun Setup.**
