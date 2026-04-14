/**
 * Shared EDU simulation content for the public training page.
 * The page uses these definitions to explain scoring and preview a leaderboard.
 */

export type TrainingPhase = 'SETUP' | 'OPERATIONS' | 'CONTROL'
export type TrainingCriterionKey = 'transaction' | 'context' | 'evidence'

export type TrainingQuestion = {
  id: number
  phase: TrainingPhase
  title: string
  module: string
  scope: string
  prompt: string
  verification: string[]
}

export type TrainingCriterion = {
  key: TrainingCriterionKey
  label: string
  description: string
  points: number
}

export type LeaderboardEntry = {
  id?: string
  name: string
  totalScore: number
  verifiedTasks: number
  correctionCount: number
  timeMinutes: number
}

export type TrainingQuestionScore = {
  questionId: number
  transaction: boolean
  context: boolean
  evidence: boolean
  note: string | null
  points: number
}

export type TrainingBoardTeam = LeaderboardEntry & {
  id: string
  elapsedMinutes: number
  completionPercent: number
  questionScores: Record<number, TrainingQuestionScore>
}

export type TrainingBoardData = {
  event: {
    id: string
    slug: string
    title: string
    description: string | null
  }
  maxScore: number
  questionCount: number
  teams: TrainingBoardTeam[]
}

export const TRAINING_MAX_SCORE = 45

export const TRAINING_SCORING_CRITERIA: TrainingCriterion[] = [
  {
    key: 'transaction',
    label: 'Transaksi Berhasil',
    description: 'Input tersimpan atau terposting dengan benar.',
    points: 1,
  },
  {
    key: 'context',
    label: 'Entitas Tepat',
    description: 'Peserta memilih org, unit, gudang, atau rekening yang benar.',
    points: 1,
  },
  {
    key: 'evidence',
    label: 'Bukti Valid',
    description: 'Peserta dapat menunjukkan saldo, jurnal, stok, atau laporan yang berubah.',
    points: 1,
  },
]

export const TRAINING_PHASE_LABELS: Record<TrainingPhase, { label: string; description: string }> = {
  SETUP: {
    label: 'Phase 1 · Setup Multi-Entity',
    description: 'Bangun struktur holding, master data, dan modal awal.',
  },
  OPERATIONS: {
    label: 'Phase 2 · Operasional Harian',
    description: 'Uji purchasing, inventory, sales, POS, dan cashflow.',
  },
  CONTROL: {
    label: 'Phase 3 · Kontrol & Konsolidasi',
    description: 'Uji reimbursement, aset, HRIS, intercompany, dan reporting.',
  },
}

