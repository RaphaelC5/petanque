import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSocial } from './SocialProvider';

export function MiniChat() {
  const { available, messages, sendMessage, pseudo, setPseudo } = useSocial();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const seenRef = useRef(0);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (open) {
      seenRef.current = messages.length;
      setUnread(0);
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    } else {
      setUnread(Math.max(0, messages.length - seenRef.current));
    }
  }, [messages, open]);

  if (!available) return null;

  const send = () => {
    const t = text.trim();
    if (!t) return;
    void sendMessage(t);
    setText('');
  };

  return (
    <>
      <button className="chat-fab" onClick={() => setOpen((o) => !o)} aria-label="Ouvrir le chat">
        💬{unread > 0 && <span className="chat-badge">{unread}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="chat-panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          >
            <div className="chat-head">
              <strong>💬 Le tchat des copains</strong>
              <button className="modal-close" onClick={() => setOpen(false)} aria-label="Fermer">
                ✕
              </button>
            </div>

            <input
              className="chat-pseudo"
              placeholder="Ton pseudo"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
            />

            <div className="chat-messages" ref={listRef}>
              {messages.length === 0 ? (
                <p className="muted" style={{ textAlign: 'center', margin: 'auto' }}>
                  Lance la causette 👋
                </p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="chat-msg">
                    <span className="chat-author">{m.author}</span>
                    <span className="chat-text">{m.text}</span>
                  </div>
                ))
              )}
            </div>

            <div className="chat-input">
              <input
                placeholder="Écris un message…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
              <button className="btn btn-primary btn-sm" onClick={send} disabled={!text.trim()}>
                Envoyer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
