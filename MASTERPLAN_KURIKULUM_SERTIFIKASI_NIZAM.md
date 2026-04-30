# Masterplan Kurikulum Sertifikasi NIZAM

## Status Dokumen

- Versi: `0.2`
- Tanggal: `26 April 2026`
- Tujuan: `merumuskan peta alur NIZAM, kelebihan-kekurangan, dan masterplan kurikulum sertifikasi berjenjang untuk seluruh pihak di environment NIZAM`
- Gaya acuan: `vendor-style certification framework`, dengan pendekatan berjenjang seperti Cisco tetapi disesuaikan dengan realitas produk NIZAM

## Basis Analisis

Dokumen ini disusun dari pembacaan implementasi dan dokumen yang sudah ada di repo, terutama:

- `app/page.tsx`
- `app/(auth)/login/page.tsx`
- `app/onboarding/page.tsx`
- `app/(dashboard)/layout.tsx`
- `components/shared/AppSidebar.tsx`
- `app/(dashboard)/learning/page.tsx`
- `modules/edu/lib/training-center-mvp.ts`
- `modules/edu/lib/training.server.ts`
- `modules/edu/lib/training-assessment.server.ts`
- `modules/edu/actions/training-assessment.actions.ts`
- `app/edu/page.tsx`
- `DOKUMENTASI_EDU_MODE_REALTIME_NIZAM.md`
- `PLAYBOOK_MIGRASI_KE_NIZAM.md`
- `PANDUAN_ADMIN_SAAS_NIZAM.md`

---

## 1. Ringkasan Eksekutif

NIZAM sudah memiliki fondasi yang sangat kuat untuk dibangun menjadi ekosistem sertifikasi internal maupun eksternal karena:

1. produk utamanya sudah luas dan end-to-end,
2. kontrol akses, role, branch, dan module gating sudah nyata,
3. learning center dan assessment sudah mulai hidup,
4. simulasi praktik di dashboard asli melalui `EDU Mode` sudah tersedia sebagai pembeda yang sangat kuat,
5. dokumen onboarding, buku kerja, buku informasi, dan buku penilaian sudah mulai terbentuk.

Artinya, NIZAM tidak perlu memulai program sertifikasi dari nol. Yang dibutuhkan adalah:

1. merapikan arsitektur jenjang sertifikasi,
2. memetakan siapa belajar apa,
3. membakukan standar asesmen,
4. mengubah dokumen dan flow yang sudah ada menjadi jalur sertifikasi yang konsisten,
5. menambahkan governance sertifikasi, badge, recertification, dan dashboard operasional training.

---

## 2. Peta Alur NIZAM Saat Ini

Secara produk, alur NIZAM saat ini bisa dibaca sebagai rantai berikut:

`Publik -> Login -> Onboarding Org -> Dashboard Terkontrol -> Setup Awal -> Operasional Harian -> Kontrol & Insight -> Learning/Assessment -> Integrasi/Migrasi`

### 2.1 Ringkasan Alur

| Tahap | Implementasi saat ini | Implikasi ke kurikulum |
|---|---|---|
| Akses awal | Root `/` mengarahkan user ke `login`, `onboarding`, atau `dashboard` tergantung sesi dan organisasi aktif | Level dasar wajib mengajarkan alur masuk sistem, bukan langsung transaksi |
| Login | Ada 2 jalur: `Admin Bisnis` via email dan `Panel Staf` via NIK | Kurikulum harus membedakan jalur owner/admin dan jalur staf sejak awal |
| Onboarding | User yang belum punya organisasi masuk ke setup perusahaan | Sertifikasi dasar untuk admin bisnis wajib memuat aktivasi tenant, bukan hanya login |
| Guard dashboard | Sistem memeriksa org aktif, subscription, demo status, branch context, module access, dan RBAC | Sertifikasi supervisor/admin wajib mengajarkan governance akses, bukan cuma klik menu |
| Setup hari pertama | Ada flow bisnis, cabang, role, user, kas/bank, master data, dan startup wizard | Perlu jalur khusus `Business Admin / Implementation Admin` |
| Operasional harian | Modul luas: finance, sales, purchasing, inventory, POS, HRIS, factory, fleet, services, construction, syirkah | Jalur sertifikasi harus role-based dan modular, tidak boleh satu sertifikat untuk semua |
| Kontrol dan compliance | Ada audit, approval, reports, BSC, closing, forecast, audit trail | Perlu jenjang supervisor, compliance, dan internal auditor |
| Learning | Sudah ada `/learning` dengan track, course, lesson, progress, dan halaman assesment peserta serta assessor | Program sertifikasi bisa langsung ditanam ke learning center yang sudah ada |
| Simulasi praktik | `/edu` dan `EDU Mode` memungkinkan praktik di dashboard asli dan scoring tim | Ini aset utama untuk ujian lab praktis ala vendor besar |
| Integrasi dan migrasi | Ada OpenAPI, API settings, playbook migrasi, template migrasi, billing, dan SaaS ops | Perlu track implementor, migrasi, dan integrator teknis |

