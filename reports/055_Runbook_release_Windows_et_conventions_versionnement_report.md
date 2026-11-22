# 055 — Runbook de release Windows et conventions de versionnement

**GO documentaire.** La procédure de fabrication, de qualification et de remise est désormais consultable depuis les instructions du dépôt et la documentation de distribution. La version du projet reste 0.1.29.

## Documents lus et sources vérifiées

Lecture du briefing 055, du README, d’AGENTS.md, de l’audit historique 015, de la documentation de distribution et des rapports 052, 053a et 054. Vérification de la chaîne réelle dans `package.json`, `forge.config.cjs` et `scripts/stage-windows-release.cjs`. Les scripts de smoke distinguent le package produit du lanceur de qualification déjà installé.

## Fichiers et choix documentaires

- Le [runbook](../docs/RELEASE_WINDOWS_RUNBOOK.md) suit six étapes, du choix du niveau de fabrication à la recette manuelle de David. Il distingue candidate de développement, candidate qualifiée et artefact final. Le diagnostic du cache d’Explorer figure à côté du contrôle des ressources d’icône.
- La section 19 d’[AGENTS.md](../AGENTS.md) centralise la décision de version, les deux lectures requises et la frontière entre machines. L’ancienne formulation pouvait laisser croire qu’une évolution fonctionnelle suffisait à justifier un incrément. Désormais, même la progression ordinaire `0.1.x → 0.1.(x+1)` exige une décision explicite de David relayée par la mission. Lui seul décide du jalon exceptionnel `0.2.0`.
- La [documentation de distribution](../docs/DISTRIBUTION_WINDOWS.md) reçoit un renvoi vers la procédure. Elle reste la référence pour les prérequis natifs et la récupération après échec.
- Le présent rapport consigne la recette documentaire. Codex prépare les fichiers sur CODEX_VM. David vérifie l’empreinte sur Zenith Ice, sauvegarde sa bibliothèque et assure lui-même l’installation et la recette.

## Vérifications et limites

Contrôle statique des liens Markdown, des chemins, des noms de scripts npm et de l’enchaînement Forge/Squirrel. Relecture croisée du runbook et des deux documents existants. Inspection du diff documentaire et contrôle des espaces avec `git diff --check` et `git diff --cached --check`. Les versions de `package.json` et du verrouillage restent cohérentes.

La mission porte exclusivement sur quatre fichiers Markdown. Aucun build, Setup, test Electron/SQLite ou transfert effectué. Le parcours de fabrication documenté s’appuie sur les qualifications 052–054. La publication termine la mission pour validation humaine.
