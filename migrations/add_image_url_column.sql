-- Add image_url column to news_articles table
-- Run this in Supabase SQL Editor

ALTER TABLE news_articles 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Verify column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'news_articles' 
  AND column_name = 'image_url';

