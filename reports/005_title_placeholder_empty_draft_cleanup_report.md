# Rapport — Confort du titre et nettoyage des brouillons vides

## Objectif

Améliorer le confort de création des documents en `0.1.4` sans ajouter de grande fonctionnalité :

- traiter `Sans titre` comme fallback visuel plutôt que comme titre utilisateur à effacer ;
- nettoyer prudemment les brouillons manifestement vides au démarrage.

## Problèmes traités

- Les nouveaux documents stockaient `Sans titre` comme vraie valeur de titre.
- L'utilisateur devait parfois effacer manuellement `Sans titre` avant de saisir un vrai titre.
- Les tests manuels pouvaient laisser plusieurs documents vides dans la liste après redémarrage.

## Fichiers modifiés

- `package.json`
- `package-lock.json`
- `electron/database.ts`
- `db/schema.sql`
- `src/App.tsx`
- `src/App.js`
- `src/components/NavigationPane.tsx`
- `src/components/NavigationPane.js`
- `scripts/electron-db-check.cjs`
- `scripts/electron-ui-safeguards-check.cjs`
- `reports/005_title_placeholder_empty_draft_cleanup_report.md`

Des fichiers déjà modifiés lors des missions précédentes restent présents dans le worktree, notamment les composants générés `.js/.d.ts`, les rapports 003/004 et les fichiers Electron liés aux missions 003/004.

## Fonctionnement ajouté

- Les nouveaux documents sont créés avec un titre vide en base.
- Le champ de titre central affiche `Sans titre` comme placeholder.
- La navigation affiche `Sans titre` comme fallback si le titre stocké est vide.
- Les anciens documents dont le titre stocké vaut exactement `Sans titre` sont traités comme sans titre côté édition, afin de ne pas imposer l'effacement manuel.
- Au démarrage de la base, les brouillons strictement vides sont supprimés.
- Les tests DB et UI couvrent les nouveaux comportements.

## Comportement du titre Sans titre

`Sans titre` n'est plus utilisé comme contenu de titre pour les nouveaux documents.

Comportement actuel :

- en base : titre vide pour un document sans titre utilisateur ;
- au centre : placeholder `Sans titre` si le champ est vide ;
- dans la navigation : fallback `Sans titre` si le titre est vide ;
- à l'édition : un ancien titre stocké exactement `Sans titre` est présenté comme champ vide ;
- à la sauvegarde : un titre vide reste vide en base.

Si l'utilisateur saisit un titre, ce texte devient le vrai titre du document.

## Nettoyage des documents vides

Le nettoyage est déclenché au démarrage de la couche SQLite, juste après l'initialisation du schéma.

La suppression est volontairement limitée aux documents manifestement créés par erreur ou par test, sans contenu utilisateur réel.

## Critères de sécurité anti-suppression

Un document est nettoyé uniquement si tous les critères suivants sont vrais :

- `content_format = 'plain'`
- `status = 'draft'`
- `favorite = 0`
- `title` vide après trim, ou exactement `Sans titre`
- `content` vide après trim
- `notes` vide après trim

Un document n'est pas nettoyé s'il contient :

- du contenu ;
- des notes ;
- un favori ;
- un statut autre que `draft` ;
- un format autre que `plain` ;
- un titre utilisateur réel.

## Vérifications effectuées

- `npm.cmd run build` : OK.
- `npm.cmd run test:db` : OK.
- `npm.cmd run test:electron-sqlite` : OK.
- `npm.cmd run test:preload` : OK.
- `npm.cmd run test:ui-safeguards` : OK.

Vérifications ajoutées :

- un nouveau document a un titre vide en base ;
- un nouveau document sans titre affiche `Sans titre` comme placeholder ;
- la navigation affiche `Sans titre` comme fallback ;
- un vrai titre peut être saisi directement sans effacer `Sans titre` ;
- un brouillon vide est nettoyé après réouverture de la base ;
- un document avec contenu n'est pas nettoyé ;
- un document avec notes n'est pas nettoyé ;
- un document favori n'est pas nettoyé ;
- un document avec statut `active` n'est pas nettoyé.

## Commandes lancées

```powershell
Get-Content -Raw README.md
Get-Content -Raw reports\001_initial_textotheque_v0.1_report.md
Get-Content -Raw reports\002_preload_fix_report.md
Get-Content -Raw reports\003_ux_safeguards_resizable_panes_report.md
Get-Content -Raw reports\004_confirm_dialog_editing_lock_fix_report.md
Get-Content -Raw electron\database.ts
Get-Content -Raw db\schema.sql
Get-Content -Raw scripts\electron-db-check.cjs
Get-Content -Raw scripts\electron-ui-safeguards-check.cjs
Get-Content -Raw src\App.tsx
Get-Content -Raw src\components\NavigationPane.tsx
npm.cmd run build
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
Select-String -Path package.json,package-lock.json -Pattern '"version": "0.1.4"|"version": "0.1.3"'
git status --short
```

## Points non traités

- Pas de Markdown.
- Pas d'import/export.
- Pas de recherche.
- Pas de tags/collections.
- Pas d'autosave.
- Pas de modification lourde du schéma SQLite.
- Pas d'interface de corbeille ou restauration.

## Risques / limites

- Le nettoyage est définitif pour les documents qui correspondent strictement aux critères.
- Un utilisateur qui voudrait volontairement conserver un document totalement vide, `draft`, non favori, sans note et sans titre réel le perdrait au démarrage suivant.
- Pour éviter cela, il suffit d'ajouter un titre réel, du contenu, une note, un favori ou un statut autre que `draft`.
- Le schéma existant des bases déjà créées peut garder son ancien `DEFAULT 'Sans titre'`, mais l'application insère désormais explicitement un titre vide.

## Suite recommandée

- Ajouter plus tard une suppression logique ou une corbeille avant tout nettoyage plus ambitieux.
- Ajouter un champ `source_type` ou un indicateur de création automatique si le projet veut distinguer encore plus finement les brouillons accidentels.
- Conserver cette logique de nettoyage très stricte tant que des textes réels peuvent être présents.
