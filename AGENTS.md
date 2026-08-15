# AGENTS.md — Textothèque

Ce fichier définit les règles de travail pour tout agent intervenant sur **Textothèque**.

Textothèque est une application desktop locale, DB-first, construite avec Electron, Vite, React, TypeScript et SQLite.

Le projet avance volontairement par **baby steps** : petites missions, périmètre clair, tests ciblés, rapport obligatoire.

---

## 1. Lecture obligatoire avant toute intervention

Avant de modifier quoi que ce soit :

1. lire `README.md` en entier ;
2. lire `reports/015_project_state_audit.md` ;
3. lire les rapports des missions directement liées au sujet traité ;
4. vérifier le code réel avant de se fier aux rapports historiques ;
5. exécuter :

```powershell
git status --short
git diff --stat
```

Ne jamais supposer que le worktree est propre.

Ne jamais écraser, nettoyer ou remettre à zéro des modifications existantes sans demande explicite.

---

## 2. Philosophie du projet

Textothèque doit rester :

- locale ;
- simple ;
- rapide ;
- lisible ;
- DB-first ;
- testable ;
- progressive ;
- adaptée à un usage personnel réel.

Règle générale :

> Une mission = un objectif clair = un périmètre limité = des vérifications = un rapport.

Éviter :

- les refontes globales non demandées ;
- les abstractions prématurées ;
- les changements de stack ;
- les dépendances ajoutées « au cas où » ;
- les fonctionnalités annexes ajoutées pendant une mission différente.

---

## 3. Principe fondamental : DB-first

La base SQLite est la source de vérité pour les documents.

Un document Textothèque ne doit pas dépendre d’un fichier externe pour exister.

Les fichiers externes seront, lorsqu’ils seront implémentés :

- des imports volontaires ;
- des exports volontaires ;
- jamais le stockage documentaire principal.

Ne pas transformer Textothèque en explorateur de fichiers.

Ne pas créer automatiquement un fichier `.txt`, `.md` ou autre pour chaque document.

---

## 4. Architecture à préserver

Flux principal :

```text
React / App
→ src/services/
→ window.textotheque
→ preload Electron
→ IPC
→ main process
→ TextothequeDatabase
→ better-sqlite3
→ SQLite
```

### Renderer

Le renderer ne doit pas accéder directement :

- à Node.js ;
- à `better-sqlite3` ;
- au système de fichiers ;
- au main process hors API exposée.

### Electron

Conserver :

```text
contextIsolation: true
nodeIntegration: false
```

Le preload est actuellement :

```text
electron/preload.cts
```

Il est compilé en CommonJS :

```text
dist-electron/preload.cjs
```

Ce choix corrige un bug historique de chargement du preload.

Ne pas revenir à un preload ESM classique sans raison explicite et tests adaptés.

---

## 5. SQLite et données

La couche SQLite principale est :

```text
electron/database.ts
```

À l’état actuel du projet, `electron/database.ts` est la source réellement exécutée.

`db/schema.sql` est une représentation déclarative du schéma et doit rester synchronisé tant qu’aucune source canonique unique n’a été mise en place.

### Emplacement de la base

Par défaut :

```text
app.getPath('userData')/textotheque.sqlite
```

Pour les tests et audits, utiliser de préférence :

```text
TEXTOTHEQUE_DB_PATH
```

avec une base temporaire.

Ne jamais utiliser la base utilisateur réelle pour un test automatisé.

---

## 6. Règles absolues pour les migrations SQLite

Toute migration doit respecter cet ordre :

```text
1. ouverture de la base
2. création des tables de base si nécessaire
3. migrations de colonnes / structure
4. création des index dépendants
5. opérations applicatives
```

Ne jamais créer un index dépendant d’une colonne avant d’avoir garanti l’existence de cette colonne.

Ce problème a déjà provoqué un bug réel avec `deleted_at`.

### Pour toute nouvelle migration sensible