### 2.2 Narasi Alur Produk

1. User publik masuk dari halaman login.
2. User memilih jalur `Admin Bisnis` atau `Panel Staf`.
3. Jika belum punya organisasi aktif, sistem membawa user ke onboarding perusahaan.
4. Setelah organisasi aktif, user masuk ke dashboard yang dikontrol oleh role, permission, branch, dan modul yang diaktifkan.
5. Admin bisnis melakukan setup inti: bisnis, cabang, role, user, rekening, master data.
6. Tim operasional bekerja di modul masing-masing: finance, purchasing, inventory, sales, HRIS, dan lain-lain.
7. Supervisor dan owner memantau approval, audit, laporan, dan penutupan proses.
8. Learning center dipakai untuk pembelajaran terstruktur.
9. EDU dipakai untuk simulasi dan praktik terukur.
10. Area API, migrasi, dan SaaS dipakai oleh pihak implementasi, operator platform, atau integrator.

---

## 3. Kelebihan NIZAM

| Area | Kelebihan | Nilai strategis untuk sertifikasi |
|---|---|---|
| Arsitektur produk | NIZAM sudah mencakup operasional inti bisnis dari hulu ke hilir | Sangat cocok untuk sertifikasi role-based dan scenario-based |
| Multi-tenant governance | Ada konsep organisasi, branch, role, module gating, dan subscription control | Memudahkan desain sertifikasi berbasis tanggung jawab nyata |
| Dua jalur login | Pemisahan admin bisnis dan staf sudah jelas | Cocok untuk fondasi kompetensi yang membedakan peran sejak awal |
| Learning foundation | Track, course, lesson, answer submission, dan assessor page sudah tersedia | Bisa dipakai sebagai LMS awal tanpa membangun sistem baru |
| Simulasi praktik | `EDU Mode` memberi latihan di dashboard asli, bukan mockup | Ini pembeda terbesar dibanding training biasa |
| Assessment trail | Sudah ada participant submission dan formal assessment record | Baik untuk audit sertifikasi dan bukti kompetensi |
| Dokumentasi operasional | Sudah ada playbook migrasi, panduan admin, buku informasi, kerja, dan penilaian | Bahan baku kurikulum sudah tersedia dan bisa dikonversi cepat |
| Integrasi & API | Ada OpenAPI dan area API settings | Memungkinkan track integrator dan developer partner |
| Domain lokal Indonesia | Ada zakat, syirkah, payroll, approval, audit, dan pola bisnis lokal | Menjadikan sertifikasi NIZAM lebih relevan untuk pasar targetnya |

### 3.1 Kelebihan Paling Menonjol

Kelebihan paling strategis NIZAM adalah kombinasi tiga hal yang jarang dimiliki bersamaan:

1. ERP operasional yang nyata,
2. learning center di dalam produk,
3. simulasi praktik yang berjalan di dashboard asli.

Jika dikemas dengan benar, ini bisa menghasilkan program sertifikasi yang bukan hanya "lulus teori", tetapi benar-benar mengukur kemampuan kerja.

---

## 4. Kekurangan dan Gap Saat Ini

