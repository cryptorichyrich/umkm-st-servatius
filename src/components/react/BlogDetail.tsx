import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, ArrowLeft, Store, Eye, AlertCircle } from 'lucide-react';
import ShareButtons from './ShareButtons';

function formatDate(date: string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BlogDetail() {
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewIncremented, setViewIncremented] = useState(false);

  // Extract slug from window.location.pathname (e.g. /blog/my-article)
  const slug = typeof window !== 'undefined'
    ? window.location.pathname.replace(/^\/blog\//, '').replace(/\/$/, '')
    : '';

  useEffect(() => {
    (async () => {
      if (!slug) { setLoading(false); return; }
      const { data, error } = await supabase
        .from('blog_posts')
        .select(`*, business:businesses(name, slug, logo_url, area), category:categories(name, slug)`)
        .eq('slug', slug)
        .single();

      if (!error && data) {
        setPost(data);
      }
      setLoading(false);
    })();
  }, [slug]);

  // Increment views once (anon-safe RPC)
  useEffect(() => {
    if (post && post.status === 'approved' && !viewIncremented) {
      setViewIncremented(true);
      supabase.rpc('increment_blog_views', { p_slug: slug }).then(() => {});
    }
  }, [post, slug, viewIncremented]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="aspect-[16/9] rounded-xl bg-gray-100"></div>
          <div className="h-8 w-2/3 rounded bg-gray-100"></div>
          <div className="h-4 w-full rounded bg-gray-100"></div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
          <Search className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-ink">Artikel Tidak Ditemukan</h1>
        <p className="mt-2 text-gray-500">Artikel yang Anda cari mungkin belum dipublikasikan atau sudah dihapus.</p>
        <a href="/blog" className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-5 py-2.5 font-bold text-white transition hover:bg-gold-600 active:translate-y-px">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Blog
        </a>
      </div>
    );
  }

  const biz = Array.isArray(post.business) ? post.business[0] : post.business;
  const cat = Array.isArray(post.category) ? post.category[0] : post.category;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Status banner for non-published posts */}
      {post.status !== 'approved' && (
        <div className={`mb-4 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${
          post.status === 'pending' ? 'border-yellow-300 bg-yellow-50 text-yellow-800' :
          post.status === 'rejected' ? 'border-red-300 bg-red-50 text-red-800' :
          post.status === 'archived' ? 'border-gray-300 bg-gray-50 text-gray-700' :
          'border-gray-300 bg-gray-50 text-gray-700'
        }`}>
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {post.status === 'pending' && 'Menunggu Persetujuan'}
              {post.status === 'rejected' && 'Artikel Ditolak'}
              {post.status === 'draft' && 'Draf (Belum Dipublikasikan)'}
              {post.status === 'archived' && 'Artikel Diarsipkan'}
            </p>
            <p className="mt-0.5 text-xs opacity-80">
              {post.status === 'pending' && 'Artikel ini sedang dalam antrian moderasi.'}
              {post.status === 'rejected' && (post.rejection_note ? `Alasan: ${post.rejection_note}` : 'Artikel ini ditolak oleh panitia.')}
              {post.status === 'draft' && 'Artikel ini masih berupa draf dan belum dikirim untuk ditinjau.'}
              {post.status === 'archived' && 'Artikel ini telah diarsipkan.'}
            </p>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-gray-500">
        <a href="/" className="transition hover:text-paroki-700">Beranda</a><span>/</span>
        <a href="/blog" className="transition hover:text-paroki-700">Blog</a><span>/</span>
        <span className="line-clamp-1 font-medium text-gray-700">{post.title}</span>
      </nav>

      {/* Category badge */}
      {cat && (
        <a href={`/blog`} className="mb-3 inline-flex items-center rounded-full bg-paroki-50 px-3 py-1 text-xs font-semibold text-paroki-800 transition hover:bg-paroki-100">
          {cat.name}
        </a>
      )}

      {/* Title */}
      <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-ink break-words">
        {post.title}
      </h1>

      {/* Meta: author + date + views */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-500">
        {biz && (
          <a
            href={`/umkm/${biz.slug}`}
            className="inline-flex items-center gap-2 font-medium text-gray-700 transition hover:text-paroki-700"
          >
            {biz.logo_url ? (
              <img src={biz.logo_url} alt={biz.name} className="h-7 w-7 rounded-full object-cover ring-1 ring-gray-200" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paroki-50 text-paroki-600">
                <Store className="h-4 w-4" />
              </span>
            )}
            {biz.name}
          </a>
        )}
        {post.published_at && (
          <span className="text-gray-400">{formatDate(post.published_at)}</span>
        )}
        <span className="inline-flex items-center gap-1 text-gray-400">
          <Eye className="h-4 w-4" />
          {(post.view_count || 0)} dibaca
        </span>
      </div>

      {/* Cover image */}
      {post.cover_image && (
        <div className="mt-6 overflow-hidden rounded-xl bg-gray-100 shadow-soft">
          <img src={post.cover_image} alt={post.title} className="aspect-[16/9] w-full object-cover" />
        </div>
      )}

      {/* Content */}
      <article
        className="wysiwyg-content mt-8 max-w-none text-gray-700"
        dangerouslySetInnerHTML={{ __html: post.content || '' }}
      />

      {/* Share buttons */}
      <div className="mt-8 border-t border-gray-100 pt-6">
        <ShareButtons title={post.title} />
      </div>

      {/* Link back to business profile */}
      {biz && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
          <div className="flex items-center gap-3">
            {biz.logo_url ? (
              <img src={biz.logo_url} alt={biz.name} className="h-10 w-10 rounded-lg object-cover ring-1 ring-gray-200" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-paroki-600 ring-1 ring-gray-200">
                <Store className="h-5 w-5" />
              </span>
            )}
            <div className="flex-1">
              <p className="text-xs text-gray-400">Artikel dari</p>
              <p className="font-display text-sm font-bold text-ink">{biz.name}</p>
            </div>
            <a
              href={`/umkm/${biz.slug}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-gold-600 active:translate-y-px"
            >
              <Store className="h-4 w-4" />
              Lihat Profil UMKM
            </a>
          </div>
        </div>
      )}

      {/* Back to blog */}
      <div className="mt-6 text-center">
        <a href="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-paroki-700">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar Blog
        </a>
      </div>
    </div>
  );
}
