# 🌞 Semaine des Copains Marseille

Application web (mobile + desktop) pour organiser des **tournois de pétanque entre amis**, à la marseillaise. Aucun compte, aucun mot de passe.

L'app marche de deux façons :

- **Solo (par défaut)** : tout vit dans le navigateur (`localStorage`), aucun serveur requis.
- **Partagé en temps réel** : un petit serveur local (Express + SQLite) héberge le
  tournoi, plusieurs personnes s'y connectent et **chaque modification apparaît en
  direct chez tout le monde**. Voir [Partage en temps réel](#partage-en-temps-réel).

## Démarrer (solo)

```bash
npm install
npm run dev        # serveur de dev sur http://localhost:5174
```

Autres commandes :

```bash
npm run build      # build de production (typecheck + bundle dans dist/)
npm run preview     # sert le build de production
npm test            # tests unitaires du moteur de tournoi (Vitest)
```

## Partage en temps réel

Pour que plusieurs personnes saisissent les résultats ensemble, lance le **serveur
partagé**. Le Mac qui le lance fait office de serveur : tant qu'il tourne, tout le
monde voit le même tournoi se mettre à jour en direct.

```bash
npm run serve      # build + démarre le serveur partagé sur http://localhost:5174
# (ou, si dist/ est déjà buildé : npm start)
```

Le serveur stocke l'état complet dans **`tournois.db`** (SQLite, à côté de `server.cjs`)
et pousse les changements à tous les navigateurs connectés via **SSE** (Server-Sent
Events). Au tout premier lancement, si la base est vide mais que ton navigateur a déjà
des données en local, elles sont **automatiquement importées** dans le serveur.

### Donner l'accès aux copains

- **Même Wi-Fi** : les autres machines du réseau ouvrent `http://<ton-IP-locale>:5174`
  (récupère l'IP via `ipconfig getifaddr en0`).
- **Par Internet (lien temporaire)** : un tunnel gratuit, ex.
  `npx cloudflared tunnel --url http://localhost:5174`, qui donne une URL publique
  tant que le serveur tourne.

> ℹ️ Le temps réel n'existe que **tant que le Mac-serveur est allumé** et que `npm
> run serve` tourne. Éteint, l'URL ne répond plus (les données restent dans
> `tournois.db` pour la prochaine fois).

## Où sont stockées les données ?

- **Solo** : dans le **`localStorage`** du navigateur (clé `scm.tournois.v1`).
- **Partagé** : dans **`tournois.db`** côté serveur (le `localStorage` sert alors de
  cache de secours). L'app détecte automatiquement si un serveur partagé est joignable.

> ⚠️ En solo, les données sont liées à ce navigateur, sur cette machine. Vider le cache
> ou changer de navigateur les fait disparaître — d'où l'export/import ci-dessous.

### Exporter / importer

- **⬇️ Exporter** (en-tête) télécharge un fichier JSON avec toutes les données.
- **⬆️ Importer** recharge un fichier JSON précédemment exporté (remplace l'état courant).

C'est le moyen recommandé pour sauvegarder ou transférer un tournoi.

## Fonctionnalités

- **Joueurs** : création/édition/suppression, rôle (tireur 💥 / pointeur 🎯 / mixte 🤹), avatar.
- **Tournois** : nom, format (doublette / triplette), mode de compétition.
  - **Nombre impair géré** : en doublettes, la dernière équipe passe en triplette ;
    en triplettes, le reste est complété par des doublettes. La composition est
    affichée avant validation.
- **Constitution des équipes** :
  - **Aléatoire** avec une **animation de tirage type tombola** (révélation joueur
    par joueur, roulette, confettis, son optionnel, relance possible).
  - **Manuelle** : on remplit chaque équipe à la main.
  - **Équilibrage automatique** : un tireur + un pointeur par équipe autant que
    possible ; les déséquilibres inévitables sont **signalés visuellement**.
- **Modes de compétition** :
  - **Poules + phases finales** : nombre de poules paramétrable, round-robin par
    poule, puis tableau final à profondeur paramétrable (finale, demies, quarts,
    huitièmes). Les meilleures équipes de chaque poule sont qualifiées.
  - **Élimination directe** : bracket simple avec gestion des **byes** quand le
    nombre d'équipes n'est pas une puissance de 2.
  - **Poule unique** : un seul round-robin, classement final = classement de poule.
  - **Championnat** : round-robin **aller-retour**.
- **Saisie des scores** : partie en **13 points**, clôture possible **avant 13**
  (le vainqueur est le score le plus élevé ; pas d'égalité). Steppers +/− pensés mobile.
- **Classement joueur en temps réel** (panneau de gauche, repliable sur mobile) :
  - **+3 points** à chaque joueur de l'équipe gagnante.
  - **Goal average** (points marqués − encaissés, cumulés) comme départage.
- **Vues** : poules (tableaux + matchs), tableau final (bracket), tous les matchs.

### Règle de tri du classement joueur

1. Points (3 × victoires) — décroissant
2. Goal average — décroissant
3. Nombre de victoires — décroissant
4. Points marqués — décroissant
5. Nom (alphabétique, tri stable)

## Architecture

```
src/
  types/            modèle de données (générique « Jeu / Épreuve »)
  engine/           MOTEUR DE TOURNOI — fonctions pures, testées, sans UI
    util.ts         RNG seedable, shuffle, ids, puissances de 2
    game.ts         définition d'une épreuve (point d'extension « olympiades »)
    teams.ts        tailles d'équipes, équilibrage, gestion du nombre impair
    poules.ts       répartition en poules, round-robin, classement de poule
    bracket.ts      élimination directe, byes, avancement du tableau
    ranking.ts      classement joueur (points + goal average)
    tournament.ts   orchestration (génération des matchs, clôture, finales)
    __tests__/      tests Vitest du moteur
  storage/          persistance localStorage + export/import JSON
  state/            store React (Context + reducer) avec sauvegarde auto
  components/       UI (vues, modales, classement, bracket, tirage animé…)
  theme/            thème « Copains Marseille » (CSS)
```

Le **moteur** (`engine/`) ne dépend pas de React : il est testable indépendamment
et constitue le cœur réutilisable de l'app.

## Extensibilité — ajouter d'autres jeux (« olympiades »)

Le code est structuré autour d'une abstraction **Jeu / Épreuve** (`engine/game.ts`).
Aujourd'hui seule la **pétanque** est implémentée. Pour ajouter une épreuve plus tard :

1. Étendre le type `GameKind` dans `src/types/index.ts`.
2. Déclarer une nouvelle `GameDefinition` (nom, emoji, score cible, formats, rôles)
   et l'enregistrer dans `GAMES` (`engine/game.ts`).
3. Réutiliser tel quel le moteur de tournoi (poules, bracket, classement) qui est
   générique ; n'adapter que les détails propres au jeu (score cible, rôles).

Aucune sur-ingénierie : seul le strict nécessaire à la pétanque est codé pour l'instant,
mais les points d'extension sont en place.

## Tests

```bash
npm test
```

Couvre la logique critique : tailles d'équipes et gestion du nombre impair,
équilibrage des rôles, génération round-robin, classement de poule avec goal
average, construction du bracket et gestion des byes, avancement du tableau,
calcul du classement joueur, et la règle « pas d'égalité ».
