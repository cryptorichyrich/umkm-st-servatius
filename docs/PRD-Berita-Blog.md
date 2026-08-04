# PRD: Sistem Berita & Blog UMKM St. Servatius

> **Versi:** 2.0 — 4 Agustus 2026
> **Status:** Implemented — Phase 1-4 complete, gaps closing
> **Author:** Hermes (untuk Bio)

---

## 1. Ringkasan Eksekutif

Platform direktori UMKM Paroki St. Servatius saat ini berfokus pada listing bisnis, produk, bazar, dan sistem review. Dokumen ini menambahkan dua modul konten baru:

| Modul | Pengelola | Tujuan |
|-------|-----------|--------|
| **Berita** | Admin UMKM | Pengumuman paroki, berita komunitas, info acara — satu arah (broadcast) |
| **Blog** | Anggota UMKM (tulis) → Blogger/Editor (moderasi) | Artikel opini/tips/cerita UMKM — tampil di company profile + halaman Blog publik |

Keduanya menggunakan **WYSIWYG editor** yang sudah ada (`WysiwygEditor.tsx`).

---

## 2. Sistem Berita

### 2.1 Konsep

Halaman berita untuk peserta dan umat UMKM. Dikelola penuh oleh **admin**. Berfungsi seperti "mading digital paroki" — pengumuman, berita kegiatan, info bazar, pengumuman paroki.

### 2.2 Database Schema

```sql
-- Tabel kategori berita (admin bisa CRUD)
CREATE TABLE news_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    icon        TEXT DEFAULT '📰',
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Tabel berita
CREATE TABLE news (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id     UUID REFERENCES news_categories(id) ON DELETE SET NULL,
    title           TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    excerpt         TEXT DEFAULT '',          -- ringkasan singkat untuk card/list
    content         TEXT DEFAULT '',          -- HTML dari WYSIWYG editor
    cover_image     TEXT DEFAULT '',          -- URL gambar cover
    author_id       UUID REFERENCES auth.users(id),
    status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
    is_pinned       BOOLEAN DEFAULT false,    -- pin ke atas di homepage/berita
    published_at    TIMESTAMPTZ,
    view_count      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Index untuk performa listing
CREATE INDEX idx_news_status_published ON news(status, published_at DESC);
CREATE INDEX idx_news_category ON news(category_id);
```

### 2.3 Kategori Berita (Configurable)

Admin dapat membuat, mengubah nama, dan menghapus kategori berita melalui panel admin. Contoh kategori awal:

| Kategori | Slug | Icon |
|----------|------|------|
| Pengumuman Paroki | `pengumuman-paroki` | 📢 |
| Kegiatan UMKM | `kegiatan-umkm` | 🏪 |
| Info Bazar | `info-bazar` | 🎪 |
| Berita Komunitas | `berita-komunitas` | 👥 |
| Tips & Edukasi | `tips-edukasi` | 💡 |

Kategori berita **terpisah** dari kategori UMKM (categories table). Kategori berita khusus untuk konten editorial.

### 2.4 Alur Admin (Berita)

```
Admin Panel → Tab "Berita" → CRUD berita
  ├── Buat berita baru (judul, kategori, excerpt, cover image, content WYSIWYG)
  ├── Edit berita (langsung publish, tidak perlu moderasi — admin trusted)
  ├── Pin/unpin berita
  ├── Archive berita lama
  └── Hapus berita

Admin Panel → Tab "Kategori Berita" → CRUD kategori
  ├── Tambah kategori (nama → auto-generate slug)
  ├── Ubah nama kategori
  └── Hapus kategori (news.category_id → SET NULL)
```

### 2.5 Halaman Publik

| URL | Halaman | Konten |
|-----|---------|--------|
| `/berita` | List berita semua kategori | Grid card + filter kategori + search + pagination |
| `/berita/[slug]` | Detail berita | Cover image + judul + kategori badge + tanggal + content WYSIWYG + share buttons |
| `/berita/kategori/[slug]` | List berita per kategori | Filter by news_categories.slug |

### 2.6 SEO (Auto-Generated)

Mengikuti pola SEO auto-generation yang sudah ada:

- **Title:** `{news.title} | Paroki St. Servatius`
- **Description:** `stripHtml(news.excerpt || news.content).truncate(155)`
- **OG Image:** `news.cover_image`
- **JSON-LD:** `NewsArticle` schema (headline, datePublished, author, image)

