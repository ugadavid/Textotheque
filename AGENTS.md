# AGENTS.md — Textothèque

Ce fichier définit les règles de travail pour tout agent intervenant sur **Textothèque**.

Textothèque est une application desktop locale, DB-first, construite avec Electron, Vite, React, TypeScript et SQLite.

Le projet avance volontairement par **baby steps** : petites missions, périmètre clair, tests ciblés, rapport obligatoire.

---

## 1. Lecture obligatoire avant toute intervention

Avant de modifier quoi que ce soit :

1. lire `README.md` en entier ;
2. lire `AGENTS.md` en entier ;
3. lire `reports/015_project_state_audit.md` pour le contexte historique de reprise ;
4. lire les rapports récents directement liés au sujet traité ;
5. si la mission touche aux bibliothèques SQLite, lire aussi :
   - `docs/DB_ROADMAP.md` ;
6. vérifier le code réel avant de se fier aux rapports historiques ;
7. exécuter :

```powershell
git status --short
git diff --stat
```

Ne jamais supposer que le worktree est propre.

Ne jamais écraser, nettoyer ou remettre à zéro des modifications existantes sans demande explicite.

Le code réel reste la vérité finale lorsqu’un ancien rapport ou document décrit un état devenu obsolète.

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
- les fonctionnalités annexes ajoutées pendant une mission différente ;
- les garde-fous disproportionnés par rapport au besoin réel.

Textothèque est un outil personnel d’écriture et de classement, pas un système bancaire.

La simplicité reste un objectif technique.

---

## 3. Principe fondamental : DB-first

SQLite est la source de vérité pour les documents et l’organisation métier.

Un document Textothèque ne doit pas dépendre d’un fichier externe pour exister.

Les fichiers externes sont ou seront :

- des imports volontaires ;
- des exports volontaires ;
- des sauvegardes explicites de bibliothèque ;
- jamais le stockage documentaire principal.

Ne pas transformer Textothèque en explorateur de fichiers.

Ne pas créer automatiquement un `.txt`, `.md` ou autre fichier externe pour chaque document.

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
→ ActiveLibraryManager / TextothequeDatabase
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

Le preload est :

```text
electron/preload.cts
```

et compile en :

```text
dist-electron/preload.cjs
```

Ce choix corrige un bug historique de preload ESM.

Ne pas revenir à un preload ESM classique sans raison explicite et tests adaptés.

---

## 5. Identité Electron et profil utilisateur

Textothèque possède désormais une identité Electron explicite :

```text
productName / app name : Textotheque
```

Le profil utilisateur est :

```text
%APPDATA%\Textotheque
```

La bibliothèque par défaut est conceptuellement :

```text
%APPDATA%\Textotheque\textotheque.sqlite
```

Le registre durable des bibliothèques connues vit également dans le profil Textothèque.

Ne pas revenir au profil générique :

```text
%APPDATA%\Electron
```

Le test ciblé est :

```powershell
npm.cmd run test:app-identity
```

La surcharge :

```text
TEXTOTHEQUE_DB_PATH
```

reste prioritaire pour les tests, diagnostics et lancements contrôlés.

---

## 6. Bibliothèques Textothèque : identité et schéma

Une bibliothèque Textothèque possède deux identifiants distincts.

### Identité de format

```text
TEXTOTHEQUE_APPLICATION_ID
hex      : 0x5445584F
decimal  : 1413830735
mnemonic : TEXO
```

Cet identifiant est **permanent**.

Ne jamais le modifier en fonction de la version de l’application.

### Version de schéma

SQLite utilise :

```sql
PRAGMA user_version
```

Le schéma courant est actuellement :

```text
CURRENT_SCHEMA_VERSION = 4
```

La version de schéma est indépendante de la version applicative.

---

## 7. Source canonique du schéma et migrations SQLite

La source canonique runtime est :

```text
electron/database.ts
```

`db/schema.sql` est un snapshot documentaire du schéma courant. Il n’est pas exécuté par l’application.

Toute future évolution structurelle doit :

1. incrémenter `CURRENT_SCHEMA_VERSION` ;
2. ajouter une migration explicite et ordonnée ;
3. rendre la migration idempotente ;
4. utiliser une transaction lorsque plusieurs opérations dépendent les unes des autres ;
5. mettre à jour `PRAGMA user_version` seulement après réussite ;
6. mettre à jour le snapshot `db/schema.sql` ;
7. ajouter ou adapter une fixture legacy ;
8. conserver les données existantes.

