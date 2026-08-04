export const prerender = false;

export async function GET({ url }: { url: URL }) {
  const baseUrl = url.origin;
  const SUPABASE_URL = 'https://vfqcydqmwhfelqizxzbi.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_jph_9XaA6S_pIuVdOYaTkA_TCak_Oz4';

  let items: any[] = [];

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?select=title,slug,excerpt,published_at,cover_image,business:businesses(name)&status=eq.approved&order=published_at.desc&limit=20`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (res.ok) items = await res.json();
  } catch {
    // fail gracefully — empty feed
  }

  const escapeXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const itemsXml = items.map((p) => {
    const biz = Array.isArray(p.business) ? p.business[0] : p.business;
    const url = `${baseUrl}/blog/${p.slug}`;
    const desc = p.excerpt ? escapeXml(p.excerpt) : `Artikel oleh ${biz?.name || 'UMKM St. Servatius'}`;
    return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${desc}</description>
      ${p.published_at ? `<pubDate>${new Date(p.published_at).toUTCString()}</pubDate>` : ''}
      ${p.cover_image ? `<enclosure url="${escapeXml(p.cover_image)}" type="image/jpeg" />` : ''}
      ${biz?.name ? `<author>${escapeXml(biz.name)}</author>` : ''}
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog UMKM St. Servatius</title>
    <link>${baseUrl}/blog</link>
    <description>Artikel dan cerita dari UMKM Paroki St. Servatius, Kampung Sawah</description>
    <language>id-ID</language>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
