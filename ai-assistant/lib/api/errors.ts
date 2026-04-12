/**
 * Standardized API error helpers.
 *
 * All route handlers should:
 *   1. catch ValidationError → 400
 *   2. catch any other error → 500
 *
 * Use handleRouteError() in every catch block instead of
 * duplicating error-type checks across routes.
 */
import { NextResponse } from 'next/server'
import { ValidationError } from './validate'

export function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Unified catch-block handler for API routes.
 * - ValidationError  → 400 with the validation message
 * - Everything else  → 500 with a generic message (details in server log)
 */
export function handleRouteError(err: unknown, context: string): NextResponse {
  if (err instanceof ValidationError) {
    return NextResponse.json(
      { error: err.message, field: err.field ?? null },
      { status: 400 }
    )
  }
  const msg = err instanceof Error ? err.message : 'Internal server error'
  console.error(`[${context}]`, err)
  return NextResponse.json({ error: msg }, { status: 500 })
}
