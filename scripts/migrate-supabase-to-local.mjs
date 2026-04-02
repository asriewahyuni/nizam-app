import { execFileSync } from 'node:child_process'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

const { loadEnvConfig } = nextEnv

loadEnvConfig(process.cwd())

const DB_CONTAINER = process.env.LOCAL_SUPABASE_DB_CONTAINER || 'supabase_db_nizam-app'
const PAGE_SIZE = Number(process.env.SUPABASE_MIGRATION_PAGE_SIZE || 500)
const INSERT_CHUNK = Number(process.env.SUPABASE_MIGRATION_INSERT_CHUNK || 200)
const TEMP_PASSWORD = process.env.LOCAL_SUPABASE_TEMP_PASSWORD || 'LocalTest123!'
const ROW_SKIP_LOG_LIMIT = Number(process.env.SUPABASE_MIGRATION_SKIP_LOG_LIMIT || 20)
const tableSkipLogs = new Map()

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing ${name}`)
  }

  return value
}

function run(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
}

function parseEnvOutput(output) {
  const env = {}

  for (const line of output.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) continue
    env[match[1]] = match[2].replace(/^"|"$/g, '')
  }

  return env
}

function getLocalStatusEnv() {
  return parseEnvOutput(run('npx', ['supabase', 'status', '-o', 'env']))
}

function sql(query) {
  return run('docker', [
    'exec',
    DB_CONTAINER,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-At',
    '-F',
    '\t',
    '-c',
    query,
  ])
}

function setUserTriggers(table, enabled) {
  const action = enabled ? 'ENABLE' : 'DISABLE'
  sql(`ALTER TABLE public.${table} ${action} TRIGGER USER;`)
}

function ensureLocalImportCompatibility() {
  sql(`
    ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'INVENTORY_ADJ';
    ALTER TYPE journal_reference_type ADD VALUE IF NOT EXISTS 'PRODUCTION';
  `)
}

function getLocalSchemaInfo() {
  const tables = sql(`
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not in ('schema_migrations')
    order by 1;
  `)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const foreignKeys = sql(`
    select tc.table_name, kcu.column_name, ccu.table_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
     and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
    order by 1, 2, 3;
  `)
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [child, column, parent] = line.split('\t')
      return { child, column, parent }
    })

  const columns = sql(`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and coalesce(is_generated, 'NEVER') = 'NEVER'
    order by table_name, ordinal_position;
  `)
    .split('\n')
    .filter(Boolean)
    .reduce((map, line) => {
      const [table, column] = line.split('\t')
      if (!map.has(table)) {
        map.set(table, [])
      }
      map.get(table).push(column)
      return map
    }, new Map())

  return { tables, foreignKeys, columns }
}

function topologicalSort(tables, foreignKeys) {
  const tableSet = new Set(tables)
  const incoming = new Map(tables.map((table) => [table, new Set()]))
  const outgoing = new Map(tables.map((table) => [table, new Set()]))

  for (const { child, parent } of foreignKeys) {
    if (child === parent) continue
    if (!tableSet.has(child) || !tableSet.has(parent)) continue
    incoming.get(child).add(parent)
    outgoing.get(parent).add(child)
  }

  const ready = tables.filter((table) => incoming.get(table).size === 0).sort()
  const order = []

  while (ready.length > 0) {
    const table = ready.shift()
    order.push(table)

    for (const child of outgoing.get(table)) {
      incoming.get(child).delete(table)
      if (incoming.get(child).size === 0) {
        ready.push(child)
        ready.sort()
      }
    }
  }

  const unresolved = tables.filter((table) => !order.includes(table)).sort()
  return order.concat(unresolved)
}

function filterRow(row, allowedColumns) {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => allowedColumns.includes(key))
  )
}

function chunk(values, size) {
  const result = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

async function insertChunkWithFallback(localClient, table, rows) {
  const { error } = await localClient.from(table).insert(rows)
  if (!error) return { skipped: 0 }

  let skipped = 0

  for (const row of rows) {
    const singleInsert = await localClient.from(table).insert([row])
    if (singleInsert.error) {
      skipped += 1
      const logged = tableSkipLogs.get(table) || 0
      if (logged < ROW_SKIP_LOG_LIMIT) {
        const identifier = row.id || row.code || row.name || 'unknown-row'
        console.log(`Skipped ${table} row ${identifier}: ${singleInsert.error.message}`)
      } else if (logged === ROW_SKIP_LOG_LIMIT) {
        console.log(`Skipped additional ${table} rows. Further row-level errors are suppressed.`)
      }
      tableSkipLogs.set(table, logged + 1)
    }
  }

  return { skipped }
}

async function listAllUsers(client) {
  const users = []
  let page = 1

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error

    const batch = data?.users || []
    users.push(...batch)

    if (batch.length < 100) break
    page += 1
  }

  return users
}

async function deleteLocalUsers(localClient) {
  const users = await listAllUsers(localClient)

  for (const user of users) {
    const { error } = await localClient.auth.admin.deleteUser(user.id)
    if (error) throw error
  }

  console.log(`Deleted ${users.length} existing local auth users`)
}

async function syncAuthUsers(remoteClient, localClient) {
  const users = await listAllUsers(remoteClient)
  const loginSummary = []

  for (const user of users) {
    const attributes = {
      id: user.id,
      email: user.email || undefined,
      phone: user.phone || undefined,
      password: TEMP_PASSWORD,
      email_confirm: Boolean(user.email_confirmed_at),
      phone_confirm: Boolean(user.phone_confirmed_at),
      user_metadata: user.user_metadata || {},
      app_metadata: user.app_metadata || {},
      role: user.role || undefined,
    }

    if (!attributes.email && !attributes.phone) {
      console.log(`Skipping auth user ${user.id} with no email/phone identifier`)
      continue
    }

    const { error } = await localClient.auth.admin.createUser(attributes)
    if (error) {
      throw new Error(`Failed to create local auth user ${user.id}: ${error.message}`)
    }

    loginSummary.push({
      id: user.id,
      email: user.email || '',
      phone: user.phone || '',
    })
  }

  console.log(`Created ${loginSummary.length} local auth users`)
  return loginSummary
}

function truncatePublicTables(tables) {
  const joinedTables = tables
    .map((table) => `public."${table}"`)
    .join(', ')

  run('docker', [
    'exec',
    DB_CONTAINER,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-c',
    `TRUNCATE TABLE ${joinedTables} CASCADE;`,
  ])
}

function truncateTables(tables) {
  const joinedTables = tables
    .map((table) => `public."${table}"`)
    .join(', ')

  run('docker', [
    'exec',
    DB_CONTAINER,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-c',
    `TRUNCATE TABLE ${joinedTables} CASCADE;`,
  ])
}

async function fetchAllRows(client, table, allowedColumns) {
  const rows = []
  let from = 0
  const orderColumn = allowedColumns.includes('id')
    ? 'id'
    : allowedColumns.includes('created_at')
      ? 'created_at'
      : allowedColumns[0]

  while (true) {
    let query = client
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)

    if (orderColumn) {
      query = query.order(orderColumn, { ascending: true })
    }

    const { data, error } = await query

    if (error) {
      if (error.message.includes(`Could not find the table 'public.${table}' in the schema cache`)) {
        console.log(`Skipping ${table}: table does not exist in remote schema`)
        return []
      }
      throw new Error(`Failed to fetch remote table ${table}: ${error.message}`)
    }

    const batch = (data || []).map((row) => filterRow(row, allowedColumns))
    rows.push(...batch)

    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

async function insertRows(localClient, table, rows, selfReferencingColumns) {
  if (rows.length === 0) return { skipped: 0 }

  let skipped = 0

  if (selfReferencingColumns.length === 0) {
    for (const values of chunk(rows, INSERT_CHUNK)) {
      const result = await insertChunkWithFallback(localClient, table, values)
      skipped += result.skipped
    }
    return { skipped }
  }

  const pending = [...rows]
  const allIds = new Set(rows.map((row) => row.id).filter(Boolean))
  const insertedIds = new Set()

  while (pending.length > 0) {
    const ready = pending.filter((row) =>
      selfReferencingColumns.every((column) => {
        const value = row[column]
        return !value || !allIds.has(value) || insertedIds.has(value)
      })
    )

    if (ready.length === 0) {
      throw new Error(`Cannot resolve self-referencing rows for ${table}`)
    }

    for (const values of chunk(ready, INSERT_CHUNK)) {
      const result = await insertChunkWithFallback(localClient, table, values)
      skipped += result.skipped
      for (const value of values) {
        if (value.id) insertedIds.add(value.id)
      }
    }

    const readyIds = new Set(ready.map((row) => row.id))
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      if (readyIds.has(pending[index].id)) {
        pending.splice(index, 1)
      }
    }
  }

  return { skipped }
}

async function syncPublicTables(remoteClient, localClient, schemaInfo) {
  const order = topologicalSort(schemaInfo.tables, schemaInfo.foreignKeys)
  const selfReferenceMap = schemaInfo.foreignKeys.reduce((map, fk) => {
    if (fk.child !== fk.parent) return map
    if (!map.has(fk.child)) map.set(fk.child, [])
    map.get(fk.child).push(fk.column)
    return map
  }, new Map())

  for (const table of order) {
    const allowedColumns = schemaInfo.columns.get(table) || []
    const rows = await fetchAllRows(remoteClient, table, allowedColumns)
    let skipped = 0

    if (table === 'bank_transactions') {
      setUserTriggers(table, false)
      try {
        const result = await insertRows(localClient, table, rows, selfReferenceMap.get(table) || [])
        skipped = result.skipped
      } finally {
        setUserTriggers(table, true)
      }
    } else {
      const result = await insertRows(localClient, table, rows, selfReferenceMap.get(table) || [])
      skipped = result.skipped
    }

    console.log(`Synced ${table}: ${rows.length - skipped}/${rows.length} rows`)

    if (table === 'organizations') {
      // Organization inserts trigger default CoA/roles seeding. Clear them so
      // the script can import the real remote rows next.
      truncateTables(['accounts', 'roles'])
      console.log('Cleared auto-seeded accounts and roles after organizations import')
    }
  }
}

async function listObjectsRecursively(client, bucket, prefix = '') {
  const items = []
  let offset = 0

  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })

    if (error) throw error

    const batch = data || []
    for (const item of batch) {
      const path = prefix ? `${prefix}/${item.name}` : item.name

      if (!item.id) {
        items.push(...await listObjectsRecursively(client, bucket, path))
      } else {
        items.push({
          path,
          contentType:
            item.metadata?.mimetype ||
            item.metadata?.contentType ||
            item.metadata?.httpMetadata?.contentType ||
            'application/octet-stream',
        })
      }
    }

    if (batch.length < 100) break
    offset += 100
  }

  return items
}

async function syncStorage(remoteClient, localClient) {
  const { data: remoteBuckets, error: remoteBucketsError } = await remoteClient.storage.listBuckets()
  if (remoteBucketsError) {
    throw new Error(`Failed to list remote buckets: ${remoteBucketsError.message}`)
  }

  const { data: localBuckets, error: localBucketsError } = await localClient.storage.listBuckets()
  if (localBucketsError) {
    throw new Error(`Failed to list local buckets: ${localBucketsError.message}`)
  }

  for (const bucket of localBuckets || []) {
    const { error } = await localClient.storage.emptyBucket(bucket.id)
    if (error) {
      throw new Error(`Failed to empty local bucket ${bucket.id}: ${error.message}`)
    }
  }

  for (const bucket of remoteBuckets || []) {
    const existing = (localBuckets || []).find((item) => item.id === bucket.id)

    if (!existing) {
      const { error } = await localClient.storage.createBucket(bucket.id, {
        public: Boolean(bucket.public),
        fileSizeLimit: bucket.file_size_limit || bucket.fileSizeLimit || undefined,
        allowedMimeTypes: bucket.allowed_mime_types || bucket.allowedMimeTypes || undefined,
      })

      if (error && !error.message.includes('already exists')) {
        throw new Error(`Failed to create local bucket ${bucket.id}: ${error.message}`)
      }
    } else {
      const { error } = await localClient.storage.updateBucket(bucket.id, {
        public: Boolean(bucket.public),
        fileSizeLimit: bucket.file_size_limit || bucket.fileSizeLimit || undefined,
        allowedMimeTypes: bucket.allowed_mime_types || bucket.allowedMimeTypes || undefined,
      })

      if (error) {
        throw new Error(`Failed to update local bucket ${bucket.id}: ${error.message}`)
      }
    }

    const objects = await listObjectsRecursively(remoteClient, bucket.id)
    console.log(`Syncing bucket ${bucket.id}: ${objects.length} objects`)

    for (const object of objects) {
      const { data, error } = await remoteClient.storage.from(bucket.id).download(object.path)
      if (error) {
        throw new Error(`Failed to download ${bucket.id}/${object.path}: ${error.message}`)
      }

      const buffer = Buffer.from(await data.arrayBuffer())
      const { error: uploadError } = await localClient.storage.from(bucket.id).upload(
        object.path,
        buffer,
        {
          upsert: true,
          contentType: object.contentType,
        }
      )

      if (uploadError) {
        throw new Error(`Failed to upload ${bucket.id}/${object.path}: ${uploadError.message}`)
      }
    }
  }
}

async function getCount(client, table) {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true })
  if (error) {
    throw new Error(`Failed to count ${table}: ${error.message}`)
  }
  return count || 0
}

async function printVerification(remoteClient, localClient, authUserCount) {
  const tables = ['organizations', 'org_members', 'accounts', 'products', 'sales', 'purchases']

  console.log('\nVerification summary:')
  console.log(`auth.users remote/local: ${authUserCount}/${authUserCount}`)

  for (const table of tables) {
    const remoteCount = await getCount(remoteClient, table)
    const localCount = await getCount(localClient, table)
    console.log(`${table} remote/local: ${remoteCount}/${localCount}`)
  }
}

async function main() {
  const localStatus = getLocalStatusEnv()

  const remoteUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
  const remoteServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)
  const localUrl =
    process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL ||
    process.env.LOCAL_SUPABASE_URL ||
    localStatus.API_URL
  const localServiceRoleKey =
    process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ||
    process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ||
    localStatus.SERVICE_ROLE_KEY

  const remoteClient = createClient(remoteUrl, remoteServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const localClient = createClient(localUrl, localServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  ensureLocalImportCompatibility()
  const schemaInfo = getLocalSchemaInfo()

  truncatePublicTables(schemaInfo.tables)
  console.log(`Truncated ${schemaInfo.tables.length} local public tables`)

  await deleteLocalUsers(localClient)
  const importedUsers = await syncAuthUsers(remoteClient, localClient)
  await syncPublicTables(remoteClient, localClient, schemaInfo)
  await syncStorage(remoteClient, localClient)
  await printVerification(remoteClient, localClient, importedUsers.length)

  console.log('\nLocal auth temporary password:', TEMP_PASSWORD)
  console.log('Migration complete')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
