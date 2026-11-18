# Mission 042 — Harmonisation du dépôt

**Verdict GO — 18 novembre 2026.** La recette CODEX_VM rejoint les rapports historiques sous le numéro 041. Le brief 042 inaugure le dossier `missions/`. Le mainteneur valide désormais le résultat après publication du rapport et du commit de mission.

## Changements documentaires

| Fichier | Intervention |
|---|---|
| [Rapport 041](041_Installation_et_recette_sur-CODEX_VM.md) | Déplacement depuis `reports/TXT-VM-001/rapport.md`. Le texte et son titre historique sont intégralement conservés. Le dossier d’origine a disparu. |
| [AGENTS.md](../AGENTS.md) | La section 32 remplace l’attente systématique d’une décision de commit par le circuit de synchronisation, d’exécution et de publication sur `origin/main`, y compris pour un résultat PARTIEL, NO-GO ou BLOQUÉ. Elle précise les protections du travail concurrent et des données personnelles. La section 33 impose le chemin des rapports et consigne l’exception 041. La section 34 prévoit la vérification du SHA distant et l’arrêt pour validation humaine. |
| [README.md](../README.md) | La section 16 présentait le nommage comme une recommandation. Elle indique désormais la même convention obligatoire que la section 33 d’AGENTS.md. |
| `reports/042_Harmonisation_du_depot_report.md` | Rapport de la présente intervention. |

La recherche des références à l’ancien chemin a trouvé sa mention historique dans le [brief 042](../missions/042_Harmonisation_du_depot.md), qui désigne la source du déplacement. Aucun lien de navigation ne nécessitait de redirection. L’installation 041 est documentée par son rapport d’origine, sans création rétroactive d’un brief. Les références de collaboration du dépôt `ugadavid/boite-contre-oubli` ont été consultées en lecture seule, dont `INDEX.md` et `methodologie/collaboration-et-briefs-codex.md`.

## Contrôles et état Git

- Le dépôt était propre sur `main`. La commande `git pull --ff-only origin main` a avancé de `8d21e09` à `144a21a` et apporté le brief 042.
- L’empreinte SHA-256 du fichier sur disque était identique avant et après déplacement : `6D9423D1831B1FB1D9687459EA13172369F734DEFF8631249308BDB0AB24F567`. Le blob Git du rapport 041 correspond aussi à celui de l’ancien chemin : `28660a5b6b50b10388888b553955d650812b957c`.
- Le nouveau chemin existe et `Test-Path -LiteralPath reports/TXT-VM-001` renvoie `False`. L’ancienne règle de validation préalable du commit et l’ancienne formulation du README ont été recherchées dans les instructions actives. Le contrôle `git diff --check` est passé.
- La livraison se limite aux quatre entrées documentaires du tableau, déplacement compris. La version applicative reste à 0.1.28. La portée documentaire justifie de limiter les vérifications aux fichiers et à Git, sans build, lancement Electron ni test SQLite.

## Point hors périmètre

La section 30 d’AGENTS.md classe encore l’autosave parmi les fonctionnalités reportées, alors que le rapport 041 documente son existence et les limites du test de bascule. Cette incohérence fonctionnelle est signalée pour une autre mission. La présente intervention n’a accédé ni à la production Zenith Ice ni à la bibliothèque personnelle de test sur CODEX_VM.
