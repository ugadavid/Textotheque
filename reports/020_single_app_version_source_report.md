# Rapport — Source unique de version applicative

## Objectif

Faire de `package.json` la source canonique de la version applicative et afficher cette version dans le renderer sans duplication manuelle.

## État initial

La version `0.1.13` était déclarée dans `package.json` et `package-lock.json`, mais aussi recopiée dans `src/App.tsx` sous la forme d'une constante locale. Cette duplication permettait une divergence silencieuse entre les métadonnées du paquet et la barre de statut.

## Source canonique

La propriété `version` de `package.json` est désormais la source canonique. La valeur reste `0.1.13` : cette mission consolide sa propagation et ne constitue pas un changement de version.

`package-lock.json` conserve ses métadonnées npm cohérentes avec `package.json`, sans devenir une seconde source applicative.

## Fichiers modifiés

- `vite.config.ts`
- `src/App.tsx`
- `src/types/build.d.ts`
- `scripts/electron-ui-safeguards-check.cjs`
- `reports/020_single_app_version_source_report.md`

## Stratégie retenue

Vite lit `package.json` au chargement de sa configuration et injecte sa propriété `version` comme constante de compilation `__APP_VERSION__` grâce à l'option `define`.

Cette solution reste minimale et respecte l'isolation du renderer : aucun accès à Node.js ou au système de fichiers n'est ajouté dans React, et aucune évolution du preload ou des échanges IPC n'est nécessaire.

## Injection de la version dans le renderer

`vite.config.ts` importe les métadonnées du paquet puis définit :

```ts
define: {
  __APP_VERSION__: JSON.stringify(packageJson.version),
}
```

`src/App.tsx` transmet directement `__APP_VERSION__` à la barre de statut. La constante locale contenant littéralement `0.1.13` a été supprimée.

## Typage TypeScript

Le fichier source maintenu `src/types/build.d.ts` déclare la constante globale comme une chaîne :

```ts
declare const __APP_VERSION__: string;
```

Ce fichier est une déclaration intentionnelle de l'environnement de build, pas une sortie TypeScript générée.

## Barre de statut

Le composant `StatusBar` conserve son interface générique et son préfixe visuel `v`. Avec la valeur issue de `package.json`, l'application affiche donc toujours `v0.1.13`.

## Vérification des duplications

Une recherche ciblée a confirmé qu'aucun littéral `0.1.13` ne subsiste dans `src/`. Les seules occurrences applicatives pertinentes sont maintenant la valeur canonique de `package.json`, sa lecture par Vite, la déclaration TypeScript et l'utilisation de la constante injectée.

L'inventaire de `src/` ne montre aucun fichier JavaScript généré. Les deux fichiers `.d.ts` présents, `src/types/electron.d.ts` et `src/types/build.d.ts`, sont des déclarations sources maintenues volontairement.

## Vérifications effectuées

Les six validations principales ont réussi avec un code de sortie `0` :

- build Vite et TypeScript ;
- migration d'une base legacy et préservation des données ;
- comportements de la couche SQLite ;
- chargement de `better-sqlite3` sous Electron ;
- exposition de l'API preload ;
- parcours de sauvegarde UI, incluant maintenant la version.

Le test UI lit `version` depuis `package.json`, attend le rendu de la barre de statut, puis vérifie la présence de `v${packageVersion}`. Il ne recopie donc pas la valeur attendue.

Les avertissements Windows connus provenant notamment de `os_crypt_win.cc` et du processus GPU sont restés non bloquants : les assertions finales ont été atteintes et les commandes concernées ont terminé avec le code `0`.

`git diff --check` ne signale aucune erreur d'espacement. Les avertissements de conversion LF vers CRLF sont liés à la configuration Git Windows existante.

## Commandes lancées

```powershell
git status --short
git diff --stat
npm.cmd run build
npm.cmd run test:legacy-migration
npm.cmd run test:db
npm.cmd run test:electron-sqlite
npm.cmd run test:preload
npm.cmd run test:ui-safeguards
rg -n '0\.1\.13|APP_VERSION|__APP_VERSION__|version' src vite.config.ts package.json
git diff --check
git status --short
git diff --stat
```

Des contrôles PowerShell ciblés ont également servi à vérifier la disponibilité du port `5173`, l'utilisation de la base temporaire et l'arrêt des processus de test.

## Test développement

Un lancement réel de `npm.cmd run dev` a été effectué avec une base temporaire dédiée :

```text
C:\Users\david\AppData\Local\Temp\textotheque-m020-dev-1786807008096.sqlite
```

Vite a démarré sur `http://localhost:5173/`, Electron a ouvert Textothèque et l'interface était fonctionnelle. Une inspection visuelle de la fenêtre réelle a confirmé l'affichage de `v0.1.13` dans la barre de statut en mode développement.

La session a ensuite été arrêtée volontairement. Le port `5173` a été confirmé libre et les processus Electron/Vite lancés pour la vérification ont été arrêtés. Le code non nul du lanceur `dev` provient de cette interruption manuelle, après la validation réussie de l'interface.

## Versionnement applicatif

La version reste `0.1.13`. Aucun numéro de version, paquet npm ou verrou de dépendances n'a été modifié.

## Points non traités

- aucune centralisation générale des autres métadonnées de `package.json` ;
- aucune modification du preload ou des canaux IPC ;
- aucune évolution fonctionnelle ou visuelle de la barre de statut ;
- aucune modification du processus de packaging.

## Risques / limites

La constante `__APP_VERSION__` dépend du chargement de la configuration Vite. Un changement futur de bundler ou un lancement du renderer contournant Vite devra fournir une valeur équivalente.

Le test UI couvre le rendu en environnement Electron de test avec handlers IPC factices ; il ne remplace pas à lui seul un test bout en bout de toutes les opérations SQLite. Le lancement manuel avec base temporaire complète cette vérification pour le périmètre de la version.

## Suite recommandée

Conserver `package.json` comme seul point de modification lors d'un prochain changement de version et maintenir l'assertion dynamique du test UI. Aucun travail complémentaire n'est nécessaire pour cette mission.
