import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../../state/store';
import { PETANQUE } from '../../engine/game';
import { uid } from '../../engine/util';
import { Modal, RoleBadge } from '../common';
import { EmojiPicker } from '../EmojiPicker';
import { BASE_AVATARS } from '../../data/emojis';
import { avatarForName, isCam, isCommeIlPeut } from '../../data/easterEggs';
import type { Player, Role } from '../../types';

const DEFAULT_EMOJI = BASE_AVATARS[0];

export function PlayersView({ flash }: { flash: (m: string) => void }) {
  const { state, addPlayer, updatePlayer, removePlayer } = useStore();
  const [nom, setNom] = useState('');
  const [role, setRole] = useState<Role>('mixte');
  const [emoji, setEmoji] = useState(DEFAULT_EMOJI);
  // Vrai dès que l'utilisateur choisit lui-même un avatar : on cesse alors
  // d'appliquer automatiquement l'emoji déduit du prénom.
  const [emojiTouched, setEmojiTouched] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [camPopup, setCamPopup] = useState(false);

  // « Comme il peut » : pour certains, pas de rôle assumé — tout est mixte.
  const commeIlPeut = isCommeIlPeut(nom);
  const effectiveRole: Role = commeIlPeut ? 'mixte' : role;

  const pickRole = (r: Role) => {
    setRole(r);
    if (isCam(nom) && r === 'tireur') setCamPopup(true);
  };

  // Saisie du nom : applique l'avatar « d'office » tant qu'on n'a pas choisi
  // manuellement un emoji.
  const onNameChange = (value: string) => {
    setNom(value);
    if (!emojiTouched) {
      const auto = avatarForName(value);
      if (auto) setEmoji(auto);
    }
  };

  const chooseEmoji = (e: string) => {
    setEmoji(e);
    setEmojiTouched(true);
  };

  const resetForm = () => {
    setNom('');
    setRole('mixte');
    setEmoji(DEFAULT_EMOJI);
    setEmojiTouched(false);
    setEditId(null);
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
    resetForm();
  };

  const startEdit = (p: Player) => {
    setEditId(p.id);
    setNom(p.nom);
    setRole(p.role);
    setEmoji(p.emoji ?? DEFAULT_EMOJI);
    setEmojiTouched(true); // on garde l'avatar existant tel quel
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
            onChange={(e) => onNameChange(e.target.value)}
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
          <div className="row between">
            <label>Avatar <span style={{ fontSize: '1.3rem' }}>{emoji}</span></label>
            <button className="btn btn-sm btn-ghost" onClick={() => setPickerOpen(true)}>
              😀 Modifier l'avatar
            </button>
          </div>
          <div className="chips">
            {BASE_AVATARS.map((e, i) => (
              <button
                key={`${e}-${i}`}
                className={`chip ${emoji === e ? 'selected' : ''}`}
                onClick={() => chooseEmoji(e)}
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
            <button className="btn btn-ghost" onClick={resetForm}>
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
        {pickerOpen && (
          <EmojiPicker
            current={emoji}
            onPick={chooseEmoji}
            onClose={() => setPickerOpen(false)}
          />
        )}
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
