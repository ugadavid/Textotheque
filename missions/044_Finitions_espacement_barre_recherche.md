# Mission 044 — Finitions visuelles de la barre de recherche

**Date :** 18 novembre 2026  
**Nature :** correction ergonomique mineure après recette humaine de la mission 043  
**Référence :** rapport `reports/043_Recherche_avancee_navigation_et_entete_report.md`, commit `69f9306c1e34e84060b32a48ee73c98dd08c5bd2`

## Constat de recette humaine

Le **fonctionnement de 043 est validé** : retour au document de départ, repli/dépli indépendant des critères et en-tête « Recherche » sans redondance. Seule la présentation de la barre supérieure est jugée trop compacte : champ de recherche étiré de façon excessive, bouton « Recherche avancée » trop proche du champ, chevron quasiment collé au bouton.

Le CSS introduit en 043 utilise `.catalog-header.search-header { gap: 6px; }`, `.advanced-search-actions { gap: 2px; }` et `.search-header .toolbar-search { flex: 1 1 145px; }`. Le test `scripts/electron-search-navigation-check.cjs` impose actuellement que le chevron soit séparé du bouton de **6 px maximum** ; cette contrainte est devenue incorrecte au vu de la recette humaine. Le but n'est pas de modifier la logique, mais de redonner de la respiration.

## Travail demandé

1. Rééquilibrer la barre de recherche de façon **sobre, compacte et aérée**. Prévoir une gouttière d'environ **10 px** entre le champ de recherche et le bouton « Recherche avancée », ainsi qu'entre ce bouton et son chevron de repli/dépli. Le titre « Recherche » et les autres contrôles doivent aussi garder une séparation harmonieuse.
2. Éviter que le champ textuel occupe toute la largeur simplement parce que le titre a été raccourci : conserver une **largeur confortable mais raisonnablement bornée** sur une fenêtre large, sans laisser un espace vide visuellement maladroit. Sur fenêtres étroites, permettre la réduction ou le retour à la ligne sans chevauchement ni disparition des commandes ; privilégier une adaptation CSS simple.
3. Garder le chevron **immédiatement adjacent en tant que commande associée** au bouton, mais physiquement distinct et respirant : ne pas le déplacer dans le panneau de critères.
4. Corriger le test ciblé introduit en 043 afin qu'il ne réclame plus artificiellement une distance maximale de 6 px. Contrôler une plage d'espacement compatible avec la nouvelle intention (environ 10 px, avec tolérance) et l'alignement vertical ; ne pas transformer ce test en oracle esthétique excessivement rigide.
5. Vérifier l'apparence en largeur habituelle et en fenêtre plus étroite sur CODEX_VM, avec **données fictives uniquement**. Le jugement esthétique final appartient au mainteneur.

## Hors périmètre

- Ne modifier ni le fonctionnement de recherche, ni le retour au document, ni la persistance des filtres, ni les raccourcis ni le modèle SQLite.
- Ne pas intégrer la mémoire du caret, le menu Affichage ou les thèmes ; ils feront l'objet de missions ultérieures.
- Aucune dépendance, migration, installation STABLE ou intervention sur Zenith Ice.
- La copie SQLite personnelle importée sur CODEX_VM est une **donnée de test locale mais personnelle** : ne pas la publier ni l'utiliser dans les tests automatisés. Employer exclusivement une bibliothèque fictive.
- Ne pas corriger les échecs historiques non liés (dont le test `ui-safeguards` qui attend encore 0.1.27), sauf impact direct nécessitant une explication.

## Vérifications et livraison

- Effectuer une revue visuelle réelle et proportionnée sur Windows, idéalement avec une capture de la barre en fenêtre standard et une capture en fenêtre réduite, toutes deux à base fictive.
- Exécuter `npm.cmd run build` et le test de navigation/recherche concerné. Documenter ce qui a été effectivement vérifié et les contrôles volontairement non rejoués.
- Rédiger `reports/044_Finitions_espacement_barre_recherche_report.md` directement dans `reports/`.
- Publier seulement les changements utiles et le rapport sur `origin/main`, quel que soit le verdict ; vérifier le SHA distant, `git diff --check` et l'état propre/synchronisé.
- **S'arrêter après cette finition pour la validation humaine**, sans entamer la mission de mémoire du caret.
