// CF Pages Function: /blog/[slug]
// Fetches blog post SEO data from Supabase, injects into static shell HTML

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
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function onRequestGet(context) {
  const { params, request, env, next } = context;
  const slug = params.slug;

  if (slug === '_' || slug === '' || slug === 'index') {
    return next();
  }

  try {
    const apiUrl = `${SUPABASE_URL}/rest/v1/blog_posts?select=slug,title,excerpt,content,cover_image,published_at,updated_at,business:businesses(name,slug),category:categories(name,slug)&slug=eq.${encodeURIComponent(slug)}&status=eq.approved&limit=1`;
    const res = await fetch(apiUrl, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const items = await res.json();
    const post = items?.[0];

    if (!post) {
      return next();
    }

    const biz = Array.isArray(post.business) ? post.business[0] : post.business;
    const businessName = biz?.name;
    const businessSlug = biz?.slug;
    const cat = Array.isArray(post.category) ? post.category[0] : post.category;
    const categoryName = cat?.name;

    const seoTitle = `${businessName ? `${post.title} — ${businessName}` : post.title} | Blog UMKM Paroki St. Servatius`;

    let seoDesc;
    if (post.excerpt) {
      seoDesc = truncate(post.excerpt);
    } else if (post.content) {
      seoDesc = truncate(stripHtml(post.content));
    } else {
      seoDesc = 'Artikel dari Blog UMKM Paroki St. Servatius, Kampung Sawah.';
    }

    const ogImage = post.cover_image || `${SITE_URL}/og-default.jpg`;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: seoDesc,
      url: `${SITE_URL}/blog/${post.slug}`,
      ...(post.cover_image ? { image: post.cover_image } : {}),
      ...(post.published_at ? { datePublished: post.published_at } : {}),
      ...(post.updated_at ? { dateModified: post.updated_at } : {}),
      author: businessName ? { '@type': 'Organization', name: businessName, url: businessSlug ? `${SITE_URL}/umkm/${businessSlug}` : undefined } : undefined,
      publisher: { '@type': 'Organization', name: 'UMKM St. Servatius', url: SITE_URL },
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${post.slug}` },
      ...(categoryName ? { articleSection: categoryName } : {}),
    };

    const shellRes = await env.ASSETS.fetch(new Request(new URL('/blog/_/', request.url)));
    let html = await shellRes.text();

    const metaTags = `
    <meta property="og:title" content="${escapeHtml(seoTitle)}" />
    <meta property="og:description" content="${escapeHtml(seoDesc)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${SITE_URL}/blog/${post.slug}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(seoTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(seoDesc)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(seoTitle)}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${escapeHtml(seoDesc)}"`);
    html = html.replace('</head>', `${metaTags}\n</head>`);

    return new Response(html, {
      headers: { 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'public, max-age=300, s-maxage=600' },
    });
  } catch (err) {
    return next();
  }
}
