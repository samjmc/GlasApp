-- Migration: Create Politician Clone Tables
-- Implements structured memory (policy profiles) and extended RAG corpus

-- 1. Enable Vector Extension (idempotent)
create extension if not exists vector;

-- 2. Policy Positions (Structured Memory / Belief Graph)
create table if not exists policy_positions (
  id uuid primary key default gen_random_uuid(),
  politician_id integer references td_scores(id) on delete cascade, -- Links to td_scores profile
  topic text not null, -- e.g., 'housing', 'immigration'
  position_summary text not null, -- Structured summary of their stance
  strength float check (strength >= 0 and strength <= 1.0), -- 0.0 (weak) to 1.0 (strong/consistent)
  trend text check (trend in ('hardening', 'softening', 'stable', 'new', 'unknown')),
  time_span_start date,
  time_span_end date,
  key_quote_ids uuid[] default '{}', -- Array of UUIDs pointing to debate_chunks or corpus_chunks
  vote_ids integer[] default '{}', -- Array of IDs pointing to td_votes
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for policy lookups
create index if not exists idx_policy_positions_politician on policy_positions(politician_id);
create index if not exists idx_policy_positions_topic on policy_positions(topic);
create unique index if not exists idx_policy_unique_topic on policy_positions(politician_id, topic);

-- 3. Political Corpus Items (Non-Debate Sources)
-- Stores raw text from manifestos, interviews, press releases, etc.
create table if not exists corpus_items (
  id uuid primary key default gen_random_uuid(),
  politician_id integer references td_scores(id) on delete cascade,
  source_type text not null, -- 'manifesto', 'interview', 'press_release', 'social_media', 'website_statement'
  title text,
  content text not null,
  url text,
  published_at timestamptz,
  metadata jsonb default '{}', -- valid_from, valid_to, authors, etc.
  created_at timestamptz default now()
);

create index if not exists idx_corpus_items_politician on corpus_items(politician_id);
create index if not exists idx_corpus_items_type on corpus_items(source_type);

-- 4. Corpus Chunks (Vector Store for non-debates)
-- Similar to debate_chunks but linked to corpus_items
create table if not exists corpus_chunks (
  id uuid primary key default gen_random_uuid(),
  corpus_item_id uuid references corpus_items(id) on delete cascade,
  chunk_content text not null,
  embedding vector(1536),
  politician_name text, -- Denormalized for faster RAG filtering
  party text,
  date date,
  topic text,
  created_at timestamptz default now()
);

-- Vector index for similarity search
create index if not exists idx_corpus_chunks_embedding on corpus_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists idx_corpus_chunks_politician on corpus_chunks(politician_name);

-- 5. Ensure debate_chunks exists (Idempotent check)
-- This table matches speeches to vectors
create table if not exists debate_chunks (
  id uuid primary key default gen_random_uuid(),
  speech_id uuid references debate_speeches(id) on delete cascade,
  chunk_content text not null,
  embedding vector(1536),
  politician_name text,
  party text,
  date date,
  topic text,
  created_at timestamptz default now()
);

-- Ensure indexes exist on debate_chunks
drop index if exists idx_debate_chunks_embedding;
create index idx_debate_chunks_embedding on debate_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists idx_debate_chunks_politician on debate_chunks(politician_name);

-- 6. Grant permissions (optional but good practice for Supabase service role)
grant all on policy_positions to postgres, service_role;
grant all on corpus_items to postgres, service_role;
grant all on corpus_chunks to postgres, service_role;
grant all on debate_chunks to postgres, service_role;

-- Add comments
comment on table policy_positions is 'Structured belief graph/policy profile for politicians';
comment on table corpus_items is 'Raw text sources other than parliamentary debates (manifestos, interviews, etc.)';
comment on table corpus_chunks is 'Vector embeddings for corpus_items';




