// CF Pages Function: catch-all for /admin/*
// Admin is a CSR SPA — all sub-routes serve the same index.html

export async function onRequestGet(context) {
  const { env } = context;
  return env.ASSETS.fetch(new Request(new URL('/admin/index.html', context.request.url)));
}
