"""Match detail (timeline / lineups / stats) for the match-card modal.

Live mode resolves in layers, never fabricating live stats:
1. API-Football (RAPIDAPI_KEY) — real events, lineups and the full team
   stats table for the fixture, matched to the football-data match by
   kickoff time + team names.
2. football-data.org v4 basics — the free tier only exposes the final /
   half-time score and referee, so that is all we show, with a note.

Demo mode (no keys): details are synthesized deterministically from the
bundled fallback dataset, seeded by match id, so the demo always renders
a complete and stable scorecard.
"""

from datetime import datetime
from typing import Dict, List, Optional, Tuple

import random

from .football_api import (
    SEASON,
    WORLD_CUP_LEAGUE_ID,
    _base_teams,
    _fallback_matches,
    _fallback_players,
    _load_fallback,
    api,
)
from .football_data import fd

_GOAL_TYPES = {"REGULAR": "goal", "OWN": "own_goal", "PENALTY": "penalty_goal"}
_POSITION_ORDER = {"GK": 0, "DF": 1, "MF": 2, "FW": 3}

AF_FIXTURES_TTL = 6 * 3600   # full fixture list, only needed for id mapping
AF_DETAIL_TTL = 10 * 60      # single fixture with events/lineups/stats

# football-data names → API-Football names (only where token overlap fails)
_AF_ALIASES = {
    "korea republic": "south korea",
    "czechia": "czech republic",
    "ir iran": "iran",
    "côte d'ivoire": "ivory coast",
    "cabo verde": "cape verde",
    "türkiye": "turkey",
    "united states": "usa",
}

# API-Football statistic types → our display labels, in screenshot order
_AF_STAT_LABELS = [
    ("Total Shots", "Shots"),
    ("Shots on Goal", "Shots on target"),
    ("Ball Possession", "Possession"),
    ("Total passes", "Passes"),
    ("Passes %", "Pass accuracy"),
    ("Fouls", "Fouls"),
    ("Yellow Cards", "Yellow cards"),
    ("Red Cards", "Red cards"),
    ("Offsides", "Offsides"),
    ("Corner Kicks", "Corners"),
]


def _unavailable(match_id: int, source: str) -> dict:
    return {"match_id": match_id, "available": False, "source": source,
            "timeline": [], "home_lineup": None, "away_lineup": None,
            "stats": [], "referee": None, "note": None}


def _name(obj: Optional[dict]) -> Optional[str]:
    return (obj or {}).get("name")


# --------------------------------------------------- API-Football enrichment

def _norm_name(name: str) -> str:
    name = (name or "").lower().strip()
    return _AF_ALIASES.get(name, name)


def _names_match(a: str, b: str) -> bool:
    a, b = _norm_name(a), _norm_name(b)
    if a == b:
        return True
    tokens_a = {w for w in a.split() if len(w) >= 4}
    tokens_b = {w for w in b.split() if len(w) >= 4}
    return bool(tokens_a & tokens_b)


def _af_fixture_id(kickoff_utc: str, home_name: str, away_name: str) -> Optional[int]:
    data = api._request("fixtures", {"league": WORLD_CUP_LEAGUE_ID, "season": SEASON}, AF_FIXTURES_TTL)
    if not data:
        return None
    target = datetime.fromisoformat(kickoff_utc.replace("Z", "+00:00"))
    for fx in data.get("response") or []:
        try:
            kickoff = datetime.fromisoformat(fx["fixture"]["date"].replace("Z", "+00:00"))
        except (KeyError, ValueError):
            continue
        if abs((kickoff - target).total_seconds()) > 900:
            continue
        if (_names_match(fx["teams"]["home"]["name"], home_name)
                and _names_match(fx["teams"]["away"]["name"], away_name)):
            return fx["fixture"]["id"]
    return None


def _af_lineup(lineup: dict) -> dict:
    def rows(players):
        return [{"name": _name(p.get("player")) or "Unknown",
                 "position": (p.get("player") or {}).get("pos"),
                 "shirt": (p.get("player") or {}).get("number")} for p in players or []]

    return {
        "formation": lineup.get("formation"),
        "coach": _name(lineup.get("coach")),
        "starting": rows(lineup.get("startXI")),
        "bench": rows(lineup.get("substitutes")),
        "is_full_xi": True,
    }


