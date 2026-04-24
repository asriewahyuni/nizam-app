# Skema Role Dan Login Training Center MVP NIZAM

Dokumen ini menjelaskan skema akses minimum untuk `trainee`, `assessor`, dan `admin learning` pada Training Center MVP NIZAM.

## 1. Tujuan

Skema ini dibuat agar:

- peserta belajar dengan identitas yang jelas,
- assessor menilai dengan jejak audit yang jelas,
- admin learning dapat mengatur akses dan penugasan,
- hasil asesmen bisa dipertanggungjawabkan,
- implementasi MVP tetap sederhana.

## 2. Prinsip Dasar

1. `Trainee` wajib login.
2. `Assessor` wajib login.
3. `Admin learning` wajib login.
4. Penilaian tidak boleh anonim.
5. Satu hasil asesmen harus selalu punya `peserta`, `assessor`, `waktu`, dan `keputusan`.
6. Untuk MVP, gunakan mekanisme login NIZAM yang sudah ada, jangan buat sistem login baru.

## 3. Fondasi Login Yang Sudah Ada Di NIZAM

NIZAM saat ini sudah punya dua jalur login utama:

- `Admin Bisnis` via email dan password
- `Panel Staf` via NIK dan password

Referensi yang relevan:

- [`app/(auth)/login/page.tsx`](/Users/manbook/nizam-app/app/(auth)/login/page.tsx:1)
- [`modules/auth/actions/auth.actions.ts`](/Users/manbook/nizam-app/modules/auth/actions/auth.actions.ts:611)
- [`modules/auth/actions/auth.actions.ts`](/Users/manbook/nizam-app/modules/auth/actions/auth.actions.ts:925)

Artinya, MVP Training Center paling aman memakai pola ini:

- user internal perusahaan masuk lewat `Panel Staf`,
- owner atau admin utama bisa masuk lewat `Admin Bisnis`,
- akses ke Training Center dikontrol lewat role dan permission.

## 4. Role Minimum Untuk MVP

Role minimum yang direkomendasikan:

1. `Trainee`
2. `Assessor`
3. `Admin Learning`

Jika perlu, owner dan admin utama tetap bisa bertindak sebagai pengawas, tetapi dalam skema MVP peran utama tetap tiga ini.

## 5. Definisi Tiap Role

### 5.1 Trainee

Trainee adalah peserta pelatihan.

Tugas utama:

- membuka track dan course,
- membaca lesson,
- mengerjakan checklist,
- mengerjakan asesmen dasar,
- mengikuti praktik jika course punya simulasi.

Hak akses minimum:

- melihat course yang di-assign,
- melihat lesson,
- melihat progress pribadi,
- submit jawaban atau hasil tugas,
- melihat hasil asesmen milik sendiri.

Trainee tidak boleh:

- menilai peserta lain,
- mengubah hasil asesmen,
- mengatur akses peserta lain,
- membuka panel assessor.

### 5.2 Assessor

Assessor adalah penilai atau trainer yang memberi keputusan kompeten atau belum kompeten.

Tugas utama:

- melihat peserta yang di-assign,
- meninjau hasil belajar,
- menilai teori dan praktik,
- memberi catatan,
- memutuskan hasil asesmen,
- menentukan apakah peserta perlu remedial.

Hak akses minimum:

- melihat data peserta yang menjadi tanggung jawabnya,
- membuka hasil lesson dan asesmen peserta,
- memberi status `Kompeten` atau `Belum Kompeten`,
- memberi catatan dan tindak lanjut,
- melihat bukti praktik jika ada integrasi ke `edu`.

Assessor tidak boleh:

- menghapus histori penilaian tanpa jejak,
- menilai tanpa login,
- menilai peserta di luar assignment jika belum diizinkan,
- mengubah konfigurasi course secara global kecuali juga berperan sebagai admin learning.

### 5.3 Admin Learning

Admin learning adalah pengelola Training Center.

Tugas utama:

- membuat track dan course,
- membuka atau menutup course,
- meng-assign trainee,
- meng-assign assessor,
- memantau progres pelatihan,
- menjaga kelengkapan data learning.

