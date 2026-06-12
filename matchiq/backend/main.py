"""MatchIQ — FIFA World Cup 2026 Intelligence Platform API."""

import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from routers import export, matches, news, players, predictions, standings  # noqa: E402
from services import scheduler  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    yield
    scheduler.stop()


app = FastAPI(
    title="MatchIQ API",
    description="FIFA World Cup 2026 live scores, standings, player stats, "
    "Dixon-Coles predictions and tournament simulations.",
    version="1.0.0",
    lifespan=lifespan,
)

_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["*"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(matches.router)
app.include_router(standings.router)
app.include_router(players.router)
app.include_router(predictions.router)
app.include_router(export.router)
app.include_router(news.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "service": "matchiq-api", "version": "1.0.0"}


@app.get("/", tags=["meta"])
def root():
    return {
        "service": "MatchIQ API",
        "docs": "/docs",
        "endpoints": [
            "/api/matches/live", "/api/matches/today", "/api/matches/{id}",
            "/api/standings", "/api/standings/{group}",
            "/api/teams", "/api/players", "/api/players/{id}",
            "/api/predictions/{home}/{away}", "/api/simulate",
            "/api/export/matches.csv", "/api/export/standings.csv", "/api/export/players.csv",
            "/api/news",
            "/health",
        ],
    }
