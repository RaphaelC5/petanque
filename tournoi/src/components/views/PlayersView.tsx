import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../../state/store';
import { PETANQUE } from '../../engine/game';
import { uid } from '../../engine/util';
import { Modal, RoleBadge } from '../common';
import { isCam, isCommeIlPeut } from '../../data/easterEggs';
import type { Player, Role } from '../../types';

const EMOJIS = ['🧔', '👩', '👨‍🦰', '🧑', '👵', '👴', '🧑‍🦱', '👱', '🤠', '🧓', '👲', '🙋', '🕳️'];

export function PlayersView({ flash }: { flash: (m: string) => void }) {
  const { state, addPlayer, updatePlayer, removePlayer } = useStore();
  const [nom, setNom] = useState('');
  const [role, setRole] = useState<Role>('mixte');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [editId, setEditId] = useState<string | null>(null);
  const [camPopup, setCamPopup] = useState(false);

  // « Comme il peut » : pour certains, pas de rôle assumé — tout est mixte.
  const commeIlPeut = isCommeIlPeut(nom);
  const effectiveRole: Role = commeIlPeut ? 'mixte' : role;

  const pickRole = (r: Role) => {
    setRole(r);
    if (isCam(nom) && r === 'tireur') setCamPopup(true);
  };

  const submit = () => {
    const name = nom.trim();
    if (!name) return;
    if (editId) {
      updatePlayer({ id: editId, nom: name, role: effectiveRole, emoji });
      flash('Joueur mis à jour');
    } else {
      addPlayer({ id: uid('p'), nom: name, role: effectiveRole, emoji });
      flash(`${name} ajouté·e 👍`);
    }
    setNom('');
    setRole('mixte');
    setEmoji(EMOJIS[0]);
    setEditId(null);
  };

  const startEdit = (p: Player) => {
    setEditId(p.id);
    setNom(p.nom);
    setRole(p.role);
    setEmoji(p.emoji ?? EMOJIS[0]);
  };

  return (
    <div>
      <h1 className="section-title">👥 Les joueurs</h1>

      <div className="card">
        <div className="field">
          <label>Nom du joueur</label>
          <input
            type="text"
            value={nom}
            placeholder="ex. Marius"
            onChange={(e) => setNom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>

        <div className="field">
          <label>Rôle</label>
          {commeIlPeut ? (
            <div className="chips">
              <button className="chip selected">🤷 comme il peut</button>
            </div>
          ) : (
            <div className="chips">
              {PETANQUE.roles.map((r) => (
                <button
                  key={r.value}
                  className={`chip ${role === r.value ? 'selected' : ''}`}
                  onClick={() => pickRole(r.value)}
                >
                  {r.emoji} {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <label>Avatar</label>
          <div className="chips">
            {EMOJIS.map((e) => (
              <button
                key={e}
                className={`chip ${emoji === e ? 'selected' : ''}`}
                onClick={() => setEmoji(e)}
                style={{ fontSize: '1.2rem' }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="row">
          <button className="btn btn-primary" onClick={submit} disabled={!nom.trim()}>
            {editId ? 'Enregistrer' : '➕ Ajouter le joueur'}
          </button>
          {editId && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                setEditId(null);
                setNom('');
              }}
            >
              Annuler
            </button>
          )}
        </div>
      </div>

      <h2 className="section-title">
        Liste <span className="muted">({state.players.length})</span>
      </h2>

      {state.players.length === 0 ? (
        <div className="empty">
          <span className="emoji">🫥</span>
          Aucun joueur pour l'instant. Ajoute tes premiers copains !
        </div>
      ) : (
        <div className="grid grid-cards">
          {state.players.map((p) => (
            <motion.div
              key={p.id}
              layout
              className="card card-hover"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="row between">
                <div className="row">
                  <span style={{ fontSize: '1.8rem' }}>{p.emoji ?? '🧑'}</span>
                  <div>
                    <strong>{p.nom}</strong>
                    <div>
                      <RoleBadge role={p.role} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="row mt">
                <button className="btn btn-sm btn-ghost" onClick={() => startEdit(p)}>
                  ✏️ Éditer
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    if (confirm(`Supprimer ${p.nom} ?`)) removePlayer(p.id);
                  }}
                >
                  🗑️
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {camPopup && (
          <Modal title="🫳 Minute…" onClose={() => setCamPopup(false)}>
            <p style={{ fontSize: '1.3rem', fontWeight: 800, textAlign: 'center', margin: '0.5rem 0 1rem' }}>
              chalag pas par contre
            </p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => setCamPopup(false)}>
                C'est noté 😅
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
