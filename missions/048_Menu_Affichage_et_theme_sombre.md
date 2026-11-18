# Mission 048 — Menu Affichage et premier thème sombre

**Date :** 18 novembre 2026  
**Décision fonctionnelle validée par David :** introduire la notion de thèmes dans Textothèque, en commençant par un thème sombre, accessible depuis un nouveau menu natif **Affichage**.  
**Nature :** évolution d’interface transversale mais bornée ; aucune modification du modèle métier ni de SQLite.

## Objectif utilisateur

Textothèque possède aujourd’hui une identité claire cohérente, mais aucun choix de thème. Ajouter :

- un menu natif **Affichage** dans la barre de menus Electron ;
- une entrée **Thème** ;
- deux choix pour cette première étape : **Clair** (thème actuel) et **Sombre** (nouveau thème complet).

Le choix doit être mémorisé entre les sessions. Cette mission pose un socle simple, sans galerie de thèmes ni moteur générique complexe.

## Référence visuelle et règle principale

**Le thème clair actuel est la référence fonctionnelle et structurelle.** Le thème sombre modifie les couleurs et contrastes, pas la disposition, les dimensions, les comportements, les hiérarchies ni les ancrages validés dans les missions 043–047.

Ne pas redessiner Textothèque : peindre la même application.

En particulier :
- la grille commune des barres d’outils livrée en 045 reste intacte ;
- les volets, tableaux, recherche avancée, éditeur, métadonnées, barre d’état, dialogues et contrôles gardent leurs structures ;
- aucune nouvelle densité, marge ou réorganisation n’est attendue.

## Architecture de thème attendue

Le CSS actuel contient de nombreuses couleurs littérales répétées. **Ne pas réaliser le thème sombre en ajoutant une longue seconde feuille de règles qui surcharge chaque sélecteur.**

Faire une consolidation raisonnable des couleurs dans des variables CSS sémantiques, par exemple : fond application, fond panneau, fond surface/champ, surface secondaire, texte principal, texte secondaire, bordure, accent principal, accent doux/sélection, danger, favori, dossier, focus/ombre, barre d’état.

Le thème clair doit réutiliser ces variables pour reproduire visuellement au plus près l’état actuel. Le thème sombre redéfinit ensuite ces variables au niveau racine via un attribut ou une classe de thème.

Prudence :
- ne pas convertir mécaniquement chaque couleur en variable si elle n’a aucun rôle récurrent ;
- ne pas introduire de librairie de theming ou de dépendance ;
- ne pas modifier la structure CSS commune des barres d’outils ;
- ne pas utiliser de filtre global, inversion de couleurs ou hack.

## Thème sombre — attentes

Le sombre doit être confortable pour une longue session d’écriture : fond sombre neutre/chaud plutôt que noir absolu ; éditeur sombre distinct du fond général ; texte principal contrasté sans blanc agressif ; texte secondaire lisible ; bordures discrètes ; accent vert adapté ; sélection, survol, actifs et focus clairement visibles ; boutons secondaires, champs, listes, tableaux et dialogues cohérents ; danger/corbeille reconnaissables ; favoris et dossiers identifiables.

Vérifier explicitement : navigation gauche ; éditeur et titre ; toolbar normale ; toolbar recherche avancée ; panneau des critères ; catalogue/tableau et entête sticky ; métadonnées et champs ; TODO ; corbeille ; dialogues ; barre de statut ; poignées de redimensionnement ; états disabled, hover, selected, focus-visible ; texte sélectionné dans le textarea.

## Menu natif Affichage

Dans 'electron/main.ts', insérer un menu racine **Affichage** à un emplacement naturel, idéalement entre **Bibliothèque** et **Recherche**.

Structure cible :

Affichage → Thème → Clair / Sombre

Les deux choix doivent être mutuellement exclusifs, avec coche/radio visible dans le menu natif. Le menu doit refléter le thème réellement actif, y compris au démarrage.

### Passage main ↔ renderer

Utiliser le mécanisme IPC existant de manière cohérente : le main envoie une intention de changement de thème au renderer ; le renderer applique et persiste le choix ; si nécessaire, le renderer informe le main de l’état courant pour mettre à jour les coches.