def _af_details(match_id: int, kickoff_utc: str, home_name: str, away_name: str) -> Optional[dict]:
    """Full scorecard from API-Football, or None if the key/plan can't serve it."""
    if not api.api_key:
        return None
    try:
        fixture_id = _af_fixture_id(kickoff_utc, home_name, away_name)
        if not fixture_id:
            return None
        data = api._request("fixtures", {"id": fixture_id}, AF_DETAIL_TTL)
        fx = ((data or {}).get("response") or [None])[0]
        if not fx:
            return None
        home_id = fx["teams"]["home"]["id"]

        def side_of(team: Optional[dict]) -> str:
            return "home" if (team or {}).get("id") == home_id else "away"

        events: List[dict] = []
        running = {"home": 0, "away": 0}
        for e in fx.get("events") or []:
            time = e.get("time") or {}
            kind = (e.get("type") or "").lower()
            detail = (e.get("detail") or "").lower()
            side = side_of(e.get("team"))
            base = {"minute": time.get("elapsed") or 0, "injury_time": time.get("extra"), "team": side}
            if kind == "goal":
                if "missed" in detail:
                    continue
                running[side] += 1
                events.append({**base,
                               "type": "own_goal" if "own" in detail else
                                       "penalty_goal" if "penalty" in detail else "goal",
                               "player": _name(e.get("player")),
                               "detail": _name(e.get("assist")),
                               "score": f"{running['home']} - {running['away']}"})
            elif kind == "card":
                events.append({**base, "type": "red" if "red" in detail else "yellow",
                               "player": _name(e.get("player"))})
            elif kind == "subst":
                # API-Football: `player` goes off, `assist` comes on
                events.append({**base, "type": "sub",
                               "player": _name(e.get("assist")),
                               "detail": _name(e.get("player"))})
        events.sort(key=lambda e: (e["minute"], e.get("injury_time") or 0))

        home_lineup = away_lineup = None
        for lineup in fx.get("lineups") or []:
            if side_of(lineup.get("team")) == "home":
                home_lineup = _af_lineup(lineup)
            else:
                away_lineup = _af_lineup(lineup)

        by_side: Dict[str, Dict[str, object]] = {"home": {}, "away": {}}
        for block in fx.get("statistics") or []:
            side = side_of(block.get("team"))
            for stat in block.get("statistics") or []:
                by_side[side][stat.get("type")] = stat.get("value")
        stats = [
            {"label": label,
             "home": str(by_side["home"].get(af_type) if by_side["home"].get(af_type) is not None else 0),
             "away": str(by_side["away"].get(af_type) if by_side["away"].get(af_type) is not None else 0)}
            for af_type, label in _AF_STAT_LABELS
            if af_type in by_side["home"] or af_type in by_side["away"]
        ]
        if not (events or stats or home_lineup or away_lineup):
            return None
        return {"match_id": match_id, "available": True, "source": "live",
                "timeline": events, "home_lineup": home_lineup, "away_lineup": away_lineup,
                "stats": stats, "referee": None, "note": None}
    except Exception:
        return None


# ----------------------------------------------- football-data.org basics

def _fd_lineup(side: dict) -> Optional[dict]:
    lineup = side.get("lineup") or []
    if not lineup:
        return None

    def rows(players):
        return [{"name": p.get("name") or "Unknown",
                 "position": p.get("position"),
                 "shirt": p.get("shirtNumber")} for p in players]

    return {"formation": side.get("formation"), "coach": _name(side.get("coach")),
            "starting": rows(lineup), "bench": rows(side.get("bench") or []),
            "is_full_xi": True}


def _squad_lineups() -> Dict[int, dict]:
    """{fd_team_id: squad-as-lineup} from the free official-squad feed.

    The free tier never sends a confirmed starting XI, but it does carry each
    team's real squad + coach — so we show that (flagged is_full_xi=False) so
    the Lineups tab has genuine data instead of being empty.
    """
    try:
        base = _base_teams()
        index = fd._team_index(base)              # {fd_id: local team}
        squads = fd.squads(base)                  # {local_id: {coach, players}}
        if not index or not squads:
            return {}
    except Exception:
        return {}
    out: Dict[int, dict] = {}
    for fd_id, local in index.items():
        sq = squads.get(local["id"])
        if not sq or not sq.get("players"):
            continue
        ordered = sorted(sq["players"], key=lambda p: _POSITION_ORDER.get(p.get("position"), 9))
        coach = sq.get("coach") or {}
        out[fd_id] = {
            "formation": None,
            "coach": coach.get("name"),
            "starting": [{"name": p.get("name") or "Unknown", "position": p.get("position"), "shirt": None}
                         for p in ordered],
            "bench": [],
            "is_full_xi": False,
        }
    return out


