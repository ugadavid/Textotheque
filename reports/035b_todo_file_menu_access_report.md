# Rapport — Accès TODO depuis le menu Fichier

## Objectif

Ajouter un accès découvrable au TODO permanent depuis le menu natif `Fichier`, avec l’accélérateur `Ctrl+Shift+T`, tout en conservant le bouton existant et un seul workflow applicatif.

## État hérité de Mission 035

La Mission 035 était présente dans le worktree et volontairement non commitée. Elle fournissait déjà :

- le document spécial `special_role = 'todo'` ;
- la création paresseuse atomique ;
- le dirty guard ;
- le bouton TODO ;
- le raccourci renderer `Ctrl+Shift+T` ;
- le no-op lorsque le TODO est déjà courant ;
- les protections DB, autosave, navigation, recherche et backup.

Toutes ces modifications ont été préservées. Aucun reset, nettoyage ou commit n’a été effectué.

## Menu Fichier

Le menu natif est maintenant construit ainsi :

```text
Fichier
├── Ouvrir le TODO        Ctrl+Shift+T
├────────────────────────────────────
└── Exporter en texte (.txt)…
```

Electron utilise l’accélérateur multiplateforme :

```ts
CommandOrControl+Shift+T
```

Aucune autre entrée n’a été ajoutée. L’état d’activation de l’export reste inchangé.

## Workflow partagé

Le type fermé `FileMenuAction` contient désormais :

```ts
'open-todo' | 'export-text'
```

Le main process envoie uniquement cette intention au renderer. Le preload la transmet avec son type. React route ensuite :

```text
open-todo
→ handleOpenTodo()
```

Le bouton TODO appelle la même fonction. Aucun deuxième flux de création, aucune recherche par titre et aucun appel DB direct depuis le main process n’ont été ajoutés.

## Gestion du raccourci

Le menu natif Electron devient le propriétaire unique de `Ctrl+Shift+T` grâce à son `accelerator`.

L’ancien bloc `keydown` du renderer consacré à ce raccourci a été retiré. Un appui clavier produit donc :

```text
accelerator natif
→ clic logique de l’entrée de menu
→ une intention open-todo
→ un appel handleOpenTodo()
```

Les autres raccourcis renderer restent inchangés.

Le test vérifie à la fois la présence de l’accélérateur natif, l’absence de l’ancien propriétaire renderer et l’augmentation exacte de un du compteur de primitive spéciale lors de l’intention menu/clavier.

## Dirty guard

Le menu ne crée pas le TODO depuis le main process. Il déclenche `handleOpenTodo()`, qui vérifie le dirty state avant `getOrCreateSpecialDocument('todo')`.

Le test UI couvre explicitement :

```text
document normal dirty
→ intention Fichier > Ouvrir le TODO
→ dialogue
→ Annuler
→ document courant conservé
→ aucun TODO créé
```

Après confirmation, le même handler peut créer ou ouvrir le TODO actif.

## TODO déjà courant

`handleOpenTodo()` retourne immédiatement lorsque `selectedDocument.special_role === 'todo'`.

Le test renvoie une intention `open-todo` alors que le TODO est déjà courant et confirme :

- aucun nouvel appel à la primitive DB ;
- aucun document supplémentaire ;
- aucune sauvegarde ou recharge provoquée.

## Règle de découvrabilité AGENTS.md

Une section courte « Découvrabilité et menus » a été ajoutée aux règles UX.

Elle distingue :

- toolbar pour les actions fréquentes et contextuelles ;
- menus pour les actions structurantes, occasionnelles ou découvrables ;
- raccourcis pour l’accès rapide.

Elle précise qu’une fonctionnalité peut légitimement utiliser plusieurs surfaces selon l’usage, sans dupliquer automatiquement toutes les commandes ni surcharger les menus. Elle exige également l’affichage naturel des raccourcis dans les menus et une seule intention par raccourci.

Aucune autre règle documentaire n’a été réécrite.

## Tests

Les adaptations ciblées vérifient :

- transmission typée de `open-todo` et `export-text` par le preload ;
- présence de `Ouvrir le TODO` dans la construction du menu natif ;
- accélérateur `CommandOrControl+Shift+T` ;
- absence de l’ancien handler renderer concurrent ;
- dirty guard déclenché par l’action menu ;
- annulation sans création paresseuse ;
- convergence vers le workflow TODO existant ;
- une seule exécution de l’intention clavier/menu ;
- no-op si le TODO est déjà courant.

L’esthétique du menu natif reste volontairement réservée au test humain.

## Vérifications effectuées

| Commande | Résultat |
|---|---|
| `npm.cmd run build` | build TypeScript, Vite et Electron valide |
| `npm.cmd run test:preload` | union d’actions du menu Fichier transmise correctement |
| `npm.cmd run test:ui-safeguards` | menu, dirty guard, unicité d’intention et no-op validés |
| `npm.cmd run test:special-todo` | invariants métier et SQLite de Mission 035 inchangés |

Les erreurs `SQLITE_FORCED` visibles dans les tests preload/UI sont les scénarios négatifs historiques attendus. Les scripts atteignent leur message final de succès et terminent avec le code `0`.

## Commandes lancées

```powershell
Get-Content -Raw README.md
Get-Content -Raw AGENTS.md
Get-Content -Raw reports/015_project_state_audit.md
Get-Content -Raw reports/035_special_todo_document_report.md
git status --short
git diff --stat
rg -n "file:menu-action|onFileMenuAction|Ctrl+Shift+T|todo-toolbar|menu" ...
npm.cmd run build
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
npm.cmd run test:special-todo
```

## Versionnement

La version applicative reste `0.1.23`.

Le schéma SQLite reste `3`. Aucun changement n’a été apporté à `special_role`, aux migrations, aux index, à `db/schema.sql` ou aux dépendances.

## Points non traités

- autres entrées du menu `Fichier` ;
- fonctions d’édition spécifiques au TODO ;
- modification visuelle du bouton TODO ;
- automatisation de l’esthétique du menu natif ;
- raccourcis supplémentaires.

## Risques / limites

Le test automatisé valide la structure déclarée du menu, le routage IPC et le comportement renderer, mais ne juge pas le rendu visuel natif de l’accélérateur sous Windows.

Le menu natif est désormais le propriétaire de `Ctrl+Shift+T`. Un futur remplacement ou masquage du menu devra préserver explicitement ce raccourci ou lui désigner un nouveau propriétaire unique.
