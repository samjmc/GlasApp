## Ideology Matching Blueprint

### Overview

We’re moving from ad-hoc affinity signals (5-star TD ratings, binary policy votes) to a structured ideological coordinate system that lets us:

1. Track a user’s political identity across eight axes, updated continuously.
2. Map TDs and parties onto the same axes from news impacts and debate stances.
3. Score alignment via simple distance metrics, powering personal rankings and recommendations.

### Ideological Axes

We’ll use eight canonical directions, normalized to a -10 → +10 range (negative = progressive/globalist/libertarian; positive = conservative/nationalist/authoritarian):

- **Economic** (market vs collective)
- **Social** (traditional vs progressive)
- **Cultural** (nationalism vs multiculturalism)
- **Authority** (authoritarian vs libertarian)
- **Environmental** (pro-business vs pro-climate)
- **Welfare** (increase welfare vs decrease welfare)
- **Globalism** (global integration vs national preservation)
- **Technocratic** (expert-led vs populist)

### Data Model Changes

#### Users

- New table `user_ideology_profiles` (user_id PK/fk, eight float columns, updated_at).
- Optional history table `user_ideology_history` (user_id, recorded_at, 8D snapshot).
- Bridge existing `user_policy_vote_responses` → ideology impacts via mapping table (policy vote option → 8D vector).
- Provide stable view API for UI: `/api/users/me/ideology` returning current vector and confidence (votes count).

#### TDs & Parties

- Extend `unified_td_scores` (or create separate `td_ideology_profiles`) with eight float columns.
- Add `td_ideology_history` to track per-article/per-debate shifts and allow auditing.
- New `party_ideology_profiles` table (party_id, 8D vector averaged from members).
- History table optional initially; nightly aggregation job composes party vectors from member snapshots.

### Signal Mapping Strategy

#### Policy Vote Responses

- For each `policy_vote_opportunity`, define metadata:
  - Primary domain/topic (already captured).
  - Ideology vector delta for each answer option (e.g. “Yes” on foreign aid → `[-1, +2, …]`), stored alongside `answer_options`.
- On vote upsert:
  - Fetch option vector.
  - Update user profile by combining existing vector with new input.
  - Implementation options:
    - **Incremental:** running weighted average using `n_votes` count per dimension.
    - **Batch:** store raw responses and recompute nightly.
  - Recommend incremental approach with smoothing: `new_value = clamp(old_value + learning_rate * option_delta, -10, 10)`.

- Need mapping definitions for:
  - Government vs opposition stances per domain.
  - Confidence multipliers (if LLM indicates question confidence < 0.6, halve delta).

#### News & Debate Stances

- Extend `PolicyStanceHarvester` to produce ideology dimension impacts:
  - Use LLM prompt to classify stance along the eight axes with confidence.
  - Persist per stance (article_id, td_id, dimension, delta, confidence).
- For news scoring:
  - When `AINewsAnalysisService` determines an impact, also request ideological shift.
  - Map positive/negative news impact to ideological deltas (e.g. progressive policy criticism nudges TD rightward).
- Debate transcripts:
  - Harvest statements, classify stance, and apply to TD vectors.

- Aggregation logic:
  - Each TD vector update is a weighted blend:
    - `delta = base_delta * stance_confidence * article_credibility * recency_decay`.
    - Recency decay: exponential (e.g., half-life 90 days).
  - Clamp per-dimension to [-10, +10].

### Processing Pipelines

#### User Profile Updater

- Triggered on `user_policy_vote_responses` upsert.
- Steps:
  1. Lookup option ideology delta.
  2. Fetch current user vector (or initialize to 0s).
  3. Apply delta with smoothing (learning rate 0.2 default).
  4. Write back to `user_ideology_profiles` with updated_at.
  5. Append entry to `user_ideology_history` (optional, maybe nightly).

- Provide background job to recompute from scratch if mapping changes (e.g. new weights).

#### TD Ideology Updater

- Hook into news scoring pipeline:
  1. When saving article impact, call new ideology classifier to get per-dimension shifts.
  2. Update TD vector with same smoothing logic.
  3. Persist change, append to history.
- Debate harvester:
  - Batch job runs nightly, updates TD vectors from new debate stances.

#### Party Aggregation

- Nightly cron:
  1. Fetch current TD vectors by party.
  2. Compute simple average per dimension (optionally weighted by seat count / confidence).
  3. Store in `party_ideology_profiles`.
  4. Keep `updated_at`.

### Personalized Rankings v2

- Replace current `PersonalizedScoringService` scoring with ideology distance:
  - Use cosine similarity or Euclidean distance in 8D space.
  - Convert to percentage match: `match = max(0, 100 - (distance / maxDistance) * 100)`.
  - Mix with objective scores (e.g. `final = 0.7 * ideology_match + 0.3 * objective_score`).
- Update API/response shape to include:
  - `ideology_match_percentage`.
  - `dimension_breakdown` (per dimension difference).

- UI changes:
  - Show top aligned TDs/parties with match percentage.
  - Provide “You lean X compared to party Y” messaging using difference vectors.

### LLM Prompting Requirements

- New prompt templates for:
  - Classifying policy vote options into 8D impacts (done once when generating opportunities).
  - Classifying news articles/debate statements for TD stance shifts.
- Consider caching ideology deltas per article/stance to limit OpenAI usage.

### Open Questions & Next Steps

- Finalize dimension names and baseline definitions with product.
- Define mapping table structure for vote options: `policy_vote_option_vectors`.
- Decide on update cadence vs incremental updates (initially incremental for responsiveness).
- Determine how to seed initial TD vectors (e.g., manual entry or start at 0).
- Build monitoring to ensure vectors stay within bounds.

### Immediate Implementation Plan

1. **Schema migration**:
   - Create user/TD/party ideology tables or extend existing ones.
   - Add mapping table for vote option vectors.
2. **User profile updater**:
   - Backend service to apply vote deltas.
   - Admin tools or script to backfill from historical votes.
3. **LLM integration for stances**:
   - Extend `PolicyOpportunityService` to capture option vectors during generation.
   - Modify `AINewsAnalysisService` and `PolicyStanceHarvester` to emit ideology deltas.
4. **Party aggregation cron**.
5. **Ranking refactor** and frontend adjustments.

This blueprint sets the stage for implementing each component iteratively while keeping the 8D ideology model consistent across users, TDs, and parties.

