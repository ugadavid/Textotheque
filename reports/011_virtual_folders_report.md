# Rapport — Dossiers virtuels

## Objectif

Ajouter un premier rangement par dossiers virtuels, strictement stocke en SQLite, sans transformer Textotheque en explorateur de fichiers.

La mission reste dans la branche 0.1.x avec passage de la version applicative a `0.1.10`.

## Fichiers modifiés

- `package.json`
- `package-lock.json`
- `db/schema.sql`
- `electron/database.ts`
- `electron/main.ts`
- `electron/preload.cts`
- `src/App.tsx`
- `src/components/NavigationPane.tsx`
- `src/components/MetadataPane.tsx`
- `src/components/StatusBar.tsx`
- `src/services/documents.ts`
- `src/styles/app.css`
- `src/types/document.ts`
- `src/types/electron.d.ts`
- `scripts/electron-db-check.cjs`
- `scripts/electron-legacy-migration-check.cjs`
- `scripts/electron-preload-api-check.cjs`
- `scripts/electron-ui-safeguards-check.cjs`
- fichiers generes par le build TypeScript/Vite dans `dist`, `dist-electron` et les sorties `.js` / `.d.ts`

## Migration SQLite

Ajout de la table `folders` :

- `id`
- `name`
- `parent_id`
- `position`
- `created_at`
- `updated_at`

Ajout de la colonne nullable `folder_id` sur `documents`.

La migration conserve les documents existants en `folder_id = NULL`, donc dans la vue `Non classes`.

## Fonctionnement ajouté

- Chargement des dossiers depuis SQLite.
- Creation de dossiers racine.
- Creation de sous-dossiers depuis le dossier selectionne.
- Affectation d'un document a un dossier via le panneau de metadonnees.
- Retour possible vers `Non classe` via le meme select.
- Filtrage des documents selon la vue courante.
- Recherche limitee au contexte courant.

## Navigation gauche

Le volet gauche contient maintenant :

- `Tous les textes`
- `Non classes`
- `Corbeille`
- une section `Dossiers`
- un bouton de creation de dossier racine
- un bouton de creation de sous-dossier quand un dossier est selectionne

La vue d'un dossier affiche uniquement les documents directement affectes a ce dossier. Les sous-dossiers ne sont pas inclus recursivement dans cette V0.1.10.

## Création de dossiers

La creation utilise la methode SQLite `createFolder(parentId)`.

Le nom initial est volontairement simple : `Nouveau dossier`.

Le renommage de dossier n'est pas implemente dans cette mission.

## Affectation des documents

Le panneau droit ajoute un champ `Dossier`.

Le changement de dossier marque le document comme modifie et suit le flux de sauvegarde explicite existant. Il n'y a pas d'autosave.

Chaque document peut appartenir a un seul dossier au maximum via `documents.folder_id`.

## Recherche et vues

La recherche simple continue de filtrer titre et contenu, mais uniquement dans la vue active :

- tous les documents actifs dans `Tous les textes` ;
- documents actifs sans dossier dans `Non classes` ;
- documents actifs du dossier exact dans une vue dossier ;
- documents supprimes logiquement dans `Corbeille`.

## Barre de statut

La barre de statut affiche maintenant le contexte courant :

- `Tous les textes`
- `Non classes`
- `Dossier: <nom>`
- `Corbeille`

Les compteurs continuent d'indiquer le nombre de documents visibles dans le contexte.

## Vérifications effectuées

- Build TypeScript/Vite/Electron OK.
- Migration legacy OK avec creation de `folders` et ajout de `folder_id`.
- Test DB OK avec creation dossier racine, sous-dossier, affectation puis retour en `Non classe`.
- Test SQLite Electron OK.
- Test preload OK avec exposition de `listFolders()` et `createFolder()`.
- Test UI OK avec creation de dossier, affectation d'un document, vues `Tous les textes`, `Non classes`, dossier, recherche contextualisee, corbeille, restauration, vidage, raccourcis et protections anti-perte.

## Commandes lancées

```powershell
npm.cmd run build
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
```

Les tests Electron `test:legacy-migration` et `test:db` ont affiche un avertissement Windows `os_crypt_win.cc` non bloquant, avec code de sortie 0.

## Points non traités

- Pas de renommage de dossiers.
- Pas de suppression de dossiers.
- Pas de deplacement par glisser-deposer.
- Pas de documents dans plusieurs dossiers.
- Pas de tags ou collections.
- Pas d'import/export.
- Pas de rendu Markdown.
- Pas de recherche avancee.

## Risques / limites

- Les noms de dossiers sont tous crees comme `Nouveau dossier` tant que le renommage n'existe pas.
- La vue dossier ne remonte pas les documents des sous-dossiers.
- Aucune contrainte de cle etrangere stricte n'est activee pour `documents.folder_id` dans cette V0.1.10.

## Suite recommandée

- Ajouter le renommage simple des dossiers.
- Ajouter une suppression de dossier non destructive, avec retour des documents en `Non classe`.
- Afficher le nombre de documents par dossier.
- Clarifier plus tard si une vue dossier doit inclure ou non ses sous-dossiers.
