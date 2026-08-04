import { useState, useEffect, useCallback } from 'react';
import { supabase, type Product, type Category } from '../../lib/supabase';
import { Search, Package, Store, MessageCircle } from 'lucide-react';

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
  mode = 'all', businessId, businessSlug, businessName, businessWhatsapp, limit = 12,
}: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = limit;

  // Read search query from URL params (?q=...)
  useEffect(() => {
    if (typeof window !== 'undefined' && mode === 'all') {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      if (q) setSearch(q);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === 'all') {
      supabase.from('categories').select('*').order('name').then(({ data }) => {
        if (data) setCategories(data);
      });
    }
  }, [mode]);

  const fetchProducts = useCallback(async (reset = false) => {
    setLoading(true);
    const currentPage = reset ? 0 : page;
    const bEmbed = selectedCategory
      ? `business:businesses!inner(id, name, slug, whatsapp, category:categories(id, name, slug, icon))`
      : `business:businesses(id, name, slug, whatsapp, category:categories(id, name, slug, icon))`;
    let query = supabase.from('products').select(`*, ${bEmbed}`)
      .eq('is_available', true).order('sort_order', { ascending: true }).order('created_at', { ascending: false });
    if (mode === 'business' && businessId) query = query.eq('business_id', businessId);
    if (selectedCategory) query = query.eq('business.category_id', selectedCategory);
    if (search.trim()) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    if (mode !== 'business') query = query.range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);
    const { data, error } = await query;
    if (error) { console.error('Fetch error:', error); setLoading(false); return; }
    if (reset || mode === 'business') setProducts(data || []);
    else setProducts((prev) => [...prev, ...(data || [])]);
    setHasMore((data?.length || 0) === PAGE_SIZE);
    setLoading(false);
  }, [mode, businessId, selectedCategory, search, page, limit]);

  useEffect(() => { fetchProducts(true); }, [mode, businessId, selectedCategory, search]);
  useEffect(() => { if (page > 0) fetchProducts(false); }, [page]);
  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(0); fetchProducts(true); };
  const showFilters = mode === 'all';

  return (
    <div>
      {showFilters && (
        <div className="mb-6 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk..."
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-gray-400 focus:border-gold-400 focus:ring-2 focus:ring-gold-200" />
            </div>
            <button type="submit" className="rounded-lg bg-gold-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-gold-600 active:translate-y-px">Cari</button>
          </form>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setPage(0); }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold-400">
                <option value="">Semua Kategori</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {loading && products.length === 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-4 aspect-square rounded-lg bg-gray-100"></div>
              <div className="mb-2 h-5 w-3/4 rounded bg-gray-100"></div>
              <div className="h-4 w-1/2 rounded bg-gray-100"></div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 text-gray-400"><Package className="h-6 w-6" /></div>
          <p className="font-medium text-gray-700">Belum ada produk yang tersedia.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => {
              const phone = p.business?.whatsapp || businessWhatsapp || '';
              const wa = waLink(phone, p.name, p.business?.name || businessName);
              return (
                <div key={p.id} className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:border-gold-400 hover:shadow-soft">
                  <a href={`/produk/${p.slug}`} className="block">
                    <div className="relative aspect-square overflow-hidden bg-gray-100">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-300"><Package className="h-12 w-12" /></div>
                      )}
                      {p.business?.category && (
                        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-paroki-800 shadow-sm backdrop-blur-sm">{p.business.category.name}</span>
                      )}
                    </div>
                  </a>
                  <div className="flex flex-1 flex-col p-4">
                    <a href={`/produk/${p.slug}`}><h3 className="font-display text-[15px] font-bold leading-snug text-ink break-words transition hover:text-paroki-700">{p.name}</h3></a>
                    {p.description && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-500">{p.description}</p>}
                    <div className="mt-2 text-sm font-bold text-paroki-700">{formatPrice(p.price, p.price_note)}</div>
                    {p.business && mode !== 'business' && (
                      <a href={`/umkm/${p.business.slug}`} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-gray-400 transition hover:text-paroki-700">
                        <Store className="h-3.5 w-3.5" />{p.business.name}
                      </a>
                    )}
                    <div className="mt-auto pt-3">
                      {wa && (
                        <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 rounded-lg bg-gold-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-gold-600 active:translate-y-px">
                          <MessageCircle className="h-4 w-4" />Tanya via WhatsApp
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
              <button onClick={() => setPage((p) => p + 1)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:translate-y-px">Muat Lebih Banyak</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
