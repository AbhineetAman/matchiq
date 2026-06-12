"""Per-player card counts parsed from Wikipedia's live match pages.

The free football-data.org tier carries no bookings, but the per-group
Wikipedia articles list every lineup with {{yel|min}} and {{sent off|n|min}}
templates, updated by editors within minutes during matches — the same
source (and freshness) we already rely on for venues.

Output maps a diacritic-insensitive player-name key to card counts, which
football_api merges into player records.
"""

import logging
import re
import subprocess
import urllib.parse
from typing import Dict

from .cache import cache
from .photos import norm

log = logging.getLogger("matchiq.wiki_stats")

PAGES = [f"2026 FIFA World Cup Group {c}" for c in "ABCDEFGHIJKL"] + ["2026 FIFA World Cup knockout stage"]
CARDS_TTL = 20 * 60
UA = "MatchIQ/1.0 (FIFA 2026 dashboard; discipline stats)"

_YEL = re.compile(r"\{\{yel\|")
_RED = re.compile(r"\{\{sent off\|")
_FIRST_LINK = re.compile(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]")


def _fetch(page: str) -> str:
    url = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(page.replace(" ", "_")) + "?action=raw"
    out = subprocess.run(["curl", "-s", "-m", "25", "-A", UA, url], capture_output=True, text=True, check=True)
    return out.stdout or ""


def get_cards() -> Dict[str, dict]:
    cached = cache.get("wiki_cards")
    if cached is not None:
        return cached
    counts: Dict[str, dict] = {}
    failed = 0
    for page in PAGES:
        try:
            text = _fetch(page)
        except Exception as exc:
            log.warning("cards: %s failed: %s", page, exc)
            failed += 1
            continue
        for line in text.split("\n"):
            yellows = len(_YEL.findall(line))
            reds = len(_RED.findall(line))
            if not yellows and not reds:
                continue
            link = _FIRST_LINK.search(line)
            if not link:
                continue
            key = norm(link.group(1))
            entry = counts.setdefault(key, {"yellow": 0, "red": 0})
            entry["yellow"] += yellows
            entry["red"] += reds
    if counts or failed == 0:
        cache.set("wiki_cards", counts, CARDS_TTL)
        return counts
    return cache.get("wiki_cards", allow_stale=True) or {}


def cards_cached() -> Dict[str, dict]:
    """Read-only view for request paths — never triggers the 13-page fetch
    (the scheduler owns refreshing; see scheduler._refresh_cards)."""
    return cache.get("wiki_cards", allow_stale=True) or {}
