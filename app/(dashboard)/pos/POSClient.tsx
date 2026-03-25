'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Minus, Trash2, ShoppingCart, User, CreditCard, Banknote, QrCode, MonitorSmartphone, Receipt, MapPin, CheckCircle2, MessageCircle, UserPlus, X, Tag } from 'lucide-react'
import { SafeButton } from '@/components/ui/NizamUI'
import { formatRupiah } from '@/lib/utils'
import { processPosTransaction } from '@/modules/sales/actions/pos.actions'

const PROMOS = [
   { code: 'RAMADHAN24', type: 'PERCENT', value: 10, status: 'ACTIVE' },
   { code: 'NEWCUSTOMER', type: 'FIXED', value: 50000, status: 'ACTIVE' },
   { code: 'HARBOLSALE', type: 'PERCENT', value: 15, status: 'EXPIRED' }
]

export default function POSClient({ orgId, products, customers, accounts, currentUser }: any) {
   const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)
   const [loading, setLoading] = useState(false)
   const [successData, setSuccessData] = useState<any>(null)
   
   // Promo States
   const [promoCode, setPromoCode] = useState('')
   const [appliedPromo, setAppliedPromo] = useState<any>(null)

   const handleApplyPromo = (scannedCode?: string) => {
      const code = (typeof scannedCode === 'string' ? scannedCode : promoCode).toUpperCase().trim()
      if (!code) return
      
      // VALIDASI PELANGGAN (Wajib)
      if (!selectedCustomer && (!showAddCustomer || !newCustomerName || !newCustomerPhone || newCustomerPhone.length < 8)) {
         return alert("Peringatan: Kupon Gagal Ditebus! Anda wajib mendaftarkan identitas Pelanggan (serta Nomor WA) yang valid terlebih dahulu.")
      }

      const promo = PROMOS.find(p => p.code === code)
      if (!promo) return alert(`Kode kupon '${code}' tidak ditemukan!`)
      if (promo.status !== 'ACTIVE') return alert(`Maaf, kode kupon '${code}' sudah kadaluarsa/tidak aktif!`)
      
      setAppliedPromo(promo)
      if (typeof scannedCode !== 'string') setPromoCode('')
   }
   const [cart, setCart] = useState<any[]>([])
   const [searchTerm, setSearchTerm] = useState('')
   const [selectedCustomer, setSelectedCustomer] = useState<string>('')
   const [showAddCustomer, setShowAddCustomer] = useState(false)
   const [newCustomerName, setNewCustomerName] = useState('')
   const [newCustomerPhone, setNewCustomerPhone] = useState('')
   const [showPayment, setShowPayment] = useState(false)
   const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'QRIS'>('CASH')
   const [selectedAccount, setSelectedAccount] = useState<string>('')
   const [amountTendered, setAmountTendered] = useState<string>('')
   const [discountAmount, setDiscountAmount] = useState<string>('')
   const [taxPercent, setTaxPercent] = useState<number>(0)

   // ─────────────────────────────────────────────────────────────
   // AUTO-ROUTER: REKENING KASIR DI-SET OTOMATIS BERDASARKAN METODE BAYAR
   // (Nantinya Admin bisa mengubah pemetaan ini di Menu Pengaturan -> Organisasi)
   // ─────────────────────────────────────────────────────────────
   useEffect(() => {
      let target;
      if (paymentMethod === 'CASH') {
         // Prioritaskan nama 'Kas POS'/'Kas Kasir' atau fallback ke Kas awal
         target = accounts.find((a: any) => a.name.toLowerCase().includes('kas pos') || a.name.toLowerCase().includes('kas kasir')) 
               || accounts.find((a: any) => a.code.startsWith('1101') || a.name.toLowerCase().includes('kas'))
      } else {
         // Prioritaskan akun Bank untuk metode Non-Tunai
         target = accounts.find((a: any) => a.name.toLowerCase().includes('bank') || a.code.startsWith('1102'))
      }
      
      if (target) setSelectedAccount(target.id)
      else if (accounts.length > 0) setSelectedAccount(accounts[0].id)
   }, [paymentMethod, accounts])


   // ─────────────────────────────────────────────────────────────
   // SHORTCUT KEYBOARD KASIR PINTAR (Spacebar = Lanjutkan Transaksi)
   // ─────────────────────────────────────────────────────────────
   useEffect(() => {
      const handleGlobalShortcut = (e: KeyboardEvent) => {
         // Jika layar Sukses sedang terbuka, abaikan input lain, cukup tekan Spasi untuk mereset keranjang
         if (successData && e.code === 'Space') {
            e.preventDefault() // Cegah halaman web menggulung (scroll down)
            resetPOS()
         }
      }
      window.addEventListener('keydown', handleGlobalShortcut)
      return () => window.removeEventListener('keydown', handleGlobalShortcut)
   }, [successData])

   // ─────────────────────────────────────────────────────────────
   // INTEGRASI ALAT SCANNER BARCODE (OTOMATIS TANPA KLIK INPUT CARI)
   // ─────────────────────────────────────────────────────────────
   const barcodeBuffer = useRef('')
   const barcodeTimer = useRef<NodeJS.Timeout | null>(null)

   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         const tag = (e.target as HTMLElement).tagName.toLowerCase()
         // Jika layar Sukses sedang muncul atau kursor kasir ada di dalam kotak ketik, abaikan scanner ghaib
         if (tag === 'input' || tag === 'textarea' || tag === 'select' || successData) return

         if (e.key === 'Enter') {
            if (barcodeBuffer.current.length >= 2) {
               const scannedCode = barcodeBuffer.current.trim()
               
               if (showPayment) {
                  // Mode Pembayaran -> Tangkap tembakan Barcode Scanner sebagai Kupon/Voucher Diskon
                  handleApplyPromo(scannedCode)
               } else {
                  // Mode Katalog -> Tangkap tembakan Scanner sebagai SKU Produk (Tambah ke keranjang)
                  const product = products.find((p: any) => 
                     p.sku && p.sku.toLowerCase() === scannedCode.toLowerCase()
                  )
                  if (product) {
                     setCart((prev: any[]) => {
                        const existing = prev.find((item: any) => item.id === product.id)
                        if (existing) return prev.map((item: any) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
                        return [...prev, { id: product.id, name: product.name, price: product.selling_price, qty: 1, sku: product.sku }]
                     })
                  } else {
                     console.warn('Barcode Produk tidak dikenali:', scannedCode)
                  }
               }
            }
            // Reset buffer setelah enter
            barcodeBuffer.current = ''
            if (barcodeTimer.current) clearTimeout(barcodeTimer.current)
            return
         }

         // Hanya tangkap input karakter (bukan Shift/Ctrl dll)
         if (e.key.length === 1) {
            barcodeBuffer.current += e.key
            
            // Scanner fisik mengirim huruf dengan sangat cepat (< 30ms per huruf).
            // Manusia mengetik lebih lambat. Jadi jika jeda lebih dari 80ms, anggap itu manusia, reset buffer!
            if (barcodeTimer.current) clearTimeout(barcodeTimer.current)
            barcodeTimer.current = setTimeout(() => {
               barcodeBuffer.current = ''
            }, 80)
         }
      }

      window.addEventListener('keydown', handleKeyDown)
      return () => {
         window.removeEventListener('keydown', handleKeyDown)
         if (barcodeTimer.current) clearTimeout(barcodeTimer.current)
      }
   }, [products, showPayment, successData, selectedCustomer, showAddCustomer, newCustomerName, newCustomerPhone, promoCode])

   const filteredProducts = useMemo(() => {
      if (!searchTerm) return products
      return products.filter((p: any) => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
   }, [products, searchTerm])

   const cartSubtotal = Math.round(cart.reduce((sum: number, item: any) => sum + (item.price * item.qty), 0))
   
   // Promo Logic Computation
   const manualDiscount = Math.round(Number(discountAmount.replace(/\D/g, '')) || 0)
   const promoDiscount = appliedPromo 
      ? Math.round(appliedPromo.type === 'PERCENT' ? cartSubtotal * (appliedPromo.value / 100) : appliedPromo.value)
      : 0
   const parsedDiscount = manualDiscount + promoDiscount

   const taxNominal = Math.round((cartSubtotal - parsedDiscount) * (taxPercent / 100))
   const grandTotal = Math.round(cartSubtotal - parsedDiscount + taxNominal)
   const changeDue = Math.round(Number(amountTendered.replace(/\D/g, ''))) - grandTotal

   const addToCart = (product: any) => {
      if ((product.stock || 0) <= 0) {
         alert(`Gagal: Stok '${product.name}' sedang kosong. Transaksi tidak dapat dilanjutkan untuk produk ini.`)
         return
      }

      setCart((prev: any[]) => {
         const existing = prev.find((item: any) => item.id === product.id)
         if (existing) {
            if (existing.qty + 1 > (product.stock || 0)) {
               alert(`Peringatan: Stok '${product.name}' tidak mencukupi (Tersedia: ${product.stock}).`)
               return prev
            }
            return prev.map((item: any) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
         }
         return [...prev, { id: product.id, name: product.name, price: product.selling_price, qty: 1, sku: product.sku, stock: product.stock }]
      })
   }

   const updateQty = (id: string, delta: number) => {
      setCart((prev: any[]) => prev.map((item: any) => {
         if (item.id === id) {
            const newQty = Math.max(1, item.qty + delta)
            if (delta > 0 && newQty > (item.stock || 0)) {
               alert(`Stok tidak mencukupi!`)
               return item
            }
            return { ...item, qty: newQty }
         }
         return item
      }))
   }

   const removeLine = (id: string) => setCart((prev: any[]) => prev.filter((item: any) => item.id !== id))

   const handlePay = async () => {
      if (!selectedAccount) { alert('Pilih laci kas/rekening penerima lebih dulu.'); return }
      if (paymentMethod === 'CASH' && Number(amountTendered.replace(/\D/g, '')) < grandTotal) {
         alert('Nominal uang tunai kurang dari total tagihan.')
         return
      }

      setLoading(true)
      const payload = {
         customer_id: selectedCustomer || null,
         new_customer_name: showAddCustomer ? newCustomerName : null,
         new_customer_phone: showAddCustomer ? newCustomerPhone : null,
         account_id: selectedAccount,
         lines: cart.map((c: any) => ({ product_id: c.id, product_name: c.name, quantity: c.qty, unit_price: c.price })),
         discount_amount: parsedDiscount,
         tax_amount: taxNominal,
         notes: `POS - ${paymentMethod}${showAddCustomer ? ` | Pelanggan Baru: ${newCustomerName} (${newCustomerPhone})` : ''}${appliedPromo ? ` | [VOUCHER REDEEMED: ${appliedPromo.code}]` : ''}`
      }

      const res = await processPosTransaction(orgId, payload)
      if (res?.error) alert(res.error)
      else {
         let waPhone = ''
         let waName = 'Pelanggan'
         if (showAddCustomer && newCustomerPhone) {
            waPhone = newCustomerPhone
            waName = newCustomerName
         } else if (selectedCustomer) {
            const cust = customers.find((c: any) => c.id === selectedCustomer)
            if (cust) { waPhone = cust.phone; waName = cust.name }
         }

         setSuccessData({
            total: grandTotal,
            change: changeDue > 0 ? changeDue : 0,
            saleId: res.saleId,
            waPhone: waPhone,
            customerName: waName,
            items: [...cart],
            discount: parsedDiscount,
            tax: taxNominal,
            subtotal: cartSubtotal,
            method: paymentMethod,
            tendered: amountTendered ? Number(amountTendered.replace(/\D/g, '')) : grandTotal
         })
         
         // 1. Auto-Open WhatsApp IF Phone is Provided (Must be synchronous/close to click to avoid pop-up blockers)
         if (waPhone) {
            let p = waPhone
            if (p.startsWith('0')) p = '62' + p.substring(1)
            const template = `Halo Kak ${waName},\n\nTerima kasih telah berbelanja di tempat kami. Total transaksi Anda sebesar *${formatRupiah(grandTotal)}* telah kami terima.\n\nSemoga hari Kakak menyenangkan! 🥳`
            window.open(`https://wa.me/${p}?text=${encodeURIComponent(template)}`, '_blank')
         }

         // 2. Auto Pop-up Print Struk (Delayed slightly so WA opens smoothly first)
         setTimeout(() => window.print(), 800)

         setCart([])
         setAmountTendered('')
         setSelectedCustomer('')
         setDiscountAmount('')
         setShowAddCustomer(false)
         setNewCustomerName('')
         setNewCustomerPhone('')
         setIsMobileCartOpen(false)
      }
      setLoading(false)
   }

   const resetPOS = () => {
      setSuccessData(null)
      setShowPayment(false)
      setAppliedPromo(null)
   }

   const sendWaReceipt = () => {
      let phone = successData.waPhone || ''
      if (!phone) { alert('Nomor WA Pelanggan tidak ada.'); return }
      if (phone.startsWith('0')) phone = '62' + phone.substring(1)

      const message = `Halo Kak ${successData.customerName},\n\nTerima kasih telah berbelanja di tempat kami. Total transaksi Anda sebesar *${formatRupiah(successData.total)}* telah kami terima.\n\nSemoga hari Kakak menyenangkan! 🥳`
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      window.open(url, '_blank')
   }

   return (
      <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col h-screen overflow-hidden">
         {/* Top Bar Navigation (POS Specific) */}
         <div className="h-16 bg-[#003366] text-white flex items-center justify-between px-4 md:px-6 shadow-md shrink-0 z-50 w-full relative">
            <div className="flex items-center gap-3 md:gap-4">
               <div className="w-8 h-8 md:w-10 md:h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                  <MonitorSmartphone size={18} className="text-white md:hidden" />
                  <MonitorSmartphone size={20} className="text-white hidden md:block" />
               </div>
               <div>
                  <h1 className="text-sm md:text-lg font-black tracking-tight leading-none">Nizam POS</h1>
                  <div className="text-[8px] md:text-[10px] font-bold text-white/70 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                     <MapPin size={8} className="md:w-[10px]" /> Cabang Utama
                  </div>
               </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
               <div className="px-3 py-1.5 bg-white/10 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold border border-white/10 flex items-center gap-2">
                  <User size={12} className="md:w-[14px]" /> <span className="hidden sm:inline">{currentUser?.email?.split('@')[0]}</span>
               </div>
               <a href="/dashboard" className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg md:rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-colors shadow-sm cursor-pointer block">
                  <span className="md:hidden">EXIT</span>
                  <span className="hidden md:inline">Tutup POS</span>
               </a>
            </div>
         </div>

         {/* Main Grid: Left (Products) | Right (Cart) */}
         <div className="flex-1 flex overflow-hidden relative">
            {/* Left: Products catalog */}
            <div className="flex-1 flex flex-col bg-white">
               {/* Search Area */}
               <div className="p-4 md:p-6 border-b border-slate-100 flex gap-4 shrink-0">
                  <div className="relative flex-1">
                     <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                     <input
                        type="text"
                        placeholder="Cari Produk..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full h-12 md:h-14 pl-12 pr-6 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 placeholder-slate-400 focus:border-blue-500 outline-none transition-all text-sm md:text-lg"
                        autoFocus
                     />
                  </div>
               </div>

               {/* Product Grid Layout */}
               <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50 pb-32 md:pb-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 auto-rows-max overflow-visible">
                     {filteredProducts.map((p: any) => (
                        <button
                           key={p.id}
                           onClick={() => addToCart(p)}
                           className="bg-white p-3 md:p-4 rounded-3xl border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-xl hover:-translate-y-1 transition-all text-left group flex flex-col min-h-[140px] md:h-44 relative z-0"
                        >
                           <div className="text-[8px] md:text-[10px] font-black text-blue-500 bg-blue-50 w-fit px-2 py-1 rounded-md mb-2">{p.sku}</div>
                           <h3 className="font-bold text-xs md:text-sm text-slate-800 leading-tight flex-1 line-clamp-3">{p.name}</h3>
                           <div className="text-sm md:text-lg font-black text-[#003366] mt-2 group-hover:scale-105 origin-left transition-transform">
                              {formatRupiah(p.selling_price)}
                           </div>
                           <div className={`mt-2 text-[9px] font-bold px-2 py-0.5 rounded-md w-fit ${p.stock <= 5 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
                              Stok: {p.stock || 0}
                           </div>
                        </button>
                     ))}
                  </div>
               </div>
            </div>

            {/* Right: Shopping Cart (Overlay on Mobile, Sidebar on Desktop) */}
            <div className={`
            fixed inset-0 z-[60] md:relative md:inset-auto md:z-20 md:flex
            ${isMobileCartOpen ? 'flex' : 'hidden'}
          `}>
               <div className="md:hidden absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileCartOpen(false)} />

               <div className="ml-auto w-[85%] sm:w-[450px] md:w-[400px] lg:w-[450px] bg-white border-l border-slate-200 shadow-2xl flex flex-col relative animate-in slide-in-from-right duration-300">
                  {/* Mobile Cart Header */}
                  <div className="md:hidden p-5 flex items-center justify-between bg-[#003366] text-white">
                     <h2 className="font-black uppercase tracking-widest text-sm">Pesanan Saya</h2>
                     <button onClick={() => setIsMobileCartOpen(false)} className="p-2 bg-white/10 rounded-lg"><X size={18} /></button>
                  </div>

                  {/* Customer Selection */}
                  <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50">
                     <div className="flex justify-between items-center mb-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Database Pelanggan</label>
                        <button 
                           onClick={() => setShowAddCustomer(!showAddCustomer)} 
                           className={`px-3 py-1.5 rounded-full border-2 text-[11px] font-black flex items-center gap-1.5 transition-all shadow-sm ${
                              showAddCustomer 
                              ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100' 
                              : 'border-[#003366] bg-white text-[#003366] hover:bg-blue-50'
                           }`}
                        >
                           {showAddCustomer ? <><X size={12} strokeWidth={3} /> Batal</> : <><UserPlus size={12} strokeWidth={3} /> Baru</>}
                        </button>
                     </div>

                     <AnimatePresence mode="popLayout">
                        {showAddCustomer ? (
                           <motion.div key="new-customer-fields" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                              <input placeholder="Nama Pelanggan" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} className="w-full h-10 px-3 border rounded-xl text-sm font-bold outline-none" />
                              <input placeholder="WhatsApp (08...)" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} className="w-full h-10 px-3 border rounded-xl text-sm font-bold outline-none" />
                           </motion.div>
                        ) : (
                           <motion.div key="existing-customer-select" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="relative">
                              <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" />
                              <select
                                 value={selectedCustomer}
                                 onChange={e => setSelectedCustomer(e.target.value)}
                                 className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none appearance-none"
                              >
                                 <option value="">Pelanggan Walk-id</option>
                                 {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </div>

                  {/* Cart Items List */}
                  <div className="flex-1 overflow-y-auto w-full p-3 space-y-2 bg-white">
                     <AnimatePresence>
                        {cart.map(item => (
                           <motion.div
                              key={item.id}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              className="p-3 bg-white border border-slate-100 rounded-2xl flex items-center gap-3 shadow-sm"
                           >
                              <div className="flex-1 min-w-0">
                                 <div className="font-bold text-slate-800 text-xs truncate leading-tight">{item.name}</div>
                                 <div className="text-[10px] font-black text-blue-600 mt-1">{formatRupiah(item.price)}</div>
                              </div>

                              <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl p-1 border border-slate-100">
                                 <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm"><Minus size={12} /></button>
                                 <span className="w-5 text-center font-black text-xs">{item.qty}</span>
                                 <button onClick={() => updateQty(item.id, +1)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-100 text-blue-600 shadow-sm"><Plus size={12} /></button>
                              </div>

                              <button onClick={() => removeLine(item.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-rose-300 hover:bg-rose-50 hover:text-rose-500">
                                 <Trash2 size={14} />
                              </button>
                           </motion.div>
                        ))}
                     </AnimatePresence>

                     {cart.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 py-12">
                           <ShoppingCart size={40} className="mb-4 text-slate-200" />
                           <span className="text-[10px] font-black uppercase tracking-widest">Kosong</span>
                        </div>
                     )}
                  </div>

                  {/* Cart Totals & Checkout Button */}
                  <div className="bg-slate-900 text-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:rounded-t-[32px] overflow-hidden">
                     <div className="p-4 md:p-6 pb-2 border-b border-white/10 flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[10px]">
                           <span className="font-black uppercase tracking-widest text-slate-400">Subtotal</span>
                           <span className="font-bold">{formatRupiah(cartSubtotal)}</span>
                        </div>
                        {appliedPromo && (
                           <div className="flex justify-between items-center text-[10px] text-blue-400">
                              <span className="font-black uppercase tracking-widest flex items-center gap-1">
                                 Kupon <Tag size={10}/> {appliedPromo.code}
                                 <button onClick={() => setAppliedPromo(null)} className="ml-1 text-rose-400 hover:text-rose-300"><X size={12}/></button>
                              </span>
                              <span className="font-bold">-{formatRupiah(promoDiscount)}</span>
                           </div>
                        )}
                        <div className="flex justify-between items-center text-[10px] text-emerald-400">
                           <span className="font-black uppercase tracking-widest">Diskon Manual</span>
                           <input
                              className="w-24 h-7 bg-white/10 border border-white/10 rounded-lg text-right px-2 font-bold outline-none focus:bg-white/20"
                              value={discountAmount}
                              onChange={e => {
                                 const val = e.target.value.replace(/\D/g, '')
                                 setDiscountAmount(val ? new Intl.NumberFormat('id-ID').format(Number(val)) : '')
                              }}
                           />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-rose-400">
                           <span className="font-black uppercase tracking-widest text-rose-400">Pajak</span>
                           <select
                              className="w-24 h-7 bg-white/10 border border-white/10 rounded-lg text-right px-1 font-bold outline-none appearance-none"
                              value={taxPercent}
                              onChange={e => setTaxPercent(Number(e.target.value))}
                           >
                              <option value={0} className="text-black">0%</option>
                              <option value={11} className="text-black">11%</option>
                              <option value={12} className="text-black">12%</option>
                           </select>
                        </div>
                        
                        {/* INPUT PROMO BARU (DENGAN QR ICON) */}
                        {!appliedPromo && (
                           <div className="flex gap-2 mt-1">
                              <div className="relative flex-1">
                                 <QrCode size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                                 <input 
                                    placeholder="Scan QR / Ketik Kode..." 
                                    value={promoCode}
                                    onChange={e => setPromoCode(e.target.value)}
                                    style={{ textTransform: 'uppercase' }}
                                    onKeyDown={e => e.key === 'Enter' && handleApplyPromo()}
                                    className="w-full h-8 pl-7 pr-3 bg-black/20 border border-white/10 rounded-lg text-[10px] font-bold text-white placeholder-slate-500 outline-none focus:border-blue-500 shadow-inner" 
                                 />
                              </div>
                              <button onClick={() => handleApplyPromo()} className="h-8 px-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-black text-[10px] tracking-widest uppercase transition-colors">CEK</button>
                           </div>
                        )}
                     </div>

                     <div className="p-4 md:p-6 pt-3">
                        <div className="flex justify-between items-center mb-4">
                           <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grand Total</div>
                           <div className="text-xl md:text-2xl font-black text-emerald-400">{formatRupiah(grandTotal)}</div>
                        </div>

                        <button
                           disabled={cart.length === 0}
                           onClick={() => setShowPayment(true)}
                           className="w-full h-14 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl md:rounded-2xl font-black text-xs md:text-base tracking-widest uppercase transition-colors flex items-center justify-center gap-3 shadow-lg"
                        >
                           <CreditCard size={20} /> CHECKOUT
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Mobile Bottom Bar (Always Visible on Catalog) */}
         <div className={`md:hidden fixed bottom-6 left-4 right-4 z-40 ${isMobileCartOpen || showPayment ? 'hidden' : 'block'}`}>
            <button
               onClick={() => setIsMobileCartOpen(true)}
               className="w-full h-16 bg-[#003366] text-white rounded-[28px] shadow-2xl flex items-center justify-between px-6 border border-white/10 relative overflow-hidden group"
            >
               <div className="absolute inset-0 bg-blue-500/20 translate-y-full group-active:translate-y-0 transition-transform" />
               <div className="flex items-center gap-3 relative z-10">
                  <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
                     <div className="relative">
                        <ShoppingCart size={20} />
                        {cart.length > 0 && (
                           <span className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center scale-90 md:scale-100">
                              {cart.reduce((a, c) => a + c.qty, 0)}
                           </span>
                        )}
                     </div>
                  </div>
                  <div className="text-left">
                     <div className="text-[10px] font-black text-white/50 uppercase tracking-widest leading-none mb-1">Items in Cart</div>
                     <div className="text-xs font-black uppercase tracking-tighter">Lihat Detail Pesanan</div>
                  </div>
               </div>
               <div className="text-right relative z-10">
                  <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-0.5 opacity-70 italic">Total Tagihan</div>
                  <div className="text-lg font-black text-emerald-400 leading-none">{formatRupiah(grandTotal)}</div>
               </div>
            </button>
         </div>

         {/* Payment Modal Overlay (Mobile: Full Screen, Desktop: Center Modal) */}
         <AnimatePresence mode="wait">
            {showPayment && (
               <div className="fixed inset-0 z-[200] flex items-center justify-center md:p-6 bg-slate-900/80 backdrop-blur-md">
                  <motion.div
                     initial={{ opacity: 0, y: 100 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 100 }}
                     className="relative w-full h-full md:h-auto md:max-w-4xl bg-white md:rounded-[40px] shadow-2xl flex flex-col md:flex-row overflow-hidden"
                  >
                     {/* Summary Side */}
                     <div className="w-full md:w-[45%] bg-[#003366] text-white p-6 md:p-10 flex flex-col justify-between relative">
                        <div className="relative z-10">
                           <div className="flex justify-between items-center md:block mb-8 md:mb-0">
                              <div className="w-12 h-12 md:w-16 md:h-16 bg-white/10 rounded-[18px] md:rounded-3xl flex items-center justify-center border border-white/20 backdrop-blur-sm">
                                 <Receipt size={24} className="text-white md:hidden" />
                                 <Receipt size={32} className="text-white hidden md:block" />
                              </div>
                              <button onClick={() => setShowPayment(false)} className="md:hidden p-2 bg-white/10 rounded-lg"><X size={18} /></button>
                           </div>
                           <h2 className="text-2xl md:text-3xl font-black mb-1 md:mb-2 tracking-tight">Pembayaran</h2>
                           <p className="text-white/60 font-bold text-xs md:text-sm mb-6 md:mb-12">Total {cart.reduce((a, c) => a + c.qty, 0)} Items Terpilih.</p>

                           <div className="space-y-3 md:space-y-4">
                              <div className="flex justify-between items-center py-1.5 md:py-2 border-b border-white/10 text-[10px] md:text-base">
                                 <span className="font-bold text-white/50 uppercase md:normal-case tracking-widest md:tracking-normal">Subtotal</span>
                                 <span className="font-black md:text-lg">{formatRupiah(cartSubtotal)}</span>
                              </div>
                              {(parsedDiscount > 0 || taxPercent > 0) && (
                                 <div className="flex justify-between items-center py-1.5 md:py-2 border-b border-white/10 text-[10px] md:text-base text-white/70 italic">
                                    <span>Adjustments (Disc/Tax)</span>
                                    <span className="font-black">{formatRupiah(taxNominal - parsedDiscount)}</span>
                                 </div>
                              )}
                              <div className="flex justify-between items-center pt-4 md:pt-6">
                                 <span className="font-black text-white uppercase tracking-widest text-[10px] md:text-xs">TOTAL AKHIR</span>
                                 <span className="font-black text-2xl md:text-4xl text-emerald-400">{formatRupiah(grandTotal)}</span>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Form Side */}
                     <div className="flex-1 bg-slate-50 p-6 md:p-10 overflow-y-auto">
                        {successData ? (
                           <div className="h-full flex flex-col items-center justify-center text-center py-10 md:py-0">
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }} transition={{ type: 'spring' }} className="w-20 h-20 md:w-24 md:h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                                 <CheckCircle2 size={40} className="md:w-[48px]" />
                              </motion.div>
                              <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-2 italic">TRANSAKSI SUKSES</h2>
                              <p className="text-slate-500 font-bold text-xs md:text-sm mb-8 max-w-xs mx-auto">Saldo inventory otomatis terpotong & jurnal tercatat.</p>

                              <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full mb-8 shadow-sm max-w-sm">
                                 <div className="flex justify-between items-center mb-4 text-[10px] md:text-xs">
                                    <span className="uppercase font-black text-slate-400 tracking-widest">Total Bayar</span>
                                    <span className="font-black text-slate-800">{formatRupiah(successData.total)}</span>
                                 </div>
                                 <div className="flex justify-between items-center pt-4 border-t border-dashed border-slate-200">
                                    <span className="text-[10px] md:text-xs uppercase font-black text-blue-500 tracking-widest italic">KEMBALIAN</span>
                                    <span className="font-black text-xl md:text-2xl text-blue-600">{formatRupiah(successData.change)}</span>
                                 </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-3">
                                 <button onClick={() => window.print()} className="py-4 bg-white border border-slate-200 text-slate-600 font-black tracking-widest uppercase text-[10px] rounded-2xl hover:bg-slate-100 shadow-sm w-full">Struk Fisik</button>
                                 <button onClick={sendWaReceipt} className="py-4 bg-emerald-50 border border-emerald-200 text-emerald-600 font-black tracking-widest uppercase text-[10px] rounded-2xl hover:bg-emerald-100 shadow-sm w-full flex items-center justify-center gap-1.5"><MessageCircle size={14} /> WhatsApp</button>
                              </div>
                              <button onClick={resetPOS} className="w-full max-w-sm py-5 bg-blue-600 text-white font-black tracking-widest uppercase text-xs rounded-2xl hover:bg-blue-500 shadow-lg shadow-blue-500/20 mt-2">PESANAN BERIKUTNYA</button>
                           </div>
                        ) : (
                           <div className="flex flex-col h-full">
                              <div className="hidden md:flex justify-between items-center mb-4">
                                 <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Penyelesaian Transaksi</h3>
                                 <button onClick={() => setShowPayment(false)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg"><X size={18} /></button>
                              </div>

                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Metode Pembayaran</label>
                              <div className="grid grid-cols-3 gap-2 md:gap-3 mb-8">
                                 <button onClick={() => setPaymentMethod('CASH')} className={`p-3 md:p-4 rounded-xl md:rounded-2xl border-2 flex flex-col items-center gap-2 md:gap-3 transition-all ${paymentMethod === 'CASH' ? 'border-[#003366] bg-blue-50 text-[#003366]' : 'border-slate-100 bg-white text-slate-300'}`}>
                                    <Banknote size={20} className="md:w-[24px]" />
                                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">Tunai</span>
                                 </button>
                                 <button onClick={() => setPaymentMethod('QRIS')} className={`p-3 md:p-4 rounded-xl md:rounded-2xl border-2 flex flex-col items-center gap-2 md:gap-3 transition-all ${paymentMethod === 'QRIS' ? 'border-[#003366] bg-blue-50 text-[#003366]' : 'border-slate-100 bg-white text-slate-300'}`}>
                                    <QrCode size={20} className="md:w-[24px]" />
                                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">QRIS / EDC</span>
                                 </button>
                                 <button onClick={() => setPaymentMethod('TRANSFER')} className={`p-3 md:p-4 rounded-xl md:rounded-2xl border-2 flex flex-col items-center gap-2 md:gap-3 transition-all ${paymentMethod === 'TRANSFER' ? 'border-[#003366] bg-blue-50 text-[#003366]' : 'border-slate-100 bg-white text-slate-300'}`}>
                                    <CreditCard size={20} className="md:w-[24px]" />
                                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">Transfer</span>
                                 </button>
                              </div>

                              <div className="space-y-6 flex-1">
                                 <div className="space-y-1.5 opacity-80 pointer-events-none mb-6">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-emerald-700 ml-1 flex items-center gap-1.5">
                                       <CheckCircle2 size={12} /> Auto-Routed ke Rekening POS
                                    </label>
                                    <div className="w-full h-12 md:h-14 px-4 bg-slate-100/80 border border-slate-200/60 rounded-xl font-bold text-xs md:text-sm text-slate-500 flex items-center shadow-inner italic">
                                       {accounts.find((a: any) => a.id === selectedAccount)?.name || 'Sinkronisasi konfigurasi pusat...'}
                                    </div>
                                 </div>

                                 {paymentMethod === 'CASH' && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                       <div className="space-y-2">
                                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nominal Tunai Diterima</label>
                                          <div className="relative">
                                             <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xs md:text-sm">Rp</span>
                                             <input
                                                type="text"
                                                value={amountTendered}
                                                onChange={e => {
                                                   const val = e.target.value.replace(/\D/g, '')
                                                   setAmountTendered(val ? new Intl.NumberFormat('id-ID').format(Number(val)) : '')
                                                }}
                                                className="w-full h-14 md:h-16 pl-10 md:pl-12 pr-6 bg-white border border-slate-200 rounded-xl font-black text-lg md:text-2xl text-slate-800 outline-none focus:border-[#003366] transition-all shadow-sm"
                                                placeholder="0"
                                             />
                                          </div>
                                       </div>

                                       <div className="flex flex-wrap gap-2">
                                          {[grandTotal, 20000, 50000, 100000, 200000, 500000]
                                             .filter((n, i) => i === 0 || n > grandTotal)
                                             .slice(0, 4)
                                             .map((nom, idx) => (
                                             <button 
                                                key={idx}
                                                type="button"
                                                onClick={() => setAmountTendered(new Intl.NumberFormat('id-ID').format(nom))}
                                                className={`px-3 py-2 md:py-2.5 border font-bold text-[10px] md:text-xs rounded-lg transition-all active:scale-95 ${
                                                   idx === 0 
                                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800'
                                                }`}
                                             >
                                                {idx === 0 ? 'Uang Pas' : formatRupiah(nom)}
                                             </button>
                                          ))}
                                       </div>

                                       {changeDue > 0 && amountTendered && (
                                          <div className="p-3 md:p-4 mt-2 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-between animate-in fade-in">
                                             <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-orange-600/70">Kembalian</span>
                                             <span className="text-sm md:text-lg font-black text-orange-600">{formatRupiah(changeDue)}</span>
                                          </div>
                                       )}
                                    </div>
                                 )}
                              </div>

                              <div className="pt-6 mt-auto">
                                 <button disabled={loading} onClick={handlePay} className="w-full h-16 md:h-[72px] bg-[#003366] hover:bg-[#002244] text-white flex flex-col items-center justify-center gap-1 rounded-2xl md:rounded-[20px] shadow-xl transition-all font-black text-[11px] md:text-xs tracking-widest disabled:opacity-50">
                                    {loading ? (
                                       <span className="animate-spin border-2 border-white/20 border-t-white rounded-full w-5 h-5 mb-0.5" />
                                    ) : (
                                       <CheckCircle2 size={24} className="opacity-90" />
                                    )}
                                    {loading ? 'MEMPROSES TRANSAKSI...' : 'PROSES SEKARANG'}
                                 </button>
                              </div>
                           </div>
                        )}
                     </div>
                  </motion.div>
               </div>
            )}
         </AnimatePresence>

         {/* DEDICATED THERMAL PRINT TEMPLATE (Hidden from UI, active only on Print) */}
         {successData && (
               <div id="thermal-print-area" className="hidden print:block w-[58mm] bg-white text-black font-mono text-[10px] leading-snug mx-auto p-0">
                  <style>{`
                     @media print {
                        body * { visibility: hidden !important; }
                        #thermal-print-area, #thermal-print-area * { visibility: visible !important; color: black !important; }
                        #thermal-print-area { position: absolute; left: 0; top: 0; width: 58mm; padding: 2mm; margin: 0; border: none; }
                        @page { margin: 0; size: 58mm auto; }
                     }
                  `}</style>
                  <div className="text-center mb-3">
                     <h2 className="font-bold text-sm">NIZAM CABANG UTAMA</h2>
                     <p>Pusat Penjualan Retil</p>
                  </div>
                  <div className="border-b border-dashed border-black mb-2" />
                  <div className="flex justify-between mb-1">
                     <span>No: {successData.saleId.split('-')[0].toUpperCase()}</span>
                     <span>{new Date().toLocaleDateString('id-ID')}</span>
                  </div>
                  <div className="mb-2">
                     <span>Pelanggan: {successData.customerName || 'Umum (Walk-In)'}</span>
                  </div>
                  <div className="border-b border-dashed border-black mb-2" />
                  <table className="w-full mb-2">
                     <tbody>
                        {successData.items?.map((item: any, idx: number) => (
                           <tr key={idx} className="align-top">
                              <td className="w-full pb-1 pr-2">
                                 {item.name} <br/>
                                 {item.qty} x {formatRupiah(item.price)}
                              </td>
                              <td className="text-right pb-1">{formatRupiah(item.price * item.qty)}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
                  <div className="border-b border-dashed border-black mb-2" />
                  
                  {successData.subtotal !== successData.total && (
                     <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{formatRupiah(successData.subtotal)}</span>
                     </div>
                  )}
                  {successData.discount > 0 && (
                     <div className="flex justify-between">
                        <span>Diskon</span>
                        <span>-{formatRupiah(successData.discount)}</span>
                     </div>
                  )}
                  {successData.tax > 0 && (
                     <div className="flex justify-between">
                        <span>Pajak Tambahan</span>
                        <span>+{formatRupiah(successData.tax)}</span>
                     </div>
                  )}
                  
                  <div className="flex justify-between text-[11px] mt-1">
                     <span>Total ({successData.items?.reduce((a: number, c: any) => a + c.qty, 0) || 0} Item)</span>
                     <span className="font-bold">{formatRupiah(successData.total)}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                     <span>Dibayar ({successData.method})</span>
                     <span>{formatRupiah(successData.tendered)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                     <span>Kembali</span>
                     <span>{formatRupiah(successData.change)}</span>
                  </div>
                  <div className="border-b border-dashed border-black mb-2" />
                  <div className="text-center mt-3 text-[9px]">
                     <p>Terima Kasih atas kunjungan Anda!</p>
                     <p className="mt-1 font-bold">Powered by NIZAM ERP</p>
                  </div>
               </div>
            )}
      </div>
   )
}