| Area | Kekurangan atau gap | Dampak ke sertifikasi |
|---|---|---|
| Kompleksitas produk | Cakupan modul sangat luas sehingga kurva belajar tinggi | Harus dibuat track bertahap, bukan satu jalur besar |
| Transisi arsitektur | Masih ada istilah `supabase` padahal runtime utama sudah PostgreSQL native dan internal auth | Materi teknis dan implementor harus menjelaskan boundary ini dengan sangat jelas |
| Learning live masih terbatas | Track yang live baru dasar, sedangkan operasional harian dan leadership masih sebagian besar tahap rencana | Sertifikasi L2 ke atas belum bisa langsung full scale |
| Granularitas peran learning | `learning:write` masih cukup lebar, assessor access juga masih terkait konteks SaaS tertentu | Governance assessor, trainer, dan admin learning perlu diperjelas |
| EDU belum penuh | Auto-validator baru pilot sebagian soal, trainer console penuh belum selesai | Ujian lab expert belum bisa full otomatis |
| Dokumen tersebar | Materi training tersebar di banyak file | Butuh standardisasi kurikulum, naming, dan versioning |
| Recertification belum ada | Belum ada masa berlaku badge, renewal, atau delta assessment | Sertifikasi berisiko jadi sekali lulus lalu usang |
| Badge dan credential ops belum ada | Belum ada sertifikat digital, badge, catalog resmi, atau exam registry | Program belum siap dijual sebagai ekosistem sertifikasi |
| Mapping per pihak belum baku | User, admin, trainer, assessor, implementor, dan integrator belum punya jalur formal tunggal | Risiko kebingungan dan overlap materi |

### 4.1 Gap Paling Penting

Gap terbesar NIZAM bukan pada kurangnya fitur, tetapi pada belum dirapikannya:

1. arsitektur kurikulum,
2. governance sertifikasi,
3. standardisasi jalur per pihak,
4. operational model untuk trainer dan assessor.

---

## 5. Visi Program Sertifikasi NIZAM

Program sertifikasi NIZAM sebaiknya dibangun dengan prinsip berikut:

1. `Role-based`: sertifikasi mengikuti pekerjaan nyata, bukan hanya nama modul.
2. `Layered`: ada level foundation, associate, professional, expert, dan instructor authorization; spesialisasi ditunjukkan lewat suffix domain.
3. `Lab-first`: asesmen praktik harus dominan, terutama memakai `EDU Mode` dan tenant sandbox.
4. `Auditable`: semua hasil belajar, jawaban, penilaian, dan keputusan tersimpan.
5. `Stackable`: peserta bisa naik level bertahap dan mengumpulkan badge.
6. `Renewable`: masa berlaku sertifikasi harus dibatasi dan bisa diperpanjang.
7. `Product-anchored`: kurikulum mengikuti alur produk nyata, bukan konsep generik ERP.

---

## 6. Arsitektur Keluarga Sertifikasi

### 6.1 Tiga Kelompok Besar

| Kelompok | Keluarga kode | Fokus | Audiens utama |
|---|---|---|---|
| Operations | `NCO*` | pemakaian NIZAM untuk kerja harian lintas fungsi | user umum, operator divisi, admin operasional |
| Governance | `NCG*` | administrasi bisnis, approval, audit, kontrol, trainer, assessor | admin bisnis, supervisor, compliance, trainer, assessor |
| Technology | `NCT*` | implementasi, migrasi, integrasi, platform, arsitektur solusi | implementor, integrator, SaaS ops, solution architect |

### 6.2 Pola Kode Ala Cisco

Pola yang direkomendasikan:

`NC + [kelompok] + [level]`

Aturan penting:

1. kode sertifikasi dibatasi `4 huruf`,
2. spesialisasi tidak ditaruh di kode,
3. spesialisasi ditulis di nama sertifikat resmi.

Arti kodenya:

| Komponen | Makna |
|---|---|
| `NC` | NIZAM Certified |
| `O` | Operations |
| `G` | Governance |
| `T` | Technology |
| `F` | Foundation |
| `A` | Associate |
| `P` | Professional |
| `E` | Expert |
| `I` | Instructor / Assessor authorization |

Contoh nama yang terasa seperti keluarga `CCNA` atau `CCDP`:

