# UMKM St. Servatius — Comprehensive Gap Analysis

**Date:** August 4, 2026  
**Project:** Paroki UMKM St. Servatius  
**Supabase:** vfqcydqmwhfelqizxzbi  
**Deployed:** https://umkm-st-servatius.fxwisdom1.workers.dev  

---

## Executive Summary

The platform is architecturally sound with a good feature set (70+ UMKM, 210+ products, bazar, reviews, blog/berita, admin panel). However, several **critical security vulnerabilities** need immediate remediation, primarily around unguarded SECURITY DEFINER functions and unsanitized HTML rendering. SEO is strong with structured data on all detail pages. Performance is acceptable but has room for improvement with bundle optimization and image handling.

**Finding counts:** 5 Critical · 8 High · 11 Medium · 8 Low

---

## 1. Database

### 1.1 Schema Overview
- **22 tables** across public schema, all with RLS enabled ✅
- 29 migrations applied cleanly ✅
- 0 orphaned records detected ✅
- Good FK constraint coverage ✅

| Table | Rows | Notes |
|-------|------|-------|
| businesses | 70 | All approved, 0 pending/rejected |
| products | 210 | All active |
| profiles | 72 | |
| reviews | 1 | Very low adoption |
| favorites | 2 | Very low adoption |
| news | 0 | **Empty — no articles published** |
| blog_posts | 0 | **Empty — no posts published** |
| bazars | 3 | With 15 tables, 6 assignments |

### 1.2 Missing Indexes — `Severity: Medium`
Several foreign key columns lack covering indexes:

| Table | Column | Impact |
|-------|--------|--------|
| admin_actions | admin_id | JOIN to profiles slow |
| admin_actions | business_id | JOIN to businesses slow |
| bazar_assignments | table_id | JOIN to bazar_tables |
| reports | reporter_id | User's reports query |
| verification_requests | reviewed_by | Admin audit trail |
| favorites | business_id | Already has `idx_favorites_business` ✅ |

**Fix:** Add btree indexes on these FK columns.

### 1.3 Function search_path Mutable — `Severity: High`
**22+ SECURITY DEFINER functions** do not have `search_path` set, creating a [search_path injection vector](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).

Affected: `get_business_rating`, `verify_user`, `admin_update_profile`, `approve_blog_post`, `reject_blog_post`, `bulk_seed`, `clone_bazar`, `set_bazar_deadlines`, `create_report`, `submit_owner_reply`, `submit_blog_for_review`, and 10+ others.

**Fix:** `ALTER FUNCTION ... SET search_path = public, pg_temp;` for each.

### 1.4 Empty Content Tables — `Severity: Medium`
`news` (0 rows) and `blog_posts` (0 rows) — the entire Berita and Blog feature is implemented but has no content. This means the homepage news/blog sections render empty, and the sitemap has no article URLs.

**Fix:** Seed initial content or communicate launch to admin team.

---

## 2. Security

### 2.1 CRITICAL: SECURITY DEFINER Functions Executable by Anon — `Severity: Critical`
**Status:** 22 SECURITY DEFINER functions can be executed by the `anon` (unauthenticated) role via Supabase REST API.

**Dangerous functions exposed to public:**

| Function | Risk |
|----------|------|
| `admin_update_profile(p_user_id, ...)` | **Privilege escalation** — anyone can change any user's role to 'admin' |
| `approve_business(p_business_id)` | **Content bypass** — approve any pending listing |
| `reject_business(p_business_id, p_note)` | **Sabotage** — reject any listing |
| `approve_verification(p_request_id, p_note)` | **Identity bypass** — approve any verification request |
| `reject_verification(p_request_id, p_note)` | **Sabotage** — reject verifications |
| `verify_user(p_user_id, p_status, p_note)` | **Direct verification bypass** |
| `approve_blog_post(p_post_id)` | **Content bypass** — publish any draft blog |
| `reject_blog_post(p_post_id, p_note)` | **Content sabotage** |
| `clone_bazar(p_source_id, ...)` | **Resource abuse** — clone bazars |
| `get_admin_profiles()` | **Data leak** — returns all profiles |
| `get_admin_user_detail(p_user_id)` | **PII leak** — full user detail to anon |
| `get_admin_verification_requests()` | **PII leak** — verification data to anon |

While some functions have internal `is_admin()` checks (which would prevent execution), the functions are still *invocable* by anon. The internal check is defense-in-depth, but any check bug would be catastrophic.

**Fix:** Revoke EXECUTE from anon/authenticated for admin functions:
```sql
REVOKE EXECUTE ON FUNCTION admin_update_profile(...) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION approve_business(...) FROM anon, authenticated;
-- ... repeat for all admin-only functions
-- Grant only to authenticated or specific roles
```

