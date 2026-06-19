"""Dixon-Coles Poisson match prediction + Monte Carlo tournament simulation.

Each team carries a single rating (roughly an Elo on a 70-95 scale) in the
dataset. Ratings map to expected goals via an exponential of the rating gap;
the Dixon-Coles tau term corrects the independence assumption for low-scoring
results (0-0, 1-0, 0-1, 1-1), which plain Poisson systematically misprices.
"""

import bisect
import math
import random
import time
from itertools import accumulate
from typing import Dict, List, Tuple

from . import football_api

MAX_GOALS = 8
BASE_GOALS = 1.35
RATING_SCALE = 10.0
DC_RHO = -0.13
HOST_CODES = {"USA", "MEX", "CAN"}
HOST_BOOST = 1.12

# Live-form blending: the rating is the pre-tournament prior; as real matches
# are played, each team's observed scoring rates pull expected goals toward
# tournament form. Weight = played / (played + K): one game moves predictions
# ~17%, a full group stage ~43% — the prior never vanishes entirely.
_FORM_K = 5.0
_FORM_TTL = 300
_form_cache = {"at": 0.0, "attack": {}, "concede": {}}


def _form_factors() -> Tuple[Dict[int, float], Dict[int, float]]:
    now = time.time()
    if now - _form_cache["at"] < _FORM_TTL:
        return _form_cache["attack"], _form_cache["concede"]
    attack, concede = {}, {}
    try:
        for grp in football_api.api.standings():
            for row in grp["rows"]:
                played = row["played"]
                if not played:
                    continue
                w = played / (played + _FORM_K)
                a = (1 - w) + w * (row["goals_for"] / played / BASE_GOALS)
                c = (1 - w) + w * (row["goals_against"] / played / BASE_GOALS)
                
                # Dynamic momentum from current team form
                form_array = row.get("form", [])
                momentum = 0.0
                if form_array:
                    for res in form_array[-3:]:
                        if res == "W": momentum += 0.05
                        elif res == "L": momentum -= 0.05
                        
                tid = row["team"]["id"]
                attack[tid] = min(max(a + momentum, 0.6), 1.8)
                concede[tid] = min(max(c - momentum, 0.6), 1.8)
    except Exception:
        pass  # form is an enhancement — never let it break a prediction
        
    try:
        # Dynamic player form
        player_bonus = {}
        defense_penalty = {}
        for p in football_api.api.players():
            tid = p.get("team_id")
            if not tid:
                continue
            goals = p.get("goals", 0)
            assists = p.get("assists", 0)
            red_cards = p.get("red_cards", 0)
            yellow_cards = p.get("yellow_cards", 0)
            
            if goals > 0 or assists > 0:
                player_bonus[tid] = player_bonus.get(tid, 0.0) + (goals * 0.03) + (assists * 0.01)
            if red_cards > 0 or yellow_cards > 0:
                defense_penalty[tid] = defense_penalty.get(tid, 0.0) + (red_cards * 0.05) + (yellow_cards * 0.01)

        for tid, bonus in player_bonus.items():
            if tid in attack:
                attack[tid] = min(attack[tid] + bonus, 2.0)
                
        for tid, penalty in defense_penalty.items():
            if tid in concede:
                concede[tid] = min(concede[tid] + penalty, 2.0)
    except Exception:
        pass

    _form_cache.update(at=now, attack=attack, concede=concede)
    return attack, concede


def _poisson_pmf(k: int, lam: float) -> float:
    return math.exp(-lam) * lam**k / math.factorial(k)


def _tau(x: int, y: int, lam: float, mu: float, rho: float = DC_RHO) -> float:
    if x == 0 and y == 0:
        return 1 - lam * mu * rho
    if x == 0 and y == 1:
        return 1 + lam * rho
    if x == 1 and y == 0:
        return 1 + mu * rho
    if x == 1 and y == 1:
        return 1 - rho
    return 1.0


def expected_goals(home: dict, away: dict) -> Tuple[float, float]:
    diff = (home["rating"] - away["rating"]) / RATING_SCALE
    lam = BASE_GOALS * math.exp(0.55 * diff)
    mu = BASE_GOALS * math.exp(-0.55 * diff)
    if home["code"] in HOST_CODES:
        lam *= HOST_BOOST
    if away["code"] in HOST_CODES:
        mu *= HOST_BOOST
    attack, concede = _form_factors()
    lam *= attack.get(home["id"], 1.0) * concede.get(away["id"], 1.0)
    mu *= attack.get(away["id"], 1.0) * concede.get(home["id"], 1.0)
    return min(max(lam, 0.15), 4.5), min(max(mu, 0.15), 4.5)


def score_matrix(home: dict, away: dict) -> List[List[float]]:
    lam, mu = expected_goals(home, away)
    matrix = [
        [_poisson_pmf(i, lam) * _poisson_pmf(j, mu) * _tau(i, j, lam, mu) for j in range(MAX_GOALS + 1)]
        for i in range(MAX_GOALS + 1)
    ]
    total = sum(sum(row) for row in matrix)
    return [[p / total for p in row] for row in matrix]


