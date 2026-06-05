import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Mini tuto « comment ça marche » en 3 étapes, affiché lors de la première
 * connexion uniquement (drapeau localStorage). Garde-fou côté App.tsx.
 */

const STEPS = [
  {
    emoji: '👥',
    titre: 'Saisissez vos joueurs',
    texte:
      "Commencez par ajouter vos copains : un nom, un rôle (pétanque) et un avatar. Ils seront ensuite répartis dans les équipes des tournois.",
  },
  {
    emoji: '🏆',
    titre: 'Saisissez un tournoi',
    texte:
      "Choisissez un sport, le format d'équipe et les joueurs : l'appli crée les équipes et le tableau. Chaque victoire rapporte des points au classement général.",
  },
  {
    emoji: '⚡',
    titre: 'Sinon, saisissez un match individuel',
    texte:
      "Pas envie d'un tournoi complet ? Lancez un match rapide entre deux équipes : le résultat compte aussi pour le classement général.",
  },
];

export function OnboardingTutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const cur = STEPS[step];

  const next = () => (isLast ? onClose() : setStep((s) => s + 1));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="modal onboarding"
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>👋 Comment ça marche&nbsp;?</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="onboarding-step-counter">
          {step + 1}/{STEPS.length}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="onboarding-body"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
          >
            <div className="onboarding-emoji">{cur.emoji}</div>
            <h3 className="onboarding-title">{cur.titre}</h3>
            <p className="onboarding-text">{cur.texte}</p>
          </motion.div>
        </AnimatePresence>

        <div className="onboarding-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={`onboarding-dot ${i === step ? 'active' : ''}`} />
          ))}
        </div>

        <div className="row between" style={{ marginTop: '1rem' }}>
          {step > 0 ? (
            <button className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>
              ← Précédent
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={onClose}>
              Passer
            </button>
          )}
          <button className="btn btn-primary" onClick={next}>
            {isLast ? "C'est parti 🎉" : 'Suivant →'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
