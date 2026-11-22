# Runbook de release Windows

Sur CODEX_VM, appliquer les étapes correspondant à la mission. Le point de remise est un dossier local qu’identifient ensemble la version, le commit source et le SHA-256 du Setup. David prend la suite sur Zenith Ice.

## 1. Fixer la version et le niveau de fabrication

**Codex conserve la version de `package.json`. Tout changement exige une décision explicite de David relayée par la mission.** La progression ordinaire actuelle est `0.1.x → 0.1.(x+1)`. Ainsi, `0.1.29 → 0.1.30` illustre la règle arithmétique et exige sa propre décision. Une correction, une icône, un rebuild, une candidate, un Setup ou un rapport ne déclenchent aucun incrément. David réserve `0.2.0` à un jalon produit exceptionnel. Ni le nombre de missions, ni le temps écoulé, ni l’ampleur technique ni SemVer ne déterminent ce jalon.

Une **release** est une version destinée à être distribuée. Un **rebuild** est une nouvelle fabrication, éventuellement au même numéro après un changement de source. Deux builds d’une même version peuvent avoir des SHA-256 différents.

| Niveau demandé | Résultat attendu |
| --- | --- |
| A — Build ou candidate de développement | Vérifier une évolution avec les tests ciblés correspondants. La version courante convient. Aucun dossier de remise à préparer. |
| B — Candidate de release | Tester un build précis. Une **release qualifiée** est une candidate qui a passé les contrôles prévus. Pour qualifier une mise à jour, comparer l’installation fictive avant et après sur CODEX_VM. |
| C — Artefact final de livraison | Fabriquer depuis un commit gelé et propre, contrôler le binaire explicitement choisi pour David et vérifier sa copie. Une qualification antérieure ne désigne pas automatiquement le Setup final. |

## 2. Vérifier la source et l’identité

- Synchroniser `main` avec `origin/main` selon la mission. Relever `git rev-parse HEAD`, vérifier `git status --short` et `git diff --check`. Pour la fabrication finale, attendre un arbre propre en préservant les modifications existantes.
- Comparer la version autorisée à `package.json` et à la version du projet dans `package-lock.json` (racine et entrée `packages[""]`). Sur un environnement Node neuf, suivre la procédure d’installation verrouillée ciblant Electron. [Distribution Windows](DISTRIBUTION_WINDOWS.md)
- Si la chaîne a évolué, relire les derniers rapports de packaging. Vérifier les ressources d’identité modifiées avant la fabrication. Tout changement des identités suivantes relève d’une mission dédiée.

| Identité | Valeur à retrouver |
| --- | --- |
| Produit et package Squirrel / EXE / Setup | `Textotheque` / `Textotheque.exe` / `Textotheque Setup.exe` |
| AppUserModelID Windows | `com.squirrel.Textotheque.Textotheque` |
| Installation / profil STABLE / renderer | `%LOCALAPPDATA%\Textotheque` / `%APPDATA%\Textotheque` / local en `file://` |
| Profil DEV | `%APPDATA%\Textotheque-Dev` |
| ICO canonique | `assets/branding/textotheque.ico` |

## 3. Fabriquer la distribution Windows

Depuis la racine du dépôt sur CODEX_VM, la commande du **build de release** est :

```powershell
npm.cmd run release:win
```

