# Rapport — Vider la corbeille

## Objectif

Ajouter une action simple pour vider la corbeille de Textotheque, en version `0.1.8`, sans refonte de l'interface ni double confirmation.

## Fichiers modifiés

- `package.json`
- `package-lock.json`
- `electron/database.ts`
- `electron/main.ts`
- `electron/preload.cts`
- `src/App.tsx`
- `src/components/NavigationPane.tsx`
- `src/services/documents.ts`
- `src/types/electron.d.ts`
- `src/styles/app.css`
- `scripts/electron-db-check.cjs`
- `scripts/electron-preload-api-check.cjs`
- `scripts/electron-ui-safeguards-check.cjs`
- fichiers generes TypeScript associes en `src/*.js` et `src/*.d.ts`
- `reports/009_empty_trash_report.md`

## Fonctionnement ajouté

- Ajout du bouton `Vider la corbeille` dans le volet gauche.
- Le bouton apparait uniquement dans la vue `Corbeille`.
- Le bouton est desactive quand la corbeille est vide.
- Apres vidage, l'application reste dans la vue `Corbeille`.
- La selection courante est effacee si elle etait dans la corbeille.
- Les compteurs et la barre de statut sont rafraichis.
- Passage applicatif de `0.1.7` a `0.1.8`.

## Méthode SQLite

Ajout de la methode `emptyTrash()` dans `TextothequeDatabase`.

Elle execute uniquement :

```sql
DELETE FROM documents WHERE deleted_at IS NOT NULL
```

Les documents actifs, dont `deleted_at IS NULL`, ne sont pas supprimes.

## Confirmation

Le vidage utilise la confirmation React existante, sans `window.confirm`.

Message :

```text
Vider la corbeille ? X document(s) seront supprimes definitivement.
```

Boutons :

- `Annuler`
- `Vider`

L'annulation ne modifie pas la base.

## Vérifications effectuées

- Build TypeScript, Vite et Electron.
- Test legacy migration conserve.
- Test DB : un document actif n'est pas supprime par `emptyTrash()`.
- Test DB : plusieurs documents en corbeille sont supprimes.
- Test preload : l'API `emptyTrash()` est exposee au renderer.
- Test UI : bouton visible uniquement dans la corbeille.
- Test UI : bouton desactive quand la corbeille est vide.
- Test UI : annuler la confirmation ne supprime rien.
- Test UI : confirmer vide la corbeille.
- Test UI : compteurs et vue Corbeille mis a jour apres vidage.

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

- Pas de suppression definitive document par document.
- Pas de double confirmation.
- Pas de purge automatique.
- Pas de Markdown.
- Pas d'import/export.
- Pas de tags/collections.
- Pas d'autosave.
- Pas de refonte de la corbeille.

## Suite recommandée

- Garder cette action simple tant que la base ne contient pas de textes importants.
- Ajouter plus tard une confirmation plus forte seulement si des donnees sensibles ou nombreuses sont stockees.
- Continuer a couvrir les futures operations destructives par des tests DB et UI.
