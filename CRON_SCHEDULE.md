# Glas Politics Cron Job Schedule

## Overview

This document defines the recommended cron schedule for all background jobs. Jobs are organized by frequency and dependency order.

---

## 🌐 HTTP Endpoints for cron-job.org

Your production server exposes these endpoints that cron-job.org can hit:

| Endpoint | Method | Purpose | Frequency |
|----------|--------|---------|-----------|
| `/api/admin/news-scraper/run` | POST | Full news scrape + AI analysis + TD scoring | Every 6 hours |
| `/api/admin/parliamentary/update` | POST | Fetch Oireachtas debates & votes | Daily |
| `/api/admin/debates/pipeline` | POST | Process debate embeddings | Daily |
| `/api/admin/debates/extract-stances` | POST | Extract policy positions for Politician Clone | Daily |
| `/api/admin/debates/review-feedback` | POST | Self-Correction: Review negative feedback & flag errors | Weekly |
| `/api/parliamentary/scores/trigger-scrape` | POST | Quick news scrape (lighter) | Hourly |

### cron-job.org Setup

1. **Base URL**: `https://your-domain.com` (your deployed server)
2. **Method**: POST
3. **Headers**: Add auth if needed (e.g., `Authorization: Bearer YOUR_SECRET`)

### Recommended Schedule in cron-job.org

| Job Name | URL | Schedule |
|----------|-----|----------|
| News Scraper | `/api/admin/news-scraper/run` | `0 0,6,12,18 * * *` (4x daily) |
| Parliamentary Update | `/api/admin/parliamentary/update` | `0 5 * * *` (daily 5 AM) |
| Debate Pipeline | `/api/admin/debates/pipeline` | `0 6 * * *` (daily 6 AM) |
| Stance Extraction | `/api/admin/debates/extract-stances?limit=20` | `0 7 * * *` (daily 7 AM) |
| Feedback Review | `/api/admin/debates/review-feedback` | `0 9 * * 1` (Monday 9 AM) |

---

## 🕐 Recommended Schedule (CLI Commands)

### Every Hour
| Job | Command | Time | Purpose |
|-----|---------|------|---------|
| TD Scoring | `npx tsx server/jobs/hourlyTDScoring.ts` | `:15` past each hour | Process unscored news articles → update TD ELO scores |

```bash
# Crontab (Linux/Mac) or Task Scheduler (Windows)
15 * * * * cd /path/to/project && npx tsx server/jobs/hourlyTDScoring.ts >> logs/hourly-scoring.log 2>&1
```

---

### Every 6 Hours
| Job | Command | Time | Purpose |
|-----|---------|------|---------|
| News Scraper | `npx tsx server/jobs/dailyNewsScraper.ts` | 6:00, 12:00, 18:00, 00:00 | Scrape Irish news, AI analysis, score TDs |
| Debate Embeddings | `npx tsx server/jobs/processDebateEmbeddings.ts` | 6:30, 12:30, 18:30, 00:30 | Chunk & embed new debate speeches for RAG |

```bash
# News scraping (4x daily)
0 0,6,12,18 * * * cd /path/to/project && npx tsx server/jobs/dailyNewsScraper.ts >> logs/news-scraper.log 2>&1

# Debate embeddings (after new debates are fetched)
30 0,6,12,18 * * * cd /path/to/project && npx tsx server/jobs/processDebateEmbeddings.ts >> logs/debate-embeddings.log 2>&1
```

---

### Daily
| Job | Command | Time | Purpose |
|-----|---------|------|---------|
| Debate Fetcher | `npx tsx server/jobs/dailyDebateUpdate.ts` | 05:00 | Fetch new Oireachtas debates (last 2 weeks) |
| Vote Fetcher | `npx tsx server/jobs/dailyVoteFetcher.ts` | 05:30 | Fetch new Dáil votes |
| Ideology Snapshot | `npx tsx server/jobs/dailyIdeologySnapshot.ts` | 06:00 | Snapshot TD ideology profiles for trends |
| **Stance Extraction** | `npx tsx server/jobs/extractPoliticianStances.ts` | 07:00 | **NEW** - Extract policy positions for Politician Clone |

```bash
# Daily debate fetch (5 AM)
0 5 * * * cd /path/to/project && npx tsx server/jobs/dailyDebateUpdate.ts >> logs/debate-update.log 2>&1

# Daily vote fetch (5:30 AM)
30 5 * * * cd /path/to/project && npx tsx server/jobs/dailyVoteFetcher.ts >> logs/vote-fetch.log 2>&1

# Ideology snapshot (6 AM)
0 6 * * * cd /path/to/project && npx tsx server/jobs/dailyIdeologySnapshot.ts >> logs/ideology-snapshot.log 2>&1

# Stance extraction for Politician Clone (7 AM, after embeddings are fresh)
0 7 * * * cd /path/to/project && npx tsx server/jobs/extractPoliticianStances.ts >> logs/stance-extraction.log 2>&1
```

---

### Weekly
| Job | Command | Time | Purpose |
|-----|---------|------|---------|
| Full Score Recalc | `npx tsx server/jobs/recalculateAllScores.ts` | Sunday 03:00 | Recalculate all TD scores from scratch |
| Unified Scores | `npx tsx server/jobs/unifiedScoreCalculationJob.ts` | Sunday 04:00 | Regenerate unified TD leaderboard |

```bash
# Weekly full recalculation (Sunday 3 AM)
0 3 * * 0 cd /path/to/project && npx tsx server/jobs/recalculateAllScores.ts >> logs/full-recalc.log 2>&1

# Unified scores (Sunday 4 AM)
0 4 * * 0 cd /path/to/project && npx tsx server/jobs/unifiedScoreCalculationJob.ts >> logs/unified-scores.log 2>&1
```

