import { useState, useEffect, useCallback } from 'react';
import { supabase, type Product, type Category } from '../../lib/supabase';
import { IconSearch, IconPackage, IconStore } from './icons';

interface Props {
  mode?: 'all' | 'business';
  businessId?: string;
  businessSlug?: string;
  businessName?: string;
  businessWhatsapp?: string;
  limit?: number;
}

function formatPrice(price: number | null, note: string): string {
  if (!price) return note || 'Hubungi untuk harga';
  const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price);
  return note ? `${formatted} ${note}` : formatted;
}

function waLink(phone: string, productName: string, businessName?: string) {
  const num = phone.replace(/[^0-9]/g, '');
  if (!num) return null;
  const msg = businessName
    ? `Halo, saya tertarik dengan *${productName}* dari *${businessName}* yang saya lihat di Direktori UMKM St. Servatius. Apakah masih tersedia?`
    : `Halo, saya tertarik dengan *${productName}* yang saya lihat di Direktori UMKM St. Servatius. Apakah masih tersedia?`;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

export default function ProductGrid({
  mode = 'all',
  businessId,
  businessSlug,
  businessName,
  businessWhatsapp,
  limit = 12,
}: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = limit;

  const fetchProducts = useCallback(
    async (reset = false) => {
      setLoading(true);
      const currentPage = reset ? 0 : page;

      let query = supabase
        .from('products')
        .select(
          `
          *,
          business:businesses(id, name, slug, whatsapp, category:categories(id, name, slug, icon))
        `,
        )
        .eq('is_available', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (mode === 'business' && businessId) {
        query = query.eq('business_id', businessId);
      }

      if (search.trim()) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      if (mode !== 'business') {
        query = query.range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Fetch error:', error);
        setLoading(false);
        return;
      }

      if (reset || mode === 'business') {
        setProducts(data || []);
      } else {
        setProducts((prev) => [...prev, ...(data || [])]);
      }
      setHasMore((data?.length || 0) === PAGE_SIZE);
      setLoading(false);
    },
    [mode, businessId, search, page, limit],
  );

  useEffect(() => {
    fetchProducts(true);
  }, [mode, businessId, search]);

  useEffect(() => {
    if (page > 0) fetchProducts(false);
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchProducts(true);
  };

  const showFilters = mode === 'all';

  return (
    <div>
      {showFilters && (
        <div className="mb-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-paroki-400">
                <IconSearch className="h-4.5 w-4.5" />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari produk..."
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
        </div>
      )}

      {loading && products.length === 0 ? (
        <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-paroki-200 bg-white p-4">
              <div className="mb-4 aspect-square rounded-lg bg-paroki-100"></div>
              <div className="mb-2 h-5 w-3/4 rounded bg-paroki-100"></div>
              <div className="h-4 w-1/2 rounded bg-paroki-100"></div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-paroki-300 bg-white py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-paroki-50 text-paroki-400">
            <IconPackage className="h-6 w-6" />
          </div>
          <p className="font-medium text-paroki-700">Belum ada produk yang tersedia.</p>
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`}>
            {products.map((p) => {
              const phone = p.business?.whatsapp || businessWhatsapp || '';
              const wa = waLink(phone, p.name, p.business?.name || businessName);
              return (
                <div
                  key={p.id}
                  className="group flex flex-col overflow-hidden rounded-lg border border-paroki-200 bg-white transition hover:border-paroki-300 hover:shadow-soft"
                >
                  <a href={mode === 'business' && businessSlug ? `/produk/${p.slug}` : `/produk/${p.slug}`} className="block">
                    <div className="relative aspect-square overflow-hidden bg-paroki-100">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-paroki-300">
                          <IconPackage className="h-12 w-12" />
                        </div>
                      )}
                      {p.business?.category && (
                        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-paroki-700 shadow-sm backdrop-blur-sm">
                          {p.business.category.name}
                        </span>
                      )}
                    </div>
                  </a>
                  <div className="flex flex-1 flex-col p-4">
                    <a href={`/produk/${p.slug}`}>
                      <h3 className="font-display text-[15px] font-bold leading-snug text-paroki-900 break-words transition hover:text-paroki-700">
                        {p.name}
                      </h3>
                    </a>
                    {p.description && (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-paroki-600">{p.description}</p>
                    )}
                    <div className="mt-2 text-sm font-bold text-paroki-700">
                      {formatPrice(p.price, p.price_note)}
                    </div>
                    {p.business && mode !== 'business' && (
                      <a
                        href={`/umkm/${p.business.slug}`}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-paroki-500 transition hover:text-paroki-800"
                      >
                        <IconStore className="h-3.5 w-3.5" />
                        {p.business.name}
                      </a>
                    )}
                    <div className="mt-auto pt-3">
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 rounded-lg bg-paroki-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-paroki-700 active:translate-y-px"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-.9-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4-.1-.5-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.2-.2-.5-.3M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2"/></svg>
                          Tanya via WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && !loading && mode === 'all' && (
            <div className="mt-8 text-center">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-paroki-300 bg-white px-6 py-2.5 text-sm font-semibold text-paroki-700 transition hover:bg-paroki-50 active:translate-y-px"
              >
                Muat Lebih Banyak
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
