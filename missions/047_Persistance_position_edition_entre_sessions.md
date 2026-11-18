# Mission 047 — Persistance de la position d’édition entre les sessions

**Date :** 18 novembre 2026  
**Décision fonctionnelle validée par David :** prolonger la mémoire introduite en 046 afin qu’elle survive à la fermeture et au redémarrage de Textothèque.  
**Nature :** persistance légère d’un état d’interface ; aucune évolution du modèle métier ou du schéma SQLite.

## Besoin utilisateur

La mission 046 a validé la mémoire, pendant une session, du caret, de la sélection et de la zone visible pour chaque document. Cette amélioration est suffisamment utile pour que l’utilisateur souhaite retrouver **le même emplacement même après avoir fermé puis relancé l’application**.

Exemple :

1. ouvrir un long document A ;
2. placer le caret ou une sélection vers la fin et laisser l’éditeur défilé à cet endroit ;
3. fermer Textothèque normalement ;
4. relancer Textothèque plus tard ;
5. rouvrir A ;
6. retrouver la même position d’édition, sous réserve que le contenu reste compatible.

## Socle 046 à conserver

Le mécanisme actuel est validé et doit rester la base :

- `src/App.tsx` porte une `Map<number, EditorPosition>` de session ;
- `src/components/EditorPane.tsx` capture au démontage du textarea : `selectionStart`, `selectionEnd`, `selectionDirection`, `scrollTop`, `scrollLeft`;
- la restauration est effectuée au remontage du textarea, bornée à la longueur réelle du contenu ;
- le mécanisme Tab garde la priorité et ne doit pas être réécrit ;
- la restauration ne provoque ni dirty state, ni écriture documentaire, ni vol de focus ;
- le changement de bibliothèque isole déjà les positions de session.

**047 doit prolonger ce mécanisme, pas en créer un deuxième.**

## Choix de persistance

Utiliser une préférence UI locale, simple et versionnée, dans `localStorage`, conformément à l’usage existant du projet pour les préférences d’interface.

Créer une clé dédiée, par exemple :

`textotheque:editor-positions:v1`

Le nom exact peut être adapté si une convention existante du dépôt le justifie, mais il doit être versionné et explicite.

### Structure attendue

La persistance doit distinguer :

- la bibliothèque ;
- l’identifiant du document ;
- les coordonnées d’édition.

Une structure conceptuelle de ce type est suffisante :

```text
bibliothèque A
  document 12 → position
  document 45 → position

bibliothèque B
  document 12 → autre position
```

La bibliothèque doit être identifiée par le chemin canonique déjà fourni par `libraryInfo.path` ou un identifiant stable équivalent déjà disponible. Ne pas ajouter de nouvel identifiant en base uniquement pour cette fonction.

## Données persistées

Persister uniquement :

- `selectionStart` ;
- `selectionEnd` ;
- `selectionDirection` ;
- `scrollTop` ;
- `scrollLeft`.

Ne pas enregistrer :

- contenu du document ;
- titre ;
- notes ;
- statut ;
- recherche ;
- métadonnées métier ;
- extrait de texte ;
- autres données personnelles.

Cette préférence reste locale au profil Textothèque de la machine.

## Lecture et écriture

### Au démarrage / ouverture d’une bibliothèque

- Charger les positions persistées de cette bibliothèque dans la structure mémoire utilisée par 046.
- Une donnée absente, malformée, ancienne ou invalide ne doit jamais empêcher Textothèque de démarrer ni d’ouvrir un document.
- Valider les types et ignorer proprement les entrées incorrectes.
- Les bornes exactes de sélection restent vérifiées au moment où le textarea connaît la longueur réelle du contenu.

### Pendant l’utilisation

- Continuer à utiliser la `Map` en mémoire comme source immédiate.
- Lorsqu’une position est capturée ou modifiée de façon significative, persister de manière légère et cohérente.
- Éviter une écriture `localStorage` à chaque mouvement de caret ou scroll si cela ajoute du bruit inutile ; le démontage/changement de document, la fermeture normale ou un mécanisme raisonnablement borné suffisent.
- Ne pas introduire de debounce complexe ou de store global pour ce besoin.

### Fermeture

- La dernière position du document encore affiché au moment de quitter doit être conservée.
- Tenir compte du fait qu’un cleanup React ou un événement de fermeture peut ne pas être l’endroit le plus fiable pour une écriture tardive : inspecter le cycle actuel de fermeture Electron et choisir un point de persistance simple et robuste.
- Ne pas altérer le dirty guard ni le flux de fermeture existant.

## Isolation entre bibliothèques

