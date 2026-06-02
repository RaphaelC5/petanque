// ============================================================================
// Constitution & équilibrage des équipes (fonctions pures, testables)
// ============================================================================

import type { Player, Role, Team, TeamFormat } from '../types';
import { shuffle, uid, type Rng, defaultRng } from './util';

const NOMS_EQUIPES = [
  'Les Sangliers', 'Les Cigales', 'Les Calanques', 'Les Goudes',
  'Les Minots', 'Les Pastaga', 'Les Fadas', 'Les Galéjeurs',
  'Les Estaque', 'Les Panisses', 'Les Oursins', 'Les Mistralous',
  'Les Bouillabaisse', 'Les Navette', 'Les Aïoli', 'Les Tarpin',
];

/**
 * Détermine la taille de chaque équipe à partir du nombre de joueurs et du
 * format souhaité. Ne produit QUE des équipes de 2 ou 3 (règle pétanque).
 *
 * - doublette : un maximum de doublettes ; si le compte est impair, la dernière
 *   équipe passe en triplette.
 * - triplette : un maximum de triplettes ; le reste est absorbé par des
 *   doublettes (reste 1 → deux doublettes ; reste 2 → une doublette).
 */
export function computeTeamSizes(nbPlayers: number, format: TeamFormat): number[] {
  if (nbPlayers <= 0) return [];
  if (nbPlayers < 2) return [nbPlayers]; // cas dégénéré : 1 joueur

  if (format === 'doublette') {
    if (nbPlayers % 2 === 0) return Array(nbPlayers / 2).fill(2);
    // impair → (k-1) doublettes + une triplette
    const k = (nbPlayers - 3) / 2;
    return [...Array(k).fill(2), 3];
  }

  // triplette
  const rem = nbPlayers % 3;
  const k = Math.floor(nbPlayers / 3);
  if (rem === 0) return Array(k).fill(3);
  if (rem === 2) return [...Array(k).fill(3), 2];
  // rem === 1 → (k-1) triplettes + deux doublettes
  if (k >= 1) return [...Array(k - 1).fill(3), 2, 2];
  return [nbPlayers]; // nbPlayers === 1, déjà géré, sécurité
}

interface BuildOptions {
  random?: boolean; // mélange aléatoire (tirage)
  rng?: Rng;
}

/** Une équipe est déséquilibrée si elle concentre 2+ tireurs ou 2+ pointeurs. */
export function isUnbalanced(roles: Role[]): boolean {
  const t = roles.filter((r) => r === 'tireur').length;
  const p = roles.filter((r) => r === 'pointeur').length;
  return t >= 2 || p >= 2;
}

/**
 * Constitue des équipes équilibrées.
 *
 * Stratégie : on distribue d'abord un tireur puis un pointeur à chaque équipe,
 * ensuite on complète avec les mixtes, puis les surplus en évitant de doubler
 * un rôle déjà présent. En mode aléatoire, chaque groupe de rôle est mélangé
 * au préalable — le résultat reste équilibré mais varie d'un tirage à l'autre.
 */
export function buildTeams(
  players: Player[],
  format: TeamFormat,
  opts: BuildOptions = {},
): Team[] {
  const rng = opts.rng ?? defaultRng;
  const sizes = computeTeamSizes(players.length, format);
  if (sizes.length === 0) return [];

  const order = (g: Player[]) => (opts.random ? shuffle(g, rng) : g.slice());
  const tireurs = order(players.filter((p) => p.role === 'tireur'));
  const pointeurs = order(players.filter((p) => p.role === 'pointeur'));
  const mixtes = order(players.filter((p) => p.role === 'mixte'));

  const buckets: Player[][] = sizes.map(() => []);

  // 1) un tireur par équipe
  for (let i = 0; i < buckets.length && tireurs.length; i++) {
    if (buckets[i].length < sizes[i]) buckets[i].push(tireurs.shift()!);
  }
  // 2) un pointeur par équipe
  for (let i = 0; i < buckets.length && pointeurs.length; i++) {
    if (buckets[i].length < sizes[i]) buckets[i].push(pointeurs.shift()!);
  }

  // 3) compléter : on place chaque joueur restant là où il déséquilibre le moins.
  const restants = [...mixtes, ...tireurs, ...pointeurs];
  for (const player of restants) {
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].length >= sizes[i]) continue;
      const score = placementCost(buckets[i], player.role) + buckets[i].length * 0.01;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best === -1) {
      // toutes pleines (ne devrait pas arriver) → on force la première dispo
      best = buckets.findIndex((b, i) => b.length < sizes[i]);
      if (best === -1) best = 0;
    }
    buckets[best].push(player);
  }

  const nomsMelanges = opts.random ? shuffle(NOMS_EQUIPES, rng) : NOMS_EQUIPES;
  return buckets.map((bucket, i) => ({
    id: uid('team'),
    nom: nomsMelanges[i % nomsMelanges.length] ?? `Équipe ${i + 1}`,
    playerIds: bucket.map((p) => p.id),
    desequilibree: isUnbalanced(bucket.map((p) => p.role)),
  }));
}

/** Coût d'ajouter un rôle donné à une équipe (plus c'est haut, pire c'est). */
function placementCost(bucket: Player[], role: Role): number {
  if (role === 'mixte') return 0; // toujours bienvenu
  const sameRole = bucket.filter((p) => p.role === role).length;
  return sameRole * 10; // pénalise fortement le doublon de rôle
}

/** Recompose les équipes en gardant les joueurs assignés manuellement. */
export function teamFromPlayers(nom: string, players: Player[]): Team {
  return {
    id: uid('team'),
    nom,
    playerIds: players.map((p) => p.id),
    desequilibree: isUnbalanced(players.map((p) => p.role)),
  };
}
