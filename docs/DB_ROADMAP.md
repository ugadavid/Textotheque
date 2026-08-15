# Textothèque — DB Roadmap

## 0. Objet

Ce document définit la stratégie de Textothèque concernant ses bases SQLite lorsque l’application commence à être utilisée comme véritable outil d’écriture quotidien.

Il fixe notamment :

- l’identité d’une base Textothèque ;
- la distinction entre version applicative et version de schéma ;
- la détection de compatibilité ;
- la sauvegarde complète d’une bibliothèque ;
- l’ouverture d’une base existante ;
- la proposition de migration ;
- la création de nouvelles bibliothèques ;
- le choix et la mémorisation de plusieurs bases ;
- les garde-fous nécessaires pour ne pas perdre de contenu utilisateur.

Ce document est une **roadmap fonctionnelle et technique**.

Il ne remplace pas :

- `README.md` ;
- `AGENTS.md` ;
- le système de migrations runtime ;
- les rapports de mission.

---

# 1. Changement de statut des données

Jusqu’ici, les bases Textothèque ont principalement contenu des données de développement et de test.

À partir du moment où Textothèque commence à remplacer un éditeur de texte quotidien, une bibliothèque SQLite doit être considérée comme :

> **une archive utilisateur persistante et potentiellement irremplaçable.**

Conséquences :

- les tests automatisés n’utilisent jamais une bibliothèque utilisateur ;
- une migration ne détruit jamais une base pour la recréer ;
- une ouverture de base inconnue commence par une inspection ;
- une migration de bibliothèque utilisateur n’est pas silencieuse ;
- une sauvegarde cohérente doit être possible directement depuis l’application ;
- la base en cours d’utilisation doit toujours être clairement identifiable.

---

# 2. Trois notions à ne jamais confondre

Textothèque doit distinguer trois informations indépendantes.

## 2.1 Version de l’application

Exemple :

```text
0.1.15
```

Elle indique la version du logiciel Textothèque.

Elle évolue pour :

- nouvelles fonctionnalités ;
- corrections ;
- évolutions UX ;
- consolidations si cela est décidé.

Elle ne détermine pas directement la compatibilité d’une bibliothèque.

Une application peut passer de :

```text
0.1.15
→ 0.1.16
→ 0.1.17
```

sans aucun changement de schéma SQLite.

---

## 2.2 Identité de la bibliothèque

Une base doit pouvoir répondre à la question :

> « Suis-je réellement une bibliothèque Textothèque ? »

`PRAGMA user_version` ne suffit pas à lui seul.

Une base SQLite appartenant à une autre application pourrait très bien utiliser le même numéro.

Textothèque doit donc disposer d’une **signature de format**.

Solution privilégiée à étudier :

```sql
PRAGMA application_id
```

`application_id` est un entier SQLite destiné à identifier le format propriétaire d’un fichier SQLite.

Principe cible :

```text
application_id = identifiant stable Textothèque
```

L’identifiant numérique exact doit être choisi une fois, documenté et ne plus changer ensuite.

Décision définitive depuis la version `0.1.16` :

```text
TEXTOTHEQUE_APPLICATION_ID
hex       : 0x5445584F
decimal   : 1413830735
mnemonic  : TEXO
```

Cet identifiant est stable et indépendant de la version de l'application comme de `PRAGMA user_version`.

Une alternative légère n’est acceptable que si elle apporte un avantage réel.

Ne pas ajouter une table de métadonnées complexe uniquement pour stocker le nom du produit.

---

## 2.3 Version du schéma

Textothèque utilise actuellement :

```sql
PRAGMA user_version
```

État courant :

```text
schema version = 2
```

Le numéro de schéma évolue uniquement lorsque la structure ou le contrat persistant exige une migration.

Exemples :

```text
v2
documents + folders

v3
ajout éventuel de nouvelles tables/colonnes

v4
autre évolution du modèle
```

La version de schéma est indépendante de la version de l’application.

---

# 3. Contrat minimal d’une bibliothèque

Une bibliothèque Textothèque doit pouvoir être caractérisée par :

