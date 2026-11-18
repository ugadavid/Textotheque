# Mission 046 — Mémoire de position d’édition pendant la session

**Verdict technique GO pour le parcours 046 sur CODEX_VM, en attente de recette humaine.** Revenir à un document retrouve le caret ou la sélection, son sens et le défilement. La recette Windows a vérifié ce retour avec deux documents de 600 lignes, puis l’oubli de la position après un redémarrage complet.

## Comportement initial

Au commit `be4f48f`, la valeur du textarea suivait le document actif. Le seul caret explicitement restauré était celui de Tab, après la mise à jour du texte contrôlé. La navigation entre documents pouvait réutiliser le même textarea. Le passage au catalogue démontait entièrement l’éditeur. Aucun des deux parcours ne conservait de coordonnées par document.

## Mémoire et cycle de vie

- Dans `src/App.tsx`, une `Map` en mémoire associe un ID documentaire à une position. Elle survit au passage par le catalogue et la recherche. Une bascule de bibliothèque réussie la remplace par une nouvelle table. Une fermeture de l’application la libère.
- Dans `src/components/EditorPane.tsx`, seul le composant du textarea est identifié par l’ID du document. À son démontage, le nettoyage de l’effet de mise en page lit les deux bornes, le sens de sélection et les deux coordonnées de défilement sur le textarea sortant. Il écrit dans la table de la bibliothèque à laquelle appartenait cet éditeur.
- Au montage, le contenu est déjà en place. L’effet de mise en page qui gère Tab applique aussi la position de retour, une seule fois. Il borne les indices à la longueur actuelle, pose la sélection, puis rétablit le défilement dans les limites admises par Chromium. À la première visite, le textarea garde sa position native. Les frappes ordinaires et les retours d’autosauvegarde conservent le même composant.
- Le mécanisme existant de Tab conserve la priorité pour une insertion. Remplacer une tabulation sélectionnée par une tabulation identique consomme le geste immédiatement, sans laisser de repositionnement en attente pour la frappe suivante.
- La restauration de session n’appelle ni `focus()` ni une commande de sauvegarde. Le parcours qui donnait déjà le focus à l’éditeur le fait désormais avec `preventScroll`. Au premier essai, Chromium déplaçait le défilement de 2 100 à 6 128 px après la restauration, pour montrer le caret. Ce réglage permet de conserver aussi la zone de lecture lorsque le caret est hors écran.

Les seules données supplémentaires sont ces coordonnées dans le renderer. Le schéma SQLite, le preload, les préférences persistantes, les dépendances et la version 0.1.28 restent ceux de la mission précédente.

## Recette Windows et tests

Le nouveau contrôle `scripts/electron-editor-position-check.cjs` lance le vrai processus principal, le preload et le renderer compilé dans Electron. Il utilise deux bibliothèques SQLite fictives et un profil temporaire, attend la fermeture des processus et vérifie le nettoyage. Le deuxième lancement reprend le même profil et la même bibliothèque pour tester la limite de session.

| Parcours | Résultat |
|---|---|
| Alpha → Beta → Alpha | Caret 6 200 et défilement 2 100 px retrouvés. |
| Alternances avec sélections distinctes | Alpha retrouve la plage 7 300–7 440 vers l’arrière et 2 700 px de défilement. Beta retrouve la plage 1 500–1 620 vers l’avant et 750 px. |
| Recherche avancée → retour à Alpha | Même sélection et même défilement après remontage. Le focus posé dans les notes y reste. Le marqueur dirty reste absent et la date de modification en base est identique. |
| Tab, frappe, autosauvegarde, aller-retour | La saisie après Tab reste au bon endroit. Le texte relu en base et le caret retrouvé correspondent au texte édité. |
| Document raccourci pendant son absence | Beta réduit à cinq caractères retrouve un caret à 5 et un défilement nul. |
| Changement de bibliothèque | Alpha et Gamma ont tous deux l’ID 1. Gamma ouvre sans la sélection d’Alpha, puis retrouve sa propre sélection après un aller-retour par la recherche. |
| Fermeture et relance d’Electron | Dans le second processus, Gamma ouvre avec une sélection vide et un défilement nul. |

| Commande | Résultat |
|---|---|
| `npm.cmd run build` | Code 0. |
| `node scripts/electron-editor-position-check.cjs` | Code 0, les deux sessions passent. |
| `node scripts/electron-search-navigation-check.cjs` | Code 0, navigation et garde-fous de recherche. |
| `npm.cmd run test:autosave` | Code 1 au scénario historique de bascule. Le double IPC omet le handler `saved-searches:list`. Les assertions Tab antérieures à ce point ont passé. |
| `npm.cmd run test:ui-safeguards` | Code 1 sur l’assertion historique exigeant 0.1.27. Les assertions ultérieures de cette suite restent non vérifiées. |

Les deux suites historiques ont reçu des profils Chromium temporaires distincts. Les suites de migration, de packaging et les autres tests hors éditeur/navigation n’ont pas été rejoués. La tolérance du contrôle de défilement est de 1 px. Le textarea actuel replie les longues lignes : la coordonnée horizontale est capturée et restaurée, mais la fixture n’exerce pas de déplacement horizontal non nul.

La mission livre les deux fichiers du renderer, le test ciblé et ce rapport. La production Zenith Ice et la bibliothèque personnelle de CODEX_VM sont restées hors des essais.
