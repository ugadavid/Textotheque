# Mission 056 — Palette de caractères spéciaux personnalisable

**Date :** 22 novembre 2026  
**Nature :** petit ajout ergonomique d’écriture.  
**Version :** conserver **0.1.29**. Aucun changement de version n’est autorisé par cette mission.

## Intention produit

David utilise très souvent des caractères et émojis comme :

`😂 🤣 🚀 💙 🧠 🗃️ 💝 🪄 🧶 📦 🐸`

et perd du temps à les rechercher ailleurs puis à les copier/coller.

Nous voulons intégrer à Textothèque une **petite palette de caractères spéciaux**, pensée comme un outil d’écriture simple et personnel :

- accessible rapidement ;
- capable d’insérer un caractère dans le texte courant ;
- personnalisable par David ;
- persistante entre les sessions ;
- légère, sans catalogue Unicode géant ni nouvelle dépendance.

Le but n’est **pas** de construire un explorateur Unicode complet.

---

# 1 — Accès

Ajouter au menu natif Electron :

`Outils → Caractères spéciaux…`

Le choix ouvre/ferme une palette intégrée à la fenêtre principale.

Ne pas créer une seconde application ou une fenêtre Electron indépendante sauf nécessité technique démontrée. Préférer une UI renderer légère.

La palette doit être facilement refermable :

- bouton `×` ou équivalent ;
- touche `Échap`.

---

# 2 — Placement et apparence

Créer une petite palette claire et compacte, cohérente avec les thèmes clair/sombre existants.

Elle doit contenir :

1. une zone **Favoris** ;
2. une zone **Récents** ;
3. les catégories initiales ;
4. une action **Ajouter un caractère…**.

La palette peut être un panneau/modal léger au-dessus de l’éditeur. Ne pas réorganiser toute la mise en page Textothèque pour cette fonction.

Les glyphes doivent être suffisamment grands pour être immédiatement lisibles, dans une grille dense.

Au survol, afficher un libellé lorsque nous en possédons un.

Exemples :

- `🧠 — cerveau`
- `🧶 — pelote`
- `📦 — colis`
- `🐸 — grenouille`

Ne pas rendre obligatoire une base exhaustive de noms Unicode.

---

# 3 — Liste initiale

Conserver une liste courte et utile.

## Favoris initiaux

Initialiser les favoris avec exactement :

`😂 🤣 🚀 💙 🧠 🗃️ 💝 🪄 🧶 📦 🐸`

Ces favoris doivent ensuite être modifiables par David.

## Typographie

`— – … « » “ ” ‘ ’ ° №`

## Flèches

`← → ↑ ↓ ↔ ↕ ⇒ ⇐ ⇔`

## Symboles pratiques

`✓ ✔ ✗ ✘ ★ ☆ ♥ ♡ ⚠ ⚙ ⌛ ⏱`

## Marqueurs visuels

`• ◦ ▪ ▫ ◆ ◇ ○ ● □ ■`

## Maths / technique léger

`± × ÷ ≠ ≤ ≥ ≈ ∞`

Ne pas enrichir arbitrairement cette liste pendant 056.

---

# 4 — Insertion dans l’éditeur

C’est le point ergonomique principal.

Lorsqu’un document éditable est ouvert et que David clique sur un caractère :

- insérer le caractère à la position du caret dans **le contenu du document** ;
- si une sélection existe, remplacer la sélection par le caractère ;
- placer ensuite le caret immédiatement après le caractère inséré ;
- conserver le focus dans l’éditeur de contenu ;
- déclencher le mécanisme normal de dirty/autosave exactement comme une saisie utilisateur ;
- ne pas modifier titre, notes ou métadonnées ;
- ne rien écrire si le document est en corbeille / non éditable.

La palette ne doit pas perdre la position d’insertion simplement parce que le clic sur la palette retire momentanément le focus du textarea.

Le code actuel de `ContentEditor` possède déjà la logique de sélection/caret et la mémoire 046–047 : **réutiliser cette logique au lieu de construire une seconde mécanique concurrente**.

Il peut être nécessaire d’exposer à `EditorPane` / `App` une petite API contrôlée pour :

