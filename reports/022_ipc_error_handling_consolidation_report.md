# Rapport — Uniformisation de la gestion des erreurs IPC

## Objectif

Rendre les erreurs SQLite/IPC prévisibles et diagnostiquables sur toute la chaîne main → preload → services → React, sans protocole de résultat supplémentaire ni dépendance, tout en empêchant les faux succès et les rejets de promesses non gérés.

## Diagnostic initial

Le preload propageait déjà directement les promesses retournées par `ipcRenderer.invoke()`, et les services renderer les transmettaient sans les masquer. La sauvegarde possédait un `try/catch`, mais affichait parfois directement le message technique reçu.

Les autres parcours principaux — chargement initial, changement de vue, création, sélection, dossiers, corbeille, restauration et vidage — attendaient les services sans stratégie d'erreur. Comme les fonctions asynchrones étaient données directement aux événements React ou appelées avec `void`, un rejet IPC pouvait devenir une promesse rejetée non gérée.

Plusieurs opérations modifiaient aussi le contexte de vue avant la réussite de l'appel distant. Enfin, la zone d'erreur existante vivait dans `EditorPane` mais n'était pas rendue quand aucun document n'était sélectionné, ce qui empêchait d'afficher un échec de chargement initial.

## Inventaire des flux IPC

| Canal | Main | Preload | Service / App | Gestion après mission |
|---|---|---|---|---|
| `documents:list` | `listDocuments()` | `listDocuments()` | service + `refreshDocuments()` | catch initial ou lié à l'action |
| `documents:list-deleted` | `listDeletedDocuments()` | idem | service + refresh | catch initial ou lié à l'action |
| `documents:create` | `createDocument()` | idem | service + création | message, aucun document fantôme |
| `documents:get` | `getDocument()` | idem | exposé, non utilisé par `App` | rejet preload testé |
| `documents:update` | `updateDocument()` | `updateDocument()` | `saveDocument()` | dirty et état erreur conservés |
| `documents:mark-opened` | `markOpened()` | idem | `selectDocument()` | sélection précédente conservée si rejet |
| `documents:trash` | `trashDocument()` | idem | service + corbeille | aucune suppression locale avant succès |
| `documents:restore` | `restoreDocument()` | idem | service + restauration | reste en corbeille si rejet |
| `documents:empty-trash` | `emptyTrash()` | idem | service + vidage | liste conservée si rejet |
| `folders:list` | `listFolders()` | idem | service + refresh | catch initial ou lié à l'action |
| `folders:create` | `createFolder()` | idem | service + création | aucun dossier fantôme |
| `folders:rename` | `renameFolder()` | idem | service + renommage | nom persisté conservé si rejet |
| `app:approve-close` | autorise et ferme | `approveClose()` | callback de fermeture | rejet attrapé et affiché |

`app:close-requested` reste un événement main → renderer enregistré avec `ipcRenderer.on()`. Son mécanisme de confirmation dirty n'a pas été refondu.

## Stratégie retenue

Le mécanisme natif de rejet de `ipcRenderer.invoke()` est conservé.

La solution comporte seulement :

1. un wrapper générique autour de `ipcMain.handle()` pour journaliser le canal et l'erreur originale ;
2. un petit helper renderer pour extraire un message depuis `unknown`, filtrer les formes manifestement techniques et fournir un fallback lié à l'action ;
3. des `try/catch` explicites dans chaque parcours React asynchrone ;
4. des mutations de vue ou de listes seulement après réussite de l'opération correspondante ;
5. des tests forcés et un test réel de propagation.

Aucun objet `{ ok, data, error }`, classe métier d'erreur, système de codes ou framework de notification n'a été introduit.

## Fichiers modifiés

- `electron/main.ts`
- `package.json`
- `src/App.tsx`
- `src/components/EditorPane.tsx`
- `src/services/errors.ts`
- `scripts/electron-preload-api-check.cjs`
- `scripts/electron-ui-safeguards-check.cjs`
- `scripts/electron-ipc-error-check.cjs`
- `reports/022_ipc_error_handling_consolidation_report.md`

`electron/database.ts`, le schéma, les migrations, `electron/preload.cts`, `package-lock.json`, la version et `AGENTS.md` n'ont pas été modifiés.

## Normalisation des erreurs

`src/services/errors.ts` fournit :

```ts
getErrorMessage(error: unknown, fallback: string): string
logRendererError(operation: string, error: unknown): void
```

L'extraction accepte :

- une instance de `Error` ;
- une chaîne ;
- un objet possédant une propriété `message` textuelle ;
- toute autre valeur, qui retombe sur le fallback.