def _live_details(match_id: int) -> Optional[dict]:
    data = fd.match_detail(match_id)
    if not data or not data.get("id"):
        return None
    home_name = _name(data.get("homeTeam")) or ""
    away_name = _name(data.get("awayTeam")) or ""
    referee = next((r.get("name") for r in data.get("referees") or []
                    if r.get("type") == "REFEREE"), None)

    enriched = _af_details(match_id, data.get("utcDate") or "", home_name, away_name)
    if enriched:
        enriched["referee"] = referee
        return enriched

    home_id = (data.get("homeTeam") or {}).get("id")

    def side_of(team: Optional[dict]) -> str:
        return "home" if (team or {}).get("id") == home_id else "away"

    # the free tier strips these arrays today; parse them anyway so richer
    # plans (or future free-tier upgrades) light up without code changes
    events: List[dict] = []
    running = {"home": 0, "away": 0}
    for g in data.get("goals") or []:
        side = side_of(g.get("team"))
        running[side] += 1
        events.append({"minute": g.get("minute") or 0, "injury_time": g.get("injuryTime"),
                       "type": _GOAL_TYPES.get(g.get("type"), "goal"), "team": side,
                       "player": _name(g.get("scorer")), "detail": _name(g.get("assist")),
                       "score": f"{running['home']} - {running['away']}"})
    cards = {"home": {"yellow": 0, "red": 0}, "away": {"yellow": 0, "red": 0}}
    for b in data.get("bookings") or []:
        side = side_of(b.get("team"))
        kind = "red" if "RED" in (b.get("card") or "") else "yellow"
        cards[side][kind] += 1
        events.append({"minute": b.get("minute") or 0, "type": kind,
                       "team": side, "player": _name(b.get("player"))})
    for s in data.get("substitutions") or []:
        events.append({"minute": s.get("minute") or 0, "type": "sub",
                       "team": side_of(s.get("team")),
                       "player": _name(s.get("playerIn")), "detail": _name(s.get("playerOut"))})
    events.sort(key=lambda e: (e["minute"], e.get("injury_time") or 0))

    score = data.get("score") or {}
    full_time = score.get("fullTime") or {}
    half_time = score.get("halfTime") or {}
    stats = []
    if full_time.get("home") is not None:
        fh, fa = full_time["home"], full_time.get("away", 0)
        stats.append({"label": "Goals", "home": str(fh), "away": str(fa)})
        if half_time.get("home") is not None:
            hh, ha = half_time["home"], half_time.get("away", 0)
            stats.append({"label": "Half-time", "home": str(hh), "away": str(ha)})
            stats.append({"label": "1st-half goals", "home": str(hh), "away": str(ha)})
            stats.append({"label": "2nd-half goals", "home": str(fh - hh), "away": str(fa - ha)})
    if data.get("bookings") is not None:
        stats.append({"label": "Yellow cards", "home": str(cards["home"]["yellow"]), "away": str(cards["away"]["yellow"])})
        stats.append({"label": "Red cards", "home": str(cards["home"]["red"]), "away": str(cards["away"]["red"])})

    # the free match resource never carries lineups — fall back to the real
    # official squad feed so the Lineups tab shows genuine data
    home_lineup = _fd_lineup(data.get("homeTeam") or {})
    away_lineup = _fd_lineup(data.get("awayTeam") or {})
    if not home_lineup or not away_lineup:
        squad_lineups = _squad_lineups()
        home_lineup = home_lineup or squad_lineups.get((data.get("homeTeam") or {}).get("id"))
        away_lineup = away_lineup or squad_lineups.get((data.get("awayTeam") or {}).get("id"))

    note = None
    if not events:
        note = ("Lineups show each team's official squad. Minute-by-minute events "
                "and possession stats need a live data feed.")
    return {"match_id": match_id, "available": True, "source": "live",
            "timeline": events,
            "home_lineup": home_lineup,
            "away_lineup": away_lineup,
            "stats": stats, "referee": referee, "note": note}


# ------------------------------------------------------------------ demo

def _pick_player(rng: random.Random, players: List[dict], scorer: bool) -> Optional[dict]:
    if not players:
        return None
    weights = []
    for p in players:
        base = {"FW": 6, "MF": 3, "DF": 1, "GK": 0}.get(p["position"], 1)
        weights.append(base + (p.get("goals") or 0) if scorer else max(base, 1))
    if not any(weights):
        weights = [1] * len(players)
    return rng.choices(players, weights=weights, k=1)[0]


def _demo_goal_events(match_id: int, raw: dict, cap: int,
                      squads: Dict[str, List[dict]]) -> List[dict]:
    goals: List[Tuple[int, str]] = sorted(
        [(m, "home") for m in raw["goals_home"] if m <= cap]
        + [(m, "away") for m in raw["goals_away"] if m <= cap]
    )
    events, running = [], {"home": 0, "away": 0}
    for minute, side in goals:
        rng = random.Random(f"{match_id}:{side}:{minute}")
        scorer = _pick_player(rng, squads[side], scorer=True)
        others = [p for p in squads[side] if scorer and p["id"] != scorer["id"]]
        assist = _pick_player(rng, others, scorer=False) if rng.random() < 0.7 else None
        running[side] += 1
        events.append({
            "minute": minute, "type": "goal", "team": side,
            "player": scorer["name"] if scorer else None,
            "detail": assist["name"] if assist else None,
            "score": f"{running['home']} - {running['away']}",
        })
    return events


