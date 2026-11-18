# Mission 046 — Mémoire de position d’édition pendant la session

**Date :** 18 novembre 2026  
**Décision fonctionnelle validée par David :** mémoriser la position d’édition **uniquement pendant la session courante**.  
**Nature :** amélioration UX ciblée de l’éditeur, sans persistance SQLite ni préférence durable.

## Besoin utilisateur

Dans les documents longs, passer du document A au document B puis revenir au document A replace actuellement le caret ailleurs. Cela complique fortement la lecture et l’écriture.

Textothèque doit retrouver, **pour chaque document déjà visité dans la session**, l’endroit où l’utilisateur travaillait.

Exemple minimal :

1. ouvrir A ;
2. placer le caret vers la fin, avec le texte défilé à cet endroit ;
3. ouvrir B ;
4. revenir à A ;
5. retrouver A au même endroit.

La mémoire disparaît lorsque l’application est fermée. Aucun nouvel état durable n’est demandé.

## État actuel à préserver

`src/components/EditorPane.tsx` possède déjà :
- un `contentEditorRef` vers le `textarea.content-editor` ;
- une logique `pendingCaretPositionRef` + `useLayoutEffect` utilisée pour conserver le caret lors de l’insertion d’une tabulation ;
- un éditeur contrôlé par la prop `content`.

`src/App.tsx` gère les changements de document, de vue, de recherche et de bibliothèque. L’éditeur peut être temporairement remplacé par le catalogue/recherche ; une mémoire conservée uniquement dans une instance éphémère d’`EditorPane` ne doit donc pas être perdue lors d’un démontage/remontage au cours de la même session.

## Comportement demandé

Pour chaque document, mémoriser au minimum :

- `selectionStart` ;
- `selectionEnd` ;
- le sens de sélection si le navigateur le fournit utilement (`selectionDirection`) ;
- `scrollTop` du textarea ;
- `scrollLeft` si pertinent.

### Restauration

Lorsqu’un document déjà visité redevient actif :

- restaurer sa sélection/caret après que son contenu est réellement présent dans le textarea ;
- restaurer son défilement ;
- borner proprement les positions si le contenu a changé et est désormais plus court ;
- ne pas modifier le texte pour effectuer la restauration ;
- ne pas déclencher de faux dirty state ni de sauvegarde.

Si aucune position n’est mémorisée pour un document, conserver le comportement actuel.

### Focus

Ne pas voler le focus arbitrairement à une autre commande. Quand le parcours normal d’ouverture d’un document donne actuellement le focus à l’éditeur, restaurer la sélection avec ce focus ; lorsqu’une vue revient au document sans intention de focus explicite, préserver le comportement existant. Le but est de retrouver la position, pas d’introduire une nouvelle politique globale de focus.

## Durée de vie et isolation

- **Mémoire vive seulement.**
- Aucun `localStorage`, fichier, registre, SQLite, migration ou nouvelle colonne.
- La mémoire doit survivre aux changements A → B → A et aux démontages temporaires de l’éditeur pendant la session.
- Ne jamais appliquer la position d’un document d’une bibliothèque à un document portant le même ID dans une autre bibliothèque. Utiliser un espace de noms lié à la bibliothèque active ou vider explicitement la mémoire au changement de bibliothèque.
- Une fermeture/reouverture de Textothèque repart sans positions mémorisées.
- Une suppression définitive ou indisponibilité d’un document ne doit pas provoquer d’erreur ; une entrée devenue inutile peut être oubliée simplement, sans moteur de nettoyage sophistiqué.

## Interaction avec l’existant

- Préserver la gestion actuelle de la touche Tab et son `pendingCaretPositionRef` ; ne pas créer deux restaurations concurrentes qui se battent à chaque changement de `content`.
- Préserver autosave, dirty guard, recherche avancée, TODO, corbeille, navigation par dossiers et retour depuis la recherche.
- Une modification du contenu pendant que le document est ouvert doit continuer à laisser le caret naturel de l’utilisateur intact.
- Ne pas restaurer la position sur **chaque frappe** : la restauration est liée à l’activation/réactivation du document, pas au rendu ordinaire du textarea.

## Architecture attendue

Faire une modification simple et lisible, cohérente avec React :

- garder la mémoire de session dans une structure JS en mémoire (`Map` ou équivalent), à un niveau dont la durée de vie couvre les démontages temporaires de l’éditeur ;
- laisser `EditorPane` capturer/restaurer les coordonnées réelles du textarea via son ref ;
- éviter une dépendance ou un store global pour ce besoin local ;
- ne pas surarchitecturer un gestionnaire générique de sessions.

Codex peut ajuster le découpage exact après inspection du flux réel, mais doit expliquer dans le rapport **où vit la mémoire, quand elle est capturée et quand elle est restaurée**.

## Cas de recette obligatoires

Avec une bibliothèque fictive et deux documents suffisamment longs :

1. **Caret simple :** A à une position éloignée → B → A : position identique.
2. **Défilement :** A défilé vers le bas → B → A : même zone visible, à tolérance normale du navigateur.
3. **Sélection :** sélectionner une plage dans A → B → A : mêmes bornes si le contenu n’a pas changé.
4. **Positions distinctes :** A et B gardent chacun leur propre position après plusieurs alternances.
5. **Édition :** modifier A, laisser l’autosave normal agir si nécessaire, passer à B puis revenir : contenu et position cohérents, aucun faux dirty déclenché par la restauration.
6. **Recherche/catalogue :** quitter temporairement l’éditeur vers une vue catalogue/recherche puis revenir au même document pendant la session : la position n’est pas perdue du seul fait que `EditorPane` a été démonté.
7. **Changement de bibliothèque :** une position mémorisée dans la bibliothèque fictive 1 n’est pas appliquée au document de même ID de la bibliothèque fictive 2.
8. **Nouvelle session :** ne pas introduire de persistance ; constater par inspection/recette qu’un relancement repart du comportement initial.

## Vérifications proportionnées

- Inspecter et documenter le comportement avant modification.
- `npm.cmd run build`.
- Ajouter ou adapter un test Electron ciblé réel pour les invariants ci-dessus ; utiliser exclusivement des profils/bases temporaires.
- Exécuter les tests voisins directement touchés par navigation/éditeur si pertinent. Ne pas rejouer SQLite/migrations/packaging sans raison.
- Les échecs historiques non liés du rapport 041 restent hors périmètre ; ne pas les « réparer au passage ».
- Faire une courte recette Windows réelle avec données fictives, notamment sur un document assez long pour rendre le défilement significatif.

## Données et frontières

- Zenith Ice reste la production et n’est jamais utilisée pour la mission.
- La copie personnelle présente sur CODEX_VM est une base de test **personnelle**, mais elle ne doit pas servir aux tests automatisés ni être publiée.
- Aucun changement du schéma, des dépendances, de la distribution ou des préférences persistantes.
- Ne pas commencer le thème sombre ni le menu Affichage.

## Rapport et livraison

Créer directement :

`reports/046_Memoire_position_edition_pendant_session_report.md`

Le rapport doit distinguer :
- comportement initial ;
- architecture de la mémoire de session ;
- capture/restauration et interaction avec la logique Tab ;
- tests effectués et non effectués ;
- limites éventuelles.

Publier code, test ciblé et rapport sur `origin/main` quel que soit le verdict (GO, PARTIEL, NO-GO, BLOQUÉ), sans push forcé. Vérifier le SHA distant, `git diff --check`, l’état propre et synchronisé.

**S’arrêter après la mission 046 pour recette humaine. Ne pas commencer le thème sombre.**
