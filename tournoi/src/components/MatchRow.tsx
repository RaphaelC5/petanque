import type { Match, Player, Team } from '../types';

export function MatchRow({
  match,
  teams,
  players,
  onClick,
}: {
  match: Match;
  teams: Team[];
  players: Map<string, Player>;
  onClick?: () => void;
}) {
  const teamA = teams.find((t) => t.id === match.teamAId);
  const teamB = teams.find((t) => t.id === match.teamBId);
  const done = match.status === 'termine';
  const aWon = done && match.winnerId === match.teamAId;
  const bWon = done && match.winnerId === match.teamBId;
  const names = (t?: Team) =>
    t ? t.playerIds.map((id) => players.get(id)?.nom ?? '?').join(' · ') : '';
  const clickable = !!onClick && teamA && teamB;

  return (
    <div
      className="match"
      onClick={clickable ? onClick : undefined}
      style={{ cursor: clickable ? 'pointer' : 'default', opacity: teamA && teamB ? 1 : 0.6 }}
    >
      <div className={`side ${aWon ? 'winner' : ''}`}>
        <span className="tname">{teamA?.nom ?? 'En attente'}</span>
        <span className="players">{names(teamA)}</span>
      </div>
      <div className="center">
        {done ? (
          <div className="score">
            {match.scoreA} – {match.scoreB}
          </div>
        ) : (
          <div className="vs">VS</div>
        )}
        <div className="status-dot">
          {done ? '✅ terminé' : clickable ? '▶︎ saisir' : '⏳'}
        </div>
      </div>
      <div className={`side right ${bWon ? 'winner' : ''}`}>
        <span className="tname">{teamB?.nom ?? 'En attente'}</span>
        <span className="players">{names(teamB)}</span>
      </div>
    </div>
  );
}
