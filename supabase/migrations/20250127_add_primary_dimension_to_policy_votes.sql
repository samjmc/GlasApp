-- Add primary_dimension tracking to policy_vote_opportunities
-- This helps ensure even distribution across all 8 ideology dimensions

begin;

-- Add primary_dimension column to track which ideology dimension this question primarily reveals
alter table policy_vote_opportunities
add column if not exists primary_dimension text;

-- Create index for dimension distribution queries
create index if not exists idx_policy_vote_opportunities_dimension 
on policy_vote_opportunities(primary_dimension);

-- Create index for dimension + date queries (for distribution tracking)
create index if not exists idx_policy_vote_opportunities_dimension_date 
on policy_vote_opportunities(primary_dimension, created_at desc);

commit;

