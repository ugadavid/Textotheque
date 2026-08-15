# Rapport — Suppression logique et corbeille

## Objectif

Ajouter une suppression logique securisee et une vue Corbeille dans Textotheque, en restant DB-first, reversible et non destructif.

## Problèmes traités

- Aucun flux de suppression reversible n'existait encore.
- Les documents ne disposaient pas encore d'un champ `deleted_at`.
- La navigation ne distinguait pas les documents actifs des documents mis a la corbeille.
- Le nettoyage prudent des brouillons vides utilisait encore une suppression physique.

## Fichiers modifiés

- `package.json`
- `package-lock.json`
- `db/schema.sql`
- `electron/database.ts`
- `electron/main.ts`
- `electron/preload.cts`
- `src/App.tsx`
- `src/components/NavigationPane.tsx`
- `src/components/EditorPane.tsx`
- `src/components/MetadataPane.tsx`
- `src/components/StatusBar.tsx`
- `src/services/documents.ts`
- `src/types/document.ts`
- `src/types/electron.d.ts`
- `src/styles/app.css`
- `scripts/electron-db-check.cjs`
- `scripts/electron-preload-api-check.cjs`
- `scripts/electron-ui-safeguards-check.cjs`
- fichiers generes TypeScript associes en `src/*.js` et `src/*.d.ts`
- `reports/007_logical_delete_trash_report.md`

## Migration SQLite

Le schema ajoute `deleted_at TEXT` a la table `documents`.

Pour les bases existantes, `electron/database.ts` verifie les colonnes via `PRAGMA table_info(documents)` et applique seulement si necessaire :

```sql
ALTER TABLE documents ADD COLUMN deleted_at TEXT
```

Un index `idx_documents_deleted_at` est cree avec `CREATE INDEX IF NOT EXISTS`.

## Fonctionnement ajouté

- Passage applicatif de `0.1.5` a `0.1.6`.
- Liste active : documents avec `deleted_at IS NULL`.
- Liste Corbeille : documents avec `deleted_at IS NOT NULL`.
- Vue `Tous les textes` / `Corbeille` dans le volet gauche.
- Compteurs de documents actifs et en corbeille.
- Recherche limitee a la vue courante.
- Mise a jour de la barre de statut avec le contexte courant.

## Suppression logique

Le bouton `Corbeille` de l'editeur deplace le document courant vers la corbeille apres confirmation.

La base conserve le document et renseigne `deleted_at`. Aucun `DELETE` n'est utilise pour cette action.

Le nettoyage des brouillons strictement vides a aussi ete rendu non destructif : il renseigne maintenant `deleted_at` au lieu de supprimer physiquement les lignes.

## Vue Corbeille

La vue Corbeille affiche uniquement les documents dont `deleted_at` est non nul.

Les documents en corbeille sont consultables mais les champs d'edition sont desactives pour eviter de modifier un document supprime logiquement par ambiguite.

## Restauration

Dans la vue Corbeille, le bouton `Restaurer` remet `deleted_at` a `NULL`, replace le document dans `Tous les textes` et le selectionne.

Le contenu, le titre, le format, le statut, le favori et les notes sont conserves. `updated_at` est mis a jour pour tracer l'operation de restauration.

## Gestion des documents modifiés non sauvegardés

Un document avec modifications non sauvegardees ne peut pas etre mis a la corbeille directement.

L'application affiche un message demandant de sauvegarder ou d'annuler les modifications avant la mise a la corbeille. Elle n'ouvre pas une double confirmation et ne sauvegarde pas automatiquement.

## Barre de statut

La barre de statut affiche le contexte courant :

- `Tous les textes` ou `Corbeille` ;
- le nombre de documents de la vue courante ;
- le compteur de corbeille en vue active ;
- la recherche active si presente ;
- le document selectionne ;
- le format, le statut, l'etat de sauvegarde, les compteurs mots/caracteres, SQLite OK et `v0.1.6`.

## Vérifications effectuées

- Build TypeScript, Vite et Electron.
- Test DB avec mise a la corbeille, restauration et persistance.
- Verification que `listDocuments()` exclut les documents supprimes.
- Verification que `listDeletedDocuments()` liste les documents en corbeille.
- Verification que la restauration conserve le contenu.
- Verification que le nettoyage des brouillons vides passe par la corbeille.
- Test preload avec les nouvelles API.
- Test UI avec recherche active/corbeille separee.
- Test UI du garde-fou dirty avant mise a la corbeille.
- Test UI de confirmation avant mise a la corbeille.
- Test UI de restauration et retour dans `Tous les textes`.
- Test UI confirmant qu'aucun document n'est supprime physiquement par l'action Corbeille.

## Commandes lancées

```text
npm.cmd run build
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
git status --short
git diff --stat
```

## Points non traités

- Pas de suppression definitive.
- Pas de vidage de corbeille.
- Pas de purge automatique.
- Pas de Markdown.
- Pas d'import/export.
- Pas de tags/collections.
- Pas d'autosave.
- Pas d'IA.

## Risques / limites

- La restauration met a jour `updated_at`, ce qui fait remonter le document dans la liste active.
- Les documents en corbeille sont en lecture seule dans l'interface, mais la couche SQLite permet encore leur restauration via API.
- La corbeille reste simple : pas de tri dedie, pas de filtre avance, pas de suppression definitive.
- Le test manuel long avec `npm.cmd run dev` reste utile pour valider le confort reel dans la fenetre Electron.

## Suite recommandée

- Garder la suppression definitive pour une mission separee avec confirmation forte.
- Ajouter plus tard une date de mise a la corbeille visible dans les metadonnees si le besoin apparait.
- Envisager un filtre ou tri par date de suppression seulement apres stabilisation de cette corbeille simple.