- vérifier l’état existant avec `PRAGMA`, `sqlite_master` ou équivalent ;
- rendre la migration idempotente ;
- ne jamais supprimer ou recréer la base utilisateur pour « simplifier » ;
- préserver les données existantes ;
- ajouter ou adapter un test legacy ;
- vérifier les données avant/après ;
- utiliser une transaction pour une migration complexe ;
- créer les index seulement après les migrations correspondantes.

Test existant :

```powershell
npm.cmd run test:legacy-migration
```

Toute nouvelle migration importante doit conserver ou étendre cette couverture.

---

## 7. État actuel du modèle

Tables réellement utilisées :

```text
documents
folders
```

### Documents

Le document gère actuellement notamment :

- titre ;
- contenu ;
- `content_format` ;
- statut ;
- favori ;
- dossier ;
- dates ;
- corbeille logique via `deleted_at` ;
- notes internes.

Formats autorisés par le schéma :

```text
plain
markdown
rich
```

Mais seul `plain` est actuellement réellement utilisé.

Ne pas introduire Markdown ou `rich` au détour d’une autre mission.

### Dossiers

Les dossiers sont virtuels et stockés en SQLite.

Un document appartient actuellement à zéro ou un dossier via `folder_id`.

Les dossiers peuvent avoir des sous-dossiers via `parent_id`.

Ne pas transformer ces dossiers virtuels en dossiers physiques Windows.

---

## 8. Corbeille et opérations destructives

La mise à la corbeille est logique :

```text
deleted_at != NULL
```

La restauration remet :

```text
deleted_at = NULL
```

Le vidage de corbeille utilise une suppression physique limitée aux documents déjà en corbeille.

Ne pas mélanger :

- mise à la corbeille ;
- restauration ;
- vidage de corbeille ;
- futures suppressions éventuelles.

Le nettoyage des brouillons strictement vides se fait au démarrage après les migrations et passe par la corbeille logique.

---

## 9. Versionnement : baby steps

Textothèque suit une logique de versionnement lente.

Le numéro de mission et le numéro de version sont indépendants.

Une mission ne justifie pas automatiquement un changement de version.

Règle générale :

```text
0.1.x = consolidation du socle DB-first
0.2.x = vrai nouveau palier fonctionnel
```

Ne pas passer à `0.2.0` sans décision explicite du mainteneur.

Avant toute modification de version :

- vérifier `README.md` ;
- vérifier la version courante ;
- expliquer la raison dans le rapport.

La version est actuellement déclarée dans plusieurs endroits, notamment :

- `package.json` ;
- `package-lock.json` ;
- le renderer / barre de statut.

Tant qu’une source unique n’a pas été créée, vérifier leur cohérence.

---

## 10. Git : règle de reprise

Avant chaque mission :

```powershell
git status --short
git diff --stat
```

Après la mission :

```powershell
git status --short
git diff --stat
```

Ne jamais :

- faire `git reset --hard` ;
- nettoyer le dépôt ;
- supprimer des fichiers inconnus ;
- réécrire l’historique ;
- committer automatiquement ;

sans demande explicite.

Le mainteneur décide du commit.

Une mission doit préserver tout travail déjà présent dans le worktree.

---

## 11. Fichiers générés TypeScript : dette connue

Le projet possède actuellement une dette technique importante :

des fichiers `.js` et `.d.ts` sont générés directement dans `src/`.

Exemples historiques :

```text
src/App.js
src/App.d.ts
src/components/*.js
src/components/*.d.ts
src/services/*.js
src/services/*.d.ts
src/types/*.js
src/types/*.d.ts
```

Ne jamais modifier manuellement ces fichiers générés.

Attention : Vite peut résoudre `.js` avant `.ts` / `.tsx`, ce qui crée un risque qu’un `.js` périmé masque une source TypeScript plus récente en développement.

Cette dette doit être corrigée dans une mission dédiée.

Ne pas essayer de la régler discrètement pendant une autre mission.

---

## 12. Développement Electron : port connu fragile

Le développement utilise actuellement le port :

```text
5173
```

