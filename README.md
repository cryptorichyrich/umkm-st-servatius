# Direktori UMKM Paroki

Platform "Yellow Pages Paroki" untuk mempromosikan UMKM umat paroki.

## Tech Stack

- **Frontend:** Astro 5 + React Islands + Tailwind CSS v4
- **Backend:** Supabase (Postgres + Auth + Storage)
- **Hosting:** Cloudflare Pages (gratis)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Supabase

1. Buka [Supabase Dashboard](https://supabase.com/dashboard)
2. Buat project baru: `paroki-umkm` (region: Southeast Asia)
3. Buka SQL Editor → paste isi `supabase/migrations/001_initial_schema.sql` → Run
4. Buka Settings → API → copy `Project URL` dan `anon public key`

### 3. Konfigurasi Environment

```bash
cp .env.example .env
```

Edit `.env`:
```
PUBLIC_SUPABASE_URL=https://xxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJxxx
```

### 4. Setup Admin User

Setelah mendaftar akun pertama (via halaman `/daftar`), ubah role menjadi admin:

```sql
-- Di Supabase SQL Editor
UPDATE profiles SET role = 'admin' WHERE email = 'email-anda@example.com';
```

### 5. Jalankan

```bash
# Development
npm run dev

# Build untuk production
npm run build

# Preview production build
npm run preview
```

## Struktur Halaman

| Route | Deskripsi |
|-------|-----------|
| `/` | Homepage dengan kategori & UMKM pilihan |
| `/direktori` | Browse semua UMKM dengan search & filter |
| `/kategori/[slug]` | Browse by kategori |
| `/umkm/[slug]` | Detail page UMKM |
| `/daftar` | Registrasi akun |
| `/masuk` | Login |
| `/dashboard` | Dashboard pelaku UMKM |
| `/dashboard/baru` | Submit listing baru |
| `/dashboard/edit?id=X` | Edit listing |
| `/admin` | Admin panel (moderasi, kategori) |

## Deploy ke Cloudflare Pages

1. Push repo ke GitHub
2. Connect ke Cloudflare Pages
3. Build command: `npm run build`
4. Output directory: `dist`
5. Set environment variables di Cloudflare dashboard

## Database Schema

Lihat `docs/PRD.md` untuk PRD lengkap dan `supabase/migrations/` untuk SQL.

## Lisensi

Private — Paroki only.
