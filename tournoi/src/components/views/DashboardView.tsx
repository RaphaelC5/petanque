import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useStore } from '../../state/store';
import { closeMatch, tournamentWinner } from '../../engine/tournament';
import { RankingPanel } from '../RankingPanel';
import { PouleSection } from '../PouleSection';
import { BracketView } from '../BracketView';
import { MatchRow } from '../MatchRow';
import { ScoreModal } from '../ScoreModal';
import { Confetti } from '../common';
import type { View } from '../../App';
import type { Match, Tournament } from '../../types';

type Tab = 'poules' | 'bracket' | 'matchs';

export function DashboardView({
  tournament,
  setView,
  flash,
}: {
  tournament: Tournament;
  setView: (v: View) => void;
  flash: (m: string) => void;
}) {
  const { state, upsertTournament } = useStore();
  const players = useMemo(() => new Map(state.players.map((p) => [p.id, p])), [state.players]);
  const [editing, setEditing] = useState<Match | null>(null);

  const hasPoules = tournament.poules.length > 0;
  const hasBracket = tournament.matches.some((m) => m.stage === 'bracket');
  const showBracketTab = tournament.mode === 'poules_finales' || tournament.mode === 'elimination';

  const defaultTab: Tab = hasPoules ? 'poules' : 'bracket';
  const [tab, setTab] = useState<Tab>(defaultTab);

  const winnerId = tournamentWinner(tournament);
  const winnerTeam = tournament.teams.find((t) => t.id === winnerId);

  const save = (scoreA: number, scoreB: number) => {
    if (!editing) return;
    try {
      const updated = closeMatch(tournament, editing.id, scoreA, scoreB);
      upsertTournament(updated);
      if (tournamentWinner(updated)) flash('🏆 Tournoi terminé !');
      else flash('Score enregistré ✅');
    } catch (e) {
      flash((e as Error).message);
    }
    setEditing(null);
  };

  const qualifPerPoule = tournament.poules.length
    ? Math.ceil((tournament.taillePhaseFinale ?? 4) / tournament.poules.length)
    : 0;

  const allMatches = tournament.matches;

  return (
    <div>
      <Confetti show={!!winnerTeam} />
      <div className="row between">
        <h1 className="section-title" style={{ margin: 0 }}>
          🎯 {tournament.nom}
        </h1>
        <button className="btn btn-ghost btn-sm" onClick={() => setView({ name: 'home' })}>
          ← Accueil
        </button>
      </div>

      {winnerTeam && (
        <div className="winner-banner">
          <div className="cup">🏆</div>
          <h2>{winnerTeam.nom} remporte le tournoi !</h2>
          <p>
            {winnerTeam.playerIds.map((id) => players.get(id)?.nom).filter(Boolean).join(' & ')}
          </p>
        </div>
      )}

      <div className="dashboard">
        <RankingPanel tournament={tournament} players={state.players} />

        <div>
          <div className="tabs">
            {hasPoules && (
              <button className={`tab ${tab === 'poules' ? 'active' : ''}`} onClick={() => setTab('poules')}>
                🟦 Poules
              </button>
            )}
            {showBracketTab && (
              <button className={`tab ${tab === 'bracket' ? 'active' : ''}`} onClick={() => setTab('bracket')}>
                🌳 Tableau final
              </button>
            )}
            <button className={`tab ${tab === 'matchs' ? 'active' : ''}`} onClick={() => setTab('matchs')}>
              📋 Tous les matchs
            </button>
          </div>

          {tab === 'poules' &&
            (hasPoules ? (
              tournament.poules.map((p) => (
                <PouleSection
                  key={p.id}
                  tournament={tournament}
                  poule={p}
                  players={players}
                  qualifPerPoule={qualifPerPoule}
                  onPick={setEditing}
                />
              ))
            ) : (
              <div className="empty">Pas de poules dans ce mode.</div>
            ))}

          {tab === 'bracket' && (
            <>
              {!hasBracket && tournament.mode === 'poules_finales' && (
                <div className="empty">
                  <span className="emoji">⏳</span>
                  Termine tous les matchs de poule pour générer le tableau final.
                </div>
              )}
              <BracketView matches={allMatches} teams={tournament.teams} onPick={setEditing} />
            </>
          )}

          {tab === 'matchs' && (
            <div>
              {allMatches.map((m) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  teams={tournament.teams}
                  players={players}
                  onClick={m.teamAId && m.teamBId ? () => setEditing(m) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <ScoreModal
            match={editing}
            teams={tournament.teams}
            players={players}
            pointsCible={tournament.pointsCible}
            onClose={() => setEditing(null)}
            onSave={save}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
