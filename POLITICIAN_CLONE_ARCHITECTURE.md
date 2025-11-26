# Politician Clone Architecture ("The Digital Twin")

## Overview
This document outlines the architectural vision for the "Politician Clone" feature. The goal is to create an AI agent that can answer questions as if it were a specific politician, grounded strictly in their public record (debates, interviews, manifestos, voting record).

## 1. Core RAG (The Corpus)
The base of the system is a comprehensive Retrieval-Augmented Generation (RAG) system over the politician's public record.

### Data Sources
1.  **Parliamentary / Dáil Debates**: Already ingested via `debate_speeches`.
2.  **Media Transcripts**: TV/Radio interviews.
3.  **Party Manifestos & Policy Docs**: Official party positions.
4.  **Press Releases**: Statements from their website.
5.  **Social Media**: Posts/threads with stated positions.
6.  **Voting Record**: How they actually voted (via `td_votes`).

### Vector Store Strategy
We need to chunk and embed these sources into a vector store with rich metadata:
```json
{
  "politician_id": "jim_ocallaghan",
  "date": "2023-11-12",
  "source_type": "dail_debate",
  "topic": ["housing", "planning"],
  "stance": "supportive of stricter planning controls",
  "text": "full paragraph..."
}
```

## 2. Structured Memory (Policy Profiles)
To prevent inconsistency ("wobbly" answers), we maintain a structured "belief graph" or policy profile for each politician. This is created offline and updated via pipelines.

### Schema: `policy_positions`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `politician_id` | uuid | FK to `tds` (or `members`) |
| `topic` | text | e.g., "immigration", "housing" |
| `position_summary` | text | "Supportive of tighter controls..." |
| `strength` | float | 0.0-1.0 (How strongly stated) |
| `trend` | enum | 'hardening', 'softening', 'stable' |
| `time_span_start` | date | Earliest evidence |
| `time_span_end` | date | Latest evidence |
| `key_quote_ids` | array | References to `debate_chunks` or corpus |
| `vote_ids` | array | References to `td_votes` |

## 3. Agent API Layer (Tools)
The AI agent does not have free internet access. It uses specific, narrow tools to access the data stack.

### Read Tools
-   `get_positions(politician_id, topic)`: Returns the structured policy row.
-   `search_sources(politician_id, topic, date_range, k)`: RAG retrieval from raw corpus.
-   `get_vote_record(politician_id, bill_id)`: Checks specific votes.
-   `has_clear_position(politician_id, topic)`: Boolean check to prevent hallucination.

### Write/Update Tools (Backend Only)
-   `ingest_corpus_item(type, text, metadata)`: Adds to RAG.
-   `update_policy_profile(politician_id)`: Re-evaluates structured memory based on new data.

## 4. Memory Layers
1.  **Global (Authoritative)**: The `policy_positions` table. Derived from real data. Shared across all users.
2.  **Per-User (UX)**: "User cares about housing". Used for personalization, not belief mutation.
3.  **Short-Term**: Session chat history.

## 5. Safety & Constraints
-   **Disclaimers**: "This is an AI summary..."
-   **Citations**: Always link to source (Debate date/Video link).
-   **Unknowns**: "I can't find clear public statements on this."

## Implementation Roadmap

### Phase 1: Foundation (Current Focus)
-   [ ] Verify `debate_speeches` ingestion (Complete).
-   [ ] Create `debate_chunks` / `corpus_embeddings` table (pgvector).
-   [ ] Create `policy_positions` table.
-   [ ] Implement `Enhanced RAG` pipeline (Chunk -> Embed -> Store).

### Phase 2: Structured Memory Extraction
-   [ ] Build LLM pipeline to extract `position`, `strength`, `trend` from recent chunks.
-   [ ] Populate `policy_positions` for key politicians.

### Phase 3: The Agent
-   [ ] Build LangGraph agent with the "Read Tools".
-   [ ] Connect to Frontend Chat Interface.

