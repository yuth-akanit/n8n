-- ============================================================
-- AI Assistant MVP — Initial Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- WORKSPACES
-- ============================================================
create table if not exists workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
create table if not exists workspace_members (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner','admin','member','viewer')),
  created_at timestamptz default now(),
  unique(workspace_id, user_id)
);

-- ============================================================
-- IDEAS
-- ============================================================
create table if not exists ideas (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  brief text not null,
  audience text,
  problem text,
  solution text,
  channel text[] default '{}',
  score_impact int,
  score_ease int,
  score_roi int,
  status text not null default 'new' check (status in ('new','refining','approved','rejected','converted')),
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- PROJECTS
-- ============================================================
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  idea_id uuid references ideas(id) on delete set null,
  name text not null,
  slug text not null,
  status text not null default 'draft' check (status in ('draft','planning','building','active','paused','done','archived')),
  project_type text not null check (project_type in ('idea','app','automation','seo','content','internal_tool')),
  summary text,
  goal text,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(workspace_id, slug)
);

-- ============================================================
-- PROJECT DOCS
-- ============================================================
create table if not exists project_docs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  doc_type text not null check (doc_type in ('brief','spec','prd','architecture','api_contract','db_schema','notes')),
  title text not null,
  content_md text not null default '',
  version int not null default 1,
  created_by uuid,
  created_at timestamptz default now()
);

-- ============================================================
-- MILESTONES
-- ============================================================
create table if not exists milestones (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  sort_order int not null default 0,
  due_date date,
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','done')),
  created_at timestamptz default now()
);

-- ============================================================
-- TASKS
-- ============================================================
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  milestone_id uuid references milestones(id) on delete set null,
  parent_task_id uuid references tasks(id) on delete set null,
  title text not null,
  description text,
  task_type text not null check (task_type in ('research','planning','backend','frontend','seo','content','qa','deploy')),
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','review','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  estimate_hours numeric(6,2),
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- AI SESSIONS
-- ============================================================
create table if not exists ai_sessions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  module text not null check (module in ('idea','project','builder','seo')),
  title text not null,
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid,
  created_at timestamptz default now()
);

