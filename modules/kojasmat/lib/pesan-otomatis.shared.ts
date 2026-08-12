// Katalog & tipe "pesan otomatis" Kojasmat — dipakai baik server (getModuleSettings,
// trigger pengiriman WA di server actions) maupun client (form pengaturan di
// KojasmatClient.tsx). Tidak boleh punya 'use server'/'use client' atau import
// server-only (pg, queryPostgres, dsb) — lihat modules/kojasmat/lib/kojasmat-account-mapping.shared.ts
// untuk pola yang sama.

export type PesanOtomatisKey =
  | 'pendaftaran_menunggu_bayar'
  | 'pendaftaran_menunggu_verifikasi'
  | 'pendaftaran_disetujui_teman'
  | 'pendaftaran_ditolak'
  | 'pendaftaran_perlu_revisi'
  | 'sahabat_menunggu_approval'
  | 'sahabat_disetujui'
  // Key baru untuk notifikasi proyek (funding, keterlibatan anggota) tinggal
  // ditambahkan di sini nanti — additive, tidak breaking karena pesan_otomatis
  // tersimpan sebagai dictionary di jsonb (lihat getModuleSettings di kojasmat-test.actions.ts).

export type PesanOtomatisCatalogEntry = {
  key: PesanOtomatisKey
  label: string
  deskripsi: string
  /** Nama variabel {{var}} yang tersedia untuk entry ini */
  variabel: string[]
  defaultBody: string
}

/** Bentuk yang benar-benar tersimpan di org_module_instances.settings.pesan_otomatis[key] */
export type PesanOtomatisOverride = { body: string; enabled: boolean }

/** Bentuk gabungan (metadata katalog + override org) yang dikembalikan getModuleSettings() */
export type PesanOtomatisEntry = PesanOtomatisOverride & {
  label: string
  deskripsi: string
  variabel: string[]
}

export type PesanOtomatisSettings = Record<PesanOtomatisKey, PesanOtomatisEntry>