### 2.2 CRITICAL: No HTML Sanitization (XSS) — `Severity: Critical`
**5 instances** of `dangerouslySetInnerHTML` render user-generated HTML with **zero sanitization**:

| File | Line | Source |
|------|------|--------|
| `BlogDetail.tsx` | 158 | `post.content` — from UMKM owner blog posts |
| `NewsDetail.tsx` | 242 | `article.content` — from admin news |
| `ProductDetail.tsx` | 213 | `product.rich_description` — from UMKM owners |
| `BlogModeration.tsx` | 658 | Blog preview in admin |
| `NewsManager.tsx` | 994 | News preview in admin |

The WYSIWYG editor (`WysiwygEditor.tsx`) uses `document.execCommand` (deprecated) and allows arbitrary HTML including `<script>` tags via paste or source manipulation. No DOMPurify or sanitize-html is used anywhere.

**Attack vector:** A UMKM owner can inject `<script>` or `<img onerror=...>` into product/blog descriptions. Any visitor to that page would execute the payload — session theft, credential exfiltration, etc.

**Fix:** Install DOMPurify and wrap all dangerouslySetInnerHTML:
```bash
npm install dompurify
```
```tsx
import DOMPurify from 'dompurify';
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
```

### 2.3 HIGH: Profiles Readable by Public — `Severity: High`
**RLS policy `profiles_read_public`** uses `qual: true`, meaning **all profile data** (full_name, phone, role, verification_status, verification_type, verified_at, verified_by, verification_note) is readable by anyone — even unauthenticated users.

**Impact:** Phone numbers and verification notes of all 72 users are publicly accessible via Supabase REST API.

**Fix:** Restrict public read to only safe columns or remove the blanket `true` policy:
```sql
-- Option A: Create a safe view for public display
CREATE VIEW profiles_public AS
  SELECT id, full_name, verification_status, verification_type FROM profiles;
-- Option B: Alter policy to exclude sensitive columns
```

### 2.4 MEDIUM: Leaked Password Protection Disabled — `Severity: Medium`
Auth has HaveIBeenPwned leaked password protection disabled.

**Fix:** Enable in Supabase Dashboard → Auth → Password Security.

### 2.5 LOW: Publishable Key in wrangler.jsonc — `Severity: Low`
The publishable key (`sb_publishable_jph_...`) is in `wrangler.jsonc` which is committed to git. This is the **publishable** key (not secret), so it's acceptable by design, but rotating it would be good practice if the repo is public.

### 2.6 LOW: BusinessDetail Fetches Non-Approved Statuses — `Severity: Low`
`BusinessDetail.tsx:76` queries `.in('status', ['approved', 'pending', 'rejected'])`. While RLS would still block access to non-owned non-approved businesses, the filter is misleading. If RLS policies were ever loosened, this would leak draft/rejected business data.

**Fix:** Change to `.eq('status', 'approved')` and handle owner/admin views separately.

---

## 3. SEO

### 3.1 Strengths ✅
- **JSON-LD structured data** on all detail pages: `LocalBusiness`, `Product`, `NewsArticle`, `WebSite`, `Organization`
- **Dynamic sitemap.xml** fetches all approved businesses, products, news, blog from Supabase at build time
- **robots.txt** properly blocks `/dashboard`, `/admin`, `/daftar`, `/masuk`
- **Canonical URLs** on all pages
- **Open Graph + Twitter Cards** on all pages
- **Auto-generated SEO** titles/descriptions on business and product pages (no manual input required)
- **301 redirects** from `/direktori/*` to `/umkm/*`

### 3.2 Missing Bazar Pages in Sitemap — `Severity: Medium`
Sitemap includes static pages + businesses + products + news + blog, but **omits bazar pages** (`/bazar`). If bazars have SEO value (event pages), they should be included.

**Fix:** Add `/bazar` to static entries in `sitemap.xml.ts`.

### 3.3 Missing `og-default.jpg` Validation — `Severity: Low`
`BaseLayout.astro` references `${baseUrl}/og-default.jpg` as fallback OG image. Need to verify this file exists in `public/` directory.

### 3.4 Hardcoded Base URL — `Severity: Low`
`baseUrl = 'https://umkm-st-servatius.fxwisdom1.workers.dev'` is hardcoded in `BaseLayout.astro`, `sitemap.xml.ts`, `robots.txt.ts`, and 4 detail pages. If domain changes, all need updating.

**Fix:** Use `Astro.site` from astro.config or an environment variable.

