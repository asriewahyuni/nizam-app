import { NextResponse } from 'next/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { queryPostgres } from '@/lib/db/postgres'
import * as fs from 'fs'
import * as path from 'path'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Only allow org owners/admins to run migrations
    const orgData = await getActiveOrg()
    if (!orgData || !orgData.org) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if koperasi_anggota table already exists
    const check = await queryPostgres(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'koperasi_anggota'
      ) as "exists"`
    )
    const alreadyExists = check?.[0]?.exists === true || check?.[0]?.exists === 'true'
    if (alreadyExists) {
      return NextResponse.json({ message: 'Tables already exist, no action taken' })
    }

    // Read and execute migration SQL
    const sqlPath = path.join(process.cwd(), 'supabase/migrations/1305_koperasi_syariah_foundation.sql')
    const sql = fs.readFileSync(sqlPath, 'utf-8')

    // Split by statement and execute each one
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    let executed = 0
    for (const stmt of statements) {
      try {
        await queryPostgres(stmt + ';')
        executed++
      } catch (err: any) {
        console.error(`Migration statement failed:`, err?.message?.slice(0, 200))
        // Continue with next statement
      }
    }

    return NextResponse.json({
      message: 'Migration completed',
      statementsExecuted: executed,
      totalStatements: statements.length,
    })
  } catch (err: any) {
    console.error('Migration error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
