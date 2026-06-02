// ============================================================================
// Orchestration du tournoi : génération des matchs selon le mode,
// clôture d'un match, génération des phases finales, détection du vainqueur.
// ============================================================================

import type { Tournament } from '../types';
import { applyBracketResult, bracketChampion, buildBracket } from './bracket';
import {
  distributeIntoPoules,
  pouleStandings,
  roundRobinMatches,
} from './poules';

/**
 * Génère poules + matchs initiaux selon le mode choisi.
 * Renvoie un nouveau tournoi (immuable). Les équipes doivent être déjà
 * constituées (`tournament.teams`).
 */
export function generateMatches(t: Tournament): Tournament {
  const teamIds = t.teams.map((tm) => tm.id);

  if (t.mode === 'elimination') {
    return { ...t, poules: [], matches: buildBracket(teamIds), statut: 'en_cours' };
  }

  if (t.mode === 'poule_unique' || t.mode === 'championnat') {
    const poule = { id: 'poule_unique', nom: 'Classement général', teamIds };
    const matches = roundRobinMatches(teamIds, poule.id, t.mode === 'championnat');
    return { ...t, poules: [poule], matches, statut: 'en_cours' };
  }

  // poules_finales
  const nbPoules = t.nbPoules ?? Math.max(1, Math.floor(teamIds.length / 4));
  const poules = distributeIntoPoules(t.teams, nbPoules);
  const matches = poules.flatMap((p) => roundRobinMatches(p.teamIds, p.id));
  return { ...t, poules, matches, statut: 'en_cours' };
}

/** Tous les matchs de poule sont-ils terminés ? */
export function poulesTerminees(t: Tournament): boolean {
  const pouleMatches = t.matches.filter((m) => m.stage === 'poule');
  return pouleMatches.length > 0 && pouleMatches.every((m) => m.status === 'termine');
}

/** Y a-t-il déjà un bracket de phase finale ? */
export function aPhaseFinale(t: Tournament): boolean {
  return t.matches.some((m) => m.stage === 'bracket');
}

/**
 * Équipes qualifiées pour la phase finale : on prend les meilleures de chaque
 * poule en alternance (1ers de chaque poule, puis 2es...) jusqu'à `taille`.
 * Les têtes de série sont ordonnées pour étaler les premiers de poule.
 */
export function qualifiedForBracket(t: Tournament, taille: number): string[] {
  const standings = t.poules.map((p) =>
    pouleStandings(p, t.matches, t.teams).map((s) => s.teamId),
  );
  const out: string[] = [];
  let rank = 0;
  while (out.length < taille) {
    let added = false;
    for (const poule of standings) {
      if (poule[rank]) {
        out.push(poule[rank]);
        added = true;
        if (out.length >= taille) break;
      }
    }
    rank++;
    if (!added) break; // plus d'équipes disponibles
  }
  return out;
}

/** Génère la phase finale (bracket) à partir des qualifiés. */
export function generateFinals(t: Tournament): Tournament {
  if (aPhaseFinale(t)) return t;
  const taille = t.taillePhaseFinale ?? 4;
  const qualified = qualifiedForBracket(t, taille);
  if (qualified.length < 2) return t;
  const bracket = buildBracket(qualified);
  return { ...t, matches: [...t.matches, ...bracket] };
}

/**
 * Clôture un match avec les scores donnés. Un vainqueur est obligatoire
 * (pas de nul en pétanque) — la partie peut être close avant 13.
 * Met à jour le bracket et le statut du tournoi le cas échéant.
 */
export function closeMatch(
  t: Tournament,
  matchId: string,
  scoreA: number,
  scoreB: number,
): Tournament {
  if (scoreA === scoreB) {
    throw new Error('Un match de pétanque ne peut pas être nul : un vainqueur est requis.');
  }
  const match = t.matches.find((m) => m.id === matchId);
  if (!match) return t;

  let next: Tournament;
  if (match.stage === 'bracket') {
    next = { ...t, matches: applyBracketResult(t.matches, matchId, scoreA, scoreB) };
  } else {
    const matches = t.matches.map((m) =>
      m.id === matchId
        ? {
            ...m,
            scoreA,
            scoreB,
            status: 'termine' as const,
            winnerId: scoreA > scoreB ? m.teamAId : m.teamBId,
          }
        : m,
    );
    next = { ...t, matches };
  }

  // Déclenche la phase finale si les poules sont finies (mode poules_finales)
  if (next.mode === 'poules_finales' && poulesTerminees(next) && !aPhaseFinale(next)) {
    next = generateFinals(next);
  }

  return updateStatut(next);
}

function updateStatut(t: Tournament): Tournament {
  const statut = isTerminated(t) ? 'termine' : 'en_cours';
  return statut === t.statut ? t : { ...t, statut };
}

export function isTerminated(t: Tournament): boolean {
  if (t.matches.length === 0) return false;
  if (aPhaseFinale(t)) return bracketChampion(t.matches) != null;
  return t.matches.every((m) => m.status === 'termine');
}

/** Renvoie l'id de l'équipe vainqueur du tournoi, ou null. */
export function tournamentWinner(t: Tournament): string | null {
  if (!isTerminated(t)) return null;
  if (aPhaseFinale(t)) return bracketChampion(t.matches);
  // poule unique / championnat → 1er du classement
  if (t.poules.length === 1) {
    const standings = pouleStandings(t.poules[0], t.matches, t.teams);
    return standings[0]?.teamId ?? null;
  }
  return null;
}
