# 056 — Palette de caractères spéciaux personnalisable

**GO pour la recette humaine sur CODEX_VM.** Dans **Outils → Caractères spéciaux…**, la palette s’ouvre en haut à droite de la fenêtre et reste disponible après insertion. Le même menu, la croix ou Échap la referment. Version 0.1.29.

## Contenu et personnalisation

| Section | Caractères au premier lancement |
| --- | --- |
| Favoris | 😂 🤣 🚀 💙 🧠 🗃️ 💝 🪄 🧶 📦 🐸 |
| Récents et Mes caractères | Listes vides |
| Typographie | — – … « » “ ” ‘ ’ ° № |
| Flèches | ← → ↑ ↓ ↔ ↕ ⇒ ⇐ ⇔ |
| Symboles pratiques | ✓ ✔ ✗ ✘ ★ ☆ ♥ ♡ ⚠ ⚙ ⌛ ⏱ |
| Marqueurs visuels | • ◦ ▪ ▫ ◆ ◇ ○ ● □ ■ |
| Maths / technique | ± × ÷ ≠ ≤ ≥ ≈ ∞ |

**Ajouter un caractère…** accepte un seul graphème par saisie ou collage. Le navigateur segmente la chaîne avec `Intl.Segmenter` et conserve la séquence exacte, y compris pour un emoji composé. Le contrôle écarte les entrées vides, les blancs seuls, les caractères de contrôle et les chaînes de plusieurs graphèmes. Le typage TypeScript inclut les déclarations Intl nécessaires.

**Organiser** permet de basculer les favoris en cliquant sur leurs tuiles. Dans **Mes caractères**, la croix retire aussi le caractère personnel des favoris. Les récents gardent la trace des insertions passées, même après ce retrait. Ils comptent au plus douze graphèmes distincts, classés par dernière insertion via la palette. Les réglages restent accessibles en consultation de la corbeille ou sans document ouvert.

## Intégration

Le menu natif envoie une intention, relayée par le preload à `App`. Le panneau React utilise les couleurs des thèmes existants et des boutons utilisables au clavier. Le renderer garde favoris, collection personnelle et récents dans la préférence du profil `textotheque:special-characters:v1`. Les listes sont dédupliquées et validées en lecture. Une préférence illisible rétablit les valeurs initiales. En cas de stockage indisponible, la palette ouverte reste utilisable, avec une persistance limitée.

`ContentEditor` expose une seule opération d’insertion, également utilisée pour Tab. Elle lit la sélection du textarea encore monté, qui reste disponible quand le focus passe à un contrôle de la palette. Le texte rejoint le gestionnaire normal de modification et d’autosave. L’effet de placement du caret existant rend le focus et positionne les deux bornes après toute la séquence UTF-16. La mémoire de position 046–047 conserve son rôle lors de la navigation. Le schéma SQLite et les API métier sont inchangés.

## Vérifications

- `npm.cmd run build` — compilation TypeScript renderer/Electron et build Vite réussis.
- `node scripts/electron-character-palette-check.cjs` — trois sessions Electron sur profil et bibliothèques fictifs. Contrôles du menu, d’Échap, des listes, des thèmes clair/sombre, du focus, du caret après insertion de 👩🏽‍🚀, du remplacement d’une sélection arrière et du dirty/autosave. Vérification des notes et du titre, du mode corbeille, du cas sans document, de la persistance après relance, du JSON corrompu et des douze récents. La gestion des préférences a conservé le compteur SQLite d’écritures externes observé par une connexion en lecture seule.
- `node scripts/electron-editor-position-check.cjs` — les quatre phases existantes passent, dont Tab, Ctrl+↑ / Ctrl+↓, les changements de document et de bibliothèque et la restauration après relance.
- Les suites générales DB, recherche et catalogue n’ont pas été rejouées. Les contrôles de thème portent sur le renderer. Le confort visuel et le rendu des glyphes par Windows sont laissés à la recette humaine. Aucun Setup fabriqué.

## Recette de David

1. Dans un texte fictif, placer le caret au milieu d’une phrase. Ouvrir la palette, cliquer sur 🧠 puis continuer à taper.
2. Sélectionner un mot et cliquer sur 🐸. Vérifier le remplacement et la sauvegarde.
3. Ajouter 🦊, choisir **Organiser**, cliquer sur 🦊 puis **Terminer**. Le retrouver dans **Favoris**.
4. Insérer quelques caractères, en réutiliser un et consulter **Récents**. Fermer et rouvrir Textothèque pour retrouver les trois listes.
5. Vérifier la lisibilité en thème sombre et la fermeture par Échap.
