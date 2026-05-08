export type TrainingTrackStatus = 'LIVE' | 'SOON'
export type TrainingCourseStatus = 'LIVE' | 'SOON'

export type TrainingTrackSeed = {
  slug: string
  title: string
  shortLabel: string
  description: string
  audience: string
  status: TrainingTrackStatus
}

export type TrainingCourseSeed = {
  slug: string
  trackSlug: string
  title: string
  levelCode: string
  description: string
  audience: string
  estimatedMinutes: number
  lessonCount: number
  status: TrainingCourseStatus
  coverImage: string
  coverAlt: string
  outcomes: string[]
  assessmentSummary: string[]
  practiceHref?: string | null
}

export type TrainingLessonSeed = {
  slug: string
  courseSlug: string
  title: string
  order: number
  estimatedMinutes: number
  summary: string
  screenshot: string
  screenshotAlt: string
  objectives: string[]
  steps: string[]
  checks: string[]
  commonMistakes: string[]
  actionHref?: string | null
  actionLabel?: string | null
}

export const TRAINING_TRACKS: TrainingTrackSeed[] = [
  {
    slug: 'onboarding-sop',
    title: 'Onboarding & SOP',
    shortLabel: 'Level Awal',
    description: 'Materi pengenalan perusahaan, akses awal, SOP dasar, dan kebiasaan kerja aman untuk anggota baru.',
    audience: 'Peserta baru, admin bisnis, staf baru',
    status: 'LIVE',
  },
  {
    slug: 'operasional-harian',
    title: 'Operasional Harian',
    shortLabel: 'Segera Menyusul',
    description: 'Latihan transaksi dasar lintas modul seperti sales, inventory, purchasing, cash, dan approval kerja.',
    audience: 'Operator harian, admin divisi, PIC cabang',
    status: 'SOON',
  },
  {
    slug: 'leadership-compliance',
    title: 'Leadership & Compliance',
    shortLabel: 'Segera Menyusul',
    description: 'Penguatan kompetensi supervisor, kontrol proses, audit internal, dan disiplin operasional.',
    audience: 'Supervisor, leader, owner, auditor internal',
    status: 'SOON',
  },
]

