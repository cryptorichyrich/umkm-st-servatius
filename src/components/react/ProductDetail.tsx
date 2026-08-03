import { useState, useEffect } from 'react';
import { supabase, type Product } from '../../lib/supabase';
import { IconSearch, IconPin, IconStore, IconPackage, IconArrowLeft } from './icons';

interface Props {
  slug: string;
}

function formatPrice(price: number | null, note: string): string {
  if (!price) return note || 'Hubungi untuk harga';
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(price);
  return note ? `${formatted} ${note}` : formatted;
}

export default function ProductDetail({ slug }: Props) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('products')
        .select(
          `
          *,
          business:businesses(
            id, name, slug, whatsapp, phone, email, address, area,
            description, logo_url, instagram, facebook, tiktok,
            category:categories(id, name, slug, icon)
          )
        `,
        )
        .eq('slug', slug)
        .eq('is_available', true)
        .single();

      if (!error && data) {
        setProduct(data);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="aspect-square rounded-lg bg-paroki-100"></div>
          <div className="h-8 w-2/3 rounded bg-paroki-100"></div>
          <div className="h-4 w-full rounded bg-paroki-100"></div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-paroki-50 text-paroki-400">
          <IconSearch className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-paroki-900">Produk Tidak Ditemukan</h1>
        <a
          href="/produk"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-paroki-600 px-5 py-2.5 font-semibold text-white transition hover:bg-paroki-700 active:translate-y-px"
        >
          <IconArrowLeft className="h-4 w-4" />
          Kembali ke Produk
        </a>
      </div>
    );
  }

  const b = product.business;
  const phone = b?.whatsapp || '';
  const waLink = phone
    ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
        `Halo, saya tertarik dengan *${product.name}* dari *${b?.name || ''}* yang saya lihat di Direktori UMKM St. Servatius. Apakah masih tersedia?`,
      )}`
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-paroki-500">
        <a href="/" className="transition hover:text-paroki-700">Beranda</a>
        <span>/</span>
        <a href="/produk" className="transition hover:text-paroki-700">Produk</a>
        <span>/</span>
        <span className="font-medium text-paroki-700">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Product Image */}
        <div className="overflow-hidden rounded-xl bg-paroki-100 shadow-soft">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center text-paroki-300">
              <IconPackage className="h-24 w-24" />
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex flex-col">
          {b?.category && (
            <a
              href={`/kategori/${b.category.slug}`}
              className="mb-2 inline-flex w-fit items-center rounded-full bg-paroki-100 px-3 py-1 text-xs font-semibold text-paroki-700 transition hover:bg-paroki-200"
            >
              {b.category.name}
            </a>
          )}

          <h1 className="font-display text-3xl font-extrabold tracking-tight text-paroki-900 break-words">{product.name}</h1>

          <div className="mt-3 text-2xl font-bold text-paroki-700">
            {formatPrice(product.price, product.price_note)}
          </div>

          {product.description && (
            <div className="mt-4">
              <h2 className="mb-1 font-display text-lg font-bold text-paroki-900">Deskripsi</h2>
              <p className="max-w-[65ch] whitespace-pre-wrap leading-relaxed text-paroki-700">{product.description}</p>
            </div>
          )}

          {/* WhatsApp CTA */}
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-paroki-600 px-5 py-3.5 font-semibold text-white transition hover:bg-paroki-700 active:translate-y-px"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.5 14.4c-.3-.1-1.8-.9-2-.9-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4-.1-.5-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.2-.2-.5-.3M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2" />
              </svg>
              Tanya via WhatsApp
            </a>
          )}

          {/* Business card */}
          {b && (
            <div className="mt-6 rounded-lg border border-paroki-200 bg-white p-5">
              <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-paroki-900">
                <IconStore className="h-4.5 w-4.5 text-paroki-500" />
                Penyedia
              </h3>
              <a href={`/umkm/${b.slug}`} className="flex items-center gap-3 transition hover:opacity-80">
                {b.logo_url ? (
                  <img src={b.logo_url} alt={b.name} className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-paroki-100 text-paroki-400">
                    <IconStore className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <div className="font-display font-bold text-paroki-900">{b.name}</div>
                  {b.area && (
                    <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-paroki-500">
                      <IconPin className="h-3.5 w-3.5" />
                      {b.area}
                    </div>
                  )}
                </div>
              </a>
              {b.description && (
                <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-paroki-600">{b.description}</p>
              )}
              <a
                href={`/umkm/${b.slug}`}
                className="mt-3 inline-block text-sm font-semibold text-paroki-600 transition hover:text-paroki-900 hover:underline"
              >
                Lihat profil usaha →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
