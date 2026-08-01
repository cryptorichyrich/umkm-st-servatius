# PRD — Direktori UMKM Paroki

> **Status:** Draft v1.0 — Menunggu Approval  
> **Tanggal:** 1 Agustus 2026  
> **Nama Proyek:** Direktori UMKM Paroki (subject to change)  

---

## 1. Problem Statement

Umat di paroki yang menjalankan usaha (warung, jasa, kerajinan, kuliner, dll) tidak memiliki platform terpusat untuk mempromosikan bisnis mereka kepada sesama umat paroki. Akibatnya:

- Pelaku usaha tidak terlihat → kehilangan potensi customer dari komunitas sendiri
- Umat yang butuh barang/jasa tidak tahu ada siapa di paroki yang menyediakannya
- Tidak ada rasa saling mendukung ekonomi komunitas paroki

**Visi:** Platform digital "Yellow Pages Paroki" tempat seluruh UMKM paroki terdaftar, mudah dicari, dan saling mendukung.

---

## 2. Target Users

| User | Kebutuhan |
|------|-----------|
| **Pelaku UMKM** | Daftarkan usaha, upload foto, update info, terlihat oleh calon pembeli |
| **Umat/Pembeli** | Cari UMKM berdasarkan kategori/area, lihat kontak, hubungi via WhatsApp |
| **Admin Paroki** | Kurasi/moderasi listing, kelola kategori, fitur UMKM unggulan |

---

## 3. Fitur MVP

### 3.1 Public (tanpa login)

| Fitur | Detail |
|-------|--------|
| **Direktori Browse** | Grid card UMKM dengan foto, nama, kategori, area |
| **Pencarian** | Search by nama usaha / deskripsi |
| **Filter** | By kategori, by wilayah/stasi paroki |
| **Sort** | Terbaru, nama A-Z, featured |
| **Detail Page** | Halaman individual: foto galeri, deskripsi, kontak (WA/telepon), alamat, jam buka, social media |
| **Tombol WhatsApp** | Direct link `wa.me` dengan pesan template |
| **Kategori Page** | Browse by kategori tertentu (e.g. `/kategori/kuliner`) |

### 3.2 Pelaku UMKM (butuh login)

| Fitur | Detail |
|-------|--------|
| **Registrasi** | Email + password (Supabase Auth) |
| **Login** | Email + password |
| **Dashboard** | Lihat semua listing miliknya + status (draft/pending/approved/rejected) |
| **Submit Listing** | Form: nama usaha, deskripsi, kategori, kontak, area, foto (logo + galeri), social media, jam buka |
| **Edit Listing** | Update listing yang sudah approved (perlu re-approve jika info penting berubah) |
| **Upload Foto** | Logo usaha + hingga 6 foto produk/toko (Supabase Storage) |

### 3.3 Admin Paroki (role-based)

| Fitur | Detail |
|-------|--------|
| **Moderasi** | Approve / reject listing yang status-nya `pending` |
| **Kelola Kategori** | CRUD kategori (nama, slug, icon) |
| **Featured** | Tandai UMKM unggulan (tampil di carousel homepage) |
| **Manage Listings** | Edit/suspend/hapus listing manapun |
| **View Stats** | Jumlah listing per kategori, per status, total UMKM terdaftar |

---

## 4. Alur Status Listing

```
                    ┌──────────────────────┐
                    │   DRAFT (owner       │
                    │   belum submit)      │
                    └──────────┬───────────┘
                               │ owner click "Submit for Review"
                               ▼
                    ┌──────────────────────┐
                    │   PENDING            │
                    │   (menunggu admin)   │
                    └──────┬───────┬───────┘
                           │       │
              admin approve │       │ admin reject
                           ▼       ▼
              ┌──────────────┐  ┌──────────────┐
              │  APPROVED    │  │  REJECTED    │
              │  (published) │  │  (hidden,    │
              │              │  │   owner can  │
              │              │  │   edit &     │
              │              │  │   resubmit)  │
              └──────────────┘  └──────────────┘
```

