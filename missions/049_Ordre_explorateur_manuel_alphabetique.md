# Mission 049 — Ordre de l’explorateur : manuel ou alphabétique

**Date :** 22 novembre 2026  
**Décision fonctionnelle :** permettre à l’utilisateur de choisir l’ordre d’affichage dans l’explorateur de gauche entre le comportement actuel et un ordre alphabétique.  
**Nature :** préférence d’interface locale ; aucune modification du schéma SQLite.

## Besoin utilisateur

Dans le volet gauche, la section **Dossiers** doit proposer deux modes d’ordre :

- **Manuel** : conserver exactement l’ordre actuel de Textothèque ;
- **Alphabétique** : trier les éléments par nom, sans modifier les données persistées ni la hiérarchie.

Le mode choisi doit être mémorisé entre les sessions.

## Référence actuelle à préserver

Aujourd’hui :

- les dossiers sont fournis par SQLite avec leur champ `position` et la hiérarchie `parent_id`;
- `NavigationPane` construit les branches à partir de l’ordre reçu ;
- les documents proviennent de `listDocuments()` et gardent le comportement d’ordre existant dans le mode manuel ;
- **Tous les textes**, **Corbeille** et **Non classés** sont des accès structurels, pas des dossiers ordinaires.

Le mode **Manuel** doit donc être strictement non régressif : aucun changement de position en base, aucune réécriture de `position`, aucun nouveau moteur de déplacement.

## Portée de l’ordre alphabétique

En mode **Alphabétique** :

1. trier les dossiers **parmi leurs frères uniquement** ;
2. conserver strictement la hiérarchie parent/enfant ;
3. trier alphabétiquement les documents affichés à l’intérieur de chaque dossier ;
4. trier alphabétiquement les documents de **Non classés** ;
5. ne pas déplacer les pseudo-sections structurelles (Tous les textes, Corbeille, Non classés) par rapport à leur rôle actuel.

Utiliser un tri lisible en français, insensible à la casse et raisonnablement naturel pour les nombres, par exemple via `Intl.Collator('fr', { sensitivity: 'base', numeric: true })` ou équivalent cohérent.

Les doublons de titre restent autorisés ; en cas d’égalité, conserver un départage stable et déterministe (ordre courant ou ID), sans modifier les données.

## Accès utilisateur

Ajouter dans le menu natif **Affichage** un sous-menu de préférence :

```text
Affichage
├── Thème
│   ├── Clair
│   └── Sombre
└── Ordre de l’explorateur
    ├── Manuel
    └── Alphabétique
```

Les deux choix d’ordre doivent être mutuellement exclusifs et visibles comme radios/coches.

Le menu doit refléter le choix réellement actif au démarrage.

## Persistance

Utiliser une préférence UI versionnée dans `localStorage`, par exemple :

`textotheque:explorer-order:v1`

Valeurs autorisées :

`manual | alphabetical`

Règles :

- valeur absente ou invalide → `manual` ;
- changement → effet immédiat ;
- fermeture / relance → choix retrouvé ;
- préférence globale au profil Textothèque, pas par bibliothèque ;
- aucun accès direct du main au `localStorage` : reprendre le même principe main ↔ renderer que pour le thème.

Mettre à jour `AGENTS.md` dans la section des préférences UI.

## Comportements à préserver

- état ouvert/fermé des dossiers ;
- sélection du document courant ;
- expansion automatique du chemin du document actif ;
- création d’un dossier ;
- création d’un sous-dossier ;
- création d’un document ;
- renommage existant ;
- TODO ;
- changement de bibliothèque ;
- thème clair/sombre ;
- recherche ;
- mémoire de position d’édition.

Changer l’ordre ne doit provoquer ni dirty state ni écriture documentaire.

## Cas de recette

Avec une bibliothèque fictive contenant des noms volontairement mélangés, accents et nombres :

1. démarrage sans préférence → ordre manuel identique à l’existant ;
2. Affichage → Ordre de l’explorateur → Alphabétique → réordonnancement immédiat ;
3. dossiers frères triés alphabétiquement sans aplatir la hiérarchie ;
4. documents d’un dossier et Non classés triés alphabétiquement ;
5. retour à Manuel → ordre initial retrouvé sans mutation SQLite ;
6. fermeture / relance → préférence conservée ;
7. changement de bibliothèque → préférence d’affichage conservée ;
8. renommage d’un dossier/document en mode alphabétique → repositionnement visuel cohérent ;
9. aucune modification du champ `folders.position` et aucune écriture métier liée au simple changement de mode ;
10. clair/sombre → menu et comportement identiques.

## Vérifications proportionnées

- `npm.cmd run build`;
- test ciblé réel Electron ou extension d’un contrôle voisin pour le menu, la persistance et les deux modes ;
- contrôle DB ciblé attestant que `folders.position` ne change pas lors du basculement ;
- recette visuelle légère de l’arbre développé ;
- ne pas rejouer migrations/packaging/suites générales sans raison liée à 049.

## Données et frontières

- Zenith Ice reste la production ;
- CODEX_VM est l’environnement de développement ;
- la copie personnelle de la base sur CODEX_VM ne doit pas être utilisée dans les tests automatisés ni publiée ;
- fixtures uniquement pour tests et captures ;
- ne pas ajouter de drag-and-drop ou de commandes de réordonnancement manuel dans cette mission ;
- ne pas traiter le clic droit Renommer ni Ctrl+flèches dans 049 ;
- ne pas traiter la distribution Windows dans 049.

## Rapport et livraison

Créer :

`reports/049_Ordre_explorateur_manuel_alphabetique_report.md`

Le rapport doit préciser :

- définition exacte du mode Manuel ;
- tri utilisé en mode Alphabétique ;
- emplacement et persistance de la préférence ;
- garanties de non-mutation du modèle ;
- tests exécutés / non exécutés et limites.

Publier code, tests, documentation nécessaire et rapport sur `origin/main` quel que soit le verdict. Vérifier SHA distant, `git diff --check`, état propre et synchronisé.

**S’arrêter après 049 pour recette humaine. Ne pas commencer 050.**
