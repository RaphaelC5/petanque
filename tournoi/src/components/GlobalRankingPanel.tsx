import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { computeGlobalRanking } from '../engine/ranking';
import { roleMeta } from '../engine/game';
import { useStore } from '../state/store';
import { QuickMatchModal } from './QuickMatchModal';
import { QuickMatchesModal } from './QuickMatchesModal';
import type { QuickMatch } from '../types';

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Classement général permanent (rail de gauche). Cumule tous les tournois +
 * matchs amicaux. Repliable, et masqué par défaut sur petit écran.
 */
export function GlobalRankingPanel({
  open,
  setOpen,
  flash,
}: {
  open: boolean;
  setOpen: (o: boolean) => void;
  flash: (m: string) => void;
}) {
  const { state } = useStore();
  const [adding, setAdding] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editing, setEditing] = useState<QuickMatch | null>(null);

  const rows = computeGlobalRanking(state);
  const nbMatches = state.quickMatches?.length ?? 0;

  return (
    <>
      {!open && (
        <button
          className="global-ranking-tab"
          onClick={() => setOpen(true)}
          aria-label="Afficher le classement général"
        >
          🏅<span>Classement</span>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.aside
            className="global-ranking card"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            <div className="row between">
              <h3 style={{ margin: 0 }}>🏅 Classement général</h3>
              <button
                className="modal-close"
                onClick={() => setOpen(false)}
                aria-label="Replier le classement"
              >
                ✕
              </button>
            </div>
            <p className="muted" style={{ fontSize: '0.72rem', margin: '0.2rem 0 0.6rem' }}>
              Tous tournois + matchs amicaux · +3 pts / victoire
            </p>

            <button
              className="btn btn-sun btn-sm global-ranking-add"
              onClick={() => setAdding(true)}
            >
              ➕ Ajouter un match
            </button>
            {nbMatches > 0 && (
              <button
                className="btn btn-ghost btn-sm global-ranking-add"
                onClick={() => setHistoryOpen(true)}
              >
                📋 Matchs joués ({nbMatches})
              </button>
            )}

            <div className="global-ranking-list">
              {rows.length === 0 ? (
                <p className="muted">Aucun match joué pour l'instant.</p>
              ) : (
                rows.map((r, i) => (
                  <motion.div
                    layout
                    key={r.playerId}
                    className={`rank-row ${i === 0 ? 'podium-1' : ''}`}
                  >
                    <span className="pos">{MEDALS[i] ?? i + 1}</span>
                    <div>
                      <div className="name">
                        {roleMeta(r.role).emoji} {r.nom}
                      </div>
                      <div className="meta">
                        {r.victoires}V · {r.defaites}D · {r.matchsJoues} match
                        {r.matchsJoues > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="pts">{r.points}</div>
                      <div className="ga">pts</div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {historyOpen && (
          <QuickMatchesModal
            onClose={() => setHistoryOpen(false)}
            onEdit={(m) => {
              setHistoryOpen(false);
              setEditing(m);
            }}
            flash={flash}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adding && <QuickMatchModal onClose={() => setAdding(false)} flash={flash} />}
        {editing && (
          <QuickMatchModal
            existing={editing}
            onClose={() => setEditing(null)}
            flash={flash}
          />
        )}
      </AnimatePresence>
    </>
  );
}
