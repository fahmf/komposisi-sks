# Cadangan & Sinkronisasi Cloud (Opsional)

Aplikasi berjalan **100% lokal** secara bawaan (data di `localStorage`). Bagian ini
opsional: mengaktifkan cadangan ke cloud + sinkronisasi antar perangkat memakai
[Supabase](https://supabase.com). Modelnya **last-write-wins** — seluruh data
disimpan sebagai satu baris `jsonb` per pengguna (cadangan & multi-perangkat,
bukan kolaborasi real-time).

## 1. Buat proyek Supabase

1. Daftar di supabase.com, buat **New project** (free tier cukup).
2. Tunggu provisioning selesai.

## 2. Terapkan skema

Buka **SQL Editor** di dashboard Supabase, tempel isi
[`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql), lalu **Run**.
Ini membuat tabel `app_state` dan kebijakan **Row Level Security** sehingga tiap
pengguna hanya bisa mengakses datanya sendiri.

> Pakai Supabase CLI? `supabase link` lalu `supabase db push`.

## 3. (Opsional) Atur konfirmasi email

Default Supabase mengaktifkan konfirmasi email saat pendaftaran. Untuk pemakaian
internal Anda bisa mematikannya di **Authentication → Providers → Email**
(*Confirm email*), atau biarkan aktif dan minta pengguna mengeklik tautan konfirmasi.

## 4. Isi variabel lingkungan

Ambil dari **Project Settings → API**: `Project URL` dan `anon public` key.

Untuk dev lokal, salin `.env.example` menjadi `.env.local`:

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> `anon key` memang bersifat publik; keamanan data dijaga oleh RLS, bukan oleh
> kerahasiaan key.

## 5. Deploy (GitHub Pages)

Vite menyuntik env saat build. Tambahkan dua **repository secret** (Settings →
Secrets and variables → Actions): `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
Workflow `deploy.yml` sudah membaca keduanya. Jika tidak diisi, build tetap jalan
dalam mode lokal.

## 6. Pakai

Buka menu **Ekspor & Cadangan → Cadangan cloud**. Masuk/daftar, lalu:

- **Unggah ke cloud** — menimpa salinan cloud dengan data perangkat ini.
- **Ambil dari cloud** — menimpa data perangkat ini dengan salinan cloud.

Karena last-write-wins, biasakan **Unggah** setelah mengubah, dan **Ambil** saat
berpindah perangkat, agar tidak saling menimpa.
