/**
 * Prompt templates for each AI module.
 */

export const SYSTEM_PROMPTS = {
  ideas: `You are a business idea advisor for a service business team.
Generate practical, actionable ideas in response to the user's brief.
Always respond with valid JSON matching the specified schema.
IMPORTANT: Return raw JSON only — do NOT wrap it in markdown code fences (\`\`\`json ... \`\`\`).
Focus on ideas that can realistically be implemented by a small internal team.
You must respond strictly in Thai language in all textual content.`,

  project: `You are a senior project manager and software architect.
Generate a structured project plan with milestones, tasks, and documentation.
Always respond with valid JSON matching the specified schema.
IMPORTANT: Return raw JSON only — do NOT wrap it in markdown code fences (\`\`\`json ... \`\`\`).
Be practical and specific — not generic.
You must respond strictly in Thai language in all textual content.`,

  builder: `You are a senior full-stack engineer.
Generate clean, production-ready code and technical artifacts.
Include comments where helpful but avoid over-engineering.
Output well-structured code with proper TypeScript types.
You must respond strictly in Thai language in all explanations, comments, and documentation.`,

  seo: `You are an expert SEO consultant with 10+ years of experience.
Analyze the provided page data and give a practical, prioritized summary.
Focus on actionable improvements that will have real impact.
Be specific about what to change and why.
You must respond strictly in Thai language.`,

  chat: `You are a helpful AI assistant for an internal team.
Answer questions accurately and constructively.
You must respond strictly in Thai language in all textual content unless asked otherwise.

IMPORTANT — when a [เอกสารภายในที่เกี่ยวข้อง] or [ข้อมูลที่เกี่ยวข้องจาก workspace] section is provided in the context:
- Treat it as the authoritative source of truth for prices, specifications, and company-specific data.
- Quote prices, figures, and details EXACTLY as stated in the document — do NOT use your general training knowledge for factual data.
- If the document contradicts general knowledge, always prefer the document.
- Cite "ตามเอกสารบริษัท" when quoting document data so the user knows the source.`,
}

export const USER_PROMPTS = {
  ideas: (prompt: string, constraints?: string) => `
Brief: ${prompt}
${constraints ? `Constraints: ${constraints}` : ''}

Generate 10 specific, practical ideas for this service business team.
Return JSON with this exact structure:
{
  "ideas": [
    {
      "title": "string",
      "brief": "string (1-2 sentences)",
      "audience": "string",
      "problem": "string",
      "solution": "string",
      "channel": ["array", "of", "channels"],
      "score_impact": number (1-10),
      "score_ease": number (1-10),
      "score_roi": number (1-10)
    }
  ]
}`,

  project: (goal: string, scope?: string) => `
Project Goal: ${goal}
${scope ? `Scope: ${scope}` : ''}

Generate a detailed project plan.
Return JSON with this exact structure:
{
  "summary": "string",
  "milestones": [
    {
      "title": "string",
      "description": "string",
      "sort_order": number,
      "tasks": [
        {
          "title": "string",
          "description": "string",
          "task_type": "research|planning|backend|frontend|seo|content|qa|deploy",
          "priority": "low|medium|high|critical",
          "estimate_hours": number
        }
      ]
    }
  ],
  "docs": [
    {
      "doc_type": "brief|spec|prd|architecture|api_contract|db_schema|notes",
      "title": "string",
      "content_md": "string (markdown)"
    }
  ]
}`,

  builder: (mode: string, prompt: string) => `
Mode: ${mode}
Request: ${prompt}

Generate the requested ${mode} artifact. Be thorough and production-ready.`,

  seo: (pageData: Record<string, unknown>, issues: Array<{ issue_type: string; message: string }>, competitorContext?: string) => `
Page URL: ${pageData.url}
Title: ${pageData.title ?? 'MISSING'}
Meta Description: ${pageData.meta_description ?? 'MISSING'}
H1: ${pageData.h1 ?? 'MISSING'}
Canonical: ${pageData.canonical_url ?? 'MISSING'}
Word Count: ${pageData.word_count ?? 'Unknown'}
Status Code: ${pageData.status_code}

Detected Issues:
${issues.map((i) => `- [${i.issue_type}] ${i.message}`).join('\n')}

${competitorContext ? `Competitor/Search Context (Tavily):\n${competitorContext}\n` : ''}
Provide a concise SEO analysis and prioritized recommendations (plain text, not JSON). Compare against competitors if context is provided.`,

  seoPatch: (pageData: Record<string, unknown>, issues: Array<{ issue_type: string; message: string }>) => `
Page data:
${JSON.stringify(pageData, null, 2)}

Issues detected:
${issues.map((i) => `- ${i.issue_type}: ${i.message}`).join('\n')}

Generate specific patch suggestions in raw JSON (no code fences):
{
  "patches": [
    {
      "patch_type": "update_title|update_meta_description|set_canonical|rewrite_content|add_alt_text",
      "before": "current value",
      "after": "suggested improved value",
      "reason": "why this change improves SEO"
    }
  ]
}`,

  chat: (prompt: string, context?: string) => `
${context ? `Context:\n${context}\n\n` : ''}User request:
${prompt}`
}
