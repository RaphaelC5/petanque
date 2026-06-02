import { describe, expect, it } from 'vitest';
import { buildTeams, computeTeamSizes, isUnbalanced } from '../teams';
import { seededRng } from '../util';
import type { Player, Role } from '../../types';

function mkPlayers(roles: Role[]): Player[] {
  return roles.map((role, i) => ({ id: `p${i}`, nom: `J${i}`, role }));
}

describe('computeTeamSizes — doublettes', () => {
  it('compte pair → que des doublettes', () => {
    expect(computeTeamSizes(8, 'doublette')).toEqual([2, 2, 2, 2]);
  });
  it('compte impair → dernière équipe en triplette', () => {
    expect(computeTeamSizes(9, 'doublette')).toEqual([2, 2, 2, 3]);
    expect(computeTeamSizes(5, 'doublette')).toEqual([2, 3]);
  });
  it('seulement des 2 et des 3', () => {
    for (let n = 2; n <= 30; n++) {
      const sizes = computeTeamSizes(n, 'doublette');
      expect(sizes.every((s) => s === 2 || s === 3)).toBe(true);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);
    }
  });
});

describe('computeTeamSizes — triplettes', () => {
  it('multiple de 3 → que des triplettes', () => {
    expect(computeTeamSizes(9, 'triplette')).toEqual([3, 3, 3]);
  });
  it('reste 2 → une doublette', () => {
    expect(computeTeamSizes(8, 'triplette')).toEqual([3, 3, 2]);
  });
  it('reste 1 → deux doublettes', () => {
    expect(computeTeamSizes(7, 'triplette')).toEqual([3, 2, 2]);
    expect(computeTeamSizes(4, 'triplette')).toEqual([2, 2]);
  });
  it('seulement des 2 et des 3 et somme correcte', () => {
    for (let n = 2; n <= 30; n++) {
      const sizes = computeTeamSizes(n, 'triplette');
      expect(sizes.every((s) => s === 2 || s === 3)).toBe(true);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);
    }
  });
});

describe('isUnbalanced', () => {
  it('détecte 2 tireurs', () => {
    expect(isUnbalanced(['tireur', 'tireur'])).toBe(true);
  });
  it('tireur + pointeur est équilibré', () => {
    expect(isUnbalanced(['tireur', 'pointeur'])).toBe(false);
  });
  it('tireur + mixte est équilibré', () => {
    expect(isUnbalanced(['tireur', 'mixte'])).toBe(false);
  });
});

describe('buildTeams — équilibrage', () => {
  it('place tous les joueurs, tailles correctes', () => {
    const players = mkPlayers(['tireur', 'pointeur', 'tireur', 'pointeur']);
    const teams = buildTeams(players, 'doublette', { rng: seededRng(1) });
    expect(teams).toHaveLength(2);
    const allIds = teams.flatMap((t) => t.playerIds);
    expect(allIds.sort()).toEqual(['p0', 'p1', 'p2', 'p3']);
  });

  it('évite deux tireurs ensemble quand possible', () => {
    const players = mkPlayers(['tireur', 'tireur', 'pointeur', 'pointeur']);
    const teams = buildTeams(players, 'doublette', { rng: seededRng(42) });
    for (const t of teams) expect(t.desequilibree).toBe(false);
  });

  it('signale le déséquilibre quand inévitable (3 tireurs, 1 pointeur)', () => {
    const players = mkPlayers(['tireur', 'tireur', 'tireur', 'pointeur']);
    const teams = buildTeams(players, 'doublette', { rng: seededRng(7) });
    expect(teams.some((t) => t.desequilibree)).toBe(true);
  });

  it('gère le nombre impair (5 joueurs en doublettes → 2 + 3)', () => {
    const players = mkPlayers(['tireur', 'pointeur', 'tireur', 'pointeur', 'mixte']);
    const teams = buildTeams(players, 'doublette', { rng: seededRng(3) });
    const tailles = teams.map((t) => t.playerIds.length).sort();
    expect(tailles).toEqual([2, 3]);
  });
});
