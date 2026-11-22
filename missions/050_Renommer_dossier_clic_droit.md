# Mission 050 — Renommer un dossier par clic droit, sans bouton visuel

**Date :** 22 novembre 2026  
**Décision fonctionnelle :** conserver le double clic existant pour renommer un dossier, ajouter une action **Renommer** au clic droit, et supprimer le bouton visuel « Renommer » qui apparaît actuellement à droite du dossier sélectionné.  
**Nature :** amélioration ergonomique ciblée de l’explorateur ; aucune modification SQLite.

## Besoin utilisateur

Le renommage actuel fonctionne déjà par **double clic** sur le nom d’un dossier. Ce comportement est apprécié et doit rester intact.

En revanche, lorsqu’un dossier est sélectionné, Textothèque affiche un bouton **Renommer** à droite de la ligne. Ce bouton surcharge visuellement l’explorateur et doit disparaître.

L’utilisateur souhaite ajouter une voie plus naturelle et découvrable :

- **clic droit sur un dossier** ;
- menu contextuel ;
- action **Renommer** ;
- activation du même éditeur inline déjà utilisé aujourd’hui.

## Référence actuelle

Dans `src/components/NavigationPane.tsx` :

- le double clic sur `.folder-button` appelle déjà `startRename` ;
- le renommage inline est géré par `editingFolderId` / `editingFolderName` ;
- validation sur blur/Entrée ;
- Échap annule ;
- le bouton `.folder-rename-button` apparaît uniquement sur le dossier sélectionné.

**Réutiliser cette logique. Ne pas créer un second mécanisme de renommage.**

## Comportement demandé

### Double clic

Conserver exactement le comportement existant :

- double clic sur un dossier → entrée en mode renommage ;
- champ inline au même emplacement ;
- Entrée / perte de focus → validation ;
- Échap → annulation.

### Clic droit

Ajouter un menu contextuel sur les dossiers réels de l’arborescence.

Menu minimal pour cette mission :

```text
Renommer
```

- clic droit sur un dossier → ouverture du menu contextuel ;
- **Renommer** → appelle le même `startRename` que le double clic ;
- ne pas renommer automatiquement au simple clic droit ;
- ne pas ouvrir/replier le dossier involontairement ;
- ne pas déclencher un changement de vue ou de sélection si cela n’est pas requis pour afficher le menu ;
- le menu se ferme normalement sur clic ailleurs / Échap / choix d’action.

Le comportement exact de sélection lors d’un clic droit doit rester naturel et cohérent avec Windows : si le clic droit sélectionne visuellement la cible, cela ne doit pas provoquer d’effet métier ou perdre un brouillon.

## Implémentation attendue

Privilégier une solution locale et légère dans le renderer, sauf si l’architecture Electron existante fournit déjà un mécanisme de menu contextuel clairement réutilisable.

Ne pas introduire une grosse abstraction générale de menus contextuels pour une seule action.

Le menu peut être :

- natif Electron si cela s’intègre proprement sans complexifier les IPC ;
- ou un menu contextuel renderer cohérent avec le thème clair/sombre existant.

**Le choix doit être expliqué dans le rapport.**

### Important sur les thèmes

Si le menu est rendu dans le renderer :

- compatible clair/sombre ;
- focus visible ;
- clavier Échap ;
- aucune rupture de layout.

Si le menu est natif Electron :

- vérifier son rendu et son déclenchement réel sous Windows.

## Suppression du bouton visuel

Supprimer le bouton `.folder-rename-button` de l’explorateur.

- aucun espace vide résiduel ;
- aucun décalage de la ligne dossier ;
- le compteur de documents reste correctement aligné ;
- la ligne sélectionnée garde son aspect actuel.

Retirer le CSS devenu inutile si `.folder-rename-button` n’est plus utilisé ailleurs.

## Interaction avec l’ordre 049

Le renommage doit fonctionner dans les deux modes :

- Manuel ;
- Alphabétique.

En mode Alphabétique, après validation du nouveau nom, le dossier doit naturellement se repositionner selon l’ordre alphabétique, sans écrire/modifier `folders.position`.

En mode Manuel, il reste à sa position existante.

## Cas de recette

Avec données fictives :

1. double clic → renommage fonctionne comme avant ;
2. clic droit → menu avec **Renommer** ;
3. Renommer via menu → même champ inline ;
4. Échap annule ;
5. Entrée valide ;
6. perte de focus valide comme aujourd’hui ;
7. bouton visuel « Renommer » absent ;
8. aucun espace/résidu graphique à droite de la ligne ;
9. mode Manuel → position inchangée ;
10. mode Alphabétique → repositionnement visuel cohérent après renommage ;
11. clic droit ne replie/déplie pas le dossier ;
12. clic droit ne provoque pas de perte de texte ou dirty state dans le document courant ;
13. clair/sombre → menu utilisable dans les deux thèmes.

## Vérifications proportionnées

- `npm.cmd run build`;
- test ciblé explorateur/navigation ;
- recette Electron réelle sous Windows avec clic droit ;
- relancer le contrôle 049 si nécessaire pour vérifier les deux modes d’ordre ;
- ne pas rejouer migrations/packaging/suites générales sans raison directe.

## Données et frontières

- Zenith Ice reste la production ;
- CODEX_VM est l’environnement de développement ;
- tests uniquement sur fixtures temporaires ;
- ne pas toucher au modèle SQLite, aux positions de dossiers, aux documents ou à l’historique ;
- ne pas ajouter d’autres actions contextuelles (supprimer, déplacer, nouveau sous-dossier...) pendant 050 ;
- ne pas traiter Ctrl+flèches ni distribution Windows dans cette mission.

## Rapport et livraison

Créer :

`reports/050_Renommer_dossier_clic_droit_report.md`

Le rapport doit préciser :

- solution choisie pour le menu contextuel ;
- réutilisation du mécanisme existant de double clic ;
- suppression du bouton visuel ;
- comportement dans les deux modes d’ordre ;
- tests exécutés / non exécutés et limites.

Publier code, tests et rapport sur `origin/main` quel que soit le verdict. Vérifier SHA distant, `git diff --check`, état propre et synchronisé.

**S’arrêter après 050 pour recette humaine. Ne pas commencer 051.**