1. `NCOA` = `NIZAM Certified Operations Associate - Sales & CRM`
2. `NCGP` = `NIZAM Certified Governance Professional - Business Administration`
3. `NCTA` = `NIZAM Certified Technology Associate - Data Migration`
4. `NCTP` = `NIZAM Certified Technology Professional - API Integration`
5. `NCTE` = `NIZAM Certified Technology Expert - Solution Architecture`
6. `NCGI` = `NIZAM Certified Governance Instructor - Assessor`

### 6.3 Struktur Level Per Keluarga

| Level | Kode level | Posisi | Sasaran | Bentuk uji utama | Masa berlaku usulan |
|---|---|---|---|---|---|
| Foundation | `F` | fondasi | peserta baru di keluarga tersebut | teori dasar + guided practice | 2 tahun |
| Associate | `A` | operator atau pelaksana awal | user fungsional dan tim pelaksana | teori + praktik modul | 2 tahun |
| Professional | `P` | pengelola proses | admin, supervisor, implementor lead | cross-module lab + governance review | 2 tahun |
| Expert | `E` | arsitek atau otoritas tertinggi | architect, partner senior, lead specialist | capstone end-to-end + defense | 3 tahun |
| Instructor | `I` | trainer atau assessor resmi | trainer, assessor, academy lead | calibration, facilitation, assessment audit | 1 tahun |

Catatan:

1. Tidak semua keluarga harus membuka semua level pada fase pertama.
2. `Instructor` paling cocok dipakai terutama di keluarga `Governance`.
3. Spesialisasi domain ditulis sebagai suffix, bukan keluarga baru.

---

## 7. Peta Pihak dan Jalur Sertifikasinya

| Pihak di environment NIZAM | Jalur minimal | Jalur lanjutan |
|---|---|---|
| Pengguna baru umum | `NCOF` (Orientasi), `NCOA` (Core User) | `NCOA` sesuai divisi |
| Staff sales / kasir | `NCOF`, `NCOA` (Core User), `NCOA` (Sales & CRM) | `NCOP` (POS / CRM Lead) |
| Staff purchasing | `NCOF`, `NCOA` (Core User), `NCOA` (Purchasing) | `NCOP` (Purchasing Lead) |
| Staff gudang / inventory | `NCOF`, `NCOA` (Core User), `NCOA` (Inventory) | `NCOP` (WMS / Warehouse) |
| Staff finance / accounting | `NCOF`, `NCOA` (Core User), `NCOA` (Finance) | `NCOP` (Closing / Tax / Zakat) |
| Staff HRIS / payroll | `NCOF`, `NCOA` (Core User), `NCOA` (HRIS & Payroll) | `NCOP` (Payroll Lead) |
| Staff manufaktur | `NCOF`, `NCOA` (Core User), `NCOA` (Manufacturing) | `NCOP` (Manufacturing), `NCOE` (Manufacturing Expert) |
| Staff fleet / services / construction | `NCOF`, `NCOA` (Core User), `NCOA` (Fleet / Services / Construction) | `NCOP` (Ops Specialist) |
| Pengelola syirkah | `NCOF`, `NCOA` (Core User), `NCOA` (Syirkah) | `NCOP` (Syirkah Specialist) |
| Owner / admin bisnis | `NCOF`, `NCOA` (Core User), `NCGP` (Business Administration) | `NCGP` (Governance), `NCTP` (Implementation) |
| Supervisor / manager | `NCOF`, `NCOA` (Core User), `NCGP` (Supervision) | `NCGP` (Audit / Compliance) |
| Internal auditor / compliance | `NCGP` (Audit & Control) | `NCGE` (GRC Expert) |
| Tim onboarding / implementasi | `NCOF`, `NCGP` (Administration), `NCTA` (Data Migration) | `NCTP` (Implementation), `NCTE` (Architecture) |
| Tim API / integrator / developer partner | `NCOF`, `NCTA` (API Integration) | `NCTP` (Integration), `NCTE` (Architecture) |
| SaaS operator / platform admin | `NCOF`, `NCTA` (SaaS Operations) | `NCTP` (Platform) |
| Trainer resmi | `NCOF`, `NCGP` (Administration), `NCGI` (Trainer) | `NCGI` (Master Trainer) |
| Assessor resmi | `NCOF`, `NCGP` (Supervision), `NCGI` (Assessor) | `NCGI` (Lead Assessor) |

---

