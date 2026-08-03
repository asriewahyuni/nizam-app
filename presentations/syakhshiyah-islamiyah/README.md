# Presentasi: Syakhshiyah dan Syakhshiyah Islamiyyah

Materi kajian 17 slide (pembuka + 16 isi) dengan desain klasik manuskrip —
kertas parchment, aksen emas, dan ilustrasi sketsa tangan (hand-drawn) yang
seluruhnya berupa objek/benda (buku, kunci, kompas, timbangan, lentera, dll.)
tanpa menggambarkan figur manusia maupun hewan.

## Berkas

| Berkas | Keterangan |
|---|---|
| `index.html` | Presentasi HTML mandiri (single-file). Buka langsung di browser. |
| `Syakhshiyah-Islamiyah.pptx` | Versi PowerPoint dengan desain & konten yang sama. |
| `build/` | Skrip generator (Node.js) — sumber tunggal konten & desain. |
| `assets/icons/` | Ilustrasi sketsa (SVG) per slide. |
| `assets/icons-png/` | Rasterisasi PNG dari ilustrasi, dipakai oleh PPTX. |

## Navigasi HTML

- Klik sepertiga kiri/kanan layar, tombol panah, atau `←`/`→`/`Space` untuk pindah slide.
- Tombol **Catatan Presenter** (atau tombol `N`) menampilkan narasi presenter per slide.
- Cetak (`Ctrl+P`) untuk mode satu slide per halaman lengkap dengan catatan presenter di bawahnya.

## Build ulang

```bash
npm install   # sekali saja (pptxgenjs, sharp, roughjs)
node build/gen-assets.mjs   # generate ulang ilustrasi SVG + PNG
node build/build-html.mjs   # generate ulang index.html
node build/build-pptx.mjs   # generate ulang Syakhshiyah-Islamiyah.pptx
```

Konten (judul, bullet, narasi presenter) ada satu-satunya di `build/content.mjs`
— ubah di sana, lalu jalankan ulang kedua build script agar HTML dan PPTX tetap konsisten.
