/**
 * Cloudflare Worker — asset routing with proper ASSETS binding usage.
 * 
 * Key insight: env.ASSETS.fetch(request) with the ORIGINAL request
 * handles /path/ → /path/index.html automatically. Creating new Request
 * objects with /index.html appended causes 307 redirect loops.
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
    if (path.includes('.')) {
      const res = await env.ASSETS.fetch(request);
      // Add immutable cache for hashed assets
      if (res.ok && path.startsWith('/_astro/')) {
        const headers = new Headers(res.headers);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        return new Response(res.body, { status: res.status, headers });
      }
      return res;
    }

    // ── Trailing slash normalization ──
    const segments = path.split('/').filter(Boolean);
    if (segments.length > 0 && !path.endsWith('/')) {
      return Response.redirect(url.origin + path + '/' + url.search, 301);
    }

    // ── FIRST: Try ASSETS with original request (handles /path/ → index.html) ──
    // This works for all pre-rendered pages (produk, umkm, berita, blog, etc.)
    const directRes = await env.ASSETS.fetch(request);
    if (directRes.ok) {
      // Return with no-store headers for HTML
      const headers = new Headers(directRes.headers);
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return new Response(directRes.body, { status: 200, headers });
    }

    // ── Helper: fetch asset with modified URL ──
    async function tryTemplate(tplPath: string): Promise<string | null> {
      try {
        const tplUrl = new URL(tplPath, url.origin);
        const tplReq = new Request(tplUrl, { method: 'GET', redirect: 'manual' });
        const res = await env.ASSETS.fetch(tplReq);
        // redirect: 'manual' so we get the actual response, not follow redirects
        if (res.status >= 200 && res.status < 400) {
          return await res.text();
        }
        // Try without redirect: manual
        const tplReq2 = new Request(tplUrl, { method: 'GET' });
        const res2 = await env.ASSETS.fetch(tplReq2);
        if (res2.ok) {
          return await res2.text();
        }
        return null;
      } catch {
        return null;
      }
    }

    // ── Template fallback for dynamic routes ──
    if (segments.length >= 2) {
      const [prefix, slug] = segments;

      // Category listing pages: /berita/kategori/slug → serve listing shell
      if (slug === 'kategori' && segments[2]) {
        if (prefix === 'berita' || prefix === 'blog') {
          const listHtml = await tryTemplate(`/${prefix}/index.html`);
          if (listHtml) {
            return new Response(listHtml, { status: 200, headers: HTML_HEADERS });
          }
        }
      }

      // Template slugs for detail pages
      const TEMPLATES: Record<string, string[]> = {
        umkm: ['/umkm/bengkel-motor-tarik/index.html', '/umkm/katering-bu-maria/index.html'],
        produk: ['/produk/aksesoris-mobil-led-bengkel-motor-tarik/index.html'],
        berita: ['/berita/berita-pertama/index.html', '/berita/dummy/index.html'],
        blog: ['/blog/artikel-pertama/index.html', '/blog/dummy/index.html'],
      };

      const templates = TEMPLATES[prefix];
      if (templates && prefix !== 'kategori') {
        for (const tpl of templates) {
          const html = await tryTemplate(tpl);
          if (html) {
            // Swap template slug with actual slug
            const tplSlug = tpl.split('/')[2];
            let out = html.split(tplSlug).join(slug);
            out = out.replace(
              /<title>[^<]*<\/title>/,
              `<title>${slug.replace(/-/g, ' ')} | UMKM St. Servatius</title>`,
            );
            return new Response(out, { status: 200, headers: HTML_HEADERS });
          }
        }
      }

      // SPA fallback for admin/dashboard sub-routes
      if (prefix === 'admin' || prefix === 'dashboard') {
        const spaHtml = await tryTemplate(`/${prefix}/index.html`);
        if (spaHtml) {
          let out = spaHtml.replace(
            /<title>[^<]*<\/title>/,
            `<title>${slug.charAt(0).toUpperCase() + slug.slice(1)} | UMKM St. Servatius</title>`,
          );
          return new Response(out, { status: 200, headers: HTML_HEADERS });
        }
      }
    }

    // ── Last resort 404 ──
    return new Response('Not found', { status: 404, headers: NF_HEADERS });
  },
};
