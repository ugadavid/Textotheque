# Textothèque

Application desktop personnelle de conservation, organisation, édition et export de textes.

Nom de code provisoire : **Textothèque**.

## 1. Vision générale

Textothèque est une application desktop locale destinée à écrire, conserver, organiser, retrouver et exporter des textes personnels ou professionnels.

Le projet répond à un besoin concret : disposer d’un outil fluide, fiable et centralisé pour gérer des notes, brouillons, rapports, fragments, textes Markdown, idées, courriers, consignes, analyses et documents de travail sans dépendre d’une arborescence de fichiers dispersée.

Contrairement à un éditeur de texte classique, Textothèque ne doit pas considérer le fichier comme support principal. Le support principal est la base de données locale.

L’application doit permettre de gérer plusieurs types de textes :

* textes simples ;
* textes enrichis simples ;
* textes Markdown ;
* brouillons de mails ou messages ;
* notes de projet ;
* rapports techniques ;
* fragments de recherche ;
* documents exportables.

À terme, Textothèque pourra intégrer des fonctions avancées de recherche, de classement, d’export, de versionnement, de liens entre documents, et éventuellement une assistance IA locale ou contrôlée pour aider à résumer, reformuler, taguer ou retrouver des contenus.

Le projet doit rester d’abord un outil personnel, local, rapide, sobre, durable et maîtrisable.

## 2. Inspiration fonctionnelle

L’inspiration initiale est double.

D’une part, le confort d’organisation d’Iconothèque :

* navigation à gauche ;
* zone principale au centre ;
* panneau contextuel à droite ;
* métadonnées visibles immédiatement ;
* base SQLite locale ;
* projet documenté par missions courtes ;
* rapports d’itération systématiques.

D’autre part, le confort d’écriture d’un éditeur personnel :

* création rapide d’un nouveau texte ;
* édition fluide ;
* sauvegarde fiable ;
* recherche rapide ;
* classement simple ;
* export contrôlé ;
* prise en charge progressive du Markdown.

L’objectif n’est pas de créer un clone de Notepad, Obsidian, Notion ou VS Code, mais de construire un outil personnel adapté à une manière réelle de travailler : beaucoup de notes, beaucoup de Markdown, beaucoup de projets, beaucoup de textes à retrouver rapidement.

## 3. Principe fondamental : DB-first

Textothèque doit être conçue comme une application **DB-first**.

Cela signifie que les textes créés dans l’application vivent d’abord dans la base SQLite locale.

La base de données est la source de vérité.

Les fichiers `.txt`, `.md`, `.html`, `.docx` ou autres ne sont pas le stockage principal. Ils sont des exports, des imports, ou des copies contrôlées.

Règle absolue V0 :

> La base SQLite est la source de vérité. Aucun document créé dans l’application ne doit dépendre d’un fichier externe pour exister.

Conséquences importantes :

* un document peut être créé sans choisir d’emplacement fichier ;
* un document est sauvegardé dans SQLite ;
* les métadonnées sont sauvegardées dans SQLite ;
* les tags, collections, statuts et dates sont sauvegardés dans SQLite ;
* l’export fichier est une action volontaire ;
* l’import fichier est une action volontaire ;
* l’application ne doit pas disperser automatiquement des fichiers dans des dossiers externes ;
* l’application doit permettre de retrouver les textes depuis son interface, sans passer par l’explorateur Windows.

## 3 bis. Exécutions DEV et STABLE

Les deux environnements sont volontairement isolés :

```text
npm run dev              → Textotheque DEV → %APPDATA%\Textotheque-Dev → Vite 5173
Textotheque installée    → Textotheque     → %APPDATA%\Textotheque     → renderer local file://
```

Le développement ne lit ni ne copie automatiquement les données STABLE. Pour produire l’installateur Windows Squirrel :

```powershell
npm.cmd run make:win
```

