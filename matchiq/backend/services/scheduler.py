"""Background refresh jobs. Active when a live-data credential is configured
(FOOTBALL_DATA_TOKEN or RAPIDAPI_KEY) — without one there is nothing to poll,
the fallback dataset is always fresh.
"""

import logging
import os
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler

from .football_api import api

log = logging.getLogger("matchiq.scheduler")
scheduler = BackgroundScheduler(daemon=True)


def _refresh_live():
    try:
        matches = api.live_matches()
        log.info("refreshed live matches: %d in play", len(matches))
    except Exception as exc:
        log.warning("live refresh failed: %s", exc)


def _refresh_slow():
    try:
        api.matches()
        api.standings()
        log.info("refreshed fixtures and standings")
    except Exception as exc:
        log.warning("slow refresh failed: %s", exc)


def _refresh_squads():
    try:
        squads = api.squads()
        if squads:
            total = sum(len(s["players"]) for s in squads.values())
            log.info("refreshed squads: %d teams, %d players", len(squads), total)
    except Exception as exc:
        log.warning("squad refresh failed: %s", exc)


def _refresh_cards():
    try:
        from .wiki_stats import get_cards
        cards = get_cards()
        log.info("refreshed discipline stats: %d carded players", len(cards))
    except Exception as exc:
        log.warning("cards refresh failed: %s", exc)


def start():
    has_fd = bool(os.environ.get("FOOTBALL_DATA_TOKEN", "").strip())
    has_rapid = bool(os.environ.get("RAPIDAPI_KEY", "").strip())
    if not (has_fd or has_rapid):
        log.info("no live-data credential set — scheduler idle, serving fallback data")
        return
    scheduler.add_job(_refresh_live, "interval", minutes=1, id="live")
    scheduler.add_job(_refresh_slow, "interval", minutes=15, id="slow")
    scheduler.add_job(_refresh_squads, "interval", hours=12, id="squads",
                      next_run_time=datetime.now())
    scheduler.add_job(_refresh_cards, "interval", minutes=20, id="cards",
                      next_run_time=datetime.now())
    scheduler.start()
    log.info("scheduler started (live: 2 min, slow: 15 min, squads: 12 h) — source: %s",
             "football-data.org" if has_fd else "api-football")


def stop():
    if scheduler.running:
        scheduler.shutdown(wait=False)
