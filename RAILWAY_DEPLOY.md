# Deploying to Railway

You can deploy this project to [Railway.app](https://railway.app) easily. Railway will automatically detect that this is a Node.js application and run it.

## Prerequisites

1.  **GitHub Account**: You need to push this code to a GitHub repository.
2.  **Railway Account**: Sign up at [railway.app](https://railway.app).

## Step 1: Prepare Your Code

We have already updated the server code to respect the `PORT` environment variable (required by Railway).

## Step 2: Push to GitHub

I have already initialized the git repository and committed your files locally. Now you just need to connect it to GitHub.

1.  Go to **GitHub.com** and create a **New Repository**.
2.  Copy the URL of your new repository (e.g., `https://github.com/yourname/glas-politics.git`).
3.  Run these 3 commands in your terminal:

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

## Step 3: Deploy on Railway

1.  **New Project**: Go to your Railway dashboard and click "New Project".
2.  **Deploy from GitHub Repo**: Select "Deploy from GitHub repo" and choose your repository.
3.  **Add Variables**: Before the deployment finishes (or right after), go to the **Variables** tab in your Railway project.
4.  **Add Environment Variables**:
    You need to copy the keys from your `.env` file. **Do not copy the file itself**, just the values.
    
    Add these specific variables:
    *   `DATABASE_URL`: Your Supabase connection string (or use Railway's PostgreSQL plugin).
    *   `SUPABASE_URL`: Your Supabase URL.
    *   `SUPABASE_SERVICE_KEY`: Your Supabase service key.
    *   `OPENAI_API_KEY`: Your OpenAI key.
    *   `NODE_ENV`: Set this to `production`.

5.  **Domain**:
    *   Go to the **Settings** tab.
    *   Under "Networking", click "Generate Domain". This will give you a public URL (e.g., `glas-politics-production.up.railway.app`).

## Step 4: Automate Daily Updates (Cron Job)

Since you need to update news daily, you don't need a separate server. You can use a service like **Cron-Job.org** (free) to trigger your update endpoint.

1.  Go to [cron-job.org](https://cron-job.org).
2.  Create a new Cron Job.
3.  **URL**: `https://YOUR-RAILWAY-URL.up.railway.app/api/admin/news-scraper/run`
4.  **Method**: `POST`
5.  **Schedule**: Every day at 09:00.

Now your site will run 24/7 on Railway, and the external cron job will trigger the news update every morning!

