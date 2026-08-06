// CF Pages Function: handles image uploads to R2
// POST /api/upload — multipart form with 'file' field
// Verifies Supabase JWT, stores in R2 under {userId}/{timestamp}-{filename}
// Returns { url: "/cdn/{key}" }

const SUPABASE_URL = 'https://vfqcydqmwhfelqizxzbi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jph_Lger7wqtfkVAwfyjbsrczdzrZqhp';
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function onRequestPost({ request, env }) {
  // 1. Verify JWT
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.replace('Bearer ', '');

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
    },
  });

  if (!userRes.ok) return json({ error: 'Invalid token' }, 401);
  const user = await userRes.json();
  const userId = user.id;
  if (!userId) return json({ error: 'No user' }, 401);

  // 2. Parse multipart
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return json({ error: 'No file' }, 400);

  // 3. Validate
  if (!ALLOWED.includes(file.type)) return json({ error: 'Tipe file tidak diizinkan' }, 400);
  if (file.size > MAX_SIZE) return json({ error: 'Ukuran file maksimal 5MB' }, 400);

  // 4. Generate key: userId/timestamp-random.ext
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const key = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // 5. Upload to R2
  const arrayBuffer = await file.arrayBuffer();
  await env.R2_BUCKET.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
  });

  return json({ url: `/cdn/${key}`, key });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
