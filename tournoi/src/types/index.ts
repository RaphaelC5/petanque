// ============================================================================
// Modèle de données — Semaine des Copains Marseille
// ============================================================================
//
// Point d'extension « olympiades » : aujourd'hui seul `petanque` est codé.
// Pour ajouter une épreuve, étendre `GameKind` et fournir une implémentation
// du moteur correspondant (voir engine/game.ts). Le reste du modèle
// (tournoi, équipes, classement) est volontairement générique.
// ============================================================================

export type GameKind = 'petanque';

export type Role = 'tireur' | 'pointeur' | 'mixte';

export interface Player {
  id: string;
  nom: string;
  role: Role;
  emoji?: string;
  couleur?: string;
}

export type TeamFormat = 'doublette' | 'triplette';

export interface Team {
  id: string;
  nom: string;
  playerIds: string[];
  /** Vrai si la composition s'écarte de l'idéal (2 tireurs, 2 pointeurs...). */
  desequilibree: boolean;
}

export type CompetitionMode =
  | 'poules_finales' // poules + phase finale paramétrable
  | 'elimination' // élimination directe (byes gérés)
  | 'poule_unique' // une grosse poule round-robin
  | 'championnat'; // round-robin aller-retour

export type MatchStage = 'poule' | 'bracket';
export type MatchStatus = 'a_jouer' | 'en_cours' | 'termine';

export interface Match {
  id: string;
  stage: MatchStage;
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  status: MatchStatus;
  winnerId: string | null;
  // Poule
  pouleId?: string;
  // Bracket
  round?: number; // 0 = premier tour
  slot?: number; // position dans le tour
  label?: string; // « Finale », « Demi-finale »...
  nextMatchId?: string | null; // match suivant à alimenter
  nextSlot?: 'A' | 'B'; // côté du match suivant
}

export interface Poule {
  id: string;
  nom: string;
  teamIds: string[];
}

export type TournamentStatus = 'config' | 'equipes' | 'en_cours' | 'termine';

export interface Tournament {
  id: string;
  game: GameKind;
  nom: string;
  format: TeamFormat;
  mode: CompetitionMode;
  /** Nombre de poules (mode poules_finales). */
  nbPoules?: number;
  /** Nombre d'équipes qualifiées par poule pour la phase finale. */
  qualifiesParPoule?: number;
  /** Taille du tableau final visée (2 = finale, 4 = demies, 8 = quarts...). */
  taillePhaseFinale?: number;
  participantIds: string[];
  teams: Team[];
  poules: Poule[];
  matches: Match[];
  statut: TournamentStatus;
  createdAt: number;
  /** Points pour gagner une partie (13 en pétanque). */
  pointsCible: number;
}

/**
 * Match « rapide » hors tournoi : deux camps de joueurs, un score, c'est tout.
 * Sert uniquement à alimenter le classement général.
 */
export interface QuickMatch {
  id: string;
  sideAPlayerIds: string[];
  sideBPlayerIds: string[];
  scoreA: number;
  scoreB: number;
  createdAt: number;
  label?: string;
}

export interface AppState {
  players: Player[];
  tournaments: Tournament[];
  /** Matchs amicaux hors tournoi (comptent dans le classement général). */
  quickMatches: QuickMatch[];
  version: number;
}

// ---------------------------------------------------------------------------
// Classement
// ---------------------------------------------------------------------------

export interface PlayerRankingRow {
  playerId: string;
  nom: string;
  role: Role;
  points: number; // +3 par victoire d'équipe
  victoires: number;
  defaites: number;
  pointsPour: number;
  pointsContre: number;
  goalAverage: number; // pointsPour - pointsContre
  matchsJoues: number;
}

export interface TeamStanding {
  teamId: string;
  nom: string;
  victoires: number;
  defaites: number;
  pointsPour: number;
  pointsContre: number;
  goalAverage: number;
  matchsJoues: number;
}
