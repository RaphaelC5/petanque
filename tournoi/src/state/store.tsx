// État global de l'application (Context + reducer) avec persistance auto.

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type { AppState, Player, QuickMatch, Tournament } from '../types';
import {
  emptyState,
  exportToFile,
  loadState,
  saveState,
} from '../storage/persistence';
import { fetchRemoteState, pushRemoteState, subscribeRemote } from '../storage/sync';

type Action =
  | { type: 'addPlayer'; player: Player }
  | { type: 'updatePlayer'; player: Player }
  | { type: 'removePlayer'; id: string }
  | { type: 'upsertTournament'; tournament: Tournament }
  | { type: 'removeTournament'; id: string }
  | { type: 'addQuickMatch'; match: QuickMatch }
  | { type: 'removeQuickMatch'; id: string }
  | { type: 'replaceState'; state: AppState };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addPlayer':
      return { ...state, players: [...state.players, action.player] };
    case 'updatePlayer':
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.player.id ? action.player : p,
        ),
      };
    case 'removePlayer':
      return {
        ...state,
        players: state.players.filter((p) => p.id !== action.id),
      };
    case 'upsertTournament': {
      const exists = state.tournaments.some((t) => t.id === action.tournament.id);
      return {
        ...state,
        tournaments: exists
          ? state.tournaments.map((t) =>
              t.id === action.tournament.id ? action.tournament : t,
            )
          : [...state.tournaments, action.tournament],
      };
    }
    case 'removeTournament':
      return {
        ...state,
        tournaments: state.tournaments.filter((t) => t.id !== action.id),
      };
    case 'addQuickMatch':
      return {
        ...state,
        quickMatches: [action.match, ...(state.quickMatches ?? [])],
      };
    case 'removeQuickMatch':
      return {
        ...state,
        quickMatches: (state.quickMatches ?? []).filter((m) => m.id !== action.id),
      };
    case 'replaceState':
      return action.state;
    default:
      return state;
  }
}

interface Ctx {
  state: AppState;
  addPlayer: (p: Player) => void;
  updatePlayer: (p: Player) => void;
  removePlayer: (id: string) => void;
  upsertTournament: (t: Tournament) => void;
  removeTournament: (id: string) => void;
  addQuickMatch: (m: QuickMatch) => void;
  removeQuickMatch: (id: string) => void;
  replaceState: (s: AppState) => void;
  exportData: () => void;
}

const StoreContext = createContext<Ctx | null>(null);

function hasData(s: AppState): boolean {
  return s.players.length > 0 || s.tournaments.length > 0;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, emptyState, loadState);

  // Mode de persistance : 'local' (localStorage seul) ou 'remote' (serveur partagé).
  // 'pending' tant que le bootstrap n'a pas déterminé si un backend existe.
  const mode = useRef<'pending' | 'local' | 'remote'>('pending');
  // Sérialisation du dernier état appliqué depuis le serveur : évite de le
  // renvoyer en boucle (écho) via l'effet de sauvegarde.
  const lastRemote = useRef<string | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bootstrap : tente de joindre le serveur partagé, sinon reste en local.
  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      const remote = await fetchRemoteState();
      if (cancelled) return;

      if (!remote) {
        mode.current = 'local';
        return;
      }
      mode.current = 'remote';

      if (hasData(remote)) {
        // Le serveur fait foi : on adopte son état.
        lastRemote.current = JSON.stringify(remote);
        dispatch({ type: 'replaceState', state: remote });
      } else if (hasData(state)) {
        // Serveur vierge mais on a des données locales → on les y sème.
        void pushRemoteState(state);
      }

      cleanup = subscribeRemote((incoming) => {
        lastRemote.current = JSON.stringify(incoming);
        dispatch({ type: 'replaceState', state: incoming });
      });
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistance à chaque changement d'état.
  useEffect(() => {
    saveState(state); // localStorage : filet de sécurité / cache, dans tous les cas

    if (mode.current !== 'remote') return;
    const serialized = JSON.stringify(state);
    if (serialized === lastRemote.current) return; // changement venu du serveur : ne pas renvoyer

    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      void pushRemoteState(state);
    }, 350);
  }, [state]);

  const value: Ctx = {
    state,
    addPlayer: (player) => dispatch({ type: 'addPlayer', player }),
    updatePlayer: (player) => dispatch({ type: 'updatePlayer', player }),
    removePlayer: (id) => dispatch({ type: 'removePlayer', id }),
    upsertTournament: (tournament) =>
      dispatch({ type: 'upsertTournament', tournament }),
    removeTournament: (id) => dispatch({ type: 'removeTournament', id }),
    addQuickMatch: (match) => dispatch({ type: 'addQuickMatch', match }),
    removeQuickMatch: (id) => dispatch({ type: 'removeQuickMatch', id }),
    replaceState: (s) => dispatch({ type: 'replaceState', state: s }),
    exportData: () => exportToFile(state),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore doit être utilisé dans StoreProvider');
  return ctx;
}
