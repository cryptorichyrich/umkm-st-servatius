// CF Pages Function: /berita/[slug]
// Fetches news SEO data from Supabase, injects into static shell HTML

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
    const apiUrl = `${SUPABASE_URL}/rest/v1/news?select=slug,title,excerpt,content,cover_image,published_at,category:news_categories(name,slug,icon)&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`;
    const res = await fetch(apiUrl, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const items = await res.json();
    const article = items?.[0];

    if (!article) {
      return next();
    }

    const cat = Array.isArray(article.category) ? article.category[0] : article.category;
    const categoryName = cat?.name;

    const seoTitle = `${article.title} | Berita UMKM St. Servatius`;

    let seoDesc;
    const rawExcerpt = article.excerpt?.trim();
    const rawContent = stripHtml(article.content || '').trim();
    if (rawExcerpt) {
      seoDesc = truncate(rawExcerpt);
    } else if (rawContent) {
      seoDesc = truncate(rawContent);
    } else {
      seoDesc = 'Berita UMKM Paroki St. Servatius, Kampung Sawah.';
    }

    const ogImage = article.cover_image || `${SITE_URL}/og-default.jpg`;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: article.title,
      description: seoDesc,
      url: `${SITE_URL}/berita/${article.slug}`,
      ...(article.cover_image ? { image: [article.cover_image] } : {}),
      ...(article.published_at ? { datePublished: article.published_at, dateModified: article.published_at } : {}),
      author: { '@type': 'Organization', name: 'UMKM St. Servatius' },
      publisher: { '@type': 'Organization', name: 'UMKM St. Servatius', url: SITE_URL },
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/berita/${article.slug}` },
      ...(categoryName ? { articleSection: categoryName } : {}),
    };

    const shellRes = await env.ASSETS.fetch(new Request(new URL('/berita/_/', request.url)));
    let html = await shellRes.text();

    const metaTags = `
    <meta property="og:title" content="${escapeHtml(seoTitle)}" />
    <meta property="og:description" content="${escapeHtml(seoDesc)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${SITE_URL}/berita/${article.slug}" />
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
    html = html.replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${SITE_URL}/berita/${slug}"`);

    html = html.replace('</head>', `${metaTags}\n</head>`);

    return new Response(html, {
      headers: { 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'public, max-age=300, s-maxage=600' },
    });
  } catch (err) {
    return next();
  }
}
