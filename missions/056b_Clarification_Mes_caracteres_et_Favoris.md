# Mission 056b — Clarification de « Mes caractères » et des Favoris

**Date :** 22 novembre 2026  
**Nature :** correction ergonomique ciblée après recette humaine de 056a.  
**Version :** conserver **0.1.29**. Aucun changement de version. Aucun Setup.

## Contexte

056 et 056a ont validé le socle technique de la palette :

- ouverture via `Outils → Caractères spéciaux…` ;
- raccourci `Ctrl+Shift+U` ;
- palette déplaçable avec position persistée ;
- insertion exacte au caret ;
- remplacement de sélection ;
- focus/caret restaurés ;
- autosave normal ;
- récents persistants ;
- ajout de graphèmes Unicode ;
- aucune mutation SQLite.

La recette humaine de David montre cependant que le modèle `Mes caractères / Favoris` reste trop chargé.

Le problème exact :

1. `Mes caractères` ne doit **pas** agréger toutes les catégories thématiques ;
2. les étoiles visibles sur chaque tuile rendent la palette illisible ;
3. les Favoris doivent être une sélection explicite gérée par une action contextuelle.

Le déplacement, le raccourci et le moteur d’insertion sont validés et doivent rester inchangés.

---

# 1 — Définition exacte de « Mes caractères »

`Mes caractères` doit contenir **uniquement** :

## Caractères initiaux personnels

`😂 🤣 🚀 💙 🧠 🗃️ 💝 🪄 🧶 📦 🐸`

## Plus

les caractères ajoutés manuellement par David via :

`Ajouter un caractère…`

C’est tout.

Ne pas y injecter automatiquement :

- Typographie ;
- Flèches ;
- Symboles pratiques ;
- Marqueurs visuels ;
- Maths / technique ;
- Récents ;
- Favoris.

Ces vues restent séparées dans la liste des catégories.

Un caractère peut évidemment apparaître dans `Mes caractères` et aussi dans `Favoris` si David le choisit comme favori.

---

# 2 — Catégories thématiques inchangées

Conserver comme vues distinctes :

- `Typographie`
- `Flèches`
- `Symboles pratiques`
- `Marqueurs visuels`
- `Maths / technique`

avec exactement les listes déjà livrées.

Leur rôle est de permettre de retrouver facilement un symbole sans surcharger `Mes caractères`.

Ne pas fusionner ces catégories.

---

# 3 — Favoris : liste manuelle

`Favoris` devient un vrai raccourci personnel.

## Nouveau comportement par défaut

Pour un profil neuf de cette fonctionnalité :

`Favoris = liste vide`

Les onze emoji initiaux appartiennent à `Mes caractères`, **pas automatiquement aux Favoris**.

David décide lui-même ce qui mérite le statut de favori.

---

# 4 — Suppression complète des étoiles visibles

Retirer les boutons ☆ / ★ de toutes les tuiles.

Le clic principal sur un glyphe retrouve donc une fonction unique et évidente :

> insérer le caractère.

La grille doit redevenir lisible et compacte.

Supprimer le CSS spécifique aux étoiles devenu inutile.

---

# 5 — Gestion des Favoris au clic droit

Sur **n’importe quel caractère affiché** dans :

- Mes caractères ;
- une catégorie thématique ;
- Récents ;
- Favoris ;

un clic droit doit ouvrir un petit menu contextuel renderer, cohérent avec celui déjà utilisé ailleurs dans Textothèque si pertinent.

## Si le caractère n’est pas favori

Proposer :

`Ajouter aux favoris`

## Si le caractère est déjà favori

Proposer :

`Retirer des favoris`

L’action doit être explicite et immédiate.

### Dans la vue Favoris

Après `Retirer des favoris`, la tuile disparaît naturellement de cette vue.

### Dans les autres vues

Le caractère reste à sa place ; seul son statut de favori change.

Ne pas afficher d’étoile permanente ni de badge sur les tuiles.

---

# 6 — Menu contextuel : comportement

Le menu doit :

- apparaître au point du clic droit ;
- rester dans les limites visibles de la fenêtre ;
- se fermer après choix ;
- se fermer sur clic extérieur ;
- se fermer sur Échap ;
- ne pas déclencher l’insertion du caractère ;
- ne pas perturber la dernière sélection/caret de l’éditeur.

Réutiliser si possible les patterns CSS/ergonomiques des menus contextuels renderer déjà présents, notamment le renommage de dossier, sans créer une infrastructure disproportionnée.

---

# 7 — Ajout d’un caractère personnel

Conserver la validation grapheme de 056.

Après `Ajouter un caractère…` :

- le caractère apparaît dans `Mes caractères` ;
- il n’est **pas** automatiquement favori ;
- il n’est pas ajouté à une catégorie thématique ;
- il reste dédupliqué.

Conserver la possibilité de supprimer un caractère personnel depuis `Mes caractères`.

La suppression :

- retire ce caractère de la collection personnelle ;
- le retire aussi des Favoris s’il y figurait ;
- ne touche jamais aux documents existants.

Les onze caractères initiaux personnels ne sont pas supprimables.

---

# 8 — Transition depuis les préférences 056 / 056a

La préférence actuelle est :

`textotheque:special-characters:v1`

Elle contient notamment :

- `favorites`
- `personal`
- `recent`
- éventuellement `position`

