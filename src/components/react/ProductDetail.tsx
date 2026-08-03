import { useState, useEffect } from 'react';
import { supabase, type Product, ECOMMERCE_PLATFORMS } from '../../lib/supabase';
import { Search, MapPin, Store, Package, ArrowLeft, MessageCircle, ExternalLink, Eye, Heart } from 'lucide-react';
import FavoriteButton from './FavoriteButton';
import ViewCounter from './ViewCounter';
import PageViewTracker from './PageViewTracker';
import ReportButton from './ReportButton';

interface Props { slug: string; }

function formatPrice(price: number | null, note: string): string {
  if (!price) return note || 'Hubungi untuk harga';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price);
}

export default function ProductDetail({ slug }: Props) {
  const [product, setProduct] = useState<Product | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);

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
        // Fetch gallery images
        const { data: imgs } = await supabase
          .from('product_images')
          .select('image_url')
          .eq('product_id', p.id)
          .order('sort_order', { ascending: true });
        const gallery = (imgs as { image_url: string }[])?.map((i) => i.image_url) || [];
        // Combine: main image first, then gallery
        const all = [p.image_url, ...gallery].filter(Boolean);
        setGalleryImages(all);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-16"><div className="animate-pulse space-y-4"><div className="aspect-square rounded-lg bg-gray-100"></div><div className="h-8 w-2/3 rounded bg-gray-100"></div></div></div>;

  if (!product) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-gray-50 text-gray-400"><Search className="h-7 w-7" /></div>
        <h1 className="font-display text-2xl font-bold text-ink">Produk Tidak Ditemukan</h1>
        <a href="/produk" className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-5 py-2.5 font-bold text-white transition hover:bg-gold-600 active:translate-y-px"><ArrowLeft className="h-4 w-4" />Kembali ke Produk</a>
      </div>
    );
  }

  const b = product.business;
  const phone = b?.whatsapp || '';
  const waLink = phone ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Halo, saya tertarik dengan *${product.name}* dari *${b?.name || ''}* yang saya lihat di Direktori UMKM St. Servatius. Apakah masih tersedia?`)}` : null;

  // Parse e-commerce links (filter non-empty)
  const ecommerceLinks = ECOMMERCE_PLATFORMS.filter(
    (p) => product.ecommerce_links?.[p.key as keyof typeof product.ecommerce_links]
  );

  const hasRichDescription = product.rich_description && product.rich_description.trim().length > 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageViewTracker type="product" slug={slug} />
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-gray-500">
        <a href="/" className="transition hover:text-paroki-700">Beranda</a><span>/</span>
        <a href="/produk" className="transition hover:text-paroki-700">Produk</a><span>/</span>
        <span className="font-medium text-gray-700">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Image / Gallery */}
        <div>
          <div className="overflow-hidden rounded-xl bg-gray-100 shadow-soft">
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
                  className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${activeImage === i ? 'border-gold-500' : 'border-transparent hover:border-gray-300'}`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {b?.category && (
                <a href={`/kategori/${b.category.slug}`} className="mb-2 inline-flex w-fit items-center rounded-full bg-paroki-50 px-3 py-1 text-xs font-semibold text-paroki-800 transition hover:bg-paroki-100">
                  {b.category.name}
                </a>
              )}
              {product.product_type && (
                <span className="mb-2 ml-1 inline-flex w-fit items-center rounded-full bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-700">
                  {product.product_type === 'jasa' ? 'Jasa' : 'Produk'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <FavoriteButton targetType="product" targetId={product.id} variant="button" />
              <ReportButton targetType="product" targetId={product.id} variant="full" className="rounded-lg border border-gray-200 px-3 py-2.5" />
            </div>
          </div>

          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink break-words">{product.name}</h1>

          <div className="mt-3 flex items-center gap-3">
            <div className="text-2xl font-bold text-paroki-700">{formatPrice(product.price, product.price_note)}</div>
            <ViewCounter count={product.view_count || 0} />
          </div>

          {product.description && (
            <div className="mt-4">
              <h2 className="mb-1 font-display text-lg font-bold text-ink">Ringkasan</h2>
              <p className="max-w-[65ch] whitespace-pre-wrap leading-relaxed text-gray-600">{product.description}</p>
            </div>
          )}

          {/* WhatsApp CTA */}
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-gold-500 px-5 py-3.5 font-bold text-white transition hover:bg-gold-600 active:translate-y-px">
              <MessageCircle className="h-5 w-5" />Tanya via WhatsApp
            </a>
          )}

          {/* E-commerce Links — "Beli dari Toko Lain" pattern */}
          {ecommerceLinks.length > 0 && (
            <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-ink">
                <ExternalLink className="h-4 w-4 text-gray-400" />
                Beli dari Marketplace
              </h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {ecommerceLinks.map((platform) => {
                  const url = product.ecommerce_links[platform.key as keyof typeof product.ecommerce_links];
                  return (
                    <a
                      key={platform.key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-semibold transition hover:shadow-soft active:translate-y-px"
                      style={{ borderColor: platform.color + '40' }}
                    >
                      {'iconUrl' in platform && platform.iconUrl ? (
                        <img src={platform.iconUrl} alt={platform.label} className="h-6 w-6 rounded object-contain" />
                      ) : (
                        <span className="text-lg">{platform.icon}</span>
                      )}
                      <span className="flex-1 text-ink">{platform.label}</span>
                      <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Business card */}
          {b && (
            <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-ink"><Store className="h-4 w-4 text-gray-400" />Penyedia</h3>
              <a href={`/umkm/${b.slug}`} className="flex items-center gap-3 transition hover:opacity-80">
                {b.logo_url
                  ? <img src={b.logo_url} alt={b.name} className="h-12 w-12 rounded-lg object-cover" />
                  : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 text-gray-400"><Store className="h-6 w-6" /></div>}
                <div>
                  <div className="font-display font-bold text-ink">{b.name}</div>
                  {b.area && <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-500"><MapPin className="h-3.5 w-3.5" />{b.area}</div>}
                </div>
              </a>
              {b.description && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-500">{b.description}</p>}
              <a href={`/umkm/${b.slug}`} className="mt-3 inline-block text-sm font-semibold text-paroki-700 transition hover:text-paroki-900 hover:underline">Lihat profil Usaha →</a>
            </div>
          )}
        </div>
      </div>

      {/* Rich Description (WYSIWYG content) */}
      {hasRichDescription && (
        <div className="mt-10 rounded-xl border border-gray-200 bg-white p-6 md:p-8">
          <h2 className="mb-4 font-display text-xl font-bold text-ink">Detail Produk</h2>
          <div
            className="wysiwyg-content max-w-none text-gray-600"
            dangerouslySetInnerHTML={{ __html: product.rich_description }}
          />
        </div>
      )}

      <div className="mt-8">
        <a href="/produk" className="inline-flex items-center gap-1.5 text-sm font-semibold text-paroki-700 transition hover:text-paroki-900 hover:underline">
          <ArrowLeft className="h-4 w-4" />Kembali ke Produk
        </a>
      </div>
    </div>
  );
}