export const TRAINING_QUESTIONS: TrainingQuestion[] = [
  {
    id: 1,
    phase: 'SETUP',
    title: 'Membuat Struktur Grup Usaha',
    module: 'Settings / Sub Orgs',
    scope: 'Holding + 2 anak perusahaan',
    prompt: 'Buat 1 holding dan 2 anak perusahaan, lalu pastikan masing-masing punya minimal 1 cabang aktif.',
    verification: [
      'Holding dapat melihat daftar anak perusahaan.',
      'Anak perusahaan terhubung ke holding yang sama.',
      'Owner atau admin dapat berpindah konteks parent dan child.',
    ],
  },
  {
    id: 2,
    phase: 'SETUP',
    title: 'Menyiapkan Master Data Dasar',
    module: 'Contacts / Inventory / Cash',
    scope: 'Produk, supplier, customer, gudang, rekening',
    prompt: 'Masukkan 3 produk, 1 supplier, 2 customer, 2 gudang, dan rekening bank yang relevan.',
    verification: [
      'Produk muncul di Inventory, Sales, atau POS.',
      'Supplier tampil di Purchasing.',
      'Customer dan rekening bank dapat dipilih di modul yang sesuai.',
    ],
  },
  {
    id: 3,
    phase: 'SETUP',
    title: 'Input Modal Awal per Entitas',
    module: 'Cash / Journal',
    scope: 'Holding, Distribusi, Retail',
    prompt: 'Catat modal awal untuk holding, distribusi, dan retail sesuai nominal skenario latihan.',
    verification: [
      'Saldo kas atau bank bertambah sesuai nominal.',
      'Jurnal otomatis terbentuk dan seimbang.',
      'Neraca menampilkan kas atau bank dan ekuitas awal.',
    ],
  },
  {
    id: 4,
    phase: 'SETUP',
    title: 'Transfer Modal dari Holding ke Anak',
    module: 'Cash Holding / Inter-Org Transfer',
    scope: 'Holding ke PT Nizam Distribusi Jabar',
    prompt: 'Lakukan transfer modal antar entitas dari holding ke anak perusahaan distribusi.',
    verification: [
      'Saldo rekening holding berkurang.',
      'Saldo rekening anak perusahaan bertambah.',
      'Transaksi ditandai sebagai inter-org, bukan transfer internal biasa.',
    ],
  },
  {
    id: 5,
    phase: 'OPERATIONS',
    title: 'Pembelian Persediaan Kredit',
    module: 'Purchasing',
    scope: 'PT Nizam Distribusi Jabar',
    prompt: 'Buat pembelian kredit ke supplier untuk beras dan gula dengan termin 30 hari.',
    verification: [
      'Dokumen pembelian tersimpan.',
      'Stok masuk ke gudang tujuan.',
      'Hutang usaha dan persediaan berubah sesuai total transaksi.',
    ],
  },
  {
    id: 6,
    phase: 'OPERATIONS',
    title: 'Pembayaran Sebagian Hutang Supplier',
    module: 'Purchasing / Aging / Cash',
    scope: 'Pembayaran via BCA Distribusi',
    prompt: 'Bayar sebagian hutang supplier melalui rekening distribusi.',
    verification: [
      'Saldo bank berkurang.',
      'Hutang supplier berkurang sebagian.',
      'Sisa hutang masih terlihat di Aging AP.',
    ],
  },
  {
    id: 7,
    phase: 'OPERATIONS',
    title: 'Mutasi Stok Antar Gudang',
    module: 'Inventory',
    scope: 'Gudang Utama ke Gudang Cabang',
    prompt: 'Pindahkan stok beras dari gudang utama ke gudang cabang.',
    verification: [
      'Stok gudang asal berkurang.',
      'Stok gudang tujuan bertambah.',
      'Kartu stok atau ledger merekam riwayat mutasi.',
    ],
  },
  {
    id: 8,
    phase: 'OPERATIONS',
    title: 'Penjualan Kredit ke Customer Grosir',
    module: 'Sales',
    scope: 'Toko Barokah',
    prompt: 'Buat penjualan kredit untuk beras dan gula dengan termin 14 hari.',
    verification: [
      'Faktur penjualan terbentuk.',
      'Stok berkurang dari gudang yang dipilih.',
      'Piutang dan pendapatan tercatat di jurnal.',
    ],
  },
  {
    id: 9,
    phase: 'OPERATIONS',
    title: 'Pelunasan Sebagian Piutang Customer',
    module: 'Cash / Aging',
    scope: 'Penerimaan ke BCA Distribusi',
    prompt: 'Catat penerimaan pembayaran sebagian dari customer grosir.',
    verification: [
      'Saldo bank bertambah.',
      'Piutang customer berkurang sebagian.',
      'Sisa piutang masih tampil di Aging AR.',
    ],
  },
  {
    id: 10,
    phase: 'OPERATIONS',
    title: 'Penjualan Retail via POS',
    module: 'POS',
    scope: 'CV Nizam Retail Bandung',
    prompt: 'Lakukan transaksi POS tunai untuk minyak goreng dan gula pada customer walk-in.',
    verification: [
      'Transaksi kasir tersimpan.',
      'Stok retail berkurang.',
      'Kas atau bank bertambah dan penjualan masuk ke laporan harian.',
    ],
  },
  {
    id: 11,
    phase: 'CONTROL',
    title: 'Reimbursement Biaya Operasional',
    module: 'Accounting / Reimburse',
    scope: 'Supervisor toko retail',
    prompt: 'Catat reimbursement biaya transport dan konsumsi untuk supervisor toko.',
    verification: [
      'Pengajuan reimbursement tercatat.',
      'Beban muncul setelah diproses atau disetujui.',
      'Kas atau bank berkurang jika pembayaran dilakukan.',
    ],
  },
  {
    id: 12,
    phase: 'CONTROL',
    title: 'Pembelian dan Pencatatan Aset Tetap',
    module: 'Accounting / Assets',
    scope: 'Hand pallet atau forklift kecil',
    prompt: 'Beli satu aset operasional dan catat sebagai aset tetap, bukan beban biasa.',
    verification: [
      'Transaksi masuk ke modul aset.',
      'Nilai aset muncul di daftar aset.',
      'Neraca mencerminkan penambahan aset tetap.',
    ],
  },
  {
    id: 13,
    phase: 'CONTROL',
    title: 'Mutasi Karyawan ke Anak Perusahaan',
    module: 'HRIS',
    scope: 'Holding ke retail',
    prompt: 'Pindahkan satu karyawan dari holding ke retail untuk menjadi PIC cabang.',
    verification: [
      'Riwayat mutasi karyawan tercatat.',
      'Profil karyawan pindah ke entitas tujuan.',
      'PIC cabang dapat diarahkan ke karyawan yang dipindahkan.',
    ],
  },
  {
    id: 14,
    phase: 'CONTROL',
    title: 'Transaksi Antar Entitas Kedua',
    module: 'Cash Holding / Inventory',
    scope: 'Distribusi ke retail',
    prompt: 'Simulasikan dukungan operasional antaranak perusahaan berupa transfer dana atau suplai barang.',
    verification: [
      'Sumber dan tujuan tercatat pada entitas yang benar.',
      'Transaksi tidak tercampur sebagai transaksi pihak luar.',
      'Saldo, stok, atau akun antar entitas berubah konsisten.',
    ],
  },
  {
    id: 15,
    phase: 'CONTROL',
    title: 'Review Laporan Konsolidasi',
    module: 'Reports',
    scope: 'Holding consolidated view',
    prompt: 'Bandingkan Neraca, Laba Rugi, dan Arus Kas mode parent only vs consolidated.',
    verification: [
      'Laporan consolidated memuat parent dan child.',
      'Kas, piutang, hutang, persediaan, pendapatan, dan beban berubah sesuai simulasi.',
      'Peserta mampu menjelaskan minimal 3 dampak angka pada laporan.',
    ],
  },
]

