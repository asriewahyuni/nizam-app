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

type NewUserRegistrationIdentity = {
  email?: unknown
  nik?: unknown
  role?: unknown
  userId?: unknown
  organization?: {
    id?: unknown
    name?: unknown
    slug?: unknown
  } | null
}

type UserErrorIdentity = {
  user: {
    id?: unknown
    email?: unknown
    user_metadata?: Record<string, unknown> | null
  }
  organization?: {
    id?: unknown
    name?: unknown
    role?: unknown
  } | null
}

type DatabaseError = Error & {
  code?: unknown
  severity?: unknown
  schema?: unknown
  table?: unknown
  column?: unknown
  constraint?: unknown
  routine?: unknown
  address?: unknown
  port?: unknown
  errors?: unknown
}

function optionalText(value: unknown) {
  const normalized = String(value || '').trim()
  return normalized || undefined
}

function getNestedConnectionError(error: DatabaseError) {
  const nestedErrors = Array.isArray(error.errors) ? error.errors : []
  return nestedErrors.find((item): item is DatabaseError => item instanceof Error) || null
}

function classifyError(error: DatabaseError) {
  const nestedError = getNestedConnectionError(error)
  const code = optionalText(error.code) || optionalText(nestedError?.code)
  const message = error.message.toLowerCase()

  if (
    message.includes('connection terminated due to connection timeout')
    || message.includes('connection timeout')
  ) {
    return {
      category: 'Database connection timeout',
      hint: 'PostgreSQL did not establish a connection before the pool deadline. The query is retried automatically; verify database availability, pool saturation, and PG_CONNECT_TIMEOUT_MS if retries are exhausted.',
    }
  }

  if (message.includes('transformalgorithm is not a function')) {
    return {
      category: 'Next.js response stream failure',
      hint: 'The Node/Next.js response stream became invalid while rendering. Use the release/replica fields to identify stale rolling-deployment instances; inspect Sentry for the originating render trace if it repeats on the same release.',
    }
  }

  if (code === 'ECONNREFUSED') {
    return {
      category: 'Database connection refused',
      hint: 'The server could not open the PostgreSQL connection. Verify DATABASE_URL/RAILWAY_DATABASE_URL, hostname, port, and Railway database availability.',
    }
  }

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return {
      category: 'Database hostname resolution failed',
      hint: 'The PostgreSQL hostname could not be resolved. Verify DATABASE_URL/RAILWAY_DATABASE_URL and DNS/network availability.',
    }
  }

  if (code === 'ETIMEDOUT' || code === 'ECONNRESET') {
    return {
      category: 'Database connection interrupted',
      hint: 'The PostgreSQL connection timed out or was reset. Check Railway database availability and network stability.',
    }
  }

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

export function buildNewUserRegistrationContext(identity: NewUserRegistrationIdentity) {
  const organization = identity.organization
  return {
    Email: optionalText(identity.email) || '-',
    NIK: optionalText(identity.nik) || '-',
    Role: optionalText(identity.role) || '-',
    UserId: optionalText(identity.userId) || '-',
    OrganizationId: optionalText(organization?.id) || '-',
    OrganizationName: optionalText(organization?.name) || 'Platform-level / belum terhubung',
    OrganizationSlug: optionalText(organization?.slug) || '-',
  }
}

export function buildUserErrorContext(identity: UserErrorIdentity | null | undefined) {
  if (!identity?.user) return { UserId: 'Anonymous/unknown' }

  const metadata = identity.user.user_metadata || {}
  return {
    UserId: optionalText(identity.user.id) || 'Unknown user',
    InternalUserId: optionalText(metadata.internal_user_id),
    UserName: optionalText(metadata.full_name),
    UserEmail: optionalText(identity.user.email),
    UserNik: optionalText(metadata.login_nik),
    LoginType: optionalText(metadata.login_type),
    OrganizationId: optionalText(identity.organization?.id),
    OrganizationName: optionalText(identity.organization?.name),
    OrganizationRole: optionalText(identity.organization?.role),
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
  const nestedConnectionError = getNestedConnectionError(error)
  const effectiveCode = optionalText(error.code) || optionalText(nestedConnectionError?.code)
  const connectionAddress = optionalText(error.address) || optionalText(nestedConnectionError?.address)
  const connectionPort = optionalText(error.port) || optionalText(nestedConnectionError?.port)
  const fallbackMessage = nestedConnectionError?.message || effectiveCode || 'Unknown error'

  return {
    ReleaseCommit: optionalText(process.env.RAILWAY_GIT_COMMIT_SHA)?.substring(0, 12) || 'Unknown release',
    RailwayReplica: optionalText(process.env.RAILWAY_REPLICA_ID) || optionalText(process.env.HOSTNAME) || 'Unknown instance',
    RequestPath: optionalText(request?.path) || optionalText(routeContext?.routePath) || 'Unknown path',
    RoutePath: optionalText(routeContext?.routePath) || 'Unknown route',
    Method: optionalText(request?.method) || 'Unknown method',
    RouterKind: optionalText(routeContext?.routerKind) || 'Unknown router',
    RouteType: optionalText(routeContext?.routeType) || 'Unknown route type',
    RenderSource: optionalText(routeContext?.renderSource),
    ErrorCategory: classification.category,
    ErrorMessage: optionalText(error.message) || fallbackMessage,
    DatabaseCode: effectiveCode,
    ConnectionTarget: connectionAddress
      ? `${connectionAddress}${connectionPort ? `:${connectionPort}` : ''}`
      : undefined,
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
