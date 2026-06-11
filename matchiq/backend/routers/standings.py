from typing import List

from fastapi import APIRouter, HTTPException

from models.schemas import GroupStandings
from services.football_api import api

router = APIRouter(prefix="/api/standings", tags=["standings"])


@router.get("", response_model=List[GroupStandings])
def all_standings():
    return api.standings()


@router.get("/{group}", response_model=GroupStandings)
def group_standings(group: str):
    found = next((g for g in api.standings() if g["group"].upper() == group.upper()), None)
    if not found:
        raise HTTPException(status_code=404, detail=f"Group {group.upper()} not found")
    return found