**Aturan visibility:** Hanya listing `approved` yang tampil di public directory. `draft`, `pending`, `rejected` hanya terlihat oleh pemilik dan admin.

---

## 5. Database Schema (Supabase Postgres)

### Tabel: `categories`
```sql
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  icon        TEXT,              -- emoji atau nama icon
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### Tabel: `profiles`
```sql
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'owner',  -- 'owner' | 'admin'
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### Tabel: `businesses`
```sql
CREATE TABLE businesses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  description     TEXT,
  category_id     UUID REFERENCES categories(id),
  whatsapp        TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  area            TEXT,          -- Wilayah/Stasi paroki (e.g. "Wilayah 1", "Stasi St. Yosef")
  instagram       TEXT,
  facebook        TEXT,
  tiktok          TEXT,
  operating_hours JSONB,         -- { "mon": "08:00-17:00", "tue": "...", ... }
  logo_url        TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',  -- draft|pending|approved|rejected
  is_featured     BOOLEAN DEFAULT FALSE,
  rejection_note  TEXT,          -- alasan ditolak (untuk feedback ke owner)
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

### Tabel: `business_images`
```sql
CREATE TABLE business_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  image_url     TEXT NOT NULL,
  caption       TEXT,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### Tabel: `admin_actions` (audit log)
```sql
CREATE TABLE admin_actions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID NOT NULL REFERENCES profiles(id),
  business_id   UUID REFERENCES businesses(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,    -- approve|reject|feature|unfeature|suspend|edit
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. Row Level Security (RLS) Policies

| Operasi | Aturan |
|---------|--------|
| **Public READ businesses** | `status = 'approved'` → semua bisa baca |
| **Owner READ own** | `owner_id = auth.uid()` → baca listing miliknya (semua status) |
| **Owner INSERT/UPDATE** | `owner_id = auth.uid()` → hanya bisa create/update miliknya |
| **Owner UPDATE status** | ❌ Owner tidak bisa approve sendiri. Status field di-handle via RPC/admin only |
| **Admin READ/WRITE all** | `role = 'admin'` di profiles → akses penuh |
| **Storage bucket** | `business-images` — owner upload ke folder sendiri, public read |

---

## 7. Struktur Halaman & Routes

```
/                           → Homepage: hero + featured UMKM + kategori grid + search bar
/direktori                  → Browse semua UMKM (dengan filter & search)
/direktori?q=&kategori=&area= → Hasil filter
/kategori/[slug]            → Browse by kategori
/umkm/[slug]                → Detail page UMKM individual

/daftar                     → Registrasi akun baru
/masuk                      → Login

/dashboard                  → Owner dashboard (list UMKM miliknya)
/dashboard/baru             → Form submit listing baru
/dashboard/edit/[id]        → Edit listing

