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

export const PETANQUE: GameDefinition = {
  kind: 'petanque',
  nom: 'Pétanque',
  emoji: '🎯',
  pointsCible: 13,
  formats: ['doublette', 'triplette'],
  roles: [
    { value: 'tireur', label: 'Tireur', emoji: '💥', couleur: '#e4572e' },
    { value: 'pointeur', label: 'Pointeur', emoji: '🎯', couleur: '#0a6ca8' },
    { value: 'mixte', label: 'Mixte', emoji: '🤹', couleur: '#f4a259' },
  ],
};

export const GAMES: Record<GameKind, GameDefinition> = {
  petanque: PETANQUE,
};

export function getGame(kind: GameKind): GameDefinition {
  return GAMES[kind];
}

export function roleMeta(role: Role) {
  return PETANQUE.roles.find((r) => r.value === role) ?? PETANQUE.roles[2];
}
