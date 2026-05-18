-- AI Token Usage Monitor — Supabase Schema
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS ai_token_usage (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Provider & model
  provider          VARCHAR(50)  NOT NULL,   -- 'openai' | 'anthropic' | 'google' | 'groq' | 'meta' | 'mistral'
  model             VARCHAR(100) NOT NULL,   -- e.g. 'gpt-4o-mini', 'claude-3-5-haiku-20241022'

  -- Token counts
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,

  -- Cost (calculated server-side by n8n workflow)
  cost_usd          DECIMAL(12, 8) DEFAULT 0,

  -- n8n context
  workflow_name     VARCHAR(255),
  node_name         VARCHAR(255),

  -- Status
  status            VARCHAR(20) DEFAULT 'success',  -- 'success' | 'error'

  -- Extra metadata (raw API response fields etc.)
  metadata          JSONB DEFAULT '{}'
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_atu_created_at  ON ai_token_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_atu_provider    ON ai_token_usage (provider);
CREATE INDEX IF NOT EXISTS idx_atu_model       ON ai_token_usage (model);
CREATE INDEX IF NOT EXISTS idx_atu_status      ON ai_token_usage (status);

-- Enable Row Level Security (optional — uncomment if needed)
-- ALTER TABLE ai_token_usage ENABLE ROW LEVEL SECURITY;

-- Grant read access to anon role for dashboard (uses anon key)
GRANT SELECT ON ai_token_usage TO anon;

-- Grant insert/update to service_role (used by n8n webhook)
GRANT INSERT, SELECT ON ai_token_usage TO service_role;


-- ─────────────────────────────────────────
-- Useful views
-- ─────────────────────────────────────────

-- Daily summary by provider
CREATE OR REPLACE VIEW v_daily_summary AS
SELECT
  DATE(created_at) AS day,
  provider,
  COUNT(*)                          AS calls,
  SUM(prompt_tokens)                AS prompt_tokens,
  SUM(completion_tokens)            AS completion_tokens,
  SUM(total_tokens)                 AS total_tokens,
  ROUND(SUM(cost_usd)::NUMERIC, 6)  AS cost_usd,
  COUNT(*) FILTER (WHERE status = 'error') AS error_count
FROM ai_token_usage
GROUP BY DATE(created_at), provider
ORDER BY day DESC, cost_usd DESC;

-- Top models (all time)
CREATE OR REPLACE VIEW v_top_models AS
SELECT
  provider,
  model,
  COUNT(*)                          AS calls,
  SUM(total_tokens)                 AS total_tokens,
  ROUND(SUM(cost_usd)::NUMERIC, 6)  AS cost_usd
FROM ai_token_usage
GROUP BY provider, model
ORDER BY total_tokens DESC;
