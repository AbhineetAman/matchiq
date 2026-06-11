import csv
import io

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from services.football_api import api

router = APIRouter(prefix="/api/export", tags=["export"])


def _csv_response(rows: list, fieldnames: list, filename: str) -> StreamingResponse:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/matches.csv")
def export_matches():
    rows = [
        {
            "match_id": m["id"],
            "stage": m["stage"],
            "group": m.get("group") or "",
            "kickoff_utc": m["kickoff_utc"],
            "kickoff_ist": m["kickoff_ist"],
            "home_team": m["home"]["name"] if m["home"] else "TBD",
            "away_team": m["away"]["name"] if m["away"] else "TBD",
            "status": m["status"],
            "home_score": m["home_score"] if m["home_score"] is not None else "",
            "away_score": m["away_score"] if m["away_score"] is not None else "",
            "venue": m["venue"],
            "city": m["city"],
        }
        for m in api.matches()
    ]
    return _csv_response(
        rows,
        ["match_id", "stage", "group", "kickoff_utc", "kickoff_ist", "home_team",
         "away_team", "status", "home_score", "away_score", "venue", "city"],
        "matchiq_matches.csv",
    )


@router.get("/standings.csv")
def export_standings():
    rows = [
        {
            "group": grp["group"],
            "position": r["position"],
            "team": r["team"]["name"],
            "played": r["played"],
            "won": r["won"],
            "drawn": r["drawn"],
            "lost": r["lost"],
            "goals_for": r["goals_for"],
            "goals_against": r["goals_against"],
            "goal_diff": r["goal_diff"],
            "points": r["points"],
        }
        for grp in api.standings()
        for r in grp["rows"]
    ]
    return _csv_response(
        rows,
        ["group", "position", "team", "played", "won", "drawn", "lost",
         "goals_for", "goals_against", "goal_diff", "points"],
        "matchiq_standings.csv",
    )


@router.get("/players.csv")
def export_players():
    rows = [
        {
            "player_id": p["id"],
            "name": p["name"],
            "team": p["team_name"],
            "position": p["position"],
            "age": p["age"],
            "goals": p["goals"],
            "assists": p["assists"],
            "xg": p["xg"],
            "pass_accuracy": p["pass_accuracy"],
            "minutes": p["minutes"],
            "rating": p["rating"],
        }
        for p in api.players()
    ]
    return _csv_response(
        rows,
        ["player_id", "name", "team", "position", "age", "goals", "assists",
         "xg", "pass_accuracy", "minutes", "rating"],
        "matchiq_players.csv",
    )
