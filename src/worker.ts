/**
 * Cloudflare Worker — dynamic env injection + static asset passthrough + SPA fallback.
 *
 * 1. /__env.js → Supabase config from runtime env vars
 * 2. Static assets passthrough (with explicit index.html resolution)
 * 3. /umkm/* and /produk/* → serve static HTML or fallback to generic shell
 * 4. /admin/<tab> and /dashboard/<tab> → SPA shell fallback
 */
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ASSETS: Fetcher;
}

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
        { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' } },
      );
    }

    // ── Try static asset as-is (handles most paths: /, /icons/*, /_astro/*, etc.) ──
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status === 200) return assetResponse;

    // ── SPA: /admin/<tab> ──
    if (path.startsWith('/admin/') && !path.includes('.') && path !== '/admin/') {
      const adminHtml = await env.ASSETS.fetch(new Request(`${url.origin}/admin/`));
      if (adminHtml.ok) {
        let html = await adminHtml.text();
        const tab = path.split('/')[2] || 'admin';
        html = html.replace(/<title>[^<]*<\/title>/, `<title>Admin — ${tab} | UMKM St. Servatius</title>`);
        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' } });
      }
    }

    // ── SPA: /dashboard/<tab> ──
    if (path.startsWith('/dashboard/') && !path.includes('.') && path !== '/dashboard/') {
      const dashHtml = await env.ASSETS.fetch(new Request(`${url.origin}/dashboard/`));
      if (dashHtml.ok) {
        let html = await dashHtml.text();
        const tab = path.split('/')[2] || 'dashboard';
        html = html.replace(/<title>[^<]*<\/title>/, `<title>${tab.charAt(0).toUpperCase() + tab.slice(1)} — Dashboard | UMKM St. Servatius</title>`);
        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' } });
      }
    }

    // ── /umkm/<slug> and /produk/<slug> ──
    const isUmkm = path.startsWith('/umkm/') && !path.includes('.');
    const isProduk = path.startsWith('/produk/') && !path.includes('.') && path !== '/produk/';
    if (isUmkm || isProduk) {
      const slug = path.split('/')[2]?.replace(/\/$/, '');
      if (!slug) return assetResponse;

      // Normalize trailing slash
      if (!path.endsWith('/')) {
        return Response.redirect(url.origin + path + '/' + url.search, 307);
      }

      // Try explicit index.html (CF Assets is inconsistent with dir resolution)
      const directHtml = await env.ASSETS.fetch(new Request(`${url.origin}/${isUmkm ? 'umkm' : 'produk'}/${slug}/index.html`));
      if (directHtml.ok) {
        return new Response(directHtml.body, {
          status: 200,
          headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' },
        });
      }

      // Fallback: use a known page as template, replace slug
      const templateSlug = isUmkm ? 'bengkel-motor-tarik' : 'aksesoris-mobil-led-bengkel-motor-tarik';
      const templateHtml = await env.ASSETS.fetch(
        new Request(`${url.origin}/${isUmkm ? 'umkm' : 'produk'}/${templateSlug}/index.html`),
      );
      if (templateHtml.ok) {
        let html = await templateHtml.text();
        html = html.replace(new RegExp(templateSlug, 'g'), slug);
        html = html.replace(
          /<title>[^<]*<\/title>/,
          `<title>${decodeURIComponent(slug.replace(/-/g, ' '))} | UMKM St. Servatius</title>`,
        );
        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' } });
      }
    }

    return assetResponse;
  },
};