/admin                      → Admin dashboard
/admin/moderasi             → Antrian pending listings
/admin/kategori             → CRUD kategori
/admin/listing              → Manage semua listings
```

---

## 8. Tech Stack

| Layer | Teknologi | Alasan |
|-------|-----------|--------|
| **Frontend** | Astro + React Islands | SEO-friendly SSG untuk public pages, React islands untuk dashboard interaktif |
| **Styling** | Tailwind CSS v4 | Utility-first, cepat, konsisten |
| **Backend/DB** | Supabase (Postgres) | Free tier: 500MB DB, 50K MAU auth, 1GB storage |
| **Auth** | Supabase Auth | Email/password, built-in session management |
| **Image Storage** | Supabase Storage | Upload langsung, CDN, transform otomatis |
| **Hosting** | Cloudflare Pages | Gratis, unlimited bandwidth, edge network |
| **Domain** | Custom (user beli sendiri) | Cloudflare DNS |

**Kenapa Astro bukan Next.js?**
- 80% trafik = public directory browsing (read-only) → SSG/SSR Astro lebih cepat
- SEO jauh lebih kuat (penting untuk "yellow pages")
- 20% interaktif (dashboard, forms) → React islands cukup
- Cloudflare Pages deploy Astro native

---

## 9. User Flows

### Flow: Pelaku UMKM Mendaftar & Submit

```
1. Buka website → klik "Daftarkan Usaha Anda"
2. Registrasi (email + password) → auto-login
3. Isi profil (nama lengkap, nomor HP)
4. Klik "Tambah Usaha Baru"
5. Isi form: nama usaha, deskripsi, kategori, area, kontak, social media
6. Upload logo + foto produk
7. Set jam operasional
8. Klik "Submit untuk Review" → status: PENDING
9. (Tunggu admin approve)
10. Notifikasi: listing approved → tampil di direktori publik
```

### Flow: Umat Mencari UMKM

```
1. Buka website
2. Search "katering" atau pilih kategori "Kuliner"
3. Lihat hasil dalam grid card
4. Klik card → halaman detail
5. Lihat foto, deskripsi, kontak
6. Klik tombol WhatsApp → langsung chat
```

### Flow: Admin Moderasi

```
1. Login dengan akun admin
2. Buka /admin/moderasi
3. Lihat daftar pending listings
4. Review detail → Approve atau Reject (dengan catatan)
5. Listing approved langsung publish
```

---

## 10. Kategori UMKM (Default Seed)

| Kategori | Icon |
|----------|------|
| Kuliner & Minuman | 🍜 |
| Jasa Service | 🔧 |
| Kerajinan Tangan | ✂️ |
| Fashion & Pakaian | 👕 |
| Kecantikan & Kesehatan | 💄 |
| Elektronik & Gadget | 📱 |
| Pendidikan & Les | 📚 |
| Pertanian & Peternakan | 🌱 |
| Otomotif | 🚗 |
| Lainnya | 📦 |

---

## 11. Design Principles

1. **Mobile-first** — Mayoritas user akses via HP
2. **Cepat** — Lighthouse 90+ di semua metrik
3. **Sederhana** — Tidak overwhelming, fokus pada fungsi direktori
4. **Warm & komunitas** — Bukan corporate cold, tapi hangat dan ramah paroki
5. **Accessible** — Bisa dipakai semua umat termasuk yang kurang melek tech

---

## 12. Roadmap (Post-MVP)

| Fase | Fitur |
|------|-------|
| **v1.1** | Rating/review UMKM oleh umat |
| **v1.2** | Peta interaktif (Google Maps embed) |
| **v1.3** | Banner promo (UMKM bisa pasang promo mingguan) |
| **v1.4** | Multi-paroki support (satu platform untuk beberapa paroki) |
| **v2.0** | Marketplace (transaksi langsung di platform) |

---

## 13. Yang TIDAK Ada di MVP (YAGNI)

- ❌ Payment/checkout (ini direktori, bukan marketplace)
- ❌ Review/rating ( kompleks, butuh moderasi terpisah)
- ❌ Chat in-app (WhatsApp sudah cukup)
- ❌ Mobile app (website responsive sudah cukup)
- ❌ Analytics dashboard kompleks (count sederhana di admin cukup)
- ❌ Multi-language (Indonesia only untuk awal)

---

## 14. Deployment Plan

```
GitHub Repo → Cloudflare Pages (auto-deploy on push)
                ↓
            Astro SSG build
                ↓
            Supabase (DB + Auth + Storage)
```

- Frontend: Cloudflare Pages (gratis, unlimited bandwidth)
- Backend: Supabase Free Tier (500MB DB, 1GB storage, 50K MAU)
- Domain: User beli via Cloudflare/Niagahoster (~Rp 150K/tahun untuk .com)

---

## 15. Open Questions (perlu konfirmasi user)

1. **Nama domain yang diinginkan?** (e.g., `umkmparokixxx.com`)
2. **Nama paroki?** (untuk branding site)
3. **Apakah perlu fitur "Wilayah/Stasi" sebagai filter?** (paroki biasanya terbagi wilayah)
4. **Limit foto per listing?** (proposal: 1 logo + 6 foto galeri)
5. **Apakah perlu approval email notification?** (Supabase bisa kirim email, tapi free tier terbatas)