def predict(home: dict, away: dict) -> dict:
    matrix = score_matrix(home, away)
    lam, mu = expected_goals(home, away)
    p_home = sum(matrix[i][j] for i in range(MAX_GOALS + 1) for j in range(MAX_GOALS + 1) if i > j)
    p_away = sum(matrix[i][j] for i in range(MAX_GOALS + 1) for j in range(MAX_GOALS + 1) if i < j)
    p_draw = 1.0 - p_home - p_away

    scorelines = sorted(
        (
            {"home_goals": i, "away_goals": j, "probability": round(matrix[i][j], 4)}
            for i in range(6)
            for j in range(6)
        ),
        key=lambda s: -s["probability"],
    )[:5]
    best = max(p_home, p_draw, p_away)
    confidence = "HIGH" if best >= 0.55 else "MEDIUM" if best >= 0.42 else "LOW"
    return {
        "home": home,
        "away": away,
        "home_win": round(p_home, 4),
        "draw": round(p_draw, 4),
        "away_win": round(p_away, 4),
        "expected_home_goals": round(lam, 2),
        "expected_away_goals": round(mu, 2),
        "most_likely_score": f"{scorelines[0]['home_goals']}-{scorelines[0]['away_goals']}",
        "confidence": confidence,
        "top_scorelines": scorelines,
    }


# ------------------------------------------------------ tournament sim

class _Sampler:
    """Pre-computed cumulative score distributions so 1,000 runs stay fast."""

    def __init__(self):
        self._cum: Dict[Tuple[int, int], list] = {}

    def sample(self, home: dict, away: dict, rng: random.Random) -> Tuple[int, int]:
        key = (home["id"], away["id"])
        if key not in self._cum:
            matrix = score_matrix(home, away)
            flat = [matrix[i][j] for i in range(MAX_GOALS + 1) for j in range(MAX_GOALS + 1)]
            self._cum[key] = list(accumulate(flat))
        cum = self._cum[key]
        idx = bisect.bisect_left(cum, rng.random() * cum[-1])
        idx = min(idx, len(cum) - 1)
        return divmod(idx, MAX_GOALS + 1)


def simulate_tournament(runs: int = 1000, seed: int = None) -> dict:
    teams = football_api.get_teams()
    by_group: Dict[str, List[dict]] = {}
    for t in teams:
        by_group.setdefault(t["group"], []).append(t)

    rng = random.Random(seed)
    sampler = _Sampler()
    champion_count = {t["id"]: 0 for t in teams}
    final_count = {t["id"]: 0 for t in teams}
    semi_count = {t["id"]: 0 for t in teams}

    pairs = [(0, 1), (2, 3), (0, 2), (1, 3), (0, 3), (1, 2)]

    for _ in range(runs):
        winners, runners, thirds = [], [], []
        for letter in sorted(by_group):
            group = by_group[letter]
            stats = {t["id"]: [0, 0, 0] for t in group}  # points, gd, gf
            for a, b in pairs:
                gh, ga = sampler.sample(group[a], group[b], rng)
                for tid, gf, gag in ((group[a]["id"], gh, ga), (group[b]["id"], ga, gh)):
                    stats[tid][1] += gf - gag
                    stats[tid][2] += gf
                if gh > ga:
                    stats[group[a]["id"]][0] += 3
                elif ga > gh:
                    stats[group[b]["id"]][0] += 3
                else:
                    stats[group[a]["id"]][0] += 1
                    stats[group[b]["id"]][0] += 1
            ranked = sorted(group, key=lambda t: (stats[t["id"]], rng.random()), reverse=True)
            winners.append((ranked[0], stats[ranked[0]["id"]]))
            runners.append((ranked[1], stats[ranked[1]["id"]]))
            thirds.append((ranked[2], stats[ranked[2]["id"]]))

        # 12 winners + 12 runners-up + 8 best third-placed teams -> 32
        thirds.sort(key=lambda x: x[1], reverse=True)
        qualified = [t for t, _ in winners] + [t for t, _ in runners] + [t for t, _ in thirds[:8]]
        qualified.sort(key=lambda t: -t["rating"])
        bracket = []
        n = len(qualified)
        for i in range(n // 2):
            bracket.append((qualified[i], qualified[n - 1 - i]))

        round_teams = [t for pair in bracket for t in pair]
        while len(round_teams) > 1:
            if len(round_teams) == 4:
                for t in round_teams:
                    semi_count[t["id"]] += 1
            if len(round_teams) == 2:
                for t in round_teams:
                    final_count[t["id"]] += 1
            nxt = []
            for i in range(0, len(round_teams), 2):
                a, b = round_teams[i], round_teams[i + 1]
                gh, ga = sampler.sample(a, b, rng)
                if gh == ga:  # penalties: weighted coin from win probabilities
                    pa = 0.5 + (a["rating"] - b["rating"]) / 60.0
                    winner = a if rng.random() < max(0.15, min(0.85, pa)) else b
                else:
                    winner = a if gh > ga else b
                nxt.append(winner)
            round_teams = nxt
        champion_count[round_teams[0]["id"]] += 1

    team_map = {t["id"]: t for t in teams}
    results = sorted(
        (
            {
                "team": team_map[tid],
                "champion_pct": round(100 * champion_count[tid] / runs, 2),
                "final_pct": round(100 * final_count[tid] / runs, 2),
                "semifinal_pct": round(100 * semi_count[tid] / runs, 2),
            }
            for tid in champion_count
            if final_count[tid] > 0 or champion_count[tid] > 0 or semi_count[tid] > 0
        ),
        key=lambda r: (-r["champion_pct"], -r["final_pct"], -r["semifinal_pct"]),
    )
    return {
        "runs": runs,
        "most_likely_champion": results[0]["team"],
        "results": results[:16],
    }
