// ============================================================================
// Classement joueur en temps réel
// ============================================================================
//
// Règle de points : chaque victoire d'équipe rapporte +3 points à CHAQUE
// joueur de l'équipe. Le goal average (points marqués − points encaissés,
// cumulés) sert de premier départage.
//
// Ordre de tri retenu :
//   1. points (3 × victoires)         — décroissant
//   2. goal average                   — décroissant
//   3. nombre de victoires            — décroissant
//   4. points marqués                 — décroissant
//   5. nom (ordre alphabétique)       — pour un tri stable
// ============================================================================

import type { Player, PlayerRankingRow, Tournament } from '../types';

export const POINTS_VICTOIRE = 3;

export function computePlayerRanking(
  tournament: Tournament,
  players: Player[],
): PlayerRankingRow[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const teamPlayers = new Map(tournament.teams.map((t) => [t.id, t.playerIds]));
  const rows = new Map<string, PlayerRankingRow>();

  const ensure = (pid: string): PlayerRankingRow => {
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

  // initialiser tous les participants (même sans match joué)
  for (const t of tournament.teams) for (const pid of t.playerIds) ensure(pid);

  for (const m of tournament.matches) {
    if (m.status !== 'termine' || m.teamAId == null || m.teamBId == null) continue;
    if (m.scoreA == null || m.scoreB == null) continue;
    const aPlayers = teamPlayers.get(m.teamAId) ?? [];
    const bPlayers = teamPlayers.get(m.teamBId) ?? [];
    const aWon = m.winnerId === m.teamAId;

    for (const pid of aPlayers) {
      const r = ensure(pid);
      r.matchsJoues++;
      r.pointsPour += m.scoreA;
      r.pointsContre += m.scoreB;
      if (aWon) {
        r.victoires++;
        r.points += POINTS_VICTOIRE;
      } else r.defaites++;
    }
    for (const pid of bPlayers) {
      const r = ensure(pid);
      r.matchsJoues++;
      r.pointsPour += m.scoreB;
      r.pointsContre += m.scoreA;
      if (!aWon) {
        r.victoires++;
        r.points += POINTS_VICTOIRE;
      } else r.defaites++;
    }
  }

  const out = [...rows.values()];
  for (const r of out) r.goalAverage = r.pointsPour - r.pointsContre;
  return out.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalAverage - a.goalAverage ||
      b.victoires - a.victoires ||
      b.pointsPour - a.pointsPour ||
      a.nom.localeCompare(b.nom),
  );
}
