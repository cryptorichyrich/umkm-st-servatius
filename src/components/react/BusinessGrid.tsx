import { useState, useEffect, useCallback } from 'react';
import { supabase, type Business, type Category } from '../../lib/supabase';
import { IconSearch, IconPin, IconStore, IconChevronRight } from './icons';

interface Props {
  mode?: 'featured' | 'full' | 'category';
  categoryId?: string;
  initialCategories?: Category[];
  limit?: number;
}

export default function BusinessGrid({
  mode = 'full',
  categoryId,
  initialCategories = [],
  limit = 12,
}: Props) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories] = useState<Category[]>(initialCategories);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categoryId || '');
  const [selectedArea, setSelectedArea] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = limit;

  const fetchBusinesses = useCallback(
    async (reset = false) => {
      setLoading(true);
      const currentPage = reset ? 0 : page;

      let query = supabase
        .from('businesses')
        .select(
          `
          *,
          category:categories(*),
          images:business_images(*)
        `,
        )
        .eq('status', 'approved')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (mode === 'featured') {
        query = query.eq('is_featured', true).limit(limit);
      } else {
        if (mode === 'category' && categoryId) {
          query = query.eq('category_id', categoryId);
        }
        if (selectedCategory) {
          query = query.eq('category_id', selectedCategory);
        }
        if (selectedArea) {
          query = query.eq('area', selectedArea);
        }
        if (search.trim()) {
          query = query.or(
            `name.ilike.%${search}%,description.ilike.%${search}%`,
          );
        }
        query = query.range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Fetch error:', error);
        setLoading(false);
        return;
      }

      if (reset || mode === 'featured') {
        setBusinesses(data || []);
      } else {
        setBusinesses((prev) => [...prev, ...(data || [])]);
      }
      setHasMore((data?.length || 0) === PAGE_SIZE);
      setLoading(false);
    },
    [mode, categoryId, selectedCategory, selectedArea, search, page, limit],
  );

  // Fetch areas on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('businesses')
        .select('area')
        .eq('status', 'approved')
        .not('area', 'eq', '');
      const uniqueAreas = [...new Set((data || []).map((d) => d.area))].sort();
      setAreas(uniqueAreas);
    })();
  }, []);

  // Fetch on filter change
  useEffect(() => {
    fetchBusinesses(true);
  }, [mode, categoryId, selectedCategory, selectedArea, search]);

  // Fetch on page change (load more)
  useEffect(() => {
    if (page > 0) fetchBusinesses(false);
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchBusinesses(true);
  };

  const showFilters = mode !== 'featured';

  return (
    <div>
      {/* Search & Filters */}
      {showFilters && (
        <div className="mb-6 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-paroki-400">
                <IconSearch className="h-4.5 w-4.5" />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama usaha atau jasa..."
                className="w-full rounded-lg border border-paroki-200 bg-white py-2.5 pl-10 pr-4 text-sm text-paroki-900 outline-none transition placeholder:text-paroki-400 focus:border-paroki-400 focus:ring-2 focus:ring-paroki-200"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-paroki-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-paroki-700 active:translate-y-px"
            >
              Cari
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {mode !== 'category' && (
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(0);
                }}
                className="rounded-lg border border-paroki-200 bg-white px-3 py-2 text-sm text-paroki-800 outline-none transition focus:border-paroki-400"
              >
                <option value="">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={selectedArea}
              onChange={(e) => {
                setSelectedArea(e.target.value);
                setPage(0);
              }}
              className="rounded-lg border border-paroki-200 bg-white px-3 py-2 text-sm text-paroki-800 outline-none transition focus:border-paroki-400"
            >
              <option value="">Semua Wilayah</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading && businesses.length === 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-paroki-200 bg-white p-4"
            >
              <div className="mb-4 aspect-[4/3] rounded-lg bg-paroki-100"></div>
              <div className="mb-2 h-5 w-3/4 rounded bg-paroki-100"></div>
              <div className="h-4 w-full rounded bg-paroki-100"></div>
            </div>
          ))}
        </div>
      ) : businesses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-paroki-300 bg-white py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-paroki-50 text-paroki-400">
            <IconSearch className="h-6 w-6" />
          </div>
          <p className="font-medium text-paroki-700">Belum ada usaha yang ditemukan.</p>
          {search && <p className="mt-1 text-sm text-paroki-500">Coba kata kunci lain atau ubah filter.</p>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {businesses.map((b) => {
              const waLink = b.whatsapp
                ? `https://wa.me/${b.whatsapp.replace(/[^0-9]/g, '')}`
                : null;
              return (
                <a
                  key={b.id}
                  href={`/umkm/${b.slug}`}
                  className="group flex flex-col overflow-hidden rounded-lg border border-paroki-200 bg-white transition hover:border-paroki-300 hover:shadow-soft"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-paroki-100">
                    {b.logo_url || b.images?.[0]?.image_url ? (
                      <img
                        src={b.logo_url || b.images?.[0]?.image_url}
                        alt={b.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-paroki-300">
                        <IconStore className="h-12 w-12" />
                      </div>
                    )}
                    {b.category && (
                      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-paroki-700 shadow-sm backdrop-blur-sm">
                        {b.category.name}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="font-display text-base font-bold leading-snug text-paroki-900 break-words">
                      {b.name}
                    </h3>
                    {b.description && (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-paroki-600">{b.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-paroki-500">
                      {b.area && (
                        <span className="inline-flex items-center gap-1">
                          <IconPin className="h-3.5 w-3.5" />
                          {b.area}
                        </span>
                      )}
                      {waLink && (
                        <span className="inline-flex items-center gap-1 font-medium text-paroki-600">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-.9-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4-.1-.5-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.2-.2-.5-.3M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2"/></svg>
                          WhatsApp
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>

          {/* Load more */}
          {hasMore && !loading && mode !== 'featured' && (
            <div className="mt-8 text-center">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-paroki-300 bg-white px-6 py-2.5 text-sm font-semibold text-paroki-700 transition hover:bg-paroki-50 active:translate-y-px"
              >
                Muat Lebih Banyak
                <IconChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
