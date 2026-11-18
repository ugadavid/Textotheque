# Mission 043 — Recherche avancée, navigation et en-tête

**Verdict GO pour le parcours 043 sur CODEX_VM.** Le bouton « Recherche avancée » ramène au document de départ, y compris lorsque celui-ci ne figure pas dans les résultats. Le chevron adjacent replie et déplie les critères. La compilation et la recette ciblée sous Windows passent. La suite UI générale reste bloquée par une assertion de version antérieure à cette mission.

## Comportement et choix de navigation

Au départ du commit `305fd32`, le bouton du catalogue appelait `toggleAdvancedSearch` et modifiait uniquement la visibilité des critères. Le titre du catalogue empilait « RECHERCHE » et « Résultats de recherche ». Le constat initial provient de la lecture du renderer.

À l’entrée dans la recherche, le renderer mémorise l’identifiant du document affiché dans l’éditeur. Une entrée depuis « Tous les textes » a pour origine le catalogue, même si les métadonnées affichent encore une sélection. Trier, filtrer ou replier le panneau conserve cette origine. Le chevron modifie un état de présentation indépendant des dépendances de la requête de recherche.

Au retour, une lecture par identifiant vérifie la disponibilité du document et son état de corbeille. L’éditeur retrouve son brouillon en mémoire. Une navigation volontaire vers un résultat utilise le garde-fou existant et fixe une nouvelle origine lors de la prochaine recherche. Une sortie de recherche ou une bascule de bibliothèque invalide la référence, y compris pour une lecture de retour encore en vol.

Sans document initial, ou si le document est devenu indisponible sans modification en attente, le bouton affiche « Tous les textes ». Si le document est indisponible et que son brouillon est modifié, l’éditeur conserve la saisie et affiche un message. Échap garde son parcours de sortie et de remise à zéro. Le menu natif conserve ses commandes et ses raccourcis.

## Fichiers et portée

| Fichier | Changement |
|---|---|
| `src/App.tsx` | Mémorisation et invalidation de l’origine, séparation du retour et du repli. |
| `src/components/DocumentCatalog.tsx` | Titre unique « Recherche », bouton principal et chevron avec libellé accessible et état déplié. |
| `src/styles/app.css` | En-tête de recherche plus compact, contrôles pouvant passer à la ligne et chevron orienté selon l’état. |
| `src/services/documents.ts` | Accès en lecture à la méthode `getDocument` déjà exposée par le preload. |
| `scripts/electron-search-navigation-check.cjs` | Recette reproductible du renderer compilé dans une fenêtre Electron réelle. |
| `reports/043_Recherche_avancee_navigation_et_entete_report.md` | Présent rapport. |

Le périmètre et le brief conservent la version applicative 0.1.28. Les modifications portent sur le renderer, le contrôle ciblé et ce rapport.

## Vérifications du 18 novembre 2026

| Commande | Résultat |
|---|---|
| `npm.cmd run build` | Succès, code 0. Compilation TypeScript, Vite et Electron. |
| `node scripts/electron-search-navigation-check.cjs` après le build | Succès, code 0. Fenêtre Electron Windows avec le vrai main, le preload et une bibliothèque SQLite fictive. |
| `npm.cmd run test:ui-safeguards` | Échec, code 1, sur `unexpected application version`. Le test exige 0.1.27 alors que le manifeste indique 0.1.28. Les assertions ultérieures de cette suite restent non vérifiées. |
| `git diff --check` et revue des chemins | Portée limitée aux six fichiers ci-dessus. |

La recette commence sur une bibliothèque vide, puis crée **Alpha** et **Beta**. Depuis Alpha, le filtre « Favoris seulement » produit Beta comme seul résultat. La recette contrôle le titre unique, la proximité des deux boutons dans la fenêtre rendue, le sens du repli via son état accessible, la conservation du filtre et de la ligne de résultat, puis le retour à Alpha depuis le panneau replié.

Un second passage modifie le corps d’Alpha, tente d’ouvrir Beta, annule la confirmation, retrouve le brouillon et vérifie son autosauvegarde en base. Les scénarios suivants ouvrent volontairement Beta, changent de vue, quittent par Échap et mettent Beta en corbeille pendant la recherche pour contrôler le retour au catalogue. La recette est instrumentée. Le confort visuel reste à apprécier par le mainteneur.

La recette utilise un profil, une base et un registre temporaires sous `%TEMP%\textotheque-test-search-navigation-*`. Le lanceur attend la fin d’Electron, ferme le serveur et vérifie la suppression du répertoire. Le port 5173 était libre après exécution. La copie personnelle sur CODEX_VM et la production Zenith Ice sont restées hors des essais.

Les suites DB, migration, moteur FTS, sauvegardes, packaging et les autres tests hors navigation n’ont pas été relancés. Les échecs historiques de `test:autosave` et `test:saved-searches` signalés par le rapport 041 restent hors périmètre. La recette ciblée valide le brouillon et son autosauvegarde dans ce parcours précis.
