/**
 * Lightweight validation helpers — no external dependencies.
 * Throw ValidationError so the API wrapper can return 400 automatically.
 */

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/** Asserts value is a non-empty string, optionally with min/max length. */
export function requireString(
  value: unknown,
  field: string,
  opts: { min?: number; max?: number } = {}
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${field} is required`, field)
  }
  const trimmed = value.trim()
  const { min = 1, max } = opts
  if (trimmed.length < min)
    throw new ValidationError(`${field} must be at least ${min} characters`, field)
  if (max && trimmed.length > max)
    throw new ValidationError(`${field} must be at most ${max} characters`, field)
  return trimmed
}

/** Asserts value is a valid absolute URL string. */
export function requireUrl(value: unknown, field: string): string {
  const str = requireString(value, field)
  try {
    const parsed = new URL(str)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new ValidationError(`${field} must use http or https`, field)
    }
  } catch (e) {
    if (e instanceof ValidationError) throw e
    throw new ValidationError(`${field} must be a valid URL`, field)
  }
  return str
}

/** Validates an optional string — returns undefined if absent/empty. */
export function optionalString(
  value: unknown,
  field: string,
  opts: { max?: number } = {}
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return requireString(value, field, opts)
}

/** Validates an optional UUID string. */
export function optionalUuid(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const str = requireString(value, field)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(str)) throw new ValidationError(`${field} must be a valid UUID`, field)
  return str
}

/** Validates a required UUID. */
export function requireUuid(value: unknown, field: string): string {
  const str = requireString(value, field)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(str)) throw new ValidationError(`${field} must be a valid UUID`, field)
  return str
}

/** Validates a value is one of allowed string literals. */
export function requireOneOf<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[]
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ValidationError(
      `${field} must be one of: ${allowed.join(', ')}`,
      field
    )
  }
  return value as T
}
