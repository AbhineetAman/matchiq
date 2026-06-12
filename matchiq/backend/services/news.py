"""Tournament news & discussion feed.

Two free, keyless sources, both cached and both optional:
- Google News RSS for World Cup headlines
- Reddit r/soccer hot threads for fan discussion / trending topics

Either source failing (network, rate limit, cloud-IP blocks) just drops
that half of the payload — the endpoint itself never errors.
"""

import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import List

import httpx

from .cache import cache

log = logging.getLogger("matchiq.news")

NEWS_TTL = 10 * 60
UA = {"User-Agent": "MatchIQ/1.0 (FIFA 2026 dashboard; news panel)"}

GOOGLE_NEWS_RSS = (
    "https://news.google.com/rss/search?q=%22world+cup%22+2026+football"
    "&hl=en-IN&gl=IN&ceid=IN:en"
)
REDDIT_HOT_RSS = "https://www.reddit.com/r/soccer/hot.rss?limit=40"
_ATOM = "{http://www.w3.org/2005/Atom}"

_WC_PATTERN = re.compile(r"world cup|wc ?2026|fifa", re.I)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _google_news() -> List[dict]:
    resp = httpx.get(GOOGLE_NEWS_RSS, headers=UA, timeout=12, follow_redirects=True)
    resp.raise_for_status()
    root = ET.fromstring(resp.text)
    items = []
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        source = (item.findtext("source") or "").strip()
        pub = item.findtext("pubDate")
        if not title or not link:
            continue
        published = None
        if pub:
            try:
                published = _iso(parsedate_to_datetime(pub))
            except (ValueError, TypeError):
                pass
        items.append({"title": title, "url": link, "source": source or "Google News", "published": published})
        if len(items) >= 10:
            break
    return items


def _reddit_hot() -> List[dict]:
    """Reddit blocks anonymous JSON (403) but still serves the Atom RSS feed.
    RSS carries no vote counts, so score/comments stay 0 and the UI hides them."""
    resp = httpx.get(REDDIT_HOT_RSS, headers=UA, timeout=12, follow_redirects=True)
    resp.raise_for_status()
    root = ET.fromstring(resp.text)
    posts = []
    for entry in root.iter(f"{_ATOM}entry"):
        title = (entry.findtext(f"{_ATOM}title") or "").strip()
        link_el = entry.find(f"{_ATOM}link")
        url = link_el.get("href") if link_el is not None else ""
        updated = entry.findtext(f"{_ATOM}updated")
        if not title or not url:
            continue
        posts.append(
            {
                "title": title,
                "url": url,
                "score": 0,
                "comments": 0,
                "subreddit": "r/soccer",
                "relevant": bool(_WC_PATTERN.search(title)),
                "published": updated,
            }
        )
    relevant = [p for p in posts if p["relevant"]]
    rest = [p for p in posts if not p["relevant"]]
    picked = (relevant + rest)[:10]
    for p in picked:
        p.pop("relevant", None)
    return picked


def _trending_topics(titles: List[str]) -> List[dict]:
    """Counts team & star-player mentions across all headlines — the panel's
    'what is everyone talking about' chips, recomputed every refresh."""
    from .football_api import get_teams  # late import to avoid cycles

    blob = " ".join(titles).lower()
    counts = {}
    for t in get_teams():
        names = {t["name"].lower()}
        if t["name"] == "South Korea":
            names.add("korea")
        if t["name"] == "USA":
            names.update(("united states", "usa"))
        n = sum(blob.count(name) for name in names)
        if n:
            counts[f"{t['flag']} {t['name']}"] = n
    try:
        from .football_api import api
        scorers = [p for p in api.players() if (p.get("goals") or 0) > 0]
        for p in scorers[:40]:
            last = p["name"].split()[-1].lower()
            if len(last) >= 4:
                n = blob.count(last)
                if n:
                    counts[f"⚽ {p['name']}"] = n
    except Exception:
        pass
    top = sorted(counts.items(), key=lambda kv: -kv[1])[:10]
    return [{"topic": k, "count": v} for k, v in top]


def get_feed() -> dict:
    cached = cache.get("newsfeed")
    if cached is not None:
        return cached
    news, discussions = [], []
    try:
        news = _google_news()
    except Exception as exc:
        log.warning("google news fetch failed: %s", exc)
    try:
        discussions = _reddit_hot()
    except Exception as exc:
        log.warning("reddit fetch failed: %s", exc)
    feed = {
        "updated_at": _iso(datetime.now(timezone.utc)),
        "news": news,
        "discussions": discussions,
        "topics": _trending_topics([n["title"] for n in news] + [d["title"] for d in discussions]),
    }
    if news or discussions:
        cache.set("newsfeed", feed, NEWS_TTL)
    else:
        stale = cache.get("newsfeed", allow_stale=True)
        if stale:
            return stale
    return feed
