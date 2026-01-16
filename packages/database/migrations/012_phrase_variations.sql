-- ============================================
-- ArcVest Marketing Automation System
-- Migration 012: Phrase Variations & Ratings
-- ============================================

-- ============================================
-- PHRASE VARIATIONS TABLE
-- ============================================

-- Stores generated phrase variations with ratings
CREATE TABLE IF NOT EXISTS phrase_variations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- The original seed phrase
    seed_phrase TEXT NOT NULL,
    seed_phrase_hash TEXT NOT NULL, -- For grouping variations of same seed

    -- The generated variation
    variation_text TEXT NOT NULL,
    variation_number INTEGER NOT NULL,

    -- Rating (1-5 stars, null = unrated)
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    rated_at TIMESTAMPTZ,

    -- Soft delete for rejected variations (rating = 1)
    is_rejected BOOLEAN DEFAULT FALSE,
    rejected_at TIMESTAMPTZ,

    -- Generation metadata
    generation_config JSONB DEFAULT '{}',

    -- Unique constraint to prevent duplicate variations for same seed
    UNIQUE(seed_phrase_hash, variation_text)
);

-- ============================================
-- REJECTED PHRASES TABLE
-- ============================================

-- Stores patterns/phrases that should be avoided in future generations
CREATE TABLE IF NOT EXISTS rejected_phrases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- The rejected phrase or pattern
    phrase TEXT NOT NULL UNIQUE,

    -- Why it was rejected
    reason TEXT,

    -- Original context
    original_seed_phrase TEXT,
    original_variation_id UUID REFERENCES phrase_variations(id) ON DELETE SET NULL
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_phrase_variations_seed_hash
    ON phrase_variations(seed_phrase_hash);
CREATE INDEX IF NOT EXISTS idx_phrase_variations_rating
    ON phrase_variations(rating);
CREATE INDEX IF NOT EXISTS idx_phrase_variations_rejected
    ON phrase_variations(is_rejected);
CREATE INDEX IF NOT EXISTS idx_phrase_variations_created
    ON phrase_variations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rejected_phrases_phrase
    ON rejected_phrases(phrase);

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS phrase_variations_updated_at ON phrase_variations;
CREATE TRIGGER phrase_variations_updated_at
    BEFORE UPDATE ON phrase_variations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- FUNCTION: Get rejected phrase patterns for exclusion
-- ============================================

CREATE OR REPLACE FUNCTION get_rejected_patterns()
RETURNS TABLE(phrase TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT rp.phrase
    FROM rejected_phrases rp
    ORDER BY rp.phrase;
END;
$$ LANGUAGE plpgsql;
