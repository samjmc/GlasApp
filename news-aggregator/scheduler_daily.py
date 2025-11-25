"""
Daily News Aggregator Scheduler
Runs the Irish politics news aggregator once per day
"""

import schedule
import time
import logging
from datetime import datetime
from run_aggregator import main as run_aggregator

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def job():
    """Run the aggregator"""
    logger.info("="*60)
    logger.info(f"DAILY NEWS AGGREGATION STARTING")
    logger.info(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("="*60)
    
    try:
        run_aggregator()
        logger.info("Daily aggregation completed successfully")
    except Exception as e:
        logger.error(f"Daily aggregation failed: {e}")
    
    logger.info("="*60 + "\n")

def start_daily_scheduler():
    """Start the daily scheduler"""
    logger.info("\n" + "="*60)
    logger.info("DAILY NEWS AGGREGATOR SCHEDULER STARTING")
    logger.info(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("Schedule: Every day at 8:00 AM")
    logger.info("="*60 + "\n")
    
    # Schedule job every day at 8 AM
    schedule.every().day.at("08:00").do(job)
    
    # Run immediately on startup
    logger.info("Running initial aggregation...")
    job()
    
    # Keep running
    logger.info("Scheduler is now running. Press Ctrl+C to stop.")
    logger.info("Next run: Tomorrow at 8:00 AM\n")
    
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute

if __name__ == "__main__":
    try:
        start_daily_scheduler()
    except KeyboardInterrupt:
        logger.info("\nScheduler stopped by user")
    except Exception as e:
        logger.error(f"Scheduler crashed: {e}")
