1. **Build** — TypeScript et Vite compilent le renderer et les sources Electron dans `dist` et `dist-electron`.
2. **Packaging** — Electron Forge assemble l’application, le runtime Electron, les dépendances natives et les ressources.
3. **Fabrication Windows / Make** — le maker Squirrel de Forge produit les **artefacts de distribution**. L’**installateur / Setup**, `Textotheque Setup.exe`, est le programme que David exécutera. Le `Textotheque-<version>-full.nupkg` contient le package complet et `RELEASES` le référence.
4. **Staging** — le script vérifie le paquet référencé par `RELEASES`, copie ces trois fichiers dans `dist-release\Textotheque-<version>\` et crée `manifest.json`. Une nouvelle fabrication de la même version réutilise ce dossier. [Script de staging](../scripts/stage-windows-release.cjs)

## 4. Qualifier le binaire

Pour une fabrication finale, partir des contrôles de 054. Adapter leur portée au changement selon le principe des tests ciblés du projet. [Règles de travail](../AGENTS.md)

| Commande PowerShell | Preuve à relever |
| --- | --- |
| `npm.cmd run test:packaged-smoke` | Le package final démarre sur profil temporaire, charge le renderer local et ouvre le schéma attendu. Contrôler aussi la version en barre de statut. |
| `npm.cmd run test:installer-smoke` | Le lanceur de la STABLE fictive **déjà installée** démarre et le raccourci existe. Ce test n’exécute pas le Setup. Si l’installation provient d’une candidate antérieure, établir la correspondance des binaires ou préciser la limite. |
| `npm.cmd run test:app-identity` et `npm.cmd run test:runtime-profile` | Les identités, les profils DEV/STABLE et le chargement local restent cohérents. |

Lire le manifeste et comparer sa version, son commit et `dirty: false` à la source gelée. Recalculer la taille et le SHA-256 de **chaque** artefact. Vérifier que le Setup contient le NUPKG attendu et que son application correspond au package testé. Inspecter le NUPKG et l’ASAR pour écarter bases SQLite, profils, rapports et captures privées.

Si le schéma, les migrations ou les dépendances natives évoluent, ajouter les tests ciblés de migration, de conservation ou d’ABI Electron. Si le profil, Squirrel, les chemins ou le packaging changent, qualifier le parcours touché sur la VM. Avant toute installation ou désinstallation autorisée, inventorier le programme et le profil, établir l’origine fictive des bibliothèques et fermer Textothèque. En cas d’origine indéterminée, arrêter avant mutation. Comparer ensuite version, raccourci, entrée Windows, données et préférences. Une qualification antérieure reste utilisable pour les comportements inchangés. [Qualification de mise à jour 052](../reports/052_Qualification_mise_a_jour_STABLE_0.1.28_vers_0.1.29_report.md)

### Si l’icône change

Dans `forge.config.cjs`, vérifier l’ICO de l’EXE et du Setup, la ressource de fenêtre et l’URL Squirrel immuable. Comparer les octets servis à l’ICO canonique, puis refaire toute la fabrication pour réembarquer les images. Comparer les ressources PE du Setup, de l’EXE packagé et, sur la fixture autorisée, du lanceur et de l’EXE installé. Exemple depuis la racine, pour le package x64 :

```powershell
python scripts/check-windows-icon.py "out/make/squirrel.windows/x64/Textotheque Setup.exe" "out/Textotheque-win32-x64/Textotheque.exe"
```

Observer le raccourci, Applications installées, la fenêtre et la barre des tâches. En 053a, ces surfaces et les exécutables étaient corrects sauf le bouton de barre des tâches, qui gardait l’atome Electron après réinstallation propre. Fermer l’application, actualiser Explorer et, si nécessaire, redémarrer son shell de manière ciblée. Sur CODEX_VM, la relance par le même raccourci a alors affiché le cuivre avec le même AppUserModelID. Vérifier ce comportement avant d’envisager une modification applicative. [Diagnostic 053a](../reports/053a_Icone_transparente_et_diagnostic_barre_des_taches_report.md)

## 5. Remettre les fichiers à David

Créer sur CODEX_VM un dossier distinct des candidates, de préférence `C:\Users\codex\Documents\Livraisons\Textotheque-<version>-ZI\`. Y placer exactement les quatre fichiers du modèle 054 :

| Fichier | Contrôle après copie |
| --- | --- |
| `Textotheque Setup.exe` | Depuis le dossier de remise, exécuter `Get-FileHash -LiteralPath '.\Textotheque Setup.exe' -Algorithm SHA256`. Comparer hash et taille avec le staging et le manifeste. |
| `manifest.json` | Relire la copie du manifeste de cette fabrication. Le NUPKG et `RELEASES` restent dans le staging sauf besoin explicite. |
| `SHA256SUMS.txt` | Y inscrire au minimum le SHA-256 du Setup effectivement remis. |
| `README_TRANSFERT_ZI.txt` | Indiquer version, commit, taille, SHA-256 et les gestes de sauvegarde, fermeture, mise à jour et recette ci-dessous. Mentionner le cas du cache d’icône. |

Lister le dossier et relire les trois fichiers texte. Consigner dans le rapport le verdict, les chemins locaux exacts, le commit source, la taille et le hash après copie. Publier les sources, documents et rapports selon la mission. Le dossier de remise et les binaires restent hors Git sauf demande explicite de David. Codex s’arrête sur CODEX_VM. [Exemple de remise 054](../reports/054_Preparation_livraison_finale_0.1.29_pour_transfert_manuel_ZI_report.md)

## 6. Sur Zenith Ice — opérations manuelles de David

1. Récupérer les fichiers depuis CODEX_VM et vérifier le SHA-256 du Setup sur Zenith Ice.
2. Enregistrer le texte en cours, sauvegarder la vraie bibliothèque depuis la STABLE existante, puis fermer Textothèque.
3. Exécuter le Setup sous le même compte Windows, par-dessus l’installation existante. Une brève animation verte de Squirrel peut apparaître pendant l’installation.
4. Relancer depuis le raccourci habituel. Vérifier la version, la bibliothèque active, quelques documents et dossiers, le TODO et les préférences. Conserver les sauvegardes et l’ancien artefact jusqu’à validation humaine.

David assure le transfert et l’installation réelle. La bibliothèque personnelle reste hors du périmètre de Codex. Pour un échec ou une récupération, suivre la [procédure de distribution Windows](DISTRIBUTION_WINDOWS.md).
