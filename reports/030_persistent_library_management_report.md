# Rapport — Gestion durable des bibliothèques

## Objectif

Faire de Textothèque `0.1.18` une application multi-bibliothèques durable : création sûre, registre persistant sans purge, accès depuis un menu Electron et réouverture contrôlée de la dernière bibliothèque compatible.

## État initial

La Mission 029 fournissait déjà l’inspection readonly, l’ouverture/migration avec accord, le backup pré-migration, la bascule atomique et le garde-fou dirty. Le worktree était propre au début de la Mission 030.

## Fichiers modifiés

Fichiers propres ou étendus pour la Mission 030 :

- `electron/library-history.ts` (nouveau) ;
- `electron/library-manager.ts` ;
- `electron/database.ts` ;
- `electron/main.ts` ;
- `electron/preload.cts` ;
- `src/services/library.ts` ;
- `src/types/library.ts` ;
- `src/types/electron.d.ts` ;
- `src/App.tsx` ;
- `src/components/EditorPane.tsx` ;
- `src/styles/app.css` ;
- `scripts/electron-library-history-check.cjs` (nouveau) ;
- `scripts/electron-preload-api-check.cjs` ;
- `scripts/electron-ui-safeguards-check.cjs` ;
- `scripts/electron-ipc-error-check.cjs` ;
- `docs/DB_ROADMAP.md` ;
- `package.json` ;
- `package-lock.json` ;
- `reports/030_persistent_library_management_report.md`.

## Menu Bibliothèque

Le main process construit un menu Electron racine unique `Bibliothèque` :

```text
Bibliothèque
├── Nouvelle bibliothèque…
├── Ouvrir une bibliothèque…
├── Bibliothèques connues
├──────────────
└── Sauvegarder une copie…
```

Le sous-menu connu est reconstruit au démarrage et après toute activation réussie. Les entrées utilisent un checkbox natif pour marquer la bibliothèque active.

Le menu ne change jamais directement de connexion. Il envoie une action au preload puis à React, qui réutilise les workflows de dirty state, inspection, confirmation, migration et rafraîchissement de la Mission 029.

## Nouvelle bibliothèque

`Nouvelle bibliothèque…` passe d’abord par le garde-fou dirty, puis ouvre un dialogue natif de destination. La création utilise une factory DB dédiée :

1. réservation atomique du chemin avec le mode exclusif `wx` ;
2. initialisation du schéma courant ;
3. signature TEXO et `user_version = 2` ;
4. lectures de validation ;
5. remplacement de la connexion active ;
6. fermeture de l’ancienne connexion ;
7. inscription dans le registre.

Un fichier préexistant est refusé, y compris s’il apparaît entre le dialogue et la création. Il n’est ni ouvert ni modifié. Si l’initialisation d’un fichier réservé par Textothèque échoue, cette factory supprime uniquement ce fichier dont elle connaît la provenance.

## Registre persistant

`LibraryHistoryRegistry` stocke le registre hors des bases SQLite, par défaut dans :

```text
%APPDATA%\Textotheque\library-history.json
```

Il ne contient que les chemins et dates d’usage. Une bibliothèque est enregistrée après activation réussie de la base par défaut, d’une base ouverte/migrée ou d’une base nouvellement créée.

Une inspection, un refus, un échec, une annulation, un backup manuel ou pré-migration ne crée pas d’entrée.

## Format library-history.json

```json
{
  "version": 1,
  "lastActivePath": "J:\\Textes\\M2.sqlite",
  "libraries": [
    {
      "path": "J:\\Textes\\M2.sqlite",
      "firstOpenedAt": "2026-08-15T20:00:00.000Z",
      "lastOpenedAt": "2026-08-15T22:12:00.000Z"
    }
  ]
}
```

Le registre ne duplique aucune donnée SQLite : identité, schéma, compteurs et état documentaire restent obtenus depuis les bibliothèques elles-mêmes.

## Écriture atomique du registre

Chaque sauvegarde écrit un fichier temporaire exclusif dans le même répertoire, puis le renomme vers `library-history.json`. Le temporaire résiduel est nettoyé en `finally` en cas d’échec.