Le livrable principal est `out\make\squirrel.windows\x64\Textotheque Setup.exe`. Le workflow complet et les limites de la distribution locale non signée sont décrits dans `docs/DISTRIBUTION_WINDOWS.md`.

## 4. Objectif V0.1

Créer une première application Electron fonctionnelle permettant de :

* lancer une fenêtre desktop ;
* afficher une interface en trois volets ;
* créer un document texte ;
* éditer son contenu en texte brut ;
* sauvegarder le contenu en base SQLite ;
* afficher la liste des documents existants ;
* sélectionner un document ;
* afficher ses métadonnées dans un panneau latéral ;
* modifier quelques métadonnées simples ;
* retrouver les documents après redémarrage ;
* créer un dossier `reports/` ;
* produire un rapport d’itération Markdown.

La V0.1 ne doit pas chercher à tout faire. Elle doit poser une base propre, testable, extensible et alignée avec le principe DB-first.

## 5. Interface cible

L’interface principale doit être structurée en trois volets.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Barre supérieure : recherche, nouveau document, sauvegarde, export          │
├───────────────────┬───────────────────────────────────────┬─────────────────┤
│ Navigation         │ Édition / lecture                     │ Métadonnées     │
│ documents          │                                       │ document        │
│ collections        │ texte simple / Markdown / aperçu      │ tags, statut    │
│ tags, filtres      │                                       │ dates, source   │
└───────────────────┴───────────────────────────────────────┴─────────────────┘
```

### Volet gauche : navigation

Le volet gauche doit permettre de naviguer dans la bibliothèque de textes.

Éléments possibles :

* tous les documents ;
* documents récents ;
* favoris ;
* brouillons ;
* archives ;
* collections ;
* tags ;
* projets ;
* types de documents ;
* recherche rapide ;
* filtres simples.

La navigation ne doit pas dépendre d’une arborescence physique de fichiers. Elle peut proposer une organisation virtuelle :

```text
Tous les textes
├── Récents
├── Favoris
├── Brouillons
├── Rapports
├── Markdown
├── Archives
└── Collections
```

### Zone centrale : édition

La zone centrale doit être le cœur de l’application.

Elle doit permettre :

* l’édition du titre ;
* l’édition du contenu ;
* la sauvegarde ;
* l’affichage du statut de sauvegarde ;
* le changement de mode éditorial ;
* à terme, l’aperçu Markdown ;
* à terme, un mode lecture confortable.

Modes éditoriaux prévus :

```text
plain      texte brut
markdown   Markdown
rich       texte enrichi simple
```

La V0.1 doit commencer par le mode `plain`.

Le mode Markdown doit être prévu dans l’architecture, mais il ne doit pas forcément être complet dès la première version.

### Volet droit : métadonnées

Le panneau droit doit afficher les informations du document sélectionné.

Métadonnées possibles :

* titre ;
* identifiant interne ;
* type de contenu ;
* statut ;
* favori ;
* collection ;
* tags ;
* date de création ;
* date de dernière modification ;
* date de dernière ouverture ;
* nombre de caractères ;
* nombre de mots ;
* source éventuelle ;
* commentaire interne ;
* chemin d’export éventuel ;
* historique éventuel.

Dans les premières versions, le panneau peut rester simple :

* titre ;
* format ;
* statut ;
* favori ;
* dates ;
* tags simples ;
* commentaire.

## 6. Modes de texte prioritaires

Textothèque doit prévoir plusieurs modes de contenu, même si tous ne sont pas implémentés en V0.1.

### Texte brut

Mode prioritaire de la V0.1.

Objectifs :

* édition simple ;
* sauvegarde fiable ;
* aucune dépendance complexe ;
* base solide pour tester l’architecture.

### Markdown

Mode prioritaire de la V0.2 ou V0.3.

Objectifs :

* écrire en Markdown ;
* afficher un aperçu rendu ;
* exporter en `.md` ;
* réutiliser autant que possible les acquis du lecteur Markdown déjà développé dans l’application “Ma page de démarrage”.

Fonctions souhaitées à terme :

* mode source ;
* mode rendu ;
* mode confort ;
* sections repliables ;
* navigation par titres ;
* ancres internes ;
* copie du HTML rendu ;
* export Markdown ;
* export HTML éventuel.

### Texte enrichi simple

Mode à concevoir plus tard.

Objectifs possibles :

* gras ;
* italique ;
* titres ;
* listes ;
* liens ;
* citations ;
* export HTML ou Markdown.

Ce mode ne doit pas être prioritaire au début, car les éditeurs riches peuvent complexifier fortement l’architecture.

## 7. Stack technique envisagée

Stack recommandée, proche d’Iconothèque :

```text
Electron
Vite
React
TypeScript
SQLite
better-sqlite3
```

Briques complémentaires possibles ensuite :

```text
markdown-it / marked / micromark
DOMPurify
Tiptap / ProseMirror / Lexical
zod
date-fns
```

### Rôle des principales briques

Electron :

* application desktop ;
* accès local contrôlé ;
* possibilité d’exports fichiers ;
* packaging multiplateforme à terme.

Vite :

* environnement de développement rapide ;
* bundling moderne ;
* démarrage simple.

React :

* interface riche en composants ;
* gestion des panneaux ;
* gestion de l’éditeur ;
* formulaires de métadonnées.

TypeScript :

* robustesse du code ;
* contrats explicites ;
* maintenance facilitée ;
* meilleure sécurité lors des évolutions.

SQLite :

* base locale légère ;
* pas de serveur ;
* adaptée à une bibliothèque personnelle ;
* sauvegarde simple ;
* recherche possible.

better-sqlite3 :

* accès SQLite simple et performant côté Node ;
* API synchrone pratique pour une application locale ;
* bon compromis pour une V0.

## 8. Base de données initiale

Schéma conceptuel initial.

### Table `documents`

```text
id
title
content
content_format
status
favorite
created_at
updated_at
last_opened_at
archived_at
deleted_at
source_type
source_detail
export_path
notes
```

Formats possibles pour `content_format` :

```text
plain
markdown
rich
```

Statuts possibles :

```text
draft
active
to_review
final
archived
```

Sources possibles pour `source_type` :

```text
created
imported_txt
imported_md
imported_html
pasted
generated
other
```

### Table `tags`

```text
id
name
type
created_at
updated_at
```

Types possibles :

```text
custom
project
topic
person
course
status
source
```

### Table `document_tags`

```text
document_id
tag_id
created_at
```

### Table `collections`

```text
id
name
description
created_at
updated_at
```

### Table `document_collections`

```text
document_id
collection_id
position
created_at
```

### Table `document_versions` 

Table optionnelle pour une version ultérieure.

```text
id
document_id
title
content
content_format
created_at
reason
```

Cette table permettra éventuellement de conserver des snapshots importants, sans transformer la V0.1 en système de versionnement complet.

### Table `app_settings`

```text
key
value
updated_at
```

Exemples :

```text
last_selected_document_id
default_content_format
autosave_enabled
autosave_delay_ms
theme
```

## 9. Sauvegarde, autosave et fiabilité

La sauvegarde doit être fiable et visible.

Dans les premières versions, l’application peut utiliser :

* un bouton “Sauvegarder” ;
* un indicateur “modifié” ;
* un indicateur “sauvegardé” ;
* une sauvegarde automatique simple après délai ;
* une sauvegarde à la perte de focus ;
* une sauvegarde avant changement de document.

Il faut éviter les comportements ambigus.

Règles recommandées :

* ne jamais perdre silencieusement du contenu ;
* signaler clairement l’état non sauvegardé ;
* éviter les sauvegardes automatiques trop agressives au début ;
* ajouter des tests simples sur la persistance ;
* conserver les dates de modification.

La V0.1 peut commencer avec un bouton “Sauvegarder” explicite, puis ajouter l’autosave dans une mission ultérieure.

## 10. Imports et exports

### Export

L’export fichier est important, mais il doit rester une action volontaire.

Formats d’export prévus :

```text
.txt
.md
.html
```

Formats possibles plus tard :

```text
.docx
.pdf
.json
```

L’export doit permettre :

* choisir un emplacement ;
* choisir un format ;
* générer un nom de fichier propre ;
* conserver le texte en base après export ;
* enregistrer éventuellement le dernier chemin d’export ;
* ne pas transformer le fichier exporté en source principale.

Règle importante :

> Exporter un document ne le sort pas de Textothèque. La version de référence reste dans la base SQLite.

### Import

L’import fichier pourra être ajouté après la V0.1.

Formats d’import possibles :

```text
.txt
.md
.html
```

L’import doit :

* lire le fichier ;
* créer un nouveau document en base ;
* conserver éventuellement le chemin source comme métadonnée ;
* ne pas établir de dépendance obligatoire au fichier d’origine ;
* éviter toute modification du fichier importé.

Règle importante :

> Importer un fichier crée un document interne. Le fichier d’origine reste externe et n’est pas modifié.

## 11. Markdown et réutilisation de “Ma page de démarrage”

Le projet doit tenir compte du travail déjà réalisé dans l’application “Ma page de démarrage”, notamment autour de la lecture Markdown.

Objectif :

* ne pas réinventer inutilement le rendu Markdown ;
* identifier les composants ou fonctions réutilisables ;
* récupérer les bonnes idées d’interface ;
* adapter proprement ce qui doit l’être ;
* éviter les copier-coller massifs non maîtrisés.

Éléments potentiellement réutilisables ou inspirants :

* rendu Markdown ;
* mode source ;
* mode rendu ;
* mode confort ;
* sections `##` repliables ;
* boutons “Tout replier” / “Tout ouvrir” ;
* ancres internes ;
* ouverture automatique d’une section ciblée ;
* styles de lecture ;
* ergonomie de consultation.

