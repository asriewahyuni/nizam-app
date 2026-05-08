import { redirect } from 'next/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { createClient } from '@/lib/supabase/server'

export default async function SessionAttendancePage(props: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await props.params
  const orgData = await getActiveOrg()

  if (!orgData) {
    return redirect('/login')
  }

  const supabase = await createClient()

  // 1. Dapatkan detail Sesi
  const { data: session } = await supabase
    .from('lms_batch_sessions')
    .select('*, lms_course_batches(name, learning_courses(title))')
    .eq('id', sessionId)
    .single()

  if (!session) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <XCircle className="h-16 w-16 text-red-500" />
        <h1 className="mt-6 text-2xl font-black text-slate-900">Sesi Tidak Ditemukan</h1>
        <p className="mt-2 text-slate-500">Sesi ini mungkin sudah dihapus atau tidak tersedia.</p>
      </div>
    )
  }

  // 2. Dapatkan Pendaftaran user ini untuk Batch tersebut
  const { data: registration } = await supabase
    .from('lms_registrations')
    .select('*')
    .eq('batch_id', session.batch_id)
    .eq('user_id', orgData.user?.id)
    .single()

  if (!registration) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <XCircle className="h-16 w-16 text-red-500" />
        <h1 className="mt-6 text-2xl font-black text-slate-900">Akses Ditolak</h1>
        <p className="mt-2 text-slate-500">Anda tidak terdaftar dalam batch <strong>{session.lms_course_batches?.name}</strong>.</p>
      </div>
    )
  }

  // 3. Catat Presensi
  const { error } = await supabase.from('lms_session_attendances').insert({
    org_id: orgData.org.id,
    session_id: sessionId,
    registration_id: registration.id,
  })

  // If error is duplicate key, it means already scanned
  const isDuplicate = error?.code === '23505'

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      {isDuplicate ? (
        <>
          <CheckCircle2 className="h-16 w-16 text-emerald-500" />
          <h1 className="mt-6 text-2xl font-black text-slate-900">Sudah Hadir</h1>
          <p className="mt-2 text-slate-500">
            Anda sudah melakukan presensi sebelumnya untuk sesi <strong>{session.title}</strong>.
          </p>
        </>
      ) : error ? (
        <>
          <XCircle className="h-16 w-16 text-red-500" />
          <h1 className="mt-6 text-2xl font-black text-slate-900">Gagal Mencatat Presensi</h1>
          <p className="mt-2 text-slate-500">{error.message}</p>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-16 w-16 text-emerald-500" />
          <h1 className="mt-6 text-2xl font-black text-slate-900">Presensi Berhasil!</h1>
          <p className="mt-2 text-slate-500">
            Kehadiran Anda pada sesi <strong>{session.title}</strong> telah tercatat.
          </p>
        </>
      )}
    </div>
  )
}