Hak akses minimum:

- mengelola konfigurasi Training Center,
- mengelola assignment peserta dan assessor,
- melihat rekap hasil semua pelatihan,
- membuka panel admin learning,
- melihat audit dasar aktivitas learning.

## 6. Jalur Login Yang Direkomendasikan

### 6.1 Trainee Login Dari Mana?

Rekomendasi MVP:

- `Trainee internal perusahaan` login lewat `Panel Staf`
- `Trainee owner/admin` login lewat `Admin Bisnis`

Alasan:

- tidak perlu membuat akun training terpisah,
- identitas user tetap konsisten dengan data perusahaan,
- progress bisa langsung dikaitkan ke user yang sudah ada.

### 6.2 Assessor Login Dari Mana?

Rekomendasi MVP:

- `Assessor internal perusahaan` login lewat `Panel Staf`
- `Assessor owner/admin` login lewat `Admin Bisnis`

Alasan:

- assessor juga harus punya identitas sistem yang valid,
- keputusan penilaian harus tercatat atas nama user tertentu,
- audit trail jadi lebih jelas.

### 6.3 Admin Learning Login Dari Mana?

Rekomendasi MVP:

- admin learning paling aman login lewat `Admin Bisnis`,
- jika admin learning adalah staf khusus internal, bisa login lewat `Panel Staf` selama role dan permission-nya sesuai.

## 7. Matriks Login Per Role

| Role | Jalur login utama | Jalur login alternatif | Catatan |
|---|---|---|---|
| Trainee | Panel Staf | Admin Bisnis | Bergantung tipe user |
| Assessor | Panel Staf | Admin Bisnis | Harus punya assignment penilaian |
| Admin Learning | Admin Bisnis | Panel Staf | Hanya jika role internal diizinkan |

## 8. Matriks Hak Akses MVP

| Fitur | Trainee | Assessor | Admin Learning |
|---|---|---|---|
| Buka `/learning` | Ya | Ya | Ya |
| Buka lesson | Ya | Ya | Ya |
| Lihat progress pribadi | Ya | Ya, untuk peserta yang di-assign | Ya |
| Isi asesmen peserta | Tidak | Ya | Ya |
| Putuskan kompeten/belum | Tidak | Ya | Ya |
| Assign peserta | Tidak | Tidak | Ya |
| Assign assessor | Tidak | Tidak | Ya |
| Kelola track/course | Tidak | Tidak | Ya |
| Lihat rekap semua peserta | Tidak | Terbatas | Ya |

## 9. Permission Minimum Untuk MVP

Di codebase saat ini sudah ada permission `learning:read` dan `learning:write`:

- [`app/(dashboard)/settings/roles/page.tsx`](/Users/manbook/nizam-app/app/(dashboard)/settings/roles/page.tsx:93)

Untuk MVP, pembagian paling sederhana:

### Trainee

- `learning:read`

### Assessor

- `learning:read`
- `learning:write`

### Admin Learning

- `learning:read`
- `learning:write`

Catatan:

- Pada MVP, `learning:write` dipakai bersama untuk assessor dan admin learning.
- Pada fase berikutnya, permission ini sebaiknya dipisah lagi menjadi lebih detail, misalnya:
  - `learning:assess`
  - `learning:manage`
  - `learning:assign`

## 10. Alur Login Dan Akses

### 10.1 Alur Trainee

1. Trainee login ke NIZAM.
2. Sistem membaca role dan permission user.
3. Jika user punya akses learning, user bisa membuka `/learning`.
4. User melihat course yang tersedia atau yang di-assign.
5. User membuka lesson dan mulai belajar.
6. User mengerjakan asesmen jika diperlukan.

### 10.2 Alur Assessor

1. Assessor login ke NIZAM.
2. Sistem membaca role dan permission user.
3. Jika user punya akses assessor, user bisa membuka area review atau panel trainer.
4. User melihat peserta yang di-assign.
5. User memeriksa hasil belajar atau hasil praktik.
6. User memberi catatan dan keputusan akhir.

### 10.3 Alur Admin Learning

