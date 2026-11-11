# orfeo-android-commun : consignes pour Claude

- Code, interface et documentation en **français**.
- Dépôt public : jamais de secret, de clé de signature ni de jeton.
- Le comportement doit rester identique pour toutes les applications (Level Up, FormUp, Plouf) : toute évolution est rétrocompatible ou change de version majeure.
- Après une modification de `@orfeo/updater` : `npm test`, monter `version` dans package.json, étiquette `updater-vX.Y.Z`.
- Après une modification compatible de `.github/workflows/apk-android.yml` : déplacer l'étiquette `v1`.
