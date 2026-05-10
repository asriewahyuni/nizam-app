import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = (await createClient()) as any
  const orgId = '5fcb8375-fab4-4ea7-96a9-742d68ea85d0'
  const branchId = '6dfecbb8-793a-4448-bb36-98e8b090837f'
  const oldBudiId = 'b193c542-4dd9-491c-ac8a-0b75e8f03c53'

  const steps: string[] = []

  // 1. Delete old Budi
  const { error: delErr, data: delData } = await db
    .from('employees')
    .delete()
    .eq('id', oldBudiId)
    .eq('org_id', orgId)
    .select()
  steps.push(delErr ? `❌ Delete: ${delErr.message}` : `✅ Deleted: ${delData?.length || 0} rows`)

  // 2. Create new Budi with correct salary
  const { error: createErr, data: newEmp } = await db
    .from('employees')
    .insert({
      nik: 'EMP05260009',
      first_name: 'Budi',
      last_name: 'Santoso',
      email: 'budi.santoso@bisnispelatihan.com',
      gender: 'M',
      job_title: 'Manager',
      employment_status: 'FULL_TIME',
      basic_salary: 10000000,
      org_id: orgId,
      branch_id: branchId,
      whatsapp: '628123456701',
      bank_name: 'Bank Mandiri',
      bank_account_number: '1112223331',
      tax_status: 'TK/1',
      join_date: '2026-05-10',
      registration_status: 'PENDING',
    })
    .select()
  steps.push(createErr ? `❌ Create: ${createErr.message}` : `✅ Created: NIK=${newEmp?.[0]?.nik} salary=${newEmp?.[0]?.basic_salary}`)

  // 3. Verify
  const { data: employees } = await db
    .from('employees')
    .select('id, nik, first_name, last_name, job_title, basic_salary')
    .eq('org_id', orgId)
    .eq('branch_id', branchId)
    .order('created_at')
  steps.push(`📊 Total employees: ${employees?.length || 0}`)
  if (employees?.length) {
    employees.forEach((e: any) => steps.push(`   ${e.first_name} ${e.last_name} | ${e.nik} | ${e.job_title} | Rp ${e.basic_salary}`))
  }

  return NextResponse.json({ steps })
}
