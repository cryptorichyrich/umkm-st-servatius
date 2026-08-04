import { useState, useEffect, useCallback } from 'react';
import { supabase, type Category } from '../../lib/supabase';
import { Search, Store, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

interface Props {
  mode?: 'all' | 'business';
  businessId?: string;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  cover_image: string;
  status: string;
  published_at: string | null;
  view_count: number;
  business: any;
  category: any;
}

function formatDate(date: string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

const PER_PAGE = 10;

export default function BlogGrid({ mode = 'all', businessId }: Props) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.ceil(totalCount / PER_PAGE);

  // Fetch categories (same as UMKM categories)
  useEffect(() => {
    if (mode !== 'all') return;
    supabase.from('categories').select('*').order('name').then(({ data }) => {
      if (data) setCategories(data as Category[]);
    });
  }, [mode]);

  const fetchPosts = useCallback(async (pageNum: number) => {
    setLoading(true);
    const from = pageNum * PER_PAGE;
    const to = from + PER_PAGE - 1;

    let query = supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image, status, published_at, view_count, business:businesses(name, slug), category:categories(name, slug)', { count: 'exact' })
      .eq('status', 'approved')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (mode === 'business' && businessId) {
      query = query.eq('business_id', businessId);
    }
    if (selectedCategory) {
      query = query.eq('category_id', selectedCategory);
    }
    if (search.trim()) {
      query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
    }

    const { data, count, error } = await query.range(from, to);
    if (error) { console.error('Blog fetch error:', error); setLoading(false); return; }
    setPosts((data || []) as unknown as BlogPost[]);
    setTotalCount(count || 0);
    setLoading(false);
  }, [mode, businessId, selectedCategory, search]);

  useEffect(() => {
    setPage(0);
    fetchPosts(0);
  }, [mode, businessId, selectedCategory, search]);

  useEffect(() => {
    if (page > 0 || totalCount > 0) fetchPosts(page);
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchPosts(0);
  };

  // Truncated page numbers for pagination
  function getPageNumbers(): (number | '...')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const pages: (number | '...')[] = [0];
    if (page > 2) pages.push('...');
    const start = Math.max(1, page - 1);
    const end = Math.min(totalPages - 2, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 3) pages.push('...');
    pages.push(totalPages - 1);
    return pages;
  }

  const showFilters = mode === 'all';

  return (
    <div>
      {showFilters && (
        <div className="mb-6 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari artikel..."
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-gray-400 focus:border-gold-400 focus:ring-2 focus:ring-gold-200"
              />
            </div>
            <button type="submit" className="rounded-lg bg-gold-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-gold-600 active:translate-y-px">
              Cari
            </button>
          </form>

          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { setSelectedCategory(''); setPage(0); }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  !selectedCategory
                    ? 'bg-paroki-700 text-white'
                    : 'bg-gray-50 text-gray-600 ring-1 ring-gray-200 hover:bg-paroki-50 hover:text-paroki-800'
                }`}
              >
                Semua
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCategory(c.id); setPage(0); }}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    selectedCategory === c.id
                      ? 'bg-paroki-700 text-white'
                      : 'bg-gray-50 text-gray-600 ring-1 ring-gray-200 hover:bg-paroki-50 hover:text-paroki-800'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && posts.length === 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="aspect-video bg-gray-100"></div>
              <div className="p-5">
                <div className="mb-2 h-5 w-3/4 rounded bg-gray-100"></div>
                <div className="h-4 w-full rounded bg-gray-100"></div>
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
            <FileText className="h-6 w-6" />
          </div>
          <p className="font-medium text-gray-700">Belum ada artikel yang ditemukan.</p>
          {search && <p className="mt-1 text-sm text-gray-400">Coba kata kunci lain atau ubah filter.</p>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => {
              const biz = Array.isArray(post.business) ? post.business[0] : post.business;
              const cat = Array.isArray(post.category) ? post.category[0] : post.category;
              return (
                <a
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="relative aspect-video overflow-hidden bg-gray-100">
                    {post.cover_image ? (
                      <img
                        src={post.cover_image}
                        alt={post.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <FileText className="h-12 w-12" />
                      </div>
                    )}
                    {cat && (
                      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-paroki-800 shadow-sm backdrop-blur-sm">
                        {cat.name}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-display text-base font-bold leading-snug text-ink break-words transition group-hover:text-paroki-700">
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-gray-500">{post.excerpt}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-gray-400">
                      {biz && (
                        <a
                          href={`/umkm/${biz.slug}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 font-medium text-gray-500 transition hover:text-paroki-700"
                        >
                          <Store className="h-3.5 w-3.5" />
                          {biz.name}
                        </a>
                      )}
                      {post.published_at && <span className="shrink-0">{formatDate(post.published_at)}</span>}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-1.5">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {getPageNumbers().map((pn, idx) =>
                pn === '...' ? (
                  <span key={`dots-${idx}`} className="px-2 text-gray-400">…</span>
                ) : (
                  <button
                    key={pn}
                    onClick={() => setPage(pn)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold transition ${
                      page === pn
                        ? 'border-paroki-700 bg-paroki-700 text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {pn + 1}
                  </button>
                )
              )}
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