Les messages trop longs ou contenant des marqueurs techniques connus (`Error invoking remote method`, `SQLITE_`, `TypeError`, stack ou chemin Windows) ne sont pas présentés à l'utilisateur. L'erreur originale reste envoyée à `console.error` avec le contexte renderer.

## Gestion côté main

Tous les handlers `invoke` passent désormais par `registerIpcHandler()`.

En cas d'échec, le wrapper :

1. écrit `console.error('[IPC <canal>]', error)` avec l'erreur originale ;
2. rejette l'invocation avec une erreur courte identifiant le canal ;
3. laisse le preload et le renderer capturer normalement ce rejet.

Le lancement asynchrone de `createWindow()` possède aussi un `catch` explicite afin qu'un échec de chargement de fenêtre ne devienne pas une promesse rejetée silencieuse.

Un mode de diagnostic borné `--textotheque-check-ipc-error` ouvre une fenêtre cachée, appelle le vrai preload, capture un rejet de `documents:list`, affiche le résultat puis quitte sans opération utilisateur.

## Gestion côté renderer

Chaque parcours asynchrone de `App.tsx` suit la règle :

```text
début d'opération → effacement de l'erreur précédente
succès → application de l'état persistant
échec → log technique + fallback utilisateur lié à l'action
```

Le chargement initial attache un `catch` à la promesse lancée avec `void`. Les handlers React et raccourcis peuvent toujours appeler les fonctions avec `void`, car celles-ci capturent désormais tous leurs rejets applicatifs.

Le callback de fermeture lance une fonction bornée contenant son propre `try/catch`, y compris autour de `approveClose()`.

`EditorPane` affiche maintenant la zone d'erreur même sans document sélectionné, ce qui garde l'application ouverte et rend un échec initial visible.

## États UI en cas d’échec

- Sauvegarde : le document sélectionné n'est remplacé qu'après `updateDocument()` réussi. Un rejet conserve titre, contenu et dirty marker ; `saveState = error` est désormais prioritaire à l'affichage sur le simple état dirty.
- Création de document : ni vue, ni sélection, ni liste locale ne change avant le retour de la base.
- Création de dossier : aucun dossier local n'est fabriqué avant le retour IPC.
- Renommage : aucune mise à jour optimiste ; un rejet conserve le nom persisté.
- Corbeille : un rejet laisse le document actif et sélectionné.
- Restauration : un rejet laisse le document dans la corbeille.
- Vidage : un rejet laisse tous les éléments visibles.
- Sélection ou changement de vue : le contexte précédent reste en place si le chargement échoue.

Lorsqu'une écriture a réussi mais que le rafraîchissement suivant échoue, le message le dit explicitement (`Document sauvegarde, mais actualisation impossible.`, par exemple). Une écriture réellement réussie n'est donc pas présentée comme un échec SQLite.

## Messages utilisateur

Les principaux fallbacks sont :

```text
Impossible de charger les documents et les dossiers.
Impossible de charger cette vue.
Impossible de charger le document.
Impossible de creer le document.
Impossible de sauvegarder le document.
Impossible de deplacer le document vers la corbeille.
Impossible de restaurer le document.
Impossible de vider la corbeille.
Impossible de creer le dossier.
Impossible de renommer le dossier.
Impossible de fermer l'application.
```

Une opération suivante commence par effacer l'ancien message. Le test de sauvegarde vérifie aussi qu'un succès après échec retire l'erreur précédente.

## Tests d’erreurs forcées

`test:ui-safeguards` peut maintenant faire rejeter exactement le prochain appel d'un canal. Les erreurs factices contiennent volontairement un code `SQLITE_FORCED` et un chemin Windows afin de vérifier qu'ils restent absents de l'interface.

Scénarios couverts :

1. chargement initial : application ouverte, liste vide, message visible ;
2. création : aucun document fantôme, sélection inchangée ;
3. sauvegarde : dirty marker, données persistées inchangées et état `Erreur` ;
4. renommage de dossier : ancien nom conservé en stockage et dans l'arbre ;
5. corbeille : document toujours actif et sélectionné.

Le test collecte aussi les événements `unhandledrejection` et les messages console renderer. Il refuse les motifs `UnhandledPromiseRejection`, `Unhandled Promise Rejection` et `uncaught (in promise)`.

Les traces `Error occurred in handler...` visibles pendant ce test sont attendues : elles correspondent aux rejets volontairement injectés et permettent de vérifier le diagnostic technique. Le test termine avec `ui safeguards ok` et le code `0`.

## Rejets IPC / preload

`test:preload` force `documents:get(-1)` à rejeter. Le code exécuté dans la fenêtre attrape ce rejet, vérifie son message, confirme qu'aucun événement `unhandledrejection` n'est produit, puis poursuit l'utilisation normale de l'API. Le preload ne transforme ni ne masque la promesse.

