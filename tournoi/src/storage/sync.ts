// Synchronisation avec le serveur partagé (mode « temps réel »).
// Si aucun backend n'est joignable (ex. `npm run dev` seul), on retombe
// silencieusement sur le localStorage : l'app reste utilisable hors-ligne.

import type { AppState } from '../types';
import { STATE_VERSION } from './persistence';

// Identifiant aléatoire de cet onglet, pour ignorer l'écho de nos propres écritures.
export const clientId = Math.random().toString(36).slice(2);

function normalize(raw: unknown): AppState {
  const s = (raw ?? {}) as Partial<AppState>;
  return {
    players: Array.isArray(s.players) ? s.players : [],
    tournaments: Array.isArray(s.tournaments) ? s.tournaments : [],
    quickMatches: Array.isArray(s.quickMatches) ? s.quickMatches : [],
    version: s.version ?? STATE_VERSION,
  };
}

/** Récupère l'état du serveur, ou `null` si aucun backend n'est joignable. */
export async function fetchRemoteState(): Promise<AppState | null> {
  try {
    const res = await fetch('/api/state', { cache: 'no-store' });
    if (!res.ok) return null;
    return normalize(await res.json());
  } catch {
    return null;
  }
}

/** Pousse l'état complet vers le serveur (best-effort). */
export async function pushRemoteState(state: AppState): Promise<void> {
  try {
    await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin: clientId, state }),
    });
  } catch {
    // hors-ligne : on garde le localStorage comme filet de sécurité
  }
}

/** S'abonne aux mises à jour temps réel. Renvoie une fonction de désabonnement. */
export function subscribeRemote(onState: (s: AppState) => void): () => void {
  let es: EventSource | null = null;
  try {
    es = new EventSource('/api/stream');
    es.addEventListener('state', (e) => {
      try {
        const msg = JSON.parse((e as MessageEvent).data) as {
          origin: string | null;
          state: unknown;
        };
        if (msg.origin && msg.origin === clientId) return; // notre propre écho
        onState(normalize(msg.state));
      } catch {
        /* message malformé ignoré */
      }
    });
  } catch {
    return () => {};
  }
  return () => es?.close();
}
