import { useMemo, useState } from 'react';
import { Modal } from './common';
import { roleMeta } from '../engine/game';
import { uid } from '../engine/util';
import { useStore } from '../state/store';
import type { Player, QuickMatch } from '../types';

/**
 * Création d'un match amical hors tournoi : on choisit les joueurs de chaque
 * camp, on saisit le score, et ça alimente le classement général.
 */
export function QuickMatchModal({
  onClose,
  flash,
}: {
  onClose: () => void;
  flash: (m: string) => void;
}) {
  const { state, addQuickMatch } = useStore();
  const players = state.players;

  const [sideA, setSideA] = useState<Set<string>>(new Set());
  const [sideB, setSideB] = useState<Set<string>>(new Set());
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [label, setLabel] = useState('');

  const sorted = useMemo(
    () => [...players].sort((a, b) => a.nom.localeCompare(b.nom)),
    [players],
  );

  const toggle = (camp: 'A' | 'B', id: string) => {
    const set = camp === 'A' ? new Set(sideA) : new Set(sideB);
    const other = camp === 'A' ? sideB : sideA;
    if (set.has(id)) set.delete(id);
    else {
      if (other.has(id)) return; // déjà dans l'autre camp
      set.add(id);
    }
    if (camp === 'A') setSideA(set);
    else setSideB(set);
  };

  const a = Number(scoreA);
  const b = Number(scoreB);
  const valid =
    sideA.size > 0 &&
    sideB.size > 0 &&
    scoreA !== '' &&
    scoreB !== '' &&
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    a >= 0 &&
    b >= 0 &&
    a !== b;

  const save = () => {
    if (!valid) return;
    const match: QuickMatch = {
      id: uid('qm'),
      sideAPlayerIds: [...sideA],
      sideBPlayerIds: [...sideB],
      scoreA: a,
      scoreB: b,
      createdAt: Date.now(),
      label: label.trim() || undefined,
    };
    addQuickMatch(match);
    flash('Match enregistré ✅ classement mis à jour');
    onClose();
  };

  const Chip = ({ p, camp }: { p: Player; camp: 'A' | 'B' }) => {
    const set = camp === 'A' ? sideA : sideB;
    const other = camp === 'A' ? sideB : sideA;
    const selected = set.has(p.id);
    const disabled = other.has(p.id);
    return (
      <button
        type="button"
        className={`qm-chip ${selected ? 'selected' : ''}`}
        disabled={disabled}
        onClick={() => toggle(camp, p.id)}
      >
        <span>{p.emoji ?? roleMeta(p.role).emoji}</span>
        {p.nom}
      </button>
    );
  };

  return (
    <Modal title="➕ Ajouter un match" onClose={onClose} wide>
      {players.length === 0 ? (
        <div className="empty">
          <span className="emoji">🧑‍🤝‍🧑</span>
          Ajoute d'abord des joueurs (onglet 👥 Joueurs).
        </div>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Choisis les joueurs de chaque camp et le score. Ça compte dans le classement général
            (pas de tournoi créé).
          </p>

          <div className="qm-grid">
            <div className="qm-side">
              <div className="row between">
                <strong>🔵 Camp A</strong>
                <input
                  className="qm-score"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="13"
                  value={scoreA}
                  onChange={(e) => setScoreA(e.target.value)}
                />
              </div>
              <div className="qm-chips">
                {sorted.map((p) => (
                  <Chip key={p.id} p={p} camp="A" />
                ))}
              </div>
            </div>

            <div className="qm-side">
              <div className="row between">
                <strong>🔴 Camp B</strong>
                <input
                  className="qm-score"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="7"
                  value={scoreB}
                  onChange={(e) => setScoreB(e.target.value)}
                />
              </div>
              <div className="qm-chips">
                {sorted.map((p) => (
                  <Chip key={p.id} p={p} camp="B" />
                ))}
              </div>
            </div>
          </div>

          <input
            className="qm-label"
            type="text"
            placeholder="Intitulé (optionnel) — ex. « partie du soir »"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />

          {scoreA !== '' && scoreB !== '' && a === b && (
            <p className="qm-warn">Un match de pétanque ne peut pas être nul.</p>
          )}

          <div className="row mt" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={onClose}>
              Annuler
            </button>
            <button className="btn btn-primary" disabled={!valid} onClick={save}>
              Enregistrer le match
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
