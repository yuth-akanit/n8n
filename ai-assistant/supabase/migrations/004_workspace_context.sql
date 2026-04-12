-- ============================================================
-- Migration 004: Workspace context doc + cron run log
-- ============================================================

-- One context doc per workspace (brand guide / brief)
create table if not exists workspace_context (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title        text not null default 'Workspace Brief',
  content_md   text not null default '',
  is_active    boolean not null default true,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id)
);

-- Log cron runs for visibility in the UI
create table if not exists cron_runs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  job_name     text not null,
  status       text not null check (status in ('success', 'failed', 'skipped')),
  result_json  jsonb,
  ran_at       timestamptz not null default now()
);

create index if not exists cron_runs_workspace_idx on cron_runs (workspace_id, ran_at desc);
