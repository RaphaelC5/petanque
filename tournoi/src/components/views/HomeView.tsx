import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../../state/store';
import { PETANQUE } from '../../engine/game';
import { demoPlayers } from '../../data/demo';
import { CreateTournamentModal } from '../CreateTournamentModal';
import { tournamentWinner } from '../../engine/tournament';
import { ChambrageFeed } from '../../social/ChambrageFeed';
import type { View } from '../../App';

const MODE_LABEL: Record<string, string> = {
  poules_finales: 'Poules + phases finales',
  elimination: 'Élimination directe',
  poule_unique: 'Poule unique',
  championnat: 'Championnat aller-retour',
};

const STATUT_LABEL: Record<string, string> = {
  config: 'Configuration',
  equipes: 'Constitution des équipes',
  en_cours: 'En cours',
  termine: 'Terminé 🏆',
};

export function HomeView({
  setView,
  flash,
}: {
  setView: (v: View) => void;
  flash: (m: string) => void;
}) {
  const { state, addPlayer, removeTournament } = useStore();
  const [creating, setCreating] = useState(false);

  const tournois = [...state.tournaments].sort((a, b) => b.createdAt - a.createdAt);

  const seedDemo = () => {
    demoPlayers().forEach(addPlayer);
    flash('12 copains ajoutés 🎉');
  };

  return (
    <div>
      <section className="card" style={{ marginBottom: '1.2rem' }}>
        <div className="row between">
          <div>
            <h1 style={{ fontSize: '1.7rem' }}>À tous ceux qui aime la vie</h1>
            <p className="muted" style={{ margin: 0 }}>
              on va professionnaliser les tournois pour pas qu'il y ai de chalag sur le vrai
              vainqueur de la semaine
            </p>
          </div>
          <button className="btn btn-sun" onClick={() => setCreating(true)}>
            ➕ Nouveau tournoi
          </button>
        </div>
      </section>

      <h2 className="section-title">🏆 Mes tournois</h2>

      {tournois.length === 0 ? (
        <div className="empty">
          <span className="emoji">🥖</span>
          Aucun tournoi pour le moment.
          <div className="mt row" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              Créer mon premier tournoi
            </button>
            {state.players.length === 0 && (
              <button className="btn btn-ghost" onClick={seedDemo}>
                🎲 Charger 12 joueurs de démo
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cards">
          <AnimatePresence>
            {tournois.map((t) => {
              const winnerId = tournamentWinner(t);
              const winner = t.teams.find((tm) => tm.id === winnerId);
              const go = () =>
                setView({
                  name: t.statut === 'equipes' || t.teams.length === 0 ? 'constitution' : 'dashboard',
                  tournamentId: t.id,
                });
              return (
                <motion.div
                  key={t.id}
                  layout
                  className="card card-hover"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={go}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="row between">
                    <strong style={{ fontSize: '1.15rem' }}>
                      {PETANQUE.emoji} {t.nom}
                    </strong>
                  </div>
                  <p className="muted" style={{ margin: '0.3rem 0' }}>
                    {MODE_LABEL[t.mode]} · {t.format}
                  </p>
                  <div className="row between">
                    <span className="role-badge" style={{ background: 'var(--bleu)' }}>
                      {STATUT_LABEL[t.statut]}
                    </span>
                    <span className="muted">{t.teams.length} équipes</span>
                  </div>
                  {winner && (
                    <div className="mt" style={{ fontWeight: 700, color: 'var(--ocre)' }}>
                      🏆 {winner.nom}
                    </div>
                  )}
                  <div className="row mt">
                    <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); go(); }}>
                      Ouvrir
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Supprimer le tournoi « ${t.nom} » ?`)) removeTournament(t.id);
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <ChambrageFeed flash={flash} />

      <AnimatePresence>
        {creating && (
          <CreateTournamentModal
            onClose={() => setCreating(false)}
            onCreated={(id) => {
              setCreating(false);
              setView({ name: 'constitution', tournamentId: id });
            }}
            flash={flash}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
