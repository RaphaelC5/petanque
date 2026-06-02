import { useMemo } from 'react';
import { Modal } from './common';
import { gameDisplay, roleMeta } from '../engine/game';
import { useStore } from '../state/store';
import type { Player, QuickMatch } from '../types';

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Historique des matchs amicaux : aperçu de tous les matchs joués hors
 * tournoi, avec édition et suppression. Comptent dans le classement général.
 */
export function QuickMatchesModal({
  onClose,
  onEdit,
  flash,
}: {
  onClose: () => void;
  onEdit: (m: QuickMatch) => void;
  flash: (m: string) => void;
}) {
  const { state, removeQuickMatch } = useStore();

  const byId = useMemo(
    () => new Map(state.players.map((p) => [p.id, p])),
    [state.players],
  );
  const matches = useMemo(
    () => [...(state.quickMatches ?? [])].sort((a, b) => b.createdAt - a.createdAt),
    [state.quickMatches],
  );

  const names = (ids: string[]) =>
    ids.map((id) => {
      const p: Player | undefined = byId.get(id);
      return p ? `${p.emoji ?? roleMeta(p.role).emoji} ${p.nom}` : '❓ (supprimé)';
    });

  const del = (m: QuickMatch) => {
    if (confirm('Supprimer ce match ? Le classement général sera recalculé.')) {
      removeQuickMatch(m.id);
      flash('Match supprimé 🗑️');
    }
  };

  return (
    <Modal title="📋 Historique des matchs" onClose={onClose} wide>
      {matches.length === 0 ? (
        <div className="empty">
          <span className="emoji">📭</span>
          Aucun match amical enregistré pour l'instant.
        </div>
      ) : (
        <div className="qm-history">
          {matches.map((m) => {
            const aWon = m.scoreA > m.scoreB;
            return (
              <div key={m.id} className="qm-history-row">
                <div className="qm-history-teams">
                  <span className={`qm-history-side ${aWon ? 'win' : ''}`}>
                    {names(m.sideAPlayerIds).join(', ')}
                  </span>
                  <span className="qm-history-score">
                    <b className={aWon ? 'win' : ''}>{m.scoreA}</b>
                    <span className="sep">–</span>
                    <b className={!aWon ? 'win' : ''}>{m.scoreB}</b>
                  </span>
                  <span className={`qm-history-side right ${!aWon ? 'win' : ''}`}>
                    {names(m.sideBPlayerIds).join(', ')}
                  </span>
                </div>
                <div className="qm-history-meta">
                  {(() => {
                    const s = gameDisplay(m.game, m.gameLabel);
                    return `${s.emoji} ${s.nom} · `;
                  })()}
                  {m.label ? `${m.label} · ` : ''}
                  {fmtDate(m.createdAt)}
                </div>
                <div className="qm-history-actions">
                  <button
                    className="btn btn-sm"
                    onClick={() => onEdit(m)}
                    aria-label="Modifier"
                    title="Modifier"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => del(m)}
                    aria-label="Supprimer"
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="row mt" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onClose}>
          Fermer
        </button>
      </div>
    </Modal>
  );
}
