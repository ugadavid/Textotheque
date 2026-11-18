# Mission 047 — Persistance de la position d’édition entre les sessions

**Verdict technique GO sur CODEX_VM, en attente de recette humaine.** Après une fermeture normale, le document encore ouvert retrouve sa dernière sélection et sa zone de lecture dès la première ouverture du renderer. La vérification a porté sur quatre processus Electron successifs avec le même profil temporaire et deux bibliothèques fictives.

## Format et isolation

La `Map<number, EditorPosition>` de 046 reste la mémoire immédiate du renderer. Chaque bibliothèque dispose d’une clé `localStorage` distincte : `textotheque:editor-positions:v1:<libraryInfo.path>`. La valeur est un objet JSON indexé par ID de document. Exemple fictif :

```json
{"1":{"start":8200,"end":8400,"direction":"backward","scrollTop":3400,"scrollLeft":0}}
```

Seules les bornes de sélection, son sens et les deux coordonnées de défilement sont sérialisés. La préférence appartient au profil Chromium du poste. Une bibliothèque déplacée ou renommée dispose d’une nouvelle clé. Une entrée orpheline peut rester dans l’ancienne clé.

## Lecture, capture et fermeture

- `src/services/editor-positions.ts` contient le type de 046 et les opérations de lecture et d’écriture. La lecture vérifie l’ID, les types, l’ordre des bornes, le sens de sélection et les coordonnées numériques. Une entrée invalide est ignorée individuellement. En cas de JSON illisible ou de format inconnu, la session démarre avec une table vide. Un échec d’écriture laisse la table en mémoire utilisable.
- Dans `src/App.tsx`, la table est chargée quand le chemin de la bibliothèque devient connu, puis à chaque changement de chemin. Une capture sortante reste associée à la clé de sa bibliothèque d’origine.
- Dans `src/components/EditorPane.tsx`, la même fonction lit le textarea au démontage ou sur demande de fermeture. Elle met à jour la table et écrit la préférence. Les mouvements de caret et de défilement ne déclenchent aucune écriture. La restauration reprend l’effet de mise en page de 046 avec bornage après chargement du texte et priorité à Tab.
- À la fermeture, Electron envoie déjà `app:close-requested` au renderer. Après l’accord du garde-fou existant, le renderer capture le textarea encore affiché **avant** d’appeler `approveClose()`. La dernière position ne dépend donc pas d’un démontage React tardif. Depuis le catalogue, la capture a déjà eu lieu en quittant l’éditeur.
- `AGENTS.md` référence la nouvelle clé dans la section des préférences UI. Le schéma SQLite, les IPC, le preload, les dépendances et la version 0.1.28 sont inchangés.

## Recette Windows

Le test étendu `scripts/electron-editor-position-check.cjs` lance quatre processus successifs. Chaque fenêtre se ferme par le flux normal. Le test attend sa sortie avant le lancement suivant et supprime le répertoire temporaire à la fin.

| Passage | Observation |
|---|---|
| Session initiale | Les alternances Alpha/Beta, Tab suivi d’une frappe, l’autosauvegarde, le retour depuis la recherche et la préservation du focus passent. Dans la seconde bibliothèque, Gamma, également ID 1, ouvre à sa position initiale. Juste avant fermeture, sa sélection est changée de 6 400–6 500 à 8 200–8 400, sans quitter le document. |
| Première relance | Dès son montage, Gamma retrouve **8 200–8 400 vers l’arrière et 3 400 px de défilement**. Le retour à la première bibliothèque retrouve Alpha (ID 1, sélection 7 000–7 110 vers l’arrière, 2 000 px) et Beta (caret 1 500, 750 px). Les contenus et `updated_at` sont comparés aux valeurs prises avant fermeture. Aucun marqueur dirty. |
| Texte raccourci et entrée voisine invalide | Alpha a été réduit à cinq caractères alors qu’il était inactif. À la relance, sa sélection est bornée à 5 et son défilement à 0. Beta, dont le champ `scrollTop` a été rendu invalide dans la préférence, ouvre normalement. |
| JSON illisible | Après injection d’un JSON tronqué dans la clé de la bibliothèque fictive, un nouveau processus démarre. Alpha et Beta s’ouvrent, avec une sélection vide et un défilement nul vérifiés sur Beta. |

La comparaison visuelle de deux captures de la vraie fenêtre Electron montre la même première ligne visible, **« Gamma — Ligne fictive 128 »**, avant fermeture et après relance. Seules les fixtures de 600 lignes et le profil temporaire ont servi à cette recette.

## Commandes, résultats et limites

- `npm.cmd run build` — code 0.
- `node scripts/electron-editor-position-check.cjs` — code 0 aux quatre passages.
- `node scripts/electron-search-navigation-check.cjs` — code 0. Retour au document, garde-fous et démontage/remontage vérifiés. Port 5173 libre après recette.
- Les suites générales, migrations et packaging n’ont pas été rejoués. Les échecs historiques de la mission 041 restent hors périmètre. Le test couvre la fermeture normale. Un arrêt brutal peut perdre les mouvements effectués depuis la dernière capture.

Le dépôt était propre avant synchronisation sur `6a8a158`. La livraison comprend le helper de préférence, les deux fichiers du renderer, le test étendu, la mention de la clé dans les instructions et ce rapport. La production et la bibliothèque personnelle de la VM sont restées hors des essais.
