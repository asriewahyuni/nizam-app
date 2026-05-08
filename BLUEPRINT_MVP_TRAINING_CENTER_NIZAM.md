# Blueprint MVP Training Center NIZAM

Dokumen ini adalah rancangan `MVP Training Center` untuk NIZAM dengan pendekatan bertahap, aman, dan tidak membebani halaman utama ERP.

## 1. Tujuan MVP

MVP ini bertujuan untuk membuat pusat pelatihan berjenjang yang:

- punya pintu masuk yang jelas untuk semua peserta,
- mendukung materi belajar, latihan, dan penilaian,
- bisa dipakai untuk onboarding dan peningkatan kompetensi,
- memanfaatkan fondasi `learning` dan `edu` yang sudah ada,
- tidak membuat aplikasi utama menjadi berat.

## 2. Fondasi Yang Sudah Ada Di Codebase

Blueprint ini tidak mulai dari nol. NIZAM sudah punya fondasi yang bisa dipakai:

- [`app/(dashboard)/learning/page.tsx`](/Users/manbook/nizam-app/app/(dashboard)/learning/page.tsx:65)
  sebagai pintu masuk kompetensi dan learning dashboard.
- [`app/(dashboard)/settings/roles/page.tsx`](/Users/manbook/nizam-app/app/(dashboard)/settings/roles/page.tsx:93)
  sudah punya permission `learning:read` dan `learning:write`.
- [`lib/edu/training-simulation.ts`](/Users/manbook/nizam-app/lib/edu/training-simulation.ts:6)
  sudah punya phase, scoring, verification, dan struktur training board.
- [`modules/edu/lib/training.server.ts`](/Users/manbook/nizam-app/modules/edu/lib/training.server.ts:1)
  sudah punya pembacaan event, team, dan score.
- [`modules/edu/lib/competency-dashboard.ts`](/Users/manbook/nizam-app/modules/edu/lib/competency-dashboard.ts:1)
  sudah punya ringkasan progress dan phase summary.

Artinya, MVP paling aman adalah:

- `learning` dipakai untuk jalur belajar dan katalog,
- `edu` dipakai untuk simulasi atau praktik,
- modul dokumen yang sudah dibuat dipakai sebagai konten level awal.

## 3. Prinsip MVP

1. Jangan membuat LMS penuh di tahap pertama.
2. Pisahkan `belajar`, `praktik`, dan `penilaian` dengan rapi.
3. Gunakan halaman kecil per level atau per modul, bukan satu halaman panjang.
4. Materi awal cukup dari dokumen pengguna umum yang sudah dibuat.
5. Trainer masih boleh verifikasi manual di tahap pertama.
6. Hindari fitur rumit seperti sertifikat otomatis di fase awal.

## 4. Scope MVP

### Yang Masuk MVP

1. Home `Training Center`
2. Learning tracks
3. Level pelatihan dasar
4. Halaman kursus per level
5. Halaman lesson atau materi
6. Status progress peserta
7. Penilaian dasar
8. Jalur trainer atau admin learning
9. Integrasi ke board praktik `edu`

### Yang Belum Masuk MVP

1. Sertifikat otomatis
2. Jadwal kelas formal
3. Cohort kompleks
4. Reminder otomatis multi-channel
5. Gamification penuh
6. Analytics trainer tingkat lanjut
7. Video streaming internal
8. Subdomain atau deployment terpisah

## 5. Struktur Jenjang Pelatihan

Struktur paling aman untuk MVP:

### Level 0. Orientasi

Isi:

- pengenalan perusahaan,
- aturan penggunaan akun,
- SOP dasar,
- keamanan akses.

### Level 1. Pengguna Umum NIZAM

Isi:

- daftar akun,
- login,
- panel staf,
- lupa password,
- alur awal masuk sistem.

Konten awal level ini sudah tersedia dari dokumen berikut:

- [MODUL_PENGGUNA_NIZAM_UMUM_BNSP.md](/Users/manbook/nizam-app/MODUL_PENGGUNA_NIZAM_UMUM_BNSP.md:1)
- [BUKU_INFORMASI_PENGGUNA_NIZAM_UMUM.md](/Users/manbook/nizam-app/BUKU_INFORMASI_PENGGUNA_NIZAM_UMUM.md:1)
- [BUKU_KERJA_PENGGUNA_NIZAM_UMUM.md](/Users/manbook/nizam-app/BUKU_KERJA_PENGGUNA_NIZAM_UMUM.md:1)
- [BUKU_PENILAIAN_PENGGUNA_NIZAM_UMUM.md](/Users/manbook/nizam-app/BUKU_PENILAIAN_PENGGUNA_NIZAM_UMUM.md:1)

