"""Pydantic models shared by all MatchIQ API routers."""

from typing import List, Optional

from pydantic import BaseModel


class Team(BaseModel):
    id: int
    name: str
    code: str
    flag: str
    group: str
    rating: float


class Match(BaseModel):
    id: int
    stage: str
    group: Optional[str] = None
    kickoff_utc: str
    kickoff_ist: str
    venue: str
    city: str
    status: str  # NS | LIVE | HT | FT | TBD
    minute: Optional[int] = None
    home: Optional[Team] = None
    away: Optional[Team] = None
    home_score: Optional[int] = None
    away_score: Optional[int] = None


class StandingRow(BaseModel):
    group: str
    position: int
    team: Team
    played: int
    won: int
    drawn: int
    lost: int
    goals_for: int
    goals_against: int
    goal_diff: int
    points: int
    form: List[str]


class GroupStandings(BaseModel):
    group: str
    rows: List[StandingRow]


class Player(BaseModel):
    id: int
    name: str
    team_id: int
    team_name: str
    team_flag: str
    position: str  # GK | DF | MF | FW
    role: Optional[str] = None  # detailed position from the live API
    age: int
    nationality: Optional[str] = None
    date_of_birth: Optional[str] = None
    goals: int
    assists: int
    # advanced metrics are only present in demo mode — the free live feed
    # does not provide them, and we never fabricate live stats
    xg: Optional[float] = None
    pass_accuracy: Optional[float] = None
    minutes: Optional[int] = None
    rating: Optional[float] = None
    form: List[str]


class Coach(BaseModel):
    name: str
    nationality: Optional[str] = None
    age: Optional[int] = None


class TeamSquad(BaseModel):
    team: Team
    coach: Optional[Coach] = None
    squad_size: int
    players: List[Player]


class ScorelineProb(BaseModel):
    home_goals: int
    away_goals: int
    probability: float


class Prediction(BaseModel):
    home: Team
    away: Team
    home_win: float
    draw: float
    away_win: float
    expected_home_goals: float
    expected_away_goals: float
    most_likely_score: str
    confidence: str  # LOW | MEDIUM | HIGH
    top_scorelines: List[ScorelineProb]


class SimulationTeamResult(BaseModel):
    team: Team
    champion_pct: float
    final_pct: float
    semifinal_pct: float


class SimulationResult(BaseModel):
    runs: int
    most_likely_champion: Team
    results: List[SimulationTeamResult]