### 3.5 Worker Template Fallback Breaks SEO — `Severity: Medium`
When a dynamically routed page isn't pre-rendered (e.g., new UMKM added after build), the worker serves a template page with a **string-replaced title** from a hardcoded template slug. This means:
- Meta description, OG tags, JSON-LD all contain **wrong content** from the template business
- Google sees duplicate/stale meta data for that page

**Fix:** Deploy a rebuild webhook (Supabase → Cloudflare) when content changes, or switch critical pages to SSR/on-demand rendering.

---

## 4. Performance

### 4.1 Large JS Bundles — `Severity: Medium`
| Bundle | Size | Notes |
|--------|------|-------|
| AdminPanel.js | 168 KB | Massive — includes BazarManager, NewsManager, BlogModeration |
| DashboardApp.js | 45 KB | |
| BusinessDetail.js | 30 KB | Loaded on every UMKM detail page |
| ProductManager.js | 24 KB | |
| BusinessForm.js | 22 KB | |

AdminPanel is especially concerning — it loads on the `/admin` page with all sub-components eagerly. React lazy loading and code splitting would reduce this significantly.

**Fix:** Use `React.lazy()` and `Suspense` for AdminPanel sub-components. Consider lazy loading BusinessDetail's review/photo features.

### 4.2 CDN Import in Navbar Script — `Severity: Medium`
`BaseLayout.astro:262` imports Supabase JS from CDN inline:
```js
const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
```
This loads the full Supabase client **twice** — once via the bundled import and once via CDN. It also adds a network dependency to jsdelivr on every page load.

**Fix:** Use the already-bundled supabase client or extract nav auth logic to a proper Astro client script.

### 4.3 Google Fonts from CDN — `Severity: Low`
Fonts loaded via `fonts.googleapis.com` with `preconnect`. Self-hosting would eliminate render-blocking and reduce CLS.

### 4.4 No Image Optimization — `Severity: Medium`
All images (logos, product images, article covers) are served as-is from Supabase Storage or external URLs. No lazy loading beyond `loading="lazy"` on homepage cards. No responsive image sizing, no WebP conversion, no blur-up placeholders.

**Fix:** Consider `@astrojs/image` or Cloudflare Image Resizing for on-the-fly optimization.

### 4.5 Duplicate Product Index — `Severity: Low`
`products` table has both `idx_products_business` and `idx_products_business_id` — duplicate indexes on the same column. One should be dropped.

---

## 5. UX / Accessibility

### 5.1 No Global Error Boundary — `Severity: Medium`
React islands have individual try/catch blocks but there's no error boundary component. If a React island throws during render (e.g., unexpected null from Supabase), the user sees a blank or broken page with no fallback.

**Fix:** Add `<ErrorBoundary>` wrapper around each island.

### 5.2 Loading States — `Severity: Low`
- `SkeletonLoader.tsx` exists ✅
- Most components have loading states with `animate-pulse` ✅
- Some components (e.g., BlogDetail) show only a basic skeleton — could be more informative

### 5.3 Mobile Menu Accessibility — `Severity: Low`
- Mobile menu button has `aria-label="Buka menu"` ✅
- But the menu doesn't trap focus or close on Escape
- Dropdown menus work on hover (mouseenter/mouseleave) — **inaccessible on touch devices** for the Artikel dropdown

**Fix:** Add keyboard navigation (focus trap, Escape to close) and touch-friendly tap-to-open for dropdowns.

### 5.4 No 404 Page — `Severity: Medium`
The worker returns a plain text "Not found" for unmatched routes. There's no branded 404 page with navigation back to main sections.

**Fix:** Create `src/pages/404.astro` with the BaseLayout and helpful links.

### 5.5 Auth Form Password Minimum — `Severity: Low`
Password minimum is 6 characters (`minLength={6}`). Supabase default is 6 but this is very weak for a community platform handling business data.

**Fix:** Increase to minimum 8 characters and add strength validation.

---

## 6. Content Pipeline

### 6.1 Static Generation Model — `Severity: High`
The site uses `output: 'static'` in Astro config. This means:
- `getStaticPaths()` fetches ALL data at build time
- Pages are pre-rendered to HTML
- **No automatic rebuild when data changes in Supabase**

When an admin approves a new UMKM, the page won't exist until the next deploy. The worker's template fallback handles this (imperfectly — wrong SEO meta), but new products/blog/news won't have pages at all.

**Fix options (in order of effort):**
1. **On-demand rebuild**: Webhook from Supabase → Cloudflare Pages/Worker deploy
2. **Hybrid rendering**: Switch to `output: 'hybrid'` in Astro and use SSR for detail pages
3. **Scheduled rebuilds**: Cron-based deploys every N hours (simplest but laggy)