La nouvelle commande :

```powershell
npm.cmd run test:ipc-error
```

utilise comme `TEXTOTHEQUE_DB_PATH` un répertoire temporaire à la place d'un fichier. L'ouverture `better-sqlite3` échoue donc de façon déterministe sans dépendre de permissions Windows. Le test vérifie réellement :

```text
TextothequeDatabase
→ handler main documents:list
→ rejet IPC
→ preload contextBridge
→ appel renderer capturé
```

Il confirme que le log main contient le canal et l'erreur SQLite originale, que le message reçu par le renderer ne contient ni chemin ni code SQLite, et qu'aucun rejet non géré n'apparaît.

Résultat :

```text
ipc error propagation ok: documents:list rejection caught by renderer
```

## Vérifications effectuées

| Commande | Résultat | Code |
|---|---|---:|
| `npm.cmd run build` | TypeScript, Vite et main Electron | 0 |
| `npm.cmd run test:app-identity` | profil Textotheque et surcharge DB | 0 |
| `npm.cmd run test:legacy-migration` | schéma 2, 4 scénarios | 0 |
| `npm.cmd run test:db` | comportements DB sur base temporaire | 0 |
| `npm.cmd run test:electron-sqlite` | Electron 33.4.11 / better-sqlite3 11.10.0 | 0 |
| `npm.cmd run test:preload` | API et rejet récupérable | 0 |
| `npm.cmd run test:ui-safeguards` | parcours normaux et cinq erreurs forcées | 0 |
| `npm.cmd run test:ipc-error` | propagation réelle main/preload/renderer | 0 |
| `node --check` sur les scripts modifiés/ajoutés | syntaxe valide | 0 |

## Commandes lancées

```powershell
git status --short
git diff --stat
rg -n "ipcMain\.handle|ipcRenderer\.invoke|window\.textotheque\." electron src scripts
rg -n "async |await |\.then\(|void " src\App.tsx src\components src\services
node --check scripts\electron-preload-api-check.cjs
node --check scripts\electron-ui-safeguards-check.cjs
node --check scripts\electron-ipc-error-check.cjs
npm.cmd run build
npm.cmd run test:app-identity
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
npm.cmd run test:ipc-error
npm.cmd run dev
git status --short
git diff --stat
git diff --name-only
git diff --check
```

Des contrôles PowerShell en lecture seule ont vérifié le port, les processus, la base temporaire et le profil Electron. L'interface du lancement réel a été inspectée directement.

## Test développement réel

Le lancement réel a utilisé :

```text
C:\Users\david\AppData\Local\Temp\textotheque-m022-dev-1786808977931.sqlite
```

Résultats :

- Vite 6.4.3 prêt sur `http://localhost:5173/` en 207 ms ;
- une seule instance principale Electron ;
- profil Chromium `C:\Users\david\AppData\Roaming\Textotheque` ;
- base temporaire créée ;
- création réelle d'un document ;
- saisie puis sauvegarde réelle du titre et du contenu ;
- disparition du dirty marker après sauvegarde ;
- `SQLite OK` et `v0.1.13` visibles ;
- aucune erreur IPC ou promesse rejetée dans la console de développement.

Le lanceur a ensuite été interrompu volontairement par `Ctrl+C`, d'où son code non nul. Le port `5173` était libre et aucun processus principal Textothèque ne subsistait après arrêt.

## Versionnement applicatif

Textothèque reste en version `0.1.13`. Aucun paquet, lockfile, numéro de schéma ou dépendance n'a été modifié.

## Points non traités

- refonte du mécanisme de fermeture dirty ;
- test bout en bout de fermeture réelle ;
- système de codes d'erreur métier ;
- toast, modal ou bibliothèque de notification ;
- journalisation persistante ;
- retry automatique ;
- schéma, migrations, clés étrangères ou règles SQLite ;
- nettoyage général des bases temporaires.

## Risques / limites

Le wrapper main renvoie volontairement une erreur générique après avoir journalisé le détail. Les fallbacks précis viennent donc de l'action renderer, pas d'une classification métier côté SQLite.

Les tests UI utilisent toujours des handlers factices pour leur couverture large. Le test `test:ipc-error` complète cette limite pour un rejet réel de chargement, mais ne reproduit pas chaque canal avec une vraie base défaillante.

Les messages de succès partiel après écriture réussie et rafraîchissement échoué sont exacts, mais l'interface peut rester temporairement obsolète jusqu'à la prochaine opération réussie.

## Suite recommandée

Conserver le helper minimal et ajouter un scénario forcé seulement lorsqu'un nouveau type d'état local apparaît. Le prochain approfondissement utile serait un test bout en bout séparé du flux de fermeture dirty, sans élargir cette consolidation en framework d'erreurs.