export const TRAINING_COURSES: TrainingCourseSeed[] = [
  {
    slug: 'pengguna-umum-nizam',
    trackSlug: 'onboarding-sop',
    title: 'Level 1 · Pengguna Umum NIZAM',
    levelCode: 'L1',
    description: 'Pelatihan awal untuk mengenali jalur akses NIZAM: daftar akun, login admin bisnis, login panel staf, reset password, ganti password mandiri, dan kelola profil dasar.',
    audience: 'Pengguna baru, admin bisnis, staf',
    estimatedMinutes: 65,
    lessonCount: 6,
    status: 'LIVE',
    coverImage: '/docs/user-guide/umum/login-admin-bisnis.png',
    coverAlt: 'Tampilan login admin bisnis NIZAM',
    outcomes: [
      'Peserta memahami perbedaan jalur admin bisnis dan panel staf.',
      'Peserta mampu melakukan login sesuai peran.',
      'Peserta mampu melakukan reset password dasar.',
      'Peserta mampu mengganti password mandiri sesudah berhasil masuk.',
      'Peserta mampu memperbarui avatar dan profil dasar di halaman Profil Saya.',
      'Peserta siap masuk ke tahap onboarding organisasi.',
    ],
    assessmentSummary: [
      'Review teori singkat tentang jalur akses.',
      'Latihan praktik login, reset password, dan ganti password mandiri.',
      'Verifikasi bahwa peserta mampu membuka halaman Profil Saya dan memahami fungsi avatar.',
      'Status lulus diberikan setelah trainer menilai peserta sudah memahami alur dasar.',
    ],
    practiceHref: null,
  },
  {
    slug: 'orientasi-perusahaan-dasar',
    trackSlug: 'onboarding-sop',
    title: 'Level 0 · Orientasi Perusahaan',
    levelCode: 'L0',
    description: 'Orientasi awal tentang jalur akses NIZAM, aturan akun, keamanan dasar, dan urutan belajar sebelum peserta masuk ke sistem.',
    audience: 'Peserta baru, staf baru, trainer onboarding',
    estimatedMinutes: 35,
    lessonCount: 3,
    status: 'LIVE',
    coverImage: '/docs/user-guide/umum/daftar-akun.png',
    coverAlt: 'Preview materi orientasi perusahaan NIZAM',
    outcomes: [
      'Memahami perbedaan akun bisnis dan akses staf sebelum mulai login.',
      'Memahami aturan dasar keamanan akun dan kebiasaan kerja yang aman.',
      'Memahami urutan belajar dari Level 0 ke Level 1.',
      'Siap masuk ke pelatihan login dan akses dasar pada Level 1.',
    ],
    assessmentSummary: [
      'Review pemahaman peserta tentang jalur akses dan peran pengguna.',
      'Checklist keamanan akun dasar dan kebiasaan kerja aman.',
      'Verifikasi trainer bahwa peserta siap lanjut ke Level 1.',
    ],
    practiceHref: null,
  },
  {
    slug: 'operasional-harian-dasar',
    trackSlug: 'operasional-harian',
    title: 'Level 2 · Operasional Harian Dasar',
    levelCode: 'L2',
    description: 'Latihan dasar transaksi harian dengan praktik di board EDU.',
    audience: 'Admin divisi, operator',
    estimatedMinutes: 90,
    lessonCount: 6,
    status: 'SOON',
    coverImage: '/docs/user-guide/umum/login-panel-staf.png',
    coverAlt: 'Preview course operasional harian',
    outcomes: [
      'Mampu menjalankan alur kerja dasar lintas modul.',
      'Mampu menunjukkan bukti transaksi berubah.',
    ],
    assessmentSummary: [
      'Praktik di board EDU.',
      'Review trainer.',
    ],
    practiceHref: '/edu',
  },
  {
    slug: 'supervisor-compliance-dasar',
    trackSlug: 'leadership-compliance',
    title: 'Level 3 · Supervisor & Compliance Dasar',
    levelCode: 'L3',
    description: 'Pemahaman approval, audit trail, dan kontrol proses untuk leader.',
    audience: 'Supervisor, owner, admin utama',
    estimatedMinutes: 75,
    lessonCount: 5,
    status: 'SOON',
    coverImage: '/docs/user-guide/umum/lupa-password.png',
    coverAlt: 'Preview course supervisor dan compliance',
    outcomes: [
      'Mampu melakukan review proses dasar.',
      'Mampu menindaklanjuti temuan kontrol.',
    ],
    assessmentSummary: [
      'Quiz singkat.',
      'Review trainer.',
    ],
    practiceHref: null,
  },
]

