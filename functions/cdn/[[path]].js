// CF Pages Function: serves images from R2
// GET /cdn/{userId}/{filename} → proxied from R2 with caching

export async function onRequestGet({ params, env }) {
  const key = params.path;
  if (!key) return new Response('Not found', { status: 404 });

  const object = await env.R2_BUCKET.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(object.body, { headers });
}
