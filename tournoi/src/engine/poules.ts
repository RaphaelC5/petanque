// ============================================================================
// Poules : répartition, génération round-robin, classement
// ============================================================================

import type { Match, Poule, Team, TeamStanding, Tournament } from '../types';
import { uid } from './util';

/** Répartit les équipes dans `nbPoules` poules (distribution en serpentin). */
export function distributeIntoPoules(teams: Team[], nbPoules: number): Poule[] {
  const n = Math.max(1, Math.min(nbPoules, teams.length));
  const poules: Poule[] = Array.from({ length: n }, (_, i) => ({
    id: uid('poule'),
    nom: `Poule ${String.fromCharCode(65 + i)}`,
    teamIds: [],
  }));
  // serpentin : 0,1,2,2,1,0,... pour équilibrer les niveaux
  let idx = 0;
  let dir = 1;
  for (const team of teams) {
    poules[idx].teamIds.push(team.id);
    if (n === 1) continue;
    idx += dir;
    if (idx === n) {
      idx = n - 1;
      dir = -1;
    } else if (idx < 0) {
      idx = 0;
      dir = 1;
    }
  }
  return poules;
}

/** Round-robin (méthode du cercle). `doubleTour` ajoute les matchs retour. */
export function roundRobinMatches(
  teamIds: string[],
  pouleId: string,
  doubleTour = false,
): Match[] {
  const matches: Match[] = [];
  const ids = teamIds.slice();
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      matches.push(makePouleMatch(ids[i], ids[j], pouleId));
      if (doubleTour) matches.push(makePouleMatch(ids[j], ids[i], pouleId));
    }
  }
  return matches;
}

function makePouleMatch(a: string, b: string, pouleId: string): Match {
  return {
    id: uid('match'),
    stage: 'poule',
    teamAId: a,
    teamBId: b,
    scoreA: null,
    scoreB: null,
    status: 'a_jouer',
    winnerId: null,
    pouleId,
  };
}

/**
 * Classement d'une poule. Tri : victoires, puis goal average, puis points pour.
 */
export function pouleStandings(
  poule: Poule,
  matches: Match[],
  teams: Team[],
): TeamStanding[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const rows = new Map<string, TeamStanding>();
  for (const id of poule.teamIds) {
    rows.set(id, {
      teamId: id,
      nom: byId.get(id)?.nom ?? '?',
      victoires: 0,
      defaites: 0,
      pointsPour: 0,
      pointsContre: 0,
      goalAverage: 0,
      matchsJoues: 0,
    });
  }

  for (const m of matches) {
    if (m.pouleId !== poule.id || m.status !== 'termine') continue;
    if (m.teamAId == null || m.teamBId == null) continue;
    const a = rows.get(m.teamAId);
    const b = rows.get(m.teamBId);
    if (!a || !b || m.scoreA == null || m.scoreB == null) continue;
    a.matchsJoues++;
    b.matchsJoues++;
    a.pointsPour += m.scoreA;
    a.pointsContre += m.scoreB;
    b.pointsPour += m.scoreB;
    b.pointsContre += m.scoreA;
    if (m.winnerId === a.teamId) {
      a.victoires++;
      b.defaites++;
    } else {
      b.victoires++;
      a.defaites++;
    }
  }

  const out = [...rows.values()];
  for (const r of out) r.goalAverage = r.pointsPour - r.pointsContre;
  return sortStandings(out);
}

export function sortStandings(rows: TeamStanding[]): TeamStanding[] {
  return rows.slice().sort(
    (a, b) =>
      b.victoires - a.victoires ||
      b.goalAverage - a.goalAverage ||
      b.pointsPour - a.pointsPour ||
      a.nom.localeCompare(b.nom),
  );
}

/** Liste les `n` premières équipes qualifiées de chaque poule. */
export function qualifiedTeams(tournament: Tournament, parPoule: number): string[] {
  const out: string[] = [];
  for (const poule of tournament.poules) {
    const standings = pouleStandings(poule, tournament.matches, tournament.teams);
    out.push(...standings.slice(0, parPoule).map((s) => s.teamId));
  }
  return out;
}
