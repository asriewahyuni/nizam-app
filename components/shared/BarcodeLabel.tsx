'use client'

import React from 'react'
import Barcode from 'react-barcode'
import { formatRupiah } from '@/lib/utils'

interface BarcodeLabelProps {
  name: string
  sku: string
  barcode: string
  price?: number
  quantity?: number
}

export const BarcodeLabel = ({ name, sku, barcode, price, quantity = 1 }: BarcodeLabelProps) => {
  // Create an array for batch printing
  const labels = Array.from({ length: quantity })

  return (
    <div className="label-container p-4 bg-white min-h-screen">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 print:block">
        {labels.map((_, i) => (
          <div 
            key={i} 
            className="barcode-card border border-slate-200 p-4 rounded-lg flex flex-col items-center justify-center bg-white print:border-0 print:m-0 print:p-2 print:w-[50mm] print:h-[30mm] overflow-hidden"
            style={{ pageBreakInside: 'avoid' }}
          >
            <div className="text-[10px] font-black text-slate-900 uppercase truncate w-full text-center mb-1">
              {name}
            </div>
            
            <Barcode 
               value={barcode || sku || 'NIZAM-ERP'} 
               width={1.5} 
               height={40} 
               fontSize={10}
               margin={0}
            />
            
            <div className="flex justify-between items-center w-full mt-1 px-2">
               <span className="text-[8px] font-mono text-slate-500">{sku}</span>
               {price && <span className="text-[9px] font-black text-slate-900">{formatRupiah(price)}</span>}
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .label-container, .label-container * {
            visibility: visible;
          }
          .label-container {
            position: absolute;
            left: 0;
            top: 0;
            padding: 0;
            margin: 0;
          }
          .barcode-card {
            width: 50mm;
            height: 30mm;
            border: 0.1mm solid #eee;
            margin-bottom: 2mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          @page {
            size: auto;
            margin: 0;
          }
        }
      `}</style>
    </div>
  )
}