export const TRAINING_LESSONS: TrainingLessonSeed[] = [
  {
    slug: 'mengenal-jalur-akses-nizam',
    courseSlug: 'orientasi-perusahaan-dasar',
    title: 'Mengenal Jalur Akses NIZAM',
    order: 1,
    estimatedMinutes: 10,
    summary: 'Peserta memahami bahwa NIZAM punya jalur akses berbeda untuk admin bisnis dan staf, sehingga tidak semua orang masuk dari halaman yang sama.',
    screenshot: '/docs/user-guide/umum/daftar-akun.png',
    screenshotAlt: 'Halaman daftar akun bisnis sebagai pengantar jalur akses NIZAM',
    objectives: [
      'Memahami siapa yang membuat akun bisnis dan siapa yang masuk sebagai staf.',
      'Mengenali bahwa jalur onboarding dimulai dari orientasi, bukan langsung praktik transaksi.',
      'Mengetahui perbedaan identitas email bisnis dan identitas staf internal.',
    ],
    steps: [
      'Lihat halaman awal akses NIZAM dan kenali bahwa akun bisnis dipakai oleh pemilik atau admin utama.',
      'Pahami bahwa staf internal tidak dibuat dari halaman daftar akun bisnis.',
      'Catat perbedaan identitas yang dipakai admin bisnis dan staf sebelum lanjut ke halaman login.',
      'Pastikan peserta tahu jalur mana yang akan dipakai sesuai perannya di perusahaan.',
    ],
    checks: [
      'Peserta memahami bahwa akun bisnis dan akun staf memiliki jalur berbeda.',
      'Peserta dapat menjelaskan siapa yang memakai email bisnis.',
      'Peserta dapat menjelaskan siapa yang memakai identitas staf atau NIK.',
      'Peserta paham bahwa orientasi harus selesai sebelum masuk ke pelatihan login.',
    ],
    commonMistakes: [
      'Menganggap semua pengguna harus mendaftar akun bisnis terlebih dahulu.',
      'Tidak membedakan akun owner atau admin dengan akun staf.',
      'Masuk ke pelatihan operasional tanpa memahami jalur akses yang benar.',
    ],
  },
  {
    slug: 'aturan-akun-dan-keamanan-dasar',
    courseSlug: 'orientasi-perusahaan-dasar',
    title: 'Aturan Akun Dan Keamanan Dasar',
    order: 2,
    estimatedMinutes: 10,
    summary: 'Peserta memahami aturan dasar penggunaan akun: identitas tidak dipinjamkan, sandi dijaga, dan jalur login harus dipilih sesuai peran.',
    screenshot: '/docs/user-guide/umum/login-admin-bisnis.png',
    screenshotAlt: 'Halaman login admin bisnis untuk penjelasan aturan akun dan keamanan dasar',
    objectives: [
      'Memahami pentingnya menjaga kerahasiaan sandi.',
      'Memahami bahwa satu akun mewakili satu identitas kerja yang harus jelas.',
      'Mengetahui kapan peserta harus meminta bantuan trainer atau admin internal.',
    ],
    steps: [
      'Perhatikan halaman login dan pahami bahwa akun NIZAM adalah identitas kerja resmi.',
      'Gunakan kredensial milik sendiri dan jangan berbagi sandi dengan rekan lain.',
      'Pilih jalur login yang sesuai peran agar audit dan akses tetap benar.',
      'Jika ada kendala akses, hubungi trainer, assessor, atau admin internal sebelum mencoba jalur yang salah.',
    ],
    checks: [
      'Peserta paham bahwa sandi tidak boleh dibagikan.',
      'Peserta paham bahwa akun dipakai sesuai identitas masing-masing.',
      'Peserta tahu bahwa salah jalur login dapat menimbulkan kebingungan akses.',
      'Peserta tahu harus eskalasi ke pihak yang tepat jika ada masalah akun.',
    ],
    commonMistakes: [
      'Meminjam akun rekan kerja agar lebih cepat masuk.',
      'Mencoba login di jalur yang salah berkali-kali tanpa klarifikasi.',
      'Menyimpan sandi di tempat yang mudah dibaca orang lain.',
    ],
  },
  {
    slug: 'alur-belajar-sebelum-masuk-sistem',
    courseSlug: 'orientasi-perusahaan-dasar',
    title: 'Alur Belajar Sebelum Masuk Sistem',
    order: 3,
    estimatedMinutes: 15,
    summary: 'Peserta memahami urutan onboarding yang benar: orientasi, penentuan jalur akses, pelatihan login, lalu praktik bertahap di modul berikutnya.',
    screenshot: '/docs/user-guide/umum/login-panel-staf.png',
    screenshotAlt: 'Halaman login panel staf untuk menjelaskan alur belajar sebelum masuk sistem',
    objectives: [
      'Memahami bahwa onboarding dilakukan bertahap dan tidak dilompati.',
      'Mengetahui bahwa Level 1 fokus pada login dan akses dasar.',
      'Siap melanjutkan ke pelatihan praktis dengan ekspektasi yang lebih jelas.',
    ],
    steps: [
      'Selesaikan seluruh lesson orientasi di Level 0 sampai peserta memahami jalur akses dan aturan akun.',
      'Lanjutkan ke Level 1 untuk mempelajari login admin bisnis, panel staf, dan reset password.',
      'Ikuti checklist lesson satu per satu dan minta verifikasi trainer jika dibutuhkan.',
      'Masuk ke board EDU atau modul praktik hanya setelah fondasi akses dasar sudah dipahami.',
    ],
    checks: [
      'Peserta tahu bahwa Level 0 mendahului Level 1.',
      'Peserta paham bahwa Level 1 adalah pelatihan akses dasar, bukan orientasi umum.',
      'Peserta tahu kapan harus lanjut ke board praktik.',
      'Peserta siap mengikuti alur belajar berjenjang tanpa melompati tahap dasar.',
    ],
    commonMistakes: [
      'Langsung mencoba praktik operasional tanpa memahami akses dasar.',
      'Menganggap orientasi hanya formalitas dan bisa dilewati.',
      'Tidak mencatat urutan belajar sehingga bingung saat pindah ke course berikutnya.',
    ],
  },
  {
    slug: 'daftar-akun-bisnis',
    courseSlug: 'pengguna-umum-nizam',
    title: 'Daftar Akun Bisnis',
    order: 1,
    estimatedMinutes: 10,
    summary: 'Peserta mengenali halaman daftar akun bisnis dan field wajib yang harus diisi dengan benar.',
    screenshot: '/docs/user-guide/umum/daftar-akun.png',
    screenshotAlt: 'Halaman daftar akun bisnis NIZAM',
    objectives: [
      'Mengetahui kapan pengguna perlu mendaftar akun baru.',
      'Memahami field utama yang wajib diisi.',
      'Menghindari kesalahan data sejak awal.',
    ],
    steps: [
      'Buka halaman register akun bisnis.',
      'Isi nama lengkap pemilik.',
      'Isi email bisnis yang aktif dan dapat diakses.',
      'Buat password minimal 8 karakter.',
      'Klik tombol pendaftaran untuk melanjutkan.',
    ],
    checks: [
      'Nama pemilik terisi.',
      'Email bisnis valid.',
      'Password sudah dibuat.',
      'Peserta paham bahwa email dipakai untuk akses dan reset password.',
    ],
    commonMistakes: [
      'Mengisi email yang tidak aktif.',
      'Menganggap akun staf dibuat dari halaman ini.',
      'Melewatkan validasi password.',
    ],
  },
  {
    slug: 'login-admin-bisnis',
    courseSlug: 'pengguna-umum-nizam',
    title: 'Login Admin Bisnis',
    order: 2,
    estimatedMinutes: 10,
    summary: 'Peserta memahami jalur login untuk pemilik bisnis atau admin utama.',
    screenshot: '/docs/user-guide/umum/login-admin-bisnis.png',
    screenshotAlt: 'Halaman login admin bisnis NIZAM',
    objectives: [
      'Mampu membedakan tab admin bisnis dan panel staf.',
      'Mampu mengisi email dan password dengan benar.',
      'Mampu menjelaskan kapan jalur ini digunakan.',
    ],
    steps: [
      'Buka halaman login.',
      'Pastikan tab Admin Bisnis aktif.',
      'Isi email bisnis.',
      'Isi sandi keamanan.',
      'Klik Inisialisasi Kendali.',
    ],
    checks: [
      'Peserta memilih tab yang benar.',
      'Peserta tahu bahwa jalur ini bukan untuk staf.',
      'Peserta mengenali tombol lupa sandi.',
    ],
    commonMistakes: [
      'Salah memilih tab panel staf.',
      'Menggunakan identitas karyawan di jalur admin bisnis.',
      'Tidak mengecek email bisnis yang dipakai.',
    ],
  },
  {
    slug: 'login-panel-staf',
    courseSlug: 'pengguna-umum-nizam',
    title: 'Login Panel Staf',
    order: 3,
    estimatedMinutes: 10,
    summary: 'Peserta memahami jalur login khusus staf dan operator internal.',
    screenshot: '/docs/user-guide/umum/login-panel-staf.png',
    screenshotAlt: 'Halaman login panel staf NIZAM',
    objectives: [
      'Memahami bahwa staf masuk lewat panel staf.',
      'Mengenali penggunaan nomor induk atau identitas karyawan.',
      'Mampu membedakan otorisasi staf dan admin bisnis.',
    ],
    steps: [
      'Buka halaman login.',
      'Pilih tab Panel Staf.',
      'Isi nomor induk karyawan.',
      'Isi sandi otorisasi.',
      'Klik Akses Platform.',
    ],
    checks: [
      'Peserta memilih panel staf.',
      'Peserta mengerti data yang harus digunakan.',
      'Peserta memahami bahwa role staf berbeda dengan admin.',
    ],
    commonMistakes: [
      'Masuk dengan email bisnis di panel staf.',
      'Menganggap semua user masuk lewat tab yang sama.',
      'Tidak paham perbedaan NIK dan email bisnis.',
    ],
  },
  {
    slug: 'reset-password-akun-bisnis',
    courseSlug: 'pengguna-umum-nizam',
    title: 'Reset Password Akun Bisnis',
    order: 4,
    estimatedMinutes: 15,
    summary: 'Peserta memahami alur dasar pemulihan password akun bisnis melalui email terdaftar.',
    screenshot: '/docs/user-guide/umum/lupa-password.png',
    screenshotAlt: 'Halaman lupa password NIZAM',
    objectives: [
      'Mengenali kapan fitur lupa password dipakai.',
      'Mampu mengisi email terdaftar.',
      'Memahami tindak lanjut sesudah reset diminta.',
    ],
    steps: [
      'Buka halaman lupa password.',
      'Isi alamat email yang terdaftar di akun bisnis.',
      'Klik Kirim Link Reset.',
      'Periksa inbox email.',
      'Ikuti instruksi reset password.',
    ],
    checks: [
      'Peserta memakai email yang benar.',
      'Peserta tahu harus mengecek inbox atau spam.',
      'Peserta memahami bahwa proses ini untuk akun bisnis.',
    ],
    commonMistakes: [
      'Memakai email yang tidak terdaftar.',
      'Mengira reset staf selalu sama dengan reset akun bisnis.',
      'Tidak memeriksa inbox setelah mengirim permintaan.',
    ],
  },
  {
    slug: 'ganti-password-pertama',
    courseSlug: 'pengguna-umum-nizam',
    title: 'Ganti Password Pertama',
    order: 5,
    estimatedMinutes: 10,
    summary: 'Peserta memahami bahwa setelah berhasil masuk, password kerja sebaiknya segera diganti melalui menu profil agar keamanan akun tetap terjaga.',
    screenshot: '/docs/user-guide/umum/profil-saya-keamanan.png',
    screenshotAlt: 'Bagian keamanan akun di halaman Profil Saya NIZAM',
    objectives: [
      'Memahami beda antara reset password dan ganti password mandiri.',
      'Mengetahui bahwa penggantian password pertama adalah langkah keamanan awal.',
      'Mampu membuka halaman Profil Saya untuk mengelola keamanan akun sendiri.',
    ],
    steps: [
      'Login ke NIZAM dengan akun yang sudah aktif.',
      'Buka menu Profil Saya dari area dashboard.',
      'Masuk ke bagian keamanan akun atau ubah password mandiri.',
      'Isi password baru yang aman dan konfirmasi password dengan benar.',
      'Simpan perubahan lalu gunakan password baru untuk login berikutnya.',
    ],
    checks: [
      'Peserta tahu bahwa password awal sebaiknya tidak dipakai terlalu lama.',
      'Peserta memahami bahwa ganti password mandiri berbeda dari reset via email.',
      'Peserta tahu lokasi fitur perubahan password di Profil Saya.',
      'Peserta mampu menjelaskan ciri password yang lebih aman.',
    ],
    commonMistakes: [
      'Menganggap reset password email sama dengan ganti password mandiri setelah login.',
      'Memakai password yang terlalu pendek atau mudah ditebak.',
      'Lupa mencatat atau mengingat password baru secara aman.',
    ],
    actionHref: '/profil-saya',
    actionLabel: 'Buka Profil Saya',
  },
  {
    slug: 'kelola-avatar-dan-profil-dasar',
    courseSlug: 'pengguna-umum-nizam',
    title: 'Kelola Avatar Dan Profil Dasar',
    order: 6,
    estimatedMinutes: 10,
    summary: 'Peserta memahami fungsi halaman Profil Saya untuk memperbarui avatar, nomor WhatsApp, dan identitas dasar agar komunikasi internal lebih rapi.',
    screenshot: '/docs/user-guide/umum/profil-saya-identitas.png',
    screenshotAlt: 'Bagian identitas dan kontak di halaman Profil Saya NIZAM',
    objectives: [
      'Mengetahui bahwa avatar dan kontak dasar dapat diperbarui sendiri.',
      'Memahami fungsi profil untuk identitas kerja internal.',
      'Mampu membuka halaman Profil Saya dan mengenali bagian avatar serta kontak.',
    ],
    steps: [
      'Masuk ke dashboard NIZAM menggunakan akun yang sesuai.',
      'Buka menu Profil Saya.',
      'Pilih area avatar untuk mengganti foto profil bila diperlukan.',
      'Perbarui nomor WhatsApp atau data kontak dasar yang relevan.',
      'Simpan profil dan pastikan perubahan berhasil diterapkan.',
    ],
    checks: [
      'Peserta tahu lokasi halaman Profil Saya.',
      'Peserta memahami bahwa avatar membantu identifikasi pengguna internal.',
      'Peserta tahu data kontak mana yang boleh diperbarui mandiri.',
      'Peserta memahami pentingnya menyimpan data profil yang akurat.',
    ],
    commonMistakes: [
      'Mengunggah foto yang tidak relevan atau sulit dikenali.',
      'Mengubah data tanpa menyimpan perubahan.',
      'Menganggap pembaruan profil tidak penting bagi penggunaan harian.',
    ],
    actionHref: '/profil-saya',
    actionLabel: 'Kelola Profil Saya',
  },
]

