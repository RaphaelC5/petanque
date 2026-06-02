import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../../state/store';
import { roleMeta } from '../../engine/game';
import { buildTeams, computeTeamSizes, teamFromPlayers } from '../../engine/teams';
import { generateMatches } from '../../engine/tournament';
import { DrawAnimation } from '../DrawAnimation';
import type { View } from '../../App';
import type { Player, Team, Tournament } from '../../types';

type ModeConstit = 'aleatoire' | 'manuel';

export function ConstitutionView({
  tournament,
  setView,
  flash,
}: {
  tournament: Tournament;
  setView: (v: View) => void;
  flash: (m: string) => void;
}) {
  const { state, upsertTournament } = useStore();
  const participants = useMemo(
    () => state.players.filter((p) => tournament.participantIds.includes(p.id)),
    [state.players, tournament.participantIds],
  );
  const sizes = useMemo(
    () => computeTeamSizes(participants.length, tournament.format),
    [participants.length, tournament.format],
  );

  const [mode, setMode] = useState<ModeConstit>('aleatoire');
  const [soundOn, setSoundOn] = useState(false);
  const [drawTeams, setDrawTeams] = useState<Team[] | null>(null);
  const [drawKey, setDrawKey] = useState(0);

  // --- mode manuel ---
  const [manual, setManual] = useState<string[][]>(() => sizes.map(() => []));
  const [activeTeam, setActiveTeam] = useState(0);
  const assigned = new Set(manual.flat());
  const pool = participants.filter((p) => !assigned.has(p.id));

  const launchDraw = () => {
    setDrawTeams(buildTeams(participants, tournament.format, { random: true }));
    setDrawKey((k) => k + 1);
  };

  const validate = (teams: Team[]) => {
    const ready = generateMatches({ ...tournament, teams });
    upsertTournament(ready);
    flash('Équipes validées, le tournoi commence ! 🎉');
    setView({ name: 'dashboard', tournamentId: tournament.id });
  };

  const assignToActive = (pid: string) => {
    setManual((prev) => {
      const next = prev.map((b) => b.filter((id) => id !== pid));
      if (next[activeTeam].length < sizes[activeTeam]) next[activeTeam].push(pid);
      return next;
    });
  };
  const unassign = (pid: string) =>
    setManual((prev) => prev.map((b) => b.filter((id) => id !== pid)));

  const manualComplete = manual.every((b, i) => b.length === sizes[i]) && pool.length === 0;

  const validateManual = () => {
    const byId = new Map(participants.map((p) => [p.id, p]));
    const teams = manual.map((ids, i) =>
      teamFromPlayers(
        `Équipe ${i + 1}`,
        ids.map((id) => byId.get(id)!).filter(Boolean),
      ),
    );
    validate(teams);
  };

  return (
    <div>
      <div className="row between">
        <h1 className="section-title">🧩 Constituer les équipes — {tournament.nom}</h1>
        <button className="btn btn-ghost btn-sm" onClick={() => setView({ name: 'home' })}>
          ← Accueil
        </button>
      </div>

      <p className="muted">
        {participants.length} joueurs → {sizes.length} équipes (
        {sizes.filter((s) => s === 2).length} doublette(s),{' '}
        {sizes.filter((s) => s === 3).length} triplette(s))
      </p>

      <div className="tabs">
        <button
          className={`tab ${mode === 'aleatoire' ? 'active' : ''}`}
          onClick={() => {
            setMode('aleatoire');
            setDrawTeams(null);
          }}
        >
          🎲 Tirage aléatoire
        </button>
        <button
          className={`tab ${mode === 'manuel' ? 'active' : ''}`}
          onClick={() => setMode('manuel')}
        >
          ✋ Constitution manuelle
        </button>
      </div>

      {mode === 'aleatoire' && (
        <div className="card">
          {!drawTeams ? (
            <div className="empty">
              <span className="emoji">🎰</span>
              Prêt pour le tirage au sort ? On équilibre tireurs et pointeurs
              automatiquement.
              <div className="mt row" style={{ justifyContent: 'center' }}>
                <label className="row" style={{ gap: '0.4rem' }}>
                  <input
                    type="checkbox"
                    checked={soundOn}
                    onChange={(e) => setSoundOn(e.target.checked)}
                  />
                  🔊 Son
                </label>
                <button className="btn btn-sun" onClick={launchDraw}>
                  🎲 Lancer le tirage !
                </button>
              </div>
            </div>
          ) : (
            <>
              <DrawAnimation
                key={drawKey}
                teams={drawTeams}
                players={participants}
                soundOn={soundOn}
                onDone={() => validate(drawTeams)}
              />
              <div className="row mt" style={{ justifyContent: 'center' }}>
                <button className="btn btn-ghost" onClick={launchDraw}>
                  🔄 Relancer le tirage
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {mode === 'manuel' && (
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <strong>Joueurs disponibles ({pool.length})</strong>
            <p className="muted" style={{ margin: '0.2rem 0 0.6rem' }}>
              Sélectionne une équipe active puis clique sur les joueurs à y placer.
            </p>
            <div className="chips">
              {pool.map((p) => (
                <button key={p.id} className="chip" onClick={() => assignToActive(p.id)}>
                  {p.emoji ?? '🧑'} {p.nom} {roleMeta(p.role).emoji}
                </button>
              ))}
              {pool.length === 0 && <span className="muted">Tous les joueurs sont placés ✅</span>}
            </div>
          </div>

          <div className="grid grid-cards">
            {manual.map((ids, i) => {
              const byId = new Map(participants.map((p) => [p.id, p] as const));
              const teamPlayers = ids.map((id) => byId.get(id)).filter(Boolean) as Player[];
              const full = ids.length === sizes[i];
              return (
                <motion.div
                  layout
                  key={i}
                  className="card"
                  onClick={() => setActiveTeam(i)}
                  style={{
                    cursor: 'pointer',
                    outline: activeTeam === i ? '3px solid var(--bleu)' : 'none',
                  }}
                >
                  <div className="row between">
                    <strong>Équipe {i + 1}</strong>
                    <span className="muted">
                      {ids.length}/{sizes[i]} {sizes[i] === 3 ? '(triplette)' : '(doublette)'}
                    </span>
                  </div>
                  {teamPlayers.map((p) => (
                    <div key={p.id} className="draw-slot">
                      <span>{p.emoji ?? '🧑'}</span>
                      <span style={{ fontWeight: 700 }}>{p.nom}</span>
                      <span style={{ marginLeft: 'auto' }}>{roleMeta(p.role).emoji}</span>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          unassign(p.id);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {!full &&
                    Array.from({ length: sizes[i] - ids.length }).map((_, k) => (
                      <div key={k} className="draw-slot muted">
                        <span>➕</span> emplacement libre
                      </div>
                    ))}
                </motion.div>
              );
            })}
          </div>

          <div className="row mt" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" disabled={!manualComplete} onClick={validateManual}>
              Valider les équipes →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
