# Mission 043 — Recherche avancée : retour au document, repli distinct et en-tête compact

**Date :** 18 novembre 2026  
**Produit :** Textothèque 0.1.28 (version initiale observée)  
**Type :** amélioration UX ciblée, sans modification SQLite  
**Références :** `AGENTS.md`, `README.md`, rapport `reports/042_Harmonisation_du_depot_report.md`; méthode de collaboration documentée dans `ugadavid/boite-contre-oubli` (consultation si accessible).

## Contexte et problème utilisateur

Depuis un document en cours de consultation, l'utilisateur ouvre la recherche avancée. Un deuxième clic sur « Recherche avancée » masque actuellement les champs, **mais laisse l'utilisateur dans le catalogue de résultats**, sans revenir à son document. Le masquage est utile et doit être conservé, mais confié à un **petit chevron distinct placé juste à côté du bouton « Recherche avancée »**.

L'en-tête de cette vue répète « RECHERCHE » puis « Résultats de recherche ». Il faut supprimer cette redondance et la casse intégralement majuscule : **une seule indication « Recherche »**, en casse normale, avec moins de hauteur inutile.

## Comportement demandé

1. **Entrer dans la recherche :** depuis un document A, clic sur « Recherche avancée » => affichage de la recherche avancée, critères visibles. Conserver l'identité du document A comme document de retour ; ne pas remplacer cette référence par le premier résultat.
2. **Quitter la recherche :** lorsque l'utilisateur se trouve dans la recherche avancée, clic sur « Recherche avancée » => revenir au document A et à son contenu, sans sélection arbitraire d'un autre document.
3. **Replier les critères indépendamment :** à côté immédiat du bouton « Recherche avancée », ajouter un discret chevron **vers le haut** quand les critères sont visibles. Clic => masquer uniquement le panneau des critères, tout en restant dans les résultats.
4. **Déplier :** le chevron pointe alors **vers le bas**. Clic => réafficher les critères inchangés, toujours dans les résultats. Ce chevron ne quitte jamais la recherche, ne réinitialise ni critères ni liste, et n'effectue aucune nouvelle requête inutile.
5. **En-tête sobre :** ne garder que « Recherche » en casse ordinaire et supprimer « Résultats de recherche » ; utiliser la place récupérée pour rendre le bandeau plus compact sans sacrifier recherche textuelle, accès TODO, navigation, nombre de documents, boutons de volets ou interactions existantes.
6. **Navigation sûre :** respecter le dirty guard et les sauvegardes existants ; une saisie non sauvegardée ne doit jamais être perdue à l'aller ou au retour. Préserver le comportement courant d'« Échap » et des commandes du menu Recherche, sauf ajustement minimal nécessaire ; ne pas introduire de nouvelle interprétation contradictoire des raccourcis.
7. **Cas limites :** document initial supprimé/inaccessible, absence de document initial, navigation volontaire vers un résultat ou une autre vue pendant la recherche : prévoir un retour cohérent sans ouvrir le mauvais document ni effacer les modifications. Définir clairement dans le rapport comment est mémorisé et invalidé le document de retour ; ne pas surarchitecturer.

## Périmètre et interdits

- Modifier uniquement le renderer et les styles/composants nécessaires, ainsi que les tests voisins.
- Ne pas toucher au schéma SQLite, aux migrations, aux bibliothèques, aux dépendances ou à la distribution Windows.
- Zenith Ice est la production ; CODEX_VM utilise une copie **de test** personnelle : pas de publication de cette base ou de ses contenus. **Pour les tests automatisés, employer des bibliothèques fictives et chemins temporaires**, jamais la copie personnelle importée. La recette humaine peut être effectuée par David sur sa copie.
- Ne pas intégrer dans cette mission le suivi du caret, les thèmes ou le futur menu Affichage ; ce sont des chantiers distincts.
- Ne pas traiter les trois échecs préexistants signalés par le rapport 041 sauf si directement nécessaires à la fiabilité de cette UX. Les signaler comme antériorités si rencontrés.

## Vérifications

- Examiner/reproduire le comportement actuel avant correction.
- Compiler avec `npm.cmd run build`.
- Tester les transitions entrée → retour au document A ; repli/dépli sans perte de critères ; ouverture d'un document depuis les résultats ; retour et garde-fous pour un document modifié ; cas sans document initial.
- Exécuter les tests UI/navigation existants pertinents et les nouveaux contrôles ciblés ; si `test:ui-safeguards` est bloqué par son attente obsolète de version 0.1.27, distinguer clairement cette limite du résultat fonctionnel, sans masquer l'échec ni transformer 043 en campagne de réparation générale.
- Effectuer une courte recette réelle Windows sur CODEX_VM, exclusivement avec une bibliothèque fictive, couvrant le placement du chevron, la compacité de l'en-tête et le retour au bon document.
- Énumérer les tests exécutés et non exécutés avec motif, sans prétendre à une validation exhaustive.

## Rapport et livraison

Créer `reports/043_Recherche_avancee_navigation_et_entete_report.md` directement sous `reports/`, conformément à AGENTS.md. Documenter le comportement avant/après, les fichiers, le choix de gestion du document de retour, les tests et leurs limites, et si utile une capture **avec données fictives uniquement**.

Publier sur `origin/main` les changements autorisés, tests et rapport quel que soit le verdict (GO, PARTIEL, NO-GO, BLOQUÉ), sans push forcé ; vérifier SHA distant, `git diff --check`, état propre/synchronisé. S'arrêter après 043 en attendant la validation humaine. **Ne pas démarrer 044.**
