# Rapport — Raccourcis clavier essentiels

## Objectif

Ajouter les raccourcis clavier essentiels de Textotheque afin d'ameliorer le confort quotidien d'edition, sans ajouter de grande fonctionnalite.

## Fichiers modifiés

- `package.json`
- `package-lock.json`
- `src/App.tsx`
- `src/components/NavigationPane.tsx`
- `src/components/EditorPane.tsx`
- `scripts/electron-ui-safeguards-check.cjs`
- fichiers generes TypeScript associes en `src/*.js` et `src/*.d.ts`
- `reports/010_keyboard_shortcuts_report.md`

## Fonctionnement ajouté

- Passage applicatif de `0.1.8` a `0.1.9`.
- Ecoute globale des raccourcis clavier cote renderer.
- Raccourcis branches sur les handlers existants pour conserver les confirmations et garde-fous.
- Infobulles discretes sur les commandes concernees.

## Raccourcis ajoutés

- `Ctrl+S` : sauvegarde le document courant, empeche le comportement natif et ignore les documents en corbeille.
- `Ctrl+N` : cree un nouveau document et respecte la confirmation anti-perte si le document courant est modifie.
- `Ctrl+F` : empeche la recherche native et place le focus dans la recherche Textotheque.
- `Escape` : annule une confirmation ouverte, ou vide la recherche si le focus est dans le champ de recherche.
- `F2` : place le focus dans le titre du document courant si celui-ci est editable.

## Gestion des confirmations

Les raccourcis ne contournent pas la boite React existante.

`Ctrl+N` utilise le meme flux que le bouton de creation. Si le document courant contient des modifications non sauvegardees, la confirmation apparait.

`Escape` annule cette confirmation sans changer de document ni perdre les modifications visibles.

## Choix UX

- Aucune nouvelle zone d'aide n'a ete ajoutee.
- Les indications restent dans les infobulles existantes :
  - `Nouveau document - Ctrl+N`
  - `Sauvegarder - Ctrl+S`
  - `Rechercher - Ctrl+F`
- Aucun raccourci destructif n'a ete ajoute pour la corbeille.

## Vérifications effectuées

- `Ctrl+S` sauvegarde un document modifie.
- `Ctrl+S` fait disparaitre l'asterisque et l'etat modifie.
- `Ctrl+N` declenche la confirmation si le document courant est modifie.
- `Ctrl+N` cree un nouveau document quand aucun garde-fou ne bloque l'action.
- `Ctrl+F` focalise le champ de recherche.
- `Ctrl+F` empeche la recherche native.
- `Escape` annule une confirmation ouverte.
- `Escape` vide la recherche quand le champ recherche est actif.
- `F2` focalise le titre.
- Les parcours corbeille, restauration et vidage de corbeille restent couverts.

## Commandes lancées

```text
npm.cmd run build
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
git status --short
git diff --stat
```

## Points non traités

- Pas de panneau d'aide clavier.
- Pas de raccourci pour vider la corbeille.
- Pas de Markdown.
- Pas d'import/export.
- Pas d'autosave.
- Pas de tags/collections.
- Pas de nouveau comportement destructif.

## Risques / limites

- Les raccourcis sont geres cote renderer ; une future barre de menus Electron pourrait devoir declarer les memes accelerateurs pour une integration systeme plus complete.
- `F2` ne fait rien si le document est en corbeille, car les documents en corbeille restent en lecture seule.
- `Escape` reste volontairement minimal et ne gere pas encore tous les cas de focus possibles.

## Suite recommandée

- Conserver cette base de raccourcis courte et previsible.
- Ajouter plus tard un petit panneau d'aide seulement si la liste de raccourcis grandit.
- Envisager une integration menu Electron quand l'application approchera d'un packaging plus stable.
