import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSocial } from './SocialProvider';
import { fileToResizedDataUrl } from './image';

function timeLeft(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'expirée';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h >= 1 ? `${h}h` : `${m} min`;
}

export function ChambrageFeed({ flash }: { flash: (m: string) => void }) {
  const { available, photos, addPhoto, deletePhoto } = useSocial();
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!available) return null;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      await addPhoto(dataUrl, '');
      flash('Photo balancée 📸');
    } catch {
      flash('Impossible de charger cette image ❌');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card chambrage chambrage-discret">
      <div className="row between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <p className="muted" style={{ margin: 0, flex: 1, minWidth: '220px' }}>
          📸 Si tu vois Cam faire un traouc (normalement ça devrait pas tarder) ou un sac à dos en
          tout genre tu peux le tailleh ici stuv.
        </p>
        <button className="btn btn-sm" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? '⏳ Envoi…' : '📷 Ajouter une photo'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {photos.length === 0 ? null : (
        <div className="chambrage-grid mt">
          <AnimatePresence>
            {photos.map((p) => (
              <motion.figure
                key={p.id}
                className="chambrage-item"
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
              >
                <img src={p.url} alt={p.caption || 'photo'} loading="lazy" />
                <button
                  className="chambrage-del"
                  title="Supprimer"
                  onClick={() => deletePhoto(p.id)}
                >
                  ✕
                </button>
                <figcaption>
                  <span className="chambrage-meta">⏳ {timeLeft(p.expiresAt)}</span>
                </figcaption>
              </motion.figure>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
