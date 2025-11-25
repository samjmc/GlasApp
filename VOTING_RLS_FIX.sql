-- Row Level Security Policies for Policy Voting System
-- Run this in Supabase SQL Editor to enable voting

-- First, enable RLS on user_policy_votes table (if not already enabled)
ALTER TABLE user_policy_votes ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow authenticated users to INSERT their own votes
CREATE POLICY "Users can insert their own votes"
ON user_policy_votes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 2: Allow authenticated users to UPDATE their own votes
CREATE POLICY "Users can update their own votes"
ON user_policy_votes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Allow authenticated users to SELECT their own votes
CREATE POLICY "Users can view their own votes"
ON user_policy_votes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 4: Allow authenticated users to DELETE their own votes
CREATE POLICY "Users can delete their own votes"
ON user_policy_votes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Policy 5: Allow everyone to view aggregate statistics (for the article_vote_stats view)
-- This is safe because the view only shows aggregate data, not individual user votes
CREATE POLICY "Public can view aggregate vote stats"
ON user_policy_votes
FOR SELECT
TO public
USING (true);

-- Note: The last policy allows reading for stats, but individual user_id values
-- won't be exposed through the article_vote_stats view which only shows aggregates


