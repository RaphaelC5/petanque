import { useMemo, useState } from 'react';
import { Modal } from './common';
import { gameDisplay, roleMeta } from '../engine/game';
import { useStore } from '../state/store';
import type { Player, QuickMatch } from '../types';

const ADMIN_CODE = '1907';

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Matchs amicaux « en attente » : enregistrés mais pas encore comptés dans le
 * classement général. Un admin saisit le code à 4 chiffres pour tous les valider.
 */
export function PendingMatchesModal({
  onClose,
  onEdit,
  flash,
}: {
  onClose: () => void;
  onEdit: (m: QuickMatch) => void;
  flash: (m: string) => void;
}) {
  const { state, removeQuickMatch, validatePendingQuickMatches } = useStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const byId = useMemo(
    () => new Map(state.players.map((p) => [p.id, p])),
    [state.players],
  );
  const pending = useMemo(
    () =>
      [...(state.quickMatches ?? [])]
        .filter((m) => m.validated === false)
        .sort((a, b) => b.createdAt - a.createdAt),
    [state.quickMatches],
  );

  const names = (ids: string[]) =>
    ids
      .map((id) => {
        const p: Player | undefined = byId.get(id);
        return p ? `${p.emoji ?? roleMeta(p.role).emoji} ${p.nom}` : '❓ (supprimé)';
      })
      .join(', ');

  const del = (m: QuickMatch) => {
    if (confirm('Supprimer ce match en attente ?')) {
      removeQuickMatch(m.id);
      flash('Match supprimé 🗑️');
    }
  };

  const validate = () => {
    if (code.trim() !== ADMIN_CODE) {
      setError(true);
      return;
    }
    const n = pending.length;
    validatePendingQuickMatches();
    flash(`${n} match${n > 1 ? 's' : ''} validé${n > 1 ? 's' : ''} ✅ classement mis à jour`);
    onClose();
  };

  return (
    <Modal title="⏳ Matchs en attente de validation" onClose={onClose} wide>
      {pending.length === 0 ? (
        <div className="empty">
          <span className="emoji">✅</span>
          Aucun match en attente. Tout est validé !
        </div>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Ces matchs ne comptent pas encore dans le classement général. Saisis le
            code admin pour tous les valider.
          </p>

          <div className="qm-history">
            {pending.map((m) => {
              const aWon = m.scoreA > m.scoreB;
              return (
                <div key={m.id} className="qm-history-row">
                  <div className="qm-history-teams">
                    <span className={`qm-history-side ${aWon ? 'win' : ''}`}>
                      {names(m.sideAPlayerIds)}
                    </span>
                    <span className="qm-history-score">
                      <b className={aWon ? 'win' : ''}>{m.scoreA}</b>
                      <span className="sep">–</span>
                      <b className={!aWon ? 'win' : ''}>{m.scoreB}</b>
                    </span>
                    <span className={`qm-history-side right ${!aWon ? 'win' : ''}`}>
                      {names(m.sideBPlayerIds)}
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

          <div className="field mt">
            <label>🔒 Code admin (4 chiffres)</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder="••••"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 4));
                setError(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && validate()}
            />
            {error && (
              <p className="qm-warn" style={{ marginBottom: 0 }}>
                Code incorrect ❌
              </p>
            )}
          </div>

          <div className="row mt" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={onClose}>
              Annuler
            </button>
            <button
              className="btn btn-primary"
              disabled={code.length !== 4}
              onClick={validate}
            >
              ✅ Valider les {pending.length} match{pending.length > 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