### Level 2. Operasional Per Divisi

Isi awal yang direkomendasikan:

- Sales
- Inventory
- Purchasing
- Accounting
- HRIS

### Level 3. Supervisor dan Compliance

Isi:

- approval,
- audit trail,
- kontrol proses,
- review data,
- disiplin operasional.

## 6. Learning Tracks MVP

Struktur learning tracks yang cocok dengan halaman `learning` saat ini:

1. `Onboarding & SOP`
2. `Operasional Harian`
3. `Leadership & Compliance`

Itu sudah selaras dengan struktur yang muncul di [`app/(dashboard)/learning/page.tsx`](/Users/manbook/nizam-app/app/(dashboard)/learning/page.tsx:20).

## 7. Struktur Halaman Yang Direkomendasikan

Supaya ringan dan mudah dikembangkan, struktur route MVP sebaiknya seperti ini:

1. `/learning`
2. `/learning/track/[trackSlug]`
3. `/learning/course/[courseSlug]`
4. `/learning/course/[courseSlug]/lesson/[lessonSlug]`
5. `/learning/my-progress`
6. `/learning/admin`
7. `/edu`

Fungsi tiap halaman:

### `/learning`

- halaman utama Training Center,
- katalog jalur belajar,
- ringkasan progress,
- CTA ke modul aktif.

### `/learning/track/[trackSlug]`

- daftar level atau course dalam satu track,
- urutan belajar,
- status lock atau unlock.

### `/learning/course/[courseSlug]`

- overview course,
- tujuan belajar,
- daftar lesson,
- syarat lulus,
- tombol mulai.

### `/learning/course/[courseSlug]/lesson/[lessonSlug]`

- materi belajar,
- screenshot,
- checklist,
- quiz atau tugas.

### `/learning/my-progress`

- daftar course peserta,
- status belum mulai, berjalan, lulus,
- skor dan progres.

### `/learning/admin`

- untuk trainer atau admin learning,
- lihat peserta,
- verifikasi progres,
- lihat hasil penilaian.

### `/edu`

- dipakai untuk simulasi praktik atau board latihan yang sudah ada.

## 8. Role MVP

Role minimal yang direkomendasikan:

1. `Peserta`
2. `Trainer`
3. `Owner/Admin Learning`

### Peserta

- melihat course,
- membuka lesson,
- mengerjakan tugas,
- melihat progress pribadi.

### Trainer

- melihat peserta,
- memverifikasi tugas,
- memberi catatan,
- melihat hasil praktik.

### Owner/Admin Learning

- mengelola track,
- mengelola course,
- mengelola akses,
- melihat rekap pelatihan.

## 9. Model Data Minimum

Untuk MVP, data baru tidak perlu terlalu banyak. Struktur minimal yang direkomendasikan:

1. `learning_tracks`
2. `learning_courses`
3. `learning_lessons`
4. `learning_enrollments`
5. `learning_lesson_progress`
6. `learning_assessments`

### learning_tracks

Contoh field:

- id
- slug
- title
- description
- sort_order
- is_active

### learning_courses

Contoh field:

- id
- track_id
- slug
- title
- description
- level_code
- passing_score
- practical_event_slug
- is_active

### learning_lessons

Contoh field:

- id
- course_id
- slug
- title
- content_md
- media_items
- lesson_type
- sort_order
- is_required

### learning_enrollments

Contoh field:

- id
- user_id
- course_id
- status
- started_at
- completed_at
- final_score

### learning_lesson_progress

Contoh field:

- id
- enrollment_id
- lesson_id
- status
- viewed_at
- submitted_at

### learning_assessments

Contoh field:

- id
- enrollment_id
- assessment_type
- score
- passed
- reviewer_id
- notes

## 10. Konten MVP

Konten awal tidak perlu menunggu semuanya selesai. Gunakan yang sudah ada:

### Konten Siap Pakai Sekarang

1. modul pengguna umum yang sudah dibuat,
2. screenshot login dan akses awal,
3. board training existing di `edu`,
4. struktur phase dari `training-simulation`.

### Konten Tahap Berikutnya

1. onboarding organisasi,
2. dashboard umum,
3. sales dasar,
4. inventory dasar,
5. accounting dasar.

## 11. Alur Belajar MVP

Alur peserta:

1. buka `Training Center`,
2. pilih track,
3. buka course,
4. baca materi,
5. kerjakan buku kerja,
6. jawab penilaian dasar,
7. jika course punya praktik, lanjut ke `edu`,
8. trainer verifikasi,
9. status course berubah menjadi `Lulus` atau `Perlu Perbaikan`.

