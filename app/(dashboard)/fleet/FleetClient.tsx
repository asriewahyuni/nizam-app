'use client'

import React, { startTransition, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Truck, 
  Car, 
  Bike, 
  Bus, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Wrench, 
  MoreVertical,
  X,
  Search,
  ChevronRight,
  User,
  MapPin,
  CircleDollarSign,
  AlertCircle,
  UserCheck,
  ShieldAlert,
  FileBadge,
  QrCode,
  Scan,
  Map as MapIcon,
  Navigation
} from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/utils'
import { createAsset, createBooking, updateBookingStatus, createRoute, createSchedule, createTicket, createMedicalRecord, createCrew, recordCrewAttendance } from '@/modules/fleet/actions/fleet.actions'
import { Html5Qrcode } from 'html5-qrcode'

interface FleetClientProps {
  orgId: string
  assets: any[]
  bookings: any[]
  routes: any[]
  schedules: any[]
  medicalRecords: any[]
  crew: any[]
  terminals: any[]
  attendanceToday: any[]
  contacts: any[]
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const item = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1 }
}

const statusColor = {
  AVAILABLE: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  RENTED: 'bg-blue-50 text-blue-600 border-blue-100',
  MAINTENANCE: 'bg-amber-50 text-amber-600 border-amber-100',
  OUT_OF_SERVICE: 'bg-rose-50 text-rose-600 border-rose-100'
}

const getFleetIcon = (type: string) => {
  if (type === 'MOTORBIKE') return Bike
  if (type === 'BUS') return Bus
  if (type === 'TRUCK') return Truck
  return Car
}