---

### Monthly
| Job | Command | Time | Purpose |
|-----|---------|------|---------|
| Promise Verification | `npx tsx server/jobs/promiseVerificationJob.ts` | 1st of month, 04:00 | Verify if political promises were delivered |

```bash
# Promise verification (1st of month at 4 AM)
0 4 1 * * cd /path/to/project && npx tsx server/jobs/promiseVerificationJob.ts >> logs/promise-verification.log 2>&1
```

---

## 📊 Dependency Graph

```
                    ┌─────────────────┐
                    │  05:00 Daily    │
                    │ Debate Fetcher  │
                    └────────┬────────┘
                             │
                             ▼
┌─────────────────┐  ┌─────────────────┐
│  05:30 Daily    │  │  06:30 6-hourly │
│  Vote Fetcher   │  │ Debate Embeddings│
└────────┬────────┘  └────────┬────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│  06:00 Daily    │  │  07:00 Daily    │
│Ideology Snapshot│  │Stance Extraction │
└─────────────────┘  └────────┬────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Ask TD Chat   │
                    │ (uses positions)│
                    └─────────────────┘

┌─────────────────┐
│ 6-hourly News   │
│    Scraper      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Hourly :15     │
│   TD Scoring    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  TD Leaderboard │
│    (live)       │
└─────────────────┘
```

---

## 🖥️ Windows Task Scheduler

For Windows, create scheduled tasks:

### PowerShell Script Example (`run-job.ps1`)
```powershell
param([string]$JobName)

$ProjectPath = "C:\Users\samuel.mcdonnell\OneDrive - Real World Analytics\Documents\Glas Politics\Glas-Politics-main"
$LogPath = "$ProjectPath\logs"

# Ensure log directory exists
if (!(Test-Path $LogPath)) { New-Item -ItemType Directory -Path $LogPath }

$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$LogFile = "$LogPath\$JobName-$Timestamp.log"

Set-Location $ProjectPath
npx tsx "server/jobs/$JobName.ts" *> $LogFile
```

### Task Scheduler Commands
```powershell
# Create tasks (run as Admin)
schtasks /create /tn "GlasPolitics-HourlyScoring" /tr "powershell -File run-job.ps1 -JobName hourlyTDScoring" /sc hourly /mo 1 /st 00:15
schtasks /create /tn "GlasPolitics-DailyDebates" /tr "powershell -File run-job.ps1 -JobName dailyDebateUpdate" /sc daily /st 05:00
schtasks /create /tn "GlasPolitics-DailyStances" /tr "powershell -File run-job.ps1 -JobName extractPoliticianStances" /sc daily /st 07:00
schtasks /create /tn "GlasPolitics-NewsScraper" /tr "powershell -File run-job.ps1 -JobName dailyNewsScraper" /sc daily /st 06:00
```

---

## 🔧 Environment Variables

Ensure these are set in your `.env` or system environment:

```bash
# Required for all jobs
SUPABASE_URL=https://ospxqnxlotakujloltqy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_key
OPENAI_API_KEY=your_openai_key

# Optional tuning
NEWS_LOOKBACK_HOURS=48          # How far back to scrape news
ENABLE_PROMISE_TRACKING=true    # Enable promise verification
```

---

## 📝 Job Descriptions

### Core Data Pipeline
| Job | Description |
|-----|-------------|
| `dailyDebateUpdate.ts` | Fetches new Oireachtas debates from the API, saves speeches to `debate_speeches` |
| `dailyVoteFetcher.ts` | Fetches Dáil division votes, saves to `td_votes` |
| `processDebateEmbeddings.ts` | Chunks debate speeches and generates OpenAI embeddings for RAG search |

### Scoring & Analysis
| Job | Description |
|-----|-------------|
| `dailyNewsScraper.ts` | Scrapes Irish news sources, AI extracts TD mentions, analyzes sentiment/impact |
| `hourlyTDScoring.ts` | Processes unscored articles, updates TD ELO ratings |
| `dailyIdeologySnapshot.ts` | Snapshots TD ideology profiles for historical tracking |
| `unifiedScoreCalculationJob.ts` | Combines all scoring dimensions into unified leaderboard |

### Politician Clone (NEW)
| Job | Description |
|-----|-------------|
| `extractPoliticianStances.ts` | **NEW** - LLM extracts policy positions from debate chunks, populates `policy_positions` table for structured memory |

### Verification
| Job | Description |
|-----|-------------|
| `promiseVerificationJob.ts` | Checks if tracked political promises were delivered, adjusts scores accordingly |

---

## 🚀 Quick Start

Run all jobs manually to populate data:

```bash
# 1. Fetch debates (if not already populated)
npx tsx server/jobs/dailyDebateUpdate.ts

# 2. Generate embeddings
npx tsx server/jobs/processDebateEmbeddings.ts

# 3. Extract stances for Politician Clone
npx tsx server/jobs/extractPoliticianStances.ts

# 4. Scrape news
npx tsx server/jobs/dailyNewsScraper.ts

# 5. Score TDs
npx tsx server/jobs/hourlyTDScoring.ts
```

---

## 📊 Monitoring

Check job health by querying the database:

```sql
-- Last stance extraction
SELECT politician_id, COUNT(*) as positions, MAX(updated_at) as last_update
FROM policy_positions
GROUP BY politician_id
ORDER BY last_update DESC;

-- Last debate embeddings
SELECT COUNT(*) as chunks, MAX(created_at) as last_chunk
FROM debate_chunks;

-- Unprocessed news articles
SELECT COUNT(*) as unprocessed
FROM news_articles
WHERE processed = false OR score_applied = false;
```

