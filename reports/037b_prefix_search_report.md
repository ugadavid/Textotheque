# Rapport — Recherche progressive par préfixe

## Objectif

Permettre aux recherches normales `all` et `any` de retrouver les documents dès que chaque terme saisi constitue le début d’un token, tout en conservant le mode `phrase` strict et toute la sécurité de construction FTS5 introduite par la Mission 037.

## Symptôme initial

Un document intitulé `TODO-Ophioglosse` n’était pas retrouvé par la saisie `ophio`. La recherche exigeait encore un token complet, ce qui rendait la barre globale peu progressive malgré son debounce de 250 ms.

## Diagnostic

Le constructeur `buildSafeFtsQuery()` citait correctement chaque terme utilisateur, mais produisait seulement `"ophio"`. FTS5 cherchait donc ce token exact. La table, le tokenizer, les triggers, l’IPC et l’interface fonctionnaient déjà correctement.

## Fichiers modifiés

- `electron/database.ts` : construction des préfixes sûrs et export du helper pour test ciblé ;
- `scripts/electron-search-check.cjs` : scénarios fonctionnels et assertions de syntaxe ;
- `reports/037b_prefix_search_report.md` : présent rapport.

## Mot complet et préfixe

Les modes `all` et `any` ajoutent désormais l’opérateur de préfixe FTS5 après chaque terme déjà cité :

```text
ophio
→ "ophio"*
```

Une saisie `ophio` retrouve donc `Ophioglosse`. En revanche, `phiog` ne correspond pas : le changement porte uniquement sur les préfixes de tokens, jamais sur les sous-chaînes internes.

## Syntaxe FTS5 générée

Le caractère `*` est ajouté par Textothèque après la valeur citée :

```text
"ophio"*
```

Il n’est jamais placé dans la valeur utilisateur (`"ophio*"`) et ne provient jamais d’une syntaxe FTS brute acceptée depuis la barre.

## Modes all / any / phrase

`all` assemble tous les préfixes avec `AND` :

```text
rab instrum
→ "rab"* AND "instrum"*
```

`any` les assemble avec `OR` :

```text
rab instrum
→ "rab"* OR "instrum"*
```

`phrase` reste strictement inchangé :

```text
genèse instrumentale
→ "genèse instrumentale"
```

Ainsi, `ophio` en mode phrase ne retrouve pas `Ophioglosse`.

## Sécurité du quoting

Le helper existant `quoteFts5Value()` reste l’unique voie de transformation des termes. Il entoure les valeurs de doubles quotes et double toute quote interne. L’opérateur `*` contrôlé est ajouté seulement après cette étape.

Les tests historiques couvrant `"bonjour"`, `AND`, `(a+b)`, `title:test`, `?` et `*` sont conservés et passent avec le nouveau comportement. Ces saisies ne deviennent pas des opérateurs ou des expressions FTS utilisateur.

## CI_AI et zones

Le tokenizer `unicode61 remove_diacritics 2` est inchangé. Le test `eleph` retrouve donc `Éléphant` avec la normalisation CI_AI existante.

La restriction aux zones sélectionnées reste appliquée au niveau FTS. Un préfixe présent uniquement dans les notes est retrouvé lorsque `notes` est sélectionné et absent lorsque seuls `title` et `content` le sont.

## Snippets, pertinence et périodes

La requête de résultats n’a pas changé. Les prefix queries utilisent toujours `snippet()`, `bm25()`, les tris SQL, l’exclusion de la corbeille et la combinaison éventuelle avec la borne `created_at`.

Le debounce de 250 ms, la recherche date-only et la protection contre les réponses obsolètes restent inchangés.

## Absence de changement de schéma et d’index

Le schéma reste à `CURRENT_SCHEMA_VERSION = 4`. Aucun tokenizer, trigger, index FTS supplémentaire, index `prefix='…'`, table, migration ou dépendance n’a été ajouté.

## Tests ajoutés

`test:search` vérifie maintenant :

- la syntaxe exacte générée pour `all`, `any` et `phrase` ;
- `ophio` → `TODO-Ophioglosse` ;
- le refus de la sous-chaîne interne `phiog` ;
- l’absence de résultat pour `ophio` en mode phrase ;
- `instru` → `Instrumentation`, `Instrumentale` et `Instrument` ;
- `appro instr` en mode `all` ;
- l’union de deux documents distincts en mode `any` ;
- `eleph` → `Éléphant` ;
- un préfixe présent uniquement dans les notes ;
- la conservation des tests de caractères spéciaux, snippets, BM25, dates, backup et cohérence FTS.

## Vérifications effectuées

Toutes les validations ciblées demandées ont terminé avec un code de sortie 0 :

- build TypeScript/Vite/Electron ;
- moteur de recherche FTS5 ;
- catalogue SQL ;
- parcours UI et protections renderer.

Les avertissements Windows `os_crypt_win.cc` et `gpu_process_host.cc` sont les messages Electron connus. Les erreurs `SQLITE_FORCED` du test UI sont injectées volontairement et le scénario se termine bien sur `ui safeguards ok`.

Les bases utilisées par les tests vivent sous `%TEMP%\textotheque-test-*` et leurs répertoires ont été nettoyés. Aucune bibliothèque utilisateur réelle n’a été ouverte.

## Commandes lancées

```powershell
git status --short
git diff --stat
npm.cmd run test:search
npm.cmd run build
npm.cmd run test:catalog
npm.cmd run test:ui-safeguards
git status --short
git diff --stat
git diff --name-only
git diff --check
```

## Versionnement

- version applicative conservée : `0.1.25` ;
- version de schéma conservée : `4`.

La Mission 037b consolide la Mission 037 avant son commit et ne constitue pas une nouvelle version.

## Points non traités

Aucune recherche par sous-chaîne, trigramme, `LIKE`, regex, `NEAR`, stemming ou index de préfixes précalculés n’a été ajouté.

## Risques / limites

Les préfixes très courts peuvent naturellement produire davantage de résultats et rendre le classement BM25 moins discriminant. Les volumes actuels ne justifient toutefois pas un index supplémentaire ni une longueur minimale arbitraire.

Le mode phrase exige volontairement des tokens complets et ne propose aucune complétion du dernier mot.

## Suite recommandée

Effectuer le contrôle humain principal dans la bibliothèque réelle : `ophio` en recherche normale doit afficher `TODO-Ophioglosse`, tandis que la même saisie en mode « Expression exacte » doit rester sans résultat.
