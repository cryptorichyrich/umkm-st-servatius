import { useState, useEffect } from 'react';
import { supabase, type Product, ECOMMERCE_PLATFORMS } from '../../lib/supabase';
import { Search, MapPin, Store, Package, ArrowLeft, MessageCircle, ExternalLink } from 'lucide-react';
import FavoriteButton from './FavoriteButton';
import ViewCounter from './ViewCounter';
import PageViewTracker from './PageViewTracker';
import ReportButton from './ReportButton';
import ShareButtons from './ShareButtons';

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
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageViewTracker type="product" slug={slug} />
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-gray-500">
        <a href="/" className="transition hover:text-paroki-700">Beranda</a><span>/</span>
        <a href="/produk" className="transition hover:text-paroki-700">Produk</a><span>/</span>
        <span className="font-medium text-gray-700">{product.name}</span>
      </nav>

      {/* ── Main grid: image (left) + info sidebar (right, sticky) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Image + Gallery — takes 3/5 on desktop */}
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-xl bg-gray-100 shadow-sm">
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

          {/* Rich Description moved HERE — below image, fills left column space */}
          {hasRichDescription && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 font-display text-xl font-bold text-ink">Detail Produk</h2>
              <div
                className="wysiwyg-content max-w-none text-gray-600"
                dangerouslySetInnerHTML={{ __html: product.rich_description }}
              />
            </div>
          )}
        </div>

        {/* Info sidebar — takes 2/5 on desktop, sticky */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-20 space-y-4">
            {/* Category + actions */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {b?.category && (
                  <a href={`/kategori/${b.category.slug}`} className="mb-1.5 inline-flex w-fit items-center rounded-full bg-paroki-50 px-3 py-1 text-xs font-semibold text-paroki-800 transition hover:bg-paroki-100">
                    {b.category.name}
                  </a>
                )}
                {product.product_type && (
                  <span className="ml-1 inline-flex w-fit items-center rounded-full bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-700">
                    {product.product_type === 'jasa' ? 'Jasa' : 'Produk'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <FavoriteButton targetType="product" targetId={product.id} variant="button" />
                <ReportButton targetType="product" targetId={product.id} variant="compact" className="rounded-lg border border-gray-200 p-2" />
              </div>
            </div>

            {/* Title */}
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink break-words md:text-3xl">{product.name}</h1>

            {/* Price + views */}
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-paroki-700">{formatPrice(product.price, product.price_note)}</div>
              <ViewCounter count={product.view_count || 0} />
            </div>

            {/* Description */}
            {product.description && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{product.description}</p>
            )}

            {/* WhatsApp CTA */}
            {waLink && (
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-lg bg-gold-500 px-5 py-3.5 font-bold text-white transition hover:bg-gold-600 active:translate-y-px">
                <MessageCircle className="h-5 w-5" />Tanya via WhatsApp
              </a>
            )}

            <ShareButtons title={product.name} />

            {/* Penyedia (Business card) */}
            {b && (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500"><Store className="h-3.5 w-3.5" />Penyedia</h3>
                <a href={`/umkm/${b.slug}`} className="flex items-center gap-3 transition hover:opacity-80">
                  {b.logo_url
                    ? <img src={b.logo_url} alt={b.name} className="h-11 w-11 rounded-lg object-cover" />
                    : <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-paroki-50 text-paroki-400"><Store className="h-5 w-5" /></div>}
                  <div className="min-w-0">
                    <div className="font-display font-bold text-ink truncate">{b.name}</div>
                    {b.area && <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-500"><MapPin className="h-3.5 w-3.5" />{b.area}</div>}
                  </div>
                </a>
                <a href={`/umkm/${b.slug}`} className="mt-3 inline-block text-sm font-semibold text-paroki-700 transition hover:text-paroki-900 hover:underline">Lihat profil Usaha →</a>
              </div>
            )}

            {/* E-commerce Links */}
            {ecommerceLinks.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500"><ExternalLink className="h-3.5 w-3.5" />Beli dari Marketplace</h3>
                <div className="grid grid-cols-1 gap-2">
                  {ecommerceLinks.map((platform) => {
                    const url = product.ecommerce_links[platform.key as keyof typeof product.ecommerce_links];
                    return (
                      <a
                        key={platform.key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-semibold transition hover:shadow-sm active:translate-y-px"
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
          </div>
        </div>
      </div>

      {/* Back link */}
      <div className="mt-8">
        <a href="/produk" className="inline-flex items-center gap-1.5 text-sm font-semibold text-paroki-700 transition hover:text-paroki-900 hover:underline">
          <ArrowLeft className="h-4 w-4" />Kembali ke Produk
        </a>
      </div>
    </div>
  );
}
