# Rapport — Repli / dépli des dossiers

## Objectif

Ajouter un repli/depli simple des dossiers dans l'arborescence de gauche afin d'ameliorer la lisibilite quand les dossiers, sous-dossiers et documents deviennent nombreux.

Version applicative : passage de `0.1.12` a `0.1.13`.

## Problème traité

Depuis la Mission 013, les documents sont visibles dans l'arborescence, mais tous les dossiers restaient toujours ouverts.

Avec plusieurs sous-dossiers et documents, le volet gauche pouvait devenir trop dense.

## Fichiers modifiés

- `package.json`
- `package-lock.json`
- `src/App.tsx`
- `src/components/NavigationPane.tsx`
- `src/styles/app.css`
- `scripts/electron-ui-safeguards-check.cjs`
- fichiers generes par `npm.cmd run build`

## Fonctionnement ajouté

- Bouton de repli/depli sur chaque dossier.
- Symbole `v` pour un dossier ouvert.
- Symbole `>` pour un dossier replie.
- Masquage des documents directs et des sous-dossiers quand un dossier est replie.
- Conservation du compteur direct du dossier meme replie.
- Ouverture automatique du chemin du document ou dossier selectionne.

## Repli / dépli des dossiers

Le clic sur le chevron replie ou deplie le dossier.

Le clic sur le nom du dossier continue de selectionner le dossier, sans declencher le repli/depli.

Un dossier replie masque :

- ses documents directs ;
- ses sous-dossiers ;
- les documents de ses sous-dossiers.

## Persistance UI

L'etat replie/deplie est stocke dans `localStorage` avec la cle :

```text
textotheque:collapsed-folders:v1
```

SQLite n'est pas modifiee, car il s'agit d'une preference purement visuelle.

## Création et déplacement de documents

Quand un document est selectionne ou cree dans un dossier, le composant ouvre automatiquement le dossier concerne et ses parents pour que le document reste visible autant que possible.

Le comportement existant est conserve :

- `Ctrl+N` depuis un document classe cree dans le meme dossier ;
- le bouton `+` depuis une vue dossier cree dans ce dossier ;
- changer le dossier d'un document depuis les metadonnees rafraichit l'arborescence.

## Recherche

La recherche conserve le comportement de la Mission 013.

Quand une recherche est active, Textotheque affiche une liste de resultats claire. Le repli/depli concerne l'arborescence normale sans recherche active.

## Vérifications effectuées

- Un dossier ouvert affiche ses documents directs.
- Un dossier replie masque ses documents directs.
- Un dossier replie masque ses sous-dossiers.
- Le compteur du dossier reste visible quand il est replie.
- Le clic sur le chevron ne selectionne pas un autre document.
- Le clic sur un document visible l'ouvre toujours dans l'editeur.
- L'etat replie est stocke en `localStorage`.
- Creer un document dans un dossier le rend visible.
- La recherche continue d'afficher une liste de resultats.
- La corbeille reste separee.
- Les raccourcis `Ctrl+S`, `Ctrl+N`, `Ctrl+F`, `Escape` et `F2` restent couverts par le test UI.

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

Les tests Electron `test:legacy-migration` et `test:db` affichent encore des avertissements Windows `os_crypt_win.cc` et parfois `gpu_process_host.cc`, non bloquants.

## Points non traités

- Pas de drag and drop.
- Pas de suppression de dossiers.
- Pas de deplacement de dossiers.
- Pas de tri manuel.
- Pas d'inclusion recursive des compteurs.
- Pas de tags.
- Pas de collections.
- Pas de Markdown.
- Pas d'import/export.
- Pas d'autosave.
- Pas de panneau d'options.

## Risques / limites

- Les symboles de repli/depli restent volontairement simples (`>` et `v`).
- L'etat visuel est local a la machine et au profil utilisateur Electron.
- Un utilisateur peut replier manuellement un dossier contenant le document courant ; le chemin est rouvert lors d'une nouvelle selection ou creation contextualisee.

## Suite recommandée

- Ajouter plus tard un bouton global `Tout replier` / `Tout deplie` si l'arborescence grandit.
- Envisager un tri plus lisible des documents dans chaque dossier.
- Reporter le drag and drop a une mission dediee.
