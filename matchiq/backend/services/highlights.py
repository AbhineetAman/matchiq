"""Match highlights via official YouTube channel RSS feeds.

Strictly legal by construction: we never host, proxy or scrape video —
we match titles from official channels' public feeds and let the
frontend embed the videos with YouTube's own player (which respects
each video's embed/geo permissions). Keyless: channel RSS needs no API
key. Channels are configurable via HIGHLIGHT_CHANNEL_IDS (comma-sep).
"""

import logging
import os
import xml.etree.ElementTree as ET
from typing import Dict, List

import httpx

from .cache import cache

log = logging.getLogger("matchiq.highlights")

ATOM = "{http://www.w3.org/2005/Atom}"
YT = "{http://www.youtube.com/xml/schemas/2015}"
MEDIA = "{http://search.yahoo.com/mrss/}"

# FIFA's official channel; add broadcaster channels via env without redeploying code
DEFAULT_CHANNELS = "UCpcTrCXblq78GZrTUTLWeBw"
FEED = "https://www.youtube.com/feeds/videos.xml?channel_id={cid}"
FEED_TTL = 30 * 60
UA = {"User-Agent": "MatchIQ/1.0 (FIFA 2026 dashboard; highlights)"}

# our team names → alternate spellings used in official video titles
_TITLE_ALIASES = {
    "south korea": ["korea republic", "korea"],
    "usa": ["united states", "usa"],
    "turkey": ["turkiye", "türkiye"],
    "ivory coast": ["cote d'ivoire", "côte d'ivoire"],
    "iran": ["ir iran"],
    "cape verde": ["cabo verde"],
    "congo dr": ["dr congo", "congo dr"],
}


def _channel_ids() -> List[str]:
    raw = os.environ.get("HIGHLIGHT_CHANNEL_IDS", "").strip() or DEFAULT_CHANNELS
    return [c.strip() for c in raw.split(",") if c.strip()]


def _videos() -> List[dict]:
    out = []
    for cid in _channel_ids():
        key = f"ytfeed:{cid}"
        cached = cache.get(key)
        if cached is not None:
            out.extend(cached)
            continue
        try:
            resp = httpx.get(FEED.format(cid=cid), headers=UA, timeout=12, follow_redirects=True)
            resp.raise_for_status()
            root = ET.fromstring(resp.text)
            channel = (root.findtext(f"{ATOM}title") or "YouTube").strip()
            vids = []
            for e in root.findall(f"{ATOM}entry"):
                vid = e.findtext(f"{YT}videoId")
                title = (e.findtext(f"{ATOM}title") or "").strip()
                thumb = None
                group = e.find(f"{MEDIA}group")
                if group is not None:
                    t = group.find(f"{MEDIA}thumbnail")
                    if t is not None:
                        thumb = t.get("url")
                if vid and title:
                    vids.append(
                        {
                            "video_id": vid,
                            "title": title,
                            "thumbnail": thumb or f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                            "channel": channel,
                            "published": e.findtext(f"{ATOM}published"),
                            "url": f"https://www.youtube.com/watch?v={vid}",
                        }
                    )
            cache.set(key, vids, FEED_TTL)
            out.extend(vids)
        except Exception as exc:
            log.warning("feed %s failed: %s", cid, exc)
            stale = cache.get(key, allow_stale=True)
            if stale:
                out.extend(stale)
    return out


def _name_variants(team_name: str) -> List[str]:
    name = team_name.lower()
    return [name] + _TITLE_ALIASES.get(name, [])


def for_matches(matches: List[dict]) -> List[dict]:
    """Attach official videos to finished/live matches by title matching.

    A video belongs to a match when both team names (or aliases) appear in
    its title. 'Highlights' videos outrank single-goal clips.
    """
    videos = _videos()
    out = []
    for m in matches:
        if m["status"] not in ("FT", "LIVE", "HT") or not m["home"] or not m["away"]:
            continue
        home_v = _name_variants(m["home"]["name"])
        away_v = _name_variants(m["away"]["name"])
        hits = []
        for v in videos:
            t = v["title"].lower()
            if any(h in t for h in home_v) and any(a in t for a in away_v):
                hits.append(v)
        if not hits:
            continue
        hits.sort(key=lambda v: v["published"] or "", reverse=True)   # newest first…
        hits.sort(key=lambda v: "highlight" not in v["title"].lower())  # …but 'Highlights' outrank goal clips
        best = hits[0]
        out.append(
            {
                "match_id": m["id"],
                "home": m["home"]["name"],
                "away": m["away"]["name"],
                "videos": hits[:4],
                "best": best,
            }
        )
    return out
