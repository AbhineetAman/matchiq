"""Data layer for MatchIQ.

Primary source: API-Football via RapidAPI (free tier, 100 req/day).
Every response is cached (see cache.py). When RAPIDAPI_KEY is missing,
the quota is hit, or the request fails, the service transparently falls
back to data/fallback_data.json so the dashboard always renders.

The fallback dataset stores each match's full-time score as a list of
goal minutes; live status and partial scores are derived from the clock
at request time, so the demo always shows "live" matches without an API key.
"""

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import httpx

from .cache import LIVE_TTL, SLOW_TTL, cache
from .football_data import fd

RAPIDAPI_HOST = "api-football-v1.p.rapidapi.com"
WORLD_CUP_LEAGUE_ID = 1
SEASON = 2026
IST = timezone(timedelta(hours=5, minutes=30))

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "fallback_data.json")
_fallback: Optional[dict] = None


# ---------------------------------------------------------------- fallback

def _load_fallback() -> dict:
    global _fallback
    if _fallback is None:
        with open(_DATA_PATH, "r", encoding="utf-8") as fh:
            _fallback = json.load(fh)
    return _fallback


def get_teams() -> List[dict]:
    return _load_fallback()["teams"]


def get_team(team_id: int) -> Optional[dict]:
    return next((t for t in get_teams() if t["id"] == team_id), None)


def _team_by_code(code: str) -> Optional[dict]:
    code = code.upper()
    return next((t for t in get_teams() if t["code"] == code), None)


def resolve_team(ref: str) -> Optional[dict]:
    """Accepts a numeric id, a 3-letter code, or a team name."""
    if ref.isdigit():
        return get_team(int(ref))
    found = _team_by_code(ref)
    if found:
        return found
    ref_low = ref.lower()
    return next((t for t in get_teams() if t["name"].lower() == ref_low), None)


def _to_ist(dt: datetime) -> str:
    return dt.astimezone(IST).strftime("%Y-%m-%d %H:%M IST")


def _derive_state(kickoff: datetime, now: datetime, goals_home: List[int], goals_away: List[int]):
    """Returns (status, minute, home_score, away_score) for a fallback match."""
    elapsed = (now - kickoff).total_seconds() / 60.0
    if elapsed < 0:
        return "NS", None, None, None
    if elapsed < 45:
        minute = max(1, int(elapsed))
    elif elapsed < 60:  # half-time interval
        status_minute = 45
        return "HT", status_minute, _score_at(goals_home, 45), _score_at(goals_away, 45)
    elif elapsed < 110:
        minute = min(90, int(elapsed) - 15)
    else:
        return "FT", 90, len(goals_home), len(goals_away)
    return "LIVE", minute, _score_at(goals_home, minute), _score_at(goals_away, minute)


def _score_at(goal_minutes: List[int], minute: int) -> int:
    return sum(1 for g in goal_minutes if g <= minute)


def _fallback_matches(now: Optional[datetime] = None) -> List[dict]:
    now = now or datetime.now(timezone.utc)
    teams = {t["id"]: t for t in get_teams()}
    out = []
    for m in _load_fallback()["matches"]:
        kickoff = datetime.fromisoformat(m["kickoff_utc"])
        home = teams.get(m["home_id"]) if m["home_id"] else None
        away = teams.get(m["away_id"]) if m["away_id"] else None
        if home and away:
            status, minute, hs, as_ = _derive_state(kickoff, now, m["goals_home"], m["goals_away"])
        else:
            status, minute, hs, as_ = "TBD", None, None, None
        out.append(
            {
                "id": m["id"],
                "stage": m["stage"],
                "group": m.get("group"),
                "kickoff_utc": m["kickoff_utc"],
                "kickoff_ist": _to_ist(kickoff),
                "venue": m["venue"],
                "city": m["city"],
                "status": status,
                "minute": minute,
                "home": home,
                "away": away,
                "home_score": hs,
                "away_score": as_,
            }
        )
    return out


def _fallback_standings() -> List[dict]:
    matches = _fallback_matches()
    table: Dict[int, dict] = {}
    for t in get_teams():
        table[t["id"]] = {
            "group": t["group"], "team": t, "played": 0, "won": 0, "drawn": 0, "lost": 0,
            "goals_for": 0, "goals_against": 0, "goal_diff": 0, "points": 0, "form": [],
        }
    for m in sorted(matches, key=lambda x: x["kickoff_utc"]):
        if m["status"] != "FT" or not m["group"]:
            continue
        h, a = table[m["home"]["id"]], table[m["away"]["id"]]
        hs, as_ = m["home_score"], m["away_score"]
        for row, gf, ga in ((h, hs, as_), (a, as_, hs)):
            row["played"] += 1
            row["goals_for"] += gf
            row["goals_against"] += ga
            row["goal_diff"] = row["goals_for"] - row["goals_against"]
        if hs > as_:
            h["won"] += 1; a["lost"] += 1; h["points"] += 3
            h["form"].append("W"); a["form"].append("L")
        elif hs < as_:
            a["won"] += 1; h["lost"] += 1; a["points"] += 3
            a["form"].append("W"); h["form"].append("L")
        else:
            h["drawn"] += 1; a["drawn"] += 1; h["points"] += 1; a["points"] += 1
            h["form"].append("D"); a["form"].append("D")

    groups: Dict[str, List[dict]] = {}
    for row in table.values():
        groups.setdefault(row["group"], []).append(row)
    out = []
    for letter in sorted(groups):
        rows = sorted(
            groups[letter],
            key=lambda r: (-r["points"], -r["goal_diff"], -r["goals_for"], r["team"]["name"]),
        )
        out.append(
            {
                "group": letter,
                "rows": [
                    {**{k: v for k, v in r.items()}, "position": i + 1, "form": r["form"][-5:]}
                    for i, r in enumerate(rows)
                ],
            }
        )
    return out


