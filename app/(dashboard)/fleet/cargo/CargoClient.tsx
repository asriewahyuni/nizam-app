'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Package, Truck, Inbox, CheckCircle, Search, ScanBarcode, CreditCard } from 'lucide-react'

import type { FleetCargoShipment, FleetTerminal, FleetSchedule } from '@/types/database.types'
import { CargoPosTab } from './CargoPosTab'
import { CargoManifestTab } from './CargoManifestTab'
import { CargoReceiveTab } from './CargoReceiveTab'
import { CargoDeliveryTab } from './CargoDeliveryTab'
import { CargoTariffTab } from './CargoTariffTab'

export function CargoClient({
  orgId,
  initialShipments,
  terminals,
  schedules,
  tariffs = [],
  pools = [],
  role = '',
  permissions = []
}: {
  orgId: string
  initialShipments: any[]
  terminals: FleetTerminal[]
  schedules: any[]
  tariffs?: any[]
  pools?: Array<{ id: string; code: string; name: string; pool_type: string; city?: string | null }>
  role?: string
  permissions?: string[]
}) {
  const isSuper = role === 'owner' || role === 'admin' || permissions.includes('fleet:write')
  const canAccessPos = isSuper || permissions.includes('pos:write') || permissions.includes('pos:read')

  const availableTabs = []
  if (canAccessPos) {
    availableTabs.push({ id: 'pos', label: 'POS Kargo', icon: Plus })
  }
  if (isSuper) {
    availableTabs.push({ id: 'manifest', label: 'Manifest (Loading)', icon: Truck })
    availableTabs.push({ id: 'receive', label: 'Unloading (Tiba)', icon: Inbox })
    availableTabs.push({ id: 'delivery', label: 'Serah Terima', icon: CheckCircle })
    availableTabs.push({ id: 'tariff', label: 'Tarif Dasar', icon: CreditCard })
  }

  const defaultTab = availableTabs.length > 0 ? availableTabs[0].id : ''
  const [activeTab, setActiveTab] = useState<string>(defaultTab)

  useEffect(() => {
    if (!activeTab && defaultTab) {
      setActiveTab(defaultTab)
    }
  }, [defaultTab, activeTab])

  if (availableTabs.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 mt-6">
        <h2 className="text-lg font-bold text-slate-800">Akses Ditolak</h2>
        <p className="text-slate-500 mt-2">Anda tidak memiliki izin untuk mengakses modul Kargo & Ekspedisi.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Kargo & Ekspedisi</h1>
        <p className="text-muted-foreground text-sm">Kelola pengiriman paket antar terminal bus.</p>
      </div>

      <div className="flex space-x-2 bg-slate-100/50 p-1 rounded-xl w-fit overflow-x-auto max-w-full">
        {availableTabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'pos' && canAccessPos && (
            <CargoPosTab
              orgId={orgId}
              terminals={terminals}
              shipments={initialShipments}
              tariffs={tariffs}
              pools={pools}
              onRefresh={() => {
                window.location.reload()
              }}
            />
          )}
          
          {activeTab === 'manifest' && isSuper && (
             <CargoManifestTab
                orgId={orgId}
                schedules={schedules}
                shipments={initialShipments}
                onRefresh={() => window.location.reload()}
             />
          )}

          {activeTab === 'receive' && isSuper && (
             <CargoReceiveTab
                orgId={orgId}
                shipments={initialShipments}
                onRefresh={() => window.location.reload()}
             />
          )}

          {activeTab === 'delivery' && isSuper && (
             <CargoDeliveryTab
                orgId={orgId}
                shipments={initialShipments}
                onRefresh={() => window.location.reload()}
             />
          )}

          {activeTab === 'tariff' && isSuper && (
             <CargoTariffTab
                orgId={orgId}
                terminals={terminals}
                tariffs={tariffs}
                onRefresh={() => window.location.reload()}
             />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
