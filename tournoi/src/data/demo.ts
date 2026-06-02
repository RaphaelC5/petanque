import type { Player, Role } from '../types';
import { uid } from '../engine/util';

const NOMS: [string, Role, string][] = [
  ['Marius', 'tireur', '🤠'],
  ['Fanny', 'pointeur', '👩'],
  ['Gégé', 'tireur', '🧔'],
  ['Lulu', 'pointeur', '👱'],
  ['Titi', 'mixte', '🧑'],
  ['Nono', 'tireur', '👨‍🦰'],
  ['Mireille', 'pointeur', '👵'],
  ['Dédé', 'mixte', '👴'],
  ['Josette', 'pointeur', '🙋'],
  ['Riton', 'tireur', '🧓'],
  ['Sosso', 'mixte', '🧑‍🦱'],
  ['Pascal', 'pointeur', '👲'],
];

export function demoPlayers(): Player[] {
  return NOMS.map(([nom, role, emoji]) => ({ id: uid('p'), nom, role, emoji }));
}
