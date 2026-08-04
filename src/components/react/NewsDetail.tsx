import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Newspaper,
  Eye,
  Calendar,
  AlertTriangle,
  Archive,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { sanitizeHtml } from '../../lib/sanitize';
import ShareButtons from './ShareButtons';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface NewsCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  status: string;
  is_pinned: boolean;
  published_at: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  author_id: string | null;
  category_id: string | null;
  category?: NewsCategory | null;
}

interface Props {
  slug: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function NewsDetail({ slug: propSlug }: Props) {
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [localViews, setLocalViews] = useState(0);
  const viewIncremented = useRef(false);

  // Resolve slug from prop or URL
  const slug = (() => {
    if (propSlug) return propSlug;
    if (typeof window !== 'undefined') {
      const segments = window.location.pathname.replace(/\/+$/, '').split('/');
      const last = segments[segments.length - 1];
      if (last && last !== 'berita') return decodeURIComponent(last);
    }
    return '';
  })();

  // ── Fetch article ──
  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('news')
        .select(
          `*, category:news_categories(id, name, slug, icon)`,
        )
        .eq('slug', slug)
        .single();

      if (!error && data) {
        const a = data as unknown as NewsArticle;
        setArticle(a);
        setLocalViews(a.view_count);

        // Increment view count once via RPC (only for published articles)
        if (!viewIncremented.current && a.status === 'published') {
          viewIncremented.current = true;
          supabase
            .rpc('increment_news_views', { p_slug: slug })
            .then(({ error: rpcErr }: { error: unknown }) => {
              if (!rpcErr) {
                setLocalViews((prev) => prev + 1);
              }
            });
        }
      }
      setLoading(false);
    })();
  }, [slug]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-20">
        <Loader2 className="h-6 w-6 animate-spin text-paroki-400" />
        <span className="ml-2 text-sm text-paroki-400">Memuat berita...</span>
      </div>
    );
  }

  // ── Not found ──
  if (!article) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
          <Newspaper className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-ink">
          Berita Tidak Ditemukan
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Berita yang Anda cari mungkin telah dihapus atau dipindahkan.
        </p>
        <a
          href="/berita"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-5 py-2.5 font-bold text-white transition hover:bg-gold-600 active:translate-y-px"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Berita
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center gap-1.5 text-sm text-gray-500">
        <a href="/" className="transition hover:text-paroki-700">
          Beranda
        </a>
        <span>/</span>
        <a href="/berita" className="transition hover:text-paroki-700">
          Berita
        </a>
        <span>/</span>
        <span className="line-clamp-1 font-medium text-gray-700">
          {article.title}
        </span>
      </nav>

      {/* Status banner for non-published articles */}
      {article.status !== 'published' && (
        <div
          className={`mb-5 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium ${
            article.status === 'draft'
              ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
              : 'border-gray-300 bg-gray-50 text-gray-600'
          }`}
        >
          {article.status === 'draft' ? (
            <>
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              Berita ini masih berupa <strong>draf</strong> dan belum
              dipublikasikan.
            </>
          ) : (
            <>
              <Archive className="h-5 w-5 flex-shrink-0" />
              Berita ini telah <strong>diarsipkan</strong>.
            </>
          )}
        </div>
      )}

      {/* ── Article header ── */}
      <article>
        {/* Category + pinned badge */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {article.category && (
            <span className="inline-flex items-center rounded-full bg-paroki-100 px-3 py-1 text-xs font-semibold text-paroki-700">
              {article.category.icon ? `${article.category.icon} ` : ''}
              {article.category.name}
            </span>
          )}
          {article.is_pinned && (
            <span className="inline-flex items-center rounded-full bg-gold-100 px-3 py-1 text-xs font-bold text-gold-700">
              📌 Disematkan
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
          {article.title}
        </h1>

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          {article.published_at && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {formatDate(article.published_at)}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-4 w-4" />
            {localViews} dilihat
          </span>
        </div>

        {/* Cover image */}
        {article.cover_image && (
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            <img
              src={article.cover_image}
              alt={article.title}
              className="max-h-[480px] w-full object-cover"
            />
          </div>
        )}

        {/* Excerpt */}
        {article.excerpt && (
          <p className="mt-6 border-l-4 border-paroki-300 pl-4 text-lg font-medium leading-relaxed text-gray-700">
            {article.excerpt}
          </p>
        )}

        {/* Content */}
        {article.content && (
          <div
            className="wysiwyg-content mt-6"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }}
          />
        )}

        {/* Share buttons */}
        <div className="mt-8 border-t border-gray-200 pt-5">
          <ShareButtons title={article.title} />
        </div>
      </article>

      {/* Back to berita */}
      <div className="mt-8">
        <a
          href="/berita"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-paroki-600 transition hover:text-paroki-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Lihat semua berita
        </a>
      </div>
    </div>
  );
}