## 8. Struktur Track Kurikulum

### 8.1 Track Utama

| Track | Fokus | Sertifikasi utama |
|---|---|---|
| Track A. Onboarding & SOP | akses awal, keamanan akun, orientasi produk | `NCOF`, `NCOA` |
| Track B. Operasional Harian | transaksi inti lintas divisi | `NCOA`, `NCOP` |
| Track C. Leadership & Compliance | approval, audit, review, closing, kontrol | `NCGP`, `NCGE` |
| Track D. Implementation & Migration | setup tenant, cut-off, migrasi, go-live | `NCTA`, `NCTP` |
| Track E. Platform & Integration | API, SaaS ops, environment, observability | `NCTA`, `NCTP`, `NCTE` |
| Track F. Specialist Modules | POS, WMS, Manufacturing, Syirkah, Fleet, Services, Construction | `NCOP`, `NCOE` |
| Track G. Trainer & Assessor | facilitation, calibration, evidence, keputusan kompetensi | `NCGI` |

### 8.2 Mapping Dengan Fondasi Yang Sudah Ada

Track yang sudah paling siap hari ini:

1. `Track A` karena Level 0 dan Level 1 sudah punya fondasi konten.
2. `Track B` secara produk sudah matang, tetapi kurikulum per divisi masih perlu dirapikan.
3. `Track C` sebagian besar sudah ditopang oleh fitur approval, audit, laporan, dan role.
4. `Track G` sudah bisa mulai MVP karena halaman assessor dan participant assessment sudah ada.

---

## 9. Blueprint Kurikulum per Sertifikasi

Setiap sertifikasi NIZAM sebaiknya selalu punya paket baku berikut:

| Komponen | Isi |
|---|---|
| Buku Informasi | konsep, istilah, tujuan, alur, risiko, kontrol |
| Buku Kerja | langkah kerja, screenshot, checklist, studi kasus |
| Buku Penilaian | soal teori, tugas praktik, rubric, keputusan |
| Lab Guide | skenario tenant, data awal, target hasil |
| Dataset | master data, transaksi contoh, error case |
| Media bantu | video pendek, storyboard, job aid, cheat sheet |
| Exam bank | soal teori, soal skenario, lab task, kunci assessor |
| Bukti kompetensi | jawaban peserta, checklist, screen evidence, log EDU |

### 9.1 Komposisi Bobot Asesmen

| Level | Teori | Praktik terstruktur | Bukti kerja / review assessor |
|---|---|---|---|
| `Foundation (F)` | 30% | 50% | 20% |
| `Associate (A)` | 20% | 60% | 20% |
| `Professional (P)` | 15% | 55% | 30% |
| `Expert (E)` | 10% | 65% | 25% |
| `Instructor (I)` | 20% | 30% | 50% |

### 9.2 Bentuk Uji Yang Direkomendasikan

1. `Quiz theory` untuk pemahaman konsep dan alur.
2. `Guided practice` untuk langkah dasar.
3. `Scenario lab` untuk simulasi nyata.
4. `Cross-module capstone` untuk level profesional dan expert.
5. `Assessor review` untuk validasi perilaku kerja, ketelitian, dan keputusan.
6. `Recert delta test` untuk perpanjangan sertifikasi saat fitur berubah.

---

## 10. Kurikulum Prioritas per Jenjang

### 10.1 Gelombang 1: Fondasi Wajib

| Kode | Nama | Audiens | Status usulan |
|---|---|---|---|
| `NCOF` | NIZAM Certified Operations Foundation - Orientasi dan Aturan Akun | semua peserta baru | bangun sekarang |
| `NCOA` | NIZAM Certified Operations Associate - Core User | semua user | bangun sekarang |
| `NCGP` | NIZAM Certified Governance Professional - Business Administration | owner, admin bisnis | bangun sekarang |

### 10.2 Gelombang 2: Operator Inti