```text
SQLite valide
+
application_id Textothèque
+
user_version connu
+
structure minimale cohérente
```

Conceptuellement :

```text
Je suis une bibliothèque Textothèque.
Mon schéma est en version N.
```

---

# 4. Inspection avant ouverture

Toute base choisie manuellement par l’utilisateur doit être inspectée **avant d’être adoptée comme bibliothèque courante**.

L’inspection doit être distincte de l’ouverture applicative normale.

Elle doit pouvoir déterminer sans modifier le fichier :

1. le fichier existe-t-il ?
2. est-ce une base SQLite lisible ?
3. possède-t-elle l’identité Textothèque ?
4. quelle est sa `user_version` ?
5. la structure déclarée est-elle cohérente ?
6. la version est-elle :
   - actuelle ;
   - ancienne mais migrable ;
   - plus récente que l’application ;
   - inconnue/incohérente ?

L’inspection ne doit pas déclencher automatiquement :

- migrations ;
- nettoyage de brouillons ;
- modification de `last_opened_at` ;
- création d’index ;
- autre écriture applicative.

---

# 5. États de compatibilité

L’inspection doit aboutir à un petit ensemble d’états compréhensibles.

## 5.1 Compatible

```text
application_id = Textothèque
user_version = CURRENT_SCHEMA_VERSION
structure = valide
```

Action :

```text
ouvrir normalement
```

---

## 5.2 Ancienne mais migrable

```text
application_id = Textothèque
user_version < CURRENT_SCHEMA_VERSION
migration connue
```

Action :

```text
informer
→ proposer migration
```

Ne pas migrer silencieusement une bibliothèque choisie par l’utilisateur.

---

## 5.3 Plus récente que l’application

```text
user_version > CURRENT_SCHEMA_VERSION
```

Action :

```text
refuser l’ouverture en écriture
```

Message utilisateur attendu :

> Cette bibliothèque utilise une version de schéma plus récente que celle prise en charge par cette version de Textothèque.

Ne pas tenter :

```text
« ouvrir quand même »
« faire au mieux »
« rétrograder »
```

---

## 5.4 SQLite non Textothèque

SQLite valide mais identité absente ou différente.

Action :

```text
refuser comme bibliothèque Textothèque
```

Ne pas exécuter de migrations Textothèque sur cette base.

---

## 5.5 Base incohérente ou endommagée

Identité/version prétendument Textothèque, mais structure incompatible ou erreur SQLite.

Action :

```text
ne pas écrire
ne pas migrer
informer clairement
```

Les opérations de diagnostic/récupération éventuelles feront l’objet d’une autre fonctionnalité.

---

# 6. Cas des anciennes bases Textothèque sans signature

Les premières bases Textothèque existantes utilisent déjà `user_version`, mais ne possèdent pas encore nécessairement `application_id`.

Il faut donc prévoir **une transition legacy bornée**.

Une base sans `application_id` pourra être reconnue comme ancienne base Textothèque uniquement si sa structure correspond clairement à un schéma historique connu.

Exemple conceptuel :

```text
application_id absent
+
structure exacte compatible avec schéma historique Textothèque
+
user_version cohérente
→ base legacy Textothèque reconnue
```

Après accord utilisateur et migration/adoption :

```text
application_id Textothèque
```

est inscrit.

Ne pas considérer n’importe quelle SQLite ressemblant vaguement au schéma comme une Textothèque.

Cette compatibilité legacy doit rester explicitement testée.

---

# 7. Sauvegarde complète d’une bibliothèque

## Commande cible

```text
Sauvegarder une copie de la bibliothèque…
```

Cette fonction crée un snapshot complet de la base courante.

Elle ne change jamais la bibliothèque active.

Principe :

```text
Bibliothèque courante
        ↓
snapshot SQLite cohérent
        ↓
fichier choisi par l’utilisateur
```

---

## 7.1 Pas de copie naïve du fichier ouvert

Textothèque utilise SQLite avec WAL.

Ne pas considérer une simple copie du fichier principal pendant son utilisation comme mécanisme de sauvegarde fiable.

Utiliser une primitive SQLite adaptée à la création d’un snapshot cohérent, par exemple selon les capacités retenues :

