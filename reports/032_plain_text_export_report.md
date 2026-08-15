# Rapport — Export du document courant en texte brut

## Objectif

Ajouter à Textothèque `0.1.20` un premier export volontaire du document courant en `.txt`, depuis un menu Electron natif, tout en conservant SQLite comme source de vérité et en exportant exactement le brouillon visible dans React.

## Fichiers modifiés

- `electron/main.ts`
- `electron/preload.cts`
- `electron/text-export.ts`
- `package.json`
- `package-lock.json`
- `src/App.tsx`
- `src/services/text-export.ts`
- `src/types/electron.d.ts`
- `src/types/text-export.ts`
- `scripts/electron-text-export-check.cjs`
- `scripts/electron-preload-api-check.cjs`
- `scripts/electron-ui-safeguards-check.cjs`
- `scripts/electron-autosave-check.cjs`
- `reports/032_plain_text_export_report.md`

## Fonctionnement ajouté ou correction apportée

Le menu racine `Fichier` contient uniquement `Exporter en texte (.txt)…`. Le menu `Bibliothèque` reste séparé et inchangé. L'action d'export est désactivée tant que le renderer ne possède aucun document sélectionné, puis réactivée pour tout document courant, y compris un document en corbeille affiché en lecture seule.

Le clic natif envoie seulement l'intention `file:menu-action` au renderer. React capture alors un instantané du titre et du contenu actuellement visibles. Cet instantané traverse le service renderer, le preload isolé et le canal `file:export-text`. Le processus principal propose un emplacement avec `dialog.showSaveDialog()` et écrit uniquement `content` dans le fichier choisi.

L'annulation ne produit ni message, ni écriture, ni changement d'état. Un succès affiche discrètement le nom du fichier exporté. Un échec est journalisé techniquement et présente le fallback `Impossible d’exporter ce document.` selon la gestion d'erreurs IPC existante.

## Choix techniques

L'export utilise un contrat dédié et minimal :

```text
menu Electron
→ événement vers React
→ instantané { title, content }
→ preload / IPC
→ dialogue natif
→ écriture UTF-8
```

La capture est réalisée dans React, et non depuis SQLite, afin qu'un brouillon non encore autosauvegardé soit exporté tel qu'il est affiché au moment du clic. L'instantané est copié avant l'appel asynchrone au dialogue.

`writeTextExport()` utilise `fs.writeFile(..., { encoding: 'utf8' })`. Aucun BOM, séparateur final ou changement de fins de ligne n'est ajouté. Le titre, les notes et les métadonnées ne sont jamais écrits dans le contenu exporté.

Le nom proposé conserve accents, espaces et caractères Unicode valides. Les caractères Windows interdits `< > : " / \ | ? *`, les contrôles, les fins en point/espace et les noms réservés comme `CON` sont neutralisés. Un titre vide donne `Sans titre.txt`; une extension `.txt` déjà présente n'est pas doublée.

L'écrasement éventuel reste géré par le comportement natif Electron avec `showOverwriteConfirmation`. Aucun chemin d'export n'est conservé dans l'application.

## Interaction avec l'autosave

L'export ne passe jamais par `saveDocument()` et ne touche pas au timer d'autosave. Il ne modifie ni le dirty marker, ni `saveState`, ni `updated_at`, ni la base SQLite.

Si l'autosave se déclenche indépendamment avant ou après l'export, il suit son fonctionnement normal. Le fichier reçoit toujours la chaîne capturée au clic, sans relire ensuite l'état React ou SQLite.

## Vérifications effectuées

Les douze validations demandées terminent avec le code `0` :