Une mission dédiée devra être prévue avant intégration :

```text
Mission — Audit du lecteur Markdown existant

Objectif :
Analyser le module Markdown de l’application “Ma page de démarrage” afin d’identifier ce qui peut être réutilisé, adapté ou simplement repris comme inspiration dans Textothèque.

Contraintes :
- audit uniquement ;
- aucune modification de Textothèque ;
- aucune modification de Ma page de démarrage ;
- produire un rapport.
```

## 12. Recherche cible à terme

Textothèque doit permettre de retrouver rapidement les textes.

Recherche simple en priorité :

* titre ;
* contenu ;
* tags ;
* statut ;
* collection ;
* date ;
* format ;
* favoris.

Exemples de recherches visées :

```text
rapports Codex Iconothèque
notes mémoire intercompréhension
brouillons de mails pour Audrey
textes Markdown non exportés
documents modifiés cette semaine
notes liées à IC-Lab
fragments à reprendre
anciens prompts stagiaire
textes favoris non classés
```

À terme, une recherche plus avancée pourra être envisagée :

* recherche plein texte SQLite FTS ;
* filtres combinés ;
* recherche sémantique ;
* suggestions de tags ;
* regroupements par projet ;
* liens entre documents.

La recherche plein texte SQLite FTS peut devenir une priorité après stabilisation du CRUD documentaire.

