import { useState } from 'react';
import { useStore } from '../state/store';
import { GAMES, SELECTABLE_GAMES, getGame } from '../engine/game';
import { uid } from '../engine/util';
import { computeTeamSizes } from '../engine/teams';
import { Modal } from './common';
import type { CompetitionMode, GameKind, TeamFormat, Tournament } from '../types';

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

/** Tailles d'équipe proposées pour les sports hors pétanque (2 à 8). */
const TEAM_SIZES = [2, 3, 4, 5, 6, 7, 8];

/** « 3 doublettes », « 1 équipe de 5 »… pour l'aperçu. */
function sizeWord(size: number, count: number): string {
  const s = count > 1 ? 's' : '';
  if (size === 2) return `${count} doublette${s}`;
  if (size === 3) return `${count} triplette${s}`;
  return `${count} équipe${s} de ${size}`;
}

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
  // game vide tant qu'aucun sport n'est choisi → les réglages restent masqués.
  const [game, setGame] = useState<GameKind | ''>('');
  const [gameLabel, setGameLabel] = useState('');
  const [pointsCible, setPointsCible] = useState(''); // chaîne libre (vidable)
  const [format, setFormat] = useState<TeamFormat>('doublette'); // pétanque
  const [teamSize, setTeamSize] = useState(4); // autres sports
  const [mode, setMode] = useState<CompetitionMode>('poules_finales');
  const [nbPoules, setNbPoules] = useState('2'); // chaîne libre (vidable)
  const [profondeur, setProfondeur] = useState(4);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const pickGame = (kind: GameKind) => {
    setGame(kind);
    const def = getGame(kind);
    setPointsCible(String(def.pointsCible));
    if (kind === 'petanque') setFormat('doublette');
  };

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

  // Cible de taille d'équipe selon le sport.
  const target: TeamFormat | number =
    game === 'petanque' ? format : game === 'coinche' ? 2 : teamSize;
  const sizes = game ? computeTeamSizes(selected.size, target) : [];
  const nbEquipes = sizes.length;

  // Regroupe les tailles pour l'aperçu (« 3 doublettes, 1 équipe de 5 »).
  const sizeCounts = new Map<number, number>();
  for (const s of sizes) sizeCounts.set(s, (sizeCounts.get(s) ?? 0) + 1);
  const apercu = [...sizeCounts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([size, n]) => sizeWord(size, n))
    .join(', ');

  // Validations (on peut vider les champs, mais pas valider à vide).
  const pts = parseInt(pointsCible, 10);
  const ptsOk = pointsCible.trim() !== '' && Number.isFinite(pts) && pts >= 1;
  const poulesNum = parseInt(nbPoules, 10);
  const poulesOk =
    mode !== 'poules_finales' || (nbPoules.trim() !== '' && Number.isFinite(poulesNum) && poulesNum >= 1);
  const minOk = selected.size >= 2;
  const canCreate = !!game && minOk && ptsOk && poulesOk;

  const create = () => {
    if (!canCreate || !game) return;
    const tailleEquipe = typeof target === 'number' ? target : target === 'triplette' ? 3 : 2;
    const t: Tournament = {
      id: uid('t'),
      game,
      gameLabel: game === 'custom' ? gameLabel.trim() || undefined : undefined,
      nom: nom.trim() || 'Tournoi des copains',
      format: tailleEquipe === 3 ? 'triplette' : 'doublette',
      tailleEquipe,
      mode,
      nbPoules: mode === 'poules_finales' ? Math.max(1, poulesNum) : undefined,
      taillePhaseFinale: mode === 'poules_finales' ? profondeur : undefined,
      participantIds: [...selected],
      teams: [],
      poules: [],
      matches: [],
      statut: 'equipes',
      createdAt: Date.now(),
      pointsCible: Math.max(1, pts),
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
        <label>Sport</label>
        <div className="chips">
          {SELECTABLE_GAMES.map(({ kind, recommended }) => {
            const def = GAMES[kind];
            return (
              <button
                key={kind}
                className={`chip option ${game === kind ? 'selected' : ''}`}
                onClick={() => pickGame(kind)}
              >
                <span className="opt-title">
                  {def.emoji} {def.nom}
                  {recommended ? ' ⭐' : ''}
                </span>
                {recommended && <span className="opt-desc">Recommandé</span>}
              </button>
            );
          })}
        </div>
      </div>

      {game === 'custom' && (
        <div className="field">
          <label>Nom du sport</label>
          <input
            type="text"
            value={gameLabel}
            placeholder="ex. Molkky, Fléchettes, Ping-pong…"
            onChange={(e) => setGameLabel(e.target.value)}
          />
        </div>
      )}

      {/* Réglages d'équipe / points : visibles seulement après choix du sport. */}
      {game && (
        <div className="row" style={{ gap: '1.4rem' }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Format d'équipe</label>
            {game === 'petanque' ? (
              <div className="chips">
                {(['doublette', 'triplette'] as TeamFormat[]).map((f) => (
                  <button
                    key={f}
                    className={`chip option ${format === f ? 'selected' : ''}`}
                    onClick={() => setFormat(f)}
                  >
                    <span className="opt-title">
                      {f === 'doublette' ? '👥 Doublettes' : '👨‍👩‍👦 Triplettes'}
                    </span>
                    <span className="opt-desc">
                      {f === 'doublette' ? '2 joueurs' : '3 joueurs'} par équipe
                    </span>
                  </button>
                ))}
              </div>
            ) : game === 'coinche' ? (
              <p className="muted" style={{ margin: '0.3rem 0 0' }}>
                👥 2 joueurs par équipe (imposé à la coinche).
              </p>
            ) : (
              <select value={teamSize} onChange={(e) => setTeamSize(+e.target.value)}>
                {TEAM_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n} joueurs par équipe
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="field" style={{ flex: '0 0 12rem' }}>
            <label>Partie en combien de points ?</label>
            <input
              type="number"
              min={1}
              value={pointsCible}
              placeholder="13"
              onChange={(e) => setPointsCible(e.target.value)}
            />
          </div>
        </div>
      )}

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
              placeholder="2"
              onChange={(e) => setNbPoules(e.target.value)}
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

      {game && minOk && (
        <div className="card" style={{ background: 'var(--bleu-pale)' }}>
          <strong>Aperçu :</strong> {nbEquipes} équipes → {apercu}
          {game === 'petanque' && format === 'doublette' && sizes.includes(3) && (
            <div className="badge-desequilibre">
              ⚠️ Nombre impair : la dernière équipe passe en triplette.
            </div>
          )}
          {game === 'petanque' && format === 'triplette' && sizes.includes(2) && (
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
        <button className="btn btn-primary" onClick={create} disabled={!canCreate}>
          Constituer les équipes →
        </button>
      </div>
      {!canCreate && (
        <p className="muted" style={{ textAlign: 'right' }}>
          {!game
            ? 'Choisis un sport pour continuer.'
            : !minOk
              ? 'Sélectionne au moins 2 joueurs.'
              : !ptsOk
                ? 'Indique en combien de points se joue la partie.'
                : 'Indique un nombre de poules valide.'}
        </p>
      )}
    </Modal>
  );
}
