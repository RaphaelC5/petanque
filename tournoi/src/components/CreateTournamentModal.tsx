import { useState } from 'react';
import { useStore } from '../state/store';
import { PETANQUE } from '../engine/game';
import { uid } from '../engine/util';
import { computeTeamSizes } from '../engine/teams';
import { Modal } from './common';
import type { CompetitionMode, TeamFormat, Tournament } from '../types';

const MODES: { value: CompetitionMode; label: string; desc: string }[] = [
  { value: 'poules_finales', label: 'Poules + finales', desc: 'Poules puis tableau final' },
  { value: 'elimination', label: 'Élimination directe', desc: 'Un match perdu = éliminé' },
  { value: 'poule_unique', label: 'Poule unique', desc: 'Tout le monde se rencontre' },
  { value: 'championnat', label: 'Championnat', desc: 'Round-robin aller-retour' },
];

const PROFONDEURS = [
  { value: 2, label: 'Finale seule' },
  { value: 4, label: 'Demi-finales' },
  { value: 8, label: 'Quarts' },
  { value: 16, label: 'Huitièmes' },
];

export function CreateTournamentModal({
  onClose,
  onCreated,
  flash,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
  flash: (m: string) => void;
}) {
  const { state, upsertTournament } = useStore();
  const [nom, setNom] = useState('');
  const [format, setFormat] = useState<TeamFormat>('doublette');
  const [mode, setMode] = useState<CompetitionMode>('poules_finales');
  const [nbPoules, setNbPoules] = useState(2);
  const [profondeur, setProfondeur] = useState(4);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const allSelected = selected.size === state.players.length && state.players.length > 0;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(state.players.map((p) => p.id)));

  const sizes = computeTeamSizes(selected.size, format);
  const nbEquipes = sizes.length;
  const minOk = selected.size >= 2;

  const create = () => {
    const t: Tournament = {
      id: uid('t'),
      game: 'petanque',
      nom: nom.trim() || 'Tournoi des copains',
      format,
      mode,
      nbPoules: mode === 'poules_finales' ? nbPoules : undefined,
      taillePhaseFinale: mode === 'poules_finales' ? profondeur : undefined,
      participantIds: [...selected],
      teams: [],
      poules: [],
      matches: [],
      statut: 'equipes',
      createdAt: Date.now(),
      pointsCible: PETANQUE.pointsCible,
    };
    upsertTournament(t);
    flash('Tournoi créé, place aux équipes !');
    onCreated(t.id);
  };

  return (
    <Modal title="🆕 Nouveau tournoi" onClose={onClose} wide>
      <div className="field">
        <label>Nom du tournoi</label>
        <input
          type="text"
          value={nom}
          placeholder="ex. Le Mondial des Calanques"
          onChange={(e) => setNom(e.target.value)}
        />
      </div>

      <div className="field">
        <label>Format d'équipe</label>
        <div className="chips">
          {(['doublette', 'triplette'] as TeamFormat[]).map((f) => (
            <button
              key={f}
              className={`chip option ${format === f ? 'selected' : ''}`}
              onClick={() => setFormat(f)}
            >
              <span className="opt-title">{f === 'doublette' ? '👥 Doublettes' : '👨‍👩‍👦 Triplettes'}</span>
              <span className="opt-desc">{f === 'doublette' ? '2 joueurs' : '3 joueurs'} par équipe</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Mode de compétition</label>
        <div className="chips">
          {MODES.map((m) => (
            <button
              key={m.value}
              className={`chip option ${mode === m.value ? 'selected' : ''}`}
              onClick={() => setMode(m.value)}
            >
              <span className="opt-title">{m.label}</span>
              <span className="opt-desc">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {mode === 'poules_finales' && (
        <div className="row" style={{ gap: '1.4rem' }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Nombre de poules</label>
            <input
              type="number"
              min={1}
              max={Math.max(1, nbEquipes)}
              value={nbPoules}
              onChange={(e) => setNbPoules(Math.max(1, +e.target.value))}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Profondeur des phases finales</label>
            <select value={profondeur} onChange={(e) => setProfondeur(+e.target.value)}>
              {PROFONDEURS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} ({p.value} équipes)
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="field">
        <div className="row between">
          <label>Joueurs participants ({selected.size})</label>
          {state.players.length > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={toggleAll}>
              {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          )}
        </div>
        {state.players.length === 0 ? (
          <p className="muted">Ajoute d'abord des joueurs (menu 👥 Joueurs).</p>
        ) : (
          <div className="chips">
            {state.players.map((p) => (
              <button
                key={p.id}
                className={`chip ${selected.has(p.id) ? 'selected' : ''}`}
                onClick={() => toggle(p.id)}
              >
                {p.emoji ?? '🧑'} {p.nom}
              </button>
            ))}
          </div>
        )}
      </div>

      {minOk && (
        <div className="card" style={{ background: 'var(--bleu-pale)' }}>
          <strong>Aperçu :</strong> {nbEquipes} équipes →{' '}
          {sizes.filter((s) => s === 2).length > 0 &&
            `${sizes.filter((s) => s === 2).length} doublette(s)`}
          {sizes.filter((s) => s === 3).length > 0 &&
            ` ${sizes.filter((s) => s === 3).length} triplette(s)`}
          {format === 'doublette' && sizes.includes(3) && (
            <div className="badge-desequilibre">
              ⚠️ Nombre impair : la dernière équipe passe en triplette.
            </div>
          )}
          {format === 'triplette' && sizes.includes(2) && (
            <div className="badge-desequilibre">
              ⚠️ Le reste est complété par des doublettes.
            </div>
          )}
        </div>
      )}

      <div className="row mt" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onClose}>
          Annuler
        </button>
        <button className="btn btn-primary" onClick={create} disabled={!minOk}>
          Constituer les équipes →
        </button>
      </div>
      {!minOk && <p className="muted" style={{ textAlign: 'right' }}>Sélectionne au moins 2 joueurs.</p>}
    </Modal>
  );
}
