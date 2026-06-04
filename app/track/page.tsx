import { getCargoTracking } from '@/modules/fleet/actions/cargo.actions'
import { Truck, Package, PackageCheck, AlertCircle, Search, MapPin, MapPinOff } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export const revalidate = 0

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ awb?: string }> }) {
  const { awb } = await searchParams
  
  let cargo = null
  let error = null
  
  if (awb) {
    cargo = await getCargoTracking(awb)
    if (!cargo) {
      error = 'Resi tidak ditemukan. Pastikan nomor resi (AWB) sudah benar.'
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
       <div className="max-w-2xl mx-auto space-y-8">
          
          <div className="text-center space-y-2 mt-8">
             <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto text-white shadow-xl shadow-blue-200 mb-6">
                <Truck size={32} />
             </div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight">Lacak Kargo Bus</h1>
             <p className="text-slate-500 font-medium text-sm">Masukkan nomor resi (Airway Bill) Anda di bawah ini.</p>
          </div>

          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
             <form className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                   <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                      <Search size={20} className="text-slate-400" />
                   </div>
                   <input 
                      type="text" 
                      name="awb"
                      defaultValue={awb || ''}
                      placeholder="Contoh: AWB-20231015-1234"
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-black tracking-widest text-slate-900 uppercase focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:font-semibold placeholder:tracking-normal"
                      required
                   />
                </div>
                <button type="submit" className="px-8 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all whitespace-nowrap">
                   Cari Resi
                </button>
             </form>
          </div>

          {error && (
             <div className="p-6 bg-rose-50 border border-rose-100 rounded-3xl text-center text-rose-600 font-bold flex flex-col items-center gap-3">
                <AlertCircle size={32} />
                {error}
             </div>
          )}

          {cargo && (
             <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-slate-900 text-white">
                   <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                      <div>
                         <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">NO. RESI</p>
                         <h2 className="text-2xl font-black font-mono tracking-widest mt-1">{cargo.tracking_number}</h2>
                      </div>
                      <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${
                         cargo.status === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                         cargo.status === 'ARRIVED' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                         cargo.status === 'IN_TRANSIT' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                         'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                         {cargo.status.replace('_', ' ')}
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-8 mt-8">
                      <div>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PENGIRIM</p>
                         <p className="text-sm font-semibold mt-1">{cargo.sender_name}</p>
                         <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><MapPin size={12}/> {cargo.origin?.location_name}</p>
                      </div>
                      <div>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PENERIMA</p>
                         <p className="text-sm font-semibold mt-1">{cargo.receiver_name}</p>
                         <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><MapPin size={12}/> {cargo.destination?.location_name}</p>
                      </div>
                   </div>
                </div>

                <div className="p-8">
                   <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-6">Timeline Perjalanan</h3>
                   
                   <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 pb-4">
                      
                      {/* DRAFT (Dibuat) */}
                      <div className="relative pl-8">
                         <div className="absolute -left-[11px] bg-slate-900 p-1 rounded-full border-4 border-white text-white">
                            <Package size={12} />
                         </div>
                         <div>
                            <p className="text-sm font-bold text-slate-900">Paket Diterima di Agen</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{formatDate(cargo.created_at)}</p>
                            <p className="text-xs font-semibold text-slate-500 mt-2">Paket diterima di {cargo.origin?.name} ({cargo.origin?.location_name})</p>
                         </div>
                      </div>

                      {/* MANIFESTED / IN_TRANSIT */}
                      {(cargo.status === 'MANIFESTED' || cargo.status === 'IN_TRANSIT' || cargo.status === 'ARRIVED' || cargo.status === 'DELIVERED') && (
                        <div className="relative pl-8">
                           <div className="absolute -left-[11px] bg-blue-600 p-1 rounded-full border-4 border-white text-white">
                              <Truck size={12} />
                           </div>
                           <div>
                              <p className="text-sm font-bold text-slate-900">Dalam Perjalanan (Transit)</p>
                              <p className="text-xs font-semibold text-slate-500 mt-2">Paket telah diberangkatkan menggunakan armada bus menuju {cargo.destination?.location_name}.</p>
                           </div>
                        </div>
                      )}

                      {/* ARRIVED */}
                      {(cargo.status === 'ARRIVED' || cargo.status === 'DELIVERED') && (
                        <div className="relative pl-8">
                           <div className="absolute -left-[11px] bg-amber-500 p-1 rounded-full border-4 border-white text-white">
                              <MapPinOff size={12} />
                           </div>
                           <div>
                              <p className="text-sm font-bold text-slate-900">Tiba di Agen Tujuan</p>
                              <p className="text-xs font-semibold text-slate-500 mt-2">Paket telah sampai di {cargo.destination?.name} ({cargo.destination?.location_name}) dan menunggu untuk diambil oleh penerima.</p>
                           </div>
                        </div>
                      )}

                      {/* DELIVERED */}
                      {cargo.status === 'DELIVERED' && (
                        <div className="relative pl-8">
                           <div className="absolute -left-[11px] bg-emerald-500 p-1 rounded-full border-4 border-white text-white">
                              <PackageCheck size={12} />
                           </div>
                           <div>
                              <p className="text-sm font-bold text-emerald-600">Diserahkan ke Penerima</p>
                              <p className="text-xs font-semibold text-slate-500 mt-2">Paket telah berhasil diserahkan kepada {cargo.receiver_name}. Terima kasih telah menggunakan layanan kami.</p>
                           </div>
                        </div>
                      )}

                   </div>
                </div>
             </div>
          )}
       </div>
    </div>
  )
}
