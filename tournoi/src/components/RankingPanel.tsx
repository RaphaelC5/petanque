import { useState } from 'react';
import { motion } from 'framer-motion';
import { computePlayerRanking } from '../engine/ranking';
import { roleMeta } from '../engine/game';
import type { Player, Tournament } from '../types';

const MEDALS = ['🥇', '🥈', '🥉'];

export function RankingPanel({
  tournament,
  players,
}: {
  tournament: Tournament;
  players: Player[];
}) {
  const [open, setOpen] = useState(true);
  const rows = computePlayerRanking(tournament, players);
  const showRoles = tournament.game === 'petanque';

  return (
    <div className="card ranking-panel ranking-collapsible" data-open={open}>
      <div className="row between" onClick={() => setOpen((o) => !o)} style={{ cursor: 'pointer' }}>
        <h3 style={{ margin: 0 }}>📊 Classement joueurs</h3>
        <span className="muted">{open ? '▾' : '▸'}</span>
      </div>
      <p className="muted ranking-body" style={{ fontSize: '0.72rem', margin: '0.3rem 0' }}>
        +3 pts / victoire · départage au goal average
      </p>
      <div className="ranking-body">
        {rows.length === 0 ? (
          <p className="muted">Aucun match joué.</p>
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
                  {showRoles ? `${roleMeta(r.role).emoji} ` : ''}
                  {r.nom}
                </div>
                <div className="meta">
                  {r.victoires}V · {r.defaites}D · GA{' '}
                  {r.goalAverage > 0 ? `+${r.goalAverage}` : r.goalAverage}
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
    </div>
  );
}
