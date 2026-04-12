-- Module-specific system prompts per workspace
-- Every save inserts a NEW row (new version). Active flag marks current version.
-- This allows full rollback, compare, and audit history.
create table if not exists workspace_prompts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  module_key   text not null check (module_key in (
    'idea_module_prompt',
    'builder_module_prompt',
    'seo_module_prompt',
    'chat_module_prompt'
  )),
  prompt_text  text not null default '',
  is_active    boolean not null default false, -- only one active per (workspace, module)
  is_default   boolean not null default false, -- true = seeded default, never user-modified
  status       text not null default 'active' check (status in ('draft','active','archived')),
  version      int not null default 1,
  prompt_hash  text,                           -- sha256 for dedup/audit
  notes        text,                           -- optional change description
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
  -- no updated_at: rows are immutable, each edit = new row
);

-- Fast lookup: current active prompt per workspace/module
create index workspace_prompts_lookup_idx on workspace_prompts (workspace_id, module_key, is_active);

-- RLS: use service role (accessed via service client only)
alter table workspace_prompts enable row level security;
create policy "workspace_prompts_service_all" on workspace_prompts
  using (true) with check (true);
