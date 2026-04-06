// ============================================================
// Core domain types — mirror the database schema
// ============================================================

export type WorkspaceMemberRole = 'owner' | 'admin' | 'member' | 'viewer'
export type IdeaStatus = 'new' | 'refining' | 'approved' | 'rejected' | 'converted'
export type ProjectStatus = 'draft' | 'planning' | 'building' | 'active' | 'paused' | 'done' | 'archived'
export type ProjectType = 'idea' | 'app' | 'automation' | 'seo' | 'content' | 'internal_tool'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type DocType = 'brief' | 'spec' | 'prd' | 'architecture' | 'api_contract' | 'db_schema' | 'notes'
export type MilestoneStatus = 'todo' | 'in_progress' | 'blocked' | 'done'
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'review' | 'done'
export type TaskType = 'research' | 'planning' | 'backend' | 'frontend' | 'seo' | 'content' | 'qa' | 'deploy'
export type AiModule = 'idea' | 'project' | 'builder' | 'seo'
export type AiRunStatus = 'queued' | 'running' | 'success' | 'failed'
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'
export type ArtifactType = 'idea_doc' | 'project_plan' | 'markdown' | 'json' | 'sql' | 'code' | 'seo_report' | 'patch'
export type SeoPlatform = 'wordpress' | 'nextjs' | 'other'
export type SeoAuditStatus = 'queued' | 'running' | 'completed' | 'failed'
export type SeoAuditScope = 'single_url' | 'multi_url' | 'site_scan'
export type SeoIssueSeverity = 'low' | 'medium' | 'high' | 'critical'
export type SeoPatchType = 'update_title' | 'update_meta_description' | 'set_canonical' | 'rewrite_content' | 'add_alt_text'
export type SeoPatchStatus = 'proposed' | 'approved' | 'rejected' | 'applied' | 'failed'
export type BuilderMode = 'spec' | 'sql' | 'api' | 'ui' | 'code_patch'

// ============================================================
// Database row types
// ============================================================

export interface Workspace {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceMemberRole
  created_at: string
}

export interface Idea {
  id: string
  workspace_id: string
  title: string
  brief: string
  audience: string | null
  problem: string | null
  solution: string | null
  channel: string[]
  score_impact: number | null
  score_ease: number | null
  score_roi: number | null
  status: IdeaStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  workspace_id: string
  idea_id: string | null
  name: string
  slug: string
  status: ProjectStatus
  project_type: ProjectType
  summary: string | null
  goal: string | null
  priority: Priority
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProjectDoc {
  id: string
  project_id: string
  doc_type: DocType
  title: string
  content_md: string
  version: number
  created_by: string | null
  created_at: string
}

export interface Milestone {
  id: string
  project_id: string
  title: string
  description: string | null
  sort_order: number
  due_date: string | null
  status: MilestoneStatus
  created_at: string
}

export interface Task {
  id: string
  project_id: string
  milestone_id: string | null
  parent_task_id: string | null
  title: string
  description: string | null
  task_type: TaskType
  status: TaskStatus
  priority: Priority
  estimate_hours: number | null
  assigned_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AiSession {
  id: string
  workspace_id: string
  project_id: string | null
  module: AiModule
  title: string
  status: 'active' | 'archived'
  created_by: string | null
  created_at: string
}

export interface AiMessage {
  id: string
  session_id: string
  role: MessageRole
  content: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface AiRun {
  id: string
  session_id: string
  module: AiModule
  prompt_key: string
  prompt_version: number
  provider: string
  model: string
  status: AiRunStatus
  input_json: Record<string, unknown>
  output_json: Record<string, unknown> | null
  error_text: string | null
  latency_ms: number | null
  created_at: string
  finished_at: string | null
}

export interface Artifact {
  id: string
  workspace_id: string
  project_id: string | null
  ai_run_id: string | null
  artifact_type: ArtifactType
  title: string
  content: string
  format: string
  version: number
  is_latest: boolean
  created_by: string | null
  created_at: string
}

export interface SeoSite {
  id: string
  workspace_id: string
  name: string
  base_url: string
  platform: SeoPlatform
  created_at: string
}

export interface SeoAudit {
  id: string
  site_id: string
  project_id: string | null
  status: SeoAuditStatus
  audit_scope: SeoAuditScope
  target_url: string
  summary: string | null
  score_overall: number | null
  created_by: string | null
  created_at: string
  finished_at: string | null
}

export interface SeoAuditPage {
  id: string
  audit_id: string
  url: string
  title: string | null
  meta_description: string | null
  canonical_url: string | null
  h1: string | null
  word_count: number | null
  status_code: number | null
  content_hash: string | null
  raw_html: string | null
  extracted_json: Record<string, unknown>
  created_at: string
}

export interface SeoIssue {
  id: string
  audit_id: string
  page_id: string | null
  issue_type: string
  severity: SeoIssueSeverity
  message: string
  recommendation: string | null
  created_at: string
}

export interface SeoPatch {
  id: string
  audit_id: string
  page_id: string | null
  patch_type: SeoPatchType
  before_json: Record<string, unknown> | null
  after_json: Record<string, unknown>
  status: SeoPatchStatus
  approved_by: string | null
  approved_at: string | null
  applied_at: string | null
  created_at: string
}

// ============================================================
// API request/response types
// ============================================================

export interface ApiError {
  error: string
  details?: string
}

export interface GenerateIdeasRequest {
  workspaceId: string
  prompt: string
  constraints?: string
}

export interface GenerateIdeasResponse {
  sessionId: string
  artifactId: string
  ideas: GeneratedIdea[]
}

export interface GeneratedIdea {
  title: string
  brief: string
  audience: string
  problem: string
  solution: string
  channel: string[]
  score_impact: number
  score_ease: number
  score_roi: number
}

export interface GenerateProjectPlanRequest {
  workspaceId: string
  projectId: string
  goal: string
  scope?: string
}

export interface GenerateProjectPlanResponse {
  sessionId: string
  artifactId: string
  milestones: GeneratedMilestone[]
  docs: GeneratedDoc[]
}

export interface GeneratedMilestone {
  title: string
  description: string
  sort_order: number
  tasks: GeneratedTask[]
}

export interface GeneratedTask {
  title: string
  description: string
  task_type: TaskType
  priority: Priority
  estimate_hours: number
}

export interface GeneratedDoc {
  doc_type: DocType
  title: string
  content_md: string
}

export interface BuilderRequest {
  workspaceId: string
  projectId?: string
  mode: BuilderMode
  prompt: string
}

export interface BuilderResponse {
  sessionId: string
  artifactId: string
  content: string
  title: string
}

export interface SeoAuditRequest {
  siteId: string
  targetUrl: string
  scope?: SeoAuditScope
}

export interface SeoAuditResponse {
  auditId: string
  artifactId: string
  pageData: Partial<SeoAuditPage>
  issues: Partial<SeoIssue>[]
  score: number
  summary: string
}

export interface SeoPatchRequest {
  auditId: string
  pageId?: string
}

export interface SeoPatchResponse {
  patches: SeoPatch[]
}
