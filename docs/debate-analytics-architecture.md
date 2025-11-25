# Debate Analytics Architecture (Draft)

## Objectives

- Capture full Oireachtas Dáil debate transcripts (sections, speeches, metadata) in Supabase for long-term analysis.
- Derive per-TD debate analytics (engagement, stance consistency, issue focus) that can feed existing scoring models.
- Surface user-facing insights through a new `/debates` experience and enriched TD profiles.
- Support premium features (dual-LLM verification, partner dashboards, alerts/export flows).

## Data Flow Overview

1. **Ingestion Job**
   - Run `scripts/fetch-oireachtas-debate-week.ts` (to be promoted to `server/jobs/debatesWeeklyIngest.ts`).
   - Parameters: `start_date`, `end_date`, `chamber` (default `dail`), `save_to_supabase=true`.
   - Responsibilities:
     - Fetch debate listing (with pagination) via `/debates` endpoint.
     - Download debate XML (`formats.xml.uri`), parse sections/speeches.
     - Upsert raw XML (blob storage) and structured data into Supabase tables.
     - Queue LLM summarisation tasks for new sections (via Supabase `debate_section_tasks`).
  - Summaries currently use dual OpenAI prompts (consensus from two variants). Anthropic can be added later if needed.
  - After summaries land, run `scripts/calc-debate-metrics.ts --start <week_start> --end <week_end>` to populate `td_debate_metrics` + `td_issue_focus`. For automation, use:
    - `npm run debates:metrics` (defaults to last 7 days)
    - `npm run debates:outcomes` (LLM verdicts + concessions per section)
    - `npm run debates:highlights` (narratives w/ winner storytelling)
    - `npm run debates:party-aggregation`
    - `npm run debates:alerts`
    - `npm run debates:monitor`
  - Partner exports leverage the `/api/debate-workspace` endpoints (saved filters + CSV generation).
   - QA endpoints: `GET /api/debates/review?max_confidence=0.75` (low-confidence summaries) and `GET /api/debates/tasks/status` (task counts).

2. **Processing / AI Layer**
   - **Summarisation**: Use OpenAI `gpt-4o-mini` (fast pass) + Anthropic Claude 3 Haiku; reconcile with `debate_summary_results` storing both outputs + consensus summary + confidence.
   - **Stance Extraction**: prompt for issue stance, actor, polarity; results stored per speech in `debate_speech_stances`.
   - **Topic Modelling**: assign standard Glas taxonomy topics; store in `debate_topics`.
   - **Aggregation**: nightly job rolls up per TD metrics (time spoken, stance shifts) into `td_debate_metrics`/`td_issue_focus`.

3. **Serving Layer**
   - API endpoints (Express/Node) to read from Supabase via MCP-provided pooled connections.
   - Cached responses via existing DataGateway patterns (respecting metrics/logging decorators).
   - Frontend consumes new endpoints for `/debates`, TD profile enhancements, premium dashboards.

## Proposed Supabase Schema

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `debate_days` | One row per debate record (per chamber/date). | `id (uuid)`, `chamber`, `date`, `title`, `source_xml_uri`, `supabase_storage_path`, `section_count`, `speech_count`, `word_count`, `ingested_at` |
| `debate_sections` | Structured sections within a debate | `id`, `debate_day_id`, `section_code`, `title`, `debate_type`, `recorded_time`, `parent_section_id`, `contains_debate`, `speech_count`, `word_count` |
| `debate_speeches` | Individual speech blocks | `id`, `section_id`, `speaker_id` (FK to TD table or Oireachtas member), `speaker_name`, `role_name`, `recorded_time`, `paragraphs` (jsonb array), `word_count` |
| `debate_section_summaries` | AI-generated summaries per section | `id`, `section_id`, `summary_primary`, `summary_secondary`, `consensus_summary`, `confidence`, `model_primary`, `model_secondary`, `status`, `created_at` |
| `debate_speech_stances` | Extracted stances from speeches | `id`, `speech_id`, `topic`, `position`, `sentiment`, `certainty`, `evidence_span` |
| `td_debate_metrics` | Per TD rollups (daily or weekly granularity) | `id`, `td_id`, `period_start`, `period_end`, `speeches`, `words_spoken`, `unique_topics`, `sentiment_score`, `influence_score`, `effectiveness_score`, `engagement_score`, `leadership_score`, `metadata` |
| `td_issue_focus` | Normalised topic distribution per TD | `id`, `td_id`, `topic`, `period_start`, `period_end`, `minutes_spoken`, `percentage`, `trend_vs_prev` |
| `debate_alerts` | Alerts destined for premium users (flip-flop, high activity) | `id`, `td_id`, `alert_type`, `payload`, `confidence`, `status`, `created_at` |
| `debate_saved_views` | Partner/analyst saved filter presets | `id`, `name`, `filters (jsonb)`, `created_by`, `updated_at` |
| `debate_exports` | Export history (CSV snapshots) | `id`, `view_id`, `status`, `metadata`, `created_at`, `completed_at` |
| `debate_section_outcomes` | LLM-classified section verdicts | `id`, `section_id`, `debate_day_id`, `winner_td_id`, `runner_up_td_id`, `outcome`, `confidence`, `concessions`, `narrative`, `metadata` |

### Supporting Entities

- `debate_section_tasks` (queue status for summarisation/stance extraction jobs).
- `debate_audio_assets` (future-proofing for audio/video references).

## TD Score Integration

1. **Engagement Weighting**: integrate `td_debate_metrics.engagement_score` (normalised speaking time + intervention quality) into existing TD composite score.
2. **Consistency Penalty/Bonus**: use `stance_shift_score` to adjust reliability metrics (penalise frequent contradicting stances, reward consistency).
3. **Issue Focus Overlay**: surface `td_issue_focus` in UI and use to highlight expertise for scoring tooltips.
4. **Leaderboard Enhancements**: add “Debate Leader” badge for top quartile engagement over trailing 30 days.

## Premium Feature Implementation Notes

- **Dual-model verification**: store both model outputs + diff; confidence = agreement score + retrieval validation.
- **Dashboard UX**: configure saved filters (topics, TD groups) stored per user in existing Supabase user settings.
- **Exports**: server generates CSV/PDF from Supabase views using cached data; respects rate limits.
- **Alerts**: triggered by Supabase functions (or scheduled job) evaluating new metrics; deliver via email/push.
- **Debate outcome engine**: `debate_section_outcomes` feeds the effectiveness index so the UI can highlight winners vs. volume speakers (effectiveness leaderboard, TD trend cards, narrative highlights).

## Validation & Testing Strategy

1. **Unit tests** for XML parser & Supabase insertions (using mock DB). Ensure deterministic parsing of sample week.
2. **Integration tests** hitting Supabase via MCP, verifying transactions and row counts.
3. **LLM pipeline QA**: golden summaries + stance outputs for sampled sections cross-reviewed manually.
4. **Frontend QA**: add Cypress or Playwright flow to ensure `/debates` loads with data once API ready.
5. **Monitoring**: log ingestion duration, track tokens used, raise alert on summarisation failure.

## Open Questions

- Mapping Oireachtas member IDs -> Glas TD IDs (reuses existing mapping? needs refresh for past TDs?).
- Storage of raw XML: Supabase storage vs. existing blob store? (default: Supabase storage bucket `debates/raw`).
- Historical backfill strategy: ingest full 33rd Dáil gradually, chunked by month with rate-limit guard.

---

_Draft prepared to guide implementation of the premium debate analytics rollout._


