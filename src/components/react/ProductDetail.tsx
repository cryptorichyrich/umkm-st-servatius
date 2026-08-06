import { useState, useEffect } from 'react';
import { supabase, type Product, ECOMMERCE_PLATFORMS } from '../../lib/supabase';
import { Search, MapPin, Store, Package, ArrowLeft, MessageCircle, ExternalLink, ShoppingBag } from 'lucide-react';
import FavoriteButton from './FavoriteButton';
import ViewCounter from './ViewCounter';
import PageViewTracker from './PageViewTracker';
import ReportButton from './ReportButton';
import { sanitizeHtml } from '../../lib/sanitize';
import ShareButtons from './ShareButtons';

interface Props { slug?: string; }

function formatPrice(price: number | null, note: string): string {
  if (!price) return note || 'Hubungi untuk harga';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price);
}

export default function ProductDetail({ slug: propSlug }: Props) {
  // Parse slug from URL — /{biz-slug}/{prod-slug} and legacy /produk/{slug}
  const slug = propSlug || (typeof window !== 'undefined'
    ? (() => {
        const parts = window.location.pathname.split('/').filter(Boolean);
        if (parts[0] === 'produk') return parts[1] || '';
        // /{biz-slug}/{prod-slug} — product slug is the last segment
        if (parts.length >= 2) return parts[parts.length - 1] || '';
        return parts[0] || '';
      })()
    : '');
  const [product, setProduct] = useState<Product | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fromProduk, setFromProduk] = useState(false);

  useEffect(() => {
    // Detect if user came from /produk listing for smart breadcrumb
    try {
      const ref = new URL(document.referrer);
      if (ref.origin === window.location.origin && (ref.pathname === '/produk' || ref.pathname.startsWith('/produk'))) {
        setFromProduk(true);
      }
    } catch { /* external/no referrer → default UMKM breadcrumb */ }
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`*, business:businesses(id, name, slug, whatsapp, phone, email, address, area, description, logo_url, instagram, facebook, tiktok, category:categories(id, name, slug, icon))`)
        .eq('slug', slug)
        .eq('is_available', true)
        .single();
      if (!error && data) {
        const p = data as unknown as Product;
        setProduct(p);
        const { data: imgs } = await supabase
          .from('product_images')
          .select('image_url')
          .eq('product_id', p.id)
          .order('sort_order', { ascending: true });
        const gallery = (imgs as { image_url: string }[])?.map((i) => i.image_url) || [];
        const all = [p.image_url, ...gallery].filter(Boolean);
        setGalleryImages(all);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-16"><div className="animate-pulse space-y-4"><div className="aspect-square rounded-lg bg-gray-100" /><div className="h-8 w-2/3 rounded bg-gray-100" /></div></div>;

  if (!product) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-gray-50 text-gray-400"><Search className="h-7 w-7" /></div>
        <h1 className="font-display text-2xl font-bold text-ink">Produk Tidak Ditemukan</h1>
        <a href="/produk" className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-5 py-2.5 font-bold text-white transition hover:bg-gold-600 active:translate-y-px"><ArrowLeft className="h-4 w-4" />Kembali ke Produk</a>
      </div>
    );
  }

  const b = product.business;
  const phone = b?.whatsapp || '';
  const waLink = phone ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Halo, saya tertarik dengan *${product.name}* dari *${b?.name || ''}* yang saya lihat di Direktori UMKM St. Servatius. Apakah masih tersedia?`)}` : null;

  const ecommerceLinks = ECOMMERCE_PLATFORMS.filter(
    (p) => product.ecommerce_links?.[p.key as keyof typeof product.ecommerce_links]
  );

  const hasRichDescription = product.rich_description && product.rich_description.trim().length > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
      <PageViewTracker type="product" slug={slug} />

      {/* Breadcrumb — smart based on origin */}
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-gray-500">
        <a href="/" className="transition hover:text-paroki-700">Beranda</a><span>/</span>
        {fromProduk ? (
          <>
            <a href="/produk" className="transition hover:text-paroki-700">Produk</a><span>/</span>
          </>
        ) : b?.slug ? (
          <>
            <a href={`/umkm/${b.slug}`} className="transition hover:text-paroki-700">{b.name}</a><span>/</span>
          </>
        ) : null}
        <span className="font-medium text-gray-700 line-clamp-1">{product.name}</span>
      </nav>

      {/* ── SECTION 1: Gallery + Purchase Card ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Gallery — 3/5 */}
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-xl bg-gray-50 shadow-sm ring-1 ring-gray-200/60">
            {galleryImages.length > 0
              ? <img src={galleryImages[activeImage]} alt={product.name} className="aspect-square w-full object-cover" />
              : <div className="flex aspect-square items-center justify-center text-gray-300"><Package className="h-24 w-24" /></div>}
          </div>
          {galleryImages.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {galleryImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${activeImage === i ? 'border-gold-500 ring-1 ring-gold-300' : 'border-gray-200 hover:border-gray-400'}`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Purchase Card — 2/5, sticky, COMPACT */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-20">
            {/* Badges + actions row */}
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {b?.category && (
                  <a href={`/kategori/${b.category.slug}`} className="inline-flex items-center rounded-full bg-paroki-50 px-2.5 py-1 text-xs font-semibold text-paroki-800 transition hover:bg-paroki-100">
                    {b.category.name}
                  </a>
                )}
                {product.product_type && (
                  <span className="inline-flex items-center rounded-full bg-gold-50 px-2.5 py-1 text-xs font-semibold text-gold-700">
                    {product.product_type === 'jasa' ? 'Jasa' : 'Produk'}
                  </span>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <FavoriteButton targetType="product" targetId={product.id} variant="button" />
                <ReportButton targetType="product" targetId={product.id} variant="compact" className="rounded-lg border border-gray-200 p-2" />
              </div>
            </div>

            {/* Title */}
            <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-ink break-words md:text-[1.75rem]">{product.name}</h1>

            {/* Price + views */}
            <div className="mt-2 flex items-center gap-3">
              <div className="text-xl font-bold text-paroki-700 md:text-2xl">{formatPrice(product.price, product.price_note)}</div>
              <ViewCounter count={product.view_count || 0} />
            </div>

            {/* Short description */}
            {product.description && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-500">{product.description}</p>
            )}

            {/* WhatsApp CTA — primary action */}
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-gold-600 active:translate-y-px"
              >
                <MessageCircle className="h-5 w-5" />Tanya via WhatsApp
              </a>
            )}

            {/* Share — inline, compact */}
            <div className="mt-3">
              <ShareButtons title={product.name} />
            </div>

            {/* Penyedia — compact card */}
            {b && (
              <a href={`/umkm/${b.slug}`} className="mt-4 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-paroki-200 hover:shadow-sm">
                {b.logo_url
                  ? <img src={b.logo_url} alt={b.name} className="h-11 w-11 flex-shrink-0 rounded-lg object-cover" />
                  : <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-paroki-50 text-paroki-400"><Store className="h-5 w-5" /></div>}
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm font-bold text-ink truncate">{b.name}</div>
                  {b.area && <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-500"><MapPin className="h-3 w-3" />{b.area}</div>}
                </div>
                <span className="flex-shrink-0 text-xs font-semibold text-paroki-700">Profil →</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Marketplace Links — FULL WIDTH, visible without deep scroll ── */}
      {ecommerceLinks.length > 0 && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 md:p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold text-ink">
            <ShoppingBag className="h-4.5 w-4.5 text-paroki-600" />
            Beli dari Marketplace
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {ecommerceLinks.map((platform) => {
              const url = product.ecommerce_links[platform.key as keyof typeof product.ecommerce_links];
              return (
                <a
                  key={platform.key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-3 text-sm font-semibold transition hover:border-gray-300 hover:bg-white hover:shadow-md active:translate-y-px"
                >
                  {'iconUrl' in platform && platform.iconUrl ? (
                    <img src={platform.iconUrl} alt={platform.label} className="h-7 w-7 flex-shrink-0 rounded object-contain" />
                  ) : (
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-xl">{platform.icon}</span>
                  )}
                  <span className="min-w-0 flex-1 text-ink truncate">{platform.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION 3: Detail Produk — FULL WIDTH ── */}
      {hasRichDescription && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 md:p-8">
          <h2 className="mb-4 font-display text-lg font-bold text-ink">Detail Produk</h2>
          <div
            className="wysiwyg-content max-w-none text-gray-600"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.rich_description) }}
          />
        </div>
      )}

      {/* Back link — smart based on origin */}
      <div className="mt-8">
        {fromProduk ? (
          <a href="/produk" className="inline-flex items-center gap-1.5 text-sm font-semibold text-paroki-700 transition hover:text-paroki-900 hover:underline">
            <ArrowLeft className="h-4 w-4" />Kembali ke Produk
          </a>
        ) : b?.slug ? (
          <a href={`/umkm/${b.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-paroki-700 transition hover:text-paroki-900 hover:underline">
            <ArrowLeft className="h-4 w-4" />Kembali ke {b.name}
          </a>
        ) : (
          <a href="/produk" className="inline-flex items-center gap-1.5 text-sm font-semibold text-paroki-700 transition hover:text-paroki-900 hover:underline">
            <ArrowLeft className="h-4 w-4" />Kembali ke Produk
          </a>
        )}
      </div>
    </div>
  );
}
