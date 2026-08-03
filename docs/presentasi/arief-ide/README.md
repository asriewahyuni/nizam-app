# arief-ide

> AI penyusun materi slide persuasif berbasis psikologi audiens.

Skill untuk [Devin CLI](https://devin.ai) (dan tools lain yang mendukung [`.agents` skill standard](https://agents.md)) yang fokus pada **alur argumentasi**, bukan keindahan slide.

[![Validate Skill](https://github.com/arief-drip/arief-ide/actions/workflows/validate-skill.yml/badge.svg)](https://github.com/arief-drip/arief-ide/actions/workflows/validate-skill.yml)
[![Release](https://github.com/arief-drip/arief-ide/actions/workflows/release.yml/badge.svg)](https://github.com/arief-drip/arief-ide/actions/workflows/release.yml)
[![Latest Release](https://img.shields.io/github/v/release/arief-drip/arief-ide)](https://github.com/arief-drip/arief-ide/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Filosofi

Bukan sekadar membuat slide — `arief-ide` membangun **alur berpikir yang mengubah cara pandang audiens** hingga mereka siap melakukan satu tindakan yang diinginkan (CTA).

Slide hanyalah media. Produk utamanya adalah **alur argumentasi yang kuat dan persuasif**.

## Cara Kerja

Skill ini menjalani 12 tahap berurutan dengan **gate persetujuan user** di titik-titik kunci:

| Tahap | Output | Gate? |
|-------|--------|-------|
| 0 | Pengumpulan input (topik, audiens, CTA, durasi, gaya) | — |
| 1 | Big Idea + 3–5 alternatif | ✓ pilih |
| 2 | False Belief + penjelasan | ✓ review |
| 3 | Blind Spot (4 perspektif) + prioritas | ✓ persetujuan |
| 4 | Pain Point utama & pendukung | — |
| 5 | Root Cause Analysis (Five Why, First Principles) | — |
| 6 | Evidence (statistik, studi kasus, analogi) | — |
| 7 | Framework Solusi + Quick Win | — |
| 8 | Story Flow (10 urutan psikologis) | ✓ persetujuan |
| 9 | Outline Slide | ✓ persetujuan |
| 10 | **Gate review besar** (5 elemen sekaligus) | ✓ wajib |
| 11 | Isi slide (judul, narasi presenter, poin) | bertahap |
| 12 | Visual recommendation per slide | bertahap |

## Prinsip Psikologi Presentasi

Presentasi mengikuti perjalanan mental audiens:

1. Tidak sadar
2. Sadar masalah
3. Menganggap masalah penting
4. Menyadari penyebab sebenarnya
5. Menemukan sudut pandang baru
6. Percaya solusi
7. Percaya pembicara
8. Siap bertindak

Setiap tahap harus menggerakkan audiens ke fase mental berikutnya.

## Instalasi

### Opsi A — Clone ke project tertentu

```bash
# Di root project kamu
git clone https://github.com/arief-drip/arief-ide.git /tmp/arief-ide
cp -r /tmp/arief-ide/.agents/skills/arief-ide .agents/skills/
```

### Opsi B — Install global (semua project)

**Linux/macOS:**

```bash
git clone https://github.com/arief-drip/arief-ide.git /tmp/arief-ide
mkdir -p ~/.config/devin/skills
cp -r /tmp/arief-ide/.agents/skills/arief-ide ~/.config/devin/skills/
```

**Windows (PowerShell):**

```powershell
git clone https://github.com/arief-drip/arief-ide.git $env:TEMP\arief-ide
New-Item -ItemType Directory -Force -Path "$env:APPDATA\devin\skills"
Copy-Item -Recurse "$env:TEMP\arief-ide\.agents\skills\arief-ide" "$env:APPDATA\devin\skills\"
```

## Penggunaan

Setelah terinstall, invoke di Devin CLI session:

```
/arief-ide
```

atau langsung sebut topiknya:

```
/arief-ide presentasi AI untuk UMKM kuliner
```

Skill akan mulai dari Tahap 0 (tanya input) lalu jalan bertahap dengan gate persetujuan di setiap titik kunci.

## Onboarding — 10 Tema Presentasi yang Bisa Dibuat

Baru kenal `arief-ide`? Berikut 10 contoh tema yang menunjukkan rentang use case skill ini — dari pitch bisnis sampai advokasi sosial. Semua mengikuti alur argumentasi persuasif yang sama.

| # | Tema | Audiens | CTA | Big Idea (contoh) |
|---|------|---------|-----|--------------------|
| 1 | **Pitch deck startup** | Investor VC | Funding seed round | "Bukan marketplace lain — ini infrastruktur tak terlihat yang semua marketplace butuh." |
| 2 | **Workshop AI untuk UMKM kuliner** | Pemilik kedai kopi/warteg | Daftar kelas berbayar | "AI bukan untuk mengganti kamu — tapi untuk membuat 1 orang kerja seperti 5." |
| 3 | **Sales presentation B2B SaaS** | Decision maker korporat | Jadwalkan demo | "Tim sales kamu gagal bukan karena kurang rajin — tapi karena data masuk ke tangan salah orang." |
| 4 | **Keynote inspiratif** | Mahasiswa tingkat akhir | Ikut program mentoring | "Kelulusan terlambat bukan masalah sistem — tapi gejala ketidaktahuan diri." |
| 5 | **Webinar edukasi keuangan pribadi** | Karyawan first-job | Buka rekening investasi | "Orang kaya bukan lebih pintar — mereka cuma tahu satu hal yang kamu tidak diajari sekolah." |
| 6 | **Proposal internal transformasi digital** | C-level & kepala divisi | Approve budget 12 bulan | "Digitalisasi gagal bukan karena teknologi — tapi karena kamu digitalisasi proses yang salah." |
| 7 | **Seminar akademik riset terapan** | Dosen & peneliti muda | Submit paper ke jurnal | "Riset kamu tidak di-cite bukan karena kurang baik — tapi karena kamu menulis untuk reviewer, bukan pembaca." |
| 8 | **Kampanye sosial anti-stigma kesehatan mental** | Komunitas & HR perusahaan | Daftar sebagai relawan | "Stres kerja bukan kelemahan — tapi alarm bahwa sistem kerja kamu yang rusak." |
| 9 | **Product launch fitur baru** | Existing power users | Aktifkan fitur hari ini | "Fitur ini bukan tambahan — ini menyelesaikan masalah yang kamu pikir harus kamu terima." |
| 10 | **Training onboarding karyawan baru** | Karyawan fresh hire | Selesaikan checklist 30 hari | "Onboarding gagal bukan karena kamu lambat — tapi karena tidak ada yang bilang apa yang benar-benar penting." |

### Cara mulai cepat

```bash
# Contoh: langsung sebut tema
/arief-ide pitch deck startup AI untuk logistik

# Atau biarkan skill tanya input satu per satu
/arief-ide
```

Skill akan tanya: topik, audiens, tujuan, CTA, durasi, dan gaya penyampaian — lalu susun alur argumentasi 12 tahap dengan gate persetujuan di titik-titik kunci.

## Input yang Dibutuhkan

Sebelum mulai menyusun materi, skill akan menanyakan:

- **Topik utama** presentasi
- **Target audiens** (profesi, level, demografi)
- **Tujuan presentasi**
- **Call To Action (CTA)** — satu tindakan konkret
- **Durasi presentasi**
- **Gaya penyampaian** (formal / santai / inspiratif / teknikal / storytelling)

## Struktur Repo

```
arief-ide/
├── .agents/
│   └── skills/
│       └── arief-ide/
│           └── SKILL.md
├── .github/
│   └── workflows/
│       ├── validate-skill.yml      # CI: validate SKILL.md on push/PR
│       └── release.yml             # Release: tag + GitHub Release on manual trigger
├── scripts/
│   └── validate_skill.py           # SKILL.md validator
├── .gitignore
├── LICENSE
└── README.md
```

Mengikuti [`.agents` skill standard](https://agents.md) sehingga kompatibel dengan Devin CLI, Windsurf, dan tools lain yang mendukung standar tersebut.

## Releases

Lihat halaman [Releases](https://github.com/arief-drip/arief-ide/releases) untuk daftar versi dan changelog.

### Install versi spesifik

```bash
# Ganti vX.Y.Z dengan versi yang tersedia (lihat halaman Releases)
git clone --branch vX.Y.Z https://github.com/arief-drip/arief-ide.git /tmp/arief-ide
mkdir -p ~/.config/devin/skills
cp -r /tmp/arief-ide/.agents/skills/arief-ide ~/.config/devin/skills/
```

Atau download `SKILL.md` langsung dari asset release tanpa clone:

```bash
mkdir -p ~/.config/devin/skills/arief-ide
curl -fsSL https://github.com/arief-drip/arief-ide/releases/latest/download/SKILL.md \
  -o ~/.config/devin/skills/arief-ide/SKILL.md
```

### Membuat release baru (maintainer)

Release dibuat via **manual trigger** (workflow_dispatch), bukan auto per push. Jalankan via GitHub UI atau `gh` CLI:

```bash
gh workflow run release.yml \
  --repo arief-drip/arief-ide \
  --field version=v1.1.0 \
  --field title="Tambah tahap visual recommendation" \
  --field prerelease=false \
  --field notes="Rilis ini menambahkan..."
```

Workflow akan:
1. Validasi `SKILL.md` lewat `scripts/validate_skill.py`
2. Cek format version (semver `vMAJOR.MINOR.PATCH`)
3. Cek tag belum dipakai
4. Generate changelog otomatis dari git log sejak tag terakhir
5. Buat tag `vX.Y.Z`
6. Buat GitHub Release dengan notes + changelog + instruksi install
7. Attach `SKILL.md` sebagai release asset

Versioning mengikuti [Semantic Versioning](https://semver.org/):
- **MAJOR** — perubahan breaking pada struktur skill (workflow tahap berubah, input field berubah)
- **MINOR** — penambahan tahap/fitur baru (backward compatible)
- **PATCH** — perbaikan prompt, typo, tweak kecil

## Lisensi

MIT — lihat [LICENSE](LICENSE).
