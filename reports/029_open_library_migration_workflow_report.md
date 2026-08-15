# Rapport — Ouverture de bibliothèque et migration avec accord

## Objectif

Permettre à Textothèque `0.1.17` d’ouvrir manuellement une bibliothèque SQLite existante après inspection non destructive, avec accord explicite et backup vérifié lorsqu’une migration ou une adoption TEXO est nécessaire.

## État initial

La Mission 028 fournissait l’identité stable `TEXO`, l’inspection readonly, le snapshot complet vérifié et l’affichage de la bibliothèque active. Le main process ne pouvait toutefois utiliser que la base par défaut et la construction de `TextothequeDatabase` pouvait migrer immédiatement un fichier.

Le worktree était propre au début de la mission. La base et les backups réels du mainteneur n’ont pas été utilisés.

## Fichiers modifiés

- `electron/database.ts`
- `electron/library-manager.ts` (nouveau)
- `electron/main.ts`
- `electron/preload.cts`
- `src/services/library.ts`
- `src/types/library.ts`
- `src/types/electron.d.ts`
- `src/App.tsx`
- `src/components/EditorPane.tsx`
- `src/styles/app.css`
- `scripts/electron-library-check.cjs`
- `scripts/electron-preload-api-check.cjs`
- `scripts/electron-ui-safeguards-check.cjs`
- `docs/DB_ROADMAP.md`
- `package.json`
- `package-lock.json`
- `reports/029_open_library_migration_workflow_report.md`

## Sélection d’une bibliothèque

Une commande distincte `Ouvrir bibliothèque…` a été ajoutée près de `Copie bibliothèque…`. Elle appelle un dialogue natif Electron privilégiant `*.sqlite`, tout en laissant le filtre « Tous les fichiers ». Une annulation retourne un état neutre et ne modifie ni la DB ni l’interface.

## Inspection avant ouverture

`library:choose-open` ne construit pas `TextothequeDatabase` pour le candidat. Il appelle l’inspection readonly de la Mission 028, puis retourne un état typé : compatible, migration nécessaire, même bibliothèque, trop récente, étrangère ou invalide.

`library:open` réinspecte le fichier juste avant l’action afin de ne pas se fier aveuglément à une décision devenue ancienne entre le dialogue et la confirmation.

## Bascule atomique de la DB active

`ActiveLibraryManager` possède la connexion active et encapsule son remplacement. Pour un candidat autorisé, il :

1. ouvre la nouvelle connexion ;
2. vérifie les lectures documents, corbeille et dossiers ;
3. récupère l’identité finale ;
4. remplace seulement alors la connexion active ;
5. ferme ensuite l’ancienne connexion.

Un échec avant l’étape 4 laisse donc l’ancienne bibliothèque active et utilisable.

## Bibliothèque compatible

Une base TEXO au schéma courant est ouverte directement après la seconde inspection. Le test automatisé bascule de A vers B, vérifie les données B via le manager actif et rouvre A séparément pour confirmer qu’elle est intacte.

## Même bibliothèque

La comparaison réutilise la logique de chemin canonique de `TextothequeDatabase`, adaptée à Windows. Sélectionner le fichier actif retourne `same` sans fermeture ni réouverture et conserve l’état renderer.

## Bibliothèque legacy

Une bibliothèque historique reconnue, signée ou non, retourne `needs-migration`. Cela inclut une base non signée déjà au schéma 2 : l’écriture de l’identité TEXO reste soumise à l’accord utilisateur.

## Dialogue de migration/adoption

Le dialogue React anti-perte existant est réutilisé. Il distingue une ancienne bibliothèque à adopter d’un ancien format à migrer, annonce la copie automatique, et propose `Annuler` ou `Migrer et ouvrir`.

## Backup pré-migration

Le backup est créé à côté du candidat, sans second dialogue. Le nom est horodaté à la milliseconde et reçoit un suffixe si nécessaire :

- `<nom>_pre-migration_vN-to-v2_<timestamp>.sqlite` ;
- `<nom>_pre-adoption_<timestamp>.sqlite`.

Aucun fichier existant n’est écrasé. Une impossibilité d’écrire le backup annule le flux avant toute migration ou adoption.

## Vérification du backup

La source est ouverte readonly puis sauvegardée avec l’API backup SQLite. La copie est inspectée avant migration et doit conserver :

- la lisibilité SQLite ;
- la compatibilité legacy attendue ;
- `application_id` et `user_version` pré-migration ;
- une empreinte représentative des documents, dossiers, favoris, corbeille et volumes de contenu.

La vérification accepte volontairement un backup legacy ou ancien : elle compare l’état pré-migration au lieu d’exiger TEXO + schéma courant.

## Migration / adoption

Après validation du backup, le candidat passe par le constructeur runtime existant. Aucun second moteur de migration n’a été créé. Les migrations `schemaMigrations`, leurs transactions, l’adoption TEXO et la validation finale existantes restent la source de vérité.

Le test couvre une adoption sans changement de schéma et une vraie migration d’une fixture v0 jusqu’au schéma 2, avec conservation du contenu et du backup v0.

## Échec de backup

Un échec injecté retourne `backup-failed`. Le candidat reste byte-à-byte inchangé, A reste active et aucune ouverture migrante n’est tentée.

## Échec de migration

Un échec injecté après création du backup retourne `migration-failed`. Le backup existe encore, reste inspectable dans son état legacy et A demeure active. Le détail technique est journalisé dans le main process ; le renderer affiche un message simple.

## Bases étrangères / trop récentes / invalides

