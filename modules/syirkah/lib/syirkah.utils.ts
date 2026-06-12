/**
 * Fungsi utilitas murni (pure functions) untuk modul Syirkah.
 * File ini TIDAK mengandung 'use server' karena bukan Server Action —
 * bisa diimport dari client maupun server component.
 */

export type SyirkahClause = {
  number: number
  title: string
  content: string
  editable?: boolean
}

export type SyirkahDistributionMode =
  | 'WAITING_ACTIVE_CONTRACT'
  | 'SINGLE_ACTIVE_CONTRACT'
  | 'MULTIPLE_ACTIVE_CONTRACTS'

export type SyirkahDistributionContext = {
  mode: SyirkahDistributionMode
  netProfit: number
  activeContractIds: string[]
  message: string
  totalAssets: number
  totalModalSyirkah: number
  /** true jika total aset >= modal syirkah mudharabah (syarat capital preservation) */
  isCapitalPreserved: boolean
}

export type SyirkahContractDistributionStatus =
  | 'ESTIMATED'
  | 'WAITING_ACTIVE'
  | 'MULTIPLE_ACTIVE_UNALLOCATED'
  | 'CAPITAL_NOT_PRESERVED'

export type SyirkahContractDistributionSource =
  | 'MANUAL_ALLOCATION'
  | 'ORG_NET_PROFIT'
  | 'NONE'

export type SyirkahContractDistributionResolution = {
  status: SyirkahContractDistributionStatus
  source: SyirkahContractDistributionSource
  baseAmount: number | null
  message: string
}

type SyirkahDistributionContractLike = {
  id?: string | null
  status?: unknown
  profit_sharing_allocation?: unknown
}

