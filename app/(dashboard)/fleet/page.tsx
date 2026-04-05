import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { getContacts } from '@/modules/contacts/actions/contact.actions'
import { getAssets, getBookings, getRoutes, getSchedules, getAllMedicalRecords, getFleetCrew, getTerminals, getFleetAttendanceToday } from '@/modules/fleet/actions/fleet.actions'
import { FleetClient } from './FleetClient'

export const revalidate = 0

export default async function FleetPage() {
  const session = await auth()
  if (!session?.user?.id) return redirect('/login')

  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  const [assets, bookings, routes, schedules, medicalRecords, crew, terminals, attendanceToday, contacts] = await Promise.all([
    getAssets(orgData.org.id),
    getBookings(orgData.org.id),
    getRoutes(orgData.org.id),
    getSchedules(orgData.org.id),
    getAllMedicalRecords(orgData.org.id),
    getFleetCrew(orgData.org.id),
    getTerminals(orgData.org.id),
    getFleetAttendanceToday(orgData.org.id),
    getContacts(orgData.org.id),
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
        attendanceToday={attendanceToday}
        contacts={contacts}
      />
    </div>
  )
}