Si le registre existant est invalide, il est copié sans écrasement sous un nom `library-history.json.invalid-<timestamp>` avant de repartir en mémoire avec un registre sain. Le fichier sain n’est écrit qu’à la prochaine activation réussie.

Une erreur d’écriture est journalisée mais ne retire ni ne ferme la bibliothèque active.

## Bibliothèques connues

Les entrées sont triées par `lastOpenedAt DESC`. Le menu affiche le basename. Deux basenames identiques sont désambiguïsés avec leur dossier parent.

Il n’existe aucune limite numérique, durée de rétention ou purge automatique.

## Déduplication des chemins

Les chemins sont résolus avant stockage et comparés sans tenir compte de la casse sous Windows. Une réouverture conserve `firstOpenedAt` et actualise uniquement `lastOpenedAt` et `lastActivePath`.

Les éventuels doublons déjà présents dans un JSON chargé sont fusionnés en conservant la première date la plus ancienne et la dernière date la plus récente.

## Bibliothèque courante

La bibliothèque active porte le marqueur natif du checkbox dans le sous-menu. Après activation, elle remonte en tête au prochain rafraîchissement grâce à son nouveau `lastOpenedAt`.

Sélectionner la bibliothèque déjà active reste un no-op du manager : aucune fermeture ni réouverture.

## Bibliothèques introuvables

Une entrée dont le fichier a disparu reste dans le registre et apparaît avec `[introuvable]`. Elle est désactivée dans cette première version. La lecture du registre ne recrée jamais le chemin et ne change pas sa date d’ouverture.

## Réouverture au démarrage

Avant la création de la base par défaut, le manager lit `lastActivePath`. Si le fichier existe et que l’inspection readonly le classe directement `compatible`, il l’ouvre, valide documents/dossiers/corbeille et l’utilise comme connexion active.

Aucune bibliothèque externe legacy, trop récente, étrangère ou invalide n’est construite par le runtime au démarrage.

## Fallback bibliothèque par défaut

Une dernière bibliothèque absente ou non directement compatible provoque le fallback vers :

```text
%APPDATA%\Textotheque\textotheque.sqlite
```

Un message discret est transmis au renderer. L’entrée problématique reste dans le registre ; la bibliothèque par défaut devient simplement la nouvelle `lastActivePath` après son activation réussie.

Le comportement historique de création de la bibliothèque par défaut si elle n’existe pas est conservé.

## Dirty state

Les événements menu `Nouvelle`, `Ouvrir` et `Bibliothèque connue` passent tous par `confirmDiscardUnsavedChanges()` avant leur IPC métier.

`Sauvegarder une copie…` ne propose pas d’ignorer le dirty state : il affiche qu’il faut d’abord sauvegarder le document et n’appelle pas l’IPC de backup.

## Sauvegarde depuis le menu

Le workflow de snapshot vérifié de la Mission 028 reste inchangé. Seul son point d’entrée devient le menu Electron. Un backup ne modifie jamais le registre.

## Retrait des boutons de la barre haute

Les boutons `Ouvrir bibliothèque…` et `Copie bibliothèque…` ont été retirés de `EditorPane`. La barre conserve recherche, panneaux et actions documentaires fréquentes, sans redesign supplémentaire.

## Tests historique

Le nouveau `test:library-history` vérifie :

- absence de limite et de purge ;
- tri décroissant ;
- déduplication et conservation de `firstOpenedAt` ;
- mise à jour de `lastOpenedAt` ;
- entrée absente conservée et jamais recréée ;
- registre invalide préservé sous un nom identifiable ;
- réouverture de la dernière base compatible ;
- fallback missing, legacy et too-new sans mutation ni purge ;
- création TEXO au schéma 2 et activation ;
- ancienne DB intacte ;
- refus byte-à-byte d’une destination existante ;
- échec de création sans fichier incomplet, sans bascule et sans entrée ;
- refus étranger et backup exclus de l’historique ;
- panne du registre n’empêchant ni l’utilisation de la DB active ni une nouvelle activation.

Les logs d’erreurs visibles dans ce test sont des scénarios volontairement injectés.

## Tests bibliothèque

`test:library` continue de valider la bascule atomique, le même chemin, les refus, la migration/adoption avec backup et les échecs laissant A active. La Mission 030 conserve donc tous les garde-fous de la Mission 029.

