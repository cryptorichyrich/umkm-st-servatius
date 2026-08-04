/**
 * Cloudflare Worker — simplified, bulletproof asset routing.
 * 
 * Design: For all dynamic routes, try ASSETS.fetch(originalRequest) FIRST.
 * If that returns 200, serve it. If not, try /path/index.html.
 * If still nothing, use SPA template fallback. NEVER return 404 for
 * known dynamic route prefixes (produk/umkm/berita/blog).
 *
 * ponytail: All HTML responses get no-store to prevent CF edge caching stale 404s.
 */
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ASSETS: Fetcher;
}

const HTML_HEADERS: Record<string, string> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

const NF_HEADERS: Record<string, string> = {
  'Content-Type': 'text/plain',
  'Cache-Control': 'no-store, max-age=0',
};

// Routes that should NEVER return 404 — always SPA fallback
const SPA_ROUTES = ['produk', 'umkm', 'berita', 'blog', 'kategori', 'admin', 'dashboard'];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // ── Dynamic env endpoint ──
    if (path === '/__env.js') {
      return new Response(
        `window.__SUPABASE__=${JSON.stringify({
          url: env.SUPABASE_URL || '',
          key: env.SUPABASE_ANON_KEY || '',
        })};`,
        { headers: { 'Content-Type': 'application/javascript', ...HTML_HEADERS } },
      );
    }

    // ── /direktori → /umkm redirect (301, SEO) ──
    if (path === '/direktori' || path.startsWith('/direktori/')) {
      const rest = path.replace('/direktori', '');
      const target = rest ? `/umkm${rest}${url.search}` : `/umkm${url.search}`;
      return Response.redirect(url.origin + target, 301);
    }

    // ── File assets (JS, CSS, images, fonts, etc.) ──
    // These have file extensions and should be served directly by ASSETS.
    if (path.includes('.')) {
      return env.ASSETS.fetch(request);
    }

    const segments = path.split('/').filter(Boolean);

    // ── Trailing slash normalization (add slash if missing) ──
    if (segments.length > 0 && !path.endsWith('/')) {
      return Response.redirect(url.origin + path + '/' + url.search, 301);
    }

    // ── Helper: try to fetch an asset path from ASSETS binding ──
    async function tryAsset(assetPath: string): Promise<Response | null> {
      try {
        const res = await env.ASSETS.fetch(new Request(url.origin + assetPath, { method: 'GET' }));
        if (res.ok) return res;
        return null;
      } catch {
        return null;
      }
    }

    // ── Helper: serve HTML with proper headers ──
    function htmlResponse(body: BodyInit, headers?: Record<string, string>): Response {
      return new Response(body, { status: 200, headers: { ...HTML_HEADERS, ...headers } });
    }

    // ── Dynamic route handlers ──
    if (segments.length >= 2) {
      const [prefix, slug] = segments;

      // Skip non-dynamic prefixes (static dirs)
      if (SPA_ROUTES.includes(prefix)) {
        // Try direct asset first: /produk/slug/ → /produk/slug/index.html
        const directPath = path.endsWith('/') 
          ? `${path}index.html` 
          : `${path}/index.html`;
        const direct = await tryAsset(directPath);
        if (direct) {
          return htmlResponse(direct.body);
        }

        // For detail pages: try template fallback
        const TEMPLATES: Record<string, string[]> = {
          umkm: ['/umkm/bengkel-motor-tarik/index.html', '/umkm/katering-bu-maria/index.html'],
          produk: ['/produk/aksesoris-mobil-led-bengkel-motor-tarik/index.html'],
          berita: ['/berita/berita-pertama/index.html'],
          blog: ['/blog/artikel-pertama/index.html'],
        };

        // Category listing pages: /berita/kategori/slug → serve listing shell
        if (slug === 'kategori' && segments[2]) {
          const listRes = await tryAsset(`/${prefix}/index.html`);
          if (listRes) return htmlResponse(listRes.body);
        }

        // Template fallback: swap slug in HTML
        const templates = TEMPLATES[prefix];
        if (templates) {
          for (const tpl of templates) {
            const tplRes = await tryAsset(tpl);
            if (tplRes) {
              let html = await tplRes.text();
              // Replace the template slug with the actual slug
              const tplSlug = tpl.split('/')[2];
              html = html.split(tplSlug).join(slug);
              // Fix title
              html = html.replace(
                /<title>[^<]*<\/title>/,
                `<title>${slug.replace(/-/g, ' ')} | UMKM St. Servatius</title>`,
              );
              return htmlResponse(html);
            }
          }
        }

        // SPA fallback for admin/dashboard sub-routes
        if (prefix === 'admin' || prefix === 'dashboard') {
          const spaRes = await tryAsset(`/${prefix}/index.html`);
          if (spaRes) {
            let html = await spaRes.text();
            html = html.replace(
              /<title>[^<]*<\/title>/,
              `<title>${slug.charAt(0).toUpperCase() + slug.slice(1)} | UMKM St. Servatius</title>`,
            );
            return htmlResponse(html);
          }
        }
      }
    }

    // ── Root-level routes (/produk, /umkm, /berita, etc.) ──
    // Try as directory index
    const indexPath = path.endsWith('/') ? `${path}index.html` : `${path}/index.html`;
    const indexRes = await tryAsset(indexPath);
    if (indexRes) {
      return htmlResponse(indexRes.body);
    }

    // ── Last resort: try original request to ASSETS ──
    try {
      const res = await env.ASSETS.fetch(request);
      if (res.ok) return res;
    } catch {
      // fall through
    }

    return new Response('Not found', { status: 404, headers: NF_HEADERS });
  },
};