- Une position enregistrée pour un document ID 1 de la bibliothèque A ne doit jamais être appliquée au document ID 1 de la bibliothèque B.
- Le changement de bibliothèque doit charger la mémoire persistée de la bibliothèque cible au lieu de simplement repartir d’une table vide.
- Si une bibliothèque est déplacée ou renommée, aucune migration automatique sophistiquée des positions n’est demandée : elle peut apparaître comme une nouvelle bibliothèque pour cette préférence.
- Ne jamais partager les positions entre profil DEV et STABLE autrement que par leur propre `localStorage` Chromium naturel.

## Nettoyage et robustesse

Rester simple :

- ignorer les documents supprimés/introuvables sans erreur ;
- une entrée orpheline peut rester dans la préférence tant qu’elle ne gêne pas ;
- éviter une stratégie de purge complexe ;
- si une limite raisonnable est jugée nécessaire pour éviter une croissance indéfinie, la documenter et la garder très simple, sans supprimer arbitrairement les positions de documents récemment utilisés.

Une donnée `localStorage` corrompue doit être traitée comme une préférence facultative, jamais comme une erreur bloquante.

## Cas de recette obligatoires

Avec des bibliothèques et documents fictifs :

1. **Persistance simple :** positionner A, fermer, relancer, rouvrir A → même caret et même zone visible.
2. **Sélection :** conserver une sélection non vide et son sens après redémarrage.
3. **Deux documents :** A et B conservent chacun leur position après fermeture et relance.
4. **Deux bibliothèques :** même ID documentaire dans A et B → positions distinctes après redémarrage.
5. **Contenu raccourci :** après redémarrage, un document devenu plus court borne correctement la sélection et le scroll.
6. **Donnée corrompue :** injecter une valeur invalide dans la clé de préférence → démarrage normal, aucune erreur bloquante, comportement initial raisonnable.
7. **Aucune écriture métier :** restaurer une position après redémarrage ne change ni le contenu ni `updated_at` et ne crée pas de faux dirty.
8. **Compatibilité 046 :** les allers-retours A → B → A pendant la même session continuent de fonctionner exactement comme avant.
9. **Recherche/catalogue :** le passage temporaire par une vue qui démonte l’éditeur conserve toujours la position, sans attendre un redémarrage.
10. **Tab :** la logique existante de la touche Tab reste correcte.

## Architecture et périmètre

- Réutiliser `EditorPosition` et la `Map` existante.
- Ajouter un petit helper de sérialisation/lecture si cela améliore la lisibilité ; ne pas créer une infrastructure générique de préférences.
- Mettre à jour `AGENTS.md` uniquement si nécessaire pour référencer cette nouvelle clé UI persistante dans la section des préférences, sans refondre les règles.
- Aucun changement du schéma SQLite, du preload, des IPC, des dépendances ou de la version applicative sauf nécessité démontrée.
- Ne pas persister la position dans la bibliothèque SQLite : elle est une préférence d’interface propre au poste et au profil utilisateur.

## Données et frontières

- Zenith Ice reste la production.
- CODEX_VM est l’environnement de développement.
- La copie de la vraie bibliothèque présente sur CODEX_VM reste une donnée personnelle locale : **ne jamais l’utiliser dans les tests automatisés ni la publier**.
- Utiliser exclusivement des fixtures et profils temporaires pour les contrôles automatisés.
- Ne pas commencer le thème sombre ou le menu Affichage.

## Vérifications proportionnées

- Lire le rapport 046 et inspecter le code réellement livré avant modification.
- `npm.cmd run build`.
- Étendre ou compléter `scripts/electron-editor-position-check.cjs` pour vérifier explicitement la persistance entre processus Electron et les cas d’isolation/corruption.
- Relancer le test ciblé de navigation/recherche si le flux de démontage/remontage de l’éditeur est touché.
- Les suites historiques non liées peuvent rester non rejouées ; documenter clairement ce qui est exécuté et ce qui ne l’est pas.
- Recette Windows réelle sur données fictives : fermeture complète, relance, réouverture des documents et contrôle visuel de la zone retrouvée.

## Rapport et livraison

Créer :

`reports/047_Persistance_position_edition_entre_sessions_report.md`

Le rapport doit expliquer :

- la clé et le format de stockage ;
- l’identification des bibliothèques ;
- les moments de lecture/écriture ;
- la robustesse aux données corrompues ;
- l’absence de modification métier ;
- les tests exécutés, non exécutés et leurs limites.

Publier le code, les tests et le rapport sur `origin/main` quel que soit le verdict (GO, PARTIEL, NO-GO, BLOQUÉ), sans push forcé. Vérifier le SHA distant, `git diff --check`, l’état propre et synchronisé.

**S’arrêter après 047 pour recette humaine. Ne pas commencer le thème sombre.**