def _fallback_players() -> List[dict]:
    teams = {t["id"]: t for t in get_teams()}
    team_form = {
        row["team"]["id"]: row["form"]
        for grp in _fallback_standings()
        for row in grp["rows"]
    }
    out = []
    for p in _load_fallback()["players"]:
        team = teams[p["team_id"]]
        out.append(
            {
                **p,
                "team_name": team["name"],
                "team_flag": team["flag"],
                "form": team_form.get(p["team_id"], []),
            }
        )
    return out


# ---------------------------------------------------------------- live API

class FootballAPI:
    def __init__(self):
        self.api_key = os.environ.get("RAPIDAPI_KEY", "").strip()

    def _request(self, path: str, params: dict, ttl: int) -> Optional[dict]:
        key = f"apifootball:{path}:{json.dumps(params, sort_keys=True)}"
        cached = cache.get(key)
        if cached is not None:
            return cached
        if not self.api_key:
            return None
        try:
            resp = httpx.get(
                f"https://{RAPIDAPI_HOST}/v3/{path}",
                params=params,
                headers={"x-rapidapi-key": self.api_key, "x-rapidapi-host": RAPIDAPI_HOST},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("errors"):  # quota exhausted or bad request
                return cache.get(key, allow_stale=True)
            cache.set(key, data, ttl)
            return data
        except Exception:
            return cache.get(key, allow_stale=True)

    def _transform_fixture(self, fx: dict) -> dict:
        kickoff = datetime.fromisoformat(fx["fixture"]["date"].replace("Z", "+00:00"))
        short = fx["fixture"]["status"]["short"]
        status = {"NS": "NS", "TBD": "TBD", "1H": "LIVE", "2H": "LIVE", "ET": "LIVE",
                  "P": "LIVE", "HT": "HT", "FT": "FT", "AET": "FT", "PEN": "FT"}.get(short, "NS")
        def side(name):
            api_team = fx["teams"][name]
            local = _team_by_code((api_team.get("code") or "")[:3]) or {
                "id": api_team["id"], "name": api_team["name"], "code": (api_team.get("code") or "TBD"),
                "flag": "🏳️", "group": fx["league"].get("round", ""), "rating": 78.0,
            }
            return local
        return {
            "id": fx["fixture"]["id"],
            "stage": fx["league"].get("round", "Group Stage"),
            "group": None,
            "kickoff_utc": kickoff.isoformat(),
            "kickoff_ist": _to_ist(kickoff),
            "venue": (fx["fixture"].get("venue") or {}).get("name") or "TBC",
            "city": (fx["fixture"].get("venue") or {}).get("city") or "TBC",
            "status": status,
            "minute": fx["fixture"]["status"].get("elapsed"),
            "home": side("home"),
            "away": side("away"),
            "home_score": fx["goals"]["home"],
            "away_score": fx["goals"]["away"],
        }

    def live_matches(self) -> List[dict]:
        if fd.enabled:
            live = fd.matches(get_teams(), _to_ist)
            if live is not None:
                return [m for m in live if m["status"] in ("LIVE", "HT")]
        data = self._request("fixtures", {"league": WORLD_CUP_LEAGUE_ID, "season": SEASON, "live": "all"}, LIVE_TTL)
        if data and data.get("response"):
            return [self._transform_fixture(fx) for fx in data["response"]]
        return [m for m in _fallback_matches() if m["status"] in ("LIVE", "HT")]

    def matches(self) -> List[dict]:
        if fd.enabled:
            live = fd.matches(get_teams(), _to_ist)
            if live is not None:
                return live
        data = self._request("fixtures", {"league": WORLD_CUP_LEAGUE_ID, "season": SEASON}, SLOW_TTL)
        if data and data.get("response"):
            return sorted((self._transform_fixture(fx) for fx in data["response"]), key=lambda m: m["kickoff_utc"])
        return _fallback_matches()

    def standings(self) -> List[dict]:
        if fd.enabled:
            live = fd.standings(get_teams())
            if live is not None:
                return live
        return _fallback_standings()

    def _team_form(self) -> Dict[int, List[str]]:
        return {
            row["team"]["id"]: row["form"]
            for grp in self.standings()
            for row in grp["rows"]
        }

    def squads(self) -> Optional[Dict[int, dict]]:
        """{local_team_id: {"coach", "players"}} from the live API, or None."""
        if fd.enabled:
            return fd.squads(get_teams())
        return None

    def players(self) -> List[dict]:
        squads = self.squads()
        if squads:
            teams = {t["id"]: t for t in get_teams()}
            form = self._team_form()
            out = []
            for team_id, squad in squads.items():
                team = teams.get(team_id) or {"name": "Unknown", "flag": "🏳️"}
                for p in squad["players"]:
                    out.append(
                        {
                            **p,
                            "team_name": team["name"],
                            "team_flag": team["flag"],
                            "form": form.get(team_id, []),
                        }
                    )
            if out:
                return out
        return _fallback_players()


api = FootballAPI()
