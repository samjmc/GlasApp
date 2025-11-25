# 🤖 Automatic News Scheduler Setup Guide

## Quick Setup (Recommended - 2 Minutes)

### Step 1: Run the Setup Script
1. Navigate to the `news-aggregator` folder
2. **Right-click** on `SETUP_AUTOMATIC_SCHEDULER.ps1`
3. Select **"Run with PowerShell"** or **"Run as Administrator"**
4. Follow the prompts

That's it! The scheduler will now run automatically every time Windows starts.

---

## What Gets Set Up

The setup script creates a Windows Task Scheduler task that:

✅ **Starts automatically** when Windows boots  
✅ **Runs every hour** at :00 (1:00 PM, 2:00 PM, etc.)  
✅ **Fetches fresh articles** from Irish news sources  
✅ **Filters for political relevance** using AI  
✅ **Scores and saves** articles to your database  
✅ **Generates AI images** for top articles  

---

## Managing the Scheduler

### View Status
1. Press `Windows + R`
2. Type `taskschd.msc` and press Enter
3. Look for **"Glas Politics - Hourly News Aggregator"**
4. You can see when it last ran and when it will run next

### Start Manually
- Right-click the task → **Run**

### Stop Temporarily
- Right-click the task → **End** (stops current run)
- Right-click the task → **Disable** (stops future runs)

### Re-enable
- Right-click the task → **Enable**

### Delete Completely
- Right-click the task → **Delete**

---

## Troubleshooting

### Script won't run - "Execution policy"
If you get an error about execution policy:

1. Open PowerShell as Administrator
2. Run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
3. Type `Y` to confirm
4. Try running the setup script again

### Task shows "Running" but nothing happens
Check the task history:
1. Open Task Scheduler
2. Find the task
3. Click the "History" tab
4. Look for errors

### Want to see the logs
The scheduler outputs to console, but when running as a scheduled task, you won't see it. To see logs:

Run manually in PowerShell:
```powershell
cd "C:\Users\samuel.mcdonnell\OneDrive - Real World Analytics\Documents\Glas Politics\Glas-Politics-main\news-aggregator"
py scheduler.py
```

---

## Cost Estimates

### Hourly Updates (24/7)
- **Per run**: ~$0.50-1.00
- **Per day**: ~$12-24
- **Per month**: ~$360-720

### Daily Updates (Once per day)
If hourly is too expensive, you can modify the task to run once daily:
1. Open Task Scheduler
2. Find the task → Properties
3. Triggers tab → Edit
4. Change from "At startup" to "Daily" at your preferred time
5. **Per month**: ~$15-30

---

## Alternative: Manual Updates

If you prefer to control when it runs:

### Option A: Double-click the batch file
Just double-click `START_NEWS_SCHEDULER.bat` when you want to start it

### Option B: Run on demand
Keep the scheduled task disabled, and manually run it when needed from Task Scheduler

---

## Files Created

- `SETUP_AUTOMATIC_SCHEDULER.ps1` - Setup script (this creates the task)
- `START_NEWS_SCHEDULER.bat` - Manual start script (optional)
- Windows Task Scheduler entry: "Glas Politics - Hourly News Aggregator"

---

## Next Steps

1. ✅ Run the setup script
2. ✅ Verify task is created in Task Scheduler
3. ✅ Test by running manually once
4. ✅ Check your database has new articles
5. ✅ View on your website

**Your news feed will now stay fresh automatically!** 🎉