| Kode | Nama | Audiens | Status usulan |
|---|---|---|---|
| `NCOA` | NIZAM Certified Operations Associate - Sales & CRM | sales, admin penjualan | prioritas tinggi |
| `NCOA` | NIZAM Certified Operations Associate - Purchasing | buyer, admin pembelian | prioritas tinggi |
| `NCOA` | NIZAM Certified Operations Associate - Inventory & Warehouse | gudang, stock admin | prioritas tinggi |
| `NCOA` | NIZAM Certified Operations Associate - Finance & Cash | finance, accounting admin | prioritas tinggi |
| `NCOA` | NIZAM Certified Operations Associate - HRIS & Payroll | admin HR, payroll | prioritas tinggi |

### 10.3 Gelombang 3: Leadership dan Governance

| Kode | Nama | Audiens | Status usulan |
|---|---|---|---|
| `NCGP` | NIZAM Certified Governance Professional - Operational Supervision | supervisor, manager | prioritas menengah |
| `NCGP` | NIZAM Certified Governance Professional - Audit, Approval, and Control | internal audit, compliance, owner | prioritas menengah |
| `NCGP` | NIZAM Certified Governance Professional - Closing and Data Discipline | finance lead, branch lead | prioritas menengah |

### 10.4 Gelombang 4: Implementasi dan Platform

| Kode | Nama | Audiens | Status usulan |
|---|---|---|---|
| `NCTA` | NIZAM Certified Technology Associate - Data Migration | onboarding, implementation | prioritas menengah |
| `NCTP` | NIZAM Certified Technology Professional - Implementation | implementor, consultant | prioritas menengah |
| `NCTA` | NIZAM Certified Technology Associate - API & Integration | developer, integrator | prioritas menengah |
| `NCTA` | NIZAM Certified Technology Associate - SaaS Operations | tim platform | prioritas menengah |

### 10.5 Gelombang 5: Trainer dan Assessor

| Kode | Nama | Audiens | Status usulan |
|---|---|---|---|
| `NCGI` | NIZAM Certified Governance Instructor - Trainer | trainer internal dan partner | prioritas menengah |
| `NCGI` | NIZAM Certified Governance Instructor - Assessor | assessor resmi | prioritas menengah |

---

## 11. Masterplan Pembangunan 12 Bulan

| Fase | Periode | Fokus | Deliverable utama |
|---|---|---|---|
| Fase 1 | Bulan 1-2 | standardisasi framework | naming sertifikasi, kamus kompetensi, matriks pihak, template kurikulum baku |
| Fase 2 | Bulan 2-3 | produksi fondasi | finalisasi `NCOF`, `NCOA`, `NCGP`, penataan learning admin, assignment dasar |
| Fase 3 | Bulan 3-6 | operator core | paket lengkap `NCOA` per domain, tenant sandbox per domain |
| Fase 4 | Bulan 6-8 | supervisor dan compliance | `NCGP` untuk supervision, audit, dan control, dashboard review assessor, bank soal governance |
| Fase 5 | Bulan 8-10 | implementasi dan integrasi | `NCTA`, `NCTP`, case migrasi, lab integrasi, capstone implementasi |
| Fase 6 | Bulan 10-12 | operasi sertifikasi | digital badge, policy recertification, reporting academy, pilot partner, trainer-assessor certification |

### 11.1 Workstream Pendukung Yang Wajib Jalan Paralel

| Workstream | Kebutuhan |
|---|---|
| Kurikulum | mapping kompetensi, lesson plan, buku informasi/kerja/penilaian |
| Produk learning | track admin, enrollment, assignment, progress, analytics |
| Assessment ops | rubric, panel assessor, moderation, audit keputusan |
| Lab ops | tenant sandbox, seed data, reset scenario, evidence capture |
| Credential ops | sertifikat digital, badge, expiry, renewal, registry |
| Partner enablement | trainer kit, assessor guide, onboarding implementor |

---

## 12. Governance Program Sertifikasi

### 12.1 Peran Kunci

| Peran | Tanggung jawab |
|---|---|
| Academic Lead NIZAM | menetapkan standar kompetensi, quality bar, dan roadmap |
| Product SME | memastikan materi sesuai alur produk nyata |
| Curriculum Designer | mengubah flow produk menjadi lesson dan asesmen |
| Trainer | membimbing pembelajaran dan latihan |
| Assessor | memutuskan kompeten atau belum kompeten |
| Certification Ops | mengelola schedule, badge, expiry, dan registry |
| QA / Moderator | audit kualitas soal, rubric, dan konsistensi penilaian |