| Commande | Résultat |
|---|---|
| `npm.cmd run build` | TypeScript renderer/main et build Vite valides |
| `npm.cmd run test:app-identity` | identité et profil applicatif valides |
| `npm.cmd run test:legacy-migration` | schéma `2`, quatre scénarios legacy valides |
| `npm.cmd run test:db` | comportements DB valides sur base temporaire |
| `npm.cmd run test:electron-sqlite` | Electron et `better-sqlite3` compatibles |
| `npm.cmd run test:preload` | nouvelles méthodes et nouvel événement exposés correctement |
| `npm.cmd run test:ui-safeguards` | garde-fous renderer existants préservés |
| `npm.cmd run test:ipc-error` | rejet IPC réel capturé côté renderer |
| `npm.cmd run test:library` | identité, backup et bascule de bibliothèque préservés |
| `npm.cmd run test:library-history` | historique, démarrage et création préservés |
| `npm.cmd run test:autosave` | debounce, instantanés et bascules autosave préservés |
| `npm.cmd run test:text-export` | octets, nom, brouillon renderer et neutralité dirty validés |

Le nouveau test vérifie notamment :

- l'égalité exacte entre le buffer écrit et `Buffer.from(content, 'utf8')` ;
- l'absence de BOM ;
- la conservation d'un mélange `CRLF` / `LF`, des accents, d'un tiret Unicode, de caractères CJK et d'un emoji ;
- le fallback `Sans titre.txt` et l'assainissement Windows ;
- la transmission exacte du titre et du contenu visibles mais non sauvegardés ;
- l'absence d'appel `documents:update` pendant l'export ;
- le maintien du dirty marker après succès ;
- la désactivation et l'absence d'export quand aucun document n'est sélectionné ;
- le nettoyage complet de son répertoire temporaire, contrôlé avec `text-export-temp-residue=0`.

Les rejets affichés par les tests preload, UI, bibliothèque, historique et autosave sont les scénarios négatifs volontaires déjà documentés. Chaque test atteint son message final de succès.

## Commandes lancées

```powershell
git status --short
git diff --stat
Get-Content -Raw README.md
Get-Content -Raw reports/015_project_state_audit.md
Get-Content -Raw reports/030_library_management_report.md
Get-Content -Raw reports/031_prudent_autosave_report.md
rg -n "Menu|menu-action|ipcMain|contextBridge|autosave|AUTOSAVE|libraryNotice|showOperationError" electron src scripts package.json
npm.cmd run build
npm.cmd run test:text-export
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
npm.cmd run test:autosave
npm.cmd run build
npm.cmd run test:app-identity
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
npm.cmd run test:ipc-error
npm.cmd run test:library
npm.cmd run test:library-history
npm.cmd run test:autosave
npm.cmd run test:text-export
git diff --check
```

Les premières tentatives Electron exécutées dans le sandbox n'ont pas atteint les assertions à cause des permissions du profil Chromium partagé. Les mêmes validations, exécutées hors sandbox, ont ensuite terminé avec le code `0`. Le test ciblé utilise uniquement un fichier temporaire pour son contrôle d'octets et le supprime dans ses chemins de succès comme d'échec.

## Versionnement

La version applicative passe de `0.1.19` à `0.1.20` dans `package.json` et `package-lock.json`. `package.json` reste la source canonique. `CURRENT_SCHEMA_VERSION` reste à `2`.

Aucune dépendance, table, colonne, migration ou modification de `db/schema.sql` n'est introduite.

## Points non traités

- import de fichiers ;
- export Markdown, HTML, PDF ou DOCX ;
- export multiple ou d'une bibliothèque complète ;
- mémorisation du dernier chemin d'export ;
- préférence de dossier d'export ;
- métadonnée `export_path` ;
- transformation ou normalisation du contenu.

## Risques / limites

Le dialogue natif et la confirmation d'écrasement sont délégués à Electron et au système d'exploitation ; le test automatisé couvre la préparation du nom, le contrat IPC, le snapshot renderer et l'écriture, mais ne pilote pas interactivement le dialogue Windows.

Le renderer informe le processus principal de la présence d'une sélection afin d'activer le menu. Une défaillance exceptionnelle de ce canal est journalisée et laisse au pire l'état précédent du menu ; le callback renderer refuse néanmoins toujours l'export s'il n'existe aucun document courant.

## Suite recommandée

Tester manuellement un export avec un titre contenant des caractères interdits et un remplacement d'un fichier existant. Les formats supplémentaires et l'import doivent rester des missions séparées afin de conserver ce premier contrat texte brut simple et vérifiable.
