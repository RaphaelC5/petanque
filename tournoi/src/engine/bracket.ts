// ============================================================================
// Bracket à élimination directe (gestion des byes, avancement automatique)
// ============================================================================

import type { Match } from '../types';
import { nextPowerOfTwo, uid } from './util';

function roundLabel(roundsRemaining: number): string {
  switch (roundsRemaining) {
    case 1:
      return 'Finale';
    case 2:
      return 'Demi-finales';
    case 3:
      return 'Quarts de finale';
    case 4:
      return 'Huitièmes de finale';
    case 5:
      return 'Seizièmes de finale';
    default:
      return `Tour ${roundsRemaining}`;
  }
}

/** Ordre des têtes de série pour un bracket de taille `size` (puissance de 2). */
export function seedOrder(size: number): number[] {
  let seeds = [0];
  while (seeds.length < size) {
    const n = seeds.length * 2;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(n - 1 - s);
    }
    seeds = next;
  }
  return seeds;
}

/**
 * Construit un bracket à élimination directe à partir d'équipes classées
 * (meilleure tête de série en premier). Les byes éventuels sont attribués aux
 * meilleures têtes de série et résolus automatiquement.
 */
export function buildBracket(seededTeamIds: string[]): Match[] {
  const teams = seededTeamIds.slice();
  if (teams.length < 2) return [];

  const size = nextPowerOfTwo(teams.length);
  const totalRounds = Math.log2(size);
  const order = seedOrder(size);

  // Slots du premier tour (null = bye)
  const slots: (string | null)[] = order.map((seed) => teams[seed] ?? null);

  const rounds: Match[][] = [];
  for (let r = 0; r < totalRounds; r++) {
    const count = size / 2 ** (r + 1);
    const roundsRemaining = totalRounds - r;
    const round: Match[] = [];
    for (let s = 0; s < count; s++) {
      round.push({
        id: uid('bm'),
        stage: 'bracket',
        teamAId: null,
        teamBId: null,
        scoreA: null,
        scoreB: null,
        status: 'a_jouer',
        winnerId: null,
        round: r,
        slot: s,
        label: roundLabel(roundsRemaining),
        nextMatchId: null,
        nextSlot: undefined,
      });
    }
    rounds.push(round);
  }

  // Liens vers le tour suivant
  for (let r = 0; r < totalRounds - 1; r++) {
    rounds[r].forEach((m, s) => {
      m.nextMatchId = rounds[r + 1][Math.floor(s / 2)].id;
      m.nextSlot = s % 2 === 0 ? 'A' : 'B';
    });
  }

  // Remplir le premier tour
  rounds[0].forEach((m, s) => {
    m.teamAId = slots[s * 2] ?? null;
    m.teamBId = slots[s * 2 + 1] ?? null;
  });

  const all = rounds.flat();
  resolveByes(all);
  return all;
}

/** Résout les matchs où une seule équipe est présente (bye) en cascade. */
function resolveByes(matches: Match[]): void {
  const byId = new Map(matches.map((m) => [m.id, m]));
  // Traiter dans l'ordre des tours
  const sorted = matches.slice().sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
  for (const m of sorted) {
    if (m.status === 'termine') continue;
    const aEmpty = m.teamAId == null;
    const bEmpty = m.teamBId == null;
    if (aEmpty && bEmpty) continue; // les deux vides, en attente
    if (aEmpty !== bEmpty) {
      // un seul présent → qualification d'office
      const winner = (m.teamAId ?? m.teamBId)!;
      m.winnerId = winner;
      m.status = 'termine';
      propagateWinner(m, winner, byId);
    }
  }
}

function propagateWinner(
  m: Match,
  winnerId: string,
  byId: Map<string, Match>,
): void {
  if (!m.nextMatchId) return;
  const next = byId.get(m.nextMatchId);
  if (!next) return;
  if (m.nextSlot === 'A') next.teamAId = winnerId;
  else next.teamBId = winnerId;
  // Si le match suivant devient un bye, le résoudre aussi
  if (next.status !== 'termine') {
    const aEmpty = next.teamAId == null;
    const bEmpty = next.teamBId == null;
    if (aEmpty !== bEmpty) {
      const w = (next.teamAId ?? next.teamBId)!;
      next.winnerId = w;
      next.status = 'termine';
      propagateWinner(next, w, byId);
    }
  }
}

/**
 * Applique un résultat de match de bracket et propage le vainqueur au tour
 * suivant. Renvoie une nouvelle liste de matchs (immuable).
 */
export function applyBracketResult(
  matches: Match[],
  matchId: string,
  scoreA: number,
  scoreB: number,
): Match[] {
  const copy = matches.map((m) => ({ ...m }));
  const byId = new Map(copy.map((m) => [m.id, m]));
  const m = byId.get(matchId);
  if (!m || m.teamAId == null || m.teamBId == null) return copy;
  m.scoreA = scoreA;
  m.scoreB = scoreB;
  m.status = 'termine';
  m.winnerId = scoreA > scoreB ? m.teamAId : m.teamBId;
  // Nettoyer l'aval avant de propager (au cas où on corrige un score)
  clearDownstream(m, byId);
  propagateWinner(m, m.winnerId, byId);
  return copy;
}

function clearDownstream(m: Match, byId: Map<string, Match>): void {
  let cur = m.nextMatchId ? byId.get(m.nextMatchId) : undefined;
  let slot = m.nextSlot;
  while (cur) {
    if (slot === 'A') cur.teamAId = null;
    else if (slot === 'B') cur.teamBId = null;
    cur.scoreA = null;
    cur.scoreB = null;
    cur.status = 'a_jouer';
    cur.winnerId = null;
    const nextId = cur.nextMatchId;
    slot = cur.nextSlot;
    cur = nextId ? byId.get(nextId) : undefined;
  }
}

/** Champion du bracket s'il existe (dernier match terminé). */
export function bracketChampion(matches: Match[]): string | null {
  const bracket = matches.filter((m) => m.stage === 'bracket');
  if (bracket.length === 0) return null;
  const maxRound = Math.max(...bracket.map((m) => m.round ?? 0));
  const final = bracket.find((m) => m.round === maxRound);
  return final?.status === 'termine' ? final.winnerId : null;
}
