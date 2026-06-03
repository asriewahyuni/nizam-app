'use client'

import { useState, useTransition } from 'react'
import {
  Bus, Users, Wrench, AlertTriangle, MapPin, Ticket, Building2,
  Navigation, Plus, Phone, Mail, Edit2, CheckCircle2, Clock,
  XCircle, TruckIcon, Settings, ChevronRight, Flame
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SafeButton, PageHeader, StatCard, EmptyState,
  SectionCard, SectionHeader, useConfirm
} from '@/components/ui/NizamUI'
import {
  createBusUnit, updateBusUnit, deleteBusUnit, updateBusUnitStatus,
  createBusCrew, deleteBusCrew,
  createBusMechanic, updateBusMechanic, deleteBusMechanic,
  createBusServiceRecord, createBusTireRecord,
  createBusEmergencyCall, updateEmergencyCallStatus,
  createBusAgent, updateBusAgent, deleteBusAgent,
  createBusRoute, createBusSchedule, updateBusScheduleStatus,
  createBusTicket, createBusCheckpoint,
} from '@/modules/po-bus/actions/po-bus.actions'
import type {
  BusUnit, BusCrew, BusMechanic, BusTireRecord,
  BusEmergencyCall, BusAgent, BusRoute, BusSchedule, BusTicket, BusCheckpoint,
  FixedAssetSummary,
} from '@/modules/po-bus/lib/po-bus-types'

type Tab = 'ARMADA' | 'CREW' | 'MEKANIK' | 'PERAWATAN' | 'EMERGENCY' | 'OPERASIONAL' | 'CHECKPOINT'
type PerawatanTab = 'SERVIS' | 'BAN'
type OperasionalTab = 'RUTE' | 'JADWAL' | 'TIKET' | 'AGEN'

type ServiceRecord = { id: string; asset_id: string; service_date: string; description: string; maintenance_type: string; cost: number; odometer_at: number; technician_name: string | null; next_service_km: number | null; next_service_date: string | null; asset?: { plate_number: string; model: string } | null }

