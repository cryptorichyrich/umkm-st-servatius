// CF Pages Function: /umkm/[slug]
// Legacy URL — 301 redirect to /{slug}

export async function onRequestGet({ params }) {
  const slug = params.slug;
  if (slug && slug !== '_' && slug !== 'index') {
    return Response.redirect(`https://umkm.servatius.id/${slug}/`, 301);
  }
  return new Response('', { status: 404 });
}
