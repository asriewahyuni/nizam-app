import { NextRequest, NextResponse } from 'next/server'
import { getActiveOrg } from '@/modules/organization/actions/org.actions'
import {
  getAnggota, createAnggota, updateAnggota,
  getSimpananPokok, bayarSimpananPokok,
  getSimpananWajib, bayarSimpananWajib,
  getSimpananSukarela, transaksiSimpananSukarela,
  getShahibulMaal, daftarkanShahibulMaal,
  getMudharib, createMudharib,
  getSertifikasiDps, terbitkanSertifikasi,
  getPengurus, tetapkanPengurus,
  getProyek, createProyek, updateStatusProyek,
  getCurrentUserKoperasiRole,
  getMurabahahTransaksi, createMurabahahTransaksi,
  getAkadWakalah, createAkadWakalah,
  getDashboardStats,
  getActiveOrgId,
} from '@/modules/koperasi/actions/koperasi.actions'
import {
  generateProjectCoa, getProjectCoa, getProjectJournal,
  createProjectJournalEntry, getProjectBalanceSheet, getProjectProfitLoss,
} from '@/modules/koperasi/actions/proyek-jurnal.actions'
import {
  hitungBagiHasil, getBagiHasil, konfirmasiBagiHasil,
  setujuiDistribusi, syncProyekKeBukuBesar, getProjectFinancialSummary,
} from '@/modules/koperasi/actions/bagi-hasil.actions'
import { hitungSHU, getSHUHistory } from '@/modules/koperasi/actions/shu.actions'

export const dynamic = 'force-dynamic'

const ACTION_MAP: Record<string, Function> = {
  getAnggota, createAnggota, updateAnggota,
  getSimpananPokok, bayarSimpananPokok,
  getSimpananWajib, bayarSimpananWajib,
  getSimpananSukarela, transaksiSimpananSukarela,
  getShahibulMaal, daftarkanShahibulMaal,
  getMudharib, createMudharib,
  getSertifikasiDps, terbitkanSertifikasi,
  getPengurus, tetapkanPengurus,
  getProyek, createProyek, updateStatusProyek,
  getCurrentUserKoperasiRole,
  getMurabahahTransaksi, createMurabahahTransaksi,
  getAkadWakalah, createAkadWakalah,
  getDashboardStats,
  getActiveOrgId,
  generateProjectCoa, getProjectCoa, getProjectJournal,
  createProjectJournalEntry, getProjectBalanceSheet, getProjectProfitLoss,
  hitungBagiHasil, getBagiHasil, konfirmasiBagiHasil,
  setujuiDistribusi, syncProyekKeBukuBesar, getProjectFinancialSummary,
  hitungSHU, getSHUHistory,
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, params = [] } = body

    if (!action || !ACTION_MAP[action]) {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    // Verify auth + active org (same pattern as /api/koperasi/dashboard)
    const orgData = await getActiveOrg()
    if (!orgData || !orgData.org) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const fn = ACTION_MAP[action]
    const result = await fn(...params)

    return NextResponse.json({ data: result }, { status: 200 })
  } catch (err: any) {
    console.error('POST /api/koperasi/action error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