- mémoriser la dernière sélection valide ;
- demander l’insertion ;
- restaurer focus/caret.

Garder cette API minimale.

---

# 5 — Favoris personnalisables

David doit pouvoir :

- ajouter un caractère aux favoris ;
- retirer un caractère des favoris ;
- retrouver ces favoris après fermeture/réouverture de Textothèque.

Interaction libre mais simple, par exemple :

- petite étoile sur chaque tuile ;
- clic droit ;
- bouton de favori au survol.

Choisir la solution la plus lisible sans surcharger chaque case.

Un caractère ne doit apparaître qu’une fois dans la zone Favoris.

Retirer un favori ne supprime pas le caractère des catégories initiales ni de la collection personnelle.

---

# 6 — Ajouter un caractère

Ajouter une action explicite :

`Ajouter un caractère…`

Elle ouvre une interaction minimaliste permettant à David de **coller ou saisir un seul caractère/graphe** qu’il souhaite conserver.

Exemples valides :

- `🦊`
- `©`
- `→`
- un emoji composé représenté par plusieurs points de code mais perçu comme un seul graphe Unicode.

Ne pas limiter naïvement à `string.length === 1`, car de nombreux emoji utilisent plusieurs unités UTF-16.

Utiliser si possible une validation de **graphe utilisateur unique** via une capacité native moderne disponible (`Intl.Segmenter` avec granularité `grapheme`, ou approche équivalente simple).

Refuser :

- chaîne vide ;
- plusieurs graphes distincts ;
- texte arbitraire.

Après ajout :

- le caractère rejoint une collection personnelle ;
- il doit pouvoir être mis en favori ;
- éviter les doublons exacts.

Un libellé facultatif peut être proposé uniquement si cela reste léger. **Ne pas transformer 056 en gestionnaire de fiches Unicode.**

---

# 7 — Collection personnelle

Les caractères ajoutés par David doivent être visibles dans une petite catégorie :

`Mes caractères`

Cette catégorie est distincte des Favoris :

- **Mes caractères** = caractères ajoutés personnellement ;
- **Favoris** = sélection rapide pouvant contenir aussi bien des caractères initiaux que personnels.

Permettre la suppression d’un caractère de `Mes caractères`.

Si un caractère personnel supprimé était favori :

- le retirer aussi des favoris ;
- le retirer des récents s’il n’existe plus dans aucune autre source n’est pas obligatoire ; préférer la simplicité et documenter le choix.

La suppression ne doit évidemment jamais toucher au contenu des documents où le caractère a déjà été inséré.

---

# 8 — Récents

Maintenir une petite liste de caractères récemment insérés via la palette.

Proposition :

- maximum **12** caractères distincts ;
- ordre du plus récent au plus ancien ;
- réutiliser un caractère le remonte en tête ;
- pas de doublon.

La liste doit persister entre les sessions.

Les insertions clavier normales dans le textarea ne doivent pas alimenter cette liste : uniquement les insertions effectuées depuis la palette.

---

# 9 — Persistance

Ce réglage appartient à l’outil Textothèque, pas à une bibliothèque SQLite particulière.

**Ne pas modifier le schéma SQLite.**

Utiliser une persistance renderer locale dans le profil Textothèque, sur le modèle des préférences déjà persistées.

Créer une clé versionnée explicite, par exemple :

`textotheque:special-characters:v1`

Le stockage doit contenir au minimum :

- favoris ;
- caractères personnels ;
- récents.

Prévoir une lecture défensive :

- JSON absent → valeurs initiales ;
- JSON mal formé → valeurs initiales ou récupération partielle sûre ;
- aucune panne de localStorage ne doit empêcher Textothèque de fonctionner.

Les profils DEV et STABLE restent naturellement séparés grâce à leur séparation actuelle.

---

# 10 — Menu natif / IPC

Le menu Electron doit uniquement demander au renderer d’ouvrir la palette.

Suivre le pattern existant des actions de menu :

- type/action simple ;
- preload/contextBridge ;
- écoute renderer ;
- pas d’accès Node direct depuis React.

Ne pas ajouter une API IPC complexe pour la persistance : elle peut rester côté renderer/localStorage.

