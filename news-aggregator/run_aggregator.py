#!/usr/bin/env python3
"""
Run Irish Political News Aggregator
Can be run manually or scheduled via cron/Task Scheduler
"""

import sys
import os
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from irish_politics_aggregator import main

if __name__ == '__main__':
    print("🇮🇪 Starting Glas Politics News Aggregator...")
    main()


