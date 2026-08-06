// Shared R2 upload helper — replaces Supabase storage for new uploads
// Usage: const { url } = await uploadToR2(file, session);

export async function uploadToR2(file: File): Promise<{ url: string; key: string }> {
  const { supabase } = await import('./supabase');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload gagal');
  }

  return res.json();
}
