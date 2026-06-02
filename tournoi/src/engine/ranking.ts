// ============================================================================
// Classement joueur en temps réel
// ============================================================================
//
// Règle de points : chaque victoire d'équipe rapporte +3 points à CHAQUE
// joueur de l'équipe. Le goal average (points marqués − points encaissés,
// cumulés) sert de premier départage.
//
// Ordre de tri (classement d'un tournoi) :
//   1. points (3 × victoires)         — décroissant
//   2. goal average                   — décroissant
//   3. nombre de victoires            — décroissant
//   4. points marqués                 — décroissant
//   5. nom (ordre alphabétique)       — pour un tri stable
//
// Deux portées de classement :
//   • `computePlayerRanking`  → un seul tournoi (panneau du tableau de bord),
//     avec départage au goal average.
//   • `computeGlobalRanking`  → tous tournois + matchs amicaux cumulés. Le goal
//     average N'ENTRE PAS dans le tri général (points, victoires, nom).
// ============================================================================

import type { AppState, Player, PlayerRankingRow } from '../types';

export const POINTS_VICTOIRE = 3;

type Rows = Map<string, PlayerRankingRow>;

function makeEnsure(rows: Rows, byId: Map<string, Player>) {
  return (pid: string): PlayerRankingRow => {
    let r = rows.get(pid);
    if (!r) {
      const p = byId.get(pid);
      r = {
        playerId: pid,
        nom: p?.nom ?? '?',
        role: p?.role ?? 'mixte',
        points: 0,
        victoires: 0,
        defaites: 0,
        pointsPour: 0,
        pointsContre: 0,
        goalAverage: 0,
        matchsJoues: 0,
      };
      rows.set(pid, r);
    }
    return r;
  };
}

/** Comptabilise un match terminé (deux camps de joueurs) dans les lignes. */
function tally(
  ensure: (pid: string) => PlayerRankingRow,
  aPlayers: string[],
  bPlayers: string[],
  scoreA: number,
  scoreB: number,
): void {
  const aWon = scoreA > scoreB;
  for (const pid of aPlayers) {
    const r = ensure(pid);
    r.matchsJoues++;
    r.pointsPour += scoreA;
    r.pointsContre += scoreB;
    if (aWon) {
      r.victoires++;
      r.points += POINTS_VICTOIRE;
    } else r.defaites++;
  }
  for (const pid of bPlayers) {
    const r = ensure(pid);
    r.matchsJoues++;
    r.pointsPour += scoreB;
    r.pointsContre += scoreA;
    if (!aWon) {
      r.victoires++;
      r.points += POINTS_VICTOIRE;
    } else r.defaites++;
  }
}

/**
 * Trie les lignes. `useGoalAverage` n'est vrai que pour le classement d'un
 * tournoi : le classement général ne départage PAS au goal average (seulement
 * points, puis victoires, puis nom).
 */
function finalize(rows: Rows, useGoalAverage: boolean): PlayerRankingRow[] {
  const out = [...rows.values()];
  for (const r of out) r.goalAverage = r.pointsPour - r.pointsContre;
  return out.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (useGoalAverage && b.goalAverage !== a.goalAverage) {
      return b.goalAverage - a.goalAverage;
    }
    return (
      b.victoires - a.victoires ||
      b.pointsPour - a.pointsPour ||
      a.nom.localeCompare(b.nom)
    );
  });
}

export function computePlayerRanking(
  tournament: AppState['tournaments'][number],
  players: Player[],
): PlayerRankingRow[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const teamPlayers = new Map(tournament.teams.map((t) => [t.id, t.playerIds]));
  const rows: Rows = new Map();
  const ensure = makeEnsure(rows, byId);

  // initialiser tous les participants (même sans match joué)
  for (const t of tournament.teams) for (const pid of t.playerIds) ensure(pid);

  for (const m of tournament.matches) {
    if (m.status !== 'termine' || m.teamAId == null || m.teamBId == null) continue;
    if (m.scoreA == null || m.scoreB == null) continue;
    tally(
      ensure,
      teamPlayers.get(m.teamAId) ?? [],
      teamPlayers.get(m.teamBId) ?? [],
      m.scoreA,
      m.scoreB,
    );
  }

  return finalize(rows, true);
}

/**
 * Classement général : cumule les points de TOUS les tournois et de TOUS les
 * matchs amicaux. Seuls les joueurs ayant disputé au moins un match y figurent.
 * Le goal average n'entre PAS dans le tri (uniquement points, victoires, nom).
 */
export function computeGlobalRanking(state: AppState): PlayerRankingRow[] {
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const rows: Rows = new Map();
  const ensure = makeEnsure(rows, byId);

  for (const t of state.tournaments) {
    const teamPlayers = new Map(t.teams.map((tm) => [tm.id, tm.playerIds]));
    for (const m of t.matches) {
      if (m.status !== 'termine' || m.teamAId == null || m.teamBId == null) continue;
      if (m.scoreA == null || m.scoreB == null) continue;
      tally(
        ensure,
        teamPlayers.get(m.teamAId) ?? [],
        teamPlayers.get(m.teamBId) ?? [],
        m.scoreA,
        m.scoreB,
      );
    }
  }

  for (const q of state.quickMatches ?? []) {
    if (q.scoreA === q.scoreB) continue; // pas de match nul
    tally(ensure, q.sideAPlayerIds, q.sideBPlayerIds, q.scoreA, q.scoreB);
  }

  return finalize(rows, false);
}
