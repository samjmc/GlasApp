# Debate AI Architecture ("The Digital Twin")

## Overview
This document outlines the technical architecture for the "Digital Twin" feature, where users can ask questions to a virtual representation of a politician based on their actual parliamentary debate record.

## 1. Ingestion Strategy (No Change Required)
**Current Status:** ✅
The current `scripts/fetch-oireachtas-debate-week.ts` script correctly fetches XML, parses it, and saves speeches to `debate_speeches` with a `paragraphs` JSONB column.
**Decision:** Do NOT change the core ingestion. It works. We will build *on top* of it.

## 2. New Data Structure (Vector Storage)
To enable the AI to "remember" and "cite" specific debates, we need to index the speeches using **Vector Embeddings**.

### 2.1 Enable Extension
We need to enable `pgvector` in Supabase.

### 2.2 New Table: `debate_embeddings`
This table stores "chunks" of speeches optimized for semantic search.

```sql
create extension if not exists vector;

create table debate_chunks (
  id uuid primary key default gen_random_uuid(),
  speech_id uuid references debate_speeches(id) on delete cascade,
  
  -- The actual text used for the context
  chunk_content text not null,
  
  -- The OpenAI embedding (1536 dimensions for text-embedding-3-small)
  embedding vector(1536),
  
  -- Metadata for fast filtering without joining
  politician_name text,
  party text,
  date date,
  topic text, -- Optional, if we have it
  
  created_at timestamptz default now()
);

-- Index for fast similarity search
create index on debate_chunks using hnsw (embedding vector_cosine_ops);
-- Index for filtering by politician (crucial for "Ask Simon Harris")
create index on debate_chunks (politician_name);
```

## 3. The Processing Pipeline (New)
We need a new background job: `server/jobs/processDebateEmbeddings.ts`.

**Logic:**
1.  Find `debate_speeches` that do NOT have corresponding entries in `debate_chunks`.
2.  **Chunking:**
    *   Concatenate `paragraphs` from the speech.
    *   Split into chunks of ~500-1000 tokens (overlapping by ~100 tokens).
    *   *Note:* Most speeches are short enough to be single chunks.
3.  **Embedding:**
    *   Send chunk text to OpenAI (`text-embedding-3-small`).
4.  **Storage:**
    *   Insert into `debate_chunks`.

## 4. The "Digital Twin" API (RAG Flow)

### Endpoint: `POST /api/chat/politician`

**Input:**
```json
{
  "politicianName": "Simon Harris",
  "question": "What is your plan for housing?"
}
```

**Process:**
1.  **Embed Question:** Generate vector for "What is your plan for housing?".
2.  **Vector Search:**
    ```sql
    select chunk_content, date, 1 - (embedding <=> query_embedding) as similarity
    from debate_chunks
    where politician_name = 'Simon Harris'
    order by similarity desc
    limit 5;
    ```
3.  **Prompt Construction:**
    ```text
    You are an AI representation of Simon Harris based STRICTLY on his public record.
    Answer the user's question using ONLY the context below.
    If the context doesn't contain the answer, say "I haven't addressed this specific issue in the debates available to me."
    
    Context:
    [2023-11-12]: "We are building 30,000 homes..."
    [2024-01-15]: "The housing for all plan is working..."
    
    User Question: What is your plan for housing?
    ```
4.  **Response:** Returns the answer + citations (dates/speech IDs).

## 5. "Signed On" Politicians (Phase 2)
If a politician "signs on" to the app:
1.  They get a "Verified Claims" dashboard.
2.  They can write a "Clarification".
3.  This saves to a new table `verified_statements` (similar structure to `debate_chunks`).
4.  **Priority:** The RAG search queries BOTH tables. If a `verified_statement` matches, it takes precedence (higher weight) over older debate chunks.

## 6. Cost Estimates
*   **Storage:** 10 years of debates ≈ 100MB text. Vector storage is cheap.
*   **Embedding (One-time):** ~$5.00 to embed historical backlog.
*   **Inference (Ongoing):** ~$0.01 per user question (GPT-4o-mini is cheaper).

## Recommendation
Start by implementing Step 2 and 3 (Schema + Processing Job). This builds the "Brain" without changing your existing "Body" (Ingestion).


