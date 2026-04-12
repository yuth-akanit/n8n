-- ============================================================
-- Migration 002: Add 'chat' to module enum in ai_sessions and ai_runs
-- ============================================================
-- PostgreSQL names inline CHECK constraints as <table>_<column>_check
-- Drop old constraints and re-add with 'chat' included.

-- ai_sessions.module
alter table ai_sessions
  drop constraint if exists ai_sessions_module_check;

alter table ai_sessions
  add constraint ai_sessions_module_check
  check (module in ('idea', 'project', 'builder', 'seo', 'chat'));

-- ai_runs.module
alter table ai_runs
  drop constraint if exists ai_runs_module_check;

alter table ai_runs
  add constraint ai_runs_module_check
  check (module in ('idea', 'project', 'builder', 'seo', 'chat'));