- API de backup SQLite exposée par `better-sqlite3` ;
- autre mécanisme SQLite explicitement cohérent.

Le choix exact doit être validé lors de la mission d’implémentation.

---

## 7.2 Contenu du backup

Une sauvegarde de bibliothèque contient la totalité de la base :

- documents ;
- dossiers ;
- métadonnées ;
- favoris ;
- corbeille ;
- version de schéma ;
- identité Textothèque ;
- futures données persistantes.

Ce n’est pas un export documentaire.

---

## 7.3 Nom proposé

Textothèque peut proposer un nom lisible :

```text
Textotheque_2026-08-15_2055.sqlite
```

ou :

```text
NomBibliotheque_backup_2026-08-15_2055.sqlite
```

L’utilisateur reste libre de choisir le nom et l’emplacement.

---

# 8. Vérification d’une sauvegarde

Une sauvegarde réussie ne doit pas seulement signifier :

```text
le fichier a été créé
```

Une vérification légère doit confirmer au minimum :

- fichier SQLite lisible ;
- identité Textothèque attendue ;
- version de schéma attendue ;
- base ouvrable en lecture pour inspection.

Ne pas lancer un énorme audit après chaque sauvegarde.

---

# 9. Migration d’une bibliothèque utilisateur

## 9.1 Principe

Quand une bibliothèque ancienne mais migrable est ouverte :

```text
détecter
→ informer
→ proposer
→ sauvegarder
→ migrer
→ valider
→ ouvrir
```

---

## 9.2 Pas de migration silencieuse lors de l’ouverture manuelle

Message conceptuel :

> Cette bibliothèque utilise le schéma Textothèque 2.  
> Cette version de Textothèque utilise le schéma 4.  
> Une migration est nécessaire pour l’ouvrir.

Actions :

```text
Annuler
Migrer
```

---

## 9.3 Backup obligatoire avant migration utilisateur

Si l’utilisateur choisit `Migrer` :

```text
1. créer une sauvegarde pré-migration
2. vérifier cette sauvegarde
3. appliquer les migrations
4. valider la version et la structure finale
5. ouvrir la bibliothèque
```

Si la sauvegarde échoue :

```text
migration annulée
```

---

## 9.4 Migration transactionnelle

Le mécanisme existant de migrations versionnées doit rester la base :

```text
user_version N
→ migration N+1
→ user_version N+1
```

Pour une migration comportant plusieurs opérations dépendantes :

```text
transaction
```

La version n’est mise à jour qu’après réussite de la migration correspondante.

---

## 9.5 Échec de migration

Si la migration échoue :

- ne pas prétendre que la bibliothèque est ouverte ;
- informer l’utilisateur ;
- conserver le backup pré-migration ;
- ne pas supprimer le fichier original ;
- journaliser le détail technique.

Si la transaction SQLite permet de revenir proprement à l’état initial, l’utiliser.

---

# 10. Bibliothèque par défaut

La base actuelle située dans le profil Textothèque peut rester la bibliothèque par défaut.

Conceptuellement :

```text
%APPDATA%\Textotheque\textotheque.sqlite
```

Mais elle ne doit plus être considérée comme l’unique bibliothèque possible.

Elle devient :

> la bibliothèque par défaut créée/utilisée lorsque l’utilisateur n’en choisit pas une autre.

---

# 11. Ouverture d’une bibliothèque existante

## Commande cible

```text
Ouvrir une bibliothèque…
```

L’utilisateur choisit un fichier SQLite.

Séquence :

```text
choisir fichier
→ inspection
→ compatibilité ?
→ éventuelle proposition de migration
→ fermeture propre de la DB actuelle
→ ouverture nouvelle DB
→ rafraîchissement UI
```

---

# 12. Changement de bibliothèque et document dirty

Ne jamais changer de bibliothèque en présence de modifications non sauvegardées sans garde-fou.

Réutiliser la philosophie existante de Textothèque :

```text
document modifié
→ sauvegarder / continuer sans sauvegarder / annuler
```

Le comportement exact pourra reprendre le dialogue actuel ou une évolution cohérente.

