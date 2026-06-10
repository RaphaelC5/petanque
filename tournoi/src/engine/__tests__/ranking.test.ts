import { describe, expect, it } from 'vitest';
import { computeGlobalRanking, computePlayerRanking, POINTS_VICTOIRE } from '../ranking';
import { closeMatch } from '../tournament';
import type { AppState, Match, Player, Team, Tournament } from '../../types';

const players: Player[] = [
  { id: 'p1', nom: 'Alice', role: 'tireur' },
  { id: 'p2', nom: 'Bob', role: 'pointeur' },
  { id: 'p3', nom: 'Chloé', role: 'tireur' },
  { id: 'p4', nom: 'David', role: 'pointeur' },
];

const teams: Team[] = [
  { id: 'A', nom: 'Équipe A', playerIds: ['p1', 'p2'], desequilibree: false },
  { id: 'B', nom: 'Équipe B', playerIds: ['p3', 'p4'], desequilibree: false },
];

function baseTournament(matches: Match[]): Tournament {
  return {
    id: 't', game: 'petanque', nom: 'Test', format: 'doublette',
    mode: 'poule_unique', participantIds: ['p1', 'p2', 'p3', 'p4'],
    teams, poules: [{ id: 'P', nom: 'P', teamIds: ['A', 'B'] }],
    matches, statut: 'en_cours', createdAt: 0, pointsCible: 13,
  };
}

describe('computePlayerRanking', () => {
  it('+3 points à chaque joueur de l’équipe gagnante', () => {
    const t = baseTournament([
      { id: 'm1', stage: 'poule', teamAId: 'A', teamBId: 'B', scoreA: 13, scoreB: 6, status: 'termine', winnerId: 'A', pouleId: 'P' },
    ]);
    const ranking = computePlayerRanking(t, players);
    const alice = ranking.find((r) => r.playerId === 'p1')!;
    const chloe = ranking.find((r) => r.playerId === 'p3')!;
    expect(alice.points).toBe(POINTS_VICTOIRE);
    expect(alice.victoires).toBe(1);
    expect(chloe.points).toBe(0);
    expect(chloe.defaites).toBe(1);
  });

  it('cumule le goal average sur plusieurs matchs', () => {
    const t = baseTournament([
      { id: 'm1', stage: 'poule', teamAId: 'A', teamBId: 'B', scoreA: 13, scoreB: 6, status: 'termine', winnerId: 'A', pouleId: 'P' },
      { id: 'm2', stage: 'poule', teamAId: 'A', teamBId: 'B', scoreA: 4, scoreB: 13, status: 'termine', winnerId: 'B', pouleId: 'P' },
    ]);
    const ranking = computePlayerRanking(t, players);
    const alice = ranking.find((r) => r.playerId === 'p1')!;
    // pour : 13+4=17 ; contre : 6+13=19 ; GA = -2
    expect(alice.goalAverage).toBe(-2);
    expect(alice.points).toBe(POINTS_VICTOIRE); // une seule victoire
  });

  it('le goal average départage à points égaux', () => {
    const t = baseTournament([
      { id: 'm1', stage: 'poule', teamAId: 'A', teamBId: 'B', scoreA: 13, scoreB: 0, status: 'termine', winnerId: 'A', pouleId: 'P' },
      { id: 'm2', stage: 'poule', teamAId: 'B', teamBId: 'A', scoreA: 13, scoreB: 11, status: 'termine', winnerId: 'B', pouleId: 'P' },
    ]);
    const ranking = computePlayerRanking(t, players);
    // A et B ont 3 points chacun. A : GA = 13-0+11-13 = +11 ; B : -11
    expect(ranking[0].playerId === 'p1' || ranking[0].playerId === 'p2').toBe(true);
    expect(ranking[0].goalAverage).toBeGreaterThan(ranking[3].goalAverage);
  });
});

