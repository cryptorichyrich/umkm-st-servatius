export const prerender = true;

export async function GET({ url }: { url: URL }) {
  const baseUrl = url.origin;
  const SUPABASE_URL = 'https://vfqcydqmwhfelqizxzbi.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_jph_9XaA6S_pIuVdOYaTkA_TCak_Oz4';

  let blogItems: any[] = [];
  let newsItems: any[] = [];

  try {
    const [blogRes, newsRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/blog_posts?select=title,slug,excerpt,published_at,cover_image,business:businesses(name)&status=eq.approved&order=published_at.desc&limit=15`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/news?select=title,slug,excerpt,published_at,cover_image&status=eq.published&order=published_at.desc&limit=15`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      }),
    ]);
    if (blogRes.ok) blogItems = await blogRes.json();
    if (newsRes.ok) newsItems = await newsRes.json();
  } catch {
    // fail gracefully — empty feed
  }

  const escapeXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const allItems = [
    ...blogItems.map((p) => {
      const biz = Array.isArray(p.business) ? p.business[0] : p.business;
      const link = `${baseUrl}/blog/${p.slug}`;
      const desc = p.excerpt ? escapeXml(p.excerpt) : `Artikel oleh ${biz?.name || 'UMKM St. Servatius'}`;
      return { xml: `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${desc}</description>
      ${p.published_at ? `<pubDate>${new Date(p.published_at).toUTCString()}</pubDate>` : ''}
      ${p.cover_image ? `<enclosure url="${escapeXml(p.cover_image)}" type="image/jpeg" />` : ''}
      ${biz?.name ? `<author>${escapeXml(biz.name)}</author>` : ''}
      <category>Blog</category>
    </item>`, date: p.published_at || '1970-01-01' };
    }),
    ...newsItems.map((p) => {
      const link = `${baseUrl}/berita/${p.slug}`;
      const desc = p.excerpt ? escapeXml(p.excerpt) : 'Berita Paroki St. Servatius';
      return { xml: `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${desc}</description>
      ${p.published_at ? `<pubDate>${new Date(p.published_at).toUTCString()}</pubDate>` : ''}
      ${p.cover_image ? `<enclosure url="${escapeXml(p.cover_image)}" type="image/jpeg" />` : ''}
      <category>Berita</category>
    </item>`, date: p.published_at || '1970-01-01' };
    }),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 30);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>UMKM St. Servatius — Blog &amp; Berita</title>
    <link>${baseUrl}</link>
    <description>Artikel, berita, dan cerita dari UMKM Paroki St. Servatius, Kampung Sawah</description>
    <language>id-ID</language>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
${allItems.map((i) => i.xml).join('\n')}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