## 13. Phases du projet

### Phase 1 — Écrire et conserver

Objectif : créer un Notepad personnel en base de données.

Fonctions :

* application Electron fonctionnelle ;
* interface en trois volets ;
* création de document ;
* édition texte brut ;
* sauvegarde SQLite ;
* liste des documents ;
* panneau métadonnées minimal ;
* persistance au redémarrage.

### Phase 2 — Organiser

Objectif : retrouver et structurer les textes.

Fonctions :

* tags ;
* collections ;
* favoris ;
* statuts ;
* recherche par titre et contenu ;
* filtres ;
* tri ;
* archivage logique.

### Phase 3 — Markdown

Objectif : faire de Textothèque un vrai atelier Markdown personnel.

Fonctions :

* mode Markdown ;
* aperçu rendu ;
* mode source/rendu ;
* mode confort ;
* export `.md` ;
* audit et réutilisation du lecteur Markdown de “Ma page de démarrage”.

### Phase 4 — Exporter et importer

Objectif : permettre les échanges avec le monde fichier.

Fonctions :

* export `.txt` ;
* export `.md` ;
* export `.html` ;
* import `.txt` ;
* import `.md` ;
* conservation des sources comme métadonnées ;
* export par lot éventuel.

### Phase 5 — Enrichir