export const PESAN_OTOMATIS_CATALOG: PesanOtomatisCatalogEntry[] = [
  {
    key: 'pendaftaran_menunggu_bayar',
    label: 'Selesai Registrasi — Menunggu Pembayaran',
    deskripsi: 'Terkirim otomatis saat calon anggota LULUS test masuk, berisi rincian tagihan pendaftaran & rekening tujuan transfer.',
    variabel: ['nama', 'skor', 'apresiasi', 'biaya_admin_pendaftaran', 'nominal_simpanan_pokok', 'nominal_simpanan_wajib', 'total_tagihan', 'bank_name', 'account_number', 'account_holder'],
    defaultBody:
`Assalamu'alaikum, {{nama}}

Alhamdulillah, Anda *LULUS* test masuk KOJASMAT dengan skor *{{skor}}* ({{apresiasi}}). 🤲

Langkah terakhir sebelum resmi terdaftar adalah menyelesaikan pembayaran:
- Biaya Admin Pendaftaran: {{biaya_admin_pendaftaran}}
- Simpanan Pokok: {{nominal_simpanan_pokok}}
- Simpanan Wajib: {{nominal_simpanan_wajib}}
*Total: {{total_tagihan}}*

Transfer ke:
*{{bank_name}}* a.n. {{account_holder}}
No. Rek: {{account_number}}

Setelah transfer, silakan unggah bukti pembayaran di halaman pendaftaran Anda untuk diverifikasi CS. Barakallahu fiik.`,
  },
  {
    key: 'pendaftaran_menunggu_verifikasi',
    label: 'Pembayaran Diterima — Menunggu Verifikasi',
    deskripsi: 'Terkirim otomatis begitu calon anggota mengunggah bukti transfer, sebelum diverifikasi pengurus.',
    variabel: ['nama', 'total_dibayar', 'biaya_admin', 'simpanan_pokok', 'simpanan_wajib'],
    defaultBody:
`Assalamu'alaikum, {{nama}}

Alhamdulillah, bukti pembayaran pendaftaran Anda sebesar *{{total_dibayar}}* sudah kami terima. ✅

Rincian:
- Biaya Admin: {{biaya_admin}}
- Simpanan Pokok: {{simpanan_pokok}}
- Simpanan Wajib: {{simpanan_wajib}}

Status pendaftaran Anda sekarang *menunggu verifikasi CS*. InsyaAllah kami kabari begitu verifikasi selesai. Jazakumullahu khairan atas kesabarannya 🙏`,
  },
  {
    key: 'pendaftaran_disetujui_teman',
    label: 'Pendaftaran Disetujui — Resmi Jadi Teman',
    deskripsi: 'Terkirim otomatis saat pengurus menyetujui pendaftaran, berisi kode anggota & kredensial login.',
    variabel: ['nama', 'kode_anggota', 'login_url', 'login_identifier', 'temp_password'],
    defaultBody:
`Assalamu'alaikum, {{nama}}

Alhamdulillah, pendaftaran keanggotaan koperasi Anda telah *DISETUJUI* ✅

*Kode Anggota:* {{kode_anggota}}
*Login di:* {{login_url}}
*Email/NIK:* {{login_identifier}}
*Password:* {{temp_password}}

Silakan login dan ganti password setelah masuk pertama kali.
Barakallahu fiik, selamat bergabung menjadi bagian keluarga besar KOJASMAT! 🤝`,
  },
  {
    key: 'pendaftaran_ditolak',
    label: 'Pendaftaran Ditolak',
    deskripsi: 'Terkirim otomatis saat CS menolak pendaftaran, berisi catatan alasan & link untuk mengajukan ulang dengan data yang sama (tidak perlu isi ulang dari awal).',
    variabel: ['nama', 'catatan', 'link_lanjutan'],
    defaultBody:
`Assalamu'alaikum, {{nama}}

Mohon maaf, pendaftaran keanggotaan Anda di KOJASMAT untuk saat ini belum dapat kami setujui.

Catatan dari CS:
{{catatan}}

InsyaAllah Anda tetap bisa mengajukan ulang dengan data yang sama lewat link berikut, tidak perlu isi ulang dari awal:
{{link_lanjutan}}

Barakallahu fiik.`,
  },
  {
    key: 'pendaftaran_perlu_revisi',
    label: 'Pendaftaran Perlu Revisi',
    deskripsi: 'Terkirim otomatis saat CS meminta revisi data pendaftaran, berisi catatan & link untuk melanjutkan dengan data yang sudah tersimpan.',
    variabel: ['nama', 'catatan', 'link_lanjutan'],
    defaultBody:
`Assalamu'alaikum, {{nama}}

Alhamdulillah, pendaftaran Anda sudah kami tinjau. Ada sedikit yang perlu diperbaiki dulu sebelum bisa dilanjutkan:

{{catatan}}

Silakan lanjutkan dan perbaiki lewat link berikut (data Anda sebelumnya sudah tersimpan, tidak hilang):
{{link_lanjutan}}

Jazakumullahu khairan atas kesabarannya.`,
  },
  {
    key: 'sahabat_menunggu_approval',
    label: 'Lulus Test Sahabat — Menunggu Persetujuan',
    deskripsi: 'Terkirim otomatis saat anggota (Teman) LULUS test kedua (upgrade Sahabat), sebelum disetujui pengurus.',
    variabel: ['nama', 'skor', 'jumlah_benar', 'total_soal'],
    defaultBody:
`Assalamu'alaikum, {{nama}}

Alhamdulillah, Anda *LULUS* test kedua (upgrade tingkat Sahabat) dengan skor *{{skor}}* ({{jumlah_benar}}/{{total_soal}} benar). 🤲

Status upgrade Anda sekarang *menunggu persetujuan CS*. InsyaAllah kami kabari begitu tingkat Sahabat Anda aktif.`,
  },
  {
    key: 'sahabat_disetujui',
    label: 'Upgrade Sahabat Disetujui',
    deskripsi: 'Terkirim otomatis saat pengurus menyetujui upgrade tingkat Sahabat.',
    variabel: ['nama', 'kode_anggota'],
    defaultBody:
`Assalamu'alaikum, {{nama}}

Alhamdulillah, upgrade keanggotaan Anda ke tingkat *SAHABAT* telah *DISETUJUI* ✅

*Kode Anggota:* {{kode_anggota}}

Sebagai Sahabat, Anda kini dapat mengikuti proyek syirkah, transfer simpanan antar anggota, dan fitur lanjutan lainnya. Barakallahu fiik, selamat bergabung sebagai Sahabat KOJASMAT! 🤝`,
  },
]
