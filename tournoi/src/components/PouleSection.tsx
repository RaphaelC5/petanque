import { pouleStandings } from '../engine/poules';
import { MatchRow } from './MatchRow';
import type { Match, Player, Poule, Tournament } from '../types';

export function PouleSection({
  tournament,
  poule,
  players,
  qualifPerPoule,
  onPick,
}: {
  tournament: Tournament;
  poule: Poule;
  players: Map<string, Player>;
  qualifPerPoule: number;
  onPick: (m: Match) => void;
}) {
  const standings = pouleStandings(poule, tournament.matches, tournament.teams);
  const teams = tournament.teams;
  const pouleMatches = tournament.matches.filter((m) => m.pouleId === poule.id);

  return (
    <div className="card" style={{ marginBottom: '1.2rem' }}>
      <h3>{poule.nom}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th className="name">Équipe</th>
              <th>J</th>
              <th>V</th>
              <th>D</th>
              <th>+/−</th>
              <th>GA</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.teamId} className={i < qualifPerPoule ? 'qualif' : ''}>
                <td>{i + 1}</td>
                <td className="name">
                  {s.nom}
                  {i < qualifPerPoule && tournament.mode === 'poules_finales' && ' ✅'}
                </td>
                <td>{s.matchsJoues}</td>
                <td>
                  <strong>{s.victoires}</strong>
                </td>
                <td>{s.defaites}</td>
                <td>
                  {s.pointsPour}:{s.pointsContre}
                </td>
                <td>{s.goalAverage > 0 ? `+${s.goalAverage}` : s.goalAverage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="muted" style={{ margin: '1rem 0 0.5rem' }}>
        Matchs
      </h4>
      {pouleMatches.map((m) => (
        <MatchRow
          key={m.id}
          match={m}
          teams={teams}
          players={players}
          onClick={() => onPick(m)}
        />
      ))}
    </div>
  );
}