### 12.2 Kebijakan Yang Harus Dibakukan

1. syarat mengikuti ujian,
2. syarat lulus,
3. masa berlaku sertifikat,
4. kebijakan remedial,
5. aturan retake,
6. standar bukti praktik,
7. standar conflict of interest untuk assessor,
8. versi kurikulum dan delta update.

---

## 13. Gelar Resmi, Hak, dan Kewajiban

### 13.1 Format Gelar Resmi

Aturan penulisan yang direkomendasikan:

1. kode resmi sertifikasi menggunakan format `4 huruf`,
2. kode dipakai sebagai identitas utama sertifikasi,
3. nama spesialisasi ditulis penuh pada sertifikat, badge, transcript, dan katalog,
4. penulisan setelah nama memakai kode inti, lalu spesialisasi opsional dalam tanda kurung.

Contoh:

1. `Ahmad Fauzi, NCOA`
2. `Ahmad Fauzi, NCOA (Finance & Cash)`
3. `Siti Rahmah, NCGP`
4. `Dimas Prakoso, NCTP (Implementation)`

### 13.2 Daftar Gelar Resmi

| Kode | Gelar resmi | Posisi umum | Contoh penggunaan |
|---|---|---|---|
| `NCOF` | NIZAM Certified Operations Foundation | fondasi pengguna | orientasi, keamanan akun, akses dasar |
| `NCOA` | NIZAM Certified Operations Associate | operator fungsional | sales, purchasing, inventory, finance, HRIS |
| `NCOP` | NIZAM Certified Operations Professional | operator senior / lead operasional | WMS lead, payroll lead, POS lead |
| `NCOE` | NIZAM Certified Operations Expert | otoritas operasional domain | manufacturing expert, syirkah expert |
| `NCGP` | NIZAM Certified Governance Professional | admin, supervisor, compliance | business administration, supervision, audit |
| `NCGE` | NIZAM Certified Governance Expert | governance lead | GRC, policy, control framework |
| `NCGI` | NIZAM Certified Governance Instructor | trainer / assessor resmi | trainer, assessor, master trainer |
| `NCTA` | NIZAM Certified Technology Associate | pelaksana teknis awal | data migration, API, SaaS operations |
| `NCTP` | NIZAM Certified Technology Professional | implementor / integrator | implementation, platform, integration |
| `NCTE` | NIZAM Certified Technology Expert | arsitek solusi | solution architecture, expert integration |

### 13.3 Hak Pemegang Sertifikasi

Pemegang sertifikasi yang statusnya aktif berhak:

1. memakai gelar sertifikasi resmi sesuai kode yang masih berlaku,
2. tercantum dalam registry sertifikasi internal atau publik sesuai kebijakan NIZAM,
3. menerima sertifikat, transcript, badge, atau bukti kelulusan resmi,
4. mengikuti jalur lanjutan atau recertification sesuai prasyarat,
5. mengajukan klarifikasi atau banding administratif atas hasil evaluasi sesuai SOP program.

### 13.4 Kewajiban Pemegang Sertifikasi

Pemegang sertifikasi wajib:

1. menggunakan gelar hanya selama status sertifikasi masih aktif,
2. tidak mengklaim kompetensi di luar ruang lingkup sertifikat yang dimiliki,
3. menjaga kerahasiaan soal, bank asesmen, dan skenario ujian,
4. menaati kode etik penggunaan akun, data, dan akses NIZAM,
5. mengikuti proses renewal atau recertification jika masa berlaku berakhir,
6. menerima audit bila ada verifikasi atas validitas klaim kompetensi,
7. tidak memalsukan bukti praktik, submission, log, maupun identitas peserta.

### 13.5 Hak Trainer dan Assessor

Trainer dan assessor resmi berhak:

1. mengakses materi, rubric, dan panel yang dibutuhkan sesuai mandatnya,
2. meminta bukti tambahan jika submission peserta belum cukup kuat,
3. memberi keputusan kompeten atau belum kompeten secara independen sesuai rubric,
4. menolak penugasan yang mengandung conflict of interest,
5. memperoleh jalur kalibrasi, pembaruan materi, dan otorisasi lanjutan.