### 6.2 No Rebuild Trigger Mechanism — `Severity: High`
There is no mechanism (webhook, cron, or manual button) to trigger a site rebuild after content changes. Admin must manually run `npm run build && wrangler deploy`.

---

## 7. Feature Gaps vs PRD

Reviewing `docs/PRD-Berita-Blog.md`:

### 7.1 Implemented ✅
- Berita (news) module with categories, CRUD, WYSIWYG, pinning ✅
- Blog module with UMKM-owner writing, moderation workflow, re-review ✅
- Blogger role ✅
- Article images bucket ✅
- Dashboard article management ✅

### 7.2 Gaps

| Feature | PRD Spec | Status | Severity |
|---------|----------|--------|----------|
| Email notifications on blog submission | Implied | **Not implemented** | Medium |
| Blog category filtering on public listing | Expected | **Not implemented** (BlogGrid has search but no category filter) | Medium |
| News category filtering | Expected | **Not verified** in NewsGrid | Medium |
| Reading time estimation | Nice-to-have | **Not implemented** | Low |
| Related articles | Expected | **Not implemented** | Low |
| Comment/reactions on articles | Future | N/A | Low |
| RSS feed | Implied | **Not implemented** | Low |

---

## 8. Infrastructure

### 8.1 Worker Routing — `Severity: Medium`
The worker has a complex multi-strategy routing system:
1. Try exact asset match
2. Try `/path/index.html`
3. Try hardcoded template pages with string replacement
4. SPA fallback for admin/dashboard

**Issues:**
- Template fallback (`TEMPLATES` object at line 98-103) hardcodes specific slugs. If these businesses are deleted from Supabase, the fallback breaks entirely.
- String replacement (`html.split(tplSlug).join(slug)`) is fragile — it replaces ALL occurrences of the template slug, including in CSS class names, JS variable names, or JSON data that might contain the slug.
- No logging/monitoring of fallback hits (indicates stale builds)

**Fix:** Replace template approach with a generic SPA shell that loads the correct content client-side. Or implement on-demand rendering.

### 8.2 Cache Strategy — `Severity: Medium`
- All HTML responses: `Cache-Control: no-cache, no-store, must-revalidate`
- Static assets: default (no explicit cache headers from worker)

**Issues:**
- `no-store` on ALL HTML prevents Cloudflare edge caching, increasing TTFB
- Static JS/CSS assets have hashed filenames (e.g., `AdminPanel.CIZTsqnK.js`) but no `Cache-Control: public, max-age=31536000, immutable` — missing easy performance win

**Fix:** Add long-lived cache headers for `/_astro/*` assets:
```js
if (path.startsWith('/_astro/')) {
  const res = await env.ASSETS.fetch(request);
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(res.body, { status: res.status, headers });
}
```

### 8.3 No Error Monitoring — `Severity: Medium`
No Sentry, LogRocket, or Cloudflare Analytics integration. Worker errors and client-side errors go unnoticed. The `try/catch` blocks in components silently swallow errors (e.g., BaseLayout `catch (e) { // Silently fail }`).

**Fix:** Add Cloudflare Workers Analytics or Sentry integration.

### 8.4 No Rate Limiting — `Severity: Medium**
No rate limiting on auth endpoints (login/register) or public API calls. Combined with the unguarded SECURITY DEFINER functions, this allows brute-force and abuse.

**Fix:** Enable Supabase Auth rate limiting (Dashboard → Auth → Rate Limits) and consider Cloudflare rate limiting rules.

---

## Priority Action Items

### Immediate (This Week)
1. **🔒 Revoke EXECUTE from anon/authenticated on all admin SECURITY DEFINER functions** (Critical)
2. **🔒 Install DOMPurify and sanitize all `dangerouslySetInnerHTML`** (Critical)
3. **🔒 Restrict `profiles_read_public` RLS policy** — stop exposing phone numbers (High)

### Short Term (2 Weeks)
4. **🔧 Add search_path to all SECURITY DEFINER functions** (High)
5. **🔧 Implement rebuild trigger** — webhook or scheduled deploy (High)
6. **🔧 Enable leaked password protection** (Medium)
7. **🔧 Add missing FK indexes** (Medium)
8. **🔧 Cache static assets with immutable headers** (Medium)

### Medium Term (1 Month)
9. **📱 Create branded 404 page** (Medium)
10. **📦 Code-split AdminPanel** (Medium)
11. **🔍 Add error monitoring** (Medium)
12. **🌐 Self-host Google Fonts** (Low)
13. **📖 Seed news and blog content** (Medium)
14. **🔑 Increase password minimum to 8 characters** (Low)

---

*Generated by automated analysis of database, codebase, and Supabase advisory data.*
