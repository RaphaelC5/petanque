// Fonctions « sociales » partagées (photos de chambrage + mini chat).
// Disponibles uniquement quand le serveur partagé est joignable ; sinon le
// contexte renvoie available=false et l'UI correspondante reste masquée.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface Photo {
  id: string;
  author: string;
  caption: string;
  createdAt: number;
  expiresAt: number;
  url: string;
}

export interface ChatMessage {
  id: string;
  author: string;
  text: string;
  createdAt: number;
}

interface SocialCtx {
  available: boolean;
  pseudo: string;
  setPseudo: (p: string) => void;
  photos: Photo[];
  messages: ChatMessage[];
  addPhoto: (dataUrl: string, caption: string) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
}

const Ctx = createContext<SocialCtx | null>(null);

const PSEUDO_KEY = 'scm.pseudo';

export function SocialProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pseudo, setPseudoState] = useState(
    () => localStorage.getItem(PSEUDO_KEY) ?? '',
  );
  const pseudoRef = useRef(pseudo);
  pseudoRef.current = pseudo;

  const setPseudo = (p: string) => {
    setPseudoState(p);
    localStorage.setItem(PSEUDO_KEY, p);
  };

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;

    (async () => {
      try {
        const r = await fetch('/api/photos', { cache: 'no-store' });
        if (!r.ok) throw new Error();
        if (cancelled) return;
        setPhotos(await r.json());
        setAvailable(true);
      } catch {
        return; // pas de serveur : social désactivé
      }

      es = new EventSource('/api/stream');
      es.addEventListener('photos', (e) => {
        try {
          setPhotos(JSON.parse((e as MessageEvent).data));
        } catch {
          /* ignore */
        }
      });
      es.addEventListener('chat', (e) => {
        try {
          setMessages(JSON.parse((e as MessageEvent).data));
        } catch {
          /* ignore */
        }
      });
    })();

    return () => {
      cancelled = true;
      es?.close();
    };
  }, []);

  const addPhoto = useCallback(async (dataUrl: string, caption: string) => {
    await fetch('/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: pseudoRef.current || 'Anonyme', caption, dataUrl }),
    });
  }, []);

  const deletePhoto = useCallback(async (id: string) => {
    await fetch(`/api/photos/${id}`, { method: 'DELETE' });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: pseudoRef.current || 'Anonyme', text }),
    });
  }, []);

  return (
    <Ctx.Provider
      value={{ available, pseudo, setPseudo, photos, messages, addPhoto, deletePhoto, sendMessage }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSocial(): SocialCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSocial doit être utilisé dans SocialProvider');
  return ctx;
}
