# Debate Premium Packages

| Package | Ideal For | What you get | Notes |
|---------|-----------|--------------|-------|
| **Insights Essentials** | Weekly stakeholder updates, newsletters | Influence & sentiment scoring, top TD / party movers, export-ready CSV snapshots | Uses `/api/debate-workspace/exports` with saved views. |
| **Newsroom Pro** | Editorial teams needing rapid alerts | Real-time monitoring dashboard, flip-flop alerts, shared partner workspace | Pair with `/api/debate-monitoring/summary` and `/api/debates/alerts`. |
| **Enterprise Watch** | Large partners and analysts | Dedicated data feeds, custom taxonomy, scheduled exports, SLA-backed support | Contact media@glas.ie for bespoke automation. |

All packages include:
- Weekly ingestion of Oireachtas debates across chambers
- Stance extraction & influence scoring (`npm run debates:metrics`)
- Debate outcome classification + effectiveness leaderboard (`npm run debates:outcomes`)
- Consistency alerts (`npm run debates:alerts`)
- Partner workspaces & export history (`/api/debate-workspace/*`)

Roadmap add-ons:
- Automated delivery to S3/GCS or email digests
- Audience reach modelling and narrative summaries
- Multi-LLM consensus scoring for critical debates
- Debate winner trend alerts & concessions trackers