export function getTrainingTrackBySlug(trackSlug: string) {
  return TRAINING_TRACKS.find((track) => track.slug === trackSlug) || null
}

export function getTrainingCourseBySlug(courseSlug: string) {
  return TRAINING_COURSES.find((course) => course.slug === courseSlug) || null
}

export function getTrainingLessonBySlug(courseSlug: string, lessonSlug: string) {
  return TRAINING_LESSONS.find((lesson) => lesson.courseSlug === courseSlug && lesson.slug === lessonSlug) || null
}

export function getTrainingCoursesForTrack(trackSlug: string) {
  return TRAINING_COURSES
    .filter((course) => course.trackSlug === trackSlug)
    .sort((left, right) => left.levelCode.localeCompare(right.levelCode))
}

export function getTrainingLessonsForCourse(courseSlug: string) {
  return TRAINING_LESSONS
    .filter((lesson) => lesson.courseSlug === courseSlug)
    .sort((left, right) => left.order - right.order)
}

export function getTrainingCenterSummary() {
  const liveTracks = TRAINING_TRACKS.filter((track) => track.status === 'LIVE').length
  const liveCourses = TRAINING_COURSES.filter((course) => course.status === 'LIVE').length
  const liveCourseSlugs = new Set(
    TRAINING_COURSES
      .filter((course) => course.status === 'LIVE')
      .map((course) => course.slug),
  )
  const liveLessons = TRAINING_LESSONS.filter((lesson) => liveCourseSlugs.has(lesson.courseSlug)).length
  const featuredCourse = getTrainingCoursesForTrack('onboarding-sop').find((course) => course.status === 'LIVE')
    || TRAINING_COURSES.find((course) => course.status === 'LIVE')
    || null

  return {
    totalTracks: TRAINING_TRACKS.length,
    liveTracks,
    totalCourses: TRAINING_COURSES.length,
    liveCourses,
    liveLessons,
    featuredCourse,
  }
}