Le script Electron attend et charge explicitement ce port.

Si Vite choisit automatiquement `5174` ou un autre port, Electron peut continuer d’attendre ou charger `5173`.

Avant de conclure qu’une modification applicative est cassée, vérifier donc :

- quel port Vite utilise réellement ;
- si `5173` est déjà occupé ;
- si un ancien processus dev tourne encore.

La correction de cette fragilité doit être faite dans une mission dédiée.

---

## 13. better-sqlite3 / Electron

`better-sqlite3` nécessite un binaire compatible avec le runtime Electron.

Le projet possède des scripts de rebuild et des smoke tests associés.

Ne pas lancer :

```text
npm install
npm audit fix
npm update
npm rebuild
```

ou modifier les versions de dépendances sans demande explicite ou nécessité de mission clairement justifiée.

Le rebuild Electron a historiquement été nécessaire pour corriger un décalage ABI.

Ne pas considérer un changement de dépendance comme anodin.

---

## 14. Tests existants

Commandes principales :

```powershell
npm.cmd run build
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
```

### Couverture approximative

`test:legacy-migration`

- bases anciennes ;
- migrations ;
- préservation des données ;
- corbeille/restauration.

`test:db`

- comportements principaux de `TextothequeDatabase` ;
- documents ;
- dossiers ;
- persistance ;
- corbeille ;
- restauration ;
- vidage.

`test:electron-sqlite`

- chargement de `better-sqlite3` dans Electron.

`test:preload`

- exposition de `window.textotheque` ;
- API preload / IPC.

`test:ui-safeguards`

- nombreux parcours renderer ;
- recherche ;
- dossiers ;
- raccourcis ;
- dirty state ;
- dialogues ;
- corbeille ;
- panneaux ;
- arborescence.

### Limite importante

`test:ui-safeguards` utilise des handlers IPC factices.

Il ne remplace pas un vrai test :

```text
main + preload + renderer + SQLite
```

Ne pas surinterpréter son succès.

---

## 15. Avertissements Electron Windows connus

Certains tests Electron peuvent afficher des messages tels que :

```text
os_crypt_win.cc
gpu_process_host.cc
```

Ils ont historiquement été non bloquants lorsque :

- le code de sortie est `0` ;
- les assertions du test sont atteintes ;
- le message final de succès est affiché.

Ne pas traiter automatiquement ces avertissements comme un échec.

À l’inverse, ne pas ignorer une vraie exception ou un code de sortie non nul sous prétexte qu’Electron produit parfois du bruit.

---

## 16. Tests : choix selon la mission

Pour une petite modification très localisée, exécuter les tests pertinents.

Pour une modification transversale touchant Electron, SQLite, preload, navigation ou modèle de données, exécuter les six validations principales.

Toute migration SQLite doit au minimum inclure :

```powershell
npm.cmd run test:legacy-migration
npm.cmd run test:db
```

Toute modification preload/IPC doit inclure :

```powershell
npm.cmd run test:preload
```

Toute modification UX importante doit inclure :

```powershell
npm.cmd run test:ui-safeguards
```

Toujours documenter précisément les commandes exécutées dans le rapport.

---

## 17. Données de test

Le projet est encore en phase de développement.

Les données actuelles sont considérées comme données de test, mais cela ne justifie pas de modifier la base utilisateur sans nécessité.

Pour les tests :

- créer des bases temporaires ;
- utiliser `TEXTOTHEQUE_DB_PATH` ;
- éviter le profil utilisateur réel ;
- ne pas demander de supprimer la base existante pour faire passer un test.

---

## 18. Préférences UI

Les préférences purement visuelles peuvent vivre dans `localStorage`.

Clés connues :

```text
textotheque:pane-widths:v1
textotheque:collapsed-folders:v1
```

Ne pas stocker des données métier dans `localStorage`.

SQLite reste la source de vérité pour :

- documents ;
- dossiers ;
- métadonnées métier ;
- corbeille.

---

## 19. Périmètre fonctionnel actuel

