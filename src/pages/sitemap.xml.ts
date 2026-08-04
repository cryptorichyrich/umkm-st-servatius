const BASE_URL = 'https://umkm-st-servatius.fxwisdom1.workers.dev';
const SUPABASE_URL = 'https://vfqcydqmwhfelqizxzbi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jph_9XaA6S_pIuVdOYaTkA_TCak_Oz4';

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq: string;
  priority: string;
}

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const headers = { apikey: SUPABASE_KEY };

  // Fetch all data in parallel
  const [businessesRes, productsRes, categoriesRes, newsRes, blogRes, newsCatRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/businesses?select=slug,updated_at&status=eq.approved`,
      { headers },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/products?select=slug,updated_at&is_available=eq.true`,
      { headers },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/categories?select=slug`,
      { headers },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/news?select=slug,published_at&status=eq.published`,
      { headers },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/blog_posts?select=slug,published_at&status=eq.approved`,
      { headers },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/news_categories?select=slug`,
      { headers },
    ),
  ]);

  const businesses = businessesRes.ok ? await businessesRes.json() : [];
  const products = productsRes.ok ? await productsRes.json() : [];
  const categories = categoriesRes.ok ? await categoriesRes.json() : [];
  const newsItems = newsRes.ok ? await newsRes.json() : [];
  const blogPosts = blogRes.ok ? await blogRes.json() : [];
  const newsCats = newsCatRes.ok ? await newsCatRes.json() : [];

  const entries: SitemapEntry[] = [];

  // Static pages
  entries.push({ loc: `${BASE_URL}/`, changefreq: 'daily', priority: '0.8' });
  entries.push({ loc: `${BASE_URL}/umkm`, changefreq: 'daily', priority: '0.8' });
  entries.push({ loc: `${BASE_URL}/produk`, changefreq: 'daily', priority: '0.7' });
  entries.push({ loc: `${BASE_URL}/berita`, changefreq: 'daily', priority: '0.7' });
  entries.push({ loc: `${BASE_URL}/blog`, changefreq: 'daily', priority: '0.7' });
  entries.push({ loc: `${BASE_URL}/daftar`, changefreq: 'monthly', priority: '0.3' });
  entries.push({ loc: `${BASE_URL}/masuk`, changefreq: 'monthly', priority: '0.3' });

  // Business detail pages
  for (const b of businesses) {
    if (b.slug) {
      entries.push({
        loc: `${BASE_URL}/umkm/${xmlEscape(b.slug)}`,
        lastmod: b.updated_at,
        changefreq: 'weekly',
        priority: '0.9',
      });
    }
  }

  // Product detail pages
  for (const p of products) {
    if (p.slug) {
      entries.push({
        loc: `${BASE_URL}/produk/${xmlEscape(p.slug)}`,
        lastmod: p.updated_at,
        changefreq: 'weekly',
        priority: '0.8',
      });
    }
  }

  // Category pages
  for (const c of categories) {
    if (c.slug) {
      entries.push({
        loc: `${BASE_URL}/kategori/${xmlEscape(c.slug)}`,
        changefreq: 'weekly',
        priority: '0.6',
      });
    }
  }

  // News detail pages
  for (const n of newsItems) {
    if (n.slug) {
      entries.push({
        loc: `${BASE_URL}/berita/${xmlEscape(n.slug)}`,
        lastmod: n.published_at,
        changefreq: 'weekly',
        priority: '0.7',
      });
    }
  }

  // News category pages
  for (const nc of newsCats) {
    if (nc.slug) {
      entries.push({
        loc: `${BASE_URL}/berita/kategori/${xmlEscape(nc.slug)}`,
        changefreq: 'weekly',
        priority: '0.5',
      });
    }
  }

  // Blog detail pages
  for (const bp of blogPosts) {
    if (bp.slug) {
      entries.push({
        loc: `${BASE_URL}/blog/${xmlEscape(bp.slug)}`,
        lastmod: bp.published_at,
        changefreq: 'weekly',
        priority: '0.7',
      });
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${e.loc}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