Objectif : améliorer l’expérience d’écriture et de mémoire.

Fonctions possibles :

* versionnement léger ;
* historique de modifications ;
* backlinks ou liens internes ;
* templates de documents ;
* statistiques ;
* recherche plein texte avancée ;
* assistance IA optionnelle ;
* résumés automatiques ;
* tags suggérés ;
* extraction de titres ;
* regroupements par projet.

## 13 bis Versionnement du projet

Textothèque doit suivre une logique de versionnement lente, prudente et progressive.

Le projet étant en phase initiale, les numéros de version ne doivent pas avancer trop vite. Une nouvelle version ne correspond pas à une simple mission Codex, mais à un état identifiable de l’application.

Principe général :

> Baby steps. Une petite amélioration ne justifie pas un grand changement de version.

### Logique recommandée

```text
0.1.0       premier gel fonctionnel minimal
0.1.1       correction ou ajustement mineur
0.1.2       amélioration limitée et stable
0.1.3-dev.1 travail intermédiaire non gelé
0.1.3-dev.2 suite du travail intermédiaire
0.1.3       gel stable après les itérations dev
0.1.4       amélioration suivante stable
```

### Règles de progression

La branche `0.1.x` doit couvrir tout le socle initial de Textothèque :

* application Electron fonctionnelle ;
* interface en trois volets ;
* création de documents ;
* édition texte brut ;
* sauvegarde SQLite ;
* sélection et réouverture des documents ;
* métadonnées minimales ;
* premières corrections d’ergonomie ;
* stabilisation du principe DB-first.

Le passage à `0.2.0` ne doit pas être automatique.

Il ne doit avoir lieu que lorsqu’un vrai palier fonctionnel est atteint, par exemple :

* un mode Markdown réellement utilisable ;
* un aperçu Markdown stable ;
* une évolution importante de l’architecture documentaire ;
* une première version clairement supérieure au simple socle texte brut.

En pratique, Textothèque peut rester plusieurs jours ou plusieurs semaines en `0.1.x`.

### Règle importante

```text
0.1.x = consolidation du socle DB-first
0.2.x = nouveau palier fonctionnel réel
0.3.x = autre palier majeur clairement identifié
```

Une mission Codex peut donc produire un rapport `002`, `003`, `004`, etc. sans que la version applicative passe immédiatement à `0.2.0`.

Les rapports d’itération et les versions applicatives ne suivent pas exactement le même rythme :

```text
reports/001_...  → peut correspondre à 0.1.0
reports/002_...  → peut correspondre à 0.1.1
reports/003_...  → peut correspondre à 0.1.2
reports/004_...  → peut encore correspondre à 0.1.2 ou 0.1.3-dev.1
```

### Versions de développement

Les suffixes `-dev.x` peuvent être utilisés quand une fonctionnalité est en cours mais pas encore prête à être gelée.

Exemples :

```text
0.1.3-dev.1
0.1.3-dev.2
0.1.3
```

Cela permet de documenter les étapes intermédiaires sans prétendre qu’elles constituent déjà une version stable.

### Philosophie

Le versionnement doit refléter la maturité réelle de l’application, pas l’enthousiasme du moment.

Textothèque doit avancer lentement, proprement, par petits incréments vérifiables.

Le bon rythme est :

