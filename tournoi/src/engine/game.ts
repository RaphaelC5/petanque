// ============================================================================
// Abstraction « Jeu / Épreuve » — point d'extension pour les olympiades.
// ============================================================================
//
// Aujourd'hui seule la pétanque est implémentée. Pour ajouter une épreuve
// (ex. molkky, ping-pong, fléchettes), il suffit de déclarer une nouvelle
// `GameDefinition` et de l'enregistrer dans `GAMES`. Le moteur de tournoi
// (poules, bracket, classement) est générique et ne dépend pas de ces détails.
// ============================================================================

import type { GameKind, Role, TeamFormat } from '../types';

export interface GameDefinition {
  kind: GameKind;
  nom: string;
  emoji: string;
  /** Score pour gagner une partie. */
  pointsCible: number;
  /** Tailles d'équipe autorisées. */
  formats: TeamFormat[];
  /** Rôles de joueur propres au jeu (sert à l'équilibrage). */
  roles: { value: Role; label: string; emoji: string; couleur: string }[];
}

// Rôles pétanque, réutilisés par tous les sports (attribut global du joueur).
const ROLES: GameDefinition['roles'] = [
  { value: 'tireur', label: 'Tireur', emoji: '💥', couleur: '#e4572e' },
  { value: 'pointeur', label: 'Pointeur', emoji: '🎯', couleur: '#0a6ca8' },
  { value: 'mixte', label: 'Mixte', emoji: '🤹', couleur: '#f4a259' },
];

export const PETANQUE: GameDefinition = {
  kind: 'petanque',
  nom: 'Pétanque',
  emoji: '🎯',
  pointsCible: 13,
  formats: ['doublette', 'triplette'],
  roles: ROLES,
};

export const GAMES: Record<GameKind, GameDefinition> = {
  petanque: PETANQUE,
  tennis_ballon: {
    kind: 'tennis_ballon',
    nom: 'Tennis ballon',
    emoji: '⚽',
    pointsCible: 11,
    formats: ['doublette', 'triplette'],
    roles: ROLES,
  },
  volley_piscine: {
    kind: 'volley_piscine',
    nom: 'Volley piscine',
    emoji: '🏐',
    pointsCible: 15,
    formats: ['doublette', 'triplette'],
    roles: ROLES,
  },
  coinche: {
    kind: 'coinche',
    nom: 'Coinche',
    emoji: '🃏',
    pointsCible: 1000,
    formats: ['doublette'],
    roles: ROLES,
  },
  custom: {
    kind: 'custom',
    nom: 'Sport perso',
    emoji: '🏅',
    pointsCible: 13,
    formats: ['doublette', 'triplette'],
    roles: ROLES,
  },
};

/** Sports proposés à la création (ordre d'affichage, pétanque recommandé). */
export const SELECTABLE_GAMES: { kind: GameKind; recommended?: boolean }[] = [
  { kind: 'petanque', recommended: true },
  { kind: 'tennis_ballon' },
  { kind: 'volley_piscine' },
  { kind: 'coinche' },
  { kind: 'custom' },
];

export function getGame(kind: GameKind): GameDefinition {
  return GAMES[kind] ?? PETANQUE;
}

/** Emoji + nom d'affichage d'un sport (gère le mode custom et les anciens états). */
export function gameDisplay(
  kind: GameKind | undefined,
  label?: string,
): { emoji: string; nom: string } {
  const def = getGame(kind ?? 'petanque');
  if (def.kind === 'custom') {
    return { emoji: def.emoji, nom: label?.trim() || def.nom };
  }
  return { emoji: def.emoji, nom: def.nom };
}

export function roleMeta(role: Role) {
  return PETANQUE.roles.find((r) => r.value === role) ?? PETANQUE.roles[2];
}
