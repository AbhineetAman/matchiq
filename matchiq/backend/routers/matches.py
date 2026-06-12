from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from models.schemas import Match, MatchDetails
from services.football_api import IST, api
from services.match_details import match_details as build_match_details

router = APIRouter(prefix="/api/matches", tags=["matches"])


@router.get("/live", response_model=List[Match])
def live_matches():
    return api.live_matches()


@router.get("/today", response_model=List[Match])
def today_matches():
    """Today's matches, where 'today' is the IST calendar day."""
    today_ist = datetime.now(IST).date()
    return [
        m for m in api.matches()
        if datetime.fromisoformat(m["kickoff_utc"]).astimezone(IST).date() == today_ist
    ]


@router.get("", response_model=List[Match])
def all_matches(
    group: Optional[str] = Query(None, description="Group letter A-L"),
    stage: Optional[str] = Query(None, description="Substring match on stage name"),
    window: Optional[str] = Query(None, description="today | week"),
):
    matches = api.matches()
    if group:
        matches = [m for m in matches if (m.get("group") or "").upper() == group.upper()]
    if stage:
        matches = [m for m in matches if stage.lower() in m["stage"].lower()]
    if window:
        now_ist = datetime.now(IST)
        if window == "today":
            matches = [
                m for m in matches
                if datetime.fromisoformat(m["kickoff_utc"]).astimezone(IST).date() == now_ist.date()
            ]
        elif window == "week":
            end = now_ist + timedelta(days=7)
            matches = [
                m for m in matches
                if now_ist.date() <= datetime.fromisoformat(m["kickoff_utc"]).astimezone(IST).date() <= end.date()
            ]
    return matches


@router.get("/{match_id}/details", response_model=MatchDetails)
def match_details(match_id: int):
    """Timeline, lineups and team stats for a played (or in-play) match."""
    return build_match_details(match_id)


@router.get("/{match_id}", response_model=Match)
def match_detail(match_id: int):
    match = next((m for m in api.matches() if m["id"] == match_id), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"Match {match_id} not found")
    return match