```text
petite mission
rapport clair
test rapide
correction si nécessaire
petit incrément de version seulement si cela aide à documenter l’état réel du projet
```


## 14. IA éventuelle

L’IA n’est pas prioritaire dans les premières versions.

Si elle est ajoutée plus tard, elle doit rester contrôlée, explicite et non intrusive.

Fonctions possibles :

* proposer un résumé ;
* proposer des tags ;
* reformuler un passage ;
* générer un titre ;
* classer un texte ;
* détecter les doublons ou textes proches ;
* transformer un texte brut en Markdown ;
* aider à retrouver un contenu.

Principes recommandés :

* aucune réécriture automatique sans validation ;
* aucune suppression automatique ;
* distinguer clairement contenu utilisateur et suggestions IA ;
* conserver la maîtrise locale des données autant que possible ;
* prévoir des réglages pour activer ou désactiver ces fonctions.

## 15. Méthode de travail avec Codex

Chaque intervention de Codex doit être limitée, explicite et documentée.

Codex doit toujours :

1. comprendre l’objectif de l’itération ;
2. modifier uniquement les fichiers nécessaires ;
3. éviter les changements massifs non demandés ;
4. respecter le principe DB-first ;
5. éviter de transformer l’application en explorateur de fichiers classique ;
6. préserver les données utilisateur existantes ;
7. documenter les choix ;
8. créer ou mettre à jour un fichier de rapport dans le dossier `reports/`.

Règle de travail recommandée :

> Une mission = un objectif clair = un rapport.

## 16. Rapports d’itération

Chaque mission confiée à Codex doit produire un rapport Markdown dans le dossier :

```text
reports/
```

Les nouveaux rapports suivent la convention `reports/NNN_description_report.md`, directement à la racine de `reports/`. Exemples de noms :

```text
001_initial_electron_setup_report.md
002_sqlite_documents_report.md
003_document_editor_report.md
004_metadata_panel_report.md
005_markdown_audit_report.md
```

Chaque rapport doit préciser :

* objectif de la mission ;
* fichiers créés ;
* fichiers modifiés ;
* choix techniques ;
* fonctionnement ajouté ;
* points non traités ;
* risques éventuels ;
* vérifications effectuées ;
* commandes lancées ;
* recommandations pour la suite.

Structure type :

```markdown
# Rapport — Titre de la mission

## Objectif

## Fichiers créés

## Fichiers modifiés

## Fonctionnement ajouté

## Choix techniques

## Vérifications effectuées

## Points non traités

## Risques / limites

## Suite recommandée
```

## 17. Règles de développement

Règles générales :

* la base SQLite est la source de vérité ;
* ne pas créer automatiquement de fichiers externes pour chaque document ;
* ne pas dépendre d’une arborescence de fichiers pour fonctionner ;
* ne pas supprimer de données utilisateur sans action explicite ;
* ne pas écraser un export existant sans confirmation ;
* garder les données applicatives dans un dossier dédié ;
* documenter les choix ;
* privilégier des itérations courtes ;
* tester après chaque étape ;
* produire un rapport après chaque mission.

Règles spécifiques aux documents :

* un document créé dans Textothèque doit être sauvegardé en base ;
* l’export est optionnel ;
* l’import crée une copie interne ;
* les fichiers importés ne doivent pas être modifiés ;
* les suppressions doivent d’abord être logiques ou confirmées ;
* les migrations SQLite doivent être prudentes dès que des données réelles existent.

Pendant les premières phases de test, la base peut contenir des données fictives. Dès que des textes importants seront saisis, les migrations et suppressions devront devenir beaucoup plus conservatrices.

## 18. Organisation possible du projet

Structure initiale envisagée :

