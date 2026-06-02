import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export function TerrainMapButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="terrain-fab" onClick={() => setOpen(true)}>
        <span className="terrain-fab-icon" aria-hidden>
          🗺️
        </span>
        Recherche d'un terrain
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="terrain-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="terrain-overlay-head">
              <strong>🗺️ Terrains de pétanque</strong>
              <button className="modal-close" onClick={() => setOpen(false)} aria-label="Fermer">
                ✕
              </button>
            </div>
            <iframe
              className="terrain-frame"
              src="/carte/index.html"
              title="Carte des terrains de pétanque"
              allow="geolocation"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
