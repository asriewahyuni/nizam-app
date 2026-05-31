import { notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { CalendarDays, Users, Banknote, BookOpen, Clock } from 'lucide-react'
import { getPublicBatchInfo, getBatchRegisteredCount } from '@/modules/edu/actions/lms-registration.actions'
import RegistrationForm from './RegistrationForm'

export async function generateMetadata({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params
  const batch = await getPublicBatchInfo(batchId)
  if (!batch) return { title: 'Batch Tidak Ditemukan' }
  return {
    title: `Daftar: ${batch.name}`,
    description: `Daftarkan diri Anda untuk ${batch.name}`,
  }
}

export default async function PublicRegistrationPage({
  params,
}: {
  params: Promise<{ batchId: string }>
}) {
  noStore()
  const { batchId } = await params
  const [batch, registeredCount] = await Promise.all([
    getPublicBatchInfo(batchId),
    getBatchRegisteredCount(batchId),
  ])

  if (!batch) notFound()

  const course = (batch as any).learning_courses
  const isFull = Number(batch.quota) > 0 && registeredCount >= Number(batch.quota)
  const isClosed = batch.status === 'CLOSED' || batch.status === 'COMPLETED'
  const canRegister = !isFull && !isClosed

  const slotsLeft = Number(batch.quota) > 0 ? Number(batch.quota) - registeredCount : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-slate-700">Training Center</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">

          {/* Left: Info Batch */}
          <div className="space-y-6">
            {/* Badge status */}
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${
                isClosed || isFull
                  ? 'bg-red-50 text-red-600 border-red-100'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-100'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isClosed || isFull ? 'bg-red-500' : 'bg-emerald-500'}`} />
                {isClosed ? 'Ditutup' : isFull ? 'Penuh' : 'Pendaftaran Dibuka'}
              </span>
            </div>

            {/* Judul */}
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">
                {course?.title || 'Program Pelatihan'}
              </p>
              <h1 className="text-3xl font-black text-slate-900 leading-tight">
                {batch.name}
              </h1>
              {course?.description && (
                <p className="mt-3 text-base text-slate-600 leading-relaxed">
                  {course.description}
                </p>
              )}
            </div>

            {/* Info cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Banknote className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wide">Biaya</span>
                </div>
                <p className="text-xl font-black text-slate-900">
                  {Number(batch.price) === 0
                    ? 'Gratis'
                    : formatRupiah(batch.price)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wide">Peserta</span>
                </div>
                <p className="text-xl font-black text-slate-900">
                  {Number(batch.quota) === 0 ? 'Tidak terbatas' : `${slotsLeft} slot tersisa`}
                </p>
                {Number(batch.quota) > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">{registeredCount} sudah daftar</p>
                )}
              </div>

              {batch.start_date && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <CalendarDays className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">Mulai</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {new Date(batch.start_date).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                </div>
              )}

              {batch.end_date && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">Selesai</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {new Date(batch.end_date).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Deskripsi batch (description field) */}
            {(batch as any).description && (
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-3">Tentang Program Ini</h3>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {(batch as any).description}
                </p>
              </div>
            )}
          </div>

          {/* Right: Form Pendaftaran */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
              <h2 className="text-lg font-black text-slate-900 mb-1">Form Pendaftaran</h2>
              <p className="text-sm text-slate-500 mb-6">
                Isi data diri Anda dengan benar untuk mendaftar ke batch ini.
              </p>

              {canRegister ? (
                <RegistrationForm
                  batchId={batchId}
                  price={Number(batch.price)}
                  paymentInstructions={(batch as any).payment_instructions || null}
                />
              ) : (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
                  <p className="text-sm font-bold text-red-700">
                    {isFull ? 'Kuota batch ini sudah penuh.' : 'Pendaftaran batch ini sudah ditutup.'}
                  </p>
                  <p className="mt-1 text-xs text-red-500">Silakan hubungi penyelenggara untuk informasi lebih lanjut.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
