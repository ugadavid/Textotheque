# Rapport — Documents dans l’arborescence

## Objectif

Afficher les documents directement dans l'arborescence des dossiers virtuels afin que le rangement soit visible sans ouvrir une liste separee.

Version applicative : passage de `0.1.11` a `0.1.12`.

## Problème traité

Les documents pouvaient etre classes dans des dossiers, mais ils n'etaient visibles que dans la liste de documents du contexte selectionne.

Cela rendait le rangement peu lisible : un dossier pouvait etre selectionne, mais ses textes semblaient exister dans une zone separee plutot qu'a l'interieur du dossier.

## Fichiers modifiés

- `package.json`
- `package-lock.json`
- `src/App.tsx`
- `src/components/NavigationPane.tsx`
- `src/styles/app.css`
- `scripts/electron-ui-safeguards-check.cjs`
- fichiers generes par `npm.cmd run build`

## Fonctionnement ajouté

- Affichage des documents actifs sous leur dossier virtuel.
- Affichage des documents actifs sans dossier dans une section `Non classes`.
- Selection directe d'un document depuis l'arborescence.
- Marquage visuel du document selectionne dans l'arborescence.
- Maintien de la liste globale pour `Tous les textes`.
- Maintien de la liste de resultats quand une recherche est active.

## Affichage arborescent

La section `Dossiers` affiche maintenant :

- les dossiers racine ;
- les sous-dossiers ;
- les documents directement affectes a chaque dossier.

Les documents en corbeille ne sont pas injectes dans cette arborescence active.

Les dossiers vides restent visibles avec leur compteur direct a `0`.

## Documents non classés

Les documents sans `folder_id` apparaissent dans une section `Non classes`.

Le bouton `Non classes` reste cliquable, mais les documents non classes sont visibles directement dessous quand aucune recherche n'est active.

## Recherche

Quand une recherche est active, Textotheque conserve une liste de resultats claire.

Ce choix evite de melanger une arborescence complete avec des resultats filtres. La recherche continue de respecter le contexte courant :

- `Tous les textes` ;
- `Non classes` ;
- dossier selectionne ;
- `Corbeille`.

## Création de documents dans le contexte courant

La creation par `+` ou `Ctrl+N` continue de creer dans le dossier courant.

Si un document classe est selectionne hors d'une vue dossier, `Ctrl+N` cree maintenant dans le meme dossier que ce document. Ce comportement a ete retenu comme le plus naturel pour continuer une serie de textes dans le meme rangement.

Depuis la corbeille, la creation reste non classee et revient a une vue active.

## Déplacement entre dossiers

Quand le dossier d'un document est modifie depuis les metadonnees puis sauvegarde :

- l'arborescence est rafraichie ;
- le document quitte son ancien contexte ;
- l'interface bascule vers le nouveau contexte du document si l'utilisateur etait dans une vue dossier ou `Non classes` ;
- le document reste selectionne si possible.

## Vérifications effectuées

- Un document affecte a un dossier apparait sous ce dossier.
- Un document cree dans un sous-dossier apparait sous ce sous-dossier.
- Un document non classe apparait dans `Non classes`.
- Cliquer un document dans l'arborescence l'ouvre dans l'editeur.
- Le document selectionne est marque visuellement.
- Les documents en corbeille restent separes de l'arborescence active.
- La creation dans un dossier affiche immediatement le document dans l'arbre.
- La recherche reste fonctionnelle avec une liste de resultats.
- La corbeille reste separee.
- Les raccourcis `Ctrl+S`, `Ctrl+N` et `Ctrl+F` restent couverts par le test UI.

## Commandes lancées

```powershell
npm.cmd run build
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
```

Toutes les commandes sont passees avec code de sortie 0.

Les tests Electron `test:legacy-migration` et `test:db` affichent encore un avertissement Windows `os_crypt_win.cc`, non bloquant.

## Points non traités

- Pas de drag and drop.
- Pas de suppression de dossiers.
- Pas de deplacement de dossiers.
- Pas de tri manuel complexe.
- Pas de documents dans plusieurs dossiers.
- Pas de tags.
- Pas de collections.
- Pas de Markdown.
- Pas d'import/export.
- Pas d'autosave.

## Risques / limites

- L'arborescence affiche les documents directs de chaque dossier, sans inclusion recursive dans les compteurs.
- La recherche active bascule volontairement sur une liste de resultats plutot qu'une arborescence filtree.
- Les documents peuvent etre visibles a la fois dans l'arbre et dans la liste globale `Tous les textes`, ce qui est voulu pour conserver une vue globale simple.

## Suite recommandée

- Ajouter plus tard un repli/depli des dossiers si l'arborescence devient longue.
- Envisager un tri plus fin des documents dans les dossiers.
- Reporter le drag and drop a une mission dediee, avec garde-fous anti-perte.
