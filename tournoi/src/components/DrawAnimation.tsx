import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { roleMeta } from '../engine/game';
import { teamSizeLabel } from '../engine/teams';
import { Confetti, EditableTeamName } from './common';
import type { Player, Team } from '../types';

interface Reveal {
  teamIdx: number;
  playerId: string;
}

/**
 * Tirage type tombola : les joueurs sont révélés un par un, équipe par équipe
 * (on complète une équipe avant de passer à la suivante), avec un effet de
 * roulette qui ralentit avant de « tomber » dans une équipe. Confettis à la fin.
 */
export function DrawAnimation({
  teams,
  players,
  soundOn,
  onDone,
  onRename,
  showRoles = true,
}: {
  teams: Team[];
  players: Player[];
  soundOn: boolean;
  onDone: () => void;
  onRename?: (teamId: string, nom: string) => void;
  /** Affiche les rôles (tireur/pointeur) — pétanque uniquement. */
  showRoles?: boolean;
}) {
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const order = useMemo<Reveal[]>(() => {
    const out: Reveal[] = [];
    teams.forEach((t, teamIdx) => {
      t.playerIds.forEach((playerId) => out.push({ teamIdx, playerId }));
    });
    return out;
  }, [teams]);

  const [revealed, setRevealed] = useState(0);
  const [reel, setReel] = useState('🎲');
  const [finished, setFinished] = useState(false);
  const [pulseTeam, setPulseTeam] = useState<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const beep = (freq: number) => {
    if (!soundOn) return;
    try {
      const ctx = (audioRef.current ??= new (window.AudioContext ||
        (window as any).webkitAudioContext)());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      /* audio non dispo */
    }
  };

  useEffect(() => {
    if (order.length === 0) {
      setFinished(true);
      return;
    }
    let cancelled = false;
    const names = players.map((p) => p.nom);

    const revealNext = (idx: number) => {
      if (cancelled) return;
      if (idx >= order.length) {
        setReel('🎉');
        setFinished(true);
        return;
      }
      const target = byId.get(order[idx].playerId)?.nom ?? '?';
      const start = performance.now();
      const duration = 700 + idx * 40; // ralentit légèrement à chaque tirage
      const spin = () => {
        if (cancelled) return;
        const t = (performance.now() - start) / duration;
        if (t >= 1) {
          setReel(target);
          setRevealed(idx + 1);
          setPulseTeam(order[idx].teamIdx);
          beep(520 + order[idx].teamIdx * 40);
          setTimeout(() => setPulseTeam(null), 350);
          setTimeout(() => revealNext(idx + 1), 450);
          return;
        }
        setReel(names[Math.floor(Math.random() * names.length)] ?? '🎲');
        const delay = 40 + t * t * 160; // accélère le ralenti
        setTimeout(spin, delay);
      };
      spin();
    };

    const startTimer = setTimeout(() => revealNext(0), 400);
    return () => {
      cancelled = true;
      clearTimeout(startTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  return (
    <div className="draw-stage">
      <Confetti show={finished && order.length > 0} />
      <div className="draw-reel">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={reel + revealed}
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -18, opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {finished ? '🎉 Équipes constituées !' : reel}
          </motion.span>
        </AnimatePresence>
      </div>
      <p className="muted">
        {finished
          ? 'Que le meilleur gagne !'
          : `Tirage en cours… ${revealed}/${order.length}`}
      </p>

      <div className="draw-teams">
        {teams.map((team, teamIdx) => {
          const revealedCount = order
            .slice(0, revealed)
            .filter((r) => r.teamIdx === teamIdx).length;
          return (
            <motion.div
              key={team.id}
              className="draw-team"
              animate={pulseTeam === teamIdx ? { scale: [1, 1.06, 1] } : {}}
              style={
                team.desequilibree && finished
                  ? { boxShadow: '0 0 0 2px var(--terre) inset' }
                  : undefined
              }
            >
              <h4>
                {onRename && finished ? (
                  <EditableTeamName
                    name={team.nom}
                    onRename={(nom) => onRename(team.id, nom)}
                  />
                ) : (
                  team.nom
                )}{' '}
                ({teamSizeLabel(team.playerIds.length)})
              </h4>
              {team.playerIds.map((pid, slot) => {
                const player = byId.get(pid);
                const isRevealed = slot < revealedCount;
                const meta = player && showRoles ? roleMeta(player.role) : null;
                return (
                  <AnimatePresence key={pid}>
                    {isRevealed && player ? (
                      <motion.div
                        className="draw-slot"
                        initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                      >
                        <span style={{ fontSize: '1.1rem' }}>
                          {player.emoji ?? '🧑'}
                        </span>
                        <span style={{ fontWeight: 700 }}>{player.nom}</span>
                        {meta && (
                          <span title={meta.label} style={{ marginLeft: 'auto' }}>
                            {meta.emoji}
                          </span>
                        )}
                      </motion.div>
                    ) : (
                      <div className="draw-slot muted">
                        <span>⏳</span> …
                      </div>
                    )}
                  </AnimatePresence>
                );
              })}
              {team.desequilibree && finished && (
                <div className="badge-desequilibre">⚠️ équipe déséquilibrée</div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="row mt" style={{ justifyContent: 'center' }}>
        <button className="btn btn-primary" disabled={!finished} onClick={onDone}>
          {finished ? 'Valider ces équipes ✅' : 'Tirage en cours…'}
        </button>
      </div>
    </div>
  );
}
