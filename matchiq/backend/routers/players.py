from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from models.schemas import Player, Team
from services.football_api import api, get_teams

router = APIRouter(prefix="/api", tags=["players"])


@router.get("/teams", response_model=List[Team])
def teams():
    return sorted(get_teams(), key=lambda t: (t["group"], -t["rating"]))


@router.get("/players", response_model=List[Player])
def players(
    team: Optional[int] = Query(None, description="Team id"),
    position: Optional[str] = Query(None, description="GK | DF | MF | FW"),
    search: Optional[str] = Query(None, description="Name substring"),
    sort: str = Query("rating", description="rating | goals | assists | xg"),
    limit: int = Query(200, le=500),
):
    items = api.players()
    if team:
        items = [p for p in items if p["team_id"] == team]
    if position:
        items = [p for p in items if p["position"] == position.upper()]
    if search:
        items = [p for p in items if search.lower() in p["name"].lower()]
    if sort in ("rating", "goals", "assists", "xg", "pass_accuracy"):
        items = sorted(items, key=lambda p: -p[sort])
    return items[:limit]


@router.get("/players/{player_id}", response_model=Player)
def player_detail(player_id: int):
    player = next((p for p in api.players() if p["id"] == player_id), None)
    if not player:
        raise HTTPException(status_code=404, detail=f"Player {player_id} not found")
    return player
