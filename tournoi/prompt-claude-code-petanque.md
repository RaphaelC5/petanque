# Prompt pour Claude Code — App "Semaine des Copains Marseille"

> Copie tout le contenu ci-dessous dans Claude Code (dans un dossier vide). C'est ton brief complet.

---

## Contexte et objectif

Tu vas développer une **application web responsive** (mobile + desktop) pour organiser des **tournois de pétanque** entre amis. Le titre du produit est **« Semaine des Copains Marseille »**. L'ambiance est conviviale, sud de la France, esprit boulodrome entre potes — l'UI doit être **épurée, ergonomique, moderne et fun**, avec une touche identitaire marseillaise (couleurs chaleureuses : bleu Méditerranée, ocre/soleil, blanc cassé ; éviter le kitsch).

**Contraintes clés :**
- **Aucun login / mot de passe / compte.** L'app est ouverte, on l'héberge en local via un serveur npm (`npm run dev` / `npm run build` + preview). N'implémente aucune authentification.
- **Persistance via `localStorage`** du navigateur. Aucun backend, aucune base de données. Toutes les données (joueurs, tournois, matchs, scores) sont stockées et rechargées localement. Prévois un export/import JSON manuel (boutons « Exporter / Importer les données ») pour ne pas tout perdre.
- **Choisis librement la stack** (React + Vite recommandé pour le confort des animations et le responsive, TypeScript apprécié, librairie d'animation type Framer Motion bienvenue). Le projet doit démarrer simplement avec `npm install` puis `npm run dev`.
- **Architecture extensible** : on veut pouvoir, plus tard, ajouter d'autres jeux (« olympiades entre amis » = plusieurs épreuves). Structure donc le code avec des abstractions génériques (un concept de « Jeu » / « Épreuve » dont la pétanque est la première implémentation), même si pour l'instant seule la pétanque est codée. Sépare proprement le moteur de tournoi (logique de poules, brackets, scoring) de l'UI spécifique pétanque.

---

## Modèle de données (à concevoir, exemple indicatif)

- **Joueur** : `id`, `nom`, `rôle` ∈ {`tireur`, `pointeur`, `mixte`}, éventuellement avatar/emoji ou couleur.
- **Équipe** : `id`, `nom` (auto-généré, ex. « Les Sangliers », ou « Équipe 1 » — laisse l'option de renommer), liste de joueurs (2 = doublette, 3 = triplette).
- **Tournoi / Compétition** : `id`, `nom`, format d'équipe (doublette/triplette), mode de compétition, liste d'équipes, structure (poules + phases finales / élimination directe / etc.), statut.
- **Match** : équipes opposées, scores, statut (à jouer / en cours / terminé), rattachement (poule ou tour du bracket).
- **Classement joueur** : calculé en temps réel (voir règles de score).

Le moteur de tournoi doit être **testable indépendamment de l'UI** (fonctions pures pour la génération d'équipes, le tirage des poules, l'avancement du bracket, le calcul du classement).

---

## Fonctionnalités à implémenter

### 1. Gestion des joueurs
- Créer / éditer / supprimer des joueurs.
- Pour chaque joueur, définir son rôle : **tireur**, **pointeur** ou **mixte**.
- Liste des joueurs claire, avec indication visuelle du rôle (badge/couleur/icône).

### 2. Configuration de la compétition
- Donner un nom au tournoi.
- Choisir le **format d'équipe** : **doublettes (2)** ou **triplettes (3)**.
  - **Gestion du nombre impair** : si on choisit doublettes et que le nombre de joueurs ne permet pas de ne faire que des doublettes, la **dernière équipe passe automatiquement en triplette** (pas le choix). Gère tous les cas de reste (idem logique inverse pour triplettes si pertinent). Affiche clairement à l'utilisateur la composition qui en résulte.
- Choisir le **mode de constitution des équipes** :
  - **Manuel** : l'utilisateur glisse/sélectionne les joueurs dans chaque équipe lui-même.
  - **Aléatoire** : l'app constitue les équipes automatiquement.

### 3. Équilibrage des équipes (règle métier importante)
Que ce soit en aléatoire ou en assistance au manuel, vise des **équipes équilibrées** :
- Idéalement **un tireur + un pointeur** par équipe.
- **Éviter deux tireurs dans la même équipe** (et l'éviter aussi pour deux pointeurs si possible).
- Les joueurs **mixtes** servent de variable d'ajustement pour compléter.
- En triplette, viser une répartition cohérente (ex. ne pas concentrer tous les tireurs).
- Quand l'équilibrage parfait est impossible, prends la meilleure approximation et **signale** les équipes déséquilibrées visuellement.

### 4. Tirage animé des équipes (mode aléatoire) — soigne particulièrement ce point
Quand l'utilisateur lance la constitution aléatoire, déclenche une **animation de tirage type loto / tombola** :
- Les joueurs sont révélés **un par un**, avec **suspense** (effet de roulette/mélange, ralentissement, son optionnel désactivable, confettis ou flash quand un joueur tombe dans une équipe).
- On voit progressivement les équipes se remplir, joueur après joueur.
- L'animation doit être fluide, fun et donner envie de relancer. Possibilité de **« Relancer le tirage »**.
- Reste performant sur mobile.

### 5. Modes de compétition (code-les tous)
L'utilisateur choisit le mode au moment de créer le tournoi :
- **Poules + phases finales** : l'utilisateur définit le **nombre de poules**, le système répartit les équipes, génère les matchs de poule (round-robin dans chaque poule), établit le classement de poule, puis bascule vers une **phase finale dont la profondeur est paramétrable** : l'utilisateur choisit jusqu'où va le tableau final (finale seule, demi-finales, quarts, huitièmes…). Qualifie le bon nombre d'équipes en conséquence.
- **Élimination directe** : bracket à élimination simple, avec gestion des byes si le nombre d'équipes n'est pas une puissance de 2.
- **Poule unique (« une grosse poule »)** : toutes les équipes dans un seul round-robin, classement final au classement de poule.
- Ajoute tout autre mode pertinent que tu juges utile (ex. championnat round-robin avec match retour, double élimination) — **implémente plusieurs modes** et rends le choix clair dans l'UI.

### 6. Saisie des matchs et des scores
- Une **partie se joue en 13 points**.
- On doit pouvoir **clôturer une partie avant 13** (par ex. si on est pressés) : permettre de valider un score final même s'il n'atteint pas 13, en désignant le vainqueur selon le score saisi.
- Interface de saisie de score simple et rapide (boutons +/-, ou saisie directe), pensée mobile.
- À la clôture d'un match, le classement et l'avancement du tournoi se mettent à jour automatiquement.

### 7. Classement en temps réel (panneau de gauche)
- Un **classement par joueur** est affiché en permanence **sur la gauche** (sur mobile : panneau repliable / onglet), mis à jour **en temps réel**.
- Règle de points : **chaque victoire d'équipe rapporte +3 points à chacun des joueurs de l'équipe**.
- Le **goal average compte** : intègre la différence de points (points marqués − points encaissés, cumulés sur les matchs) comme critère de départage du classement.
- Ordre de tri : points d'abord, puis goal average, puis (au choix) nombre de victoires / points marqués. Documente la règle de tri retenue.

### 8. Visualisation du tournoi
- Vue des **poules** (tableaux de classement par poule, matchs joués / à jouer).
- Vue du **tableau final / bracket** (arbre des phases finales qui se remplit au fur et à mesure).
- Vue d'ensemble des **matchs et scores**.
- Le tout responsive et lisible.

---

## Parcours utilisateur (inspiré du concept, sans recopier)

1. **Accueil** : titre « Semaine des Copains Marseille », bouton « Nouveau tournoi », accès à la gestion des joueurs, liste des tournois existants (repris du localStorage).
2. **Création de tournoi** (pop-in / écran dédié) : nom, format d'équipe (doublette/triplette), mode de compétition (+ nombre de poules / profondeur des phases finales selon le mode), sélection des joueurs participants, mode de constitution (manuel/aléatoire).
3. **Constitution des équipes** : manuel (drag & drop / sélection) ou aléatoire (avec l'animation de tirage). Validation des équipes.
4. **Dashboard du tournoi** : classement joueurs à gauche (temps réel), au centre les poules / le bracket / les matchs, saisie des scores.
5. **Fin de tournoi** : affichage du vainqueur et du classement final, possibilité d'exporter.

---

## Qualité, livrables et attendus techniques

- **Responsive** d'abord pensé mobile (on s'en sert au boulodrome sur téléphone) puis desktop.
- **Code propre et modulaire** : moteur de tournoi en fonctions pures séparées de l'UI ; types/interfaces clairs ; nommage explicite.
- **Tests** : écris des tests unitaires pour la logique critique (équilibrage des équipes, gestion du nombre impair, génération des poules, avancement du bracket, calcul du classement avec goal average). Vérifie les cas limites (nombre de joueurs non divisible, byes, égalités).
- **README** : explique comment lancer le projet (`npm install`, `npm run dev`), comment builder, où sont stockées les données, et comment exporter/importer.
- **Extensibilité** : laisse des points d'extension documentés pour ajouter d'autres jeux/épreuves (« olympiades ») plus tard — mais **ne code que la pétanque maintenant**, sans sur-ingénierie.
- **Accessibilité de base** et états vides soignés (aucun joueur, aucun tournoi).
- Persiste tout dans `localStorage` et restaure l'état au rechargement de la page.

## Façon de procéder

1. Propose-moi d'abord une **brève architecture** (stack choisie, structure de dossiers, modèle de données, liste des modes implémentés) avant de coder massivement.
2. Puis implémente de façon incrémentale : modèle + persistance → joueurs → création tournoi → constitution d'équipes (+ animation) → matchs/scores → classement → vues poules/bracket.
3. Termine par les tests, le README, et une passe de polish UI (responsive + ambiance « Copains Marseille »).

Commence par l'architecture, puis attends mon feu vert avant de tout générer si tu as des doutes ; sinon, déroule.