Ordre d’initialisation à préserver :

```text
1. ouvrir SQLite
2. configurer les PRAGMA nécessaires
3. créer / reconnaître le socle
4. détecter identité + version
5. appliquer les migrations dans l’ordre
6. valider le schéma final
7. créer / vérifier les index
8. seulement ensuite exécuter les opérations applicatives
```

Ne jamais créer un index dépendant d’une colonne avant d’avoir garanti l’existence de cette colonne.

Ce problème a déjà provoqué un bug réel avec `deleted_at`.

Le schéma 4 ajoute `documents_fts`, une table FTS5 external-content indexant uniquement `title`, `content` et `notes` avec `unicode61 remove_diacritics 2`. La table `documents` reste la source de vérité. Les triggers dédiés maintiennent l’index lors des insertions, modifications textuelles réelles et suppressions physiques. Un `rebuild` est réservé à la migration ou à une réparation explicite, jamais au démarrage normal.

### La base n’est pas un dépotoir

SQLite n’est pas un simple conteneur de valeurs brutes que l’application doit aspirer pour tout retraiter en mémoire.

Lorsqu’une opération est naturellement **ensembliste** et s’exprime clairement dans la base, préférer la laisser à la base, notamment pour :

- filtrer ;
- trier ;
- agréger (`COUNT`, `MIN`, `MAX`, etc.) ;
- rechercher ;
- dédupliquer ;
- appliquer des contraintes simples ;
- vérifier une existence ;
- calculer une valeur dérivée simple sur un ensemble.

Éviter sans raison des flux du type :

```text
SELECT beaucoup de lignes
→ tableau JavaScript
→ filtrage / tri / MAX / déduplication en mémoire
```

si SQLite peut produire directement le résultat utile avec une requête claire et bornée.

La règle inverse est tout aussi importante :

> ne pas forcer toute logique métier dans SQL uniquement parce que SQL peut l’exprimer.

Placer chaque responsabilité là où elle reste la plus :

- claire ;
- bornée ;
- vérifiable ;
- efficace ;
- maintenable.

La base doit être utilisée comme un moteur de données, pas comme un dépotoir ; l’application doit rester l’endroit naturel des comportements applicatifs.

### Types et domaines : partir du métier, pas de la capacité maximale

Avant de choisir une représentation technique, définir le **domaine réel** de la donnée :

```text
quelles valeurs sont valides ?
quelle borne est raisonnable ?
NULL a-t-il un sens ?
quelle unité ?
quelle précision ?
quelle cardinalité ?
quelle durée de vie ?
```

Puis choisir la représentation la plus simple et la plus appropriée.

Ne pas surdimensionner « au cas où ».

Exemples de mauvaises habitudes à éviter :

```text
entier arbitrairement énorme
alors que le domaine métier vaut 1..99

texte
pour une donnée naturellement numérique ou booléenne

chaîne libre
pour un petit ensemble fermé de valeurs

conversion répétée à chaque requête
parce que la représentation persistée ne correspond pas au domaine
```

Principe :

> choisir les types à partir du domaine métier, pas à partir de la capacité maximale du langage ou du moteur.

Dans SQLite, tenir compte de son typage dynamique : raisonner en termes de **type affinity, représentation, nullabilité et contraintes explicites**, et ajouter un `CHECK` ou une autre contrainte lorsque cela protège réellement un invariant métier sans alourdir inutilement le modèle.

Ne pas utiliser `BigInt`, un domaine numérique arbitrairement large ou une représentation textuelle simplement parce qu’ils sont techniquement disponibles.

Une borne métier raisonnable vaut mieux qu’une « infinité technique » sans besoin réel.

### Conversions et index

Éviter les conversions implicites ou répétées qui rendent les requêtes ambiguës ou empêchent l’usage naturel d’un index.

Lorsqu’une donnée sert régulièrement à :

- filtrer ;
- joindre ;
- trier ;
- agréger ;

sa représentation persistée doit être cohérente avec cet usage.

Ne pas ajouter un index « au cas où ». Un index doit répondre à un accès réel ou à une contrainte réelle, et son coût d’écriture et de stockage fait partie du choix.

### Le schéma est un contrat

Le schéma doit exprimer autant que raisonnablement possible :

