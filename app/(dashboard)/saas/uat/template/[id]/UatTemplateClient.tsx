'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import { saveUatTemplateItems } from '@/modules/saas/actions/uat.actions'
import type { UatTemplate, UatTemplateItem } from '@/modules/saas/actions/uat.actions'

type Props = {
  template: UatTemplate
  items: UatTemplateItem[]
}

type DraftItem = {
  id?: string
  module_name: string
  category: string
  test_scenario: string
  expected_result: string
  order_index: number
}

export default function UatTemplateClient({ template, items }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [drafts, setDrafts] = useState<DraftItem[]>(
    items.map(i => ({ id: i.id, module_name: i.module_name, category: i.category ?? '', test_scenario: i.test_scenario, expected_result: i.expected_result, order_index: i.order_index }))
  )

  function addRow() {
    setDrafts(prev => [...prev, { module_name: '', category: '', test_scenario: '', expected_result: '', order_index: prev.length }])
  }

  function removeRow(idx: number) {
    setDrafts(prev => prev.filter((_, i) => i !== idx))
  }

  function updateRow(idx: number, field: keyof DraftItem, value: string) {
    setDrafts(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  function handleSave() {
    startTransition(async () => {
      await saveUatTemplateItems(
        template.id,
        drafts.filter(d => d.test_scenario.trim()).map((d, i) => ({
          module_name: d.module_name || 'Umum',
          category: d.category || undefined,
          test_scenario: d.test_scenario,
          expected_result: d.expected_result,
          order_index: i,
        }))
      )
      router.refresh()
    })
  }

  // Group by module for display
  const modules = [...new Set(drafts.map(d => d.module_name || 'Umum'))]

  return (
    <div className="space-y-6 pb-20 p-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/saas/uat')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 cursor-pointer">
          <ArrowLeft size={16} /> Kembali
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{template.name}</h1>
          <p className="text-xs text-slate-400">{template.applicable_modules.join(', ') || 'Semua modul'} · {drafts.length} item</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Item Checklist</span>
          <button onClick={addRow} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer">
            <Plus size={14} /> Tambah Baris
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left w-8">#</th>
                <th className="px-3 py-2 text-left w-36">Modul</th>
                <th className="px-3 py-2 text-left w-32">Kategori</th>
                <th className="px-3 py-2 text-left">Skenario Pengujian</th>
                <th className="px-3 py-2 text-left">Hasil yang Diharapkan</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {drafts.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <input
                      value={row.module_name}
                      onChange={e => updateRow(idx, 'module_name', e.target.value)}
                      placeholder="Accounting"
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.category}
                      onChange={e => updateRow(idx, 'category', e.target.value)}
                      placeholder="Input Data"
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.test_scenario}
                      onChange={e => updateRow(idx, 'test_scenario', e.target.value)}
                      placeholder="User dapat membuat jurnal manual..."
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.expected_result}
                      onChange={e => updateRow(idx, 'expected_result', e.target.value)}
                      placeholder="Jurnal tersimpan dan muncul di buku besar"
                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => removeRow(idx)} className="text-slate-300 hover:text-red-500 cursor-pointer">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {drafts.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">Belum ada item. Klik Tambah Baris.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
        >
          <Save size={16} />
          {isPending ? 'Menyimpan...' : 'Simpan Template'}
        </button>
      </div>
    </div>
  )
}