export const TRAINING_SAMPLE_LEADERBOARD: LeaderboardEntry[] = [
  {
    name: 'Tim Alpha',
    totalScore: 42,
    verifiedTasks: 14,
    correctionCount: 1,
    timeMinutes: 168,
  },
  {
    name: 'Tim Bravo',
    totalScore: 39,
    verifiedTasks: 13,
    correctionCount: 2,
    timeMinutes: 171,
  },
  {
    name: 'Tim Charlie',
    totalScore: 36,
    verifiedTasks: 12,
    correctionCount: 3,
    timeMinutes: 182,
  },
]

export const TRAINING_LEADERBOARD_LOGIC = [
  'Urutkan berdasarkan total skor tertinggi.',
  'Jika seri, dahulukan tim dengan jumlah soal terverifikasi lebih banyak.',
  'Jika masih seri, dahulukan tim dengan correction count lebih sedikit.',
  'Jika masih seri, dahulukan tim dengan waktu penyelesaian lebih cepat.',
]

export const TRAINING_DEPLOYMENT_OPTIONS = [
  {
    title: 'Pakai Demo Saat Ini',
    verdict: 'Cocok untuk 1 trainer atau 1 calon pelanggan.',
    detail: 'Belum cocok untuk kelas paralel karena demo saat ini memakai satu akun bersama dan org selalu di-reset.',
  },
  {
    title: 'EDU Demo per Tim',
    verdict: 'Pilihan yang direkomendasikan.',
    detail: 'Setiap tim mendapat org demo sendiri dari template yang sama, sehingga scoring board dan progres tidak saling menimpa.',
  },
  {
    title: 'Training Tenant Persisten',
    verdict: 'Cocok untuk bootcamp multi-hari.',
    detail: 'Gunakan jika hasil latihan perlu disimpan beberapa hari untuk review, mentoring, atau remedial.',
  },
]
