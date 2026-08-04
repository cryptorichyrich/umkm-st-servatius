export const prerender = false;

export async function GET({ url }: { url: URL }) {
  const baseUrl = url.origin;

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