```text
textotheque/
├── README.md
├── package.json
├── electron/
│   ├── main.ts
│   └── preload.ts
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── NavigationPane.tsx
│   │   ├── EditorPane.tsx
│   │   └── MetadataPane.tsx
│   ├── styles/
│   ├── services/
│   └── types/
├── db/
│   ├── schema.sql
│   └── migrations/
├── reports/
│   └── 001_initial_setup_report.md
└── docs/
    ├── ARCHITECTURE.md
    ├── CODEX_WORKFLOW.md
    └── ROADMAP.md
```

Cette structure pourra évoluer selon les choix techniques retenus.

## 19. Première mission recommandée

Créer le squelette initial de l’application.

Objectif :

* initialiser une application Electron + Vite + React + TypeScript ;
* afficher une fenêtre desktop ;
* créer une interface en trois volets ;
* préparer une base SQLite locale ;
* créer une table `documents` minimale ;
* permettre de créer un document texte brut ;
* permettre de sauvegarder ce document en base ;
* afficher la liste des documents ;
* afficher un panneau de métadonnées minimal ;
* créer le dossier `reports/` ;
* produire un premier rapport d’itération.

Contraintes :

* ne pas implémenter encore d’éditeur riche ;
* ne pas implémenter encore le rendu Markdown ;
* ne pas implémenter encore l’import/export ;
* ne pas transformer le projet en explorateur de fichiers ;
* garder une architecture extensible ;
* documenter tous les choix.

La V0.1 doit être volontairement simple. Elle doit prouver que l’application peut créer, éditer, sauvegarder et retrouver des textes depuis une base SQLite locale.

## 20. Prompts de mission recommandés

### Mission 001 — Socle applicatif

```text
Mission 001 — Initialisation Textothèque V0.1

Objectif :
Créer le socle d’une application locale d’édition et de conservation de textes, inspirée de l’architecture Iconothèque.

Technologies souhaitées :
- Electron
- Vite
- React
- TypeScript
- SQLite
- better-sqlite3

Principe fondamental :
La base SQLite est la source de vérité.
Les documents créés dans l’application doivent être stockés en base, pas sous forme de fichiers texte externes.

Interface cible :
- volet gauche : navigation / liste des documents
- volet central : éditeur de texte brut
- volet droit : métadonnées du document

Contraintes :
- commencer simple
- texte brut uniquement pour cette mission
- pas d’éditeur riche
- pas de rendu Markdown
- pas d’import/export
- pas de suppression destructive
- architecture prête pour les formats plain / markdown / rich
- créer un dossier reports/
- produire un rapport de mission détaillé

Livrables attendus :
- application lançable localement
- interface en trois volets
- création d’un document
- modification du contenu
- sauvegarde en SQLite
- affichage de la liste des documents
- panneau de métadonnées minimal
- rapport dans reports/001_initial_textotheque_v0.1_report.md
```

### Mission ultérieure — Audit Markdown

```text
Mission — Audit du lecteur Markdown existant

Objectif :
Analyser l’application “Ma page de démarrage” afin d’identifier les composants, fonctions, styles ou principes réutilisables pour le futur mode Markdown de Textothèque.

Contraintes :
- audit uniquement
- aucune modification de Textothèque
- aucune modification de Ma page de démarrage
- ne pas copier massivement du code sans analyse
- produire un rapport dans reports/

Points à examiner :
- renderer Markdown
- mode source
- mode rendu
- mode confort
- sections repliables
- ancres internes
- styles
- dépendances utilisées
- limites et risques d’intégration
```

## 21. Philosophie du projet

Textothèque doit être :

* locale ;
* rapide ;
* sobre ;
* élégante ;
* fiable ;
* DB-first ;
* orientée écriture ;
* orientée recherche ;
* progressivement extensible ;
* adaptée à une pratique réelle et intensive du texte ;
* capable de gérer beaucoup de documents sans les disperser.

Le but n’est pas seulement d’écrire des textes, mais de les conserver, les retrouver, les relier, les réutiliser et les exporter sans perdre de temps dans des dossiers éparpillés.

Textothèque doit devenir un atelier personnel d’écriture et de mémoire textuelle.
