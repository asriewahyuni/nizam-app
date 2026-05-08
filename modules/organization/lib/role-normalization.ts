/**
 * Normalizes organization role fields that may arrive as JavaScript arrays,
 * JSON strings, or Postgres array literals depending on the backend path.
 */
const DEPARTMENT_VALUE_ALIASES: Record<string, string> = {
  IT: 'CONFIG',
}

function dedupeNonEmpty(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  )
}

function parsePostgresArrayLiteral(value: string) {
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return [trimmed]
  }

  const body = trimmed.slice(1, -1)
  if (!body) return []

  const items: string[] = []
  let current = ''
  let inQuotes = false
  let isEscaped = false

  for (const char of body) {
    if (isEscaped) {
      current += char
      isEscaped = false
      continue
    }

    if (char === '\\') {
      isEscaped = true
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      items.push(current)
      current = ''
      continue
    }

    current += char
  }

  items.push(current)

  return dedupeNonEmpty(
    items
      .map((item) => item.trim())
      .map((item) => (item.toUpperCase() === 'NULL' ? '' : item))
  )
}

function normalizeStringArray(values: unknown) {
  if (Array.isArray(values)) {
    return dedupeNonEmpty(
      values.flatMap((value) => normalizeStringArray(value))
    )
  }

  if (typeof values === 'string') {
    const trimmed = values.trim()
    if (!trimmed) return []

    if (trimmed.startsWith('[')) {
      try {
        return normalizeStringArray(JSON.parse(trimmed) as unknown)
      } catch {
        // Fall through to string parsing below.
      }
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return parsePostgresArrayLiteral(trimmed)
    }

    return dedupeNonEmpty(trimmed.split(','))
  }

  return []
}

export function normalizeDepartmentValue(value: unknown): string {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()

  return DEPARTMENT_VALUE_ALIASES[normalized] || normalized
}

export function normalizeDepartmentIds(values: unknown) {
  return dedupeNonEmpty(
    normalizeStringArray(values).map((value) => normalizeDepartmentValue(value))
  )
}

export function normalizePermissions(values: unknown) {
  return dedupeNonEmpty(normalizeStringArray(values))
}

export function normalizeRoleRecord<T extends Record<string, unknown> & {
  department_ids?: unknown
  department_id?: unknown
  permissions?: unknown
}>(role: T) {
  const normalizedDepartmentIds = normalizeDepartmentIds([
    role.department_ids,
    role.department_id,
  ])

  return {
    ...role,
    department_id: normalizedDepartmentIds[0] || null,
    department_ids: normalizedDepartmentIds,
    permissions: normalizePermissions(role.permissions),
  }
}
