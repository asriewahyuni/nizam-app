import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getAssets, getBookings, getRoutes, getSchedules, getAllMedicalRecords, getFleetCrew, getTerminals } from '@/modules/fleet/actions/fleet.actions'
import { FleetClient } from './FleetClient'

export const revalidate = 0

export default async function FleetPage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]
  const [assets, bookings, routes, schedules, medicalRecords, crew, terminals, { data: attendanceToday }, { data: contacts }] = await Promise.all([
    getAssets(orgData.org.id),
    getBookings(orgData.org.id),
    getRoutes(orgData.org.id),
    getSchedules(orgData.org.id),
    getAllMedicalRecords(orgData.org.id),
    getFleetCrew(orgData.org.id),
    getTerminals(orgData.org.id),
    supabase.from('attendance').select('*, employee:employees(first_name, last_name)').eq('org_id', orgData.org.id).eq('record_date', today),
    supabase.from('contacts').select('id, name').eq('org_id', orgData.org.id)
  ])

  return (
    <div className="p-4 md:p-8 min-h-screen bg-slate-50/30">
      <FleetClient 
        orgId={orgData.org.id}
        assets={assets}
        bookings={bookings}
        routes={routes}
        schedules={schedules}
        medicalRecords={medicalRecords}
        crew={crew}
        terminals={terminals}
        attendanceToday={attendanceToday || []}
        contacts={contacts || []}
      />
    </div>
  )
}
