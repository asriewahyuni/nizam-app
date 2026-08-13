/**
 * Builds sanitized, actionable metadata for unhandled Next.js request errors.
 */

type RequestErrorRequest = Readonly<{
  path?: string
  method?: string
}>

type RequestErrorRouteContext = Readonly<{
  routerKind?: string
  routePath?: string
  routeType?: string
  renderSource?: string
  revalidateReason?: string
}>

type DatabaseError = Error & {
  code?: unknown
  severity?: unknown
  schema?: unknown
  table?: unknown
  column?: unknown
  constraint?: unknown
  routine?: unknown
}

function optionalText(value: unknown) {
  const normalized = String(value || '').trim()
  return normalized || undefined
}

function classifyError(error: DatabaseError) {
  const code = optionalText(error.code)
  const message = error.message.toLowerCase()

  if (code === '22007' || message.includes('invalid input syntax for type date')) {
    return {
      category: 'Invalid date input',
      hint: message.includes('type date: ""')
        ? 'A POST/server action passed an empty string to a PostgreSQL date column. Normalize optional form dates from "" to null, or reject required dates before the query.'
        : 'Validate and normalize the date value before sending it to PostgreSQL.',
    }
  }

  if (code === '22P02') {
    return {
      category: 'Invalid database input',
      hint: 'A value does not match the PostgreSQL column type. Validate the request payload before the query.',
    }
  }

  if (code === '23505') {
    return {
      category: 'Unique constraint violation',
      hint: 'The operation attempted to create a duplicate record. Handle the conflict in the originating action.',
    }
  }

  return {
    category: code ? 'PostgreSQL request error' : 'Unhandled request error',
    hint: code
      ? 'Use the request route and PostgreSQL metadata below to locate the originating action/query.'
      : 'Use the request route and stack trace to locate the originating action.',
  }
}

export function buildRequestErrorContext(
  errorValue: unknown,
  request: RequestErrorRequest | undefined,
  routeContext: RequestErrorRouteContext | undefined,
) {
  const error = errorValue instanceof Error
    ? errorValue as DatabaseError
    : new Error(String(errorValue)) as DatabaseError
  const classification = classifyError(error)

  return {
    RequestPath: optionalText(request?.path) || optionalText(routeContext?.routePath) || 'Unknown path',
    RoutePath: optionalText(routeContext?.routePath) || 'Unknown route',
    Method: optionalText(request?.method) || 'Unknown method',
    RouterKind: optionalText(routeContext?.routerKind) || 'Unknown router',
    RouteType: optionalText(routeContext?.routeType) || 'Unknown route type',
    RenderSource: optionalText(routeContext?.renderSource),
    ErrorCategory: classification.category,
    ErrorMessage: error.message,
    DatabaseCode: optionalText(error.code),
    DatabaseSeverity: optionalText(error.severity),
    DatabaseSchema: optionalText(error.schema),
    DatabaseTable: optionalText(error.table),
    DatabaseColumn: optionalText(error.column),
    DatabaseConstraint: optionalText(error.constraint),
    DatabaseRoutine: optionalText(error.routine),
    DiagnosticHint: classification.hint,
    ErrorStack: optionalText(error.stack)?.substring(0, 1_500) || 'N/A',
  }
}
