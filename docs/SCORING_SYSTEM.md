# TD Scoring System

## Overview

The Glas Score keeps every TD on a **0-100 scale** with percentile-aware benchmarks so the system adapts as activity levels change.

---

## 📊 Glas Score (0-100)

We blend four pillars, each backed by measurable signals:

| Pillar | Weight | Purpose | Primary data |
| --- | --- | --- | --- |
| **Impact** | **50%** | Captures national resonance across news and debates | `article_td_scores`, `td_debate_running_scores`, debate highlights |
| **Effectiveness** | **25%** | Measures delivery inside Leinster House | Parliamentary extracts (questions, attendance, bills), `td_debate_metrics` |
| **Constituency Service** | **15%** | Tracks local focus and responsiveness | Local question tagging, clinics/casework feeds, constituency news |
| **Engagement & Transparency** | **10%** | Rates openness, reliability, and accessibility | Attendance %, disclosure signals, `td_debate_metrics.engagement_score` |

```
Glas Score =
  (Impact × 50%) +
  (Effectiveness × 25%) +
  (Constituency Service × 15%) +
  (Engagement & Transparency × 10%)
```

Each pillar is a weighted mix of sub-metrics (documented below). All sub-scores are clamped to 0–100 and use exponential decay so recent activity counts most.

---

## 🎯 Pillar Details

### 1. Impact (50%)

**Goal:** quantify how strongly a TD shapes the national conversation.

| Sub-metric | Weight | How it works |
| --- | --- | --- |
| **News impact & sentiment** | 60% | Rolling 90-day aggregation of the `impact_score`, sentiment, and source credibility from `article_td_scores`. Uses exponential decay (≈90 day half-life) and clamps to a 0–100 range. |
| **Debate influence & outcomes** | 40% | Combines `td_debate_running_scores.performance_score` and influence deltas, with logistic compression so one big debate doesn’t overly spike the score. Recent highlight metadata is surfaced in the UI. |

Fallbacks: if one feed is missing we lean on the other; no data defaults to 50 so inactive TDs aren’t penalised unfairly. Confidence badges surface coverage gaps.

---

### 2. Effectiveness (25%)

**Goal:** reward TDs who deliver tangible output and turn up prepared.

| Sub-metric | Weight | Details |
| --- | --- | --- |
| **Parliamentary activity** | 60% | Relative percentile of questions volume, attendance %, committee work, and bill sponsorships. Bills: primary sponsorship counts 3×, co-sponsor 1×. Attendance ≥95% caps at 100; TDs with no legislative activity cap at 70 even with perfect attendance. |
| **Debate effectiveness** | 40% | Pulls from `td_debate_metrics.effectiveness_score`, adjusted for recency. Captures clarity, topic leadership, and measurable outcomes flagged by the debate analytics pipeline. |

---

### 3. Constituency Service (15%)

**Goal:** spotlight TDs who champion their constituents.

| Sub-metric | Weight | Details |
| --- | --- | --- |
| **Constituency service delivery** | 70% | Ratio of local vs national questions plus clinics/casework completion rates (where available). Normalised against constituency peers. |
| **Local impact coverage** | 30% | Media and debate items classified as constituency-focused (`constituency_service_news_score`). Applies decay so recent local wins matter more. |

When structured clinic/casework feeds are absent we surface a confidence warning and fall back to local question analysis.

---

### 4. Engagement & Transparency (10%)

**Goal:** reflect accessibility, openness, and consistency.

| Sub-metric | Weight | Details |
| --- | --- | --- |
| **Transparency & openness** | 35% | Uses declaration status, expenses disclosures, and verified statements. Defaults to 50 with “low confidence” if data isn’t available. |
| **Parliamentary attendance** | 40% | Vote participation relative to chamber median. Non-voting ministers are automatically adjusted to avoid false negatives. |
| **Debate engagement** | 25% | Latest `td_debate_metrics.engagement_score` blended with words spoken and topic diversity. Again uses decay so stale activity fades. |

---

## 👁️ Transparency & Confidence

- API responses include the **pillar score**, **weight**, and a sub-metric **breakdown list** so the UI can show “What moved your score?” callouts.
- A **confidence flag** (0–1) counts available data sources: news, parliamentary, constituency, trust. Missing feeds trigger neutral defaults and UI badges.
- If a pillar doesn’t have enough evidence yet, it returns `null`/N/A, and the remaining pillar weights are re-normalised when calculating the Glas Score.
- Legacy consumers still receive the ELO fields, and we expose a `legacy_elo` block for backward compatibility.

---

## 📈 Score Bands

| Score | Label | Interpretation |
| --- | --- | --- |
| 85–100 | Excellent | Leading across all pillars |
| 70–84 | Very Good | Strong performance with minor gaps |
| 55–69 | Good | Solid but with noticeable weaknesses |
| 40–54 | Average | Typical TD performance |
| <40 | Needs Work | Limited evidence of delivery or engagement |

---

## 🔄 Update Frequency

1. **News ingestion & analysis** – daily (automated job → `article_td_scores`)
2. **Debate analytics** – nightly; recomputes `td_debate_*` tables
3. **Parliamentary extract refresh** – weekly Oireachtas ETL
4. **Glas Score recompute** – triggered after each ingest cycle or on demand (`/api/parliamentary/scores/recalculate`)

---

## 🧭 Current Status (November 2025)

- ✅ 174 active TDs tracked
- ✅ Weekly parliamentary ETL live (questions, votes, bills, committees)
- ✅ Debate analytics streaming from Oireachtas transcripts
- ⚠️ Constituency clinics/casework still limited for some TDs (confidence badge displayed)
- 🚧 Public trust module (user ratings) slated for a later release – currently defaulted to neutral 50 within transparency calculations

Our guiding principles remain:

- **Relative**: percentile aware so performance is compared to peers.
- **Data-driven**: every score maps to a stored fact (with provenance).
- **Transparent**: we ship the math to the UI, not just the answer.




