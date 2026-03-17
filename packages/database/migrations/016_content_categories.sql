-- Migration 016: Content Categories
-- Adds content_category column to idea_queue and content_calendar
-- Categories: market_commentary, macro_capital_flows, real_economy, investor_strategies

-- Create enum type for content categories
DO $$ BEGIN
  CREATE TYPE content_category AS ENUM (
    'market_commentary',
    'macro_capital_flows',
    'real_economy',
    'investor_strategies'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add content_category to idea_queue
ALTER TABLE idea_queue
  ADD COLUMN IF NOT EXISTS content_category content_category;

-- Add content_category to content_calendar
ALTER TABLE content_calendar
  ADD COLUMN IF NOT EXISTS content_category content_category;

-- Index for category-based queries and daily selection diversity
CREATE INDEX IF NOT EXISTS idx_idea_queue_content_category ON idea_queue (content_category);
CREATE INDEX IF NOT EXISTS idx_content_calendar_content_category ON content_calendar (content_category);
