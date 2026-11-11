# orfeo-android-commun

Ce qui est commun à toutes les applications Android d'orfeo971 (Level Up, FormUp, Plouf…).
Dépôt **public** : il ne contient aucun secret, et les applications l'installent sans jeton.

## 1. `@orfeo/updater` : mise à jour depuis l'application

L'application cherche une nouvelle version dans les **Releases GitHub** de son dépôt, télécharge l'APK et le fait installer par Android.
Le code vient de Level Up et fonctionne de la même façon.

| Partie | Fichier |
|---|---|
| Android : téléchargement, autorisation « sources inconnues », installation (`PackageInstaller`) | `android/src/main/java/fr/orfeo/updater/` |
| JavaScript : recherche de version, vérification automatique, téléchargement, état | `src/index.js` |
| Interface en français : bannière d'accueil, carte d'état, section Réglages, feuille de progression | `src/ui.js`, `src/ui.css` |

### Installation dans une application

`package.json` (toujours une étiquette précise, jamais `main`) :

```json
"dependencies": { "@orfeo/updater": "github:orfeo971/orfeo-android-commun#updater-v1.0.0" }
```

Puis `npx cap sync android` : Capacitor intègre l'extension native (permission `REQUEST_INSTALL_PACKAGES`, récepteur d'installation).
Rien à ajouter dans `MainActivity` ni dans `AndroidManifest.xml`.

```js
import { createUpdater } from "@orfeo/updater";
import { banniere, carteEtat, sectionReglages, feuille, titreFeuille } from "@orfeo/updater/ui";
import "@orfeo/updater/ui.css";

const maj = createUpdater({ name: "Plouf", repo: "orfeo971/plouf", prefix: "plouf-v", private: true });
maj.onChange(render);        // l'état change : redessiner
maj.autoCheck();             // au démarrage, une fois par jour

// actions des boutons (data-act)
// update-check  → toast(await maj.check({ manual: true }))
// update-open   → ouvrir une feuille : titreFeuille(maj) / feuille(maj)
// update-start  → maj.start()          update-cancel → maj.cancel()
// update-perm   → maj.openInstallSettings()
// gh-token-save → maj.setToken(document.querySelector("#ghTokenIn").value)
// gh-token-del  → maj.setToken("")
```

## 2. Procédure commune de construction et de publication

`.github/workflows/apk-android.yml` : tests, application web (`npm run sync`), APK signé, publication dans les Releases
avec l'étiquette `<tag-prefix><version>` lue par `@orfeo/updater`.

```yaml
# .github/workflows/android.yml de l'application
name: Plouf APK
on:
  push:
    branches: [main]
    paths-ignore: ["**/*.md"]
  workflow_dispatch:
jobs:
  apk:
    uses: orfeo971/orfeo-android-commun/.github/workflows/apk-android.yml@v1
    with:
      app-name: Plouf
      tag-prefix: plouf-v
      version-prefix: "0.1"
    secrets: inherit
```

## Conventions

- Étiquette de release : `<appli>-v<majeur>.<mineur>.<build>`, avec l'APK joint.
- `versionCode` = numéro de build de la CI, toujours croissant ; `versionName` = `<version-prefix>.<build>` (même valeur que l'étiquette).
- Une clé de signature fixe par application, jamais changée (sinon Android refuse la mise à jour et il faut désinstaller).
- Dépôt privé : jeton GitHub « fine-grained », lecture seule, limité au dépôt, saisi une fois dans l'application, hors sauvegardes.
- Vérification automatique une fois par jour, bannière sur l'accueil, carte d'état en haut des Réglages.

## Versions de ce dépôt

- `updater-vX.Y.Z` : versions de `@orfeo/updater` (les applications pointent sur l'une d'elles).
- `v1` : étiquette mobile de la procédure de publication, déplacée à chaque amélioration compatible.

Toute correction se fait ici une seule fois ; chaque application monte ensuite son numéro de version de `@orfeo/updater`.
