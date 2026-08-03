/**
 * Cloudflare Worker — fixed ASSETS.fetch with proper Request objects.
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

    // ── File assets (JS, CSS, images, etc.) — pass straight to Assets ──
    if (path.includes('.')) {
      return env.ASSETS.fetch(request);
    }

    const segments = path.split('/').filter(Boolean);

    // Helper: fetch a specific asset path by creating proper Request
    async function fetchAsset(assetPath: string): Promise<Response> {
      const assetUrl = new URL(assetPath, url.origin);
      const assetReq = new Request(assetUrl, { method: 'GET' });
      return env.ASSETS.fetch(assetReq);
    }

    // ── /umkm/<slug> — serve from asset or template ──
    if (segments[0] === 'umkm' && segments[1]) {
      const slug = segments[1];

      if (!path.endsWith('/')) {
        return Response.redirect(url.origin + path + '/' + url.search, 301);
      }

      // Try direct page
      const direct = await fetchAsset(`/umkm/${slug}/index.html`);
      if (direct.ok) {
        return new Response(direct.body, { status: 200, headers: HTML_HEADERS });
      }

      // Fallback: template with slug swap
      for (const tpl of ['katering-bu-maria', 'agen-pulsa-token', 'bengkel-motor-tarik']) {
        const tplRes = await fetchAsset(`/umkm/${tpl}/index.html`);
        if (tplRes.ok) {
          let html = await tplRes.text();
          html = html.replace(new RegExp(tpl, 'g'), slug);
          html = html.replace(
            /<title>[^<]*<\/title>/,
            `<title>${slug.replace(/-/g, ' ')} | UMKM St. Servatius</title>`,
          );
          return new Response(html, { status: 200, headers: HTML_HEADERS });
        }
      }
    }

    // ── /produk/<slug> — same approach ──
    if (segments[0] === 'produk' && segments[1]) {
      const slug = segments[1];

      if (!path.endsWith('/')) {
        return Response.redirect(url.origin + path + '/' + url.search, 301);
      }

      const direct = await fetchAsset(`/produk/${slug}/index.html`);
      if (direct.ok) {
        return new Response(direct.body, { status: 200, headers: HTML_HEADERS });
      }

      const tplRes = await fetchAsset(`/produk/aksesoris-mobil-led-bengkel-motor-tarik/index.html`);
      if (tplRes.ok) {
        let html = await tplRes.text();
        html = html.replace(/aksesoris-mobil-led-bengkel-motor-tarik/g, slug);
        html = html.replace(
          /<title>[^<]*<\/title>/,
          `<title>${slug.replace(/-/g, ' ')} | UMKM St. Servatius</title>`,
        );
        return new Response(html, { status: 200, headers: HTML_HEADERS });
      }
    }

    // ── /admin/<tab> — SPA fallback ──
    if (segments[0] === 'admin' && segments[1]) {
      const adminRes = await fetchAsset('/admin/index.html');
      if (adminRes.ok) {
        let html = await adminRes.text();
        html = html.replace(
          /<title>[^<]*<\/title>/,
          `<title>Admin — ${segments[1]} | UMKM St. Servatius</title>`,
        );
        return new Response(html, { status: 200, headers: HTML_HEADERS });
      }
    }

    // ── /dashboard/<tab> — SPA fallback ──
    if (segments[0] === 'dashboard' && segments[1]) {
      const dashRes = await fetchAsset('/dashboard/index.html');
      if (dashRes.ok) {
        let html = await dashRes.text();
        html = html.replace(
          /<title>[^<]*<\/title>/,
          `<title>${segments[1].charAt(0).toUpperCase() + segments[1].slice(1)} — Dashboard | UMKM St. Servatius</title>`,
        );
        return new Response(html, { status: 200, headers: HTML_HEADERS });
      }
    }

    // ── Everything else: try static asset ──
    const assetRes = await env.ASSETS.fetch(request);
    if (assetRes.status === 200) return assetRes;

    // Try /path/index.html
    const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
    const idxRes = await fetchAsset(`${cleanPath}/index.html`);
    if (idxRes.ok) {
      return new Response(idxRes.body, { status: 200, headers: HTML_HEADERS });
    }

    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  },
};
