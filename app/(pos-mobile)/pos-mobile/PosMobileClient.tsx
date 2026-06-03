'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Search, Package, MapPin, Truck, ChevronLeft, CheckCircle2, User, CreditCard, X, Receipt } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getContacts } from '@/modules/contacts/actions/contact.actions';
import { getCustomerOutstandingAR, processArCollection } from '@/modules/sales/actions/pos-mobile-ar.actions';
import { useRouter } from 'next/navigation';

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  isTradeIn?: boolean;
};

const mockProducts: Product[] = [
  { id: '1', name: 'Air Galon Tirta', price: 15000, stock: 50 },
  { id: '2', name: 'Air Botol 600ml (Dus)', price: 45000, stock: 20 },
  { id: '3', name: 'Air Gelas 220ml (Dus)', price: 30000, stock: 35 },
  { id: '4', name: 'Trade-in Galon Kosong', price: -10000, stock: 999, isTradeIn: true },
];

export function PosMobileClient({ orgId, branchId, userEmail, userName }: any) {
  const router = useRouter();
  
  // Phase 1: Customer Selection
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  
  // Phase 2: Modes
  const [activeTab, setActiveTab] = useState<'SALES' | 'AR'>('SALES');
  
  // Sales State
  const [cart, setCart] = useState<{ product: Product; qty: number }[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [salesSuccess, setSalesSuccess] = useState(false);
  
  // AR State
  const [arList, setArList] = useState<any[]>([]);
  const [isLoadingAr, setIsLoadingAr] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [arSuccess, setArSuccess] = useState(false);

  useEffect(() => {
    async function loadCustomers() {
      try {
        const data = await getContacts(orgId, 'CUSTOMER');
        setCustomers(data || []);
      } catch (err) {
        console.error('Failed to load customers', err);
      }
    }
    loadCustomers();
  }, [orgId]);

  useEffect(() => {
    if (selectedCustomer && activeTab === 'AR') {
      loadAr();
    }
  }, [selectedCustomer, activeTab]);

  async function loadAr() {
    setIsLoadingAr(true);
    try {
      const data = await getCustomerOutstandingAR(orgId, selectedCustomer.id);
      setArList(data || []);
    } catch (err) {
      console.error('Failed to load AR', err);
    } finally {
      setIsLoadingAr(false);
    }
  }

  // ==== Sales Logic ====
  const handleAddToCart = (product: Product, qty: number) => {
    setCart((prev) => {
      const existing = prev.find(p => p.product.id === product.id);
      if (existing) {
        const newQty = existing.qty + qty;
        if (newQty <= 0) return prev.filter(p => p.product.id !== product.id);
        return prev.map(p => p.product.id === product.id ? { ...p, qty: newQty } : p);
      }
      if (qty > 0) return [...prev, { product, qty }];
      return prev;
    });
  };

  const total = cart.reduce((acc, item) => acc + (item.product.price * item.qty), 0);
  const totalItems = cart.reduce((acc, item) => acc + item.qty, 0);

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    setTimeout(() => {
      setIsCheckingOut(false);
      setSalesSuccess(true);
      setCart([]);
    }, 1500);
  };

  // ==== AR Logic ====
  const handlePayAr = async () => {
    if (!selectedInvoice || !paymentAmount) return;
    const amount = parseInt(paymentAmount.replace(/\D/g, ''), 10);
    if (isNaN(amount) || amount <= 0) return;

    setIsProcessingPayment(true);
    const res = await processArCollection(orgId, {
      customerId: selectedCustomer.id,
      saleId: selectedInvoice.id,
      amount: amount,
      paymentMethod: 'CASH', // Canvaser only cash right now
    });
    setIsProcessingPayment(false);

    if (res?.success) {
      setArSuccess(true);
      setSelectedInvoice(null);
      setPaymentAmount('');
      loadAr(); // refresh
    } else {
      alert(res?.error || 'Gagal memproses pembayaran');
    }
  };

  const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  // ---- RENDER: SUCCESS SCREEN (SALES) ----
  if (salesSuccess) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-white h-[100dvh]">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <CheckCircle2 className="w-24 h-24 text-green-500 mx-auto mb-4" />
        </motion.div>
        <h2 className="text-2xl font-bold text-[#1E293B] mb-2">Transaksi Berhasil!</h2>
        <p className="text-slate-500 mb-8">Penjualan tercatat untuk {selectedCustomer?.name}</p>
        <button 
          onClick={() => setSalesSuccess(false)}
          className="w-full max-w-xs bg-[#2563EB] text-white py-4 rounded-xl font-semibold text-lg active:scale-95 transition-transform"
        >
          Selesai
        </button>
      </div>
    );
  }

  // ---- RENDER: SUCCESS SCREEN (AR) ----
  if (arSuccess) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-white h-[100dvh]">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <CheckCircle2 className="w-24 h-24 text-green-500 mx-auto mb-4" />
        </motion.div>
        <h2 className="text-2xl font-bold text-[#1E293B] mb-2">Pembayaran Diterima!</h2>
        <p className="text-slate-500 mb-8">Penerimaan tagihan berhasil masuk ke setoran sementara.</p>
        <button 
          onClick={() => setArSuccess(false)}
          className="w-full max-w-xs bg-[#2563EB] text-white py-4 rounded-xl font-semibold text-lg active:scale-95 transition-transform"
        >
          Kembali
        </button>
      </div>
    );
  }

  // ---- RENDER: CUSTOMER SELECTION ----
  if (!selectedCustomer) {
    const filteredCustomers = customers.filter(c => c.name?.toLowerCase().includes(searchCustomer.toLowerCase()));
    return (
      <div className="flex flex-col h-[100dvh] bg-[#F8FAFC]">
        <header className="bg-[#2563EB] text-white shadow-sm px-4 py-5 flex items-center justify-between shrink-0">
          <div>
            <h1 className="font-bold text-lg leading-tight">Mulai Kunjungan</h1>
            <p className="text-sm opacity-80">Pilih toko/pelanggan</p>
          </div>
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Truck className="w-5 h-5 text-white" />
          </div>
        </header>

        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Cari nama toko..." 
              value={searchCustomer}
              onChange={e => setSearchCustomer(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredCustomers.length === 0 ? (
            <p className="text-center text-slate-500 mt-10">Data tidak ditemukan.</p>
          ) : (
            filteredCustomers.map(c => (
              <div 
                key={c.id} 
                onClick={() => setSelectedCustomer(c)}
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 active:scale-[0.98] transition-transform cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-slate-400" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <h3 className="font-semibold text-slate-900 truncate">{c.name}</h3>
                  <p className="text-sm text-slate-500 truncate">{c.address || 'Tidak ada alamat'}</p>
                </div>
                <ChevronRightIcon className="w-5 h-5 text-slate-300" />
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ---- RENDER: MAIN DASHBOARD ----
  return (
    <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex flex-col gap-3 z-10 shrink-0 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button onClick={() => { setSelectedCustomer(null); setCart([]); }} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-[#1E293B] text-lg leading-tight truncate">{selectedCustomer.name}</h1>
            <p className="text-xs text-slate-500 truncate">{selectedCustomer.address || 'Toko'}</p>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('SALES')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'SALES' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Jual Barang
          </button>
          <button 
            onClick={() => setActiveTab('AR')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'AR' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Tagih Piutang (AR)
          </button>
        </div>
      </header>

      {/* Main Content (Scrollable) */}
      <main className="flex-1 overflow-y-auto p-4 pb-32">
        
        {activeTab === 'SALES' ? (
          <div className="space-y-4">
            {mockProducts.map((product) => {
              const cartItem = cart.find(c => c.product.id === product.id);
              const qty = cartItem ? cartItem.qty : 0;
              return (
                <div key={product.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className={`font-semibold ${product.isTradeIn ? 'text-amber-600' : 'text-[#1E293B]'}`}>{product.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-bold text-[#2563EB]">
                        {product.price < 0 ? '-' : ''}Rp {Math.abs(product.price).toLocaleString('id-ID')}
                      </span>
                      {!product.isTradeIn && (
                        <span className="text-xs text-slate-400">Stok: {product.stock}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-1">
                    <button 
                      onClick={() => handleAddToCart(product, -1)}
                      disabled={qty === 0}
                      className="w-8 h-8 rounded-md flex items-center justify-center bg-white text-slate-600 shadow-sm disabled:opacity-50 active:scale-95 transition-transform"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-6 text-center font-semibold text-[#1E293B]">{qty}</span>
                    <button 
                      onClick={() => handleAddToCart(product, 1)}
                      className="w-8 h-8 rounded-md flex items-center justify-center bg-[#2563EB] text-white shadow-sm active:scale-95 transition-transform"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {isLoadingAr ? (
              <p className="text-center text-slate-500 py-10">Memuat tagihan...</p>
            ) : arList.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="font-bold text-slate-900">Tidak ada tagihan</h3>
                <p className="text-sm text-slate-500 mt-1">Pelanggan ini tidak memiliki piutang yang harus ditagih.</p>
              </div>
            ) : (
              arList.map(ar => (
                <div key={ar.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-900">{ar.sale_number}</h3>
                      <p className="text-xs text-slate-500">Jatuh Tempo: {ar.due_date ? new Date(ar.due_date).toLocaleDateString('id-ID') : '-'}</p>
                    </div>
                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded">Belum Lunas</span>
                  </div>
                  <div className="flex justify-between items-end mt-2">
                    <div>
                      <p className="text-xs text-slate-500">Sisa Tagihan:</p>
                      <p className="font-bold text-rose-600 text-lg">{formatRupiah(ar.outstanding_amount)}</p>
                    </div>
                    <button 
                      onClick={() => { setSelectedInvoice(ar); setPaymentAmount(ar.outstanding_amount.toString()); }}
                      className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold active:scale-95 transition-transform"
                    >
                      Terima Uang
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Checkout Bar (SALES) */}
      <AnimatePresence>
        {activeTab === 'SALES' && cart.length > 0 && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 pb-safe z-20 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-500 font-medium">Total ({totalItems} item)</span>
              <span className="text-2xl font-bold text-[#1E293B]">{formatRupiah(total)}</span>
            </div>
            <button 
              onClick={handleCheckout}
              disabled={isCheckingOut || total < 0}
              className="w-full bg-[#F97316] text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-[#F97316]/30 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
            >
              {isCheckingOut ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                  <Package className="w-6 h-6" />
                </motion.div>
              ) : (
                'Bayar Sekarang'
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Payment (AR) */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-slate-900/40 backdrop-blur-sm p-4 pb-0">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-lg text-slate-900">Terima Pembayaran</h3>
                <button onClick={() => setSelectedInvoice(null)} className="p-2 bg-slate-100 rounded-full text-slate-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <div className="bg-slate-50 p-4 rounded-xl mb-6">
                  <p className="text-sm text-slate-500 mb-1">Faktur: {selectedInvoice.sale_number}</p>
                  <p className="text-xs text-slate-500 mb-2">Sisa Tagihan:</p>
                  <p className="text-2xl font-bold text-slate-900">{formatRupiah(selectedInvoice.outstanding_amount)}</p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Uang yang diterima (Tunai)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">Rp</span>
                    <input 
                      type="text" 
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-300 font-bold text-xl text-slate-900 focus:ring-2 focus:ring-[#2563EB] outline-none"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">*Masukkan nominal pelunasan atau cicilan.</p>
                </div>

                <button 
                  onClick={handlePayAr}
                  disabled={isProcessingPayment || !paymentAmount}
                  className="w-full bg-[#2563EB] text-white py-4 rounded-xl font-bold text-lg active:scale-95 transition-transform flex justify-center"
                >
                  {isProcessingPayment ? 'Memproses...' : 'Konfirmasi Setoran'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChevronRightIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}