Ces trois états sont refusés après inspection readonly, sans construction du runtime sur le candidat. Les tests confirment que A reste active. Les contrôles hérités de la Mission 028 confirment aussi l’absence de mutation des fichiers étrangers.

## Dirty state

Le garde-fou anti-perte est exécuté avant même l’appel au sélecteur natif. Le test UI rend un document dirty, demande l’ouverture, annule le dialogue React, puis vérifie que le sélecteur IPC n’a pas été invoqué et que le dirty state est conservé.

## Rafraîchissement UI après bascule

Après succès, le renderer vide sélection et champs documentaires, quitte recherche et corbeille, revient à la navigation normale, recharge documents/dossiers/corbeille et met à jour l’identité en barre de statut. L’état des dossiers dépliés est réinitialisé car leurs identifiants sont propres à chaque base.

Les largeurs et visibilités de panneaux restent dans leur préférence globale et sont conservées.

## Persistance de session

Le chemin choisi n’est pas mémorisé. Un redémarrage revient donc encore à la bibliothèque par défaut `%APPDATA%\Textotheque\textotheque.sqlite`, conformément au périmètre. Les bibliothèques récentes et leur persistance restent prévues pour `0.1.18`.

## Tests bibliothèque

`test:library` couvre désormais :

- A vers B compatible, données B actives et A intacte ;
- même chemin en no-op ;
- refus foreign, too-new et invalid avec A active ;
- échec d’ouverture du candidat avec A active ;
- adoption legacy après accord et backup vérifié ;
- échec de backup sans mutation ni bascule ;
- échec de migration avec backup conservé et A active ;
- migration réelle v0 vers v2 avec données conservées.

Les erreurs `[Library ...]` visibles dans ce test correspondent aux échecs volontairement injectés.

## Tests UI minimaux

`test:preload` vérifie l’exposition et le passage des résultats de `chooseOpenLibrary` et `openLibrary`. `test:ui-safeguards` vérifie la présence de la commande, la version `0.1.17` et l’interception dirty avant sélection native.

Le dialogue Windows n’est pas automatisé pixel par pixel ; son appréciation ergonomique reste réservée au mainteneur.

## Ressources temporaires

Tous les scénarios SQLite utilisent le helper de Mission 025 sous `%TEMP%\textotheque-test-*`. Les backups de migration simulés restent dans le dossier propriétaire du test, sont vérifiés avant la fin, puis le dossier complet est nettoyé.

## Vérifications effectuées

Les neuf validations obligatoires ont terminé avec le code `0` :

- build TypeScript/Vite/Electron ;
- identité applicative ;
- migrations legacy ;
- couche DB ;
- ABI Electron / better-sqlite3 ;
- API preload ;
- garde-fous UI ;
- propagation d’erreurs IPC ;
- identité, backup et changement de bibliothèque.

Les avertissements Electron Windows observés lors de premiers lancements sandboxés concernaient l’accès au cache partagé. Les tests preload et UI ont ensuite été exécutés hors sandbox dans leur environnement Windows normal et ont réussi. Les rejets `SQLITE_FORCED` et `forced preload rejection` sont des scénarios négatifs attendus.

## Commandes lancées

```powershell
git status --short
git diff --stat
npm.cmd run build
npm.cmd run test:library
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
npm.cmd run build
npm.cmd run test:app-identity
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
npm.cmd run test:ipc-error
npm.cmd run test:library
git status --short
git diff --stat
git diff --name-only
git diff --check
```

## Versionnement

La version applicative passe de `0.1.16` à `0.1.17` dans `package.json` et `package-lock.json`. `package.json` reste la source canonique. `CURRENT_SCHEMA_VERSION` reste à `2` et aucune migration ni dépendance n’est ajoutée.

## Recommandations futures pour AGENTS.md

- Toute bibliothèque choisie manuellement doit être inspectée readonly avant construction du runtime.
- Une migration ou adoption manuelle exige un accord et un backup pré-migration vérifié.
- La connexion active ne doit être remplacée qu’après validation fonctionnelle du candidat.
- Un échec de backup, migration ou ouverture doit conserver la bibliothèque précédente active.
- Un backup pré-migration est conservé en cas d’échec et n’est jamais écrasé silencieusement.
- Les tests multi-bibliothèques doivent rester sous `%TEMP%` et ne jamais viser une base utilisateur.

`AGENTS.md` n’a pas été modifié pendant cette mission.

## Points non traités

- création d’une nouvelle bibliothèque ;
- bibliothèques récentes et mémorisation du dernier chemin ;
- choix alternatif si le dossier source n’est pas inscriptible ;
- réparation, downgrade ou ouverture forcée ;
- test ergonomique humain du sélecteur et des libellés.

## Risques / limites

Le backup automatique doit pouvoir être écrit à côté de la source ; sinon la migration est volontairement refusée. Une migration future composée de plusieurs versions reste transactionnelle par étape selon le moteur actuel, et non comme une transaction unique englobant toutes les versions. Le snapshot pré-migration constitue le parachute persistant dans ce cas.

Après la bascule main réussie, une panne IPC exceptionnelle pendant le rechargement renderer peut laisser l’interface vide avec un message d’erreur, mais jamais mélanger les données A sous l’identité B ; la nouvelle connexion reste alors la connexion active validée.

## Suite recommandée

Le mainteneur peut effectuer le test humain court prévu avec le backup réel de Mission 028, puis revenir à la bibliothèque principale et juger le placement et les messages. La Mission `0.1.18` pourra ensuite ajouter `Nouvelle bibliothèque…`, les bases récentes et une stratégie explicite de persistance du choix.
