"""
Hourly News Aggregator Scheduler
Runs the Irish politics news aggregator every hour
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
    logger.info(f"HOURLY NEWS AGGREGATION STARTING")
    logger.info(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("="*60)
    
    try:
        run_aggregator()
        logger.info("Hourly aggregation completed successfully")
    except Exception as e:
        logger.error(f"Hourly aggregation failed: {e}")
    
    logger.info("="*60 + "\n")

def start_hourly_scheduler():
    """Start the hourly scheduler"""
    logger.info("\n" + "="*60)
    logger.info("HOURLY NEWS AGGREGATOR SCHEDULER STARTING")
    logger.info(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("Schedule: Every hour at :00")
    logger.info("="*60 + "\n")
    
    # Schedule job every hour
    schedule.every().hour.at(":00").do(job)
    
    # Run immediately on startup
    logger.info("Running initial aggregation...")
    job()
    
    # Keep running
    logger.info("Scheduler is now running. Press Ctrl+C to stop.")
    logger.info("Next run: Every hour at :00\n")
    
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute

if __name__ == "__main__":
    try:
        start_hourly_scheduler()
    except KeyboardInterrupt:
        logger.info("\nScheduler stopped by user")
    except Exception as e:
        logger.error(f"Scheduler crashed: {e}")


