"""Background refresh jobs. Only active when a RAPIDAPI_KEY is configured —
without a key there is nothing to poll, the fallback dataset is always fresh.
"""

import logging
import os

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


def start():
    if not os.environ.get("RAPIDAPI_KEY", "").strip():
        log.info("RAPIDAPI_KEY not set — scheduler idle, serving fallback data")
        return
    scheduler.add_job(_refresh_live, "interval", minutes=5, id="live")
    scheduler.add_job(_refresh_slow, "interval", minutes=30, id="slow")
    scheduler.start()
    log.info("scheduler started (live: 5 min, slow: 30 min)")


def stop():
    if scheduler.running:
        scheduler.shutdown(wait=False)