def _demo_card_events(match_id: int, cap: int,
                      squads: Dict[str, List[dict]]) -> List[dict]:
    rng = random.Random(f"{match_id}:cards")
    events = []
    for side in ("home", "away"):
        outfield = [p for p in squads[side] if p["position"] != "GK"] or squads[side]
        for _ in range(rng.randint(0, 3)):
            minute = rng.randint(15, 90)
            booked = _pick_player(rng, outfield, scorer=False)
            if minute <= cap and booked:
                events.append({"minute": minute, "type": "yellow", "team": side,
                               "player": booked["name"]})
        if rng.random() < 0.06 and outfield:
            minute = rng.randint(55, 90)
            sent_off = _pick_player(rng, outfield, scorer=False)
            if minute <= cap and sent_off:
                events.append({"minute": minute, "type": "red", "team": side,
                               "player": sent_off["name"]})
    return events


def _demo_stats(match_id: int, state: dict, cap: int,
                timeline: List[dict]) -> List[dict]:
    rng = random.Random(f"{match_id}:stats")
    ratings = {s: (state[s] or {}).get("rating", 78.0) for s in ("home", "away")}
    goals = {"home": state["home_score"] or 0, "away": state["away_score"] or 0}
    cards = {s: {"yellow": sum(1 for e in timeline if e["team"] == s and e["type"] == "yellow"),
                 "red": sum(1 for e in timeline if e["team"] == s and e["type"] == "red")}
             for s in ("home", "away")}
    progress = min(1.0, cap / 90)

    poss_home = round(min(68.0, max(32.0, 50 + (ratings["home"] - ratings["away"]) * 1.4 + rng.uniform(-5, 5))))
    possession = {"home": poss_home, "away": 100 - poss_home}
    rows: Dict[str, Dict[str, object]] = {}
    for side in ("home", "away"):
        shots = int((5 + possession[side] / 8 + goals[side] * 2 + rng.uniform(0, 4)) * progress)
        shots = max(shots, goals[side])
        on_target = min(shots, goals[side] + rng.randint(1, 4))
        yellows = cards[side]["yellow"]
        rows[side] = {
            "Shots": shots,
            "Shots on target": on_target,
            "Possession": f"{possession[side]}%",
            "Passes": int(possession[side] * rng.uniform(7.2, 8.6) * progress),
            "Pass accuracy": f"{int(min(92.0, max(62.0, 70 + (ratings[side] - 78) * 1.3 + rng.uniform(-3, 3))))}%",
            "Fouls": max(int(rng.randint(7, 16) * progress), yellows),
            "Yellow cards": yellows,
            "Red cards": cards[side]["red"],
            "Offsides": int(rng.randint(0, 4) * progress),
            "Corners": int(rng.randint(2, 9) * progress),
        }
    return [{"label": label, "home": str(rows["home"][label]), "away": str(rows["away"][label])}
            for label in rows["home"]]


def _demo_lineup(players: List[dict]) -> Optional[dict]:
    if not players:
        return None
    ordered = sorted(players, key=lambda p: _POSITION_ORDER.get(p["position"], 9))
    return {
        "formation": None,
        "coach": None,
        "starting": [{"name": p["name"], "position": p["position"], "shirt": None} for p in ordered],
        "bench": [],
        "is_full_xi": False,
    }


def _demo_details(match_id: int) -> Optional[dict]:
    raw = next((m for m in _load_fallback()["matches"] if m["id"] == match_id), None)
    state = next((m for m in _fallback_matches() if m["id"] == match_id), None)
    if not raw or not state or state["status"] not in ("LIVE", "HT", "FT"):
        return None
    cap = {"HT": 45, "FT": 90}.get(state["status"], state["minute"] or 1)

    all_players = _fallback_players()
    squads = {
        "home": [p for p in all_players if p["team_id"] == raw["home_id"]],
        "away": [p for p in all_players if p["team_id"] == raw["away_id"]],
    }
    timeline = sorted(
        _demo_goal_events(match_id, raw, cap, squads) + _demo_card_events(match_id, cap, squads),
        key=lambda e: e["minute"],
    )
    return {
        "match_id": match_id,
        "available": True,
        "source": "demo",
        "timeline": timeline,
        "home_lineup": _demo_lineup(squads["home"]),
        "away_lineup": _demo_lineup(squads["away"]),
        "stats": _demo_stats(match_id, state, cap, timeline),
        "referee": None,
        "note": "Demo data — connect a live API key for real match stats.",
    }


# ------------------------------------------------------------------ entry

def match_details(match_id: int) -> dict:
    if fd.enabled:
        return _live_details(match_id) or _unavailable(match_id, "live")
    return _demo_details(match_id) or _unavailable(match_id, "demo")