1. Admin learning login ke NIZAM.
2. Sistem membaca role dan permission user.
3. User membuka panel admin learning.
4. User mengatur track, course, peserta, dan assessor.
5. User memantau progres dan hasil pelatihan.

## 11. Assignment Yang Direkomendasikan

Supaya penilaian rapi, MVP sebaiknya memakai assignment yang jelas.

Minimum assignment yang dibutuhkan:

1. `course -> trainee`
2. `course -> assessor`

Pilihan implementasi sederhana:

- satu trainee bisa di-assign ke banyak course,
- satu assessor bisa menilai banyak trainee,
- satu course bisa punya satu assessor utama,
- jika dibutuhkan, satu course bisa punya assessor cadangan.

## 12. Aturan Penting Penilaian

1. Assessor tidak boleh menilai tanpa login.
2. Hasil penilaian harus menyimpan `assessor_id`.
3. Hasil penilaian harus menyimpan waktu penilaian.
4. Jika nilai diubah, perubahan harus terlacak.
5. Trainee hanya boleh melihat hasil miliknya sendiri.
6. Assessor idealnya hanya melihat trainee yang di-assign.

## 13. Audit Trail Minimum

Untuk tiap asesmen, minimal simpan:

1. `trainee_user_id`
2. `assessor_user_id`
3. `course_id`
4. `lesson_id` atau `assessment_id`
5. `decision`
6. `score`
7. `notes`
8. `assessed_at`
9. `updated_at`

Ini penting agar hasil pelatihan tidak menjadi catatan liar tanpa penanggung jawab.

## 14. Keputusan Status Yang Direkomendasikan

Status peserta pada level MVP:

- `Belum Mulai`
- `Sedang Belajar`
- `Menunggu Review`
- `Kompeten`
- `Belum Kompeten`
- `Remedial`

Status ini cukup untuk tahap awal dan mudah dipahami trainer maupun peserta.

## 15. Skenario Login Yang Paling Aman Untuk MVP

### Skenario A. Pelatihan Internal Karyawan

- trainee login via `Panel Staf`
- assessor login via `Panel Staf`
- admin learning login via `Admin Bisnis` atau `Panel Staf`

Ini skenario paling cocok untuk perusahaan yang semua pesertanya adalah user internal.

### Skenario B. Pelatihan Internal Dengan Pengawas Owner

- trainee login via `Panel Staf`
- assessor login via `Panel Staf`
- owner atau admin utama login via `Admin Bisnis`

Ini cocok jika owner ingin memantau hasil pelatihan tanpa menjadi assessor utama.

### Skenario C. Pelatihan Campuran

- trainee internal login via `Panel Staf`
- trainee owner/admin login via `Admin Bisnis`
- assessor login sesuai tipe user

Ini masih bisa dipakai tanpa sistem login baru, selama assignment jelas.

## 16. Rekomendasi Implementasi MVP

Rekomendasi paling aman:

1. `Trainee` harus login.
2. `Assessor` harus login.
3. `Admin learning` harus login.
4. Gunakan jalur login NIZAM yang sudah ada.
5. Gunakan `learning:read` untuk trainee.
6. Gunakan `learning:write` untuk assessor dan admin learning.
7. Simpan hasil asesmen dengan identitas assessor.

## 17. Tahap Berikutnya Setelah MVP

Setelah MVP stabil, pengembangan berikutnya bisa menambahkan:

1. permission terpisah untuk assessor dan admin learning,
2. panel khusus assignment peserta,
3. dashboard assessor,
4. audit trail yang lebih lengkap,
5. sertifikat atau status kelulusan otomatis.

## 18. Kesimpulan

Skema paling tepat untuk Training Center MVP NIZAM adalah:

- trainee login dengan akun NIZAM,
- assessor login dengan akun NIZAM,
- admin learning login dengan akun NIZAM,
- kontrol akses dibedakan lewat role dan permission,
- hasil penilaian selalu dikaitkan ke assessor yang login.

Dengan pendekatan ini, MVP tetap sederhana tetapi sudah cukup kuat untuk pelatihan formal dan asesmen yang bisa diaudit.
