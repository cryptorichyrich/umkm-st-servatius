// CF Pages Function: /umkm/[slug]/[produk]
// Fetches product SEO data from Supabase, injects into static shell HTML

const SUPABASE_URL = 'https://vfqcydqmwhfelqizxzbi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jph_9XaA6S_pIuVdOYaTkA_TCak_Oz4';
const SITE_URL = 'https://umkm.servatius.id';

function truncate(s, max = 155) {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max - 3).trimEnd() + '...';
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatIDR(n) {
  return 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n);
}

export async function onRequestGet(context) {
  const { params, request, env, next } = context;
  const bizSlug = params.slug;
  const prodSlug = params.produk;

  if (prodSlug === '_' || prodSlug === '' || prodSlug === 'index' ||
      bizSlug === '_' || bizSlug === '' || bizSlug === 'index') {
    return next();
  }

  try {
    // Fetch product by slug, joined with business to verify bizSlug matches
    const apiUrl = `${SUPABASE_URL}/rest/v1/products?select=slug,name,description,rich_description,seo_title,seo_description,price,image_url,business:businesses!inner(name,slug,category:categories(name,slug))&slug=eq.${encodeURIComponent(prodSlug)}&business.slug=eq.${encodeURIComponent(bizSlug)}&is_available=eq.true&limit=1`;
    const res = await fetch(apiUrl, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const items = await res.json();
    const product = items?.[0];

    if (!product) {
      return next();
    }

    const biz = Array.isArray(product.business) ? product.business[0] : product.business;
    const businessName = biz?.name;
    const businessSlug = biz?.slug;
    const bizCat = Array.isArray(biz?.category) ? biz?.category[0] : biz?.category;
    const categoryName = bizCat?.name;

    const seoTitle = product.seo_title ||
      (businessName ? `${product.name} — ${businessName}` : product.name) ||
      'Produk UMKM';

    let seoDesc = product.seo_description;
    if (!seoDesc) {
      const parts = [];
      const rawDesc = stripHtml(product.rich_description || product.description || '');
      if (rawDesc) parts.push(rawDesc);
      if (businessName) parts.push(`Oleh ${businessName}`);
      if (categoryName) parts.push(categoryName);
      if (product.price) parts.push(`Harga ${formatIDR(product.price)}`);
      parts.push('Tersedia di Direktori UMKM Paroki St. Servatius');
      seoDesc = truncate(parts.join('. '));
    }

    const ogImage = product.image_url || `${SITE_URL}/og-default.jpg`;
    const canonicalUrl = `${SITE_URL}/umkm/${businessSlug}/${product.slug}`;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: seoDesc,
      url: canonicalUrl,
      ...(product.image_url ? { image: product.image_url } : {}),
      ...(businessName ? {
        brand: { '@type': 'Brand', name: businessName },
        seller: { '@type': 'Organization', name: businessName },
      } : {}),
      ...(categoryName ? { category: categoryName } : {}),
      ...(product.price ? {
        offers: {
          '@type': 'Offer', price: product.price, priceCurrency: 'IDR',
          availability: 'https://schema.org/InStock', url: canonicalUrl,
        },
      } : {}),
    };

    // Fetch the static shell HTML
    const shellRes = await env.ASSETS.fetch(new Request(new URL('/umkm/_/_/', request.url)));
    let html = await shellRes.text();

    const metaTags = `
    <meta property="og:title" content="${escapeHtml(seoTitle)}" />
    <meta property="og:description" content="${escapeHtml(seoDesc)}" />
    <meta property="og:type" content="product" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(seoTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(seoDesc)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(seoTitle)}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${escapeHtml(seoDesc)}"`);

    // Remove existing og: and twitter: tags to avoid duplicates
    html = html.replace(/<meta property="og:[^>]*>/g, '');
    html = html.replace(/<meta name="twitter:[^>]*>/g, '');

    // Fix canonical URL
    html = html.replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}"`);

    html = html.replace('</head>', `${metaTags}\n</head>`);

    return new Response(html, {
      headers: { 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'public, max-age=300, s-maxage=600' },
    });
  } catch (err) {
    return next();
  }
}