-- ============================================================
-- AI MESSAGES
-- ============================================================
create table if not exists ai_messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references ai_sessions(id) on delete cascade,
  role text not null check (role in ('system','user','assistant','tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- AI RUNS
-- ============================================================
create table if not exists ai_runs (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references ai_sessions(id) on delete cascade,
  module text not null check (module in ('idea','project','builder','seo')),
  prompt_key text not null,
  prompt_version int not null default 1,
  provider text not null,
  model text not null,
  status text not null default 'queued' check (status in ('queued','running','success','failed')),
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb,
  error_text text,
  latency_ms int,
  created_at timestamptz default now(),
  finished_at timestamptz
);

-- ============================================================
-- ARTIFACTS
-- ============================================================
create table if not exists artifacts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  ai_run_id uuid references ai_runs(id) on delete set null,
  artifact_type text not null check (artifact_type in ('idea_doc','project_plan','markdown','json','sql','code','seo_report','patch')),
  title text not null,
  content text not null,
  format text not null default 'md',
  version int not null default 1,
  is_latest boolean not null default true,
  created_by uuid,
  created_at timestamptz default now()
);

-- ============================================================
-- SEO SITES
-- ============================================================
create table if not exists seo_sites (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  base_url text not null,
  platform text not null default 'wordpress' check (platform in ('wordpress','nextjs','other')),
  created_at timestamptz default now()
);

-- ============================================================
-- SEO AUDITS
-- ============================================================
create table if not exists seo_audits (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references seo_sites(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  audit_scope text not null default 'single_url' check (audit_scope in ('single_url','multi_url','site_scan')),
  target_url text not null,
  summary text,
  score_overall int,
  created_by uuid,
  created_at timestamptz default now(),
  finished_at timestamptz
);

-- ============================================================
-- SEO AUDIT PAGES
-- ============================================================
create table if not exists seo_audit_pages (
  id uuid primary key default uuid_generate_v4(),
  audit_id uuid not null references seo_audits(id) on delete cascade,
  url text not null,
  title text,
  meta_description text,
  canonical_url text,
  h1 text,
  word_count int,
  status_code int,
  content_hash text,
  raw_html text,
  extracted_json jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- SEO ISSUES
-- ============================================================
create table if not exists seo_issues (
  id uuid primary key default uuid_generate_v4(),
  audit_id uuid not null references seo_audits(id) on delete cascade,
  page_id uuid references seo_audit_pages(id) on delete cascade,
  issue_type text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  message text not null,
  recommendation text,
  created_at timestamptz default now()
);

-- ============================================================
-- SEO PATCHES
-- ============================================================
create table if not exists seo_patches (
  id uuid primary key default uuid_generate_v4(),
  audit_id uuid not null references seo_audits(id) on delete cascade,
  page_id uuid references seo_audit_pages(id) on delete set null,
  patch_type text not null check (patch_type in ('update_title','update_meta_description','set_canonical','rewrite_content','add_alt_text')),
  before_json jsonb,
  after_json jsonb not null,
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','applied','failed')),
  approved_by uuid,
  approved_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_ideas_workspace on ideas(workspace_id);
create index if not exists idx_ideas_status on ideas(status);
create index if not exists idx_projects_workspace on projects(workspace_id);
create index if not exists idx_projects_status on projects(status);
create index if not exists idx_tasks_project on tasks(project_id);
create index if not exists idx_tasks_milestone on tasks(milestone_id);
create index if not exists idx_ai_sessions_workspace on ai_sessions(workspace_id);
create index if not exists idx_ai_messages_session on ai_messages(session_id);
create index if not exists idx_artifacts_workspace on artifacts(workspace_id);
create index if not exists idx_artifacts_project on artifacts(project_id);
create index if not exists idx_seo_audits_site on seo_audits(site_id);
create index if not exists idx_seo_issues_audit on seo_issues(audit_id);
create index if not exists idx_seo_patches_audit on seo_patches(audit_id);

-- ============================================================
-- ROW LEVEL SECURITY (Starter Policies)
-- ============================================================
-- Enable RLS on all tables
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table ideas enable row level security;
alter table projects enable row level security;
alter table project_docs enable row level security;
alter table milestones enable row level security;
alter table tasks enable row level security;
alter table ai_sessions enable row level security;
alter table ai_messages enable row level security;
alter table ai_runs enable row level security;
alter table artifacts enable row level security;
alter table seo_sites enable row level security;
alter table seo_audits enable row level security;
alter table seo_audit_pages enable row level security;
alter table seo_issues enable row level security;
alter table seo_patches enable row level security;

-- Helper function: is user a member of workspace?
create or replace function is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
  );
$$;

-- Workspace: members can see their workspaces
create policy "workspace_member_select" on workspaces
  for select using (is_workspace_member(id));

-- Workspace members: members can see fellow members
create policy "workspace_members_select" on workspace_members
  for select using (is_workspace_member(workspace_id));

-- Ideas: workspace members only
create policy "ideas_select" on ideas
  for select using (is_workspace_member(workspace_id));
create policy "ideas_insert" on ideas
  for insert with check (is_workspace_member(workspace_id));
create policy "ideas_update" on ideas
  for update using (is_workspace_member(workspace_id));

-- Projects: workspace members only
create policy "projects_select" on projects
  for select using (is_workspace_member(workspace_id));
create policy "projects_insert" on projects
  for insert with check (is_workspace_member(workspace_id));
create policy "projects_update" on projects
  for update using (is_workspace_member(workspace_id));

-- Project docs: via project membership
create policy "project_docs_select" on project_docs
  for select using (
    exists (select 1 from projects p where p.id = project_docs.project_id and is_workspace_member(p.workspace_id))
  );
create policy "project_docs_insert" on project_docs
  for insert with check (
    exists (select 1 from projects p where p.id = project_docs.project_id and is_workspace_member(p.workspace_id))
  );

-- Milestones and Tasks: via project membership
create policy "milestones_select" on milestones
  for select using (
    exists (select 1 from projects p where p.id = milestones.project_id and is_workspace_member(p.workspace_id))
  );
create policy "tasks_select" on tasks
  for select using (
    exists (select 1 from projects p where p.id = tasks.project_id and is_workspace_member(p.workspace_id))
  );

-- AI sessions/messages/runs: workspace members
create policy "ai_sessions_select" on ai_sessions
  for select using (is_workspace_member(workspace_id));
create policy "ai_messages_select" on ai_messages
  for select using (
    exists (select 1 from ai_sessions s where s.id = ai_messages.session_id and is_workspace_member(s.workspace_id))
  );
create policy "ai_runs_select" on ai_runs
  for select using (
    exists (select 1 from ai_sessions s where s.id = ai_runs.session_id and is_workspace_member(s.workspace_id))
  );

-- Artifacts: workspace members
create policy "artifacts_select" on artifacts
  for select using (is_workspace_member(workspace_id));
create policy "artifacts_insert" on artifacts
  for insert with check (is_workspace_member(workspace_id));

-- SEO: workspace members
create policy "seo_sites_select" on seo_sites
  for select using (is_workspace_member(workspace_id));
create policy "seo_sites_insert" on seo_sites
  for insert with check (is_workspace_member(workspace_id));

create policy "seo_audits_select" on seo_audits
  for select using (
    exists (select 1 from seo_sites s where s.id = seo_audits.site_id and is_workspace_member(s.workspace_id))
  );
create policy "seo_audit_pages_select" on seo_audit_pages
  for select using (
    exists (
      select 1 from seo_audits a
      join seo_sites s on s.id = a.site_id
      where a.id = seo_audit_pages.audit_id and is_workspace_member(s.workspace_id)
    )
  );
create policy "seo_issues_select" on seo_issues
  for select using (
    exists (
      select 1 from seo_audits a
      join seo_sites s on s.id = a.site_id
      where a.id = seo_issues.audit_id and is_workspace_member(s.workspace_id)
    )
  );
create policy "seo_patches_select" on seo_patches
  for select using (
    exists (
      select 1 from seo_audits a
      join seo_sites s on s.id = a.site_id
      where a.id = seo_patches.audit_id and is_workspace_member(s.workspace_id)
    )
  );
create policy "seo_patches_update" on seo_patches
  for update using (
    exists (
      select 1 from seo_audits a
      join seo_sites s on s.id = a.site_id
      where a.id = seo_patches.audit_id and is_workspace_member(s.workspace_id)
    )
  );

-- ============================================================
-- NOTE: No seed workspace needed.
-- Workspaces are auto-created per-user on first login via resolveWorkspace()
-- in lib/auth/server.ts.
-- ============================================================
