"""football-data.org v4 client — primary live source for World Cup 2026.

The free tier includes the FIFA World Cup with live scores, standings and
full squads (players + coach) at 10 requests/minute. Every response is
cached (squads for a week, live matches for a minute); on quota or network
failure the most recent cached value keeps being served. When no
FOOTBALL_DATA_TOKEN is configured the client reports disabled and callers
fall back to the bundled demo dataset.
"""

import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx

from .cache import cache
from .venues import venue_for

log = logging.getLogger("matchiq.football_data")

BASE = "https://api.football-data.org/v4"
COMPETITION = "WC"

MATCHES_TTL = 60          # live scores
STANDINGS_TTL = 5 * 60
SCORERS_TTL = 30 * 60
SQUADS_TTL = 7 * 24 * 3600  # squads barely change mid-tournament

# our fallback names → football-data.org names (only where they differ)
_NAME_ALIASES = {
    "south korea": "korea republic",
    "usa": "united states",
    "united states": "usa",
    "iran": "ir iran",
    "ivory coast": "côte d'ivoire",
    "cape verde": "cabo verde",
    "turkey": "türkiye",
    "czech republic": "czechia",
}

# real qualifiers missing from the bundled demo roster — flags and Dixon-Coles
# ratings for teams we can't inherit from the fallback dataset
_TLA_FLAGS = {"SWE": "🇸🇪", "CZE": "🇨🇿", "BIH": "🇧🇦", "COD": "🇨🇩"}
_EXTRA_RATINGS = {"SWE": 84.0, "CZE": 80.0, "BIH": 78.0, "COD": 76.0}

_STATUS_MAP = {
    "SCHEDULED": "NS", "TIMED": "NS",
    "IN_PLAY": "LIVE", "PAUSED": "HT",
    "FINISHED": "FT", "AWARDED": "FT",
    "SUSPENDED": "TBD", "POSTPONED": "TBD", "CANCELLED": "TBD",
}


def _norm(name: str) -> str:
    return name.lower().strip()


def _position_code(position: Optional[str]) -> str:
    p = (position or "").lower()
    if "goal" in p:
        return "GK"
    if "back" in p or "defen" in p or "defence" in p:
        return "DF"
    if "midfield" in p:
        return "MF"
    return "FW"


def _age(date_of_birth: Optional[str]) -> Optional[int]:
    if not date_of_birth:
        return None
    try:
        dob = datetime.fromisoformat(date_of_birth.replace("Z", "+00:00"))
    except ValueError:
        return None
    today = datetime.now(timezone.utc)
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _pretty_stage(stage: Optional[str]) -> str:
    return (stage or "GROUP_STAGE").replace("_", " ").title()


