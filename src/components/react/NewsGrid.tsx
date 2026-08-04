import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Newspaper, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

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
  cover_image: string | null;
  status: string;
  is_pinned: boolean;
  published_at: string | null;
  view_count: number;
  category_id: string | null;
  category?: NewsCategory | null;
}

interface Props {
  limit?: number;
}

const PER_PAGE = 10;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─────────────────────────────────────────────
// Truncated blog-style pagination
// ─────────────────────────────────────────────
function getPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | '...')[] = [1];
  let left = Math.max(2, current - 1);
  let right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push('...');
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push('...');
  pages.push(total);
  return pages;
}

export default function NewsGrid({ limit }: Props) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [page, setPage] = useState(1);

  // ── Fetch categories ──
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('news_categories')
        .select('id, name, slug, icon')
        .order('sort_order', { ascending: true });
      if (data) setCategories(data as NewsCategory[]);
    })();
  }, []);

  // ── Fetch articles ──
  useEffect(() => {
    setLoading(true);
    (async () => {
      let query = supabase
        .from('news')
        .select(
          `id, title, slug, excerpt, cover_image, status, is_pinned, published_at, view_count, category_id,
           category:news_categories(id, name, slug, icon)`,
        )
        .eq('status', 'published')
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false });

      if (selectedCategory) {
        query = query.eq('category_id', selectedCategory);
      }
      if (search.trim()) {
        query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
      }

      const effectiveLimit = limit ?? PER_PAGE;
      query = query.range(
        (page - 1) * effectiveLimit,
        page * effectiveLimit,
      );

      const { data, error } = await query;
      if (error) {
        console.error('NewsGrid fetch error:', error);
        setArticles([]);
      } else {
        setArticles((data || []) as unknown as NewsArticle[]);
      }
      setLoading(false);
    })();
  }, [search, selectedCategory, page, limit]);

  // ── Reset page when filters change ──
  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  // ── Determine total pages from count ──
  const [totalCount, setTotalCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let countQuery = supabase
        .from('news')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published');

      if (selectedCategory) {
        countQuery = countQuery.eq('category_id', selectedCategory);
      }
      if (search.trim()) {
        countQuery = countQuery.or(
          `title.ilike.%${search}%,excerpt.ilike.%${search}%`,
        );
      }

      const { count } = await countQuery;
      if (!cancelled && count !== null) setTotalCount(count);
    })();
    return () => {
      cancelled = true;
    };
  }, [search, selectedCategory]);

  const effectiveLimit = limit ?? PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(totalCount / effectiveLimit));
  const hasNext = articles.length === effectiveLimit && page < totalPages;
  const hasPrev = page > 1;

  const pageRange = useMemo(
    () => getPageRange(page, totalPages),
    [page, totalPages],
  );

  return (
    <div>
      {/* ── Search + category filter ── */}
      <div className="mb-6 space-y-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari berita..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-gray-400 focus:border-gold-400 focus:ring-2 focus:ring-gold-200"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-gold-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-gold-600 active:translate-y-px"
          >
            Cari
          </button>
        </form>

        {/* Category chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              !selectedCategory
                ? 'bg-paroki-600 text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-paroki-300 hover:text-paroki-700'
            }`}
          >
            Semua
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                selectedCategory === c.id
                  ? 'bg-paroki-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:border-paroki-300 hover:text-paroki-700'
              }`}
            >
              {c.icon ? `${c.icon} ` : ''}
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading state ── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="mb-4 aspect-video rounded-lg bg-gray-100"></div>
              <div className="mb-2 h-5 w-3/4 rounded bg-gray-100"></div>
              <div className="h-4 w-full rounded bg-gray-100"></div>
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        /* ── Empty state ── */
        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
            <Newspaper className="h-6 w-6" />
          </div>
          <p className="font-medium text-gray-700">Belum ada berita.</p>
          {search && (
            <p className="mt-1 text-sm text-gray-400">
              Coba kata kunci lain atau ubah filter.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* ── Grid ── */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <a
                key={a.id}
                href={`/berita/${a.slug}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
              >
                {/* Cover image */}
                <div className="relative aspect-video overflow-hidden bg-gray-100">
                  {a.cover_image ? (
                    <img
                      src={a.cover_image}
                      alt={a.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300">
                      <Newspaper className="h-10 w-10" />
                    </div>
                  )}
                  {/* Category badge */}
                  {a.category && (
                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-paroki-800 shadow-sm backdrop-blur-sm">
                      {a.category.icon ? `${a.category.icon} ` : ''}
                      {a.category.name}
                    </span>
                  )}
                  {/* Pinned badge */}
                  {a.is_pinned && (
                    <span className="absolute right-3 top-3 rounded-full bg-gold-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                      📌 Disematkan
                    </span>
                  )}
                </div>
                {/* Body */}
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-display text-base font-bold leading-snug text-ink break-words group-hover:text-paroki-700">
                    {a.title}
                  </h3>
                  {a.excerpt && (
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-gray-500">
                      {a.excerpt}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                    {a.published_at && (
                      <span className="font-medium text-gray-500">
                        {formatDate(a.published_at)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      {a.view_count}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && !limit && (
            <div className="mt-8 flex items-center justify-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!hasPrev}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              {pageRange.map((p, i) =>
                p === '...' ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="px-2 text-sm text-gray-400"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-[40px] rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      p === page
                        ? 'bg-paroki-600 text-white'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={!hasNext}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