describe('computeGlobalRanking', () => {
  function baseState(over: Partial<AppState>): AppState {
    return { players, tournaments: [], quickMatches: [], version: 1, ...over };
  }

  it('cumule un tournoi et un match amical', () => {
    const t = baseTournament([
      { id: 'm1', stage: 'poule', teamAId: 'A', teamBId: 'B', scoreA: 13, scoreB: 6, status: 'termine', winnerId: 'A', pouleId: 'P' },
    ]);
    const state = baseState({
      tournaments: [t],
      quickMatches: [
        { id: 'q1', sideAPlayerIds: ['p1'], sideBPlayerIds: ['p3'], scoreA: 13, scoreB: 10, createdAt: 0 },
      ],
    });
    const ranking = computeGlobalRanking(state);
    const alice = ranking.find((r) => r.playerId === 'p1')!;
    // tournoi : +3 (victoire A) ; match amical : +3 (victoire p1)
    expect(alice.points).toBe(2 * POINTS_VICTOIRE);
    expect(alice.matchsJoues).toBe(2);
    const chloe = ranking.find((r) => r.playerId === 'p3')!;
    expect(chloe.points).toBe(0);
    expect(chloe.defaites).toBe(2);
  });

  it('ignore les matchs de bracket non joués (byes sans score)', () => {
    const t = baseTournament([
      { id: 'b1', stage: 'bracket', teamAId: 'A', teamBId: null, scoreA: null, scoreB: null, status: 'termine', winnerId: 'A', round: 0, slot: 0 },
    ]);
    const ranking = computeGlobalRanking(baseState({ tournaments: [t] }));
    // un bye (sans score) ne rapporte aucun point → personne classé
    expect(ranking).toHaveLength(0);
  });

  it('liste vide quand aucun match joué', () => {
    expect(computeGlobalRanking(baseState({}))).toHaveLength(0);
  });

  it('ignore les matchs amicaux en attente de validation', () => {
    const state = baseState({
      quickMatches: [
        // en attente (validated === false) → ne compte pas
        { id: 'q1', sideAPlayerIds: ['p1'], sideBPlayerIds: ['p3'], scoreA: 13, scoreB: 4, createdAt: 0, validated: false },
      ],
    });
    expect(computeGlobalRanking(state)).toHaveLength(0);
  });

  it('compte les matchs amicaux validés (validated true ou absent)', () => {
    const state = baseState({
      quickMatches: [
        { id: 'q1', sideAPlayerIds: ['p1'], sideBPlayerIds: ['p3'], scoreA: 13, scoreB: 4, createdAt: 0, validated: true },
        // ancien enregistrement sans le champ → considéré validé
        { id: 'q2', sideAPlayerIds: ['p1'], sideBPlayerIds: ['p3'], scoreA: 13, scoreB: 7, createdAt: 1 },
      ],
    });
    const ranking = computeGlobalRanking(state);
    const alice = ranking.find((r) => r.playerId === 'p1')!;
    expect(alice.points).toBe(2 * POINTS_VICTOIRE);
    expect(alice.matchsJoues).toBe(2);
  });
});

describe('closeMatch — règles pétanque', () => {
  it('refuse un score nul', () => {
    const t = baseTournament([
      { id: 'm1', stage: 'poule', teamAId: 'A', teamBId: 'B', scoreA: null, scoreB: null, status: 'a_jouer', winnerId: null, pouleId: 'P' },
    ]);
    expect(() => closeMatch(t, 'm1', 10, 10)).toThrow();
  });

  it('autorise la clôture avant 13 et désigne le vainqueur', () => {
    const t = baseTournament([
      { id: 'm1', stage: 'poule', teamAId: 'A', teamBId: 'B', scoreA: null, scoreB: null, status: 'a_jouer', winnerId: null, pouleId: 'P' },
    ]);
    const next = closeMatch(t, 'm1', 9, 7);
    const m = next.matches[0];
    expect(m.status).toBe('termine');
    expect(m.winnerId).toBe('A');
  });
});
