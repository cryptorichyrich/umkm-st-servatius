// CF Pages Function: /[slug]
// Fetches business SEO data from Supabase, injects into static shell HTML

const SUPABASE_URL = 'https://vfqcydqmwhfelqizxzbi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jph_9XaA6S_pIuVdOYaTkA_TCak_Oz4';
const SITE_URL = 'https://umkm.servatius.id';

// Static routes that should NOT be treated as business slugs
const STATIC_SLUGS = new Set([
  '_', 'index', 'umkm', 'produk', 'blog', 'berita', 'kategori', 'bazar',
  'admin', 'dashboard', 'masuk', 'daftar', 'lupa-sandi', 'reset-sandi',
  'kebijakan-privasi', 'syarat-ketentuan', 'robots.txt', 'sitemap.xml',
  'rss.xml', 'sitemap-index.xml', 'sitemap-0.xml', 'og-default.jpg',
  'favicon.ico', 'manifest.json', 'sw.js',
]);

function truncate(s, max = 155) {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max - 3).trimEnd() + '...';
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function onRequestGet(context) {
  const { params, request, env, next } = context;
  const slug = params.slug;

  if (STATIC_SLUGS.has(slug) || slug === '' || slug === 'index') {
    return next();
  }

  try {
    const apiUrl = `${SUPABASE_URL}/rest/v1/businesses?select=slug,name,description,address,area,phone,whatsapp,logo_url,category:categories(name,slug)&slug=eq.${encodeURIComponent(slug)}&status=eq.approved&limit=1`;
    const res = await fetch(apiUrl, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const items = await res.json();
    const business = items?.[0];

    if (!business) {
      return next();
    }

    const cat = Array.isArray(business.category) ? business.category[0] : business.category;
    const categoryName = cat?.name;

    const parts = [];
    if (business.description) parts.push(business.description);
    if (categoryName) parts.push(`Kategori: ${categoryName}`);
    if (business.area) parts.push(`Berlokasi di ${business.area}`);
    if (business.whatsapp || business.phone) parts.push('Hubungi via WhatsApp');
    parts.push('Direktori UMKM Paroki St. Servatius, Kampung Sawah');
    const seoDesc = truncate(parts.join('. '));

    const seoTitle = `${business.name}${categoryName ? ` — ${categoryName}` : ''} | Paroki St. Servatius`;

    const canonicalUrl = `${SITE_URL}/${business.slug}`;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: business.name,
      description: seoDesc,
      url: canonicalUrl,
      ...(business.address ? { address: { '@type': 'PostalAddress', streetAddress: business.address } } : {}),
      ...(business.area ? { areaServed: business.area } : {}),
      ...(business.phone ? { telephone: business.phone } : {}),
      ...(business.logo_url ? { image: business.logo_url } : {}),
      ...(categoryName ? { additionalType: categoryName } : {}),
    };

    const shellRes = await env.ASSETS.fetch(new Request(new URL('/_/', request.url)));
    let html = await shellRes.text();

    const metaTags = `
    <meta property="og:title" content="${escapeHtml(seoTitle)}" />
    <meta property="og:description" content="${escapeHtml(seoDesc)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    ${business.logo_url ? `<meta property="og:image" content="${escapeHtml(business.logo_url)}" />` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(seoTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(seoDesc)}" />
    ${business.logo_url ? `<meta name="twitter:image" content="${escapeHtml(business.logo_url)}" />` : ''}
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(seoTitle)}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${escapeHtml(seoDesc)}"`);
    html = html.replace(/<meta property="og:[^>]*>/g, '');
    html = html.replace(/<meta name="twitter:[^>]*>/g, '');
    html = html.replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}"`);
    html = html.replace('</head>', `${metaTags}\n</head>`);

    return new Response(html, {
      headers: { 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'public, max-age=300, s-maxage=600' },
    });
  } catch (err) {
    return next();
  }
}
