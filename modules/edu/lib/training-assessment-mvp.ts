export type TrainingAssessmentTask = {
  title: string
  instruction: string
  expectedEvidence: string
}

export type TrainingAssessmentTemplate = {
  courseSlug: string
  documentTitle: string
  version: string
  effectiveDate: string
  purpose: string
  methods: string[]
  competentWhen: string[]
  notYetCompetentWhen: string[]
  theoryQuestions: string[]
  answerGuide: string[]
  practicalTasks: TrainingAssessmentTask[]
  performanceChecklist: string[]
  evidenceChecklist: string[]
  followUpGuidance: string[]
}

export const TRAINING_ASSESSMENTS: TrainingAssessmentTemplate[] = [
  {
    courseSlug: 'orientasi-perusahaan-dasar',
    documentTitle: 'Lembar Asesmen Level 0 · Orientasi Perusahaan',
    version: '1.0',
    effectiveDate: '24 April 2026',
    purpose: 'Menilai kesiapan peserta sebelum masuk ke pelatihan akses dasar NIZAM pada Level 1.',
    methods: [
      'Tanya jawab teori singkat tentang jalur akses dan peran pengguna.',
      'Observasi trainer terhadap pemahaman aturan akun dan keamanan dasar.',
      'Verifikasi kesiapan peserta mengikuti urutan belajar berjenjang.',
    ],
    competentWhen: [
      'Peserta mampu menjelaskan perbedaan admin bisnis dan panel staf.',
      'Peserta memahami aturan keamanan akun dasar dan tidak berbagi sandi.',
      'Peserta memahami bahwa Level 0 harus selesai sebelum lanjut ke Level 1.',
    ],
    notYetCompetentWhen: [
      'Peserta masih bingung memilih jalur akses sesuai peran.',
      'Peserta belum memahami aturan akun dasar atau masih menormalisasi peminjaman akun.',
      'Peserta belum memahami urutan belajar sehingga berisiko melompati tahap onboarding.',
    ],
    theoryQuestions: [
      'Apa perbedaan fungsi jalur Admin Bisnis dan Panel Staf?',
      'Siapa yang umumnya memakai email bisnis untuk masuk ke NIZAM?',
      'Mengapa satu akun kerja tidak boleh dipakai bergantian oleh beberapa orang?',
      'Apa risiko jika password dibagikan ke rekan kerja?',
      'Kapan peserta harus meminta bantuan trainer atau admin internal?',
      'Mengapa peserta tidak disarankan langsung praktik transaksi tanpa menyelesaikan orientasi?',
      'Setelah Level 0 selesai, course apa yang harus diikuti berikutnya?',
      'Apa tujuan utama halaman Profil Saya dalam konteks identitas kerja?',
    ],
    answerGuide: [
      'Admin Bisnis dipakai owner atau admin utama, Panel Staf dipakai karyawan atau operator internal.',
      'Email bisnis dipakai pemilik bisnis atau admin utama yang mengelola akun bisnis.',
      'Agar identitas kerja, audit trail, dan tanggung jawab penggunaan sistem tetap jelas.',
      'Akun bisa diakses pihak yang tidak berwenang dan jejak kerja menjadi tidak valid.',
      'Saat jalur login tidak jelas, akun bermasalah, atau peserta tidak yakin langkah yang benar.',
      'Karena fondasi akses dan keamanan belum kuat sehingga peserta rawan salah jalur dan salah prosedur.',
      'Level 1 Pengguna Umum NIZAM.',
      'Untuk mengelola identitas dasar akun seperti profil, kontak, dan pengaturan pribadi tertentu.',
    ],
    practicalTasks: [
      {
        title: 'Menentukan Jalur Akses',
        instruction: 'Peserta diminta menjelaskan jalur login yang tepat untuk owner/admin utama dan jalur login yang tepat untuk staf.',
        expectedEvidence: 'Peserta dapat menyebutkan dua jalur akses dan siapa penggunanya tanpa dibimbing.',
      },
      {
        title: 'Menjelaskan Aturan Akun',
        instruction: 'Peserta diminta menjelaskan minimal tiga aturan dasar keamanan akun yang wajib diikuti.',
        expectedEvidence: 'Peserta menyebutkan sandi tidak dibagikan, akun sesuai identitas kerja, dan eskalasi jika akses bermasalah.',
      },
      {
        title: 'Menjelaskan Urutan Belajar',
        instruction: 'Peserta diminta menjelaskan urutan belajar dari orientasi sampai masuk ke pelatihan akses dasar.',
        expectedEvidence: 'Peserta dapat menyebutkan Level 0 lebih dulu lalu Level 1 sebelum praktik lanjutan.',
      },
    ],
    performanceChecklist: [
      'Mampu membedakan jalur admin bisnis dan panel staf.',
      'Mampu menjelaskan siapa yang memakai email bisnis dan siapa yang memakai identitas staf.',
      'Mampu menjelaskan bahwa sandi tidak boleh dibagikan.',
      'Mampu menjelaskan bahwa satu akun mewakili satu identitas kerja.',
      'Mampu menyebutkan pihak yang dihubungi saat akses bermasalah.',
      'Mampu menjelaskan urutan Level 0 lalu Level 1.',
      'Mampu menunjukkan kesiapan mengikuti onboarding tanpa melompati tahap dasar.',
    ],
    evidenceChecklist: [
      'Catatan observasi trainer.',
      'Jawaban teori singkat peserta.',
      'Checklist verifikasi kesiapan lanjut ke Level 1.',
    ],
    followUpGuidance: [
      'Jika belum kompeten, ulangi lesson orientasi yang belum dipahami lalu lakukan tanya jawab ulang.',
      'Jika peserta masih bingung soal akses, trainer wajib menegaskan peran peserta sebelum lanjut ke Level 1.',
      'Jika kompeten, peserta dapat dipindahkan ke course Level 1 Pengguna Umum NIZAM.',
    ],
  },
  {
    courseSlug: 'pengguna-umum-nizam',
    documentTitle: 'Lembar Asesmen Level 1 · Pengguna Umum NIZAM',
    version: '1.1',
    effectiveDate: '24 April 2026',
    purpose: 'Menilai kemampuan peserta menjalankan akses awal NIZAM secara mandiri, aman, dan sesuai peran.',
    methods: [
      'Tes teori singkat tentang jalur akses, reset password, dan profil dasar.',
      'Uji praktik langsung pada alur daftar akun, login, keamanan akun, dan profil.',
      'Observasi trainer atau assessor terhadap ketelitian, pemahaman, dan kemandirian peserta.',
    ],
    competentWhen: [
      'Peserta mampu memilih jalur login yang benar sesuai peran.',
      'Peserta mampu menjelaskan dan mempraktikkan reset password akun bisnis.',
      'Peserta mampu menunjukkan lokasi ganti password mandiri dan pengelolaan profil dasar.',
      'Peserta dapat menjelaskan perbedaan reset password, ganti password mandiri, dan pembaruan avatar/profil.',
    ],
    notYetCompetentWhen: [
      'Peserta masih salah membedakan admin bisnis dan panel staf.',
      'Peserta belum mampu menyelesaikan alur reset password atau ganti password mandiri.',
      'Peserta belum memahami fungsi halaman Profil Saya untuk identitas dasar.',
      'Peserta masih menunjukkan kebiasaan akun yang tidak aman seperti berbagi sandi.',
    ],
    theoryQuestions: [
      'Apa perbedaan Admin Bisnis dan Panel Staf?',
      'Data apa yang dipakai untuk login Admin Bisnis?',
      'Data apa yang dipakai untuk login Panel Staf?',
      'Kapan pengguna memakai halaman Register?',
      'Kapan pengguna memakai halaman Lupa Password?',
      'Apa beda reset password via email dengan ganti password mandiri setelah login?',
      'Mengapa password awal sebaiknya segera diganti setelah pengguna berhasil masuk?',
      'Di menu mana pengguna mengelola avatar dan profil dasar?',
      'Sebutkan minimal dua data yang dapat diperbarui di halaman Profil Saya.',
      'Mengapa avatar dan data profil yang akurat membantu penggunaan harian?',
      'Apa tindakan yang harus dilakukan setelah meminta reset password?',
      'Sebutkan satu risiko jika password dibagikan ke orang lain.',
    ],
    answerGuide: [
      'Admin Bisnis untuk pemilik atau admin utama, Panel Staf untuk karyawan atau operator internal.',
      'Email bisnis dan password akun bisnis.',
      'Nomor induk karyawan atau identitas staf dan password staf.',
      'Saat belum memiliki akun bisnis NIZAM.',
      'Saat lupa password akun bisnis dan perlu pemulihan lewat email terdaftar.',
      'Reset password dipakai saat lupa akses, sedangkan ganti password mandiri dilakukan dari dalam akun setelah login.',
      'Untuk meningkatkan keamanan dan mengurangi risiko pemakaian password awal terlalu lama.',
      'Di halaman Profil Saya.',
      'Contohnya avatar, nomor WhatsApp, atau data kontak dasar yang diizinkan.',
      'Agar identitas pengguna mudah dikenali dan komunikasi internal lebih rapi.',
      'Periksa inbox email atau folder spam lalu ikuti instruksi reset.',
      'Akun dapat diakses pihak yang tidak berwenang dan jejak aktivitas menjadi tidak aman.',
    ],
    practicalTasks: [
      {
        title: 'Mengenali Halaman Daftar Akun',
        instruction: 'Peserta diminta membuka halaman daftar akun bisnis dan menjelaskan field wajib yang harus disiapkan.',
        expectedEvidence: 'Peserta mampu menjelaskan nama pemilik, email bisnis aktif, dan password awal.',
      },
      {
        title: 'Simulasi Login Admin Bisnis',
        instruction: 'Peserta diminta menunjukkan jalur login Admin Bisnis dan menjelaskan data yang dipakai.',
        expectedEvidence: 'Peserta memilih tab yang benar dan menyebutkan email bisnis serta password akun bisnis.',
      },
      {
        title: 'Simulasi Login Panel Staf',
        instruction: 'Peserta diminta menunjukkan jalur login Panel Staf dan menjelaskan identitas yang dipakai.',
        expectedEvidence: 'Peserta memilih tab Panel Staf dan menyebutkan NIK atau identitas staf sesuai konteks.',
      },
      {
        title: 'Simulasi Reset Password',
        instruction: 'Peserta diminta menunjukkan cara meminta reset password akun bisnis.',
        expectedEvidence: 'Peserta membuka halaman lupa password, mengisi email terdaftar, dan menjelaskan tindak lanjut setelah submit.',
      },
      {
        title: 'Menunjukkan Ganti Password Mandiri',
        instruction: 'Peserta diminta membuka halaman Profil Saya dan menunjukkan lokasi ganti password mandiri.',
        expectedEvidence: 'Peserta mampu menjelaskan beda ganti password mandiri dengan reset via email.',
      },
      {
        title: 'Mengelola Profil Dasar',
        instruction: 'Peserta diminta menunjukkan lokasi avatar dan kontak dasar pada halaman Profil Saya.',
        expectedEvidence: 'Peserta mampu menjelaskan data apa yang boleh diperbarui dan mengapa profil dasar penting.',
      },
    ],
    performanceChecklist: [
      'Mampu menunjukkan halaman pendaftaran akun bisnis.',
      'Mampu menjelaskan field wajib di halaman daftar akun.',
      'Mampu memilih tab Admin Bisnis dengan benar.',
      'Mampu menyebutkan data login Admin Bisnis.',
      'Mampu memilih tab Panel Staf dengan benar.',
      'Mampu menyebutkan data login Panel Staf.',
      'Mampu membuka halaman Lupa Password.',
      'Mampu menjelaskan alur reset password akun bisnis.',
      'Mampu menjelaskan perbedaan reset password dan ganti password mandiri.',
      'Mampu menunjukkan lokasi penggantian password di Profil Saya.',
      'Mampu menunjukkan lokasi avatar dan profil dasar.',
      'Mampu menjelaskan pentingnya data profil yang akurat.',
      'Mampu menjaga kerahasiaan password dan memilih jalur akses yang benar.',
    ],
    evidenceChecklist: [
      'Catatan observasi assessor atau trainer.',
      'Jawaban teori singkat peserta.',
      'Checklist unjuk kerja per lesson inti Level 1.',
      'Bukti bahwa peserta memahami lokasi Profil Saya dan fungsi keamanan akun dasar.',
    ],
    followUpGuidance: [
      'Jika belum kompeten, ulangi lesson yang masih lemah lalu jadwalkan remedial praktik.',
      'Jika peserta salah jalur login berulang, trainer wajib menegaskan kembali peran dan jenis akun peserta.',
      'Jika kompeten, peserta dapat lanjut ke onboarding organisasi atau course praktik berikutnya sesuai assignment.',
    ],
  },
]

export function getTrainingAssessmentByCourseSlug(courseSlug: string) {
  return TRAINING_ASSESSMENTS.find((assessment) => assessment.courseSlug === courseSlug) || null
}