Ne pas inventer un second système concurrent.

---

# 13. Travailler directement sur la base choisie

Si l’utilisateur ouvre :

```text
D:\Textes\Recherche.sqlite
```

Textothèque doit travailler sur ce fichier.

Ne pas automatiquement le recopier dans `%APPDATA%`.

Le chemin courant fait partie du contexte de session de l’application.

---

# 14. Afficher clairement la bibliothèque courante

Dès que plusieurs bases sont possibles, l’utilisateur doit pouvoir savoir à tout moment où il écrit.

La barre de statut affiche actuellement le nom de la bibliothèque active :

```text
Bibliothèque : Recherche.sqlite
```

Le chemin complet peut rester accessible via une infobulle ou une information secondaire.

Éviter de charger visuellement l’interface avec un chemin complet permanent.

La bibliothèque courante doit également être identifiable dans le futur menu `Bibliothèque`, par exemple avec un marqueur `✓`.

---

# 15. Menu racine `Bibliothèque`

Les opérations portant sur le contenant SQLite complet doivent vivre dans un menu racine dédié :

```text
Bibliothèque
├── Nouvelle bibliothèque…
├── Ouvrir une bibliothèque…
├── Bibliothèques connues
│   ├── ✓ textotheque.sqlite
│   ├── M2.sqlite
│   ├── Dev.sqlite
│   └── Archives.sqlite
├──────────────
├── Sauvegarder une copie…
└── Informations…
```

Le libellé exact pourra évoluer légèrement avec l’UX réelle, mais le principe est fixé :

> les opérations sur la bibliothèque SQLite ne sont pas mélangées avec les futurs imports/exports de documents individuels.

Un futur menu `Fichier` pourra ainsi rester réservé aux opérations documentaires :

```text
Fichier
├── Importer…
├── Exporter…
└── ...
```

Règle d’interface :

> la barre haute contient les actions fréquentes ; les menus contiennent les opérations occasionnelles.

À terme, les commandes `Ouvrir bibliothèque…` et `Copie bibliothèque…` pourront donc quitter la barre haute lorsque le menu `Bibliothèque` sera stabilisé.

---

# 16. Création d’une nouvelle bibliothèque

## Commande cible

```text
Nouvelle bibliothèque…
```

L’utilisateur choisit :

- nom ;
- emplacement.

Textothèque crée :

```text
SQLite
+
application_id Textothèque
+
CURRENT_SCHEMA_VERSION
+
schéma courant
```

Puis l’ouvre.

Une bibliothèque créée et ouverte avec succès rejoint immédiatement l’historique des bibliothèques connues.

---

# 17. Historique durable des bibliothèques connues

Le concept retenu n’est pas une simple liste temporaire de « récentes ».

Textothèque maintient un **registre durable des bibliothèques connues**.

Une bibliothèque entre dans ce registre uniquement lorsqu’elle a réellement été ouverte avec succès comme bibliothèque active.

Exemples :

```text
ouvrir M2.sqlite avec succès
→ ajout / mise à jour historique

créer Dev.sqlite puis l’ouvrir
→ ajout historique

créer un backup
→ pas ajouté

créer un backup pré-migration
→ pas ajouté

sélectionner une DB étrangère ou invalide
→ pas ajoutée
```

Pour chaque bibliothèque connue, conserver seulement les informations utiles :

```json
{
  "path": "J:\\Textes\\M2.sqlite",
  "firstOpenedAt": "2026-08-15T20:00:00.000Z",
  "lastOpenedAt": "2026-08-15T22:12:00.000Z"
}
```

Le chemin canonique sert à éviter les doublons.

Le tri d’affichage est fondé sur `lastOpenedAt`, la plus récemment utilisée en premier.

## Aucune purge automatique

Une bibliothèque connue ne disparaît jamais simplement parce qu’elle est ancienne ou parce qu’une limite arbitraire a été atteinte.

Même si l’historique contient un jour plusieurs dizaines d’entrées :

```text
aucune purge automatique
```

Textothèque ne décide pas d’oublier à la place de l’utilisateur.

Un retrait éventuel sera toujours volontaire.

