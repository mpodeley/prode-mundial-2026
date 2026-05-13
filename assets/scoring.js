// Reglas: 3 puntos por marcador exacto, 1 punto por acertar ganador o empate.
// Si el partido no terminó o no hay pronóstico, devuelve 0.

export const DEFAULT_RULES = Object.freeze({ exact: 3, winner: 1 });

export function score(pred, match, rules = DEFAULT_RULES) {
  if (!pred) return 0;
  if (!match || match.homeScore == null || match.awayScore == null) return 0;
  if (pred.home === match.homeScore && pred.away === match.awayScore) {
    return rules.exact;
  }
  const predSign = Math.sign(pred.home - pred.away);
  const realSign = Math.sign(match.homeScore - match.awayScore);
  return predSign === realSign ? rules.winner : 0;
}

export function isExact(pred, match) {
  return !!pred && match && pred.home === match.homeScore && pred.away === match.awayScore;
}

export function isWinnerOnly(pred, match) {
  if (!pred || !match || match.homeScore == null) return false;
  if (isExact(pred, match)) return false;
  return Math.sign(pred.home - pred.away) === Math.sign(match.homeScore - match.awayScore);
}