- la forme des données ;
- leur nullabilité ;
- leurs relations ;
- leurs domaines fermés ou bornés lorsque cela a du sens ;
- les invariants que la base peut garantir simplement.

Ne pas laisser volontairement entrer n’importe quelle valeur sous prétexte que « le code vérifiera plus tard ».

Inversement, ne pas transformer SQLite en forteresse disproportionnée : Textothèque reste une application personnelle locale et les contraintes doivent rester proportionnées au risque réel.

---

## 8. Compatibilité legacy

Les anciennes bases Textothèque sans `application_id` peuvent être reconnues uniquement si leur structure correspond exactement à un état historique connu.

Une base non signée arbitraire ne doit jamais être adoptée comme Textothèque.

Après adoption/migration réussie :

```text
application_id = TEXO
```

Une base étrangère signée différemment doit être refusée sans mutation.

Une base avec :

```text
user_version > CURRENT_SCHEMA_VERSION
```

doit être refusée sans downgrade ni ouverture forcée.

Test principal :

```powershell
npm.cmd run test:legacy-migration
```

---

## 9. Inspection d’une bibliothèque

Toute bibliothèque choisie manuellement doit être inspectée **en lecture seule avant toute mutation**.

L’inspection doit déterminer au minimum :

- SQLite lisible ou non ;
- `application_id` ;
- `user_version` ;
- identité Textothèque / legacy / étrangère ;
- compatibilité ;
- schéma trop récent ou incohérent.

L’inspection ne doit pas déclencher :

- migration ;
- adoption ;
- création d’index ;
- nettoyage des brouillons ;
- mise à jour de `last_opened_at` ;
- autre écriture applicative.

---

## 10. Ouverture et changement de bibliothèque

La bascule doit rester atomique :

```text
ouvrir candidat
→ vérifier lectures minimales
→ remplacer seulement ensuite la connexion active
→ fermer l’ancienne connexion
```

En cas d’échec du candidat :

> la bibliothèque actuelle reste active et utilisable.

Ne jamais fermer d’abord l’ancienne base puis « espérer » que la suivante s’ouvre.

Le dirty state doit être protégé avant :

- `Nouvelle bibliothèque…` ;
- `Ouvrir une bibliothèque…` ;
- bascule depuis `Bibliothèques connues`.

---

## 11. Migration utilisateur

Une bibliothèque choisie manuellement qui nécessite une migration ou une adoption TEXO ne doit jamais être modifiée silencieusement.

Flux obligatoire :

```text
inspection
→ information utilisateur
→ accord
→ backup pré-migration
→ vérification du backup
→ migration / adoption
→ validation
→ ouverture
```

Si le backup échoue :

```text
migration annulée
```

Si la migration échoue :

- ne pas basculer ;
- conserver la bibliothèque actuelle ;
- conserver le backup pré-migration ;
- afficher une erreur utilisateur simple ;
- journaliser le détail technique.

Ne pas créer un second moteur de migrations pour les bibliothèques ouvertes manuellement : réutiliser le moteur runtime versionné.

---

## 12. Sauvegardes de bibliothèque

La commande de sauvegarde crée un **snapshot SQLite cohérent**, pas une copie naïve du fichier actif.

Le mécanisme actuel utilise :

```text
better-sqlite3.backup()
```

Après sauvegarde, le snapshot est inspecté.

Un backup manuel :

- contient toute la bibliothèque ;
- ne change jamais la bibliothèque active ;
- ne devient jamais automatiquement une bibliothèque connue ;
- ne doit pas écraser la bibliothèque source.

Si le document courant est dirty, ne pas produire silencieusement un backup incomplet : demander d’abord de sauvegarder le document.

---

## 13. Registre durable des bibliothèques connues

Le registre appartient à l’application Textothèque, jamais à une bibliothèque SQLite.

Fichier par défaut :

```text
%APPDATA%\Textotheque\library-history.json
```

Le registre contient uniquement des informations d’usage, par exemple :

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

Règles :

- aucune limite numérique ;
- aucune purge automatique ;
- ajout uniquement après activation réussie ;
- `firstOpenedAt` est conservé ;
- `lastOpenedAt` est mis à jour après activation réussie ;
- doublons évités via chemin canonique ;
- backups exclus du registre ;
- candidats refusés exclus du registre ;
- bibliothèques manquantes conservées comme introuvables ;
- ne jamais recréer automatiquement un fichier à partir d’une entrée historique.

Une panne du registre ne doit jamais rendre inutilisable une bibliothèque déjà activée.

