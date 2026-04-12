-- ============================================================
-- Migration 007: Add 'image' to artifact_type check constraint
-- ============================================================

alter table artifacts
  drop constraint if exists artifacts_artifact_type_check;

alter table artifacts
  add constraint artifacts_artifact_type_check
  check (artifact_type in (
    'idea_doc', 'project_plan', 'markdown', 'json',
    'sql', 'code', 'seo_report', 'patch', 'image'
  ));
