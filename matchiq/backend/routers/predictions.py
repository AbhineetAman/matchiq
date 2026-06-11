from fastapi import APIRouter, HTTPException, Query

from models.schemas import Prediction, SimulationResult
from services import poisson
from services.football_api import resolve_team

router = APIRouter(prefix="/api", tags=["predictions"])


@router.get("/predictions/{home}/{away}", response_model=Prediction)
def predict_match(home: str, away: str):
    """Dixon-Coles prediction. Teams accepted as id, 3-letter code, or name."""
    home_team = resolve_team(home)
    away_team = resolve_team(away)
    if not home_team:
        raise HTTPException(status_code=404, detail=f"Unknown team: {home}")
    if not away_team:
        raise HTTPException(status_code=404, detail=f"Unknown team: {away}")
    if home_team["id"] == away_team["id"]:
        raise HTTPException(status_code=400, detail="Pick two different teams")
    return poisson.predict(home_team, away_team)


@router.get("/simulate", response_model=SimulationResult)
def simulate(runs: int = Query(1000, ge=100, le=2000)):
    """Monte Carlo simulation of the full 48-team tournament."""
    return poisson.simulate_tournament(runs=runs)
