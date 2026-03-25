import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import { getEmployees } from '@/modules/hris/actions/employee.actions'
import { getPayrollComponents, getPayrollRuns } from '@/modules/hris/actions/payroll.actions'
import { getAccountBalances } from '@/modules/accounting/actions/coa.actions'
import { createClient } from '@/lib/supabase/server'
import HrisClient from './HrisClient'

export default async function HrisPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const supabase = await createClient()
  const { data: roles } = await supabase.from('roles').select('*').eq('org_id', orgData.org.id).order('name')

  const [employees, payrollComponents, accounts, payrollRuns] = await Promise.all([
    getEmployees(orgData.org.id),
    getPayrollComponents(orgData.org.id),
    getAccountBalances(orgData.org.id),
    getPayrollRuns(orgData.org.id)
  ])

  return <HrisClient 
    orgId={orgData.org.id} 
    initialEmployees={employees} 
    initialPayrollComponents={payrollComponents}
    initialPayrollRuns={payrollRuns}
    accounts={accounts}
    settings={orgData.org.settings}
    roles={roles || []}
  />
}
