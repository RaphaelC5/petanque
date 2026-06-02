import { describe, expect, it } from 'vitest';
import {
  distributeIntoPoules,
  pouleStandings,
  roundRobinMatches,
} from '../poules';
import type { Match, Team } from '../../types';

function mkTeams(n: number): Team[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    nom: `Équipe ${i}`,
    playerIds: [],
    desequilibree: false,
  }));
}

describe('roundRobinMatches', () => {
  it('génère n*(n-1)/2 matchs', () => {
    expect(roundRobinMatches(['a', 'b', 'c', 'd'], 'P')).toHaveLength(6);
  });
  it('double tour → 2× plus de matchs', () => {
    expect(roundRobinMatches(['a', 'b', 'c'], 'P', true)).toHaveLength(6);
  });
});

describe('distributeIntoPoules', () => {
  it('répartit équitablement en serpentin', () => {
    const poules = distributeIntoPoules(mkTeams(8), 2);
    expect(poules).toHaveLength(2);
    expect(poules[0].teamIds).toHaveLength(4);
    expect(poules[1].teamIds).toHaveLength(4);
  });
  it('borne le nombre de poules au nombre d’équipes', () => {
    const poules = distributeIntoPoules(mkTeams(3), 10);
    expect(poules).toHaveLength(3);
  });
});

describe('pouleStandings — tri', () => {
  it('classe par victoires puis goal average', () => {
    const teams = mkTeams(3);
    const poule = { id: 'P', nom: 'P', teamIds: ['t0', 't1', 't2'] };
    const matches: Match[] = [
      // t0 bat t1 13-5 ; t0 bat t2 13-10 ; t1 bat t2 13-2
      mkMatch('t0', 't1', 13, 5),
      mkMatch('t0', 't2', 13, 10),
      mkMatch('t1', 't2', 13, 2),
    ];
    const standings = pouleStandings(poule, matches, teams);
    expect(standings[0].teamId).toBe('t0'); // 2 victoires
    expect(standings[1].teamId).toBe('t1'); // 1 victoire, meilleur GA
    expect(standings[2].teamId).toBe('t2');
  });

  it('départage deux équipes à égalité de victoires par le goal average', () => {
    const teams = mkTeams(3);
    const poule = { id: 'P', nom: 'P', teamIds: ['t0', 't1', 't2'] };
    const matches: Match[] = [
      mkMatch('t0', 't2', 13, 0), // t0 +13
      mkMatch('t1', 't2', 13, 11), // t1 +2
      mkMatch('t0', 't1', 5, 13), // t1 bat t0
    ];
    // t0 : 1V GA = 13-0+5-13 = +5 ; t1 : 2V ; t2 : 0V
    const standings = pouleStandings(poule, matches, teams);
    expect(standings[0].teamId).toBe('t1');
    expect(standings[2].teamId).toBe('t2');
  });
});

function mkMatch(a: string, b: string, sa: number, sb: number): Match {
  return {
    id: `${a}-${b}`,
    stage: 'poule',
    teamAId: a,
    teamBId: b,
    scoreA: sa,
    scoreB: sb,
    status: 'termine',
    winnerId: sa > sb ? a : b,
    pouleId: 'P',
  };
}
