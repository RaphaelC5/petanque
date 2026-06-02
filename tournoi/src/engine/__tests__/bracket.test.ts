import { describe, expect, it } from 'vitest';
import {
  applyBracketResult,
  bracketChampion,
  buildBracket,
  seedOrder,
} from '../bracket';

describe('seedOrder', () => {
  it('place les têtes de série aux extrémités', () => {
    expect(seedOrder(2)).toEqual([0, 1]);
    expect(seedOrder(4)).toEqual([0, 3, 1, 2]);
    expect(seedOrder(8)).toEqual([0, 7, 3, 4, 1, 6, 2, 5]);
  });
});

describe('buildBracket — puissance de 2', () => {
  it('4 équipes → 3 matchs (2 demies + 1 finale)', () => {
    const m = buildBracket(['a', 'b', 'c', 'd']);
    expect(m).toHaveLength(3);
    const r0 = m.filter((x) => x.round === 0);
    expect(r0).toHaveLength(2);
    expect(r0.every((x) => x.teamAId && x.teamBId)).toBe(true);
  });
});

describe('buildBracket — byes', () => {
  it('3 équipes → la tête de série est qualifiée d’office', () => {
    const m = buildBracket(['a', 'b', 'c']);
    // taille 4, un bye pour la meilleure tête de série (a)
    const final = m.find((x) => x.round === 1)!;
    // a doit déjà être placé en finale via le bye
    expect([final.teamAId, final.teamBId]).toContain('a');
  });

  it('5 équipes → 3 byes résolus, bracket de 8', () => {
    const m = buildBracket(['a', 'b', 'c', 'd', 'e']);
    expect(m).toHaveLength(7); // 4+2+1
    // les 3 meilleures têtes de série passent le 1er tour
    const r1 = m.filter((x) => x.round === 1);
    const placed = r1.flatMap((x) => [x.teamAId, x.teamBId]).filter(Boolean);
    expect(placed).toContain('a');
    expect(placed).toContain('b');
    expect(placed).toContain('c');
  });
});

describe('applyBracketResult — avancement', () => {
  it('propage le vainqueur au tour suivant et désigne le champion', () => {
    let m = buildBracket(['a', 'b', 'c', 'd']);
    const demies = m.filter((x) => x.round === 0);
    m = applyBracketResult(m, demies[0].id, 13, 7); // gagnant = teamA de la demie 0
    m = applyBracketResult(m, demies[1].id, 5, 13); // gagnant = teamB de la demie 1
    const final = m.find((x) => x.round === 1)!;
    expect(final.teamAId).toBeTruthy();
    expect(final.teamBId).toBeTruthy();
    m = applyBracketResult(m, final.id, 13, 11);
    expect(bracketChampion(m)).toBe(final.teamAId);
  });

  it('corriger un score amont réinitialise l’aval', () => {
    let m = buildBracket(['a', 'b', 'c', 'd']);
    const demies = m.filter((x) => x.round === 0);
    m = applyBracketResult(m, demies[0].id, 13, 7);
    m = applyBracketResult(m, demies[1].id, 13, 7);
    let final = m.find((x) => x.round === 1)!;
    m = applyBracketResult(m, final.id, 13, 0);
    expect(bracketChampion(m)).toBeTruthy();
    // on corrige la demie 0 → la finale doit être réinitialisée
    m = applyBracketResult(m, demies[0].id, 7, 13);
    final = m.find((x) => x.round === 1)!;
    expect(final.status).toBe('a_jouer');
    expect(bracketChampion(m)).toBeNull();
  });
});
