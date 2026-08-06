// CF Pages Function: /umkm/[slug]
// Fetches SEO data from Supabase at the edge, injects into static shell HTML

const SUPABASE_URL = 'https://vfqcydqmwhfelqizxzbi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jph_9XaA6S_pIuVdOYaTkA_TCak_Oz4';
const SITE_URL = 'https://umkm.servatius.id';

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

  // Skip for the shell page itself or index
  if (slug === '_' || slug === '' || slug === 'index') {
    return next();
  }

  try {
    // ── Fetch business SEO data from Supabase ──
    const apiUrl = `${SUPABASE_URL}/rest/v1/businesses?select=slug,name,description,address,area,phone,whatsapp,logo_url,category:categories(name,slug)&slug=eq.${encodeURIComponent(slug)}&status=eq.approved&limit=1`;
    const res = await fetch(apiUrl, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    const items = await res.json();
    const business = items?.[0];

    if (!business) {
      return next();
    }

    // ── Compute SEO ──
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

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: business.name,
      description: seoDesc,
      url: `${SITE_URL}/umkm/${business.slug}`,
      ...(business.address ? { address: { '@type': 'PostalAddress', streetAddress: business.address } } : {}),
      ...(business.area ? { areaServed: business.area } : {}),
      ...(business.phone ? { telephone: business.phone } : {}),
      ...(business.logo_url ? { image: business.logo_url } : {}),
      ...(categoryName ? { additionalType: categoryName } : {}),
    };

    // ── Fetch static shell HTML ──
    const shellRes = await env.ASSETS.fetch(new Request(new URL('/umkm/_/', request.url)));
    let html = await shellRes.text();

    // ── Inject SEO meta tags ──
    const metaTags = `
    <title>${escapeHtml(seoTitle)}</title>
    <meta name="description" content="${escapeHtml(seoDesc)}" />
    <meta property="og:title" content="${escapeHtml(seoTitle)}" />
    <meta property="og:description" content="${escapeHtml(seoDesc)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${SITE_URL}/umkm/${business.slug}" />
    ${business.logo_url ? `<meta property="og:image" content="${escapeHtml(business.logo_url)}" />` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(seoTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(seoDesc)}" />
    ${business.logo_url ? `<meta name="twitter:image" content="${escapeHtml(business.logo_url)}" />` : ''}
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

    // Replace placeholder title and inject meta
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(seoTitle)}</title>`);

    // Replace description meta
    html = html.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${escapeHtml(seoDesc)}"`);

    // Inject JSON-LD and og tags before </head>
    html = html.replace('</head>', `${metaTags}\n</head>`);

    return new Response(html, {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
        'cache-control': 'public, max-age=300, s-maxage=600',
      },
    });
  } catch (err) {
    // Fallback: serve shell without SEO
    return next();
  }
}