---

## 3. Sistem Blog

### 3.1 Konsep

Anggota UMKM yang sudah punya bisnis **approved** dapat menulis artikel. Artikel tampil di:

1. **Company profile UMKM** (`/umkm/[slug]`) — section "Artikel dari {nama UMKM}"
2. **Halaman Blog publik** (`/blog`) — semua artikel dari semua UMKM

Kategori blog **mengikuti kategori UMKM** (categories table). Artinya, jika UMKM punya kategori "Kuliner", artikelnya masuk kategori "Kuliner" di Blog.

### 3.2 Database Schema

```sql
CREATE TABLE blog_posts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    category_id         UUID REFERENCES categories(id),  -- sama dengan kategori UMKM
    title               TEXT NOT NULL,
    slug                TEXT NOT NULL UNIQUE,
    excerpt             TEXT DEFAULT '',
    content             TEXT DEFAULT '',          -- HTML dari WYSIWYG editor
    cover_image         TEXT DEFAULT '',
    status              TEXT DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected','archived')),
    rejection_note      TEXT DEFAULT '',
    re_review_reason    TEXT,                     -- set when approved post edited with photo/link changes
    published_at        TIMESTAMPTZ,
    view_count          INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_blog_business ON blog_posts(business_id);
CREATE INDEX idx_blog_status_published ON blog_posts(status, published_at DESC);
CREATE INDEX idx_blog_category ON blog_posts(category_id);
```

### 3.3 Role: Blogger / Editor

Tambahkan role baru ke enum `user_role`:

```sql
ALTER TYPE user_role ADD VALUE 'blogger';
```

| Role | Hak Blog |
|------|----------|
| `admin` | Semua hak (bisa tulis berita, moderasi blog, manage kategori) |
| `blogger` | Moderasi artikel blog (approve/reject/edit) — TIDAK bisa manage berita |
| `member` / `owner` | Tulis artikel blog untuk UMKM miliknya yang sudah approved |

### 3.4 Alur Penulisan Artikel (UMKM Member)

```
Dashboard → Tab "Tulis Artikel"
  ├── Pilih UMKM (jika punya >1 bisnis approved)
  ├── Judul, Kategori (auto = kategori UMKM, bisa override)
  ├── Excerpt (ringkasan untuk card)
  ├── Cover image (upload)
  ├── Content (WYSIWYG editor)
  ├── Save as Draft (bisa edit berkali-kali)
  └── Submit for Review → status: 'pending'
        ↓
  Blogger/Admin melihat di Moderasi Blog
        ↓
  Approve → status: 'approved', published_at = now()
  Reject  → status: 'rejected', rejection_note = alasan
```

### 3.5 Moderasi & Re-Review (CRITICAL)

#### New Post Moderation
Setiap artikel baru yang di-submit → status `pending` → **wajib** di-approve oleh blogger/admin sebelum publish.

#### Edit Re-Review (mirip image re-review yang sudah ada di businesses)

Ketika artikel yang sudah `approved` di-edit:

| Tipe Perubahan | Auto-Publish? | Butuh Re-Moderasi? |
|----------------|---------------|---------------------|
| **Text only** (judul, excerpt, content text) | ✅ Ya — langsung live | ❌ Tidak |
| **Foto/cover image berubah** | ❌ Tidak | ✅ Ya — `re_review_reason = 'image_change'` |
| **Internal link berubah** (tambah/hapus/ubah `<a href>` ke `/umkm/...`, `/produk/...`, `/berita/...`, `/blog/...`) | ❌ Tidak | ✅ Ya — `re_review_reason = 'link_change'` |
| **Foto + Link berubah** | ❌ Tidak | ✅ Ya — `re_review_reason = 'image_and_link_change'` |

**Deteksi internal link:** Scan content HTML untuk tag `<a href="/...">` (relative URLs pointing to internal pages). Bandingkan jumlah dan target URL sebelum vs sesudah edit.

**Implementasi (mengikuti pola `re_review_reason` yang sudah terbukti di BusinessForm):**

1. Saat load artikel untuk edit, simpan `originalCoverImage` + `originalContent` + parse `originalLinks`
2. Saat save, bandingkan:
   - `coverChanged = form.cover_image !== originalCoverImage`
   - `linksChanged = extractInternalLinks(form.content) !== extractInternalLinks(originalContent)`