---

## 14. Démarrage et dernière bibliothèque

Au démarrage, Textothèque tente de rouvrir :

```text
lastActivePath
```

uniquement si la bibliothèque existe et est directement compatible.

Si elle est :

- absente ;
- legacy nécessitant intervention ;
- trop récente ;
- étrangère ;
- invalide ;

Textothèque revient proprement à la bibliothèque par défaut.

Aucune migration silencieuse d’une bibliothèque externe au démarrage.

L’entrée historique problématique reste conservée.

---

## 15. Nouvelle bibliothèque

`Nouvelle bibliothèque…` doit :

1. respecter le dirty guard ;
2. refuser d’écraser un fichier préexistant ;
3. créer un fichier TEXO neuf ;
4. initialiser le schéma courant ;
5. valider ;
6. basculer atomiquement ;
7. inscrire la bibliothèque au registre après succès.

En cas d’échec de création, ne supprimer que le fichier dont Textothèque sait avec certitude qu’elle vient de créer pendant ce flux.

Ne jamais nettoyer un fichier préexistant.

---

## 16. Corbeille et opérations destructives

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
- vidage ;
- futures suppressions documentaires ou de dossiers.

Le nettoyage des brouillons strictement vides se fait au démarrage après migrations et passe par la corbeille logique.

Il exclut toujours les documents spéciaux :

```text
documents.special_role IS NOT NULL
→ jamais nettoyé comme brouillon vide
```

### TODO permanent par bibliothèque

Le TODO est un document ordinaire de la table `documents`, identifié par :

```text
special_role = 'todo'
```

Le domaine persistant actuel est fermé à `NULL | 'todo'`. Un index unique partiel garantit au plus un document spécial par rôle et par bibliothèque.

Règles à préserver :

- création paresseuse et atomique au premier accès ;
- titre initial `TODO`, ensuite modifiable librement ;
- `content_format = 'plain'` et autosave documentaire commun ;
- absence de l’arborescence normale uniquement ;
- présence dans la recherche, « Tous les textes », les compteurs généraux et les backups ;
- refus de la mise à la corbeille dans le renderer et dans la couche DB ;
- aucune identification du rôle par le titre ;
- aucune donnée TODO externe, aucun éditeur ou format parallèle.

---

## 17. Cohérence légère des dossiers

Textothèque utilise volontairement des garde-fous applicatifs simples.

Lors d’une écriture :

```text
documents.folder_id != NULL
→ le dossier doit exister
```

```text
folders.parent_id != NULL
→ le parent doit exister
```

Ne pas activer brutalement les clés étrangères SQLite, cascades ou règles complexes sans mission dédiée et besoin réel.

Les API actuelles ne permettent pas encore de déplacement/changement de parent de dossier : ne pas anticiper inutilement un moteur de cycles.

---

## 18. Dates persistées

La convention applicative est :

```text
UTC
ISO 8601
new Date().toISOString()
```

La couche DB utilise le helper local `nowIso()` pour les écritures temporelles.

Les anciens defaults SQL `datetime('now')` restent des filets de secours historiques.

Ne pas lancer une migration de dates sans besoin fonctionnel réel.

---

## 19. Versionnement applicatif : baby steps

La source canonique de version est :

```text
package.json
```

Vite injecte la version dans le renderer via :

```text
__APP_VERSION__
```

Ne pas recréer une seconde constante de version dans `src/`.

Le numéro de mission et le numéro de version sont indépendants.

Règle générale :

```text
0.1.x = évolution progressive du produit
0.2.x = vrai nouveau palier décidé explicitement
```

Ne pas passer à `0.2.0` sans décision explicite du mainteneur.

Ne pas modifier la version pour une consolidation purement interne si le comportement fonctionnel ne le justifie pas.

---

## 20. Pipeline TypeScript renderer

Le renderer utilise :

```text
noEmit: true
```

Les sources `.ts/.tsx` doivent rester les seules sources applicatives dans `src/`.

Aucun `.js` ou `.d.ts` généré adjacent ne doit réapparaître, à l’exception des déclarations source volontaires, notamment :

```text
src/types/electron.d.ts
src/types/build.d.ts
```

Ne jamais modifier manuellement des artefacts générés.

Si un build recrée des `.js/.d.ts` parasites dans `src/`, traiter cela comme une régression du pipeline.

---

## 21. Serveur de développement

Vite utilise :

