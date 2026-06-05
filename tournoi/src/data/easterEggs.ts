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

// ---------------------------------------------------------------------------
// Avatar « d'office » selon le prénom (la casse et les accents ne comptent pas).
// Dès qu'un de ces noms est tapé, on applique l'emoji correspondant — modifiable
// ensuite via « Modifier l'avatar ».
// ---------------------------------------------------------------------------

const AVATAR_BY_NAME: Record<string, string> = {};
const mapNames = (emoji: string, names: string[]) => {
  for (const n of names) AVATAR_BY_NAME[normName(n)] = emoji;
};

mapNames('🎹', ['piano', 'pians', 'yannick', 'yan']); // piano
mapNames('🎒', ['adri', 'serres', 'serinho', 'serri', 'seri', 'serino']); // cartable
mapNames('🕳️', ['cam', 'camille', 'cam v']); // le trou
mapNames('🏄', ['tim', 'timothée', 'la dimode', 'dimode']); // surfeur
mapNames('🦀', ['tom', 'tomich']); // crabe
mapNames('⛷️', ['dam', 'damyenks', 'damien']); // skieur
mapNames('👨‍❤️‍👨', ['jean', 'dylan brocher', 'jeannot', 'charlie', 'charlot']); // couple gay
mapNames('🫃', ['sauti', 'hugo', 'sautarel']); // homme enceinte
mapNames('🍺', ['thib', 'thibaut', 'thibault']); // bière
mapNames('🧑‍🦲', ['cyril', 'cissou']); // crâne rasé
mapNames('⚽', ['leo', 'leopold', 'bach']); // ballon de foot
mapNames('🤖', ['gab', 'gaby', 'gabs']); // tête de robot
mapNames('🤙', ['pierre', 'pierro', 'la bourgne', 'bourgnou']); // appelle-moi
mapNames('🐑', ['raph', 'rafa', 'raphael', 'rafiki']); // mouton

/** Emoji à appliquer d'office pour ce prénom, ou null si aucun. */
export function avatarForName(nom: string): string | null {
  return AVATAR_BY_NAME[normName(nom)] ?? null;
}
