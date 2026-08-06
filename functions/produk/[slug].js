// CF Pages Function: /produk/[slug]
// Legacy URL — redirect to /umkm/{biz-slug}/{prod-slug}

const SUPABASE_URL = 'https://vfqcydqmwhfelqizxzbi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jph_9XaA6S_pIuVdOYaTkA_TCak_Oz4';
const SITE_URL = 'https://umkm.servatius.id';

export async function onRequestGet(context) {
  const { params, next } = context;
  const slug = params.slug;

  if (slug === '_' || slug === '' || slug === 'index') {
    return next();
  }

  try {
    // Look up product + business slug to build the new URL
    const apiUrl = `${SUPABASE_URL}/rest/v1/products?select=slug,business:businesses(slug)&slug=eq.${encodeURIComponent(slug)}&limit=1`;
    const res = await fetch(apiUrl, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const items = await res.json();
    const product = items?.[0];

    if (product) {
      const biz = Array.isArray(product.business) ? product.business[0] : product.business;
      const bizSlug = biz?.slug;
      if (bizSlug) {
        return Response.redirect(`${SITE_URL}/${bizSlug}/${slug}/`, 301);
      }
    }

    // Product not found — fall through to static page (will show "not found")
    return next();
  } catch (err) {
    return next();
  }
}
