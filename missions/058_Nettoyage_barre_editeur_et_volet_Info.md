# Mission 058 — Nettoyage de la barre éditeur et refonte du volet « Info »

**Date :** 22 novembre 2026
**Nature :** nettoyage graphique / ergonomique ciblé.
**Version :** conserver **0.1.29**.
**Schéma SQLite :** conserver **5**.
**Distribution :** aucun Setup.

## Intention

Alléger deux zones sans changer les comportements métier : la barre supérieure de l’éditeur et le volet droit actuellement intitulé « DOCUMENT / Metadonnees ».

# 1 — Barre supérieure

Retirer visuellement :
- le texte d’état `Pret / Modifie / Sauvegarde... / Sauvegarde / Erreur` ;
- le bouton `Corbeille` ;
- le bouton `Sauvegarder`.

Conserver strictement : autosave, dirty state, sauvegarde métier, `Ctrl+S`, mise à la corbeille via les accès de 057, restauration documentaire et protections existantes.

Le marqueur `*` orange devant le titre existe déjà et fonctionne déjà. **Ne modifier ni son apparence, ni sa couleur, ni sa logique.**

Le bouton `Restaurer`, affiché lorsqu’un document en Corbeille est ouvert, reste présent avec son comportement actuel.

# 2 — Recycler les styles appréciés

## TODO
Le bouton `TODO` reprend le style visuel actuel du bouton Corbeille : contour/texte danger, fond sobre, géométrie cohérente.
Conserver son rôle, `Ctrl+Shift+T` et un état actif identifiable.

## Recherche avancée
Le bouton `Recherche avancée` reprend le style visuel actuel du bouton Sauvegarder : bouton rempli couleur accent/principale, texte contrasté.
Conserver son comportement et son état actif.

# 3 — Rééquilibrer la barre

Après retrait des anciens contrôles, supprimer les colonnes/trous inutiles dans `.editor-toolbar` et ne pas laisser un `save-controls` vide.

Conserver : toggle navigation, TODO, titre, recherche, Recherche avancée, Restaurer si nécessaire, toggle du volet droit.

Aux largeurs réduites, conserver le comportement actuel : ce qui déborde peut revenir à la ligne. Pas de redesign responsive général.

# 4 — En-tête du volet droit

Remplacer `DOCUMENT / Metadonnees` par un seul titre :

`Info`

Sur la même ligne, alignée à droite, remplacer la checkbox Favori par une étoile :
- `☆` non favori ;
- `★` favori ;
- clic = bascule via `onFavoriteChange` ;
- `aria-pressed` ;
- tooltip `Ajouter aux favoris` / `Retirer des favoris` ;
- désactivée pour un document en Corbeille.

L’état sans document est déjà bien géré : ne rien changer à ce comportement.

# 5 — Statut en premier

Le premier bloc du volet devient `Statut`.

Supprimer le select actuel et afficher cinq boutons radio avec valeurs internes inchangées :
- `draft` → **Brouillon** ;
- `active` → **Actif** ;
- `to_review` → **À revoir** ;
- `final` → **Final** ;
- `archived` → **Archivé**.

Les radios peuvent revenir à la ligne selon la largeur du volet. Utiliser un vrai groupe accessible. En Corbeille : radios désactivées.

# 6 — Dossier

Placer `Dossier` juste sous Statut. Conserver le select, les chemins hiérarchiques, `Non classé`, le callback et le comportement actuel. En Corbeille : désactivé.

# 7 — Notes internes

Placer ensuite `Notes internes`.

Conserver le même textarea et le même callback, mais lui donner davantage de hauteur visuelle (cible indicative 160–180 px minimum au lieu d’environ 120 px). Conserver le resize vertical si cohérent. En Corbeille : désactivé.

# 8 — Dates

Après Notes internes, afficher dans cet ordre exact :
1. `Créé`
2. `Modifié`
3. `Dernière ouverture`

Conserver le formatage `fr-FR` existant et le retour à la ligne naturel des valeurs.