3. Jika `approved` dan (`coverChanged` atau `linksChanged`):
   - Set `status = 'pending'`, `re_review_reason = ...`
   - Alert user: "Artikel Anda perlu ditinjau ulang karena ada perubahan foto/link"
   - Yellow warning banner real-time saat diff terdeteksi
4. Blogger/Admin: gold badge "📸 Tinjau Ulang — {reason}" di Moderasi Blog
5. Setelah approve, clear `re_review_reason`

### 3.6 Halaman Publik

| URL | Halaman | Konten |
|-----|---------|--------|
| `/blog` | List semua artikel blog | Grid card + filter kategori + search + pagination |
| `/blog/[slug]` | Detail artikel | Cover + judul + author (UMKM name + link) + kategori + tanggal + content WYSIWYG + share buttons |
| `/blog/kategori/[slug]` | List artikel per kategori UMKM | Filter by categories.slug |
| `/umkm/[slug]` | Company profile UMKM | **TAMBAHAN:** section "Artikel dari {UMKM}" — list blog_posts untuk business ini |

### 3.7 SEO (Auto-Generated)

- **Title:** `{post.title} — {businessName} | Blog UMKM Paroki St. Servatius`
- **Description:** `stripHtml(post.excerpt || post.content).truncate(155)`
- **OG Image:** `post.cover_image`
- **JSON-LD:** `BlogPosting` schema (headline, author=UMKM, datePublished, image, publisher)

### 3.8 Storage

Bucket baru: `article-images` (untuk cover images berita + blog posts).

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('article-images', 'article-images', true);