export function FleetClient({ orgId, assets, bookings, routes, schedules, medicalRecords, crew, terminals, attendanceToday, contacts }: FleetClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'UNITS' | 'BOOKINGS' | 'PO_BUS' | 'LABS'>('PO_BUS')
  const [poSubTab, setPoSubTab] = useState<'ROUTES' | 'SCHEDULES' | 'TICKETING' | 'CREW' | 'ATTENDANCE'>('SCHEDULES')
  const [showAssetModal, setShowAssetModal] = useState(false)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [showRouteModal, setShowRouteModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [showMedicalModal, setShowMedicalModal] = useState(false)
  const [showCrewModal, setShowCrewModal] = useState(false)
  const [showScanModal, setShowScanModal] = useState(false)
  const [scanType, setScanType] = useState<'IN' | 'OUT'>('IN')
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null)
  const [selectedCrewForAttendance, setSelectedCrewForAttendance] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const scannerRef = useRef<any>(null)

  const refreshFleetPage = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  useEffect(() => {
    if (showScanModal && selectedCrewForAttendance) {
      const html5QrCode = new Html5Qrcode("reader")
      scannerRef.current = html5QrCode
      
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await handleAttendanceProcessed(decodedText)
        },
        () => {}
      ).catch(err => console.warn(err))
    }

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [showScanModal, selectedCrewForAttendance])

  const handleAttendanceProcessed = async (qrPayload: string) => {
    if (!selectedCrewForAttendance) return

    setLoading(true)
    // Get GPS
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const gps = `${pos.coords.latitude},${pos.coords.longitude}`
      const res = await recordCrewAttendance(orgId, {
        employee_id: selectedCrewForAttendance,
        location_gps: gps,
        qr_scanned_payload: qrPayload,
        type: scanType
      })

      if (res.error) alert(res.error)
      else {
        setShowScanModal(false)
        setSelectedCrewForAttendance('')
        refreshFleetPage()
      }
      setLoading(false)
    }, (err) => {
       alert("Gagal mengambil lokasi GPS. Pastikan izin lokasi aktif.")
       setLoading(false)
    })
  }

  // Handlers
  const handleAddAsset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const res = await createAsset(orgId, new FormData(e.currentTarget))
    if (res.error) alert(res.error)
    else {
      setShowAssetModal(false)
      refreshFleetPage()
    }
    setLoading(false)
  }

  const handleAddBooking = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const res = await createBooking(orgId, new FormData(e.currentTarget))
    if (res.error) alert(res.error)
    else {
      setShowBookingModal(false)
      refreshFleetPage()
    }
    setLoading(false)
  }

  const handleCreateRoute = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const res = await createRoute(orgId, new FormData(e.currentTarget))
    if (res.error) alert(res.error)
    else {
      setShowRouteModal(false)
      refreshFleetPage()
    }
    setLoading(false)
  }

  const handleCreateSchedule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const res = await createSchedule(orgId, new FormData(e.currentTarget))
    if (res.error) alert(res.error)
    else {
      setShowScheduleModal(false)
      refreshFleetPage()
    }
    setLoading(false)
  }

  const handleBookTicket = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const res = await createTicket(orgId, {
      schedule_id: selectedSchedule.id,
      passenger_id: formData.get('passenger_id') as string,
      seat_number: formData.get('seat_number') as string,
      price: Number(formData.get('price')),
      notes: formData.get('notes') as string
    })
    if (res.error) alert(res.error)
    else {
      setShowTicketModal(false)
      setSelectedSchedule(null)
      refreshFleetPage()
    }
    setLoading(false)
  }

  const handleAddMedical = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const res = await createMedicalRecord(orgId, {
      asset_id: formData.get('asset_id') as string,
      service_date: formData.get('service_date') as string,
      description: formData.get('description') as string,
      maintenance_type: formData.get('maintenance_type') as any,
      cost: Number(formData.get('cost')),
      odometer_at: Number(formData.get('odometer_at')),
      technician_name: formData.get('technician_name') as string,
      vendor_name: formData.get('vendor_name') as string,
      next_service_date: formData.get('next_service_date') as string,
      attachment_url: formData.get('attachment_url') as string
    })
    if (res.error) alert(res.error)
    else {
      setShowMedicalModal(false)
      refreshFleetPage()
    }
    setLoading(false)
  }

  const handleAddCrew = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const res = await createCrew(orgId, {
      nik: formData.get('nik') as string,
      first_name: formData.get('first_name') as string,
      last_name: formData.get('last_name') as string,
      job_title: formData.get('job_title') as string,
      phone: formData.get('phone') as string,
      join_date: new Date().toISOString().split('T')[0],
      license_number: formData.get('license_number') as string,
      license_expiry: formData.get('license_expiry') as string,
      blood_type: formData.get('blood_type') as string
    })
    if (res.error) alert(res.error)
    else {
      setShowCrewModal(false)
      refreshFleetPage()
    }
    setLoading(false)
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-7xl mx-auto space-y-10">
      
      {/* Header */}
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <Truck size={32} className="text-blue-600" />
             Fleet & Rental
          </h1>
          <p className="text-sm text-slate-500 font-medium">Manajemen Aset Bergerak, Reservasi, dan Perawatan.</p>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto">
           {[
             { id: 'PO_BUS', label: 'Operasional Bus (PO)', icon: Bus },
             { id: 'UNITS', label: 'Armada (Unit)', icon: Car },
             { id: 'BOOKINGS', label: 'Pesanan (Rental)', icon: Calendar },
             { id: 'LABS', label: 'Perawatan (Labs)', icon: Wrench },
           ].map(tab => (
             <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl transition-all ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
             >
               <tab.icon size={14} />
               {tab.label}
             </button>
           ))}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {activeTab === 'PO_BUS' && (
          <motion.div key="po_bus" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
             {/* PO BUS SUB-TABS */}
             <div className="flex items-center gap-4 border-b border-slate-100 mb-6 pb-1">
                {[
                  { id: 'SCHEDULES', label: 'Jadwal', icon: Clock },
                  { id: 'ROUTES', label: 'Rute', icon: MapPin },
                  { id: 'TICKETING', label: 'Tiketing', icon: CircleDollarSign },
                  { id: 'CREW', label: 'Daftar Kru', icon: UserCheck },
                  { id: 'ATTENDANCE', label: 'Presensi', icon: Scan },
                ].map(st => (
                  <button
                    key={st.id}
                    onClick={() => setPoSubTab(st.id as any)}
                    className={`pb-4 px-2 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${poSubTab === st.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    <st.icon size={14} /> {st.label}
                  </button>
                ))}
             </div>

             {poSubTab === 'SCHEDULES' && (
                <div className="space-y-6">
                   <div className="flex justify-between items-center">
                      <h3 className="text-xl font-black text-slate-900">Jadwal Keberangkatan</h3>
                      <button onClick={() => setShowScheduleModal(true)} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-100">
                         <Plus size={18} /> Buat Jadwal
                      </button>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {schedules.length === 0 ? (
                        <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-[32px] text-slate-400 font-bold italic">Belum ada jadwal keberangkatan.</div>
                      ) : (
                        schedules.map(sc => (
                          <div key={sc.id} className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                             <div className="flex justify-between items-center mb-4">
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">{sc.status}</span>
                                <div className="text-[9px] font-bold text-slate-400">{formatDate(sc.departure_time)}</div>
                             </div>
                             <h4 className="text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase">{sc.route?.name}</h4>
                             <div className="mt-4 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                   <Bus size={14} /> {sc.asset?.plate_number} ({sc.asset?.model})
                                </div>
                                 <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                    <User size={14} /> {sc.driver ? `${sc.driver.first_name} ${sc.driver.last_name}` : 'Belum Ada Sopir'}
                                 </div>
                             </div>
                             <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                                <div className="text-[10px] font-black uppercase tracking-tighter text-slate-400">
                                   {sc.tickets?.count || 0} / {sc.asset?.capacity || 40} Kursi Terjual
                                </div>
                                <button 
                                  onClick={() => {
                                    setSelectedSchedule(sc)
                                    setShowTicketModal(true)
                                  }}
                                  className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-blue-600 transition-all uppercase tracking-tighter shadow-lg shadow-blue-50"
                                >
                                   Jual Tiket
                                </button>
                             </div>
                          </div>
                        ))
                      )}
                   </div>
                </div>
             )}

             {poSubTab === 'ROUTES' && (
                <div className="space-y-6">
                   <div className="flex justify-between items-center">
                      <h3 className="text-xl font-black text-slate-900">Master Rute & Trayek</h3>
                      <button onClick={() => setShowRouteModal(true)} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-100">
                         <Plus size={18} /> Tambah Rute
                      </button>
                   </div>

                   <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                      <table className="w-full text-left">
                         <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                               <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Rute (Trayek)</th>
                               <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asal (Origin)</th>
                               <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tujuan (Dest)</th>
                               <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Harga Dasar</th>
                               <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {routes.length === 0 ? (
                              <tr><td colSpan={5} className="py-16 text-center text-slate-400 font-bold italic">Belum ada rute terdaftar.</td></tr>
                            ) : (
                              routes.map(r => (
                                <tr key={r.id}>
                                   <td className="px-8 py-5 font-black text-slate-900 text-sm">{r.name}</td>
                                   <td className="px-6 py-5 text-xs text-slate-500 font-bold uppercase">{r.origin}</td>
                                   <td className="px-6 py-5 text-xs text-slate-500 font-bold uppercase">{r.destination}</td>
                                   <td className="px-6 py-5 text-right font-black text-slate-900 text-sm">{formatRupiah(r.base_price)}</td>
                                   <td className="px-8 py-5 text-right"><button className="text-blue-600 font-bold text-xs">Edit</button></td>
                                </tr>
                              ))
                            )}
                         </tbody>
                      </table>
                   </div>
                </div>
             )}

             {poSubTab === 'TICKETING' && (
                <div className="space-y-6">
                   <div className="flex justify-between items-center">
                      <h3 className="text-xl font-black text-slate-900">Riwayat Penjualan Tiket</h3>
                   </div>

                   <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                      <table className="w-full text-left">
                         <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                               <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Penumpang</th>
                               <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rute & Bus</th>
                               <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Kursi</th>
                               <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Harga</th>
                               <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {schedules.flatMap(s => (s.tickets || []).map((t: any) => ({ ...t, schedule: s }))).length === 0 ? (
                              <tr><td colSpan={5} className="py-16 text-center text-slate-400 font-bold italic">Belum ada tiket terjual.</td></tr>
                            ) : (
                              schedules.flatMap(s => (s.tickets || []).map((t: any) => ({ ...t, schedule: s }))).map((t: any) => (
                                <tr key={t.id}>
                                   <td className="px-8 py-5">
                                      <p className="font-black text-slate-900 text-sm">{t.passenger?.name || 'Anon'}</p>
                                      <p className="text-[10px] text-slate-400 font-bold uppercase">{formatDate(t.created_at)}</p>
                                    </td>
                                   <td className="px-6 py-5">
                                      <p className="text-xs text-slate-700 font-bold uppercase">{t.schedule?.route?.name}</p>
                                      <p className="text-[10px] text-slate-400 font-bold">{t.schedule?.asset?.plate_number}</p>
                                   </td>
                                   <td className="px-6 py-5 font-black text-emerald-600 text-sm">{t.seat_number}</td>
                                   <td className="px-6 py-5 text-right font-black text-slate-900 text-sm">{formatRupiah(t.price)}</td>
                                   <td className="px-8 py-5">
                                      <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded-full uppercase border border-emerald-100">{t.status}</span>
                                   </td>
                                 </tr>
                               ))
                            )}
                         </tbody>
                      </table>
                   </div>
                </div>
             )}

             {poSubTab === 'CREW' && (
                <div className="space-y-6">
                   <div className="flex justify-between items-center px-1">
                      <h3 className="text-xl font-black text-slate-900">Daftar Kru (Sopir & Kernet)</h3>
                      <button onClick={() => setShowCrewModal(true)} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-100">
                         <Plus size={18} /> Daftarkan Kru
                      </button>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {crew.length === 0 ? (
                        <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-[32px] text-slate-400 font-bold italic">Belum ada kru yang terdaftar.</div>
                      ) : (
                        crew.map((c: any) => (
                          <div key={c.id} className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 -mr-8 -mt-8 rounded-full group-hover:bg-blue-50 transition-colors" />
                             
                             <div className="relative">
                                <span className={`px-3 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest border ${
                                  c.job_title.toLowerCase().includes('sopir') ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                }`}>
                                   {c.job_title}
                                </span>
                                <h4 className="text-xl font-black text-slate-900 mt-4 uppercase tracking-tight">{c.first_name} {c.last_name}</h4>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">NIK: {c.nik}</p>
                                
                                <div className="mt-6 space-y-3">
                                   <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                                      <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400"><FileBadge size={14} /></div>
                                      <div>
                                         <p className="text-[9px] text-slate-400 uppercase">SIM / License</p>
                                         <p className="tracking-tighter font-black text-slate-700">{c.license_number || 'TIDAK ADA DATA'}</p>
                                      </div>
                                   </div>
                                   <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                                      <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400"><ShieldAlert size={14} /></div>
                                      <div>
                                         <p className="text-[9px] text-slate-400 uppercase">Masa Berlaku SIM</p>
                                         <p className={`${new Date(c.license_expiry) < new Date() ? 'text-rose-500' : 'text-slate-600'} font-black`}>
                                            {c.license_expiry ? formatDate(c.license_expiry) : 'EXPIRED / NO DATA'}
                                         </p>
                                      </div>
                                   </div>
                                </div>
                             </div>
                          </div>
                        ))
                      )}
                   </div>
                </div>
             )}

             {poSubTab === 'ATTENDANCE' && (
                <div className="space-y-6">
                   <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                      <div className="space-y-1">
                         <h3 className="text-xl font-black text-slate-900">Kehadiran Kru Hari Ini</h3>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </div>
                      <div className="flex gap-3 w-full md:w-auto">
                         <button onClick={() => { setScanType('IN'); setShowScanModal(true) }} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white text-sm font-black rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all">
                            <QrCode size={18} /> Clock In (Mulai)
                         </button>
                         <button onClick={() => { setScanType('OUT'); setShowScanModal(true) }} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-rose-600 text-white text-sm font-black rounded-2xl hover:bg-rose-700 shadow-xl shadow-rose-100 transition-all">
                            <Navigation size={18} /> Clock Out (Selesai)
                         </button>
                      </div>
                   </div>

                   <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                      <table className="w-full text-left">
                         <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                               <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Kru (Pegawai)</th>
                               <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Waktu In/Out</th>
                               <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Lokasi (GPS)</th>
                               <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">QR Scan</th>
                               <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {attendanceToday.length === 0 ? (
                               <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold italic">Belum ada aktivitas presensi hari ini.</td></tr>
                            ) : (
                               attendanceToday.map((a: any) => (
                                 <tr key={a.id} className="hover:bg-slate-50/50 transition">
                                    <td className="px-8 py-5">
                                       <p className="font-black text-slate-900 text-sm">{a.employee ? `${a.employee.first_name} ${a.employee.last_name}` : 'Unknown'}</p>
                                    </td>
                                    <td className="px-6 py-5">
                                       <div className="flex flex-col gap-1">
                                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600"><Clock size={12}/> In: {a.check_in ? new Date(a.check_in).toLocaleTimeString('id-ID') : '-'}</div>
                                          <div className="flex items-center gap-2 text-xs font-bold text-rose-500"><Clock size={12}/> Out: {a.check_out ? new Date(a.check_out).toLocaleTimeString('id-ID') : '-'}</div>
                                       </div>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                       {a.location_gps ? (
                                         <a href={`https://www.google.com/maps?q=${a.location_gps}`} target="_blank" className="inline-flex items-center gap-2 px-3 py-1 bg-slate-50 text-blue-600 rounded-lg border border-slate-100 text-[10px] font-black hover:bg-blue-50 transition-colors">
                                            <MapIcon size={12} /> Buka Peta
                                         </a>
                                       ) : <span className="text-slate-300">-</span>}
                                    </td>
                                    <td className="px-6 py-5">
                                       <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">{a.qr_scanned_payload || '-'}</span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                       <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded-full uppercase border border-emerald-100">{a.status}</span>
                                    </td>
                                 </tr>
                               ))
                            )}
                         </tbody>
                      </table>
                   </div>
                </div>
             )}
          </motion.div>
        )}

        {activeTab === 'UNITS' && (
          <motion.div key="units" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
             {/* Simple Stats for Units */}
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Armada', value: assets.length, desc: 'Milik Organisasi', color: 'indigo' },
                  { label: 'Tersedia Sekarang', value: assets.filter(a => a.status === 'AVAILABLE').length, desc: 'Ready for Rent', color: 'emerald' },
                  { label: 'Sedang Disewa', value: assets.filter(a => a.status === 'RENTED').length, desc: 'Active Revenue', color: 'blue' },
                  { label: 'Dalam Servis', value: assets.filter(a => a.status === 'MAINTENANCE').length, desc: 'Operating Expense', color: 'amber' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                     <p className={`text-2xl font-black text-${stat.color}-600 mt-1`}>{stat.value}</p>
                     <p className="text-[10px] text-slate-400 font-medium mt-1">{stat.desc}</p>
                  </div>
                ))}
             </div>

             {/* Action Bar */}
             <div className="flex justify-between items-center px-1">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Katalog Armada</h3>
                <button onClick={() => setShowAssetModal(true)} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-100">
                   <Plus size={18} /> Tambah Unit
                </button>
             </div>

             {/* Assets Grid */}
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {assets.length === 0 ? (
                  <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[32px] text-slate-400 font-bold italic">Belum ada armada terdaftar.</div>
                ) : (
                  assets.map(asset => {
                    const Icon = getFleetIcon(asset.type)
                    return (
                      <motion.div key={asset.id} variants={item} className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 group transition-all">
                         <div className="flex justify-between items-start mb-6">
                            <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                               <Icon size={28} />
                            </div>
                            <span className={`px-4 py-1.5 text-[10px] font-bold rounded-full uppercase tracking-tighter border ${statusColor[asset.status as keyof typeof statusColor]}`}>
                               {asset.status.replace('_', ' ')}
                            </span>
                         </div>

                         <div className="space-y-4">
                            <div>
                               <h3 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{asset.model}</h3>
                               <p className="text-xs font-bold text-slate-400 tracking-[0.2em] mt-1">{asset.plate_number}</p>
                            </div>

                            <div className="flex items-center gap-4 text-xs font-medium text-slate-500 pt-2">
                               <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg">
                                  <Clock size={12} /> {asset.odometer} KM
                               </div>
                               <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-100">
                                  <CircleDollarSign size={12} /> {formatRupiah(asset.daily_rate)} / Hari
                               </div>
                            </div>
                         </div>

                         <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between">
                            <button className="text-[11px] font-black text-slate-400 hover:text-blue-600 transition-all uppercase tracking-widest flex items-center gap-2">
                               Lihat Detail <ChevronRight size={14} />
                            </button>
                            {asset.status === 'AVAILABLE' && (
                              <button onClick={() => setShowBookingModal(true)} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-blue-600 transition-all uppercase tracking-tighter shadow-lg shadow-blue-50 opacity-0 group-hover:opacity-100">
                                Sewakan
                              </button>
                            )}
                         </div>
                      </motion.div>
                    )
                  })
                )}
             </div>
          </motion.div>
        )}

        {activeTab === 'BOOKINGS' && (
          <motion.div key="bookings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
             <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left min-w-[800px]">
                   <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                         <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pelanggan & Unit</th>
                         <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Periode Sewa</th>
                         <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Durasi</th>
                         <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Nominal</th>
                         <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                         <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {bookings.length === 0 ? (
                        <tr>
                           <td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-bold italic">Belum ada riwayat pesanan sewa.</td>
                        </tr>
                      ) : (
                        bookings.map(b => (
                          <tr key={b.id} className="hover:bg-slate-50/50 transition cursor-pointer group">
                             <td className="px-8 py-6">
                                <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 font-black">
                                      {b.contact?.name?.[0]}
                                   </div>
                                   <div>
                                      <p className="text-sm font-black text-slate-900 leading-tight">{b.contact?.name}</p>
                                      <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tight">{b.asset?.model} • {b.asset?.plate_number}</p>
                                   </div>
                                </div>
                             </td>
                             <td className="px-6 py-6">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                   <span>{formatDate(b.start_date)}</span>
                                   <ChevronRight size={10} className="text-slate-300" />
                                   <span>{formatDate(b.end_date)}</span>
                                </div>
                             </td>
                             <td className="px-6 py-6 text-right font-black text-slate-900 text-xs">
                                {Math.ceil((new Date(b.end_date).getTime() - new Date(b.start_date).getTime()) / (1000 * 3600 * 24))} Hari
                             </td>
                             <td className="px-6 py-6 text-right">
                                <p className="text-sm font-black text-slate-900">{formatRupiah(b.total_amount)}</p>
                                {b.deposit > 0 && <p className="text-[10px] text-emerald-500 font-bold">Dep: {formatRupiah(b.deposit)}</p>}
                             </td>
                             <td className="px-6 py-6">
                                <span className={`px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-tighter border ${
                                  b.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                  b.status === 'ACTIVE' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                  b.status === 'CANCELLED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                  'bg-slate-50 text-slate-400 border-slate-100'
                                }`}>
                                   {b.status}
                                </span>
                             </td>
                             <td className="px-8 py-6 text-right">
                                <button className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition opacity-0 group-hover:opacity-100">
                                   <MoreVertical size={16} />
                                </button>
                             </td>
                          </tr>
                        ))
                      )}
                   </tbody>
                </table>
             </div>
          </motion.div>
        )}

        {activeTab === 'LABS' && (
           <motion.div key="labs" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
              <div className="flex justify-between items-center px-1">
                 <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                       <Wrench size={24} className="text-amber-500" /> Rekam Medis & Servis
                    </h3>
                    <p className="text-xs text-slate-400 font-medium tracking-tight uppercase font-black">Kardeks Kendaraan (Vehicle Medical History)</p>
                 </div>
                 <button onClick={() => setShowMedicalModal(true)} className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white text-sm font-bold rounded-2xl hover:bg-amber-600 shadow-xl shadow-amber-100 transition-all">
                    <Plus size={18} /> Catat Servis Baru
                 </button>
              </div>

              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
                 <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-slate-50 border-b border-slate-100">
                       <tr>
                          <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">No. Medis & Unit</th>
                          <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Jenis & Deskripsi</th>
                          <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Biaya (Rp)</th>
                          <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Posisi KM</th>
                          <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Teknisi / Bengkel</th>
                          <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lampiran</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {medicalRecords.length === 0 ? (
                         <tr>
                            <td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-bold italic">Belum ada rekam medis kendaraan yang tercatat.</td>
                         </tr>
                       ) : (
                         medicalRecords.map(m => (
                           <tr key={m.id} className="hover:bg-amber-50/10 transition group">
                              <td className="px-8 py-6">
                                 <p className="text-sm font-black text-slate-900 leading-tight">{m.maintenance_number || 'MT-NEW'}</p>
                                 <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-tight">{m.asset?.plate_number} • {m.asset?.model}</p>
                                 <p className="text-[10px] text-slate-400 font-medium mt-0.5">{formatDate(m.service_date)}</p>
                              </td>
                              <td className="px-6 py-6">
                                 <span className={`px-2 py-0.5 text-[9px] font-black rounded-lg uppercase border mb-1 inline-block ${
                                   m.maintenance_type === 'EMERGENCY' ? 'bg-rose-50 text-rose-500 border-rose-100' :
                                   m.maintenance_type === 'CORRECTIVE' ? 'bg-amber-50 text-amber-500 border-amber-100' :
                                   'bg-blue-50 text-blue-500 border-blue-100'
                                 }`}>
                                    {m.maintenance_type}
                                 </span>
                                 <p className="text-xs text-slate-600 font-medium line-clamp-2">{m.description}</p>
                              </td>
                              <td className="px-6 py-6 text-right font-black text-slate-900 text-sm">
                                 {formatRupiah(m.cost)}
                              </td>
                              <td className="px-6 py-6">
                                 <p className="text-xs font-black text-slate-700">{m.odometer_at || 0} KM</p>
                                 {m.next_service_date && <p className="text-[9px] text-rose-400 font-bold mt-1">Next: {formatDate(m.next_service_date)}</p>}
                              </td>
                              <td className="px-6 py-6 font-bold text-xs text-slate-500">
                                 <div className="flex flex-col">
                                    <span className="text-slate-700">{m.technician_name || '-'}</span>
                                    <span className="text-[10px] text-slate-400">{m.vendor_name || 'Internal'}</span>
                                 </div>
                              </td>
                              <td className="px-8 py-6">
                                 {m.attachment_url ? (
                                   <a href={m.attachment_url} target="_blank" className="text-blue-500 hover:text-blue-700"><CheckCircle2 size={16} /></a>
                                 ) : (
                                   <span className="text-slate-300">-</span>
                                 )}
                              </td>
                           </tr>
                         ))
                       )}
                    </tbody>
                 </table>
              </div>
           </motion.div>
        )}
      </AnimatePresence>

      {/* ASSET MODAL */}
      <AnimatePresence>
        {showAssetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAssetModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden p-8">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                      <Car size={20} className="text-blue-600" /> Tambah Armada Baru
                   </h3>
                   <button onClick={() => setShowAssetModal(false)} className="text-slate-400"><X size={20} /></button>
                </div>
                <form onSubmit={handleAddAsset} className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Model Kendaraan</label>
                         <input name="model" required placeholder="Cth: Toyota Avanza" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Merek (Brand)</label>
                         <input name="brand" placeholder="Cth: Toyota" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nomor Plat</label>
                         <input name="plate_number" required placeholder="B 1234 ABC" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold uppercase" />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jenis Kendaraan</label>
                         <select name="type" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold">
                            <option value="CAR">Mobil (Car)</option>
                            <option value="MOTORBIKE">Motor (Bike)</option>
                            <option value="BUS">Bus Armada</option>
                            <option value="TRUCK">Truk Angkut</option>
                         </select>
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Harga Sewa / Hari</label>
                         <input name="daily_rate" type="number" required placeholder="350000" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Odometer Saat Ini (KM)</label>
                         <input name="odometer" type="number" placeholder="0" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                      </div>
                   </div>
                   <button type="submit" disabled={loading} className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 mt-4">
                      {loading ? 'Processing...' : 'Simpan & Aktifkan Armada'}
                   </button>
                </form>
             </motion.div>
          </div>
        )}

        {showBookingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBookingModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden p-8">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                      <Calendar size={20} className="text-emerald-500" /> Buat Pesanan Baru
                   </h3>
                   <button onClick={() => setShowBookingModal(false)} className="text-slate-400"><X size={20} /></button>
                </div>
                <form onSubmit={handleAddBooking} className="space-y-6">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Pelanggan (Contact)</label>
                      <select name="contact_id" required className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold">
                         <option value="">-- Nama Customer --</option>
                         {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Kendaraan Tersedia</label>
                      <select name="asset_id" required className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold">
                         <option value="">-- List Armada Ready --</option>
                         {assets.filter(a => a.status === 'AVAILABLE').map(a => <option key={a.id} value={a.id}>{a.plate_number} - {a.model}</option>)}
                      </select>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tgl Mulai</label>
                         <input name="start_date" type="datetime-local" required className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold" />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tgl Selesai</label>
                         <input name="end_date" type="datetime-local" required className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-500 font-bold" />
                      </div>
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Biaya (Akomodasi)</label>
                      <input name="total_amount" type="number" required placeholder="0" className="w-full px-5 py-4 bg-slate-50 border border-emerald-100 rounded-2xl outline-none focus:border-emerald-500 font-black text-2xl text-slate-900" />
                   </div>
                   <button type="submit" disabled={loading} className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-50 mt-4">
                      {loading ? 'Processing...' : 'Konfirmasi Reservasi'}
                   </button>
                </form>
             </motion.div>
          </div>
        )}
        {showRouteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRouteModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden p-8">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                      <MapPin size={20} className="text-blue-600" /> Tambah Rute Baru
                   </h3>
                   <button onClick={() => setShowRouteModal(false)} className="text-slate-400"><X size={20} /></button>
                </div>
                <form onSubmit={handleCreateRoute} className="space-y-5">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Trayek (Rute)</label>
                      <input name="name" required placeholder="Cth: Jakarta - Surabaya (Eksekutif)" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kota Asal</label>
                         <input name="origin" required placeholder="Cth: Jakarta" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kota Tujuan</label>
                         <input name="destination" required placeholder="Cth: Surabaya" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jarak (KM)</label>
                         <input name="distance_km" type="number" placeholder="0" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Harga Tiket Dasar (Rp)</label>
                         <input name="base_price" type="number" required placeholder="250000" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                      </div>
                   </div>
                   <button type="submit" disabled={loading} className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-50 mt-4">
                      {loading ? 'Processing...' : 'Simpan Master Rute'}
                   </button>
                </form>
             </motion.div>
          </div>
        )}

        {showScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowScheduleModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden p-8">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                      <Clock size={20} className="text-indigo-600" /> Buka Lini Jadwal Baru
                   </h3>
                   <button onClick={() => setShowScheduleModal(false)} className="text-slate-400"><X size={20} /></button>
                </div>
                <form onSubmit={handleCreateSchedule} className="space-y-5">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Rute/Trayek</label>
                       <select name="route_id" required className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-indigo-500 font-bold">
                          <option value="">-- Trayek --</option>
                          {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                       </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Bus Armada</label>
                         <select name="asset_id" required className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-indigo-500 font-bold">
                            <option value="">-- Armada --</option>
                            {assets.filter(a => a.type === 'BUS').map(a => <option key={a.id} value={a.id}>{a.plate_number} - {a.model}</option>)}
                         </select>
                       </div>
                       <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Waktu Keberangkatan</label>
                         <input name="departure_time" type="datetime-local" required className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-indigo-500 font-bold" />
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tugaskan Sopir</label>
                          <select name="driver_id" required className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-indigo-500 font-bold">
                             <option value="">-- Pilih Sopir --</option>
                             {crew.filter((c: any) => c.job_title.toLowerCase().includes('sopir')).map((c: any) => (
                               <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                             ))}
                          </select>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tugaskan Kernet</label>
                          <select name="helper_id" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-indigo-500 font-bold">
                             <option value="">-- Pilih Kernet --</option>
                             {crew.filter((c: any) => c.job_title.toLowerCase().includes('kernet') || c.job_title.toLowerCase().includes('helper')).map((c: any) => (
                               <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                             ))}
                          </select>
                       </div>
                    </div>
                   <button type="submit" disabled={loading} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-50 mt-4">
                      {loading ? 'Processing...' : 'Aktifkan Jadwal'}
                   </button>
                </form>
             </motion.div>
          </div>
        )}

        {showTicketModal && selectedSchedule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTicketModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden p-8">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                      <CircleDollarSign size={20} className="text-emerald-500" /> Penjualan Tiket
                   </h3>
                   <button onClick={() => setShowTicketModal(false)} className="text-slate-400"><X size={20} /></button>
                </div>
                <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Info Perjalanan</p>
                   <p className="text-sm font-black text-slate-900 mt-1 uppercase">{selectedSchedule.route?.name}</p>
                   <p className="text-[10px] font-bold text-slate-500 mt-0.5">{selectedSchedule.asset?.plate_number} • {formatDate(selectedSchedule.departure_time)}</p>
                </div>
                <form onSubmit={handleBookTicket} className="space-y-5">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Penumpang (Customer)</label>
                      <select name="passenger_id" required className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:border-emerald-500 font-bold">
                         <option value="">-- Nama Penumpang --</option>
                         {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No. Kursi</label>
                         <input name="seat_number" required placeholder="Cth: 1A" className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:border-emerald-500 font-black text-center text-emerald-600" />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Harga Final (Rp)</label>
                         <input name="price" type="number" required defaultValue={selectedSchedule.route?.base_price || 0} className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:border-emerald-500 font-black" />
                      </div>
                   </div>
                   <button type="submit" disabled={loading} className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-50 mt-4">
                      {loading ? 'Processing...' : 'Cetak & Jual Tiket'}
                   </button>
                </form>
             </motion.div>
          </div>
        )}

        {showMedicalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMedicalModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden p-8 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                      <Wrench size={20} className="text-amber-500" /> Catat Rekam Medis (Servis)
                   </h3>
                   <button onClick={() => setShowMedicalModal(false)} className="text-slate-400"><X size={20} /></button>
                </div>
                <form onSubmit={handleAddMedical} className="space-y-5 overflow-y-auto pr-2 custom-scrollbar">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Unit Bus / Kendaraan</label>
                      <select name="asset_id" required className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-500 font-bold">
                         <option value="">-- Pilih Unit --</option>
                         {assets.map(a => <option key={a.id} value={a.id}>{a.plate_number} - {a.model}</option>)}
                      </select>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Servis</label>
                         <input name="service_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-500 font-bold" />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipe Maintenance</label>
                         <select name="maintenance_type" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-500 font-bold">
                            <option value="ROUTINE">Rutin (Berkala)</option>
                            <option value="CORRECTIVE">Korektif (Rusak)</option>
                            <option value="EMERGENCY">Darurat (Mogok)</option>
                         </select>
                      </div>
                   </div>

                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deskripsi & Keluhan</label>
                      <textarea name="description" required placeholder="Jelaskan apa yang diperbaiki/diganti..." className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-500 font-medium min-h-[80px]" />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Odometer Saat Servis</label>
                         <input name="odometer_at" type="number" required placeholder="0" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-500 font-bold" />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Biaya Servis (Rp)</label>
                         <input name="cost" type="number" required placeholder="0" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-500 font-black text-rose-500" />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Teknisi</label>
                         <input name="technician_name" placeholder="Nama Mekanik" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-500 font-bold" />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bengkel (Vendor)</label>
                         <input name="vendor_name" placeholder="Nama Bengkel" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-500 font-bold" />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Servis Berikutnya (Tgl)</label>
                         <input name="next_service_date" type="date" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-500 font-bold" />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">URL Nota / Kuitansi</label>
                         <input name="attachment_url" placeholder="https://..." className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-amber-500 font-bold text-blue-500 text-xs" />
                      </div>
                   </div>

                   <button type="submit" disabled={loading} className="w-full py-5 bg-amber-500 text-white font-black rounded-2xl shadow-xl shadow-amber-50 mt-4 flex items-center justify-center gap-3">
                      {loading ? 'Processing...' : <><CheckCircle2 size={20} /> Simpan Rekam Medis</>}
                   </button>
                   <p className="text-[9px] text-center text-slate-400 px-8">Data servis akan tersimpan permanen dalam riwayat aset kendaraan (Kardeks).</p>
                </form>
             </motion.div>
          </div>
        )}
        {showCrewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCrewModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden p-8">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                      <UserCheck size={20} className="text-blue-600" /> Pendaftaran Kru Baru
                   </h3>
                   <button onClick={() => setShowCrewModal(false)} className="text-slate-400"><X size={20} /></button>
                </div>
                <form onSubmit={handleAddCrew} className="space-y-5">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Depan</label>
                         <input name="first_name" required placeholder="Cth: Ahmad" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Belakang</label>
                         <input name="last_name" placeholder="Cth: Subarjo" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NIK (KTP)</label>
                         <input name="nik" required placeholder="16 Digit" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jabatan Kru</label>
                         <select name="job_title" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold">
                            <option value="Sopir Utama">Sopir Utama</option>
                            <option value="Sopir Cadangan">Sopir Cadangan</option>
                            <option value="Kernet">Kernet (Helper)</option>
                         </select>
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nomor SIM</label>
                         <input name="license_number" required placeholder="B1/B2/Umum" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Masa Berlaku SIM</label>
                         <input name="license_expiry" type="date" required className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nomor WA</label>
                         <input name="phone" placeholder="08..." className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold" />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gol. Darah</label>
                         <select name="blood_type" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold">
                            <option value="">-</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="AB">AB</option>
                            <option value="O">O</option>
                         </select>
                      </div>
                   </div>
                   <button type="submit" disabled={loading} className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-50 mt-4">
                      {loading ? 'Processing...' : 'Simpan & Aktifkan Kru'}
                   </button>
                </form>
             </motion.div>
          </div>
        )}

        {showScanModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowScanModal(false)} className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl" />
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden p-8">
                <div className="flex items-center justify-between mb-8">
                   <div className="space-y-1">
                      <h3 className="text-xl font-black text-slate-900 flex items-center gap-3 uppercase tracking-tighter">
                         <Scan size={24} className="text-blue-600" /> Smart Presensi
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metode: {scanType === 'IN' ? 'Check-In' : 'Check-Out'} • QR + GPS</p>
                   </div>
                   <button onClick={() => setShowScanModal(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"><X size={20} /></button>
                </div>

                <div className="space-y-6">
                   {!selectedCrewForAttendance ? (
                     <div className="space-y-4">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Identitas Kru (Pilih Nama Anda)</label>
                        <select 
                           value={selectedCrewForAttendance} 
                           onChange={(e) => setSelectedCrewForAttendance(e.target.value)}
                           className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-blue-500 font-bold text-lg"
                        >
                           <option value="">-- Ketuk untuk Pilih --</option>
                           {crew.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                        </select>
                        <div className="p-6 bg-blue-50 rounded-[32px] border border-blue-100">
                           <p className="text-xs text-blue-600 font-bold leading-relaxed">Pilih nama Anda terlebih dahulu untuk mengaktifkan scanner kamera HP.</p>
                        </div>
                     </div>
                   ) : (
                     <div className="space-y-6">
                        <div className="relative aspect-square bg-black rounded-[32px] overflow-hidden border-4 border-slate-100 shadow-inner">
                           <div id="reader" className="w-full h-full" />
                           <div className="absolute inset-0 border-[40px] border-black/20 pointer-events-none flex items-center justify-center">
                              <div className="w-48 h-48 border-2 border-dashed border-white/50 rounded-2xl animate-pulse" />
                           </div>
                           {loading && (
                             <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8">
                                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="font-black text-slate-900 uppercase text-xs tracking-widest">Memproses Presensi & GPS...</p>
                             </div>
                           )}
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                           <Navigation className="text-emerald-600" size={18} />
                           <p className="text-[10px] text-emerald-700 font-bold uppercase leading-tight">Pastikan Anda berada di area Terminal/Pool agar GPS tervalidasi.</p>
                        </div>
                        <button onClick={() => setSelectedCrewForAttendance('')} className="w-full py-4 text-slate-400 font-bold text-xs hover:text-slate-600 uppercase tracking-widest">
                           Ganti Identitas
                        </button>
                     </div>
                   )}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}