# 9 — Caractères et Mots

Afficher impérativement sur **une seule même ligne** :

`Caractères : 3584    Mots : 598`

Valeurs dynamiques, présentation compacte, pas un compteur par ligne.

# 10 — ID et Format en bas

Retirer `ID` et `Format` du haut de la liste et les placer tout en bas du volet dans une petite zone secondaire de type mini barre d’état.

Exemple acceptable : `ID : 90    Format : plain`.

Cette zone reste dans le volet droit et garde une priorité visuelle faible.

# 11 — Ordre final du volet

Pour un document sélectionné :
1. ligne `Info` + étoile Favori ;
2. Statut — radios ;
3. Dossier ;
4. Notes internes ;
5. Créé ;
6. Modifié ;
7. Dernière ouverture ;
8. une seule ligne `Caractères : n   Mots : n` ;
9. mini barre basse `ID : n   Format : ...`.

# 12 — Typographie et rythme

Harmoniser légèrement : labels courts, casse française naturelle, pas de majuscules décoratives inutiles, marges verticales régulières.

Respecter les variables CSS existantes et les thèmes clair/sombre. Ne pas refaire le thème général.

# 13 — Invariants métier

Ne pas modifier : schéma SQLite, autosave, sauvegarde, dirty state, marqueur `*`, titre, dossier métier, statuts métier, favori métier, notes, dates, compteurs, Corbeille, restauration, menu Édition, raccourcis, recherche, TODO, redimensionnement/masquage des volets.

Un document en Corbeille reste totalement non modifiable, y compris ses informations.

# 14 — Tests ciblés

Vérification L1 UI ciblée, couvrant au minimum :
- absence du save-state, Corbeille et Sauvegarder dans la barre ;
- marqueur `*` existant toujours fonctionnel sans modification ;
- `Ctrl+S` et autosave toujours fonctionnels ;
- TODO = style visuel ancien Corbeille ;
- Recherche avancée = style visuel ancien Sauvegarder ;
- Restaurer toujours disponible en Corbeille ;
- titre unique `Info` ;
- étoile ☆/★ fonctionnelle et désactivée en Corbeille ;
- cinq radios françaises, valeurs internes correctes, désactivées en Corbeille ;
- Dossier inchangé fonctionnellement ;
- Notes inchangées fonctionnellement et plus hautes ;
- dates dans l’ordre demandé ;
- Caractères + Mots sur une seule ligne ;
- ID + Format dans la zone basse ;
- état sans document inchangé ;
- thèmes clair/sombre lisibles ;
- volet étroit sans débordement destructeur, retour à la ligne général préservé.

Pas de campagne DB complète ni de distribution.

# 15 — Recette humaine

Proposer à David :
1. ouvrir un document normal et vérifier la barre épurée ;
2. modifier un caractère et vérifier que seul le `*` orange existant signale le dirty ;
3. attendre l’autosave puis tester `Ctrl+S` ;
4. vérifier les styles de TODO et Recherche avancée ;
5. parcourir le volet Info dans l’ordre demandé ;
6. changer Statut via radio, Dossier, Notes et Favori ;
7. vérifier Caractères + Mots sur la même ligne et ID + Format en bas ;
8. ouvrir un document de la Corbeille : toutes les infos modifiables restent désactivées et Restaurer reste présent ;
9. vérifier rapidement thème sombre et volet plus étroit.

# 16 — Rapport

Créer :

`reports/058_Nettoyage_barre_editeur_et_volet_Info_report.md`

Le rapport précise : éléments supprimés de la barre, styles recyclés, confirmation que le `*` n’a pas été modifié, nouvelle structure Info, mapping statut interne/libellé français, comportement Favori, comportement Corbeille inchangé, tests exécutés/non exécutés, recette humaine, verdict.

Publier code/tests/rapport sur `origin/main`, vérifier `git diff --check`, SHA distant et worktree propre/synchronisé.

**S’arrêter après 058. Conserver la version 0.1.29, le schéma 5 et ne fabriquer aucun Setup.**