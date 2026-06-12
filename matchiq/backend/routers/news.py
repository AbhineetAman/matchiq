from fastapi import APIRouter

from models.schemas import NewsFeed
from services import news

router = APIRouter(prefix="/api", tags=["news"])


@router.get("/news", response_model=NewsFeed)
def tournament_buzz():
    """Latest World Cup headlines (Google News) + hottest fan discussions (Reddit)."""
    return news.get_feed()
