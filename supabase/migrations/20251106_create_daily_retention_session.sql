-- Daily Retention Session schema
-- Creates session tracking tables for the 3-vote daily loop

begin;

create table if not exists daily_sessions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null,
  status text not null default 'pending', -- pending | completed | expired
  county text,
  constituency text,
  streak_count integer not null default 0,
  ideology_axis text,
  ideology_delta numeric(6,2),
  ideology_direction text,
  ideology_summary text,
  region_shift_summary text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint daily_sessions_unique_user_date unique (user_id, session_date)
);

create index if not exists daily_sessions_user_date_idx
  on daily_sessions (user_id, session_date desc);

create table if not exists daily_session_items (
  id bigserial primary key,
  session_id bigint not null references daily_sessions(id) on delete cascade,
  article_id integer not null references news_articles(id) on delete cascade,
  policy_dimension text,
  policy_direction text,
  headline text not null,
  summary text,
  politician_name text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists daily_session_items_session_idx
  on daily_session_items (session_id, order_index);

create index if not exists daily_session_items_article_idx
  on daily_session_items (article_id);

create table if not exists daily_session_votes (
  id bigserial primary key,
  session_item_id bigint not null references daily_session_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  impact_score numeric(6,3),
  created_at timestamptz not null default now(),
  constraint daily_session_votes_unique unique (session_item_id, user_id)
);

create index if not exists daily_session_votes_user_idx
  on daily_session_votes (user_id, created_at desc);

create index if not exists daily_session_votes_item_idx
  on daily_session_votes (session_item_id);

-- Enable Row Level Security
alter table daily_sessions enable row level security;
alter table daily_session_items enable row level security;
alter table daily_session_votes enable row level security;

-- Policies for daily_sessions
drop policy if exists "Users can view their daily sessions" on daily_sessions;
create policy "Users can view their daily sessions"
  on daily_sessions
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert their daily sessions" on daily_sessions;
create policy "Users can insert their daily sessions"
  on daily_sessions
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their daily sessions" on daily_sessions;
create policy "Users can update their daily sessions"
  on daily_sessions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Policies for daily_session_items
drop policy if exists "Users can view their session items" on daily_session_items;
create policy "Users can view their session items"
  on daily_session_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from daily_sessions ds
      where ds.id = daily_session_items.session_id
      and ds.user_id = auth.uid()
    )
  );

-- Policies for daily_session_votes
drop policy if exists "Users can view their session votes" on daily_session_votes;
create policy "Users can view their session votes"
  on daily_session_votes
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert their session votes" on daily_session_votes;
create policy "Users can insert their session votes"
  on daily_session_votes
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their session votes" on daily_session_votes;
create policy "Users can update their session votes"
  on daily_session_votes
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;



















