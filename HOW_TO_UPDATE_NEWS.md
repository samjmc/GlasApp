# 🚀 How to Update News & Scores

## Quick Start - ONE Command Does Everything!

```bash
npm run update-news
```

That's it! This single command will:

1. ✅ **Fetch latest news** from all 11 Irish sources
2. ✅ **Analyze articles** with AI to find TD mentions
3. ✅ **Score TD impacts** (transparency, integrity, effectiveness, etc.)
4. ✅ **Update all TD scores** and rankings
5. ✅ **Update party scores**
6. ✅ **Update personal rankings** for all users
7. ✅ **Clear caches** so feeds show fresh data immediately

## What Gets Updated

After running `npm run update-news`, all these will show fresh data:

- 📰 **Recent News Feed** - Latest articles from all sources
- 🎯 **Highest Impact Feed** - Articles with the most TD impacts
- 📅 **Today's Biggest Story** - Top story of the day
- 👤 **TD Profiles** - All TD scores and rankings updated
- 🎭 **Party Rankings** - Party aggregate scores
- ❤️ **Personal Rankings** - User-specific TD compatibility scores

## When to Run It

- **After adding new news sources** - Get articles from new sources
- **To refresh all data** - Get latest news and update all scores
- **Before important updates** - Ensure all data is current
- **Daily/Hourly** - Set up as scheduled task (see below)

## How Long Does It Take?

- **Fast**: 2-5 minutes (if few new articles)
- **Normal**: 5-15 minutes (typical daily run)
- **Slow**: 15-30 minutes (if many articles need full AI analysis)

## Scheduling (Optional)

### Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task: "Update Glas Politics News"
3. Trigger: Daily at 6:00 AM (or hourly)
4. Action: Start a program
5. Program: `C:\Program Files\nodejs\node.exe`
6. Arguments: `--loader tsx C:\path\to\project\server\jobs\masterNewsUpdate.ts`
7. Start in: Your project directory

### Manual Cron (if you add Node-Cron)

```typescript
// In server/index.ts
import cron from 'node-cron';
import { runMasterNewsUpdate } from './jobs/masterNewsUpdate';

// Run every hour
cron.schedule('0 * * * *', async () => {
  console.log('⏰ Running scheduled news update...');
  await runMasterNewsUpdate();
});
```

## Troubleshooting

### "No new articles found"
- ✅ Normal if run frequently
- ✅ Check news sources are online
- ✅ Check RSS feeds haven't changed

### "AI analysis failed"
- ✅ Check OpenAI/Anthropic API keys in `.env`
- ✅ Check API rate limits
- ✅ Articles will still be saved, just without AI analysis

### "Database connection failed"
- ✅ Check `.env` has correct `SUPABASE_SERVICE_ROLE_KEY`
- ✅ Check Supabase project isn't paused
- ✅ Check internet connection

### "Script takes too long"
- ✅ Reduce batch size in script (edit `batchSize: 100` to `batchSize: 50`)
- ✅ Disable cross-checking (already disabled by default)
- ✅ Run during off-peak hours

## Advanced: Individual Steps

If you want to run steps separately:

```bash
# Step 1: Fetch news only
npm run scrape-news

# Step 2: Score TDs only (for existing articles)
npm run td-scoring

# Step 3: Recalculate scores only
npm run recalc-scores
```

(Note: You'll need to add these scripts to package.json)

## What If Something Goes Wrong?

The script is designed to be **fault-tolerant**:
- ❌ If Step 1 fails → Steps 2-6 still run on existing articles
- ❌ If Step 2 fails → Scores still recalculated from existing data  
- ❌ If Step 3 fails → Personal rankings still update
- ✅ Errors are logged but don't stop the entire process

## Monitoring

Watch the console output for:
- ✅ Green checkmarks = Success
- ⚠️ Yellow warnings = Non-critical issues
- ❌ Red X's = Errors (but process continues)

At the end, you'll see a **complete summary** of:
- Articles processed
- TDs scored
- Scores updated
- Any errors encountered
- Total time taken

---

**🎉 Remember**: Just run `npm run update-news` and everything happens automatically!


