'use client';
import React from 'react';
import { Truck, MapPin, DollarSign, Package, Smartphone } from 'lucide-react';
import Link from 'next/link';

export function CoSalesDashboardClient({ orgId, branchId }: any) {
  // Mock data for canvassing vans
  const mockVans = [
    { id: '1', name: 'Van 1 - Budi (Selatan)', sales: 1500000, gallons: 45, empties: 15, bottles: 20 },
    { id: '2', name: 'Van 2 - Andi (Utara)', sales: 2100000, gallons: 10, empties: 40, bottles: 10 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Co-Sales Dashboard</h1>
          <p className="text-sm text-slate-500">Pantau performa canvassing, stok di kendaraan, dan setoran harian.</p>
        </div>
        <Link href="/pos-mobile" className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">
          <Smartphone className="w-4 h-4" />
          Buka Mobile POS
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4">
            <DollarSign className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-500">Total Setoran Hari Ini</p>
          <h3 className="text-3xl font-bold text-slate-900 mt-1">Rp 3.600.000</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4">
            <Package className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-500">Galon Terjual</p>
          <h3 className="text-3xl font-bold text-slate-900 mt-1">55 Galon</h3>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
            <Truck className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-500">Kendaraan Aktif</p>
          <h3 className="text-3xl font-bold text-slate-900 mt-1">2 Unit</h3>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Status Kendaraan (Mobile Stock)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium">Kendaraan / Sales</th>
                <th className="px-6 py-4 font-medium">Setoran Kas</th>
                <th className="px-6 py-4 font-medium">Sisa Galon Isi</th>
                <th className="px-6 py-4 font-medium">Galon Kosong (Retur)</th>
                <th className="px-6 py-4 font-medium">Sisa Dus Botol</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mockVans.map(van => (
                <tr key={van.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                      <Truck className="w-4 h-4 text-slate-500" />
                    </div>
                    {van.name}
                  </td>
                  <td className="px-6 py-4 font-semibold text-emerald-600">
                    Rp {van.sales.toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">{van.gallons}</td>
                  <td className="px-6 py-4 font-medium text-amber-600">{van.empties}</td>
                  <td className="px-6 py-4 font-medium text-slate-700">{van.bottles}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">Detail</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
