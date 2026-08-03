export async function GET() {
  const baseUrl = 'https://umkm-st-servatius.fxwisdom1.workers.dev';

  const body = `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /admin
Disallow: /daftar
Disallow: /masuk

Sitemap: ${baseUrl}/sitemap.xml
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