Préserver :

- les caractères personnels ajoutés ;
- les récents ;
- la position de palette ;
- les favoris réellement personnalisés lorsque cela est raisonnablement identifiable.

## Cas particulier des onze anciens favoris par défaut

056 avait initialisé automatiquement :

`😂 🤣 🚀 💙 🧠 🗃️ 💝 🪄 🧶 📦 🐸`

dans `favorites`.

Cette décision est maintenant abandonnée.

La migration/lecture doit éviter de faire passer ces onze valeurs automatiques pour une sélection personnelle.

Approche attendue :

- pour un stockage absent → nouveaux Favoris vides ;
- si la liste `favorites` existante correspond exactement à l’ancien jeu automatique des onze valeurs, la considérer comme ancien défaut et repartir avec Favoris vides ;
- si elle diffère de cet ancien défaut, préserver les choix présents autant que possible.

Ne pas effacer `personal`, `recent` ou `position`.

Si une stratégie différente est nécessaire pour éviter une perte réelle, la documenter clairement dans le rapport.

---

# 9 — Catégorie initiale

Conserver :

`Mes caractères`

comme vue par défaut à l’ouverture de la palette.

Elle doit donc afficher une petite collection claire :

- les onze emoji initiaux ;
- puis les ajouts personnels.

Choisir un ordre stable et naturel.

Les ajouts personnels peuvent rester en tête s’il s’agit du comportement actuel validé, tant que les onze initiaux restent visibles et qu’il n’y a aucun mélange automatique avec les autres catégories.

---

# 10 — Invariants validés en 056a

Ne pas modifier sauf nécessité directe :

- déplacement par l’en-tête ;
- bornage de position ;
- persistance de position ;
- `Ctrl+Shift+U` ;
- ouverture/fermeture via menu natif ;
- fermeture par croix / Échap ;
- liste Récents limitée à 12 ;
- validation par `Intl.Segmenter` ;
- insertion au caret ;
- remplacement de sélection ;
- focus rendu à l’éditeur ;
- caret après graphe ;
- dirty/autosave normal ;
- thème clair/sombre ;
- absence de stockage SQLite.

---

# 11 — Tests ciblés

Adapter le contrôle existant :

`scripts/electron-character-palette-check.cjs`

Couvrir au minimum :

1. `Mes caractères` contient uniquement les onze initiaux + ajouts personnels ;
2. les caractères Typographie/Flèches/etc. n’apparaissent plus automatiquement dans `Mes caractères` ;
3. profil neuf → Favoris vide ;
4. absence complète des boutons étoile ;
5. clic droit sur caractère non favori → `Ajouter aux favoris` ;
6. ajout → caractère visible dans Favoris ;
7. clic droit sur caractère favori → `Retirer des favoris` ;
8. retrait depuis Favoris → disparition de cette vue mais conservation dans sa collection d’origine ;
9. clic droit ne déclenche aucune insertion ;
10. menu contextuel fermé sur choix / clic extérieur / Échap ;
11. ancien stockage avec exactement les onze favoris 056 → Favoris vide après lecture/migration ;
12. stockage personnalisé différent → données utiles préservées ;
13. `personal`, `recent`, `position` préservés ;
14. ajout manuel → Mes caractères uniquement, pas Favoris ;
15. déplacement et `Ctrl+Shift+U` toujours fonctionnels ;
16. insertion/caret/autosave toujours fonctionnels.

Rejouer le contrôle voisin des positions éditeur uniquement si nécessaire pour couvrir une modification du moteur d’insertion. Si ce moteur reste inchangé, le rapport peut justifier son non-rejeu.

Pas de suites DB/recherche/catalogue générales.

---

# 12 — Recette humaine

Proposer à David :

1. ouvrir avec `Ctrl+Shift+U` ;
2. vérifier que `Mes caractères` affiche seulement `😂 🤣 🚀 💙 🧠 🗃️ 💝 🪄 🧶 📦 🐸` plus ses éventuels ajouts personnels ;
3. vérifier que Typographie reste une catégorie séparée ;
4. constater qu’aucune étoile n’encombre les tuiles ;
5. clic droit sur `🐸` → `Ajouter aux favoris` ;
6. ouvrir Favoris et retrouver `🐸` ;
7. clic droit sur `🐸` → `Retirer des favoris` ;
8. revenir dans Mes caractères et vérifier que `🐸` est toujours là ;
9. ajouter `🦊`, puis éventuellement le mettre en Favoris par clic droit ;
10. déplacer la palette et vérifier une insertion au caret.

---

# 13 — Rapport

Créer :

`reports/056b_Clarification_Mes_caracteres_et_Favoris_report.md`

Le rapport doit préciser :

- contenu exact de `Mes caractères` ;
- nouveau défaut des Favoris ;
- interaction clic droit retenue ;
- suppression des étoiles ;
- stratégie de compatibilité avec le stockage 056/056a ;
- tests exécutés / non exécutés ;
- recette humaine ;
- verdict GO / PARTIEL / NO-GO.

Publier code/tests/rapport sur `origin/main`.

Vérifier :

- `git diff --check` ;
- SHA distant ;
- worktree propre/synchronisé.

**S’arrêter après 056b. Conserver la version 0.1.29. Ne fabriquer aucun Setup.**