## Stockage du registre

Le registre appartient à l’application Textothèque, pas à une bibliothèque particulière.

Il ne doit donc pas être stocké :

- dans une bibliothèque SQLite ;
- dans les données métier des documents.

Décision retenue :

```text
profil Textothèque
→ petit fichier de préférences local
→ par exemple library-history.json
```

Emplacement conceptuel :

```text
%APPDATA%\Textotheque\library-history.json
```

Le nom exact pourra être ajusté lors de l’implémentation.

Aucune dépendance n’est nécessaire : quelques données JSON suffisent.

L’écriture doit rester simple et robuste ; ne pas construire un gestionnaire de configuration général uniquement pour ce registre.

---

# 18. Bibliothèque connue devenue introuvable

Si une bibliothèque enregistrée n’existe plus à son chemin :

- ne pas la recréer automatiquement ;
- ne pas la supprimer de l’historique ;
- la conserver et l’indiquer comme `introuvable` ou indisponible ;
- permettre plus tard un retrait volontaire.

Exemple :

```text
Bibliothèques connues
├── ✓ M2.sqlite
├── Dev.sqlite
└── Archives.sqlite   [introuvable]
```

Cliquer sur une entrée introuvable ne doit jamais créer une nouvelle base à cet emplacement.

Une future commande de gestion de l’historique pourra permettre :

- retirer une entrée ;
- éventuellement relocaliser une bibliothèque si un vrai besoin apparaît.

Aucune de ces fonctions avancées n’est obligatoire pour le premier palier `0.1.18`.

---

# 19. Différence entre backup, nouvelle base et ouverture

Ces concepts doivent rester très distincts.

## Sauvegarder une copie

```text
copie complète
la base courante ne change pas
le backup ne rejoint pas automatiquement l’historique
```

## Ouvrir une bibliothèque

```text
la base courante change
on travaille ensuite sur le fichier choisi
si l’ouverture réussit, elle rejoint l’historique
```

## Nouvelle bibliothèque

```text
crée un nouveau fichier Textothèque
puis bascule dessus
puis l’ajoute à l’historique
```

Ne pas utiliser un libellé ambigu comme `Enregistrer sous` pour le backup.

---

# 19 bis. Réouverture au démarrage

Décision retenue :

> Textothèque tente de rouvrir au démarrage la dernière bibliothèque utilisée avec succès.

Exemple :

```text
jour 1
→ travail sur M2.sqlite
→ fermeture

jour 2
→ lancement Textothèque
→ M2.sqlite rouverte
```

Le registre durable fournit le chemin de cette dernière bibliothèque.

## Si la dernière bibliothèque est absente ou impossible à ouvrir

Comportement cible :

```text
tentative dernière bibliothèque
→ indisponible / invalide
→ fallback vers bibliothèque par défaut
→ message utilisateur discret
```

La bibliothèque indisponible reste dans l’historique avec son état `introuvable` ou son diagnostic approprié.

Ne pas boucler indéfiniment sur une bibliothèque impossible à ouvrir.

La bibliothèque par défaut du profil Textothèque reste le parachute de démarrage :

```text
%APPDATA%\Textotheque\textotheque.sqlite
```

---

# 19 ter. Roadmap fonctionnelle proposée

## 0.1.16 — Identité de bibliothèque + sauvegarde complète (réalisée)

Objectifs réalisés :

- `application_id` stable TEXO ;
- reconnaissance d’une base Textothèque ;
- adoption bornée des bases legacy ;
- information sur la bibliothèque courante ;
- snapshot SQLite cohérent ;
- vérification du backup.

Cette version fournit le **parachute** avant le multi-base.

---

## 0.1.17 — Ouvrir une bibliothèque + migrations utilisateur (réalisée)

Objectifs réalisés :

- sélecteur de fichier ;
- inspection sans modification ;
- compatibilité ;
- proposition explicite de migration/adoption ;
- backup automatique pré-migration ;
- migration ;
- refus des bases trop récentes/étrangères/invalides ;
- bascule atomique de la DB courante ;
- dirty-state protégé.

Choix réalisés :

