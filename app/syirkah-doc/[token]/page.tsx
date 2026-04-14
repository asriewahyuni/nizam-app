import { getSyirkahContractByToken } from '@/modules/syirkah/actions/syirkah.actions'
import { CheckCircle, AlertOctagon, Briefcase, Handshake, Users, ShieldCheck } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import PrintButton from './PrintButton'

export const metadata = {
  title: 'Validasi Akad Syirkah | Nizam ERP',
}

export default async function SyirkahDocumentValidationPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = await params
  const contract = await getSyirkahContractByToken(resolvedParams.token)

  if (!contract) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center">
          <AlertOctagon size={48} className="mx-auto text-rose-500 mb-4" />
          <h1 className="text-xl font-black text-slate-800 mb-2">Dokumen Tidak Valid</h1>
          <p className="text-sm text-slate-500">
            Token QR ini tidak dikenali atau dokumen telah dihapus dari sistem Nizam ERP.
          </p>
        </div>
      </div>
    )
  }

  const { title, status, debt_allocation, current_debt, organizations, syirkah_members } = contract
  const orgName = organizations?.name || 'Organisasi Terdaftar'

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 print:p-0 print:bg-white">
      <div className="max-w-3xl w-full mx-auto">
        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100 print:shadow-none print:border-none print:rounded-none">
          
          <div className="bg-[#003366] p-8 text-white text-center rounded-b-[2rem] print:bg-transparent print:text-black print:p-0 print:pb-6 print:border-b-2 print:border-black print:rounded-none">
            <Handshake size={48} className="mx-auto mb-4 text-emerald-400 print:text-black" strokeWidth={1.5} />
            <div className="inline-flex items-center gap-2 mb-2 px-3 py-1 bg-white/10 rounded-full print:bg-transparent print:border print:border-black">
              <ShieldCheck size={16} className="text-emerald-400 print:text-black" />
              <span className="text-xs font-black tracking-widest uppercase">Verified by Nizam ERP</span>
            </div>
            <h1 className="text-3xl font-black tracking-tighter mt-4 mb-2">{title}</h1>
            <p className="opacity-80 font-medium">Berdasarkan data operasional: {orgName}</p>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
               <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 print:border-black print:bg-transparent">
                  <h3 className="text-xs font-black uppercase text-amber-600 tracking-widest mb-1 print:text-black">Status Kontrak</h3>
                  <p className="text-lg font-bold text-slate-900">{status}</p>
               </div>
               <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 print:border-black print:bg-transparent">
                  <h3 className="text-xs font-black uppercase text-blue-600 tracking-widest mb-1 print:text-black">Limit Alokasi Hutang Keseluruhan</h3>
                  <p className="text-lg font-bold text-slate-900">{formatRupiah(debt_allocation || 0)}</p>
               </div>
            </div>

            <h3 className="font-black text-xl text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
              <Users size={20} className="text-blue-600 print:hidden"/>
              Daftar Anggota Sah
            </h3>

            <div className="space-y-4">
              {syirkah_members?.map((m: any, i: number) => (
                <div key={i} className="flex flex-col md:flex-row justify-between p-4 border border-slate-100 rounded-2xl print:border-black bg-slate-50/20">
                  <div className="flex-1">
                    <h5 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      {m.member_name} 
                      <span className={`text-[10px] uppercase font-black px-2 py-1 rounded-md ${m.role === 'PEMODAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} print:bg-transparent print:border print:border-black print:text-black`}>
                        {m.role}
                      </span>
                    </h5>
                    <p className="text-sm text-slate-500 mt-2"><span className="font-bold text-slate-700">Tanggung Jawab:</span> {m.responsibility || '-'}</p>
                  </div>
                  <div className="mt-4 md:mt-0 md:text-right border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6 print:border-black">
                     <span className="block text-[10px] uppercase font-black tracking-wider text-slate-400 mb-1">Porsi Bagi Hasil</span>
                     <span className="font-black text-2xl text-blue-600 print:text-black">{m.profit_share_percentage}%</span>
                     {m.role === 'PEMODAL' && (
                       <div className="mt-2">
                         <span className="block text-[10px] uppercase font-black tracking-wider text-emerald-600 mb-1 print:text-black">Modal Awal</span>
                         <span className="font-bold text-sm text-slate-700">{formatRupiah(m.capital_contribution)}</span>
                       </div>
                     )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center text-sm font-medium text-slate-400 pt-6 border-t border-slate-100 print:border-black">
              <p>Mencetak dokumen ini sama dengan menerima secara sah bahwa data telah direkam pada sistem Cloud ERP NIZAM.</p>
              <PrintButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
