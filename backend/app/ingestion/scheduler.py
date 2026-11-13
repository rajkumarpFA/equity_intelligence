"""Background scheduler for recurring data ingestion jobs."""

import logging
from typing import Any

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def get_scheduler() -> BackgroundScheduler:
    """Return the global BackgroundScheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(timezone="UTC")
    return _scheduler


def start_scheduler() -> None:
    """Start the background scheduler if not already running."""
    sched = get_scheduler()
    if not sched.running:
        sched.start()
        logger.info("APScheduler background scheduler started.")


def shutdown_scheduler() -> None:
    """Stop the background scheduler gracefully."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("APScheduler background scheduler stopped.")
        _scheduler = None


def register_eod_price_sync_job(sync_callable: Any) -> None:
    """Schedule daily EOD price sync after market close (11:00 UTC = 16:30 IST)."""
    sched = get_scheduler()
    sched.add_job(
        sync_callable,
        trigger=CronTrigger(hour=11, minute=0, day_of_week="mon-fri"),
        id="eod_price_sync",
        name="Daily EOD Price Candlestick Sync",
        replace_existing=True,
    )
    logger.info("Registered job: eod_price_sync (Mon-Fri 11:00 UTC / 16:30 IST)")


def list_scheduled_jobs() -> list[dict[str, Any]]:
    """List all currently registered background jobs."""
    sched = get_scheduler()
    jobs = []
    for job in sched.get_jobs():
        jobs.append(
            {
                "id": job.id,
                "name": job.name,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger),
            }
        )
    return jobs