- inspection SQLite readonly avant toute mutation ;
- backup pré-migration vérifié créé à côté du candidat ;
- bascule de connexion seulement après ouverture et lectures de contrôle réussies ;
- choix encore limité à la session pour cette étape.

---

## 0.1.18 — Gestion durable des bibliothèques (réalisée)

Objectifs réalisés :

- créer `Nouvelle bibliothèque…` ;
- inaugurer le menu racine `Bibliothèque` ;
- déplacer progressivement les opérations occasionnelles de bibliothèque dans ce menu ;
- maintenir un historique durable des bibliothèques connues ;
- ne jamais purger automatiquement cet historique ;
- marquer la bibliothèque courante ;
- conserver les chemins introuvables au lieu de les oublier ;
- mémoriser `firstOpenedAt` et `lastOpenedAt` ;
- éviter les doublons par chemin canonique ;
- rouvrir au démarrage la dernière bibliothèque utilisée avec succès ;
- fallback propre vers la bibliothèque par défaut si nécessaire ;
- permettre la bascule rapide vers une bibliothèque connue.

Le registre est une préférence de l’application Textothèque, pas une donnée métier contenue dans une bibliothèque.

Choix réalisés :

- registre JSON versionné sous `userData`, sans limite ni purge automatique ;
- écriture par fichier temporaire puis renommage ;
- copie identifiable d’un registre invalide avant retour à un état sain ;
- création exclusive refusant tout fichier préexistant ;
- menu `Bibliothèque` pilotant le workflow React existant ;
- réouverture automatique uniquement d’une dernière base directement compatible ;
- fallback vers la bibliothèque par défaut, sans migration silencieuse, pour un chemin absent, legacy, trop récent ou invalide.

---

# 20. Futures extensions possibles

À ne pas implémenter immédiatement.

## Backup automatique

Éventuellement :

```text
backup quotidien
backup avant migration
backup avant opération sensible
rotation limitée
```

À définir selon l’usage réel.

---

## Historique / snapshots

Le backup de bibliothèque ne remplace pas un futur historique documentaire.

Ce sont deux choses distinctes.

---

## Import / export

L’ouverture d’une base Textothèque ne doit pas être confondue avec :

```text
import .txt
import .md
export .md
export .html
```

Les imports/exports restent des fonctionnalités documentaires.

---

## Fusion de bibliothèques

Hors roadmap actuelle.

Ne pas anticiper :

```text
merge
synchronisation
cloud
réplication
```

avant besoin réel.

---

# 21. Tests à prévoir

## Tests d’identité

- nouvelle base signée Textothèque ;
- SQLite étrangère refusée ;
- legacy connue reconnue ;
- mauvaise signature refusée.

## Tests de version

- schéma actuel accepté ;
- ancien migrable détecté ;
- plus récent refusé ;
- version incohérente refusée.

## Tests de backup

- snapshot créé ;
- source inchangée ;
- snapshot lisible ;
- identité/version conservées ;
- contenu représentatif conservé.

## Tests de migration

- backup pré-migration créé ;
- ancienne base migrée ;
- données conservées ;
- version finale correcte ;
- échec de backup empêche migration.

## Tests de bascule

- DB A ouverte ;
- passage DB B ;
- UI rafraîchie ;
- aucune donnée A affichée comme B ;
- document dirty protégé.

Les tests automatisés doivent utiliser uniquement des bases temporaires contrôlées.

---

# 22. Tests humains vs automatisés

Automatiser les invariants importants :

```text
identité
version
backup cohérent
migration
conservation des données
bascule entre bases
dirty state
```

Laisser au mainteneur les contrôles rapides purement ergonomiques :

```text
placement des commandes
lisibilité du nom de base
confort du sélecteur
libellés
dialogues
```

Principe :

> automatiser ce qui doit rester vrai ; faire tester par l’humain ce qui doit être agréable.

---

# 23. Données utilisateur et tests

À partir de cette roadmap :

> toute base utilisée réellement par le mainteneur est présumée précieuse.

Les tests :

- créent leurs propres bases temporaires ;
- n’utilisent jamais la DB utilisateur ;
- nettoient leurs ressources ;
- testent les migrations sur des fixtures dédiées.