Fonctionnalités présentes :

- documents texte brut ;
- création ;
- édition ;
- sauvegarde explicite ;
- dirty state ;
- confirmation anti-perte ;
- recherche simple ;
- barre de statut ;
- raccourcis clavier ;
- corbeille ;
- restauration ;
- vidage de corbeille ;
- dossiers virtuels ;
- sous-dossiers ;
- renommage ;
- création contextualisée ;
- documents dans l’arborescence ;
- repli/dépli ;
- panneaux redimensionnables ;
- métadonnées simples.

Fonctionnalités volontairement absentes ou reportées :

- Markdown réel ;
- texte enrichi ;
- autosave ;
- import/export ;
- tags ;
- collections ;
- drag and drop ;
- déplacement de dossiers ;
- suppression de dossiers ;
- recherche FTS ;
- historique documentaire ;
- packaging ;
- IA.

Ne pas ajouter une de ces fonctionnalités hors mission explicite.

---

## 20. UX : préserver les comportements existants

Les comportements suivants sont déjà établis et doivent être conservés sauf demande contraire :

- `Ctrl+S` : sauvegarde ;
- `Ctrl+N` : nouveau document avec contexte courant ;
- `Ctrl+F` : recherche ;
- `Escape` : annulation de dialogue / effacement recherche selon contexte ;
- `F2` : focus titre ;
- documents en corbeille en lecture seule ;
- changement de document protégé si modifications non sauvegardées ;
- création dans un dossier depuis son contexte ;
- document sélectionné visible dans l’arborescence ;
- dossiers repliés persistés localement.

---

## 21. Gestion des erreurs

La gestion des erreurs IPC est actuellement inégale.

La sauvegarde possède une gestion plus complète que plusieurs autres actions.

Lors d’une mission concernant :

- création ;
- chargement ;
- dossiers ;
- renommage ;
- corbeille ;
- restauration ;
- IPC ;

ne pas masquer une erreur.

Ne pas ajouter une refonte globale de la gestion d’erreurs hors mission dédiée.

Si une erreur existante est découverte hors périmètre :

- la documenter ;
- ne la corriger que si elle bloque directement la mission.

---

## 22. Rapports de mission

Chaque mission doit produire un rapport Markdown dans :

```text
reports/
```

Convention :

```text
NNN_description_report.md
```

Le rapport doit contenir au minimum :

```markdown
# Rapport — Titre

## Objectif

## Fichiers modifiés

## Fonctionnement ajouté ou correction apportée

## Choix techniques

## Vérifications effectuées

## Commandes lancées

## Points non traités

## Risques / limites

## Suite recommandée
```

Pour une correction de bug, ajouter :

```markdown
## Symptôme initial

## Diagnostic
```

Pour une migration :

```markdown
## Migration SQLite

## Compatibilité legacy
```

---

## 23. Fin de mission

Avant de déclarer une mission terminée :

1. vérifier que l’objectif demandé est réellement atteint ;
2. exécuter les tests appropriés ;
3. vérifier les codes de sortie ;
4. relever les avertissements connus ;
5. exécuter :

```powershell
git status --short
git diff --stat
```

6. vérifier qu’aucun fichier hors périmètre n’a été modifié accidentellement ;
7. créer le rapport ;
8. ne pas committer automatiquement ;
9. ne pas modifier la version si cela n’était pas nécessaire.

---

## 24. Documents de référence prioritaires

Ordre recommandé :

```text
README.md
AGENTS.md
reports/015_project_state_audit.md
rapports récents liés à la mission
code réel
```

Le README décrit aussi une vision cible.

Le rapport 015 décrit l’état réel observé à la reprise du 15 août 2026.

Le code reste la vérité finale si une divergence existe.

---

## 25. Règle finale

Textothèque n’a pas besoin d’être réinventée à chaque mission.

Elle doit être améliorée progressivement.

Avant d’ajouter quelque chose :

> comprendre l’existant, préserver ce qui fonctionne, modifier le minimum nécessaire, tester, documenter.