```text
port: 5173
strictPort: true
```

`wait-on` et Electron utilisent le même port.

Si `5173` est occupé :

```text
le démarrage doit échouer clairement
```

et ne jamais basculer silencieusement vers `5174`.

Le lanceur :

```text
START_TEXTOTHEQUE.bat
```

effectue également un contrôle préalable du port.

Ne pas tuer arbitrairement le propriétaire d’un port.

---

## 22. better-sqlite3 / Electron

Le rebuild natif détecte automatiquement la version Electron réellement installée.

Ne jamais réintroduire une cible Electron codée en dur.

Commande :

```powershell
npm.cmd run rebuild:electron
```

Toujours vérifier ensuite :

```powershell
npm.cmd run test:electron-sqlite
```

Ne pas lancer :

```text
npm install
npm update
npm audit fix
```

ou modifier les dépendances sans nécessité explicite de mission.

---

## 23. Gestion des erreurs IPC

Tous les handlers IPC `invoke` doivent passer par le mécanisme commun de journalisation/propagation.

Règles :

- détail technique dans les logs ;
- message utilisateur simple ;
- aucun `UnhandledPromiseRejection` ;
- aucun faux succès UI ;
- aucune mutation locale avant confirmation de la réussite distante lorsque cela compromettrait la cohérence.

Le renderer utilise le helper commun de normalisation des erreurs.

Une opération suivante réussie doit pouvoir effacer l’ancien message d’erreur pertinent.

Test ciblé :

```powershell
npm.cmd run test:ipc-error
```

---

## 24. Tests existants

Commandes principales actuelles :

```powershell
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
npm.cmd run test:auto-title
npm.cmd run test:special-todo
npm.cmd run test:catalog
npm.cmd run test:search
```

### Rôle des principaux tests

`test:app-identity`

- identité Electron ;
- `userData` ;
- chemin DB par défaut ;
- surcharge `TEXTOTHEQUE_DB_PATH`.

`test:legacy-migration`

- anciennes structures ;
- `user_version` ;
- adoption TEXO ;
- préservation des données.

`test:db`

- documents ;
- dossiers ;
- corbeille ;
- intégrité légère ;
- timestamps.

`test:electron-sqlite`

- ABI Electron / `better-sqlite3`.

`test:preload`

- exposition de `window.textotheque` ;
- rejets récupérables ;
- API bibliothèque.

`test:ui-safeguards`

- parcours renderer ;
- raccourcis ;
- dirty state ;
- navigation ;
- panneaux ;
- dialogues ;
- erreurs forcées.

`test:ipc-error`

- vraie propagation SQLite → main → IPC → preload → renderer.

`test:library`

- identité ;
- inspection ;
- backup ;
- ouverture ;
- migration/adoption ;
- bascule atomique.

`test:library-history`

- historique durable ;
- création de bibliothèque ;
- fallback startup ;
- entrées introuvables ;
- déduplication ;
- absence de purge.

`test:special-todo`

- migration de schéma 2 vers le schéma courant ;
- création paresseuse et unicité du TODO ;
- permanence, nettoyage des brouillons et indépendance des bibliothèques ;
- conservation par backup.

`test:search`

- migration 3 vers 4 et reconstruction initiale FTS5 ;
- synchronisation external-content et vérification d’intégrité ;
- CI_AI fixe, zones, modes de correspondance et caractères spéciaux ;
- périodes civiles locales, date seule et texte + date ;
- snippets légers, corbeille, TODO et backup.

---

## 25. Tests UI : automatiser seulement ce qui doit rester vrai

Ne pas sur-automatiser l’ergonomie.

Automatiser :

- états ;
- transitions ;
- raccourcis ;
- persistance ;
- erreurs ;
- dirty state ;
- masquage/affichage ;
- invariants de navigation ;
- responsive réellement critique.

Laisser au mainteneur les vérifications humaines rapides :

- esthétique ;
- confort ;
- densité ;
- proportions ;
- placement ;
- wording ;
- feeling général ;
- rendu de menus/dialogues natifs.

Principe :

> automatiser ce qui doit rester vrai ; faire tester par l’humain ce qui doit être agréable.

---

## 26. Avertissements Electron Windows connus

Certains tests Electron peuvent afficher :

```text
os_crypt_win.cc
gpu_process_host.cc
```

Ils sont historiquement non bloquants lorsque :

