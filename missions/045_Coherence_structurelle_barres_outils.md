# Mission 045 — Rétablir la cohérence structurelle de la barre de recherche

**Date :** 18 novembre 2026  
**Décision humaine :** mission 044 techniquement GO mais **recette esthétique refusée** ; la vue normale du document est la **référence de disposition**, pas une inspiration facultative.  
**Nature :** correction ergonomique ciblée de la barre supérieure de la recherche avancée.

## Constat (captures de recette du mainteneur)

À largeur de fenêtre égale, la barre supérieure en mode document est cohérente : contrôle du volet gauche à gauche ; titre ; champ de recherche intégré ; commande « Recherche avancée » ; commandes contextuelles ; **bouton de repli des métadonnées fixé près du bord droit du panneau central**.

Après 043/044, la barre de recherche affiche les boutons les uns à la suite des autres, parfois sur plusieurs lignes même quand l'espace est disponible ; le compteur puis le bouton de repli des métadonnées restent au milieu, loin du volet droit. Ce bouton n'indique plus visuellement le panneau qu'il commande. Le champ est plafonné arbitrairement ; le groupe des commandes n'utilise plus la largeur selon le rôle de chacune. Les filtres placés sous cette barre ne sont pas en cause.

### Cause vérifiée dans les sources

`src/styles/app.css` contient une disposition structurée pour `.catalog-header` (grid), mais la surcharge `.catalog-header.search-header` la remplace en mode recherche par `display: flex; flex-wrap: wrap; justify-content: flex-start`. Le correctif 044 ajoute des gouttières et un plafond de largeur (`.search-header .toolbar-search { flex: 1 1 12rem; max-width: 18rem; }`) sans restaurer la logique d'ancrage. Le test de 044 vérifie uniquement l'espacement et l'alignement des boutons « Recherche avancée » et chevron : il ne détecte pas la dérive structurelle. La comparaison est confirmée par les captures de recette humaine des vues « document » et « recherche avancée » transmises le 18 novembre. Elles comportent des données personnelles : **ne pas les copier dans le dépôt**.

## Objectif fonctionnel et visuel

**La barre de recherche avancée doit fonctionner comme la barre normale et respecter les mêmes zones et ancrages.** Adapter le contenu à la recherche, non inventer une seconde composition déconnectée.

1. **Ancrage à droite impératif :** le bouton de rétractation du volet Métadonnées reste, en recherche comme en document normal, à la même distance du bord droit du panneau central, visuellement associé au volet droit. Il ne peut jamais suivre le compteur dans une zone centrale simplement parce que des composants précédents sont courts.
2. **Ancrage à gauche :** préserver le bouton de repli du volet gauche à son emplacement habituel ; TODO et titre « Recherche » gardent une disposition lisible et cohérente avec le titre de document.
3. **Zone centrale :** champ de recherche, bouton « Recherche avancée », **chevron immédiatement à côté de ce bouton mais séparé d'environ 10 px**, puis compteur de documents. Utiliser intelligemment l'espace disponible : ne pas étirer sans limite le champ, mais ne pas non plus concentrer toute la barre sur la gauche en laissant une immense zone vide incohérente. La répartition résulte du modèle commun de l'interface, non d'une suite de max-width ou de marges arbitraires.
4. **Alignements :** tous les contrôles de la première ligne cohérents en hauteur et en rythme visuel ; la vue recherche n'utilise pas de deuxième ligne à la largeur des captures usuelles si la vue document normale tient sur une ligne.
5. **Adaptation aux fenêtres étroites :** comparer les deux modes à mêmes dimensions. Si un passage à la ligne devient nécessaire, maintenir les associations sémantiques (chevron avec son bouton, repli des métadonnées au bord droit) ; ne pas laisser un contrôle isolé ou perdu. Éviter un débordement horizontal. Les dimensions exactes doivent être justifiées par une recette comparative, pas des seuils inventés.
6. Garder le titre unique « Recherche » et toutes les commandes / fonctionnalités existantes, sans réintroduire « Résultats de recherche ».

## Méthode exigée

- **Avant toute modification**, examiner le JSX et les CSS de la barre de document normale, de `DocumentCatalog` et leurs media queries : identifier explicitement pourquoi les commandes de la barre normale occupent leurs places et comment reproduire les mêmes invariants dans la recherche. Inclure ce diagnostic court dans le rapport.
- Chercher un partage des règles de structure / colonnes ou un alignement sur le layout existant, plutôt qu'un ajustement à tâtons du `flex-wrap` spécifique à la recherche. Une adaptation locale minimale est acceptable si elle est cohérente et expliquée ; pas de refonte générale du composant.
- Ne pas écrire de test qui consacre un défaut visuel par une assertion arbitraire. **Ajouter un contrôle d'ancrage du bouton Métadonnées en comparant la position dans les deux vues**, à taille de fenêtre identique, ainsi que l'absence de ligne supplémentaire injustifiée en largeur standard. Conserver les vérifications d'environ 10 px entre chevron et son bouton.
- Faire une **recette visuelle comparative réelle** (fenêtre document / fenêtre recherche) avec la **même bibliothèque fictive, même taille et mêmes volets visibles**. Vérifier au moins largeur habituelle, largeur intermédiaire et fenêtre plus étroite. Montrer dans le rapport les mesures structurantes et leur sens ; possibilité de publier des captures fictives légères si autorisé par les pratiques du dépôt.
- Donner à David des captures ou une recette claire pour qu'il puisse juger le résultat, sans déclarer une esthétique « validée humainement ».

## Hors périmètre

- Ne changer **aucune logique de recherche**, filtres, retour au document, repli/dépli des critères, navigation, édition, sauvegardes, raccourcis.
- Ne pas toucher à SQLite, dépendances, identité Electron, installation stable ou version applicative, sauf nécessité démontrée et explicitement bornée.
- Ne pas engager la mémoire du caret, les thèmes ou le menu Affichage.
- La production demeure sur Zenith Ice. Sur CODEX_VM, même la copie de la vraie base est une **donnée personnelle de test**, non une fixture de recette automatique et jamais un artefact GitHub.
- Échecs historiques des suites non liés : à documenter, ne pas les masquer ni ouvrir un chantier de réparation.

## Contrôles et livraison

- `npm.cmd run build`, recette de recherche/navigation ciblée, contrôle comparative d'ancrage et contrôle visuel dans la vraie fenêtre Electron avec données fictives ; noter ce qui est exécuté ou non.
- Rédiger `reports/045_Coherence_structurelle_barres_outils_report.md` avec : diagnostic du défaut, référence de la barre normale, changements, captures/mesures comparatives, résultats et limites, verdict technique distinct de l'acceptation esthétique humaine.
- Publier code/tests/rapport sur `origin/main` quel que soit le verdict ; vérifier SHA distant, `git diff --check`, état propre, sans force push.
- **S'arrêter après 045** : ne pas démarrer la mémoire du caret.

## Critère de réussite principal

À taille identique, en passant de l'édition normale à la recherche avancée, **le bouton du volet droit ne se déplace pas de son ancrage**, et l'organisation globale des deux barres est reconnaissablement la même. Une barre de recherche qui satisfait des tests de 10 px mais laisse le bouton de volet « au milieu de nulle part » est **NO-GO**.
