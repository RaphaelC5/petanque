import { Modal } from './common';
import { EMOJI_CATEGORIES } from '../data/emojis';

/**
 * Bibliothèque complète d'avatars : tous les emojis classés par thème.
 * Ouverte depuis « Modifier l'avatar ». Clic sur un emoji → sélection.
 */
export function EmojiPicker({
  current,
  onPick,
  onClose,
}: {
  current?: string;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="🙂 Choisir un avatar" onClose={onClose} wide>
      <div className="emoji-picker">
        {EMOJI_CATEGORIES.map((cat) => (
          <section key={cat.label} className="emoji-cat">
            <h4 className="emoji-cat-title">{cat.label}</h4>
            <div className="emoji-grid">
              {cat.emojis.map((e, i) => (
                <button
                  key={`${e}-${i}`}
                  type="button"
                  className={`emoji-btn ${current === e ? 'selected' : ''}`}
                  onClick={() => {
                    onPick(e);
                    onClose();
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
