import { describe, expect, it } from 'vitest';
import { isTireurOnly } from '../easterEggs';

// On construit les variantes accentuees par echappement pour eviter toute
// ambiguite d'encodage du fichier source.
const E_TREMA = 'ë'; // e trema precompose
const PRECOMPOSED = 'rapha' + E_TREMA + 'l'; // "raphael" avec e trema
const DECOMPOSED = 'raphaël'; // e + trema combinant (NFC -> precompose)

describe('isTireurOnly — La Carade imposé tireur', () => {
  it('impose tireur quelle que soit la casse', () => {
    for (const n of ['raf', 'Rafa', 'LACARADE', 'lacarade5', 'Raph', 'raphael', '  Raphael  ']) {
      expect(isTireurOnly(n)).toBe(true);
    }
  });

  it('laisse le choix libre quand le prenom porte un trema', () => {
    expect(isTireurOnly(PRECOMPOSED)).toBe(false);
    expect(isTireurOnly(PRECOMPOSED.toUpperCase())).toBe(false);
    expect(isTireurOnly(DECOMPOSED)).toBe(false);
  });

  it('ignore les prenoms hors liste', () => {
    for (const n of ['marius', 'cam', 'tom', '']) {
      expect(isTireurOnly(n)).toBe(false);
    }
  });
});