### 13.6 Kewajiban Trainer dan Assessor

Trainer dan assessor resmi wajib:

1. menjaga objektivitas penilaian dan tidak memberi keputusan di luar bukti,
2. mendokumentasikan alasan keputusan, catatan, dan tindak lanjut remedial,
3. menjaga kerahasiaan bank soal, jawaban peserta, dan bukti asesmen,
4. mengikuti kalibrasi dan standardisasi assessor secara berkala,
5. menghindari konflik kepentingan, keberpihakan, atau penyalahgunaan otoritas,
6. menggunakan akses learning dan assessment hanya untuk tugas resmi,
7. siap ditinjau oleh moderator atau quality assurance bila diperlukan.

### 13.7 Suspensi dan Pencabutan Gelar

Sertifikasi dapat:

1. `aktif` jika masih berlaku dan tidak ada pelanggaran,
2. `suspended` jika sedang dalam investigasi atau belum memenuhi kewajiban administratif,
3. `revoked` jika terbukti ada kecurangan, pemalsuan, atau pelanggaran etik berat,
4. `expired` jika masa berlaku berakhir dan belum diperpanjang.

---

## 14. Roadmap Fitur Produk yang Mendukung Sertifikasi

Supaya program ini betul-betul hidup, beberapa fitur produk sebaiknya diprioritaskan:

1. panel `admin learning` yang lebih formal,
2. assignment `course -> trainee -> assessor`,
3. skill badge dan transcript user,
4. digital certificate generator,
5. recertification due tracker,
6. reporting academy per org dan per partner,
7. trainer console EDU penuh,
8. auto-validator EDU diperluas dari pilot ke seluruh skenario penting,
9. katalog sertifikasi publik atau semi-publik,
10. sinkronisasi learning progress ke HRIS untuk talent development.

---

## 15. KPI Keberhasilan Program

| KPI | Target awal 12 bulan |
|---|---|
| Sertifikasi fondasi live | minimal `3` sertifikasi |
| Sertifikasi operator live | minimal `5` sertifikasi |
| Tenant sandbox standar | minimal `5` skenario bisnis |
| Trainer tersertifikasi | minimal `5` orang |
| Assessor tersertifikasi | minimal `3` orang |
| Pass rate fondasi | `70%+` |
| Waktu onboarding user baru sampai produktif | turun `30%` |
| Tiket support dasar login/onboarding | turun `25%` |
| Organisasi pilot yang memakai learning center | minimal `3` org |

---

## 16. Langkah 90 Hari Yang Paling Masuk Akal

1. Sahkan nomenklatur resmi sertifikasi NIZAM.
2. Finalkan `NCOF`, `NCOA`, dan `NCGP` sebagai paket pertama.
3. Satukan dokumen dasar yang sudah ada ke dalam struktur `track -> course -> lesson -> assessment`.
4. Bakukan role `Trainee`, `Trainer`, `Assessor`, dan `Admin Learning`.
5. Siapkan `2-3` tenant sandbox resmi untuk latihan.
6. Tentukan rubrik lulus dan remedial yang seragam.
7. Jalankan pilot internal dengan user baru, admin bisnis, dan satu assessor.
8. Ukur waktu belajar, tingkat lulus, dan titik kebingungan tertinggi.
9. Pakai hasil pilot untuk merapikan gelombang operator inti.

---

## 17. Kesimpulan

NIZAM sangat layak dibangun menjadi ekosistem sertifikasi berjenjang karena fondasi produknya sudah lebih maju daripada LMS biasa:

1. alur bisnis nyata sudah ada,
2. kontrol akses sudah matang,
3. learning dan assessment sudah mulai terbentuk,
4. simulasi praktik di dashboard asli memberi keunggulan kompetitif yang besar.

Pendekatan terbaik bukan membuat "sertifikasi besar" sekaligus, tetapi membangun tangga kompetensi bertahap:

1. fondasi semua user,
2. operator per divisi,
3. supervisor dan compliance,
4. implementor dan integrator,
5. trainer dan assessor resmi.

Dengan model ini, NIZAM bisa berkembang dari sekadar software ERP menjadi `ecosystem of capability`, tempat produk, pembelajaran, praktik, dan sertifikasi saling menguatkan.