-- RLS policies (pattern yang sama dengan bucket lain)
CREATE POLICY article_images_read ON storage.objects FOR SELECT USING (bucket_id = 'article-images');
CREATE POLICY article_images_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'article-images');
CREATE POLICY article_images_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'article-images');
```

---

## 4. WYSIWYG Editor (Reuse Existing)

Editor yang sudah ada (`WysiwygEditor.tsx`) sudah mendukung: Bold, Italic, Underline, H2, H3, Paragraph, Bullet List, Numbered List, Blockquote, HR, Link, Clear Formatting.

**Enhancement yang dibutuhkan untuk Blog/Berita:**

| Fitur | Status | Catatan |
|-------|--------|---------|
| Image insert (inline) | ❌ Belum ada | Tambah toolbar button "🖼 Gambar" → upload ke `article-images` bucket → insert `<img>` ke content |
| Internal link picker | ❌ Belum ada | Tambah "🔗 Link Internal" → search UMKM/produk/berita → auto-generate `/umkm/[slug]` link |
| H1 tag | Tidak perlu | Judul artikel sudah H1 di page level |
| Table support | ❌ Belum ada | Tambah "▦ Tabel" → insert table 3x3, editable |

**Prioritas:** Image insert + internal link picker adalah yang paling penting karena keduanya trigger re-moderasi (user harus bisa insert gambar dan link ke konten UMKM lain).

---

## 5. Admin Panel — Tab Baru

### 5.1 Tab "Berita" (Admin Only)

- `/admin/berita` (path-based routing, mengikuti pola admin yang sudah ada)
- List semua berita dengan search + filter kategori + filter status
- Row click → modal: view/edit/delete (pattern yang sama dengan Listing tab)
- Form fields: judul, kategori (dropdown news_categories), excerpt, cover image (upload ke `article-images`), content WYSIWYG, status (draft/published), is_pinned
- Tombol "Publish" langsung (admin trusted, tidak perlu moderasi)

### 5.2 Tab "Kategori Berita" (Admin Only)

- `/admin/berita-kategori`
- CRUD sederhana: list kategori + form tambah/edit/hapus
- Mengikuti pattern Kategori tab yang sudah ada untuk UMKM categories

### 5.3 Tab "Moderasi Blog" (Admin + Blogger)

- `/admin/moderasi-blog`
- List artikel dengan `status IN ('pending','rejected')` ATAU `re_review_reason IS NOT NULL`
- Filter: status (all/pending/re-review/rejected), kategori
- Row click → modal: view full content + cover image + author info + approve/reject
- Approve: set status = 'approved', published_at = now(), clear re_review_reason
- Reject: checklist alasan (pattern yang sama dengan rejection verifikasi) + custom note
- Gold badge "📸 Tinjau Ulang — {reason}" untuk re-review items

### 5.4 Tab "Semua Artikel" (Admin + Blogger, read-only management)

- `/admin/artikel`
- List SEMUA blog posts (all statuses) dengan search + filter
- Bisa archive, unpublish, atau hapus artikel (moderation tool)
- View detail (read-only mode)

---

## 6. Dashboard UMKM — Tab "Tulis Artikel"

- `/dashboard/artikel` (Astro page terpisah, mengikuti pola dashboard yang ada)
- **Hanya muncul untuk user dengan ≥1 business yang approved**
- List artikel milik user (draft/pending/approved/rejected) dengan status badges
- Tombol "Tulis Artikel Baru" → form:
  - Pilih UMKM (dropdown, hanya business milik user yang approved)
  - Kategori (auto-set = kategori UMKM yang dipilih, bisa diubah)
  - Judul, Excerpt, Cover image upload
  - Content WYSIWYG
  - Save Draft / Submit for Review
- Edit existing article (dengan re-review detection untuk foto/link changes)
- Status tracking: draft → pending → approved (atau rejected dengan note)

---

## 7. Worker SPA Fallback Updates

Worker (`src/worker.ts`) perlu update untuk handle new dynamic pages:

```
/berita/[slug]      → fallback template page (string-replace slug)
/blog/[slug]        → fallback template page (string-replace slug)
/berita/kategori/*  → serve /berita/kategori/ shell
/blog/kategori/*    → serve /blog/kategori/ shell
```

Pattern sama dengan yang sudah ada untuk `/umkm/*` dan `/produk/*`.

**⚠️ Recurring maintenance item:** Update fallback slugs di worker setelah setiap build yang mengubah data demo.

---

## 8. Sitemap & SEO Updates

### 8.1 Sitemap

`src/pages/sitemap.xml.ts` perlu fetch tambahan:

```
GET /rest/v1/news?select=slug&status=eq.published
GET /rest/v1/blog_posts?select=slug&status=eq.approved
```

Tambah URL: `/berita`, `/berita/[slug]`, `/blog`, `/blog/[slug]`, `/berita/kategori/[slug]`, `/blog/kategori/[slug]`

### 8.2 Robots.txt

Tambah disallow: `/dashboard/artikel`, `/admin/berita`, `/admin/moderasi-blog`, `/admin/artikel`

### 8.3 Homepage Integration

- Section "Berita Terbaru" di homepage (3 berita terbaru)
- Section "Artikel Blog" di homepage (3 artikel blog terbaru)
- Link "Lihat semua" ke `/berita` dan `/blog`

---

## 9. Navigation Updates

Header nav perlu tambahan link:

| Nav Item | URL | Visibility |
|----------|-----|------------|
| Berita | `/berita` | Public |
| Blog | `/blog` | Public |

Dashboard nav tambah:
| Nav Item | URL | Visibility |
|----------|-----|------------|
| ✍️ Tulis Artikel | `/dashboard/artikel` | User with ≥1 approved business |

Admin nav tambah:
| Nav Item | URL | Visibility |
|----------|-----|------------|
| 📰 Berita | `/admin/berita` | Admin only |
| 📝 Kategori Berita | `/admin/berita-kategori` | Admin only |
| 📋 Moderasi Blog | `/admin/moderasi-blog` | Admin + Blogger |
| 📄 Semua Artikel | `/admin/artikel` | Admin + Blogger |

---

## 10. Implementation Priority

### Phase 1: Database + Backend (Foundation)
1. Create tables: `news_categories`, `news`, `blog_posts`
2. Add `blogger` role to `user_role` enum
3. Create `article-images` storage bucket + RLS policies
4. RLS policies for all new tables
5. RPC: `submit_blog_for_review(p_post_id)`, `approve_blog_post(p_post_id)`, `reject_blog_post(p_post_id, p_note)`, `increment_news_views(p_slug)`, `increment_blog_views(p_slug)`

### Phase 2: Berita Module (Admin → Public)
1. Admin panel: Berita tab + Kategori Berita tab
2. Public pages: `/berita`, `/berita/[slug]`, `/berita/kategori/[slug]`
3. Homepage: Berita Terbaru section
4. SEO auto-generation for news pages

### Phase 3: Blog Module (UMKM → Moderation → Public)
1. Dashboard: Tulis Artikel tab
2. WYSIWYG enhancement: image insert + internal link picker
3. Admin panel: Moderasi Blog tab + Semua Artikel tab
4. Re-review detection (photo + internal link change)
5. Public pages: `/blog`, `/blog/[slug]`, `/blog/kategori/[slug]`
6. Company profile: Artikel section
7. SEO auto-generation for blog pages

### Phase 4: Polish
1. Worker SPA fallback updates
2. Sitemap + robots.txt updates
3. Homepage integration (Blog section)
4. Navigation updates
5. Notification system (optional)

---

## 11. Gap Analysis — Open Items to Close

### 11.1 Gaps dalam Scope Ini

| # | Gap | Severity | Notes |
|---|-----|----------|-------|
| G1 | **Notifikasi moderasi** — tidak ada push/email notif saat artikel di-approve/reject | Medium | User harus cek dashboard manual. Bisa defer ke phase berikutnya. |
| G2 | **Notifikasi admin** — admin/blogger tidak dapet notif saat ada artikel baru pending | Medium | Bisa pakai badge count di nav (seperti Laporan tab). |
| G3 | **Draft autosave** — UMKM user dengan IT literacy rendah bisa kehilangan draft jika tab tertutup | Medium | LocalStorage autosave setiap 30 detik. |
| G4 | **Slug collision** — news.slug dan blog_posts.slug keduanya UNIQUE, tapi antar tabel bisa sama | Low | Acceptable — URL prefix berbeda (`/berita/` vs `/blog/`). Tapi validasi di form tetap perlu. |
| G5 | **Image inline di content** — jika UMKM insert gambar di tengah artikel, storage path-nya? | Medium | Simpan di `article-images/{userId}/inline/`. Cleanup orphan saat hapus post. |
| G6 | **Blog category mismatch** — UMKM bisa override kategori, tapi kategori harus valid | Low | Dropdown hanya berisi categories yang ada. Validasi FK. |
| G7 | **Who counts as "blogger"?** — perlu UI untuk admin assign role blogger ke user | Medium | Admin Pengguna tab → edit role → tambah option `blogger`. |
| G8 | **Content sanitization** — WYSIWYG content bisa berisi XSS via `<script>` tag | **High** | Sanitasi HTML saat save: strip `<script>`, `on*` attributes, `javascript:` URLs. Pakai DOMPurify atau server-side regex strip. |
| G9 | **Archive vs Delete** — berita/blog lama, apakah di-archive atau delete? | Low | Archive = status='archived', tidak tampil di public tapi tetap di DB. Delete = hard delete. Sediakan keduanya. |

### 11.2 Gaps Luas (Cross-Platform)

Ini gap yang sudah ada sebelumnya tapi akan semakin relevan dengan konten dinamis:

| # | Gap | Impact | Recommendation |
|---|-----|--------|----------------|
| X1 | **Search global** — tidak ada search yang mencari di berita/blog/business/produk sekaligus | High | Tambah global search bar yang query multiple tables. Priority setelah Berita+Blog live. |
| X2 | **Notification system** — tidak ada notif real-time untuk moderasi, review, bazar | Medium | Push notification via Telegram bot atau email. Defer. |
| X3 | **PWA / offline** — komunitas paroki mungkin akses dari HP dengan koneksi terbatas | Low | Service worker + cache. Nice-to-have. |
| X4 | **Content versioning** — tidak ada history perubahan artikel | Low | Audit log table `content_revisions` untuk track perubahan. Defer. |
| X5 | **Comment system di blog** — pembaca bisa komentar? | Medium | Bisa reuse reviews table pattern atau buat baru. Tanyakan ke Bio. |
| X6 | **Multi-author attribution** — artikel ditulis atas nama UMKM atau orang? | Low | Default: atas nama UMKM (business.name). Bisa tambah author field opsional. |

### 11.3 Resolved Decisions (Answers)

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| Q1 | **Comment di Blog?** | ❌ **No — read-only** untuk Phase 1. | Komentar butuh moderasi tambahan + anti-spam. Blog UMKM adalah profesional content, bukan forum. Defer ke Phase 5 jika ada permintaan. |
| Q2 | **Blog attribution** | **Atas nama UMKM (business.name)**, bukan personal. | Artikel dikaitkan dengan usaha — pembaca tahu UMKM mana yang menulis. Link ke `/umkm/[slug]` di byline. |
| Q3 | **Blogger role** | **Admin tunggal untuk sekarang.** Role `blogger` tersedia jika butuh delegasi. | Platform masih kecil. Admin bisa handle moderasi. Assign `blogger` ke user lain via Admin → Pengguna → edit role jika beban bertambah. |
| Q4 | **Berita: multi-admin?** | **Semua admin** bisa manage berita (role-based, bukan user-specific). | Konsisten dengan semua modul lain. Tidak perlu ownership tracking untuk berita. |
| Q5 | **Blog draft limit** | **Max 10 draft per UMKM.** | Cegah spam/abuse. User harus publish atau hapus draft lama sebelum buat baru. Implementasi: count check sebelum insert. |
| Q6 | **Berita notification** | ❌ **No broadcast untuk Phase 1.** Badge count di navbar saja. | WA broadcast = cost + kompleksitas opt-in. Homepage "Berita Terbaru" section sudah cukup sebagai discovery. Tambah Telegram bot broadcast di Phase 5 jika diminta. |

### 11.4 Remaining Gaps to Close (Action Items)

| # | Gap | Priority | Action | Owner |
|---|-----|----------|--------|-------|
| **G3** | Draft autosave | Medium | **LocalStorage autosave** setiap 30 detik di BlogEditor. Key: `blog_draft_{postId}`. Restore prompt saat reload. | Hermes — next sprint |
| **G8** | XSS sanitization | **High** | **Sanitize saat save** (client-side): strip `<script>`, `on*` attributes, `javascript:` URLs. Gunakan simple regex strip (zero-dependency, sesuai ponytail) sebelum insert ke DB. Double-defense: Supabase RLS + content security policy header di worker. | Hermes — immediate |
| **G2** | Admin notif badge | Low | **Badge count** di Admin nav untuk pending blog posts. Query: `SELECT count(*) FROM blog_posts WHERE status='pending'`. Poll setiap 60 detik. | Defer |
| **X1** | Global search | Medium | **Search bar di homepage** (sudah ada untuk produk/UMKM). Extend untuk query `news` + `blog_posts` tables. UNION search results. | Phase 5 |
| **G5** | Inline image cleanup | Low | Orphan images di `article-images` saat post dihapus. **Skip untuk sekarang** — storage cost minimal. Cron job purge bisa ditambah kemudian. | Defer |

### 11.5 XSS Sanitization Spec (G8 — Immediate)

```typescript
// src/lib/sanitize.ts — zero-dependency HTML sanitizer
// Strip dangerous elements/attributes before saving WYSIWYG content

export function sanitizeHtml(html: string): string {
  return html
    // Remove <script> blocks entirely
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove <iframe>, <object>, <embed>
    .replace(/<\/?(iframe|object|embed)\b[^>]*>/gi, '')
    // Remove on* event handler attributes (onclick, onload, onerror, etc.)
    .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Remove javascript: URLs in href/src
    .replace(/(href|src)\s*=\s*["']javascript:[^"']*["']/gi, '')
    // Remove data: URLs in src (prevent data URI exploits, except for images)
    .replace(/src\s*=\s*["']data:(?!image\/)[^"']*["']/gi, '');
}
```

**Usage:** Call `sanitizeHtml(content)` sebelum `supabase.from('news').insert()` atau `blog_posts.insert/update`.

---

## 12. Technical Decisions Log

| Decision | Rationale |
|----------|-----------|
| Berita & Blog sebagai tabel terpisah | Content type berbeda (broadcast vs user-generated), alur moderasi berbeda |
| Kategori berita terpisah dari kategori UMKM | Kategori UMKM = jenis bisnis. Kategori berita = jenis konten editorial. Mixing them = confusion |
| Blog kategori = kategori UMKM | Artikel UMKM secara natural berkaitan dengan jenis usahanya. Kuliner UMKM → tips kuliner |
| WYSIWYG reuse existing | Zero-dependency, sudah teruji di produk. Tinggal enhance dengan image + internal link |
| Re-review pattern reuse | Sudah terbukti untuk business image changes. Logika identik untuk blog posts |
| `blogger` role baru | Pemisahan tugas: admin manage semua, blogger khusus moderasi konten |
| Path-based admin routing (`/admin/berita`) | Konsisten dengan semua admin tabs yang sudah ada |
| Dashboard tab terpisah (`/dashboard/artikel`) | Konsisten dengan Bio's preference untuk separate pages |
| Sanitize HTML on save (G8) | WYSIWYG content = user input = trust boundary. XSS prevention mandatory |