- le code de sortie est `0` ;
- les assertions sont atteintes ;
- le message final de succès est affiché.

Ne pas ignorer une vraie exception ou un code non nul sous prétexte qu’Electron produit parfois du bruit.

---

## 27. Ressources temporaires de tests

Tout test qui crée une ressource temporaire doit connaître précisément son chemin.

Les helpers partagés créent des répertoires sous :

```text
%TEMP%\textotheque-test-*
```

Règles :

- fermer SQLite avant suppression ;
- attendre la fin des processus Electron propriétaires ;
- nettoyer uniquement le répertoire créé par le test ;
- vérifier sa disparition ;
- nettoyer aussi après exception lorsque possible ;
- ne jamais scanner `%TEMP%` pour supprimer par motif global.

Les tests multi-bibliothèques et le registre de tests doivent rester entièrement sous ressources temporaires.

### Verrous Windows : diagnostiquer avant le marteau à retries™

En cas de :

```text
EBUSY
EPERM
resource busy or locked
```

ne pas augmenter mécaniquement le nombre de retries.

Identifier d’abord la ressource ou le processus encore propriétaire du fichier ou du répertoire :

- fenêtre Electron non fermée ;
- processus Chromium encore actif ;
- profil Chromium / LevelDB encore ouvert ;
- connexion SQLite encore ouverte ;
- flux de fichier non libéré ;
- autre ressource explicitement détenue par le test.

Fermer correctement le propriétaire, attendre sa libération normale, puis nettoyer.

Un retry **borné et court** peut absorber un délai normal de libération propre à Windows. Il ne doit jamais servir à masquer une ressource encore légitimement ouverte.

Principe :

> diagnostiquer d’abord ; utiliser le marteau à retries™ seulement comme petit maillet de finition, jamais comme méthode de libération de ressources.

Ne jamais contourner un verrou en abandonnant le nettoyage des ressources temporaires.

Ne jamais utiliser :

```text
%APPDATA%\Textotheque\library-history.json
```

dans un test automatisé.

---

## 28. Données utilisateur

Les bibliothèques réellement utilisées par le mainteneur sont désormais présumées **précieuses**.

Les tests automatisés ne doivent jamais :

- ouvrir la bibliothèque utilisateur réelle ;
- modifier son registre réel ;
- tester une migration dessus ;
- supprimer ou recréer sa base ;
- modifier un backup réel.

Utiliser :

- `TEXTOTHEQUE_DB_PATH` ;
- chemins temporaires ;
- registres temporaires ;
- fixtures contrôlées.

---

## 29. Préférences UI

Les préférences purement visuelles peuvent vivre dans `localStorage`.

Clés actuelles importantes :

```text
textotheque:expanded-folders:v2
textotheque:pane-layout:v2
```

Les anciennes clés peuvent rester présentes pour compatibilité historique, mais ne doivent pas redevenir la source principale.

Ne pas stocker des données métier dans `localStorage`.

SQLite reste la source de vérité pour les données métier.

Le registre des bibliothèques est une préférence applicative du main process, pas du `localStorage`.

---

## 30. Périmètre fonctionnel actuel

Fonctionnalités présentes notamment :

- documents texte brut ;
- création / édition / sauvegarde explicite ;
- dirty state ;
- confirmation anti-perte ;
- recherche plein texte FTS5 CI_AI avec zones et modes explicites ;
- filtre rapide de période de création ;
- résultats dans le catalogue central avec pertinence et snippets ;
- barre de statut ;
- raccourcis clavier ;
- corbeille / restauration / vidage ;
- dossiers virtuels et sous-dossiers ;
- renommage ;
- création contextualisée ;
- arborescence repliable ;
- panneaux redimensionnables et escamotables ;
- identité TEXO ;
- backup vérifié ;
- ouverture de bibliothèques ;
- migration/adoption avec accord ;
- menu racine `Bibliothèque` ;
- création d’une bibliothèque ;
- registre durable des bibliothèques connues ;
- réouverture de la dernière bibliothèque compatible.
- TODO permanent propre à chaque bibliothèque.

Fonctionnalités volontairement absentes ou reportées :

- Markdown réel ;
- texte enrichi ;
- autosave ;
- import/export documentaire ;
- menu `Fichier` documentaire ;
- tags ;
- collections ;
- drag and drop ;
- déplacement de dossiers ;
- suppression de dossiers ;
- historique documentaire ;
- packaging ;
- synchronisation/cloud ;
- gestion manuelle avancée du registre de bibliothèques.