class FootballData:
    def __init__(self):
        self.token = os.environ.get("FOOTBALL_DATA_TOKEN", "").strip()
        self._lock = threading.Lock()
        self._request_times: List[float] = []

    @property
    def enabled(self) -> bool:
        return bool(self.token)

    # ------------------------------------------------------------- plumbing

    def _budget_ok(self) -> bool:
        """Client-side guard for the 10 req/min free quota."""
        now = time.time()
        with self._lock:
            self._request_times = [t for t in self._request_times if now - t < 60]
            if len(self._request_times) >= 9:
                return False
            self._request_times.append(now)
            return True

    def _request(self, path: str, ttl: int) -> Optional[dict]:
        key = f"fd:{path}"
        cached = cache.get(key)
        if cached is not None:
            return cached
        if not self.enabled or not self._budget_ok():
            return cache.get(key, allow_stale=True)
        try:
            resp = httpx.get(
                f"{BASE}/{path}",
                headers={"X-Auth-Token": self.token},
                timeout=15,
            )
            if resp.status_code == 429:
                log.warning("football-data quota hit on %s — serving stale cache", path)
                return cache.get(key, allow_stale=True)
            resp.raise_for_status()
            data = resp.json()
            cache.set(key, data, ttl)
            return data
        except Exception as exc:
            log.warning("football-data request %s failed: %s", path, exc)
            return cache.get(key, allow_stale=True)

    # ------------------------------------------------------- team mapping

    def _group_letters(self) -> Dict[int, str]:
        """{fd_team_id: real group letter} straight from the live standings."""
        data = self._request(f"competitions/{COMPETITION}/standings", STANDINGS_TTL)
        out = {}
        for block in (data or {}).get("standings", []):
            if block.get("type") != "TOTAL":
                continue
            letter = (block.get("group") or "").replace("GROUP_", "").replace("Group ", "")
            for row in block.get("table", []):
                team_id = (row.get("team") or {}).get("id")
                if team_id:
                    out[team_id] = letter
        return out

    def _team_index(self, local_teams: List[dict]) -> Dict[int, dict]:
        """Maps football-data team id → our team dict (flag, REAL group, rating).

        Matched teams inherit flag + rating from the bundled roster but take
        their group from the live draw; real qualifiers missing from the
        bundle are synthesized.
        """
        data = self._request(f"competitions/{COMPETITION}/teams", SQUADS_TTL)
        if not data or not data.get("teams"):
            return {}
        groups = self._group_letters()
        by_code = {t["code"].upper(): t for t in local_teams}
        by_name = {_norm(t["name"]): t for t in local_teams}
        index = {}
        for fd in data["teams"]:
            tla = (fd.get("tla") or "").upper()
            name = _norm(fd.get("name") or "")
            short = _norm(fd.get("shortName") or "")
            local = (
                by_code.get(tla)
                or by_name.get(name)
                or by_name.get(short)
                or by_name.get(_NAME_ALIASES.get(name, ""))
                or by_name.get(_NAME_ALIASES.get(short, ""))
            )
            if local:
                index[fd["id"]] = {**local, "group": groups.get(fd["id"], local["group"])}
            else:
                log.info("no local mapping for football-data team %s (%s) — synthesizing", fd.get("name"), tla)
                index[fd["id"]] = {
                    "id": 10000 + fd["id"],
                    "name": fd.get("name") or "Unknown",
                    "code": tla or "TBD",
                    "flag": _TLA_FLAGS.get(tla, "🏳️"),
                    "group": groups.get(fd["id"], ""),
                    "rating": _EXTRA_RATINGS.get(tla, 78.0),
                }
        return index

    def teams(self, local_teams: List[dict]) -> Optional[List[dict]]:
        """The real 48-team field with live group letters, or None."""
        index = self._team_index(local_teams)
        if not index:
            return None
        return sorted(index.values(), key=lambda t: (t["group"], -t["rating"]))

    # ------------------------------------------------------------- matches

    def matches(self, local_teams: List[dict], ist_fmt) -> Optional[List[dict]]:
        data = self._request(f"competitions/{COMPETITION}/matches", MATCHES_TTL)
        if not data or not data.get("matches"):
            return None
        index = self._team_index(local_teams)
        out = []
        now = datetime.now(timezone.utc)
        for fx in data["matches"]:
            kickoff = datetime.fromisoformat(fx["utcDate"].replace("Z", "+00:00"))
            status = _STATUS_MAP.get(fx.get("status", ""), "NS")
            minute = None
            if status == "LIVE":
                elapsed = max(1, int((now - kickoff).total_seconds() // 60))
                minute = min(90, elapsed - 15 if elapsed > 60 else elapsed)
            elif status == "HT":
                minute = 45
            group = (fx.get("group") or "").replace("GROUP_", "").replace("Group ", "") or None
            score = fx.get("score", {}).get("fullTime", {})
            home = index.get((fx.get("homeTeam") or {}).get("id"))
            away = index.get((fx.get("awayTeam") or {}).get("id"))
            venue, city = venue_for(
                (home or {}).get("code"), (away or {}).get("code"), kickoff.isoformat()
            )
            out.append(
                {
                    "id": fx["id"],
                    "stage": _pretty_stage(fx.get("stage")),
                    "group": group,
                    "kickoff_utc": kickoff.isoformat(),
                    "kickoff_ist": ist_fmt(kickoff),
                    "venue": fx.get("venue") or venue,
                    "city": city or "TBC",
                    "status": status,
                    "minute": minute,
                    "home": home,
                    "away": away,
                    "home_score": score.get("home"),
                    "away_score": score.get("away"),
                }
            )
        return sorted(out, key=lambda m: m["kickoff_utc"])

    # ----------------------------------------------------------- standings

    def standings(self, local_teams: List[dict]) -> Optional[List[dict]]:
        data = self._request(f"competitions/{COMPETITION}/standings", STANDINGS_TTL)
        if not data or not data.get("standings"):
            return None
        index = self._team_index(local_teams)
        groups = []
        for block in data["standings"]:
            if block.get("type") != "TOTAL":
                continue
            letter = (block.get("group") or "").replace("GROUP_", "").replace("Group ", "")
            rows = []
            for row in block.get("table", []):
                team = index.get((row.get("team") or {}).get("id"))
                if not team:
                    continue
                form = [f for f in (row.get("form") or "").split(",") if f in ("W", "D", "L")]
                rows.append(
                    {
                        "group": letter,
                        "position": row["position"],
                        "team": team,
                        "played": row["playedGames"],
                        "won": row["won"],
                        "drawn": row["draw"],
                        "lost": row["lost"],
                        "goals_for": row["goalsFor"],
                        "goals_against": row["goalsAgainst"],
                        "goal_diff": row["goalDifference"],
                        "points": row["points"],
                        "form": form[-5:],
                    }
                )
            if rows:
                groups.append({"group": letter, "rows": rows})
        return sorted(groups, key=lambda g: g["group"]) or None

    # ------------------------------------------------------------- squads

    def _competition_squads(self) -> Optional[dict]:
        """The v4 competition teams payload includes coach + full squad per team."""
        data = self._request(f"competitions/{COMPETITION}/teams", SQUADS_TTL)
        if data and data.get("teams") and any(t.get("squad") for t in data["teams"]):
            return data
        return None

    def _team_detail(self, fd_team_id: int) -> Optional[dict]:
        return self._request(f"teams/{fd_team_id}", SQUADS_TTL)

    def _scorer_stats(self) -> Dict[int, dict]:
        data = self._request(f"competitions/{COMPETITION}/scorers?limit=200", SCORERS_TTL)
        stats = {}
        for s in (data or {}).get("scorers", []):
            pid = (s.get("player") or {}).get("id")
            if pid:
                stats[pid] = {
                    "goals": s.get("goals") or 0,
                    "assists": s.get("assists") or 0,
                    "played": s.get("playedMatches") or 0,
                }
        return stats

    def squads(self, local_teams: List[dict]) -> Optional[Dict[int, dict]]:
        """Returns {local_team_id: {"coach": {...} | None, "players": [...]}}."""
        index = self._team_index(local_teams)
        if not index:
            return None
        data = self._competition_squads()
        fd_teams = data["teams"] if data else None
        if fd_teams is None:
            # squads not embedded in the competition payload — fetch per team
            fd_teams = []
            for fd_id in index:
                detail = self._team_detail(fd_id)
                if detail and detail.get("squad"):
                    fd_teams.append(detail)
        if not fd_teams:
            return None

        scorer_stats = self._scorer_stats()
        out = {}
        for fd in fd_teams:
            local = index.get(fd["id"])
            if not local or not fd.get("squad"):
                continue
            coach = fd.get("coach") or {}
            players = []
            for p in fd["squad"]:
                stats = scorer_stats.get(p["id"], {})
                players.append(
                    {
                        "id": p["id"],
                        "name": p.get("name") or "Unknown",
                        "team_id": local["id"],
                        "position": _position_code(p.get("position")),
                        "role": p.get("position") or "",
                        "age": _age(p.get("dateOfBirth")) or 0,
                        "nationality": p.get("nationality"),
                        "date_of_birth": (p.get("dateOfBirth") or "")[:10] or None,
                        "goals": stats.get("goals", 0),
                        "assists": stats.get("assists", 0),
                        "xg": None,
                        "pass_accuracy": None,
                        "minutes": None,
                        "rating": None,
                    }
                )
            out[local["id"]] = {
                "coach": {
                    "name": coach.get("name"),
                    "nationality": coach.get("nationality"),
                    "age": _age(coach.get("dateOfBirth")),
                } if coach.get("name") else None,
                "players": players,
            }
        return out or None


fd = FootballData()
