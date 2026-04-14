import { getSyirkahMemberBySignToken, signSyirkahMember } from '@/modules/syirkah/actions/syirkah.actions'
import { AlertOctagon, CheckCircle, Handshake, ShieldCheck, Users, FileText } from 'lucide-react'
import { redirect } from 'next/navigation'
import SignConfirmButton from './SignConfirmButton'

export const metadata = {
  title: 'Tanda Tangan Digital Akad Syirkah | Nizam ERP',
}

export default async function SyirkahSignPage({ params }: { params: Promise<{ memberToken: string }> }) {
  const resolvedParams = await params
  const member = await getSyirkahMemberBySignToken(resolvedParams.memberToken)

  if (!member) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center">
          <AlertOctagon size={48} className="mx-auto text-rose-500 mb-4" />
          <h1 className="text-xl font-black text-slate-800 mb-2">Link Tidak Valid</h1>
          <p className="text-sm text-slate-500">Token tanda tangan tidak dikenali. Pastikan Anda membuka link yang benar sesuai QR Code Anda.</p>
        </div>
      </div>
    )
  }

  const contract = (member as any).syirkah_contracts
  const org = contract?.organizations
  const alreadySigned = !!member.signed_at

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm mb-4">
            <ShieldCheck size={16} className="text-emerald-500" />
            <span className="text-xs font-black tracking-widest uppercase text-slate-600">Nizam ERP — Tanda Tangan Digital</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{contract?.title || 'Akad Syirkah'}</h1>
          <p className="text-slate-500 mt-2">{org?.name || 'Organisasi Terdaftar'}</p>
        </div>

        {/* Sudah TTD */}
        {alreadySigned ? (
          <div className="bg-white rounded-3xl border-2 border-emerald-300 p-8 text-center shadow-xl">
            <CheckCircle size={56} className="mx-auto text-emerald-500 mb-4" />
            <h2 className="text-2xl font-black text-emerald-800 mb-2">Sudah Ditandatangani</h2>
            <p className="text-slate-500 text-sm">
              Anda telah menandatangani akad ini pada{' '}
              <strong>{new Date(member.signed_at!).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>.
            </p>
            <div className="mt-6 px-4 py-3 bg-emerald-50 rounded-2xl text-sm text-emerald-700 font-medium">
              Tanda tangan digital Anda telah tercatat secara permanen dalam sistem Nizam ERP.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Identitas Penanda Tangan */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                <Users size={18} className="text-blue-600" /> Identitas Anda
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Nama</span>
                  <p className="font-black text-slate-800 text-lg">{member.member_name}</p>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Peran</span>
                  <span className={`px-2 py-1 text-xs font-black rounded-lg inline-block ${
                    member.role === 'PEMODAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>{member.role}</span>
                </div>
                {member.nik && (
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">NIK</span>
                    <p className="font-medium text-slate-700">{member.nik}</p>
                  </div>
                )}
                {member.address && (
                  <div className="col-span-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Alamat</span>
                    <p className="font-medium text-slate-700">{member.address}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Preview Akad */}
            {contract?.clauses?.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm max-h-80 overflow-y-auto">
                <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2 sticky top-0 bg-white pb-2 border-b border-slate-100">
                  <FileText size={18} className="text-blue-600" /> Isi Akad
                </h3>
                <div className="space-y-4">
                  {contract.clauses.map((clause: any, i: number) => (
                    <div key={i}>
                      <h4 className="font-black text-sm text-slate-800 mb-1">Pasal {clause.number}: {clause.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{clause.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info & Confirm */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-start gap-3 mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-200">
                <ShieldCheck size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 leading-relaxed">
                  Dengan menandatangani akad ini, Anda menyatakan telah <strong>membaca, memahami, dan menyetujui</strong> seluruh isi akad syirkah di atas atas dasar kerelaan (<em>ridha</em>) tanpa paksaan dari pihak manapun.
                </p>
              </div>

              <SignConfirmButton memberToken={resolvedParams.memberToken} memberName={member.member_name} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