Ne pas donner au main un accès direct au localStorage du renderer. Ne pas ajouter de nouvel accès Node côté renderer.

## Persistance

Utiliser une préférence UI versionnée dans localStorage, par exemple 'textotheque:theme:v1'. Valeurs autorisées pour 048 : 'light' ou 'dark'.

Règles :
- valeur absente ou invalide → clair ;
- changement de thème → application immédiate et persistance ;
- fermeture / relance → même thème retrouvé ;
- profils DEV et STABLE restent séparés ;
- préférence globale au profil Textothèque, pas par bibliothèque.

Mettre à jour AGENTS.md dans la section des préférences UI pour documenter cette clé.

## Fond de fenêtre Electron

Le BrowserWindow utilise actuellement un backgroundColor clair. Éviter un flash clair gênant au démarrage en sombre si une solution simple et propre existe. Ne pas dupliquer la préférence du renderer juste pour cela ; privilégier la simplicité et documenter le comportement observé.

## Cas de recette obligatoires

1. démarrage sans préférence → thème clair actuel ;
2. Affichage → Thème → Sombre → bascule immédiate ;
3. menu : Sombre coché, Clair décoché ;
4. retour à Clair immédiat et fidèle à l’existant ;
5. repasser en sombre, fermer, relancer → sombre conservé et menu correctement coché ;
6. valeur de préférence invalide → fallback clair sans erreur ;
7. changer de bibliothèque → thème inchangé ;
8. recherche avancée / catalogue / éditeur → aucun changement de layout entre clair et sombre ;
9. mémoire de position 047 → caret, sélection et scroll restent fonctionnels après bascule de thème ;
10. dirty/autosave → changer de thème ne crée aucun dirty state ni écriture documentaire.

## Recette visuelle

Effectuer une recette comparative dans la vraie fenêtre Electron avec la même fixture et la même géométrie en clair puis en sombre.

Captures souhaitées, sur données fictives :
- édition normale en clair / sombre ;
- recherche avancée ouverte en clair / sombre ;
- éventuellement un dialogue ou catalogue si nécessaire pour montrer les surfaces secondaires.

La recette doit juger les contrastes, cohérences de surface et états visibles. **Ne pas prétendre valider l’esthétique humaine finale** : David fera la recette visuelle.

## Vérifications proportionnées

- npm.cmd run build ;
- ajouter un test ciblé du thème/menu ou étendre un test voisin ;
- vérifier la persistance du thème sur relance Electron ;
- vérifier que les structures/layouts n’ont pas changé entre clair et sombre ;
- relancer les contrôles directement voisins nécessaires à la toolbar/menu si pertinent ;
- les échecs historiques non liés restent hors périmètre ;
- aucun test SQLite/migration/packaging complet sans raison liée au changement.

## Données et frontières

- Zenith Ice reste la production ;
- CODEX_VM est l’environnement de développement ;
- la copie de la vraie bibliothèque sur CODEX_VM reste une donnée personnelle locale : jamais dans les tests automatisés ni dans Git ;
- utiliser uniquement des profils, bases et contenus fictifs pour captures et tests ;
- ne pas ajouter d’autres thèmes (système, sépia, contrasté...) pendant 048 ;
- ne pas modifier le schéma SQLite ni les données métier.

## Rapport et livraison

Créer 'reports/048_Menu_Affichage_et_theme_sombre_report.md'.

Le rapport doit décrire l’architecture CSS et les variables principales, le menu Affichage et la synchronisation main/renderer, la persistance/fallback, les surfaces vérifiées, les captures comparatives fictives, les tests exécutés/non exécutés et les limites.

Publier code, tests, documentation nécessaire et rapport sur origin/main quel que soit le verdict (GO, PARTIEL, NO-GO, BLOQUÉ), sans push forcé. Vérifier SHA distant, git diff --check, état propre et synchronisé.

**S’arrêter après 048 pour recette humaine. Ne pas lancer un thème supplémentaire ni une autre évolution.**