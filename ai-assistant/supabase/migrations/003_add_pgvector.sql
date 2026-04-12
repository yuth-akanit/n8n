-- ============================================================
-- Migration 003: pgvector for RAG on artifacts + tags on ideas/projects
-- ============================================================

-- Enable pgvector (already on in Supabase by default)
create extension if not exists vector;

-- Embedding column (OpenAI text-embedding-3-small = 1536 dims)
alter table artifacts add column if not exists embedding vector(1536);

-- IVFFlat index for cosine similarity search
create index if not exists artifacts_embedding_idx
  on artifacts using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- RPC function used by the app to find similar artifacts
create or replace function match_artifacts(
  query_embedding vector(1536),
  workspace_id_param uuid,
  match_count      int   default 3,
  match_threshold  float default 0.6
)
returns table (
  id            uuid,
  title         text,
  content       text,
  artifact_type text,
  similarity    float
)
language sql stable
as $$
  select
    a.id,
    a.title,
    left(a.content, 2000) as content,
    a.artifact_type::text,
    1 - (a.embedding <=> query_embedding) as similarity
  from artifacts a
  where a.workspace_id = workspace_id_param
    and a.is_latest    = true
    and a.embedding    is not null
    and 1 - (a.embedding <=> query_embedding) > match_threshold
  order by a.embedding <=> query_embedding
  limit match_count;
$$;

-- Tags on ideas and projects
alter table ideas    add column if not exists tags text[] not null default '{}';
alter table projects add column if not exists tags text[] not null default '{}';
