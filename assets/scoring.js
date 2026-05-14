// Reglas:
//   type="score":  3 pts marcador exacto · 1 pt acertar ganador o empate
//   type="winner": 1 pt si acertás dirección (local / empate / visitante)
// Si el partido no terminó o no hay pronóstico, devuelve 0.

export const DEFAULT_RULES = Object.freeze({ exact: 3, winner: 1 });

function realWinner(match) {
  if (!match || match.homeScore == null || match.awayScore == null) return null;
  const sign = Math.sign(match.homeScore - match.awayScore);
  return sign > 0 ? "home" : sign < 0 ? "away" : "draw";
}

export function score(pred, match, rules = DEFAULT_RULES) {
  if (!pred) return 0;
  const rw = realWinner(match);
  if (rw == null) return 0;

  if (pred.type === "winner") {
    return pred.winner === rw ? rules.winner : 0;
  }
  // Default: tipo "score" (marcador)
  if (pred.home === match.homeScore && pred.away === match.awayScore) return rules.exact;
  const predSign = Math.sign(pred.home - pred.away);
  const realSign = Math.sign(match.homeScore - match.awayScore);
  return predSign === realSign ? rules.winner : 0;
}

export function isExact(pred, match) {
  if (!pred || pred.type === "winner") return false;
  return match && pred.home === match.homeScore && pred.away === match.awayScore;
}

export function isWinnerOnly(pred, match) {
  if (!pred || !match || match.homeScore == null) return false;
  if (isExact(pred, match)) return false;
  if (pred.type === "winner") {
    return pred.winner === realWinner(match);
  }
  return Math.sign(pred.home - pred.away) === Math.sign(match.homeScore - match.awayScore);
}

export function predWinner(pred) {
  if (!pred) return null;
  if (pred.type === "winner") return pred.winner;
  if (pred.home == null || pred.away == null) return null;
  const s = Math.sign(pred.home - pred.away);
  return s > 0 ? "home" : s < 0 ? "away" : "draw";
}
