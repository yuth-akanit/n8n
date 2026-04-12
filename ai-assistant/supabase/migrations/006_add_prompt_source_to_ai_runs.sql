-- ============================================================
-- Migration 006: Add prompt_source to ai_runs for audit trail
-- ============================================================
-- Tracks whether the prompt that produced this run came from
-- a DB override or the hardcoded code default.

alter table ai_runs
  add column if not exists prompt_source text
    check (prompt_source in ('db', 'hardcoded'))
    default 'hardcoded';
