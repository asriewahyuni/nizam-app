'use client'

export default function PrintButton() {
  return (
    <button type="button"
      onClick={() => window.print()}
      className="mt-4 px-6 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition print:hidden"
    >
      Cetak Dokumen
    </button>
  )
}
