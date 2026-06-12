"""Venue lookup for live matches.

The football-data.org free feed has no stadium data, so venues come from
data/match_venues.json (built by scripts/build_venue_map.py from FIFA's
official schedule). Group matches resolve by team pair (each pairing is
unique), knockout slots by exact UTC kickoff.
"""

import json
import os
from typing import Optional, Tuple

_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "match_venues.json")
_by_pair = None
_by_utc = None


def _load():
    global _by_pair, _by_utc
    if _by_pair is not None:
        return
    _by_pair, _by_utc = {}, {}
    try:
        with open(_PATH, encoding="utf-8") as fh:
            entries = json.load(fh)
    except FileNotFoundError:
        return
    for e in entries:
        spot = (e["stadium"], e["city"])
        if e.get("codes") and len(e["codes"]) == 2:
            _by_pair[frozenset(e["codes"])] = spot
        if e.get("utc"):
            # only key collision-free instants — simultaneous kickoffs stay TBC
            _by_utc[e["utc"]] = None if e["utc"] in _by_utc else spot


def venue_for(home_code: Optional[str], away_code: Optional[str], kickoff_utc: str) -> Tuple[str, str]:
    _load()
    if home_code and away_code:
        spot = _by_pair.get(frozenset((home_code, away_code)))
        if spot:
            return spot
    spot = _by_utc.get(kickoff_utc)
    if spot:
        return spot
    return "TBC", ""
