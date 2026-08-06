// Edge rate limiter using Cache API (per-colo, not global, but catches burst abuse)
// Uses CF-Connecting-IP as the key, sliding window per minute

const WINDOW_SEC = 60;
const LIMITS = {
  '/api/upload': 10,   // 10 uploads/min
  '/api/auth': 5,      // 5 auth attempts/min
};
const DEFAULT_LIMIT = 120; // 120 req/min for everything else

async function getRate(ip, path) {
  const cache = caches.default;
  const limit = Object.entries(LIMITS).find(([p]) => path.startsWith(p))?.[1] ?? DEFAULT_LIMIT;
  const key = `ratelimit:${ip}:${path.startsWith('/api/upload') ? 'upload' : path.startsWith('/api/auth') ? 'auth' : 'default'}`;
  const cacheKey = new Request(`https://ratelimit.internal/${key}`);
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
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const path = new URL(request.url).pathname;

  const category = path.startsWith('/api/upload') ? 'upload' 
    : path.startsWith('/api/auth') ? 'auth' 
    : 'default';

  const { count, limit } = await getRate(ip, path);

  if (count >= limit) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Coba lagi dalam beberapa saat.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(WINDOW_SEC),
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
      }
    });
  }

  await incrementRate(ip, category);

  return next();
}
