"""
APScheduler setup for CampusClout background jobs.

Jobs:
  - market_decay        : 03:00 UTC daily  — 2% cap decay for inactive users
  - rush_hour_start     : 21:00 local (UTC) — activate Rush Hour, broadcast notification
  - rush_hour_end       : 22:00 local (UTC) — deactivate Rush Hour
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

log = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="UTC")


async def _run_market_decay() -> None:
    from app.services.market_service import decay_inactive_users
    log.info("Running nightly market decay...")
    await decay_inactive_users()


async def _run_rush_hour_start() -> None:
    from app.ws.global_manager import global_chat_manager
    log.info("Rush Hour starting...")
    await global_chat_manager.set_rush_hour(True)
    # Broadcast push-style notification to all market-ticker WS clients
    from app.ws.manager import ws_manager
    await ws_manager.broadcast({
        "event": "push_notification",
        "title": "Rush Hour is live.",
        "body": "Earn 2x tokens in Campus Chat for the next hour. Claim your status.",
        "icon": "zap",
    })


async def _run_rush_hour_end() -> None:
    from app.ws.global_manager import global_chat_manager
    log.info("Rush Hour ending...")
    await global_chat_manager.set_rush_hour(False)


async def _run_rating_aggregation() -> None:
    from app.tasks.rating_aggregation import rating_aggregation_job
    log.info("Running rating aggregation...")
    await rating_aggregation_job()


async def _run_search_indexing() -> None:
    from app.tasks.search_indexing import search_indexing_job
    log.info("Running search index refresh...")
    await search_indexing_job()


async def _run_hot_profiles_update() -> None:
    from app.services.hot_profiles_service import calculate_all_hot_scores
    from app.core.database import async_session_factory
    log.info("Updating hot profiles scores...")
    async with async_session_factory() as db:
        result = await calculate_all_hot_scores(db)
        log.info(f"Updated {result['updated']} profiles, {result['failed']} failures")


def setup_scheduler() -> AsyncIOScheduler:
    scheduler.add_job(
        _run_market_decay,
        trigger=CronTrigger(hour=3, minute=0),
        id="market_decay",
        replace_existing=True,
        name="Nightly market cap decay",
    )
    scheduler.add_job(
        _run_rush_hour_start,
        trigger=CronTrigger(hour=21, minute=0),
        id="rush_hour_start",
        replace_existing=True,
        name="Rush Hour start",
    )
    scheduler.add_job(
        _run_rush_hour_end,
        trigger=CronTrigger(hour=22, minute=0),
        id="rush_hour_end",
        replace_existing=True,
        name="Rush Hour end",
    )
    scheduler.add_job(
        _run_rating_aggregation,
        trigger=CronTrigger(hour=2, minute=0),
        id="rating_aggregation",
        replace_existing=True,
        name="Rating aggregation",
    )
    scheduler.add_job(
        _run_search_indexing,
        trigger=CronTrigger(hour=4, minute=0),
        id="search_indexing",
        replace_existing=True,
        name="Search index refresh",
    )
    scheduler.add_job(
        _run_hot_profiles_update,
        trigger=CronTrigger(hour=2, minute=30),
        id="hot_profiles_update",
        replace_existing=True,
        name="Hot profiles scoring update",
    )
    return scheduler
