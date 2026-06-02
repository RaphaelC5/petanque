// Persistance locale (localStorage) + export / import JSON manuel.

import type { AppState } from '../types';

const STORAGE_KEY = 'scm.tournois.v1';
export const STATE_VERSION = 1;

export const emptyState: AppState = {
  players: [],
  tournaments: [],
  quickMatches: [],
  version: STATE_VERSION,
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw) as AppState;
    return {
      players: parsed.players ?? [],
      tournaments: parsed.tournaments ?? [],
      quickMatches: parsed.quickMatches ?? [],
      version: parsed.version ?? STATE_VERSION,
    };
  } catch (e) {
    console.warn('État illisible, réinitialisation.', e);
    return emptyState;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Sauvegarde impossible (localStorage plein ?)', e);
  }
}

/** Télécharge l'état complet sous forme de fichier JSON. */
export function exportToFile(state: AppState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `copains-marseille-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Lit un fichier JSON et renvoie l'état importé (validation minimale). */
export function importFromFile(file: File): Promise<AppState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppState;
        if (!Array.isArray(parsed.players) || !Array.isArray(parsed.tournaments)) {
          throw new Error('Format invalide');
        }
        resolve({
          players: parsed.players,
          tournaments: parsed.tournaments,
          quickMatches: parsed.quickMatches ?? [],
          version: parsed.version ?? STATE_VERSION,
        });
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
