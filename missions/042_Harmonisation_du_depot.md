# Mission 042 — Harmonisation documentaire et circuit de collaboration

**Projet :** Textothèque  
**Dépôt :** `ugadavid/Textotheque`  
**Nature :** rangement documentaire et alignement des instructions de travail, sans évolution fonctionnelle  
**Décision utilisateur :** 18 novembre 2026

## Objectif

Faire adopter à Textothèque le même passage de relais ChatGPT → GitHub → Codex → GitHub que les autres projets. Reprendre la numérotation historique des rapports, avec **041** pour la recette CODEX_VM déjà effectuée. La prochaine intervention porte le numéro **042** ; la prochaine amélioration de la recherche sera **043**.

## Autorités documentaires

1. Lire `README.md`, `AGENTS.md` et les rapports pertinents.
2. Référence de collaboration (lecture seulement) : `ugadavid/boite-contre-oubli`, notamment `INDEX.md` et `methodologie/collaboration-et-briefs-codex.md`. Le protocole source est également indexé sous `references/`. Si accès refusé, s'appuyer sur la présente mission et signaler cette limite.
3. Les exigences de sécurité des données et d'architecture de Textothèque dans `AGENTS.md` restent en vigueur sauf contradiction explicite avec le nouvel accord de publication.
4. Vérifier `git status`, `git diff` et la synchronisation prudente avec `origin/main` ; ne jamais écraser des modifications concurrentes.

## Travaux autorisés

### A. Missions canoniques

- Vérifier que le dossier `missions/` existe désormais grâce au présent fichier.
- Formaliser dans `AGENTS.md` le cycle suivant : ChatGPT publie les prochaines missions dans `missions/` ; Codex lit la mission après synchronisation, la réalise, publie son rapport et ses modifications autorisées sur `origin/main`, vérifie le SHA distant et s'arrête.
- Ne pas recréer rétroactivement un faux brief 041 : la mission d'installation a déjà été exécutée ; son rapport suffit comme trace historique.

### B. Déplacement du rapport de recette

- Déplacer **sans perte de contenu** :
  `reports/TXT-VM-001/rapport.md`
  vers :
  `reports/041_Installation_et_recette_sur-CODEX_VM.md`
- Le document 041 conserve son titre historique TXT-VM-001 à l'intérieur si utile à la provenance, mais son emplacement et sa numérotation répondent à la nouvelle convention.
- Ne pas recopier dans Git les bases SQLite, journaux personnels ou captures de données réelles.
- Corriger uniquement les références devenues inexactes vers l'ancien emplacement, sans réécrire les anciens commits.
- Ne pas supprimer d'autres rapports, répertoires ou informations historiques.

### C. Ajuster AGENTS.md au fonctionnement réellement décidé

- Corriger les passages des sections « Git : règle de travail » et « Fin de mission » qui interdisent un commit sans validation routinière.
- Décrire explicitement la publication normale de Codex, **y compris en cas de verdict PARTIEL, NO-GO ou BLOQUÉ**, avec rapport sincère, contrôles Git, SHA distant et arrêt strict après mission.
- Conserver les garde-fous : aucun push forcé, aucune réécriture d'historique, aucune suppression intempestive, aucun secret ni donnée utilisateur dans Git, aucune action hors périmètre ; escalader les décisions destructives ou structurantes.
- Mettre à jour la section « Rapports » pour imposer un fichier `reports/NNN_description_report.md` **directement dans `reports/`**, sans sous-dossier par mission. La renumérotation 041 de ce jour est une exception de régularisation du nom, pas une réécriture des rapports antérieurs.
- Vérifier et résoudre les autres contradictions documentaires manifestes et directement liées au protocole, sans refondre tout `AGENTS.md`.
- Si une référence du type « autosave absent » est obsolète, ne pas la corriger hors sujet sans preuve ni nécessité ; signaler simplement dans le rapport.

### D. Rapport 042

Créer à la racine de `reports/` : `042_Harmonisation_du_depot_report.md`.

Il indiquera les fichiers déplacés/modifiés, les anciennes règles corrigées, les références mises à jour, les contrôles effectués, l'état Git et les éventuelles limites.

## Vérifications proportionnées

- Comparaison du contenu avant/après déplacement du rapport 041, sans altération.
- Existence des nouveaux chemins et absence de l'ancien chemin dans l'arbre courant.
- Recherche des références cassées ou conventions contradictoires directement concernées.
- `git diff --check` et vérification de la portée documentaire des changements.
- Aucun build ni batterie Electron/SQLite : aucun code applicatif ne doit être changé.

## Données et frontière

- **Zenith Ice : production**, hors de portée.
- **CODEX_VM : développement** ; la bibliothèque SQLite importée est une **copie de test**, mais reste une donnée personnelle à ne jamais pousser sur GitHub.
- Aucune modification du code produit, du schéma SQLite, des dépendances, de la version applicative ou du fonctionnement des tests.
- Ne pas mettre en œuvre la recherche avancée, la mémoire du caret ou le thème sombre pendant cette mission.

## Livraison

Publier le déplacement, la mise à jour documentaire et le rapport 042 sur `origin/main`, **quel que soit le verdict** ; ne pas cacher une limite. Vérifier le SHA distant et la propreté du dépôt. Fournir les liens GitHub vers le commit, le rapport 041 renommé et le rapport 042. Puis s'arrêter pour validation humaine, sans commencer la mission 043.