interface POBusClientProps {
  orgId: string
  units: BusUnit[]
  crew: BusCrew[]
  mechanics: BusMechanic[]
  serviceRecords: ServiceRecord[]
  tireRecords: BusTireRecord[]
  emergencyCalls: BusEmergencyCall[]
  agents: BusAgent[]
  routes: BusRoute[]
  schedules: BusSchedule[]
  tickets: BusTicket[]
  checkpoints: BusCheckpoint[]
  fixedAssets: FixedAssetSummary[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function formatDate(s?: string | null) {
  if (!s) return '-'
  return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(s?: string | null) {
  if (!s) return '-'
  return new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const UNIT_STATUS_LABELS: Record<BusUnit['status'], string> = {
  TERSEDIA: 'Tersedia', BEROPERASI: 'Beroperasi', SERVIS: 'Servis', TIDAK_AKTIF: 'Tidak Aktif',
}
const UNIT_STATUS_COLORS: Record<BusUnit['status'], string> = {
  TERSEDIA: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  BEROPERASI: 'bg-blue-50 text-blue-700 border border-blue-200',
  SERVIS: 'bg-amber-50 text-amber-700 border border-amber-200',
  TIDAK_AKTIF: 'bg-slate-100 text-slate-500 border border-slate-200',
}
const EMERGENCY_STATUS_COLORS: Record<string, string> = {
  BUKA: 'bg-rose-50 text-rose-700 border border-rose-200',
  DALAM_PROSES: 'bg-amber-50 text-amber-700 border border-amber-200',
  SELESAI: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
}
const ISSUE_TYPE_LABELS: Record<string, string> = {
  MOGOK: 'Mogok', KECELAKAAN: 'Kecelakaan', BAN_BOCOR: 'Ban Bocor', OVERHEAT: 'Overheat', LAINNYA: 'Lainnya',
}
const SCHEDULE_STATUS_COLORS: Record<string, string> = {
  TERJADWAL: 'bg-blue-50 text-blue-700 border border-blue-200',
  BERANGKAT: 'bg-amber-50 text-amber-700 border border-amber-200',
  TIBA: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  BATAL: 'bg-slate-100 text-slate-500 border border-slate-200',
}
const CREW_ROLE_LABELS: Record<string, string> = {
  DRIVER: 'Driver', CO_DRIVER: 'Co-Driver', KERNET: 'Kernet', KONDEKTUR: 'Kondektur',
}

// ─── UI Primitives ────────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label className="text-xs font-medium text-slate-600">{label}</label>{children}</div>
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors" {...props} />
}
function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors cursor-pointer" {...props}>{children}</select>
}
function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors resize-none" {...props} />
}
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function POBusClient({
  orgId, units, crew, mechanics, serviceRecords, tireRecords,
  emergencyCalls, agents, routes, schedules, tickets, checkpoints, fixedAssets,
}: POBusClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>('ARMADA')
  const [perawatanTab, setPerawatanTab] = useState<PerawatanTab>('SERVIS')
  const [operasionalTab, setOperasionalTab] = useState<OperasionalTab>('JADWAL')
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { confirm, ConfirmUI } = useConfirm()

  const [localUnits, setLocalUnits] = useState(units)
  const [localCrew, setLocalCrew] = useState(crew)
  const [localMechanics, setLocalMechanics] = useState(mechanics)
  const [localServiceRecords, setLocalServiceRecords] = useState(serviceRecords)
  const [localTireRecords, setLocalTireRecords] = useState(tireRecords)
  const [localEmergencyCalls, setLocalEmergencyCalls] = useState(emergencyCalls)
  const [localAgents, setLocalAgents] = useState(agents)
  const [localRoutes, setLocalRoutes] = useState(routes)
  const [localSchedules, setLocalSchedules] = useState(schedules)
  const [localTickets, setLocalTickets] = useState(tickets)
  const [localCheckpoints, setLocalCheckpoints] = useState(checkpoints)

  const [selectedFixedAsset, setSelectedFixedAsset] = useState<FixedAssetSummary | null>(null)
  const [editingUnit, setEditingUnit] = useState<BusUnit | null>(null)
  const [showUnitModal, setShowUnitModal] = useState(false)
  const [showCrewModal, setShowCrewModal] = useState(false)
  const [showMechanicModal, setShowMechanicModal] = useState(false)
  const [showServisModal, setShowServisModal] = useState(false)
  const [showBanModal, setShowBanModal] = useState(false)
  const [showEmergencyModal, setShowEmergencyModal] = useState(false)
  const [showRouteModal, setShowRouteModal] = useState(false)
  const [showJadwalModal, setShowJadwalModal] = useState(false)
  const [showTiketModal, setShowTiketModal] = useState(false)
  const [showAgenModal, setShowAgenModal] = useState(false)
  const [showCheckpointModal, setShowCheckpointModal] = useState(false)

  const [editingMechanic, setEditingMechanic] = useState<BusMechanic | null>(null)
  const [editingAgent, setEditingAgent] = useState<BusAgent | null>(null)
  const [updatingEmergency, setUpdatingEmergency] = useState<BusEmergencyCall | null>(null)

  function showError(msg: string) { setError(msg); setTimeout(() => setError(null), 4000) }

  const openEmergencies = localEmergencyCalls.filter(e => e.status !== 'SELESAI').length

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'ARMADA', label: 'Armada', icon: <Bus className="w-4 h-4" /> },
    { id: 'CREW', label: 'Crew', icon: <Users className="w-4 h-4" /> },
    { id: 'MEKANIK', label: 'Mekanik', icon: <Wrench className="w-4 h-4" /> },
    { id: 'PERAWATAN', label: 'Perawatan', icon: <Settings className="w-4 h-4" /> },
    { id: 'EMERGENCY', label: 'Emergency', icon: <Flame className="w-4 h-4" /> },
    { id: 'OPERASIONAL', label: 'Operasional', icon: <TruckIcon className="w-4 h-4" /> },
    { id: 'CHECKPOINT', label: 'Checkpoint', icon: <Navigation className="w-4 h-4" /> },
  ]

  // ─── Handlers ────────────────────────────────────────────────────────────────

  async function handleSaveUnit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      plate_number: fd.get('plate_number') as string,
      brand: fd.get('brand') as string,
      model: fd.get('model') as string,
      year: Number(fd.get('year')) || undefined,
      capacity: Number(fd.get('capacity')) || undefined,
      body_type: fd.get('body_type') as string,
      color: fd.get('color') as string,
      purchase_price: selectedFixedAsset?.purchase_price || Number(fd.get('purchase_price')) || undefined,
      purchase_date: selectedFixedAsset?.purchase_date || fd.get('purchase_date') as string || undefined,
      useful_life_months: Number(fd.get('useful_life_months')) || undefined,
      salvage_value: Number(fd.get('salvage_value')) || undefined,
      depreciation_method: fd.get('depreciation_method') as string || undefined,
      fixed_asset_id: selectedFixedAsset?.id || undefined,
      notes: fd.get('notes') as string,
    }

    if (editingUnit) {
      const r = await updateBusUnit(orgId, editingUnit.id, payload)
      if (r.error) { showError(r.error); return }
      setLocalUnits(prev => prev.map(u => u.id === editingUnit.id ? { ...u, ...payload } as BusUnit : u))
    } else {
      const r = await createBusUnit(orgId, payload)
      if (r.error) { showError(r.error); return }
      setLocalUnits(prev => [...prev, r.data as BusUnit])
    }
    setSelectedFixedAsset(null)
    setEditingUnit(null)
    setShowUnitModal(false)
  }

  async function handleDeleteUnit(u: BusUnit) {
    const ok = await confirm({ title: 'Nonaktifkan Bus?', message: `${u.plate_number} — ${u.brand} ${u.model} akan dinonaktifkan.`, confirmLabel: 'Nonaktifkan' })
    if (!ok) return
    const r = await deleteBusUnit(orgId, u.id)
    if (r.error) { showError(r.error); return }
    setLocalUnits(prev => prev.filter(x => x.id !== u.id))
  }

  async function handleCreateCrew(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const r = await createBusCrew(orgId, {
      name: fd.get('name') as string,
      role: fd.get('role') as string,
      phone: fd.get('phone') as string,
      nik: fd.get('nik') as string,
      license_number: fd.get('license_number') as string,
      license_expiry: fd.get('license_expiry') as string,
      blood_type: fd.get('blood_type') as string,
      join_date: fd.get('join_date') as string,
    })
    if (r.error) { showError(r.error); return }
    setLocalCrew(prev => [...prev, r.data as BusCrew])
    setShowCrewModal(false)
  }

  async function handleDeleteCrew(id: string, name: string) {
    const ok = await confirm({ title: 'Nonaktifkan Kru?', message: `${name} akan dinonaktifkan.`, confirmLabel: 'Nonaktifkan' })
    if (!ok) return
    const r = await deleteBusCrew(orgId, id)
    if (r.error) { showError(r.error); return }
    setLocalCrew(prev => prev.filter(c => c.id !== id))
  }

  async function handleSaveMechanic(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = { name: fd.get('name') as string, phone: fd.get('phone') as string, specialization: fd.get('specialization') as string, notes: fd.get('notes') as string }
    if (editingMechanic) {
      const r = await updateBusMechanic(orgId, editingMechanic.id, payload)
      if (r.error) { showError(r.error); return }
      setLocalMechanics(prev => prev.map(m => m.id === editingMechanic.id ? { ...m, ...payload } : m))
    } else {
      const r = await createBusMechanic(orgId, payload)
      if (r.error) { showError(r.error); return }
      setLocalMechanics(prev => [...prev, r.data as BusMechanic])
    }
    setEditingMechanic(null); setShowMechanicModal(false)
  }

  async function handleDeleteMechanic(m: BusMechanic) {
    const ok = await confirm({ title: 'Nonaktifkan Mekanik?', message: `${m.name} akan dinonaktifkan.`, confirmLabel: 'Nonaktifkan' })
    if (!ok) return
    const r = await deleteBusMechanic(orgId, m.id)
    if (r.error) { showError(r.error); return }
    setLocalMechanics(prev => prev.map(x => x.id === m.id ? { ...x, is_active: false } : x))
  }

  async function handleCreateServis(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const r = await createBusServiceRecord(orgId, {
      bus_id: fd.get('bus_id') as string,
      service_date: fd.get('service_date') as string,
      description: fd.get('description') as string,
      maintenance_type: fd.get('maintenance_type') as string,
      cost: Number(fd.get('cost')) || 0,
      odometer_at: Number(fd.get('odometer_at')) || 0,
      technician_name: fd.get('technician_name') as string,
      next_service_km: Number(fd.get('next_service_km')) || undefined,
      next_service_date: fd.get('next_service_date') as string,
    })
    if (r.error) { showError(r.error); return }
    setLocalServiceRecords(prev => [r.data as ServiceRecord, ...prev])
    setShowServisModal(false)
  }

  async function handleCreateBan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const r = await createBusTireRecord(orgId, {
      bus_id: fd.get('bus_id') as string,
      position: fd.get('position') as string,
      brand: fd.get('brand') as string,
      size: fd.get('size') as string,
      installed_at: fd.get('installed_at') as string,
      odometer_at: Number(fd.get('odometer_at')) || undefined,
      mileage_limit_km: Number(fd.get('mileage_limit_km')) || undefined,
      notes: fd.get('notes') as string,
    })
    if (r.error) { showError(r.error); return }
    setLocalTireRecords(prev => [r.data as BusTireRecord, ...prev])
    setShowBanModal(false)
  }

  async function handleCreateEmergency(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const r = await createBusEmergencyCall(orgId, {
      bus_id: fd.get('bus_id') as string || undefined,
      reporter_name: fd.get('reporter_name') as string,
      location_description: fd.get('location_description') as string,
      issue_type: fd.get('issue_type') as string,
      description: fd.get('description') as string,
      assigned_mechanic_id: fd.get('assigned_mechanic_id') as string || undefined,
    })
    if (r.error) { showError(r.error); return }
    setLocalEmergencyCalls(prev => [r.data as BusEmergencyCall, ...prev])
    setShowEmergencyModal(false)
  }

  async function handleUpdateEmergency(call: BusEmergencyCall, status: BusEmergencyCall['status'], notes?: string) {
    const r = await updateEmergencyCallStatus(orgId, call.id, status, notes)
    if (r.error) { showError(r.error); return }
    setLocalEmergencyCalls(prev => prev.map(c => c.id === call.id ? { ...c, status, resolution_notes: notes || c.resolution_notes } : c))
    setUpdatingEmergency(null)
  }

  async function handleSaveAgent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = { name: fd.get('name') as string, phone: fd.get('phone') as string, email: fd.get('email') as string, address: fd.get('address') as string, city: fd.get('city') as string, commission_pct: Number(fd.get('commission_pct')) || 0, notes: fd.get('notes') as string }
    if (editingAgent) {
      const r = await updateBusAgent(orgId, editingAgent.id, payload)
      if (r.error) { showError(r.error); return }
      setLocalAgents(prev => prev.map(a => a.id === editingAgent.id ? { ...a, ...payload } : a))
    } else {
      const r = await createBusAgent(orgId, payload)
      if (r.error) { showError(r.error); return }
      setLocalAgents(prev => [...prev, r.data as BusAgent])
    }
    setEditingAgent(null); setShowAgenModal(false)
  }

  async function handleDeleteAgent(a: BusAgent) {
    const ok = await confirm({ title: 'Nonaktifkan Agen?', message: `${a.name} akan dinonaktifkan.`, confirmLabel: 'Nonaktifkan' })
    if (!ok) return
    const r = await deleteBusAgent(orgId, a.id)
    if (r.error) { showError(r.error); return }
    setLocalAgents(prev => prev.map(x => x.id === a.id ? { ...x, is_active: false } : x))
  }

  async function handleCreateRoute(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const r = await createBusRoute(orgId, { name: fd.get('name') as string, origin: fd.get('origin') as string, destination: fd.get('destination') as string, distance_km: Number(fd.get('distance_km')) || undefined, duration_hours: Number(fd.get('duration_hours')) || undefined, base_price: Number(fd.get('base_price')) || 0 })
    if (r.error) { showError(r.error); return }
    setLocalRoutes(prev => [...prev, r.data as BusRoute])
    setShowRouteModal(false)
  }

  async function handleCreateJadwal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const r = await createBusSchedule(orgId, { route_id: fd.get('route_id') as string, bus_id: fd.get('bus_id') as string, driver_id: fd.get('driver_id') as string || undefined, helper_id: fd.get('helper_id') as string || undefined, departure_time: fd.get('departure_time') as string, arrival_time: fd.get('arrival_time') as string || undefined })
    if (r.error) { showError(r.error); return }
    setLocalSchedules(prev => [r.data as BusSchedule, ...prev])
    setShowJadwalModal(false)
  }

  async function handleCreateTiket(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const r = await createBusTicket(orgId, { schedule_id: fd.get('schedule_id') as string, passenger_name: fd.get('passenger_name') as string, passenger_phone: fd.get('passenger_phone') as string, seat_number: fd.get('seat_number') as string, price: Number(fd.get('price')) || 0, agent_id: fd.get('agent_id') as string || undefined, notes: fd.get('notes') as string })
    if (r.error) { showError(r.error); return }
    setLocalTickets(prev => [r.data as BusTicket, ...prev])
    setShowTiketModal(false)
  }

  async function handleCreateCheckpoint(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const r = await createBusCheckpoint(orgId, { name: fd.get('name') as string, location: fd.get('location') as string, gps_coordinates: fd.get('gps_coordinates') as string })
    if (r.error) { showError(r.error); return }
    setLocalCheckpoints(prev => [...prev, r.data as BusCheckpoint])
    setShowCheckpointModal(false)
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {ConfirmUI}
      {error && (
        <div className="fixed top-4 right-4 z-50 bg-rose-600 text-white px-4 py-3 rounded-xl shadow-xl text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      <PageHeader tag="PO Bus" title="Manajemen Perusahaan Otobus" subtitle="Armada, kru, servis, emergency, ticketing, dan pool" icon={<Bus className="w-6 h-6" />} iconColor="text-blue-600" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Armada" value={localUnits.length} icon={Bus} color="blue" sub={`${localUnits.filter(u => u.status === 'TERSEDIA').length} tersedia`} />
        <StatCard label="Kru Aktif" value={localCrew.filter(c => c.is_active).length} icon={Users} color="emerald" />
        <StatCard label="Emergency Aktif" value={openEmergencies} icon={Flame} color={openEmergencies > 0 ? 'rose' : 'slate'} alert={openEmergencies > 0} />
        <StatCard label="Agen Aktif" value={localAgents.filter(a => a.is_active).length} icon={Building2} color="indigo" />
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all cursor-pointer', activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50')}>
            {tab.icon}{tab.label}
            {tab.id === 'EMERGENCY' && openEmergencies > 0 && <span className="ml-1 bg-rose-500 text-white text-xs rounded-full px-1.5 py-0.5">{openEmergencies}</span>}
          </button>
        ))}
      </div>

      {/* ARMADA */}
      {activeTab === 'ARMADA' && (
        <SectionCard>
          <SectionHeader title="Daftar Armada Bus" subtitle={`${localUnits.length} unit`} icon={Bus} actions={<SafeButton onClick={() => { setEditingUnit(null); setSelectedFixedAsset(null); setShowUnitModal(true) }} icon={<Plus className="w-4 h-4" />} size="sm">Tambah Bus</SafeButton>} />
          {localUnits.length === 0
            ? <EmptyState icon={Bus} title="Belum ada armada" description="Tambahkan unit bus." action={<SafeButton onClick={() => { setEditingUnit(null); setSelectedFixedAsset(null); setShowUnitModal(true) }} icon={<Plus className="w-4 h-4" />}>Tambah Bus</SafeButton>} />
            : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {localUnits.map(u => {
                  const fa = u.fixed_asset_id ? fixedAssets.find(f => f.id === u.fixed_asset_id) : null
                  return (
                    <div key={u.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-bold text-slate-800 text-lg">{u.plate_number}</p>
                          <p className="text-sm text-slate-500">{u.brand} {u.model} {u.year ? `(${u.year})` : ''}</p>
                          {u.body_type && <p className="text-xs text-slate-400">{u.body_type}</p>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={cn('text-xs font-medium px-2 py-1 rounded-full', UNIT_STATUS_COLORS[u.status])}>{UNIT_STATUS_LABELS[u.status]}</span>
                          <button onClick={() => { setEditingUnit(u); setSelectedFixedAsset(fixedAssets.find(f => f.id === u.fixed_asset_id) || null); setShowUnitModal(true) }} className="p-1.5 text-slate-300 hover:text-blue-500 cursor-pointer transition-colors rounded-lg hover:bg-blue-50"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteUnit(u)} className="p-1.5 text-slate-300 hover:text-rose-500 cursor-pointer transition-colors rounded-lg hover:bg-rose-50"><XCircle className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>

                      <div className="flex gap-4 text-xs text-slate-500 border-t border-slate-100 pt-3">
                        <span>{u.capacity ? `${u.capacity} kursi` : '—'}</span>
                        <span>{u.odometer ? `${u.odometer.toLocaleString()} km` : '0 km'}</span>
                      </div>

                      {/* Info finansial dari Fixed Assets */}
                      {fa && (
                        <div className="mt-3 bg-slate-50 rounded-lg p-3 space-y-1.5 border border-slate-100">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Nilai Buku</span>
                            <span className="font-semibold text-blue-700">{formatRupiah(fa.current_book_value)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Harga Beli</span>
                            <span className="text-slate-600">{formatRupiah(fa.purchase_price)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Penyusutan</span>
                            <span className="text-amber-600">{formatRupiah(fa.accumulated_depreciation)}</span>
                          </div>
                          {fa.last_depreciation_date && (
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Depresiasi terakhir</span>
                              <span className="text-slate-500">{formatDate(fa.last_depreciation_date)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 mt-3 flex-wrap">
                        {(['TERSEDIA', 'BEROPERASI', 'SERVIS', 'TIDAK_AKTIF'] as BusUnit['status'][]).filter(s => s !== u.status).slice(0, 2).map(s => (
                          <button key={s} onClick={() => startTransition(async () => { const r = await updateBusUnitStatus(orgId, u.id, s); if (!r.error) setLocalUnits(prev => prev.map(x => x.id === u.id ? { ...x, status: s } : x)) })} className="text-xs text-slate-400 hover:text-slate-700 underline cursor-pointer transition-colors">
                            {UNIT_STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
        </SectionCard>
      )}

      {/* CREW */}
      {activeTab === 'CREW' && (
        <SectionCard>
          <SectionHeader title="Daftar Kru" subtitle="Driver, co-driver, kernet, kondektur" icon={Users} actions={<SafeButton onClick={() => setShowCrewModal(true)} icon={<Plus className="w-4 h-4" />} size="sm">Tambah Kru</SafeButton>} />
          {localCrew.length === 0
            ? <EmptyState icon={Users} title="Belum ada kru" description="Tambahkan driver, kernet, atau kondektur." action={<SafeButton onClick={() => setShowCrewModal(true)} icon={<Plus className="w-4 h-4" />}>Tambah Kru</SafeButton>} />
            : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {localCrew.map(c => (
                  <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">{c.name}</p>
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mt-1 inline-block">{CREW_ROLE_LABELS[c.role] || c.role}</span>
                      </div>
                      <button onClick={() => handleDeleteCrew(c.id, c.name)} className="p-1.5 text-slate-300 hover:text-rose-500 cursor-pointer transition-colors rounded-lg hover:bg-rose-50"><XCircle className="w-4 h-4" /></button>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-slate-500">
                      {c.phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{c.phone}</p>}
                      {c.license_number && <p>SIM: {c.license_number}{c.license_expiry ? ` (exp: ${formatDate(c.license_expiry)})` : ''}</p>}
                      {c.blood_type && <p>Gol. Darah: {c.blood_type}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </SectionCard>
      )}

      {/* MEKANIK */}
      {activeTab === 'MEKANIK' && (
        <SectionCard>
          <SectionHeader title="Daftar Mekanik" subtitle="Internal & eksternal" icon={Wrench} actions={<SafeButton onClick={() => { setEditingMechanic(null); setShowMechanicModal(true) }} icon={<Plus className="w-4 h-4" />} size="sm">Tambah Mekanik</SafeButton>} />
          {localMechanics.length === 0
            ? <EmptyState icon={Wrench} title="Belum ada mekanik" description="Tambahkan daftar mekanik." action={<SafeButton onClick={() => setShowMechanicModal(true)} icon={<Plus className="w-4 h-4" />}>Tambah Mekanik</SafeButton>} />
            : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {localMechanics.map(m => (
                  <div key={m.id} className={cn('bg-white border rounded-xl p-4 hover:shadow-md transition-shadow', m.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60')}>
                    <div className="flex items-start justify-between">
                      <div><p className="font-semibold text-slate-800">{m.name}</p>{m.specialization && <p className="text-xs text-slate-500 mt-0.5">{m.specialization}</p>}</div>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingMechanic(m); setShowMechanicModal(true) }} className="p-1.5 text-slate-300 hover:text-blue-500 cursor-pointer transition-colors rounded-lg hover:bg-blue-50"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteMechanic(m)} className="p-1.5 text-slate-300 hover:text-rose-500 cursor-pointer transition-colors rounded-lg hover:bg-rose-50"><XCircle className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500 space-y-1">
                      {m.phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{m.phone}</p>}
                      <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs', m.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400')}>{m.is_active ? 'Aktif' : 'Nonaktif'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </SectionCard>
      )}

      {/* PERAWATAN */}
      {activeTab === 'PERAWATAN' && (
        <SectionCard>
          <SectionHeader title="Perawatan" subtitle="Rekam servis dan penggantian ban" icon={Settings} actions={<SafeButton onClick={() => perawatanTab === 'SERVIS' ? setShowServisModal(true) : setShowBanModal(true)} icon={<Plus className="w-4 h-4" />} size="sm">{perawatanTab === 'SERVIS' ? 'Rekam Servis' : 'Rekam Ban'}</SafeButton>} />
          <div className="flex gap-1 mt-4 mb-4">
            {(['SERVIS', 'BAN'] as PerawatanTab[]).map(t => (
              <button key={t} onClick={() => setPerawatanTab(t)} className={cn('px-4 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-all', perawatanTab === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{t === 'SERVIS' ? 'Servis' : 'Ban'}</button>
            ))}
          </div>
          {perawatanTab === 'SERVIS' && (
            localServiceRecords.length === 0
              ? <EmptyState icon={Settings} title="Belum ada rekam servis" description="Catat riwayat servis." action={<SafeButton onClick={() => setShowServisModal(true)} icon={<Plus className="w-4 h-4" />}>Rekam Servis</SafeButton>} />
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Armada</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Tanggal</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Deskripsi</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Tipe</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Biaya</th>
                    </tr></thead>
                    <tbody>{localServiceRecords.map(r => (
                      <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-medium">{r.asset?.plate_number || '-'}</td>
                        <td className="py-3 px-3 text-slate-500">{formatDate(r.service_date)}</td>
                        <td className="py-3 px-3">{r.description}</td>
                        <td className="py-3 px-3"><span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{r.maintenance_type}</span></td>
                        <td className="py-3 px-3 text-right">{formatRupiah(r.cost)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )
          )}
          {perawatanTab === 'BAN' && (
            localTireRecords.length === 0
              ? <EmptyState icon={Settings} title="Belum ada rekam ban" description="Catat riwayat penggantian ban." action={<SafeButton onClick={() => setShowBanModal(true)} icon={<Plus className="w-4 h-4" />}>Rekam Ban</SafeButton>} />
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Armada</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Posisi</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Merek & Ukuran</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Dipasang</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Odometer</th>
                    </tr></thead>
                    <tbody>{localTireRecords.map(r => (
                      <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-medium">{r.bus?.plate_number || '-'}</td>
                        <td className="py-3 px-3"><span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{r.position}</span></td>
                        <td className="py-3 px-3">{[r.brand, r.size].filter(Boolean).join(' — ') || '-'}</td>
                        <td className="py-3 px-3 text-slate-500">{formatDate(r.installed_at)}</td>
                        <td className="py-3 px-3 text-right text-slate-500">{r.odometer_at?.toLocaleString() || '-'} km</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )
          )}
        </SectionCard>
      )}

      {/* EMERGENCY */}
      {activeTab === 'EMERGENCY' && (
        <SectionCard>
          <SectionHeader title="Emergency Call" subtitle="Log kejadian darurat di perjalanan" icon={Flame} actions={<SafeButton onClick={() => setShowEmergencyModal(true)} variant="danger" icon={<Plus className="w-4 h-4" />} size="sm">Laporkan Emergency</SafeButton>} />
          {localEmergencyCalls.length === 0
            ? <EmptyState icon={AlertTriangle} title="Tidak ada emergency" description="Catat kejadian darurat saat bus bermasalah." action={<SafeButton onClick={() => setShowEmergencyModal(true)} variant="danger" icon={<Plus className="w-4 h-4" />}>Laporkan Emergency</SafeButton>} />
            : (
              <div className="space-y-3 mt-4">
                {localEmergencyCalls.map(call => (
                  <div key={call.id} className={cn('bg-white border rounded-xl p-4', call.status === 'BUKA' ? 'border-rose-200' : 'border-slate-200')}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('text-xs font-medium px-2 py-1 rounded-full', EMERGENCY_STATUS_COLORS[call.status])}>{call.status === 'BUKA' ? 'Buka' : call.status === 'DALAM_PROSES' ? 'Dalam Proses' : 'Selesai'}</span>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{ISSUE_TYPE_LABELS[call.issue_type]}</span>
                          {call.bus && <span className="text-xs font-medium text-slate-700">{call.bus.plate_number}</span>}
                        </div>
                        <p className="text-sm font-medium text-slate-800 mt-2">Pelapor: {call.reporter_name}</p>
                        {call.location_description && <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{call.location_description}</p>}
                        {call.description && <p className="text-sm text-slate-600 mt-1">{call.description}</p>}
                        {call.mechanic && <p className="text-xs text-slate-500 mt-1">Mekanik: {call.mechanic.name}</p>}
                        <p className="text-xs text-slate-400 mt-1">{formatDateTime(call.call_time)}</p>
                      </div>
                      {call.status !== 'SELESAI' && (
                        <div className="flex gap-2 shrink-0">
                          {call.status === 'BUKA' && <SafeButton size="sm" variant="amber" onClick={async () => handleUpdateEmergency(call, 'DALAM_PROSES')}>Tangani</SafeButton>}
                          <SafeButton size="sm" variant="emerald" onClick={() => setUpdatingEmergency(call)}>Selesai</SafeButton>
                        </div>
                      )}
                    </div>
                    {call.resolution_notes && <div className="mt-3 p-3 bg-emerald-50 rounded-lg text-xs text-emerald-700"><strong>Resolusi:</strong> {call.resolution_notes}</div>}
                  </div>
                ))}
              </div>
            )}
        </SectionCard>
      )}

      {/* OPERASIONAL */}
      {activeTab === 'OPERASIONAL' && (
        <SectionCard>
          <SectionHeader title="Operasional" subtitle="Rute, jadwal, tiket, dan agen" icon={TruckIcon} actions={
            <SafeButton onClick={() => { if (operasionalTab === 'RUTE') setShowRouteModal(true); else if (operasionalTab === 'JADWAL') setShowJadwalModal(true); else if (operasionalTab === 'TIKET') setShowTiketModal(true); else { setEditingAgent(null); setShowAgenModal(true) } }} icon={<Plus className="w-4 h-4" />} size="sm">
              Tambah {operasionalTab === 'RUTE' ? 'Rute' : operasionalTab === 'JADWAL' ? 'Jadwal' : operasionalTab === 'TIKET' ? 'Tiket' : 'Agen'}
            </SafeButton>
          } />
          <div className="flex gap-1 mt-4 mb-4 overflow-x-auto">
            {(['RUTE', 'JADWAL', 'TIKET', 'AGEN'] as OperasionalTab[]).map(t => (
              <button key={t} onClick={() => setOperasionalTab(t)} className={cn('px-4 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-all whitespace-nowrap', operasionalTab === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{t === 'RUTE' ? 'Rute' : t === 'JADWAL' ? 'Jadwal' : t === 'TIKET' ? 'Tiket' : 'Agen'}</button>
            ))}
          </div>

          {operasionalTab === 'RUTE' && (
            localRoutes.length === 0
              ? <EmptyState icon={MapPin} title="Belum ada rute" description="Tambahkan rute trayek bus." action={<SafeButton onClick={() => setShowRouteModal(true)} icon={<Plus className="w-4 h-4" />}>Tambah Rute</SafeButton>} />
              : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {localRoutes.map(r => (
                    <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                      <p className="font-semibold text-slate-800">{r.name}</p>
                      <div className="flex items-center gap-2 text-sm text-slate-500 mt-1"><span>{r.origin}</span><ChevronRight className="w-4 h-4 shrink-0" /><span>{r.destination}</span></div>
                      <div className="flex gap-4 mt-2 text-xs text-slate-500">
                        {r.distance_km && <span>{r.distance_km} km</span>}
                        {r.duration_hours && <span>~{r.duration_hours} jam</span>}
                        <span className="font-medium text-slate-700">{formatRupiah(r.base_price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
          )}

          {operasionalTab === 'JADWAL' && (
            localSchedules.length === 0
              ? <EmptyState icon={Clock} title="Belum ada jadwal" description="Buat jadwal keberangkatan." action={<SafeButton onClick={() => setShowJadwalModal(true)} icon={<Plus className="w-4 h-4" />}>Tambah Jadwal</SafeButton>} />
              : (
                <div className="space-y-3">
                  {localSchedules.map(s => (
                    <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn('text-xs font-medium px-2 py-1 rounded-full', SCHEDULE_STATUS_COLORS[s.status])}>{s.status}</span>
                            {s.bus && <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-full">{s.bus.plate_number}</span>}
                          </div>
                          <p className="font-semibold text-slate-800 mt-2">{s.route ? `${s.route.origin} → ${s.route.destination}` : '—'}</p>
                          <div className="flex gap-4 mt-1 text-xs text-slate-500">
                            <span>Berangkat: {formatDateTime(s.departure_time)}</span>
                            {s.arrival_time && <span>Tiba: {formatDateTime(s.arrival_time)}</span>}
                          </div>
                          {s.driver && <p className="text-xs text-slate-500 mt-1">Driver: {s.driver.name}</p>}
                        </div>
                        {s.status === 'TERJADWAL' && <SafeButton size="sm" variant="blue" onClick={async () => { const r = await updateBusScheduleStatus(orgId, s.id, 'BERANGKAT'); if (!r.error) setLocalSchedules(prev => prev.map(x => x.id === s.id ? { ...x, status: 'BERANGKAT' as const } : x)) }}>Berangkat</SafeButton>}
                        {s.status === 'BERANGKAT' && <SafeButton size="sm" variant="emerald" onClick={async () => { const r = await updateBusScheduleStatus(orgId, s.id, 'TIBA'); if (!r.error) setLocalSchedules(prev => prev.map(x => x.id === s.id ? { ...x, status: 'TIBA' as const } : x)) }}>Tiba</SafeButton>}
                      </div>
                    </div>
                  ))}
                </div>
              )
          )}

          {operasionalTab === 'TIKET' && (
            localTickets.length === 0
              ? <EmptyState icon={Ticket} title="Belum ada tiket" description="Jual tiket untuk jadwal yang tersedia." action={<SafeButton onClick={() => setShowTiketModal(true)} icon={<Plus className="w-4 h-4" />}>Jual Tiket</SafeButton>} />
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Penumpang</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Rute</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Keberangkatan</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Kursi</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Status</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Harga</th>
                    </tr></thead>
                    <tbody>{localTickets.map(t => (
                      <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-3 px-3"><p className="font-medium">{t.passenger_name}</p>{t.passenger_phone && <p className="text-xs text-slate-400">{t.passenger_phone}</p>}</td>
                        <td className="py-3 px-3 text-slate-600">{t.schedule?.route ? `${(t.schedule.route as any).origin} → ${(t.schedule.route as any).destination}` : '-'}</td>
                        <td className="py-3 px-3 text-slate-500">{formatDateTime(t.schedule?.departure_time)}</td>
                        <td className="py-3 px-3"><span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full">{t.seat_number}</span></td>
                        <td className="py-3 px-3"><span className={cn('text-xs px-2 py-0.5 rounded-full', t.status === 'DIBAYAR' || t.status === 'DIGUNAKAN' ? 'bg-emerald-50 text-emerald-700' : t.status === 'BATAL' ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-700')}>{t.status}</span></td>
                        <td className="py-3 px-3 text-right font-medium">{formatRupiah(t.price)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )
          )}

          {operasionalTab === 'AGEN' && (
            localAgents.length === 0
              ? <EmptyState icon={Building2} title="Belum ada agen" description="Tambahkan agen penjualan tiket." action={<SafeButton onClick={() => { setEditingAgent(null); setShowAgenModal(true) }} icon={<Plus className="w-4 h-4" />}>Tambah Agen</SafeButton>} />
              : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {localAgents.map(a => (
                    <div key={a.id} className={cn('bg-white border rounded-xl p-4 hover:shadow-md transition-shadow', a.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60')}>
                      <div className="flex items-start justify-between">
                        <div><p className="font-semibold text-slate-800">{a.name}</p>{a.city && <p className="text-xs text-slate-500">{a.city}</p>}</div>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingAgent(a); setShowAgenModal(true) }} className="p-1.5 text-slate-300 hover:text-blue-500 cursor-pointer transition-colors rounded-lg hover:bg-blue-50"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteAgent(a)} className="p-1.5 text-slate-300 hover:text-rose-500 cursor-pointer transition-colors rounded-lg hover:bg-rose-50"><XCircle className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-slate-500">
                        {a.phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{a.phone}</p>}
                        {a.email && <p className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{a.email}</p>}
                        <p>Komisi: <span className="font-medium text-slate-700">{a.commission_pct}%</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              )
          )}
        </SectionCard>
      )}

      {/* CHECKPOINT */}
      {activeTab === 'CHECKPOINT' && (
        <SectionCard>
          <SectionHeader title="Checkpoint & Terminal" subtitle="Titik pemantauan GPS perjalanan" icon={Navigation} actions={<SafeButton onClick={() => setShowCheckpointModal(true)} icon={<Plus className="w-4 h-4" />} size="sm">Tambah Checkpoint</SafeButton>} />
          {localCheckpoints.length === 0
            ? <EmptyState icon={Navigation} title="Belum ada checkpoint" description="Tambahkan titik checkpoint GPS." action={<SafeButton onClick={() => setShowCheckpointModal(true)} icon={<Plus className="w-4 h-4" />}>Tambah Checkpoint</SafeButton>} />
            : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {localCheckpoints.map(cp => (
                  <div key={cp.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg shrink-0"><MapPin className="w-4 h-4 text-blue-600" /></div>
                      <div><p className="font-semibold text-slate-800">{cp.name}</p>{cp.location_name && <p className="text-xs text-slate-500 mt-0.5">{cp.location_name}</p>}{cp.gps_coords && <p className="text-xs text-slate-400 font-mono mt-1">{cp.gps_coords}</p>}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </SectionCard>
      )}

      {/* ═══ MODALS ════════════════════════════════════════════════════════════ */}

      <Modal open={showUnitModal} onClose={() => { setShowUnitModal(false); setSelectedFixedAsset(null); setEditingUnit(null) }} title={editingUnit ? 'Edit Unit Bus' : 'Tambah Unit Bus'}>
        <form onSubmit={handleSaveUnit} className="space-y-4">

          {/* Link ke Fixed Assets */}
          <FormField label="Aset Tetap (opsional)">
            <Select
              value={selectedFixedAsset?.id || ''}
              onChange={e => {
                const fa = fixedAssets.find(f => f.id === e.target.value) || null
                setSelectedFixedAsset(fa)
              }}
            >
              <option value="">— Pilih dari Fixed Assets (opsional) —</option>
              {fixedAssets.map(fa => (
                <option key={fa.id} value={fa.id}>
                  {fa.code} — {fa.name}
                </option>
              ))}
            </Select>
          </FormField>

          {/* Info finansial dari Fixed Asset */}
          {selectedFixedAsset && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2 text-xs">
              <p className="font-semibold text-blue-800 mb-2">Info dari Aset Tetap</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-700">
                <span className="text-slate-500">Harga Beli</span>
                <span className="font-medium">{formatRupiah(selectedFixedAsset.purchase_price)}</span>
                <span className="text-slate-500">Nilai Buku Saat Ini</span>
                <span className="font-medium text-blue-700">{formatRupiah(selectedFixedAsset.current_book_value)}</span>
                <span className="text-slate-500">Akumulasi Penyusutan</span>
                <span className="font-medium text-amber-700">{formatRupiah(selectedFixedAsset.accumulated_depreciation)}</span>
                <span className="text-slate-500">Masa Manfaat</span>
                <span className="font-medium">{selectedFixedAsset.useful_life_months} bulan</span>
                <span className="text-slate-500">Metode Depresiasi</span>
                <span className="font-medium">{selectedFixedAsset.depreciation_method}</span>
                <span className="text-slate-500">Tanggal Beli</span>
                <span className="font-medium">{formatDate(selectedFixedAsset.purchase_date)}</span>
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-500 mb-3">Data Operasional</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Nomor Plat *"><Input name="plate_number" defaultValue={editingUnit?.plate_number || ''} placeholder="B 1234 ABC" required /></FormField>
                <FormField label="Merek *"><Input name="brand" defaultValue={editingUnit?.brand || ''} placeholder="Hino, Mercedes, Scania" required /></FormField>
              </div>
              <FormField label="Model *"><Input name="model" defaultValue={editingUnit?.model || ''} placeholder="RK8 JSST, OH 1626" required /></FormField>
              <div className="grid grid-cols-3 gap-4">
                <FormField label="Tahun"><Input name="year" type="number" defaultValue={editingUnit?.year || ''} placeholder="2022" /></FormField>
                <FormField label="Kapasitas (kursi)"><Input name="capacity" type="number" defaultValue={editingUnit?.capacity || ''} placeholder="40" /></FormField>
                <FormField label="Tipe Body"><Input name="body_type" defaultValue={editingUnit?.body_type || ''} placeholder="Patas, Executive" /></FormField>
              </div>
              <FormField label="Warna"><Input name="color" defaultValue={editingUnit?.color || ''} placeholder="Putih" /></FormField>

              {!selectedFixedAsset && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Harga Beli (Rp)"><Input name="purchase_price" type="number" defaultValue={editingUnit?.purchase_price || ''} placeholder="500000000" /></FormField>
                    <FormField label="Tanggal Beli"><Input name="purchase_date" type="date" defaultValue={editingUnit?.purchase_date?.split('T')[0] || ''} /></FormField>
                  </div>
                  {!editingUnit && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
                      <p className="text-xs font-semibold text-amber-800">Aset Tetap — isi untuk auto-register</p>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Masa Manfaat (bulan)"><Input name="useful_life_months" type="number" placeholder="60" /></FormField>
                        <FormField label="Nilai Sisa (Rp)"><Input name="salvage_value" type="number" placeholder="50000000" /></FormField>
                      </div>
                      <FormField label="Metode Depresiasi">
                        <Select name="depreciation_method">
                          <option value="STRAIGHT_LINE">Garis Lurus (Straight Line)</option>
                          <option value="DOUBLE_DECLINING">Saldo Menurun (Double Declining)</option>
                        </Select>
                      </FormField>
                      <p className="text-[10px] text-amber-600">Jika harga beli & tanggal beli diisi, bus akan otomatis terdaftar di Fixed Assets.</p>
                    </div>
                  )}
                </>
              )}
              <FormField label="Catatan"><Textarea name="notes" defaultValue={editingUnit?.notes || ''} /></FormField>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => { setShowUnitModal(false); setSelectedFixedAsset(null); setEditingUnit(null) }}>Batal</SafeButton>
            <SafeButton type="submit" icon={<CheckCircle2 className="w-4 h-4" />}>Simpan</SafeButton>
          </div>
        </form>
      </Modal>

      <Modal open={showCrewModal} onClose={() => setShowCrewModal(false)} title="Tambah Kru Bus">
        <form onSubmit={handleCreateCrew} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nama Lengkap *"><Input name="name" placeholder="Ahmad Santoso" required /></FormField>
            <FormField label="Jabatan *">
              <Select name="role" required>
                <option value="DRIVER">Driver</option>
                <option value="CO_DRIVER">Co-Driver</option>
                <option value="KERNET">Kernet</option>
                <option value="KONDEKTUR">Kondektur</option>
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="No. HP"><Input name="phone" placeholder="08123456789" /></FormField>
            <FormField label="NIK"><Input name="nik" placeholder="3201..." /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="No. SIM"><Input name="license_number" placeholder="123456789012" /></FormField>
            <FormField label="Masa Berlaku SIM"><Input name="license_expiry" type="date" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Gol. Darah"><Select name="blood_type"><option value="">—</option>{['A','B','AB','O'].map(b => <option key={b} value={b}>{b}</option>)}</Select></FormField>
            <FormField label="Tanggal Bergabung"><Input name="join_date" type="date" /></FormField>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowCrewModal(false)}>Batal</SafeButton>
            <SafeButton type="submit" icon={<CheckCircle2 className="w-4 h-4" />}>Simpan</SafeButton>
          </div>
        </form>
      </Modal>

      <Modal open={showMechanicModal} onClose={() => { setShowMechanicModal(false); setEditingMechanic(null) }} title={editingMechanic ? 'Edit Mekanik' : 'Tambah Mekanik'}>
        <form onSubmit={handleSaveMechanic} className="space-y-4">
          <FormField label="Nama *"><Input name="name" defaultValue={editingMechanic?.name || ''} placeholder="Budi Santoso" required /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="No. HP"><Input name="phone" defaultValue={editingMechanic?.phone || ''} placeholder="08123456789" /></FormField>
            <FormField label="Spesialisasi"><Input name="specialization" defaultValue={editingMechanic?.specialization || ''} placeholder="Mesin Diesel" /></FormField>
          </div>
          <FormField label="Catatan"><Textarea name="notes" defaultValue={editingMechanic?.notes || ''} /></FormField>
          <div className="flex gap-3 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => { setShowMechanicModal(false); setEditingMechanic(null) }}>Batal</SafeButton>
            <SafeButton type="submit" icon={<CheckCircle2 className="w-4 h-4" />}>Simpan</SafeButton>
          </div>
        </form>
      </Modal>

      <Modal open={showServisModal} onClose={() => setShowServisModal(false)} title="Rekam Servis Bus">
        <form onSubmit={handleCreateServis} className="space-y-4">
          <FormField label="Unit Bus *"><Select name="bus_id" required><option value="">— Pilih Unit —</option>{localUnits.map(u => <option key={u.id} value={u.id}>{u.plate_number} — {u.model}</option>)}</Select></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tanggal Servis *"><Input name="service_date" type="date" required /></FormField>
            <FormField label="Tipe *"><Select name="maintenance_type" required><option value="ROUTINE">Rutin</option><option value="CORRECTIVE">Perbaikan</option><option value="EMERGENCY">Darurat</option></Select></FormField>
          </div>
          <FormField label="Deskripsi *"><Textarea name="description" placeholder="Ganti oli, tune up, dll..." required /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Biaya (Rp)"><Input name="cost" type="number" placeholder="500000" /></FormField>
            <FormField label="Odometer (km)"><Input name="odometer_at" type="number" placeholder="50000" /></FormField>
          </div>
          <FormField label="Teknisi"><Input name="technician_name" placeholder="Nama teknisi" /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Servis Berikutnya (km)"><Input name="next_service_km" type="number" /></FormField>
            <FormField label="Tgl Servis Berikutnya"><Input name="next_service_date" type="date" /></FormField>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowServisModal(false)}>Batal</SafeButton>
            <SafeButton type="submit" icon={<CheckCircle2 className="w-4 h-4" />}>Simpan</SafeButton>
          </div>
        </form>
      </Modal>

      <Modal open={showBanModal} onClose={() => setShowBanModal(false)} title="Rekam Penggantian Ban">
        <form onSubmit={handleCreateBan} className="space-y-4">
          <FormField label="Unit Bus *"><Select name="bus_id" required><option value="">— Pilih Unit —</option>{localUnits.map(u => <option key={u.id} value={u.id}>{u.plate_number} — {u.model}</option>)}</Select></FormField>
          <FormField label="Posisi Ban *"><Select name="position" required><option value="">— Pilih Posisi —</option>{['FL','FR','RL','RR','RLL','RLT','RLI','RRL','RRT','RRI','SPARE'].map(p => <option key={p} value={p}>{p}</option>)}</Select></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Merek"><Input name="brand" placeholder="Bridgestone" /></FormField>
            <FormField label="Ukuran"><Input name="size" placeholder="11.00R20" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tanggal Pasang"><Input name="installed_at" type="date" /></FormField>
            <FormField label="Odometer Saat Pasang"><Input name="odometer_at" type="number" /></FormField>
          </div>
          <FormField label="Batas Pemakaian (km)"><Input name="mileage_limit_km" type="number" /></FormField>
          <FormField label="Catatan"><Textarea name="notes" /></FormField>
          <div className="flex gap-3 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowBanModal(false)}>Batal</SafeButton>
            <SafeButton type="submit" icon={<CheckCircle2 className="w-4 h-4" />}>Simpan</SafeButton>
          </div>
        </form>
      </Modal>

      <Modal open={showEmergencyModal} onClose={() => setShowEmergencyModal(false)} title="Laporkan Emergency">
        <form onSubmit={handleCreateEmergency} className="space-y-4">
          <FormField label="Nama Pelapor *"><Input name="reporter_name" placeholder="Nama driver / kernet" required /></FormField>
          <FormField label="Unit Bus"><Select name="bus_id"><option value="">— Pilih Unit (opsional) —</option>{localUnits.map(u => <option key={u.id} value={u.id}>{u.plate_number} — {u.model}</option>)}</Select></FormField>
          <FormField label="Jenis Kejadian *"><Select name="issue_type" required><option value="MOGOK">Mogok</option><option value="BAN_BOCOR">Ban Bocor</option><option value="KECELAKAAN">Kecelakaan</option><option value="OVERHEAT">Overheat</option><option value="LAINNYA">Lainnya</option></Select></FormField>
          <FormField label="Lokasi Kejadian"><Input name="location_description" placeholder="Km 45 Tol Cipularang" /></FormField>
          <FormField label="Keterangan"><Textarea name="description" placeholder="Jelaskan kondisi secara singkat..." /></FormField>
          <FormField label="Tugaskan Mekanik"><Select name="assigned_mechanic_id"><option value="">— Pilih Mekanik (opsional) —</option>{localMechanics.filter(m => m.is_active).map(m => <option key={m.id} value={m.id}>{m.name}{m.specialization ? ` — ${m.specialization}` : ''}</option>)}</Select></FormField>
          <div className="flex gap-3 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowEmergencyModal(false)}>Batal</SafeButton>
            <SafeButton type="submit" variant="danger" icon={<AlertTriangle className="w-4 h-4" />}>Laporkan</SafeButton>
          </div>
        </form>
      </Modal>

      {updatingEmergency && (
        <Modal open={true} onClose={() => setUpdatingEmergency(null)} title="Tandai Emergency Selesai">
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); handleUpdateEmergency(updatingEmergency, 'SELESAI', fd.get('resolution_notes') as string) }} className="space-y-4">
            <p className="text-sm text-slate-600">Unit: <strong>{updatingEmergency.bus?.plate_number || '—'}</strong> — {ISSUE_TYPE_LABELS[updatingEmergency.issue_type]}</p>
            <FormField label="Catatan Resolusi *"><Textarea name="resolution_notes" placeholder="Apa yang dilakukan untuk menyelesaikan masalah?" required /></FormField>
            <div className="flex gap-3 justify-end pt-2">
              <SafeButton type="button" variant="ghost" onClick={() => setUpdatingEmergency(null)}>Batal</SafeButton>
              <SafeButton type="submit" variant="emerald" icon={<CheckCircle2 className="w-4 h-4" />}>Tandai Selesai</SafeButton>
            </div>
          </form>
        </Modal>
      )}

      <Modal open={showRouteModal} onClose={() => setShowRouteModal(false)} title="Tambah Rute">
        <form onSubmit={handleCreateRoute} className="space-y-4">
          <FormField label="Nama Rute *"><Input name="name" placeholder="Jakarta — Bandung (Cipularang)" required /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Asal *"><Input name="origin" placeholder="Jakarta" required /></FormField>
            <FormField label="Tujuan *"><Input name="destination" placeholder="Bandung" required /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Jarak (km)"><Input name="distance_km" type="number" placeholder="150" /></FormField>
            <FormField label="Estimasi Waktu (jam)"><Input name="duration_hours" type="number" step="0.5" placeholder="3" /></FormField>
          </div>
          <FormField label="Tarif Dasar (Rp)"><Input name="base_price" type="number" placeholder="150000" /></FormField>
          <div className="flex gap-3 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowRouteModal(false)}>Batal</SafeButton>
            <SafeButton type="submit" icon={<CheckCircle2 className="w-4 h-4" />}>Simpan</SafeButton>
          </div>
        </form>
      </Modal>

      <Modal open={showJadwalModal} onClose={() => setShowJadwalModal(false)} title="Buat Jadwal Keberangkatan">
        <form onSubmit={handleCreateJadwal} className="space-y-4">
          <FormField label="Rute *"><Select name="route_id" required><option value="">— Pilih Rute —</option>{localRoutes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></FormField>
          <FormField label="Armada *"><Select name="bus_id" required><option value="">— Pilih Bus —</option>{localUnits.filter(u => u.status === 'TERSEDIA').map(u => <option key={u.id} value={u.id}>{u.plate_number} — {u.model}</option>)}</Select></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Driver"><Select name="driver_id"><option value="">— Pilih Driver —</option>{localCrew.filter(c => c.is_active && ['DRIVER','CO_DRIVER'].includes(c.role)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></FormField>
            <FormField label="Kernet/Kondektur"><Select name="helper_id"><option value="">— Pilih —</option>{localCrew.filter(c => c.is_active && ['KERNET','KONDEKTUR'].includes(c.role)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Waktu Berangkat *"><Input name="departure_time" type="datetime-local" required /></FormField>
            <FormField label="Estimasi Tiba"><Input name="arrival_time" type="datetime-local" /></FormField>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowJadwalModal(false)}>Batal</SafeButton>
            <SafeButton type="submit" icon={<CheckCircle2 className="w-4 h-4" />}>Buat Jadwal</SafeButton>
          </div>
        </form>
      </Modal>

      <Modal open={showTiketModal} onClose={() => setShowTiketModal(false)} title="Jual Tiket">
        <form onSubmit={handleCreateTiket} className="space-y-4">
          <FormField label="Jadwal *"><Select name="schedule_id" required><option value="">— Pilih Jadwal —</option>{localSchedules.filter(s => s.status === 'TERJADWAL').map(s => <option key={s.id} value={s.id}>{s.route ? `${s.route.origin} → ${s.route.destination}` : '?'} — {formatDateTime(s.departure_time)}</option>)}</Select></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nama Penumpang *"><Input name="passenger_name" placeholder="Nama lengkap" required /></FormField>
            <FormField label="No. HP Penumpang"><Input name="passenger_phone" placeholder="08123456789" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nomor Kursi *"><Input name="seat_number" placeholder="1A" required /></FormField>
            <FormField label="Harga (Rp)"><Input name="price" type="number" placeholder="150000" /></FormField>
          </div>
          <FormField label="Agen (opsional)"><Select name="agent_id"><option value="">— Langsung / Walk-in —</option>{localAgents.filter(a => a.is_active).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></FormField>
          <FormField label="Catatan"><Input name="notes" placeholder="Catatan tambahan..." /></FormField>
          <div className="flex gap-3 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowTiketModal(false)}>Batal</SafeButton>
            <SafeButton type="submit" icon={<Ticket className="w-4 h-4" />}>Jual Tiket</SafeButton>
          </div>
        </form>
      </Modal>

      <Modal open={showAgenModal} onClose={() => { setShowAgenModal(false); setEditingAgent(null) }} title={editingAgent ? 'Edit Agen' : 'Tambah Agen'}>
        <form onSubmit={handleSaveAgent} className="space-y-4">
          <FormField label="Nama Agen *"><Input name="name" defaultValue={editingAgent?.name || ''} placeholder="Agen Tiket Maju" required /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="No. HP"><Input name="phone" defaultValue={editingAgent?.phone || ''} placeholder="08123456789" /></FormField>
            <FormField label="Email"><Input name="email" defaultValue={editingAgent?.email || ''} type="email" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Kota"><Input name="city" defaultValue={editingAgent?.city || ''} placeholder="Bandung" /></FormField>
            <FormField label="Komisi (%)"><Input name="commission_pct" type="number" step="0.01" defaultValue={editingAgent?.commission_pct || 0} /></FormField>
          </div>
          <FormField label="Alamat"><Textarea name="address" defaultValue={editingAgent?.address || ''} /></FormField>
          <div className="flex gap-3 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => { setShowAgenModal(false); setEditingAgent(null) }}>Batal</SafeButton>
            <SafeButton type="submit" icon={<CheckCircle2 className="w-4 h-4" />}>Simpan</SafeButton>
          </div>
        </form>
      </Modal>

      <Modal open={showCheckpointModal} onClose={() => setShowCheckpointModal(false)} title="Tambah Checkpoint">
        <form onSubmit={handleCreateCheckpoint} className="space-y-4">
          <FormField label="Nama Checkpoint *"><Input name="name" placeholder="Terminal Leuwipanjang" required /></FormField>
          <FormField label="Lokasi / Alamat"><Input name="location" placeholder="Jl. Soekarno-Hatta, Bandung" /></FormField>
          <FormField label="Koordinat GPS"><Input name="gps_coordinates" placeholder="-6.9175,107.6191" /></FormField>
          <div className="flex gap-3 justify-end pt-2">
            <SafeButton type="button" variant="ghost" onClick={() => setShowCheckpointModal(false)}>Batal</SafeButton>
            <SafeButton type="submit" icon={<CheckCircle2 className="w-4 h-4" />}>Simpan</SafeButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