## 12. Alur Verifikasi MVP

Karena ini MVP, verifikasi tidak perlu otomatis penuh.

Alur yang disarankan:

1. peserta menyelesaikan lesson,
2. peserta mengerjakan quiz atau tugas,
3. trainer mengecek hasil,
4. jika perlu praktik, trainer cek hasil di board `edu`,
5. trainer memberi status `Lulus` atau `Perlu Ulang`.

## 13. Progress dan Status

Status minimum yang cukup untuk MVP:

- `Belum Mulai`
- `Sedang Belajar`
- `Menunggu Review`
- `Lulus`
- `Perlu Ulang`

## 14. Integrasi Dengan EDU

Daripada membuat engine praktik baru, pakai `edu` sebagai mesin praktik.

Contohnya:

- course `Operasional Harian Dasar` bisa punya `practical_event_slug`,
- saat peserta masuk ke praktik, sistem arahkan ke board `edu`,
- trainer menilai hasil berdasarkan score dan verification yang sudah ada.

Ini cocok dengan fondasi di:

- [`modules/edu/lib/training.server.ts`](/Users/manbook/nizam-app/modules/edu/lib/training.server.ts:1)
- [`lib/edu/training-simulation.ts`](/Users/manbook/nizam-app/lib/edu/training-simulation.ts:63)

## 15. Guardrail Performa

Agar Training Center tidak berat:

1. home hanya menampilkan ringkasan dan katalog,
2. lesson dipisah per URL,
3. screenshot hanya dimuat di lesson terkait,
4. gambar dioptimasi ke WebP atau AVIF saat fase berikutnya,
5. hindari satu halaman memuat semua materi dan semua level sekaligus.

## 16. MVP Yang Direkomendasikan Untuk Dibangun Dulu

Urutan implementasi paling aman:

### Fase 1

1. upgrade `/learning` menjadi home Training Center,
2. tambahkan data statis atau seed untuk track dan course,
3. masukkan `Level 1 Pengguna Umum NIZAM`.

### Fase 2

1. buat halaman course,
2. buat halaman lesson,
3. tampilkan materi dari dokumen yang sudah ada,
4. simpan progress lesson.

### Fase 3

1. buat penilaian dasar,
2. buat halaman progress pribadi,
3. sambungkan ke praktik `edu`.

### Fase 4

1. buat halaman admin atau trainer,
2. buat review hasil peserta,
3. buat status lulus dan remedial.

## 17. Prioritas Implementasi Teknis

Jika harus memilih yang paling bernilai untuk tahap pertama, urutannya:

1. route dan UI `Training Center`
2. model data track-course-lesson
3. lesson viewer
4. progress tracking
5. penilaian dasar
6. trainer review

## 18. Ukuran MVP

Kalau dibuat bertahap, ini termasuk `sedang`, bukan `terlalu berat`.

Perkiraan level kompleksitas:

- home dan katalog: rendah
- course dan lesson: rendah sampai sedang
- progress tracking: sedang
- penilaian dan review trainer: sedang
- sertifikat otomatis dan cohort: tinggi

## 19. Keputusan Arsitektur Yang Direkomendasikan

Untuk saat ini:

- tetap di route `/learning`,
- jangan pindah ke subdomain dulu,
- gunakan fondasi `edu` yang sudah ada,
- fokus ke MVP berfungsi dulu.

Alasan:

- lebih cepat dibangun,
- auth dan role lebih sederhana,
- lebih aman untuk iterasi awal,
- performa tetap bisa dijaga jika route dan lesson dipisah dengan benar.

## 20. Kesimpulan

MVP Training Center NIZAM paling tepat dibangun sebagai:

- `portal belajar` di `/learning`,
- `konten berjenjang` berbasis track dan level,
- `praktik` memanfaatkan `/edu`,
- `penilaian` sederhana dengan review trainer,
- `Level 1 Pengguna Umum` sebagai course pertama.

Dengan pola ini, NIZAM bisa segera punya Training Center yang nyata tanpa harus langsung membangun LMS besar dari nol.

## 21. Referensi Skema Akses

Untuk skema role, login trainee, login assessor, dan admin learning, gunakan dokumen berikut:

- [SKEMA_ROLE_DAN_LOGIN_TRAINING_CENTER_MVP.md](/Users/manbook/nizam-app/SKEMA_ROLE_DAN_LOGIN_TRAINING_CENTER_MVP.md:1)
