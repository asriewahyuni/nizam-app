'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { CargoPosTab } from '@/app/(dashboard)/po-bus/components/cargo/CargoPosTab'

export function CargoPosFullClient({
  orgId,
  cargoShipments,
  pools,
  cargoTariffs = [],
  defaultOriginPoolId
}: {
  orgId: string
  cargoShipments: any[]
  pools: any[]
  cargoTariffs: any[]
  defaultOriginPoolId: string | null
}) {
  const router = useRouter()

  const handleRefresh = () => {
    router.refresh()
  }

  return (
    <div className="bg-white rounded-[2rem] shadow-sm p-4 md:p-8">
      <CargoPosTab 
        orgId={orgId}
        shipments={cargoShipments}
        pools={pools}
        tariffs={cargoTariffs}
        onRefresh={() => window.location.reload()}
        isFullScreen={true}
        defaultOriginPoolId={defaultOriginPoolId}
      />
    </div>
  )
}
