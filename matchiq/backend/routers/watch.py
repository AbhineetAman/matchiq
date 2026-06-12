"""Watch-live redirect (affiliate-ready) and official highlights.

Architecture notes:
- The frontend never carries partner URLs. The "Watch LIVE" button points
  at GET /go/live/{match_id}, which 302-redirects to the configured
  broadcaster page, optionally wrapped in an affiliate deep link. Swapping
  broadcaster or affiliate network is an env-var change — no redeploy of
  the frontend, no stale links in cached pages, and affiliate IDs stay out
  of the public repo.
- Every click is counted per match (see /api/watch/stats) so affiliate
  performance can be verified independently of the network's dashboard.
"""

import logging
import os
import urllib.parse

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from services import highlights
from services.cache import cache
from services.football_api import api

router = APIRouter(tags=["watch"])
log = logging.getLogger("matchiq.watch")

DEFAULT_WATCH_URL = "https://www.zee5.com/live-tv"
CLICKS_KEY = "watch_clicks"
CLICKS_TTL = 400 * 24 * 3600


def _target(match_id: int) -> str:
    base = os.environ.get("WATCH_URL", "").strip() or DEFAULT_WATCH_URL
    template = os.environ.get("AFFILIATE_URL_TEMPLATE", "").strip()
    if template:
        try:
            return template.format(url=urllib.parse.quote(base, safe=""), subid=f"match{match_id}")
        except (KeyError, IndexError, ValueError):
            log.warning("AFFILIATE_URL_TEMPLATE is malformed — redirecting directly")
    return base


@router.get("/go/live/{match_id}")
def watch_live(match_id: int):
    """302 to the official broadcaster (affiliate-wrapped when configured)."""
    if not any(m["id"] == match_id for m in api.matches()):
        raise HTTPException(status_code=404, detail="Unknown match")
    clicks = cache.get(CLICKS_KEY) or {}
    clicks[str(match_id)] = clicks.get(str(match_id), 0) + 1
    cache.set(CLICKS_KEY, clicks, CLICKS_TTL)
    return RedirectResponse(_target(match_id), status_code=302)


@router.get("/api/watch/stats")
def watch_stats():
    """Per-match watch-button clicks — your own affiliate attribution record."""
    return cache.get(CLICKS_KEY) or {}


@router.get("/api/highlights")
def match_highlights():
    """Official highlight/goal videos matched to finished & live matches."""
    return highlights.for_matches(api.matches())
