/**
 * Client-side helper untuk koperasi API actions.
 * Semua panggilan ke actions koperasi via API route, bukan server action langsung.
 * Ini menghindari masalah bundling di Next.js 16 (React Flight serialization).
 */

const API_URL = '/api/koperasi/action'

export async function koperasiApi(action: string, ...params: any[]) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Koperasi API error: ${res.status}`)
  }
  const json = await res.json()
  return json.data
}

// ── Convenience wrappers ──────────────────────────────────────────────────

export const getAnggota = (orgId: string) => koperasiApi('getAnggota', orgId)
export const createAnggota = (orgId: string, payload: any) => koperasiApi('createAnggota', orgId, payload)
export const updateAnggota = (id: string, payload: any) => koperasiApi('updateAnggota', id, payload)

export const getSimpananPokok = (orgId: string) => koperasiApi('getSimpananPokok', orgId)
export const bayarSimpananPokok = (orgId: string, payload: any) => koperasiApi('bayarSimpananPokok', orgId, payload)
export const getSimpananWajib = (orgId: string) => koperasiApi('getSimpananWajib', orgId)
export const bayarSimpananWajib = (orgId: string, payload: any) => koperasiApi('bayarSimpananWajib', orgId, payload)
export const getSimpananSukarela = (orgId: string) => koperasiApi('getSimpananSukarela', orgId)
export const transaksiSimpananSukarela = (orgId: string, payload: any) => koperasiApi('transaksiSimpananSukarela', orgId, payload)

export const getShahibulMaal = (orgId: string) => koperasiApi('getShahibulMaal', orgId)
export const daftarkanShahibulMaal = (orgId: string, anggotaId: string) => koperasiApi('daftarkanShahibulMaal', orgId, anggotaId)

export const getMudharib = (orgId: string) => koperasiApi('getMudharib', orgId)
export const createMudharib = (orgId: string, payload: any) => koperasiApi('createMudharib', orgId, payload)
export const terbitkanSertifikasi = (orgId: string, payload: any) => koperasiApi('terbitkanSertifikasi', orgId, payload)

export const getPengurus = (orgId: string) => koperasiApi('getPengurus', orgId)
export const tetapkanPengurus = (orgId: string, payload: any) => koperasiApi('tetapkanPengurus', orgId, payload)

export const getProyek = (orgId: string) => koperasiApi('getProyek', orgId)
export const createProyek = (orgId: string, payload: any) => koperasiApi('createProyek', orgId, payload)
export const updateStatusProyek = (id: string, status: string, alasan?: string) => koperasiApi('updateStatusProyek', id, status, alasan)
export const getInvestasiProyek = (proyekId: string) => koperasiApi('getInvestasiProyek', proyekId)
export const tambahInvestasi = (proyekId: string, shahibulMaalId: string, jumlah: number) => koperasiApi('tambahInvestasi', proyekId, shahibulMaalId, jumlah)

export const getMurabahahTransaksi = (orgId: string) => koperasiApi('getMurabahahTransaksi', orgId)
export const createMurabahahTransaksi = (orgId: string, payload: any) => koperasiApi('createMurabahahTransaksi', orgId, payload)

export const getAkadWakalah = (orgId: string) => koperasiApi('getAkadWakalah', orgId)
export const createAkadWakalah = (orgId: string, payload: any) => koperasiApi('createAkadWakalah', orgId, payload)

export const getSertifikasiDps = (orgId: string) => koperasiApi('getSertifikasiDps', orgId)

export const getDashboardStats = (orgId: string) => koperasiApi('getDashboardStats', orgId)

// ── Proyek Jurnal & Bagi Hasil ──────────────────────────────────────────

export const generateProjectCoa = (proyekId: string) => koperasiApi('generateProjectCoa', proyekId)
export const getProjectCoa = (proyekId: string) => koperasiApi('getProjectCoa', proyekId)
export const getProjectJournal = (proyekId: string) => koperasiApi('getProjectJournal', proyekId)
export const createProjectJournalEntry = (proyekId: string, payload: any) => koperasiApi('createProjectJournalEntry', proyekId, payload)
export const getProjectBalanceSheet = (proyekId: string) => koperasiApi('getProjectBalanceSheet', proyekId)
export const getProjectProfitLoss = (proyekId: string) => koperasiApi('getProjectProfitLoss', proyekId)

export const hitungBagiHasil = (proyekId: string) => koperasiApi('hitungBagiHasil', proyekId)
export const getBagiHasil = (proyekId: string) => koperasiApi('getBagiHasil', proyekId)
export const konfirmasiBagiHasil = (bhId: string) => koperasiApi('konfirmasiBagiHasil', bhId)
export const setujuiDistribusi = (bhId: string, proyekId: string) => koperasiApi('setujuiDistribusi', bhId, proyekId)
export const syncProyekKeBukuBesar = (orgId: string, proyekId: string) => koperasiApi('syncProyekKeBukuBesar', orgId, proyekId)
export const getProjectFinancialSummary = (proyekId: string) => koperasiApi('getProjectFinancialSummary', proyekId)

// ── SHU ────────────────────────────────────────────────────────────────

export const hitungSHU = (orgId: string, tahun: number) => koperasiApi('hitungSHU', orgId, tahun)
export const getSHUHistory = (orgId: string) => koperasiApi('getSHUHistory', orgId)
