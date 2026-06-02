import { useState } from 'react';
import { Modal } from './common';
import type { Match, Player, Team } from '../types';

function teamLabel(team: Team | undefined, players: Map<string, Player>): string {
  if (!team) return '—';
  const names = team.playerIds.map((id) => players.get(id)?.nom ?? '?').join(', ');
  return `${team.nom} (${names})`;
}

export function ScoreModal({
  match,
  teams,
  players,
  pointsCible,
  onClose,
  onSave,
}: {
  match: Match;
  teams: Team[];
  players: Map<string, Player>;
  pointsCible: number;
  onClose: () => void;
  onSave: (scoreA: number, scoreB: number) => void;
}) {
  const teamA = teams.find((t) => t.id === match.teamAId);
  const teamB = teams.find((t) => t.id === match.teamBId);
  const [a, setA] = useState(match.scoreA ?? 0);
  const [b, setB] = useState(match.scoreB ?? 0);

  const clamp = (n: number) => Math.max(0, Math.min(pointsCible, n));
  const valid = a !== b;

  const Stepper = ({
    value,
    set,
  }: {
    value: number;
    set: (n: number) => void;
  }) => (
    <div className="score-stepper">
      <button className="minus" onClick={() => set(clamp(value - 1))} aria-label="moins">
        −
      </button>
      <button onClick={() => set(clamp(value + 1))} aria-label="plus">
        +
      </button>
    </div>
  );

  return (
    <Modal title="✏️ Saisie du score" onClose={onClose}>
      <p className="muted">Partie en {pointsCible} points. Tu peux clôturer avant {pointsCible} si besoin.</p>
      <div className="score-editor">
        {[{ team: teamA, val: a, set: setA }, { team: teamB, val: b, set: setB }].map(
          (s, idx) => (
            <div className="score-team" key={idx}>
              <div style={{ fontWeight: 700, minHeight: '2.4em' }}>
                {teamLabel(s.team, players)}
              </div>
              <div className="big">{s.val}</div>
              <Stepper value={s.val} set={s.set} />
              <button
                className="btn btn-sm btn-ghost"
                style={{ marginTop: '0.6rem' }}
                onClick={() => s.set(pointsCible)}
              >
                {pointsCible} (gagné)
              </button>
            </div>
          ),
        )}
      </div>

      {!valid && (
        <p className="badge-desequilibre" style={{ textAlign: 'center' }}>
          ⚠️ Un vainqueur est obligatoire (pas d'égalité en pétanque).
        </p>
      )}

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onClose}>
          Annuler
        </button>
        <button className="btn btn-primary" disabled={!valid} onClick={() => onSave(a, b)}>
          Valider le score
        </button>
      </div>
    </Modal>
  );
}
