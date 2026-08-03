/**
 * Cloudflare Worker — dynamic env injection + static asset passthrough.
 *
 * Serves /__env.js with Supabase config from runtime env vars.
 * All other requests fall through to static assets (./dist).
 */
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
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

    // Everything else: pass through to static assets
    return env.ASSETS.fetch(request);
  },
};
