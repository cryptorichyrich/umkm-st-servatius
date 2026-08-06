// Edge rate limiter — only counts dynamic requests, skips static assets
const WINDOW_SEC = 60;
const LIMITS = {
  '/api/upload': 10,
  '/api/auth': 5,
};
const DEFAULT_LIMIT = 300;

const SKIP_EXT = /\.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot|map|xml|txt|webmanifest)$/i;

async function getRate(ip, category) {
  const cache = caches.default;
  const limit = LIMITS[category] ?? DEFAULT_LIMIT;
  const cacheKey = new Request(`https://ratelimit.internal/ratelimit:${ip}:${category}`);
  const cached = await cache.match(cacheKey);
  const count = cached ? parseInt(await cached.text()) : 0;
  return { count, limit };
}

async function incrementRate(ip, category) {
  const cache = caches.default;
  const key = new Request(`https://ratelimit.internal/ratelimit:${ip}:${category}`);
  const current = await cache.match(key);
  const count = current ? parseInt(await current.text()) : 0;
  await cache.put(key, new Response(String(count + 1), {
    headers: { 'Cache-Control': `s-maxage=${WINDOW_SEC}` }
  }));
}

export async function onRequest(context) {
  const { request, next } = context;
  const path = new URL(request.url).pathname;

  // Skip static assets — they're cached by CDN, don't count against rate limit
  if (SKIP_EXT.test(path) || path.startsWith('/_astro/')) {
    return next();
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  let category = 'default';
  for (const [prefix] of Object.entries(LIMITS)) {
    if (path.startsWith(prefix)) { category = prefix; break; }
  }

  const { count, limit } = await getRate(ip, category);

  if (count >= limit) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Coba lagi dalam beberapa saat.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(WINDOW_SEC),
      }
    });
  }

  await incrementRate(ip, category);
  return next();
}
