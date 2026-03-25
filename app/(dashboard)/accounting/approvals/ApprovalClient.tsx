'use client'

import React, { useState } from 'react'
import { Check, X, Bell, FileText, View, QrCode, ShieldCheck, AlertTriangle } from 'lucide-react'
import { decideApproval, getApprovalDetail } from '@/modules/organization/actions/approval.actions'
import { formatRupiah, formatDate } from '@/lib/utils'
import { QRCodeSVG } from 'qrcode.react'

interface ApprovalClientProps {
  orgId: string
  initialApprovals: any[]
}

export function ApprovalClient({ orgId, initialApprovals }: ApprovalClientProps) {
  const [approvals, setApprovals] = useState(initialApprovals)
  const [submitting, setSubmitting] = useState<string | null>(null)

  // Detail Modal State
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedReq, setSelectedReq] = useState<any>(null)
  const [detailData, setDetailData] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Confirmation + Notes Modal State
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'APPROVED' | 'REJECTED' | null>(null)
  const [confirmReqId, setConfirmReqId] = useState<string>('')
  const [confirmNotes, setConfirmNotes] = useState('')

  // QR Signature Modal State
  const [signOpen, setSignOpen] = useState(false)
  const [signatureData, setSignatureData] = useState<string>('')

  const openConfirm = (id: string, action: 'APPROVED' | 'REJECTED') => {
    setConfirmReqId(id)
    setConfirmAction(action)
    setConfirmNotes('')
    setDetailOpen(false)
    setConfirmOpen(true)
  }

  const handleConfirmSubmit = async () => {
    if (!confirmAction) return
    setSubmitting(confirmReqId)
    setConfirmOpen(false)
    const res = await decideApproval(confirmReqId, orgId, confirmAction, confirmNotes)
    if (res.error) {
      alert(res.error)
      setSubmitting(null)
    } else {
      setApprovals(approvals.filter(a => a.id !== confirmReqId))
      setSubmitting(null)
      if (confirmAction === 'APPROVED') {
        const ts = new Date().toISOString()
        setSignatureData(`APPROVED|REQ:${confirmReqId}|DATE:${ts}|ORG:${orgId}`)
        setSignOpen(true)
      }
    }
  }

  const handleDetail = async (req: any) => {
    setSelectedReq(req)
    setDetailData(null)
    setDetailOpen(true)
    setLoadingDetail(true)
    const res = await getApprovalDetail(orgId, req.source_id, req.source_type)
    setDetailData(res.data)
    setLoadingDetail(false)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 relative">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Bell className="text-[#003366]" size={32} />
          Approval Center
        </h1>
        <p className="text-slate-500 font-medium">Pusat kendali persetujuan operasional NIZAM ERP. Tanda Tangan Digital QR akan di-generate otomatis setelah verifikasi.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {approvals.length === 0 ? (
          <div className="py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500">
              <ShieldCheck size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-lg">Semua Beres!</h3>
              <p className="text-sm text-slate-400 max-w-xs mx-auto">Tidak ada permintaan persetujuan yang tertunda saat ini.</p>
            </div>
          </div>
        ) : (
          approvals.map((req) => (
            <div key={req.id} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6 overflow-hidden relative group">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#003366] opacity-0 group-hover:opacity-100 transition-all" />

              <div className="flex items-center gap-6">
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${req.source_type === 'SALES_ORDER' ? 'bg-emerald-50 text-emerald-600' : 'bg-[#003366]/5 text-[#003366]'}`}>
                    <FileText size={24} />
                 </div>
                 <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${req.source_type === 'SALES_ORDER' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#003366]/5 text-[#003366]'}`}>{req.source_type}</span>
                       <span className="text-slate-400 text-xs font-mono">• {formatDate(req.requested_at)}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{req.reason || 'Permintaan Persetujuan Operasional'}</h3>
                    <p className="text-sm text-slate-500">Oleh: <span className="font-bold text-slate-700">{req.requester?.email || 'Staf Internal'}</span></p>
                 </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                 <button disabled={submitting === req.id} onClick={() => handleDetail(req)}
                   className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100 transition-all">
                    <View size={18} /> Detail
                 </button>
                 <button disabled={submitting === req.id} onClick={() => openConfirm(req.id, 'REJECTED')}
                   className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-rose-600 bg-white border border-rose-100 rounded-2xl hover:bg-rose-50 transition-all">
                    <X size={18} /> Tolak
                 </button>
                 <button disabled={submitting === req.id} onClick={() => openConfirm(req.id, 'APPROVED')}
                   className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 text-sm font-bold text-white bg-[#003366] rounded-2xl hover:bg-[#002d5a] shadow-lg shadow-[#003366]/10 transition-all">
                    {submitting === req.id ? '⏳ Memproses...' : <><QrCode size={18} /> Setujui &amp; TTD</>}
                 </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DETAIL MODAL */}
      {detailOpen && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white p-6 border-b flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2"><FileText className="text-[#003366]" /> Detail {selectedReq.source_type}</h2>
                <p className="text-sm text-slate-500">{selectedReq.reason}</p>
              </div>
              <button onClick={() => setDetailOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>

            <div className="p-6">
              {loadingDetail ? (
                <div className="text-center py-10 opacity-50 font-medium">Memuat rincian dokumen...</div>
              ) : !detailData ? (
                <div className="text-center py-10 text-rose-500 font-medium">Data detail tidak tersedia.</div>
              ) : (
                <div className="space-y-6">
                  {selectedReq.source_type === 'PURCHASE_ORDER' && (
                    <>
                      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl">
                        <div>
                          <p className="text-xs text-slate-500 uppercase font-bold">Total Pembelian</p>
                          <p className="text-lg font-black text-slate-900">{formatRupiah(detailData.grand_total)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase font-bold">Mode Syariah</p>
                          <p className="text-lg font-black text-slate-900">{detailData.shariah_mode || 'CASH'}</p>
                        </div>
                      </div>
                      <h3 className="font-bold text-slate-800">Item Pembelian</h3>
                      <div className="space-y-3">
                        {detailData.purchase_items?.map((item: any) => (
                          <div key={item.id} className="flex justify-between items-center p-4 border border-slate-100 rounded-xl">
                            <div>
                               <p className="font-bold">{item.products?.name || item.description}</p>
                               <p className="text-sm text-slate-500">{item.quantity} x {formatRupiah(item.unit_price)}</p>
                            </div>
                            <div className="font-bold text-[#003366]">{formatRupiah(item.quantity * item.unit_price)}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {selectedReq.source_type === 'REIMBURSEMENT' && (
                    <>
                      <div className="bg-[#003366]/5 p-6 rounded-3xl border border-[#003366]/10 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-[#003366] uppercase font-black tracking-widest mb-1">Total Pengajuan</p>
                          <p className="text-2xl font-black text-slate-900 font-mono tracking-tighter">{formatRupiah(detailData.total_amount)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Nomor Klaim</p>
                          <p className="text-base font-bold text-slate-800 font-mono">#{detailData.claim_number}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Rincian Pengeluaran</h3>
                        <div className="space-y-3">
                          {detailData.items?.map((item: any) => (
                            <div key={item.id} className="group relative bg-white border border-slate-100 rounded-2xl p-4 hover:border-[#003366]/20 hover:shadow-sm transition-all">
                              <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1">
                                  <p className="font-bold text-slate-900">{item.description}</p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                      {item.account?.name || 'Kategori Lain'}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono">• {item.expense_date}</span>
                                  </div>
                                </div>
                                <div className="text-right space-y-2">
                                  <p className="font-black text-[#003366] font-mono italic">{formatRupiah(item.amount)}</p>
                                  {item.receipt_url && (
                                    <a 
                                      href={item.receipt_url} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 hover:bg-emerald-100 transition-colors"
                                    >
                                      \ud83d\udcf7 LIHAT NOTA
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  {selectedReq.source_type === 'SALES_ORDER' && (
                    <>
                      {/* Header Info Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-50 p-4 rounded-2xl">
                          <p className="text-xs text-emerald-600 uppercase font-black mb-1">Customer</p>
                          <p className="text-base font-black text-slate-900">{detailData.contacts?.name || 'Unknown'}</p>
                          {detailData.contacts?.phone && <p className="text-xs text-slate-500 mt-0.5">{detailData.contacts.phone}</p>}
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl">
                          <p className="text-xs text-slate-400 uppercase font-black mb-1">Nomor SO</p>
                          <p className="text-base font-black text-[#003366]">{detailData.sale_number || '—'}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{detailData.sale_date ? new Date(detailData.sale_date).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}) : '—'}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl">
                          <p className="text-xs text-slate-400 uppercase font-black mb-1">Total Tagihan</p>
                          <p className="text-lg font-black text-slate-900">{formatRupiah(detailData.grand_total)}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl">
                          <p className="text-xs text-slate-400 uppercase font-black mb-1">Termin &amp; Jatuh Tempo</p>
                          <p className="text-sm font-black text-slate-900">{detailData.payment_term || 'CASH'}</p>
                          {detailData.due_date && <p className="text-xs text-amber-600 mt-0.5">Due: {new Date(detailData.due_date).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'})}</p>}
                        </div>
                      </div>

                      {/* Breakdown */}
                      {(detailData.tax_amount > 0 || detailData.discount_amount > 0) && (
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-slate-50 p-3 rounded-xl">
                            <p className="text-[10px] text-slate-400 uppercase font-black">Subtotal</p>
                            <p className="text-sm font-bold text-slate-900">{formatRupiah(detailData.total_amount)}</p>
                          </div>
                          <div className="bg-rose-50 p-3 rounded-xl">
                            <p className="text-[10px] text-rose-500 uppercase font-black">Diskon</p>
                            <p className="text-sm font-bold text-rose-600">- {formatRupiah(detailData.discount_amount)}</p>
                          </div>
                          <div className="bg-[#003366]/5 p-3 rounded-xl">
                            <p className="text-[10px] text-[#003366] uppercase font-black">Pajak</p>
                            <p className="text-sm font-bold text-[#003366]">+ {formatRupiah(detailData.tax_amount)}</p>
                          </div>
                        </div>
                      )}

                      {/* Items */}
                      <div>
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest mb-3">Daftar Item Penjualan</h3>
                        <div className="border border-slate-100 rounded-2xl overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100">
                              <tr>
                                <th className="text-left px-4 py-2.5 text-[10px] text-slate-400 uppercase font-black">Produk</th>
                                <th className="text-center px-4 py-2.5 text-[10px] text-slate-400 uppercase font-black">Qty</th>
                                <th className="text-right px-4 py-2.5 text-[10px] text-slate-400 uppercase font-black">Harga</th>
                                <th className="text-right px-4 py-2.5 text-[10px] text-slate-400 uppercase font-black">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {detailData.sales_items?.map((item: any) => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-3">
                                    <p className="font-bold text-slate-900">{item.products?.name || item.description}</p>
                                    {item.products?.sku && <p className="text-xs text-slate-400">{item.products.sku}</p>}
                                  </td>
                                  <td className="px-4 py-3 text-center font-mono text-slate-700">{item.quantity}</td>
                                  <td className="px-4 py-3 text-right text-slate-600">{formatRupiah(item.unit_price)}</td>
                                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatRupiah(item.quantity * item.unit_price)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Notes */}
                      {detailData.notes && (
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                          <p className="text-[10px] text-amber-600 uppercase font-black mb-1">Catatan dari Pembuat</p>
                          <p className="text-sm text-slate-700">{detailData.notes}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 border-t flex flex-wrap justify-end gap-3 rounded-b-3xl">
              <button onClick={() => setDetailOpen(false)} className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50">Tutup</button>
              <button onClick={() => openConfirm(selectedReq.id, 'REJECTED')} className="px-6 py-2 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl font-bold hover:bg-rose-100 flex items-center gap-2">
                <X size={16} /> Tolak
              </button>
              <button onClick={() => openConfirm(selectedReq.id, 'APPROVED')}
                className="px-6 py-2 bg-[#003366] text-white rounded-xl font-bold hover:bg-[#002d5a] flex items-center gap-2 shadow-lg shadow-[#003366]/10">
                <QrCode size={16} /> Setujui &amp; Tandatangani
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION + NOTES MODAL */}
      {confirmOpen && confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className={`p-6 flex items-center gap-4 ${confirmAction === 'APPROVED' ? 'bg-[#003366]' : 'bg-rose-600'}`}>
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                {confirmAction === 'APPROVED' ? <ShieldCheck size={24} className="text-white" /> : <AlertTriangle size={24} className="text-white" />}
              </div>
              <div>
                <h2 className="text-lg font-black text-white">
                  {confirmAction === 'APPROVED' ? 'Konfirmasi Persetujuan' : 'Konfirmasi Penolakan'}
                </h2>
                <p className="text-sm text-white/80">
                  {confirmAction === 'APPROVED' ? 'QR Tanda Tangan Digital akan diterbitkan.' : 'Dokumen akan dikembalikan ke pembuat.'}
                </p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Catatan / Alasan (Opsional)</label>
                <textarea
                  value={confirmNotes}
                  onChange={e => setConfirmNotes(e.target.value)}
                  placeholder={confirmAction === 'APPROVED' ? 'Cth: Disetujui sesuai anggaran Q1...' : 'Cth: Nilai melebihi batas budget...'}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm outline-none resize-none min-h-[80px] focus:border-blue-300 transition-colors"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 text-sm font-bold rounded-2xl hover:bg-slate-200">Batalkan</button>
                <button onClick={handleConfirmSubmit}
                  className={`flex-1 py-3 text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg ${confirmAction === 'APPROVED' ? 'bg-[#003366] hover:bg-[#002d5a] shadow-[#003366]/10' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'}`}>
                  {confirmAction === 'APPROVED' ? <><QrCode size={16} /> Tanda Tangani &amp; Setujui</> : <><X size={16} /> Tolak Dokumen</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR SIGNATURE MODAL */}
      {signOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
             <div className="bg-emerald-500 p-6 flex flex-col items-center justify-center text-white space-y-3">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                   <ShieldCheck size={32} />
                </div>
                <h2 className="text-xl font-black">Dokumen Disetujui!</h2>
                <p className="text-emerald-50 text-sm text-center">Tanda tangan digital Anda telah disematkan. QR ini adalah bukti verifikasi sah.</p>
             </div>

             <div className="p-8 flex flex-col items-center justify-center space-y-6">
                <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 ring-4 ring-emerald-50">
                    <QRCodeSVG value={signatureData} size={160} level="H" fgColor="#059669" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Verifikasi</p>
                  <p className="text-xs text-slate-500 font-mono break-all px-4">{signatureData}</p>
                </div>
                <button onClick={() => setSignOpen(false)}
                  className="w-full px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 flex items-center justify-center gap-2">
                  <Check size={18} /> Selesai
                </button>
             </div>
          </div>
        </div>
      )}

    </div>
  )
}
