import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CreateCourseForm from './CreateCourseForm'

export const metadata = {
  title: 'Program Baru — Nizam LMS Admin',
}

export default async function NewCoursePage() {
  const orgData = await getActiveOrg()
  if (!orgData) return redirect('/onboarding')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link href="/lms/admin" className="text-xs font-semibold text-slate-500 hover:text-indigo-600 mb-2 inline-block">
          &larr; Kembali ke Katalog
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Buat Program Baru</h1>
        <p className="mt-1 text-slate-500">
          Isi detail dasar program. Anda dapat menambahkan kurikulum materi nanti.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <CreateCourseForm />
      </div>
    </div>
  )
}