## Tests UI minimaux

`test:preload` couvre les nouvelles API de startup, inspection par chemin, création et événement menu avec désinscription.

`test:ui-safeguards` vérifie :

- retrait des boutons occasionnels de la barre ;
- dirty bloquant Nouvelle, Ouvrir et bibliothèque connue ;
- backup dirty refusé avant un second IPC ;
- backup menu et erreur propre ;
- bascule réussie depuis une entrée connue ;
- identité, compteurs, recherche et sélection rafraîchis sans données A visibles sous B.

Le rendu pixel du menu natif reste volontairement hors automatisation.

## Ressources temporaires

Toutes les bases et tous les registres du nouveau test vivent sous `%TEMP%\textotheque-test-library-history-*` via le helper de Mission 025, puis sont supprimés en fin de test.

`TEXTOTHEQUE_LIBRARY_HISTORY_PATH` isole également le test IPC utilisant le vrai main process. Aucun test ne lit ou n’écrit le `library-history.json` réel du mainteneur.

## Vérifications effectuées

Les dix validations ont terminé avec le code `0` :

- `build` ;
- `test:app-identity` ;
- `test:legacy-migration` ;
- `test:db` ;
- `test:electron-sqlite` ;
- `test:preload` ;
- `test:ui-safeguards` ;
- `test:ipc-error` ;
- `test:library` ;
- `test:library-history`.

Les traces `SQLITE_FORCED`, `forced preload rejection`, registre invalide, création forcée et registre inaccessible correspondent aux scénarios négatifs attendus. Tous atteignent leur message final de succès.

## Commandes lancées

```powershell
git status --short
git diff --stat
npm.cmd run build
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
npm.cmd run test:library-history
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
git status --short
git diff --stat
git diff --name-only
git diff --check
```

## Versionnement

La version applicative passe de `0.1.17` à `0.1.18` dans `package.json` et `package-lock.json`. `package.json` reste la source canonique. `CURRENT_SCHEMA_VERSION` reste à `2`. Aucune migration ni dépendance n’est ajoutée.

## Recommandations futures pour AGENTS.md

- Le registre de bibliothèques appartient au profil applicatif, jamais à une SQLite.
- Une bibliothèque activée ne doit jamais devenir inutilisable à cause d’une panne du registre.
- Aucune purge ou limite automatique des bibliothèques connues.
- `lastActivePath` et les dates ne sont mis à jour qu’après activation réussie.
- Le démarrage inspecte la dernière bibliothèque readonly et ne migre jamais silencieusement une bibliothèque externe.
- Une bibliothèque manquante reste connue et n’est jamais recréée depuis l’historique.
- Les backups manuels et pré-migration sont toujours exclus de l’historique.
- Les tests doivent injecter un chemin de registre temporaire et ne jamais utiliser le registre utilisateur.

`AGENTS.md` n’a pas été modifié pendant la mission.

## Points non traités

- suppression, relocalisation ou réorganisation manuelle d’une entrée ;
- liste tronquée de récentes ;
- import/export documentaire ou menu `Fichier` ;
- migration interactive automatique au démarrage ;
- backup périodique ou rotation ;
- inspection visuelle longue du menu natif.

## Risques / limites

Le registre est un fichier de confort local, sans verrou inter-processus : l’application suppose une seule instance Textothèque active, comme aujourd’hui. Une copie invalide est préservée, mais aucune fusion/récupération sophistiquée de JSON corrompu n’est tentée.

Le menu désambiguïse les homonymes par leur dossier parent ; deux arborescences ayant également le même parent affiché pourraient encore produire des libellés identiques, même si leurs chemins et leurs actions restent distincts.

La migration historique éventuelle de la bibliothèque par défaut reste le comportement runtime existant. La nouvelle règle « pas de migration silencieuse au démarrage » est appliquée aux bibliothèques externes rappelées par `lastActivePath`.

## Suite recommandée

Le mainteneur peut maintenant tester rapidement le menu réel : ouvrir une base, créer une base, fermer/relaunch, vérifier le marqueur courant et une entrée introuvable. Une future mission ne devrait ajouter une gestion manuelle de l’historique que si l’usage quotidien en montre le besoin.
