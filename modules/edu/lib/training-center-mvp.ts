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
    description: 'Pelatihan awal untuk mengenali jalur akses NIZAM: daftar akun, login admin bisnis, login panel staf, dan reset password.',
    audience: 'Pengguna baru, admin bisnis, staf',
    estimatedMinutes: 45,
    lessonCount: 4,
    status: 'LIVE',
    coverImage: '/docs/user-guide/umum/login-admin-bisnis.png',
    coverAlt: 'Tampilan login admin bisnis NIZAM',
    outcomes: [
      'Peserta memahami perbedaan jalur admin bisnis dan panel staf.',
      'Peserta mampu melakukan login sesuai peran.',
      'Peserta mampu melakukan reset password dasar.',
      'Peserta siap masuk ke tahap onboarding organisasi.',
    ],
    assessmentSummary: [
      'Review teori singkat tentang jalur akses.',
      'Latihan praktik login dan reset password.',
      'Status lulus diberikan setelah trainer menilai peserta sudah memahami alur dasar.',
    ],
    practiceHref: null,
  },
  {
    slug: 'orientasi-perusahaan-dasar',
    trackSlug: 'onboarding-sop',
    title: 'Level 0 · Orientasi Perusahaan',
    levelCode: 'L0',
    description: 'Pengantar budaya kerja, aturan akun, dan SOP dasar sebelum masuk ke sistem.',
    audience: 'Peserta baru',
    estimatedMinutes: 30,
    lessonCount: 3,
    status: 'SOON',
    coverImage: '/docs/user-guide/umum/daftar-akun.png',
    coverAlt: 'Preview materi orientasi perusahaan',
    outcomes: [
      'Memahami aturan dasar penggunaan akun.',
      'Memahami struktur pelatihan NIZAM.',
      'Siap masuk ke Level 1.',
    ],
    assessmentSummary: [
      'Review trainer internal.',
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
  const liveLessons = TRAINING_LESSONS.length

  return {
    totalTracks: TRAINING_TRACKS.length,
    liveTracks,
    totalCourses: TRAINING_COURSES.length,
    liveCourses,
    liveLessons,
    featuredCourse: getTrainingCourseBySlug('pengguna-umum-nizam'),
  }
}
