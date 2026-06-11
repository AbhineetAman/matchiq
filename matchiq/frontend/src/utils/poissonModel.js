/* Lightweight client-side Poisson model — mirrors backend services/poisson.py.
   Used for instant "quick pick" hints before the API round-trip resolves. */

const MAX_GOALS = 8;
const BASE_GOALS = 1.35;
const HOSTS = new Set(["USA", "MEX", "CAN"]);

function factorial(n) {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

function poissonPmf(k, lam) {
  return (Math.exp(-lam) * Math.pow(lam, k)) / factorial(k);
}

function tau(x, y, lam, mu, rho = -0.13) {
  if (x === 0 && y === 0) return 1 - lam * mu * rho;
  if (x === 0 && y === 1) return 1 + lam * rho;
  if (x === 1 && y === 0) return 1 + mu * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

export function expectedGoals(home, away) {
  const diff = (home.rating - away.rating) / 10;
  let lam = BASE_GOALS * Math.exp(0.55 * diff);
  let mu = BASE_GOALS * Math.exp(-0.55 * diff);
  if (HOSTS.has(home.code)) lam *= 1.12;
  if (HOSTS.has(away.code)) mu *= 1.12;
  return [Math.min(Math.max(lam, 0.15), 4.5), Math.min(Math.max(mu, 0.15), 4.5)];
}

export function quickPredict(home, away) {
  const [lam, mu] = expectedGoals(home, away);
  let pHome = 0;
  let pAway = 0;
  let total = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = poissonPmf(i, lam) * poissonPmf(j, mu) * tau(i, j, lam, mu);
      total += p;
      if (i > j) pHome += p;
      if (i < j) pAway += p;
    }
  }
  pHome /= total;
  pAway /= total;
  return { homeWin: pHome, draw: 1 - pHome - pAway, awayWin: pAway };
}
