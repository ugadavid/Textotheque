# Mission 051 — Ctrl+↑ / Ctrl+↓ : défiler sans déplacer le caret

**Date :** 22 novembre 2026  
**Décision fonctionnelle :** dans l’éditeur principal, **Ctrl+Flèche Haut** et **Ctrl+Flèche Bas** font défiler le document sans déplacer le caret ni modifier la sélection.  
**Nature :** micro-amélioration ergonomique de l’éditeur ; aucune modification métier ni SQLite.

## Besoin utilisateur

Lors de la lecture ou de l’écriture d’un document long, l’utilisateur souhaite déplacer la zone visible tout en gardant son point d’édition exactement au même endroit.

Comportement attendu :

- `Ctrl+ArrowUp` → défile le textarea vers le haut ;
- `Ctrl+ArrowDown` → défile le textarea vers le bas ;
- le caret reste strictement à la même position ;
- une sélection existante reste strictement identique, y compris son sens ;
- le focus reste dans l’éditeur ;
- aucun contenu n’est modifié.

Le maintien de la combinaison doit profiter naturellement de la répétition clavier.

## État actuel à préserver

`src/components/EditorPane.tsx` contient déjà :

- le `textarea.content-editor` ;
- le gestionnaire `handleContentKeyDown` utilisé pour Tab ;
- la capture/restauration `selectionStart`, `selectionEnd`, `selectionDirection`, `scrollTop`, `scrollLeft` des missions 046–047 ;
- la persistance de cette position entre sessions.

**Ajouter le nouveau geste dans ce mécanisme existant. Ne pas créer un gestionnaire clavier global.**

## Règles du raccourci

Intercepter uniquement le cas exact pertinent :

- touche `ArrowUp` ou `ArrowDown` ;
- `Ctrl` pressé ;
- sans `Shift`, `Alt` ni `Meta`.

Ne pas modifier le comportement natif des autres combinaisons.

Appeler `preventDefault()` pour empêcher Chromium de déplacer le caret selon son comportement natif Ctrl+Flèche.

## Pas de déplacement du caret

Avant le scroll, relever si nécessaire :

- `selectionStart` ;
- `selectionEnd` ;
- `selectionDirection`.

Après l’action, ces valeurs doivent être identiques. Si le simple changement de `scrollTop` suffit sans toucher à la sélection, ne pas réassigner inutilement le caret.

Le raccourci ne doit pas :

- déplacer le caret ;
- réduire ou étendre une sélection ;
- déclencher `onContentChange` ;
- provoquer un dirty state ;
- déclencher l’autosave ;
- modifier `updated_at`.

## Amplitude de défilement

Utiliser une amplitude liée à l’éditeur, **environ une ligne visuelle par pression/répétition**.

Privilégier une valeur calculée à partir du `line-height` effectif du textarea (`getComputedStyle`) ou une solution équivalente robuste. Éviter un nombre magique arbitraire sans rapport avec la typographie.

Le défilement doit se borner naturellement en haut et en bas.

Ne pas ajouter de smooth scrolling qui rendrait le maintien des touches imprécis.

## Interaction avec la mémoire 046–047

Le nouveau `scrollTop` devient naturellement la position visible courante du document.

Il doit donc être capturé et restauré par le mécanisme existant :

- A → Ctrl+↓ plusieurs fois → B → A : retrouver la zone défilée ;
- fermeture / relance : retrouver la zone défilée persistée ;
- caret/sélection inchangés parallèlement.

Aucune nouvelle clé localStorage ni nouveau format n’est nécessaire.

## Cas de recette obligatoires

Sur un document fictif long :

1. caret simple au milieu du texte + Ctrl+↓ → `scrollTop` augmente, caret identique ;
2. Ctrl+↑ → `scrollTop` diminue, caret identique ;
3. sélection non vide vers l’avant → scroll haut/bas sans changement des bornes ni du sens ;
4. sélection vers l’arrière → même invariant ;
5. répétition de la touche → défilement progressif ;
6. haut du document + Ctrl+↑ → aucun effet indésirable ;
7. bas du document + Ctrl+↓ → aucun effet indésirable ;
8. aucune modification du contenu, aucun dirty, aucun changement de `updated_at` ;
9. Tab fonctionne toujours exactement comme avant ;
10. Ctrl+Shift+↑/↓ et autres variantes non ciblées ne sont pas interceptées par 051 ;
11. A → B → A après défilement → scroll restauré ;
12. fermeture / relance → scroll issu du raccourci restauré grâce à 047.

## Vérifications proportionnées

- `npm.cmd run build`;
- étendre de préférence le test ciblé `electron-editor-position-check.cjs` plutôt que créer une grosse nouvelle suite ;
- vérifier réellement `selectionStart/End/Direction`, `scrollTop`, dirty et `updated_at`;
- recette Windows avec un document fictif suffisamment long ;
- relancer uniquement les tests voisins utiles à l’éditeur / mémoire de position ;
- ne pas rejouer migrations, recherche complète ou packaging sans raison directe.

## Données et frontières

- Zenith Ice reste la production ;
- CODEX_VM est l’environnement de développement ;
- tests automatisés uniquement avec données temporaires fictives ;
- ne pas toucher au schéma SQLite, aux dépendances, au menu natif ou au modèle documentaire ;
- ne pas ajouter PageUp/PageDown, molette, raccourcis horizontaux ou autres commandes pendant 051 ;
- ne pas commencer la mission de distribution Windows.

## Rapport et livraison

Créer :

`reports/051_Defilement_Ctrl_fleches_sans_deplacer_caret_report.md`

Le rapport doit préciser :

- interception clavier retenue ;
- calcul du pas de défilement ;
- preuve que caret/sélection et données métier restent inchangés ;
- interaction avec la mémoire persistante 047 ;
- tests exécutés / non exécutés et limites.

Publier code, tests et rapport sur `origin/main` quel que soit le verdict. Vérifier SHA distant, `git diff --check`, état propre et synchronisé.

**S’arrêter après 051 pour recette humaine. Ne pas commencer 052.**
