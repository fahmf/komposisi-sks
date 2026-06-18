# Komposisi SKS

Aplikasi web untuk membantu **pembagian SKS pengajar setiap semester** di lembaga
bahasa Arab — jenjang **Pemula (ILP)** dan **Lanjutan (ILL)**, bagian **Putra** dan
**Putri**. Aplikasi menghitung jumlah kelas yang dibutuhkan, lalu **menyusun
penugasan pengajar secara otomatis** sesuai semua batasan, dan bisa Anda
sesuaikan manual sebelum dibagikan.

Berjalan **sepenuhnya di browser** (tanpa server). Data tersimpan di perangkat
(localStorage) dan bisa diekspor/diimpor sebagai file JSON untuk cadangan atau
pindah perangkat. Tampilan responsif — nyaman dibuka di HP maupun laptop.

## Fitur

- **Kalkulator jumlah kelas** — dari jumlah mahasiswa terdaftar + perkiraan
  mundur (%), merekomendasikan jumlah kelas agar tiap kelas pas di 30–45 orang.
- **Penyusunan otomatis** penugasan pengajar yang menghormati:
  - Pemisahan gender (kelas putra hanya diajar pengajar laki-laki, dan sebaliknya).
  - Kuota maksimal SKS tiap pengajar (mis. yang berbagi dengan divisi lain).
  - Kualifikasi: pengajar hanya diberi mata kuliah yang ia kuasai.
  - Maksimal mengajar **mata kuliah yang sama di 2 kelas** (tahfidz dikecualikan).
  - Batas SKS pengajar dalam **satu kelas** agar tiap kelas diisi beberapa
    pengajar (tahfidz dikecualikan).
  - Target **≥ 24 SKS** per pengajar (otomatis dilonggarkan bila kuotanya < 24).
- **Edit manual + validasi langsung** — ubah penugasan per sel, lihat peringatan
  (error merah / peringatan kuning) dan **meter beban SKS** tiap pengajar
  secara real-time. Penugasan manual bisa **dikunci** agar tidak diubah saat
  penyusunan otomatis dijalankan ulang.
- **Diagnosa kekurangan pengajar** — bila tenaga pengajar kurang, aplikasi
  menyebutkan persis kekurangannya (mis. "butuh 1 pengajar Qiraah Putra").
- **Output**: tampilan jadwal per-pengajar, **Cetak / PDF**, dan **Excel/CSV**.
- Kurikulum 4 jenjang/semester sudah terisi sesuai panduan (bisa diedit).

## Menjalankan secara lokal

```bash
npm install
npm run dev      # buka http://localhost:5173
```

Perintah lain:

```bash
npm run build    # type-check + build produksi ke dist/
npm test         # jalankan unit & integration test (solver + store)
npm run preview  # pratinjau hasil build
```

## Deploy (GitHub Pages)

Workflow `.github/workflows/deploy.yml` mem-build dan mendeploy otomatis.
Sekali saja: buka **Settings → Pages → Build and deployment → Source: GitHub
Actions**. Setelah itu setiap push ke branch yang terdaftar akan publish ke
`https://<user>.github.io/komposisi-sks/`. `base` build memakai path relatif dan
routing memakai hash, jadi cocok untuk GitHub Pages tanpa konfigurasi tambahan.

## Catatan penyimpanan data

Data hanya ada di browser perangkat ini. **Ekspor cadangan JSON secara berkala**
(menu *Ekspor & Cadangan*) agar tidak hilang bila riwayat situs dibersihkan, dan
untuk memindahkannya ke perangkat lain.

## Arsitektur singkat

- **React + Vite + TypeScript**, **Tailwind CSS**, **React Router (hash)**.
- **Zustand** (+ persist ke localStorage), **Zod** untuk validasi impor.
- Logika inti murni & teruji di `src/solver/`:
  - `classCount.ts` — kalkulator jumlah kelas.
  - `slots.ts` — membentuk slot (kelas × mata kuliah).
  - `assign.ts` — penyusunan: *greedy* + *local-search repair* (deterministik).
  - `validate.ts` — laporan validasi & beban pengajar.
- Ekspor Excel memakai SheetJS yang dimuat secara *lazy* (code-split).
