// Petits composants UI réutilisables.

import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { roleMeta } from '../engine/game';
import type { Player, Role } from '../types';

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="modal"
        style={wide ? { width: 'min(880px, 100%)' } : undefined}
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const m = roleMeta(role);
  return (
    <span className="role-badge" style={{ background: m.couleur }}>
      {m.emoji} {m.label}
    </span>
  );
}

export function PlayerChip({ player }: { player: Player }) {
  const m = roleMeta(player.role);
  return (
    <span className="draw-slot">
      <span style={{ fontSize: '1.1rem' }}>{player.emoji ?? m.emoji}</span>
      <span>{player.nom}</span>
    </span>
  );
}

export function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="toast"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const COLORS = ['#f7c948', '#0a6ca8', '#e4572e', '#2a9d6e', '#1192d4', '#f0a04b'];

export function Confetti({ show }: { show: boolean }) {
  if (!show) return null;
  const pieces = Array.from({ length: 80 });
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((_, i) => (
        <i
          key={i}
          style={{
            left: `${Math.random() * 100}%`,
            background: COLORS[i % COLORS.length],
            animationDuration: `${1.6 + Math.random() * 1.4}s`,
            animationDelay: `${Math.random() * 0.5}s`,
          }}
        />
      ))}
    </div>
  );
}