---

# 11 — État sans document

Si aucun document n’est sélectionné, la palette peut rester consultable, mais l’insertion doit être désactivée ou sans effet avec une indication claire.

Même chose pour un document placé en corbeille.

L’ajout/suppression de favoris et de caractères personnels doit rester possible même sans document actif.

---

# 12 — Accessibilité / clavier

Minimum raisonnable :

- boutons réels pour les caractères ;
- `aria-label` ou `title` utiles ;
- `Échap` ferme la palette ;
- focus visible ;
- navigation clavier native des boutons acceptable.

Ne pas construire en 056 une navigation de grille ARIA sophistiquée.

---

# 13 — Thèmes

La palette doit être lisible dans :

- thème clair ;
- thème sombre.

Réutiliser les variables CSS sémantiques existantes.

Ne pas introduire de palette de couleurs indépendante.

Les emoji eux-mêmes restent rendus par le système Windows/navigateur.

---

# 14 — Ce que 056 ne fait pas

Ne pas ajouter :

- catalogue Unicode exhaustif ;
- téléchargement de données Unicode ;
- dépendance externe dédiée aux emoji ;
- recherche Unicode globale ;
- skin tones / variantes automatiques ;
- raccourcis configurables ;
- synchronisation cloud ;
- stockage SQLite ;
- insertion dans le titre ou les notes ;
- nouvelle fenêtre Electron ;
- changement de version ;
- nouveau Setup/release Windows.

Ces idées pourront être réévaluées plus tard si l’usage réel les justifie.

---

# 15 — Tests ciblés

Mission UI/éditeur : tests proportionnés.

Ajouter ou adapter des contrôles ciblés couvrant au minimum :

1. ouverture/fermeture de la palette via l’action de menu ;
2. liste initiale attendue ;
3. insertion au caret ;
4. remplacement d’une sélection ;
5. caret après insertion ;
6. dirty/autosave normal après insertion ;
7. refus d’insertion sur document supprimé ;
8. favoris ajout/suppression + persistance ;
9. caractère personnel ajouté + persistance ;
10. validation d’un graphe unique, y compris un emoji multi-codepoint si possible ;
11. récents : ordre, déduplication, limite 12 ;
12. absence de mutation SQLite spécifique à la palette ;
13. thème clair/sombre au moins par contrôle renderer ou recette visuelle légère.

Préserver et vérifier les comportements directement voisins :

- Tab dans l’éditeur ;
- Ctrl+↑ / Ctrl+↓ ;
- mémoire caret/sélection existante.

Il n’est pas nécessaire de rejouer toutes les suites DB/search/catalogue si aucun de ces domaines n’est touché.

---

# 16 — Recette humaine demandée

Laisser une recette courte pour David, par exemple :

1. ouvrir un document contenant du texte ;
2. placer le caret au milieu d’une phrase ;
3. ouvrir `Outils → Caractères spéciaux…` ;
4. cliquer `🧠` et vérifier l’insertion exacte ;
5. sélectionner un mot puis cliquer `🐸` et vérifier son remplacement ;
6. ajouter un nouveau caractère personnel, par exemple `🦊` ;
7. le mettre en favori ;
8. utiliser plusieurs caractères et observer les Récents ;
9. fermer/réouvrir Textothèque et vérifier favoris, Mes caractères et Récents ;
10. vérifier rapidement le thème sombre.

---

# 17 — Rapport

Créer :

`reports/056_Palette_caracteres_speciaux_personnalisable_report.md`

Le rapport doit préciser :

- architecture retenue ;
- emplacement UI ;
- mécanisme d’insertion/caret ;
- stratégie de persistance ;
- validation grapheme ;
- liste initiale réellement livrée ;
- tests exécutés / non exécutés ;
- recette humaine proposée ;
- limites ;
- verdict GO / PARTIEL / NO-GO.

Publier code/tests/rapport sur `origin/main`.

Vérifier :

- `git diff --check` ;
- SHA distant ;
- worktree propre/synchronisé.

**S’arrêter après 056. Conserver la version 0.1.29 et ne fabriquer aucun Setup.**
