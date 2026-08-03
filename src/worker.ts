/**
 * Cloudflare Worker — dynamic env injection + static asset passthrough + SPA fallback.
 *
 * 1. /__env.js → Supabase config from runtime env vars
 * 2. /umkm/* and /produk/* → serve static HTML if exists, fallback to generic shell
 * 3. Everything else: pass through to static assets (./dist)
 */
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Dynamic env endpoint — injected at runtime, never baked at build
    if (url.pathname === '/__env.js') {
      const config = {
        url: env.SUPABASE_URL || '',
        key: env.SUPABASE_ANON_KEY || '',
      };
      return new Response(
        `window.__SUPABASE__=${JSON.stringify(config)};`,
        {
          headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'no-cache',
          },
        },
      );
    }

    // Try static assets first
    const assetResponse = await env.ASSETS.fetch(request);

    // If static asset exists (200), return it
    if (assetResponse.status === 200) {
      return assetResponse;
    }

    // SPA fallback: /admin/<tab> paths — serve admin shell (only /admin/ exists statically)
    const isAdminSubpage =
      url.pathname.startsWith('/admin/') &&
      !url.pathname.includes('.') &&
      url.pathname !== '/admin/';
    if (isAdminSubpage) {
      const adminShellUrl = new URL(`${url.origin}/admin/`);
      const adminResponse = await env.ASSETS.fetch(
        new Request(adminShellUrl, request),
      );
      if (adminResponse.ok) {
        let html = await adminResponse.text();
        const tab = url.pathname.split('/')[2] || 'admin';
        html = html.replace(
          /<title>[^<]*<\/title>/,
          `<title>Admin — ${tab} | UMKM St. Servatius</title>`,
        );
        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache',
          },
        });
      }
    }

    // SPA fallback: /dashboard/<tab> paths (e.g. /dashboard/pengaturan)
    const isDashboardSubpage =
      url.pathname.startsWith('/dashboard/') &&
      !url.pathname.includes('.') &&
      url.pathname !== '/dashboard/';
    if (isDashboardSubpage) {
      const dashShellUrl = new URL(`${url.origin}/dashboard/`);
      const dashResponse = await env.ASSETS.fetch(
        new Request(dashShellUrl, request),
      );
      if (dashResponse.ok) {
        let html = await dashResponse.text();
        const tab = url.pathname.split('/')[2] || 'dashboard';
        html = html.replace(
          /<title>[^<]*<\/title>/,
          `<title>${tab.charAt(0).toUpperCase() + tab.slice(1)} — Dashboard | UMKM St. Servatius</title>`,
        );
        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache',
          },
        });
      }
    }

    // SPA fallback: for /umkm/* and /produk/* that don't exist in static build
    // (dynamically created businesses/products after last build)
    const isUmkmPage = url.pathname.startsWith('/umkm/') && !url.pathname.includes('.');
    const isProdukPage = url.pathname.startsWith('/produk/') && !url.pathname.includes('.');
    const slug = url.pathname.split('/')[2]?.replace(/\/$/, '');

    if ((isUmkmPage || isProdukPage) && slug) {
      // Normalize: ensure trailing slash
      if (!url.pathname.endsWith('/')) {
        return Response.redirect(url.origin + url.pathname + '/' + url.search, 307);
      }

      // Try to serve a fallback HTML shell that loads the React island
      // We use the existing katering-bu-maria page as a template (it has the right island)
      const fallbackUrl = new URL(
        isUmkmPage
          ? `${url.origin}/umkm/agen-pulsa-token/`
          : `${url.origin}/produk/aksesoris-mobil-led-bengkel-motor-tarik/`,
      );
      const fallbackResponse = await env.ASSETS.fetch(new Request(fallbackUrl, request));

      if (fallbackResponse.ok) {
        let html = await fallbackResponse.text();
        // Replace fallback slug with actual slug in astro-island props
        html = html.replace(/agen-pulsa-token/g, slug);
        html = html.replace(/aksesoris-mobil-led-bengkel-motor-tarik/g, slug);
        // Update the page title
        html = html.replace(
          /<title>[^<]*<\/title>/,
          `<title>${decodeURIComponent(slug.replace(/-/g, ' '))} | UMKM St. Servatius</title>`,
        );

        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache',
          },
        });
      }
    }

    // Everything else: return the asset response as-is (404, etc.)
    return assetResponse;
  },
};
