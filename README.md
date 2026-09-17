# TILO

Puzzle logique hyper-casual par **Nibylo Games**.

## Identité
- ● cercle violet
- ◆ losange vert
- app id : `com.nibylogames.tilo`
- version prototype : `0.1.0`

## Règles
- autant de cercles que de losanges dans chaque ligne et colonne ;
- jamais trois symboles identiques consécutifs ;
- `=` signifie mêmes symboles ;
- `≠` signifie symboles différents.

## Progression
- niveaux 1–5 : 4×4 introductif ;
- niveaux 6–10 : 4×4 plus serré ;
- niveaux 11–30 : 6×6 ;
- niveaux 31–50 : densité d'indices réduite ;
- niveaux 51–69 : 6×6 très épuré ;
- niveaux 70+ : déductions plus profondes / hypothèse possible.

Chaque niveau est généré de façon déterministe et validé pour avoir une solution unique. Un niveau terminé ne peut pas être rejoué ; seul le niveau courant peut être recommencé.

## Indices et erreurs
- 3 indices gratuits par grille ;
- 3 erreurs autorisées ;
- à la 3e erreur : proposition d'une publicité récompensée pour débloquer un 4e indice ;
- sinon le joueur peut recommencer le niveau courant.

## Publicité
Le flux AdMob Rewarded est déjà branché avec `@capacitor-community/admob`.

Créer un fichier `.env` depuis `.env.example` :

```env
VITE_ADMOB_REWARDED_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY
```

Sur navigateur, la récompense est simulée afin de tester tout le parcours sans publicité réelle.

## Développement
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```
