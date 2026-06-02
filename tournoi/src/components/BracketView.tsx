import type { Match, Team } from '../types';

export function BracketView({
  matches,
  teams,
  onPick,
}: {
  matches: Match[];
  teams: Team[];
  onPick: (m: Match) => void;
}) {
  const bracket = matches.filter((m) => m.stage === 'bracket');
  if (bracket.length === 0)
    return (
      <div className="empty">
        <span className="emoji">🌳</span>
        La phase finale apparaîtra une fois les poules terminées.
      </div>
    );

  const rounds = Math.max(...bracket.map((m) => m.round ?? 0)) + 1;
  const teamName = (id: string | null) =>
    id ? teams.find((t) => t.id === id)?.nom ?? '?' : null;

  return (
    <div className="bracket">
      {Array.from({ length: rounds }).map((_, r) => {
        const roundMatches = bracket
          .filter((m) => m.round === r)
          .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
        return (
          <div className="bracket-round" key={r}>
            <h4>{roundMatches[0]?.label ?? `Tour ${r + 1}`}</h4>
            {roundMatches.map((m) => {
              const ready = m.teamAId && m.teamBId && m.status !== 'termine';
              return (
                <div
                  key={m.id}
                  className="bracket-match"
                  onClick={ready ? () => onPick(m) : undefined}
                  style={{ cursor: ready ? 'pointer' : 'default' }}
                  title={ready ? 'Cliquer pour saisir le score' : undefined}
                >
                  <BmTeam
                    name={teamName(m.teamAId)}
                    score={m.scoreA}
                    win={m.status === 'termine' && m.winnerId === m.teamAId}
                  />
                  <BmTeam
                    name={teamName(m.teamBId)}
                    score={m.scoreB}
                    win={m.status === 'termine' && m.winnerId === m.teamBId}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function BmTeam({
  name,
  score,
  win,
}: {
  name: string | null;
  score: number | null;
  win: boolean;
}) {
  return (
    <div className={`bm-team ${win ? 'win' : ''} ${name ? '' : 'bye'}`}>
      <span>{name ?? '—'}</span>
      <span className="bm-score">{score ?? ''}</span>
    </div>
  );
}