---

# 24. Garde-fous AGENTS.md à intégrer au moment de l’implémentation

Lorsque la roadmap commencera à être codée, `AGENTS.md` devra être mis à jour avec les invariants suivants.

## Identité

Une bibliothèque Textothèque possède une identité persistante stable.

## Version

`PRAGMA user_version` décrit le schéma, pas la version de l’application.

## Ouverture

Une base choisie manuellement est inspectée avant toute migration/écriture.

## Migration utilisateur

Une bibliothèque utilisateur ancienne n’est pas migrée silencieusement lors d’une ouverture manuelle.

## Backup avant migration

Toute migration utilisateur explicitement déclenchée crée d’abord une sauvegarde vérifiée.

## Base trop récente

Aucune tentative de downgrade ou d’ouverture en écriture.

## Tests

Aucune migration de test sur une bibliothèque utilisateur.

---

# 25. Questions à décider lors des missions

Certaines décisions doivent rester ouvertes jusqu’à l’implémentation.

## application_id exact

Décidé en `0.1.16` : `0x5445584F` (`1413830735`, `TEXO`). Cette valeur ne doit plus changer.

## Extension

Conserver probablement :

```text
.sqlite
```

à court terme.

Une extension propriétaire éventuelle pourra être discutée plus tard, mais n’est pas nécessaire.

## Emplacement du backup pré-migration

Possibilités :

- à côté de la bibliothèque ;
- emplacement dédié choisi/configuré ;
- autre stratégie simple.

Décidé en `0.1.17` : la première implémentation place le backup vérifié à côté de la bibliothèque candidate, avec un nom horodaté explicite et sans écrasement. Un échec de migration conserve ce backup.

## Migration au démarrage de la bibliothèque par défaut

Le système historique migre actuellement les bases automatiquement au démarrage.

Avant l’arrivée de migrations futures sur données réellement importantes, décider si la bibliothèque par défaut doit elle aussi :

- proposer explicitement la migration ;
- ou suivre une politique différente clairement documentée.

Le comportement ne doit pas rester ambigu.


## Menu de gestion des bibliothèques

Décidé avant `0.1.18` : les opérations sur les bases SQLite vivent dans un menu racine `Bibliothèque`, séparé du futur menu `Fichier` consacré aux imports/exports documentaires.

## Historique des bibliothèques

Décidé avant `0.1.18` :

- registre durable, pas simple liste tronquée de récentes ;
- aucune purge automatique ;
- ajout uniquement après ouverture réussie ;
- backups et candidats refusés exclus du registre ;
- doublons évités par chemin canonique ;
- entrée absente conservée comme introuvable ;
- retrait uniquement volontaire.

Le registre doit rester une préférence applicative externe aux bibliothèques, stockée dans le profil Textothèque sous forme légère, par exemple `library-history.json`.

## Réouverture au démarrage

Décidé avant `0.1.18` : Textothèque tente de rouvrir la dernière bibliothèque utilisée avec succès.

Si elle est indisponible ou impossible à ouvrir, l’application revient proprement à la bibliothèque par défaut et conserve l’entrée historique au lieu de l’effacer.

---

# 26. Principe final

La bibliothèque SQLite devient le véritable document maître de Textothèque.

Textothèque doit donc garantir que l’utilisateur peut toujours répondre à quatre questions :

```text
Quelle bibliothèque suis-je en train d’utiliser ?

Est-ce bien une bibliothèque Textothèque ?

Est-elle compatible avec cette version du logiciel ?

Comment puis-je en créer immédiatement une copie sûre ?
```

Et lorsque le schéma évolue :

```text
Textothèque détecte
→ informe
→ sauvegarde
→ migre avec accord
→ vérifie
→ ouvre
```

Jamais :

```text
ouvre
→ modifie silencieusement
→ espère que tout va bien
```

Le but n’est pas de complexifier l’application.

Le but est de rendre possible une utilisation quotidienne avec de vrais textes sans que la confiance repose sur la mémoire du développeur ou sur une copie manuelle occasionnelle du fichier SQLite.