function normalizeSyirkahMoney(value: unknown) {
  const parsed = Number(value ?? 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.round(parsed * 100) / 100
}

function isActiveSyirkahContractStatus(status: unknown) {
  const normalized = String(status || '').trim().toUpperCase()
  return normalized === 'ACTIVE' || normalized === 'COMPLETED'
}

export function buildSyirkahDistributionContext(
  contracts: SyirkahDistributionContractLike[],
  netProfit: number,
  totalAssets: number = 0,
  totalModalSyirkah: number = 0
): SyirkahDistributionContext {
  const activeContractIds = contracts
    .filter((contract) => isActiveSyirkahContractStatus(contract.status))
    .map((contract) => String(contract.id || '').trim())
    .filter(Boolean)

  // Capital preservation: bagi hasil hanya boleh jika harta >= modal syirkah
  const isCapitalPreserved = totalModalSyirkah <= 0 || totalAssets >= totalModalSyirkah

  const base = { totalAssets, totalModalSyirkah, isCapitalPreserved }

  if (activeContractIds.length === 0) {
    return {
      ...base,
      mode: 'WAITING_ACTIVE_CONTRACT',
      netProfit,
      activeContractIds: [],
      message: 'Estimasi bagi hasil tersedia setelah ada akad berstatus ACTIVE atau COMPLETED.',
    }
  }

  if (activeContractIds.length === 1) {
    return {
      ...base,
      mode: 'SINGLE_ACTIVE_CONTRACT',
      netProfit,
      activeContractIds,
      message: 'Estimasi bagi hasil saat ini memakai laba bersih organisasi untuk satu akad aktif yang berjalan.',
    }
  }

  return {
    ...base,
    mode: 'MULTIPLE_ACTIVE_CONTRACTS',
    netProfit,
    activeContractIds,
    message: 'Ada lebih dari satu akad ACTIVE/COMPLETED. Sistem belum bisa membagi laba bersih organisasi otomatis per akad.',
  }
}

export function getSyirkahContractEstimatedNetProfit(
  context: SyirkahDistributionContext,
  contractId: unknown
) {
  const normalizedContractId = String(contractId || '').trim()
  if (!normalizedContractId) return null

  if (context.mode !== 'SINGLE_ACTIVE_CONTRACT') return null
  if (!context.activeContractIds.includes(normalizedContractId)) return null

  return context.netProfit
}

export function resolveSyirkahContractDistributionStatus(
  context: SyirkahDistributionContext,
  contractId: unknown,
  status: unknown
): SyirkahContractDistributionStatus {
  if (!isActiveSyirkahContractStatus(status)) {
    return 'WAITING_ACTIVE'
  }

  return getSyirkahContractEstimatedNetProfit(context, contractId) == null
    ? 'MULTIPLE_ACTIVE_UNALLOCATED'
    : 'ESTIMATED'
}

export function resolveSyirkahContractDistribution(
  context: SyirkahDistributionContext,
  contract: SyirkahDistributionContractLike
): SyirkahContractDistributionResolution {
  if (!isActiveSyirkahContractStatus(contract.status)) {
    return {
      status: 'WAITING_ACTIVE',
      source: 'NONE',
      baseAmount: null,
      message: 'Alokasi bagi hasil akan dipakai setelah akad berstatus ACTIVE atau COMPLETED.',
    }
  }

  // Syarat mudharabah: harta harus >= modal sebelum bagi hasil boleh dibagikan
  if (!context.isCapitalPreserved) {
    return {
      status: 'CAPITAL_NOT_PRESERVED',
      source: 'NONE',
      baseAmount: null,
      message: 'Bagi hasil belum dapat dibagikan. Total harta organisasi belum mencapai modal syirkah mudharabah.',
    }
  }

  const manualAllocation = normalizeSyirkahMoney(contract.profit_sharing_allocation)
  if (manualAllocation > 0) {
    return {
      status: 'ESTIMATED',
      source: 'MANUAL_ALLOCATION',
      baseAmount: manualAllocation,
      message: 'Pembagian akad ini memakai nominal alokasi bagi hasil manual, bukan seluruh laba bersih organisasi.',
    }
  }

  const fallbackNetProfit = getSyirkahContractEstimatedNetProfit(context, contract.id)
  if (fallbackNetProfit != null) {
    return {
      status: 'ESTIMATED',
      source: 'ORG_NET_PROFIT',
      baseAmount: fallbackNetProfit,
      message: 'Pembagian akad ini memakai laba bersih organisasi karena belum ada nominal alokasi bagi hasil manual.',
    }
  }

  return {
    status: 'MULTIPLE_ACTIVE_UNALLOCATED',
    source: 'NONE',
    baseAmount: null,
    message: 'Akad ini butuh nominal alokasi bagi hasil manual atau laba bersih per akad agar pembagian nominal bisa dihitung.',
  }
}

// ─── Witness Weight Helpers ──────────────────────────────────────────────────

/** Bobot saksi: Laki-laki=1, Perempuan=0.5. Minimal total bobot = 2 */
export function calcWitnessWeight(witnesses: { gender: string }[]): number {
  return witnesses.reduce((sum, w) => sum + (w.gender === 'LAKI-LAKI' ? 1 : 0.5), 0)
}

export function isWitnessQuorumMet(witnesses: { gender: string }[]): boolean {
  return calcWitnessWeight(witnesses) >= 2
}

// ─── Clause Generator ────────────────────────────────────────────────────────

/**
 * Generate pasal-pasal akad otomatis berdasarkan data kontrak, anggota, dan saksi.
 * Mengembalikan array SyirkahClause yang bisa diedit user di wizard.
 */
export function generateSyirkahClauses(contract: any, members: any[], witnesses: any[] = []): SyirkahClause[] {
  const type = contract.contract_type || 'Syirkah Mudharabah'
  const isAbdan = type === 'Abdan'
  const isMudharabah = type === 'Syirkah Mudharabah'
  const isWujuh = type === 'Syirkah Wujuh'

  const pihakList = members
    .map((m, i) => `Pihak ${i + 1}: ${m.member_name} (${m.role}), beralamat di ${m.address || '-'}, NIK: ${m.nik || '-'}`)
    .join('\n    ')

  const saksiList = witnesses.length > 0
    ? witnesses.map((w, i) => `Saksi ${i + 1}: ${w.witness_name} (${w.gender}), NIK: ${w.nik || '-'}, Alamat: ${w.address || '-'}`).join('\n    ')
    : '(belum ada saksi yang didaftarkan)'

  const nisbahList = members
    .map(m => `${m.member_name}: ${m.profit_share_percentage}%`)
    .join(', ')

  const endDate = contract.start_date && contract.duration_months
    ? new Date(new Date(contract.start_date).setMonth(new Date(contract.start_date).getMonth() + contract.duration_months)).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-'

  const clauses: SyirkahClause[] = [
    {
      number: 1,
      title: 'Identitas Para Pihak dan Saksi',
      content: `Akad ${type} ini dibuat dan ditandatangani oleh:\n    ${pihakList}\n\nSelanjutnya secara bersama-sama disebut sebagai "Para Pihak".\n\nDisaksikan oleh:\n    ${saksiList}\n\nPara saksi telah memenuhi ketentuan syariah (bobot saksi minimal 2 — laki-laki = 1, perempuan = ½).`,
      editable: true
    },
    {
      number: 2,
      title: 'Objek Akad dan Jenis Usaha',
      content: `Para Pihak sepakat untuk menjalankan usaha bersama dalam bidang:\n\n    Nama Usaha: ${contract.business_name || contract.title}\n    Deskripsi: ${contract.business_description || '-'}\n\nUsaha dijalankan berdasarkan prinsip-prinsip syariah Islam sesuai dengan ketentuan yang berlaku.`,
      editable: true
    },
    {
      number: 3,
      title: 'Jangka Waktu Akad',
      content: `Akad ini berlaku selama ${contract.duration_months || 12} (${spellNumber(contract.duration_months || 12)}) bulan, terhitung sejak tanggal ${contract.start_date ? new Date(contract.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'} sampai dengan tanggal ${endDate}, dan dapat diperpanjang atas kesepakatan Para Pihak.`,
      editable: true
    },
    ...(isAbdan ? [{
      number: 4,
      title: 'Kontribusi Jasa dan Keahlian (Abdan)',
      content: `Seluruh Para Pihak dalam akad Syirkah Abdan ini tidak berkontribusi dalam bentuk modal finansial, melainkan kontribusi berupa keahlian, tenaga, dan jasa masing-masing pihak sebagai berikut:\n\n    ${members.map(m => `${m.member_name}: ${m.responsibility || 'Sesuai kesepakatan'}`).join('\n    ')}`,
      editable: true
    }] : []),
    ...(isMudharabah ? [{
      number: 4,
      title: 'Modal Shahibul Maal dan Peran Mudharib',
      content: `Shahibul Maal (Pemodal) menyerahkan modal kepada Mudharib (Pengelola) dengan rincian:\n\n    ${members.filter(m => m.role === 'PEMODAL').map(m => `${m.member_name}: Rp ${Number(m.capital_contribution || 0).toLocaleString('id-ID')}`).join('\n    ')}\n\nMudharib bertanggung jawab penuh atas pengelolaan modal dan operasional usaha.`,
      editable: true
    }] : []),
    ...(!isAbdan && !isMudharabah ? [{
      number: 4,
      title: 'Kontribusi Modal Para Pihak',
      content: `Masing-masing pihak berkontribusi modal sebagai berikut:\n\n    ${members.map(m => `${m.member_name}: Rp ${Number(m.capital_contribution || 0).toLocaleString('id-ID')}`).join('\n    ')}\n\nModal tersebut digunakan sepenuhnya untuk kepentingan operasional usaha bersama.`,
      editable: true
    }] : []),
    {
      number: 5,
      title: 'Hak dan Kewajiban Para Pihak',
      content: `Masing-masing pihak memiliki hak dan kewajiban sebagai berikut:\n\n    ${members.map(m => `${m.member_name} (${m.role}):\n      - Tugas & Tanggung Jawab: ${m.responsibility || 'Sesuai kesepakatan bersama'}`).join('\n    ')}\n\nPara Pihak wajib menjaga kepercayaan, kejujuran, dan transparansi dalam setiap kegiatan usaha.`,
      editable: true
    },
    {
      number: 6,
      title: 'Nisbah Bagi Hasil',
      content: `Pembagian hasil usaha disepakati dengan nisbah sebagai berikut:\n\n    ${nisbahList}\n\nPembagian dilakukan setiap ${contract.duration_months && contract.duration_months <= 3 ? 'bulan' : 'kuartal'} berdasarkan laporan keuangan usaha yang telah diverifikasi bersama.`,
      editable: true
    },
    ...(isWujuh ? [{
      number: 7,
      title: 'Reputasi dan Kepercayaan sebagai Modal (Wujuh)',
      content: `Dalam Syirkah Wujuh ini, Para Pihak mengakui bahwa reputasi, nama baik, dan kepercayaan masing-masing pihak merupakan modal utama yang dipertaruhkan. Para Pihak sepakat untuk menjaga nama baik usaha bersama dengan sepenuh hati.`,
      editable: true
    }] : []),
    {
      number: isWujuh ? 8 : 7,
      title: 'Penyelesaian Perselisihan',
      content: `Apabila terjadi perselisihan antara Para Pihak yang tidak dapat diselesaikan secara musyawarah dalam waktu 14 (empat belas) hari kalender, maka Para Pihak sepakat untuk menyelesaikannya melalui Badan Arbitrase Syariah Nasional (BASYARNAS) sesuai dengan ketentuan yang berlaku.`,
      editable: true
    },
    {
      number: isWujuh ? 9 : 8,
      title: 'Force Majeure',
      content: `Yang dimaksud dengan Force Majeure dalam akad ini adalah setiap kejadian di luar kemampuan Para Pihak yang mengakibatkan tidak terlaksananya kewajiban, antara lain: bencana alam, peperangan, kebijakan pemerintah yang bersifat memaksa, dan pandemi. Apabila terjadi Force Majeure, pihak yang terdampak wajib memberitahukan kepada pihak lainnya dalam waktu 3 (tiga) hari kerja.`,
      editable: true
    },
    {
      number: isWujuh ? 10 : 9,
      title: 'Ketentuan Penutup',
      content: `Akad ini dibuat atas dasar kerelaan (ridha) dari semua pihak tanpa adanya paksaan dari pihak manapun. Akad ini mulai berlaku dan mengikat Para Pihak sejak ditandatangani secara digital melalui sistem Nizam ERP.\n\nDisaksikan oleh:\n    ${saksiList}\n\nHal-hal yang belum diatur dalam akad ini akan diselesaikan melalui musyawarah untuk mufakat berdasarkan prinsip-prinsip syariah Islam.`,
      editable: true
    }
  ]

  return clauses
}

function spellNumber(n: number): string {
  const words: Record<number, string> = {
    1: 'satu', 2: 'dua', 3: 'tiga', 4: 'empat', 5: 'lima',
    6: 'enam', 7: 'tujuh', 8: 'delapan', 9: 'sembilan', 10: 'sepuluh',
    11: 'sebelas', 12: 'dua belas', 18: 'delapan belas', 24: 'dua puluh empat',
    36: 'tiga puluh enam', 48: 'empat puluh delapan', 60: 'enam puluh'
  }
  return words[n] || `${n}`
}
