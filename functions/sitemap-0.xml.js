// CF Pages Function: /sitemap-0.xml
// Generates sitemap dynamically from Supabase — always up to date

const SUPABASE_URL = 'https://vfqcydqmwhfelqizxzbi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jph_9XaA6S_pIuVdOYaTkA_TCak_Oz4';
const SITE_URL = 'https://umkm.servatius.id';

function xmlEscape(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function fetchSlugs(table, filters = '') {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=slug${filters}`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const items = await res.json();
  return (items || []).map(i => i.slug).filter(Boolean);
}

export async function onRequestGet(context) {
  const { next } = context;

  try {
    // Fetch all dynamic slugs from Supabase
    const [businessSlugs, productSlugs, blogSlugs, newsSlugs] = await Promise.all([
      fetchSlugs('businesses', '&status=eq.approved'),
      fetchSlugs('products', '&is_available=eq.true'),
      fetchSlugs('blog_posts', '&status=eq.approved'),
      fetchSlugs('news', '&status=eq.published'),
    ]);

    // Get static URLs from the built sitemap
    const staticRes = await next();
    const staticXml = await staticRes.text();
    const staticUrls = [...staticXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

    // Build dynamic URLs
    const now = new Date().toISOString();
    const dynamicUrls = [
      ...businessSlugs.map(s => `${SITE_URL}/umkm/${s}/`),
      ...productSlugs.map(s => `${SITE_URL}/produk/${s}/`),
      ...blogSlugs.map(s => `${SITE_URL}/blog/${s}/`),
      ...newsSlugs.map(s => `${SITE_URL}/berita/${s}/`),
    ];

    const allUrls = [...staticUrls, ...dynamicUrls];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    for (const url of allUrls) {
      xml += `<url><loc>${xmlEscape(url)}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
    }
    xml += '</urlset>';

    return new Response(xml, {
      headers: {
        'content-type': 'application/xml;charset=UTF-8',
        'cache-control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (err) {
    // Fallback to static sitemap
    return next();
  }
}
