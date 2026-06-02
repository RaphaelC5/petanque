// Petits clins d'œil entre copains, déclenchés par le prénom d'un joueur.
// Tout passe par une normalisation (minuscules, sans accents) pour matcher
// les variantes d'écriture.

export function normName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Cam / Camille : se fait chambrer s'il prétend être tireur. */
export function isCam(nom: string): boolean {
  return ['cam', 'camille'].includes(normName(nom));
}

/** Leo / Thib & co : pas de rôle assumé, ce sera « comme il peut » (= mixte). */
export function isCommeIlPeut(nom: string): boolean {
  return ['leo', 'leopold', 'thibault', 'thib', 'tib'].includes(normName(nom));
}

/** Dam / Damien / Damyenks : tomber dans son équipe, c'est dommage. */
export function isDam(nom: string): boolean {
  return ['dam', 'damien', 'damyenks'].includes(normName(nom));
}