Ne pas ajouter une fonctionnalité hors mission explicite.

---

## 31. UX : comportements à préserver

### Découvrabilité et menus

Lors de l’ajout d’une fonctionnalité utilisateur, déterminer explicitement si elle mérite un accès depuis un menu natif.

Principe général :

- toolbar : actions fréquentes et directement utiles dans le contexte courant ;
- menus : actions structurantes, occasionnelles ou devant rester découvrables ;
- raccourcis clavier : accès rapide pour les usages fréquents.

Une même fonctionnalité peut légitimement disposer des trois lorsque ces accès répondent à des usages différents. Ne pas ajouter automatiquement chaque commande dans chaque surface : choisir selon l’usage réel et éviter les menus surchargés.

Lorsqu’une commande de menu possède un raccourci, l’afficher dans le menu lorsque la plateforme le permet naturellement. Garantir qu’un raccourci ne déclenche qu’une seule intention applicative.

Conserver sauf demande contraire :

```text
Ctrl+S → sauvegarde document
Ctrl+N → nouveau document dans le contexte courant
Ctrl+F → recherche globale
Ctrl+Shift+T → ouvrir le TODO de la bibliothèque active
Escape → annulation / sortie recherche selon contexte
F2 → focus titre
```

Autres invariants :

- document en corbeille en lecture seule ;
- TODO permanent jamais placé dans la corbeille ;
- changement de document protégé si dirty ;
- changement de bibliothèque protégé si dirty ;
- backup bibliothèque refusé si document dirty ;
- création dans un dossier depuis son contexte ;
- document sélectionné visible dans l’arborescence ;
- dossiers fermés par défaut hors chemin ouvert ;
- panneaux latéraux masquables indépendamment ;
- largeurs/visibilités de panneaux persistées ;
- bibliothèque courante identifiable ;
- opérations occasionnelles de bibliothèque dans le menu `Bibliothèque`.

---

## 32. Git : règle de travail

Avant chaque mission :

```powershell
git status --short
git diff --stat
```

Après la mission :

```powershell
git status --short
git diff --stat
git diff --name-only
git diff --check
```

Ne jamais :

- `git reset --hard` ;
- nettoyer le dépôt ;
- supprimer des fichiers inconnus ;
- réécrire l’historique ;
- committer automatiquement ;

sans demande explicite.

Le mainteneur décide du commit.

Une mission doit préserver tout travail déjà présent dans le worktree.

---

## 33. Rapports de mission

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

## Versionnement

## Points non traités

## Risques / limites

## Suite recommandée
```

Pour une correction de bug :

```markdown
## Symptôme initial

## Diagnostic
```

Pour une migration :

```markdown
## Migration SQLite

## Compatibilité legacy
```

Pour une mission bibliothèque :

```markdown
## Inspection
## Backup / migration
## Atomicité de la bascule
## Ressources temporaires
```

---

## 34. Fin de mission

Avant de déclarer une mission terminée :

1. vérifier que l’objectif demandé est réellement atteint ;
2. exécuter les tests appropriés ;
3. vérifier les codes de sortie ;
4. relever les avertissements connus ;
5. exécuter les contrôles Git finaux ;
6. vérifier qu’aucun fichier hors périmètre n’a été modifié accidentellement ;
7. vérifier qu’aucune donnée utilisateur réelle n’a été utilisée par les tests ;
8. créer le rapport ;
9. ne pas committer automatiquement ;
10. ne pas modifier la version si cela n’était pas nécessaire.

---

## 35. Documents de référence prioritaires

Ordre recommandé :

```text
README.md
AGENTS.md
docs/DB_ROADMAP.md       si la mission touche aux bibliothèques
rapports récents liés à la mission
reports/015_project_state_audit.md pour contexte historique
code réel
```

Le README décrit aussi une vision cible.

`docs/DB_ROADMAP.md` décrit le contrat durable des bibliothèques SQLite.

Les rapports décrivent l’histoire des choix.

Le code reste la vérité finale.

---

## 36. Règle finale

Textothèque n’a pas besoin d’être réinventée à chaque mission.

Elle doit être améliorée progressivement.

Avant d’ajouter quelque chose :

> comprendre l’existant, préserver ce qui fonctionne, modifier le minimum nécessaire, tester ce qui doit rester vrai, puis laisser l’humain juger ce qui doit être agréable.
