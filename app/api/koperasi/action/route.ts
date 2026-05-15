import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  getMurabahahTransaksi, createMurabahahTransaksi,
  getAkadWakalah, createAkadWakalah,
  getDashboardStats,
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
  getMurabahahTransaksi, createMurabahahTransaksi,
  getAkadWakalah, createAkadWakalah,
  getDashboardStats,
  generateProjectCoa, getProjectCoa, getProjectJournal,
  createProjectJournalEntry, getProjectBalanceSheet, getProjectProfitLoss,
  hitungBagiHasil, getBagiHasil, konfirmasiBagiHasil,
  setujuiDistribusi, syncProyekKeBukuBesar, getProjectFinancialSummary,
  hitungSHU, getSHUHistory,
}

export async function POST(req: NextRequest) {
  try {
    const db = await createClient()
    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: orgMember } = await db
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .order('is_primary', { ascending: false })
      .limit(1)
      .single()

    if (!orgMember) {
      return NextResponse.json({ error: 'No active organization' }, { status: 404 })
    }

    const body = await req.json()
    const { action, params = [] } = body

    if (!action || !ACTION_MAP[action]) {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    const fn = ACTION_MAP[action]
    const result = await fn(...params)

    return NextResponse.json({ data: result }, { status: 200 })
  } catch (err: any) {
    console.error('POST /api/koperasi/action error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
