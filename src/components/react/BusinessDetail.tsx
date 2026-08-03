import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, type Business, type Product } from '../../lib/supabase';
import { IconSearch, IconPin, IconStar, IconPhone, IconClock, IconStore, IconPackage, IconArrowLeft, IconArrowRight } from './icons';

interface Props {
  slug: string;
}

// Demo data for when Supabase is not configured
const demoBusinesses: Record<string, Business> = {
  'katering-bu-maria': {
    id: 'demo1',
    owner_id: '',
    name: 'Katering Bu Maria',
    slug: 'katering-bu-maria',
    description:
      'Katering rumahan dengan menu harian berganti. Masakan Indonesia autentik, cocok untuk acara paroki, pertemuan, atau daily lunch. Harga terjangkau, porsi melimpah. Melayani pesanan untuk 10-200 porsi.',
    category_id: '',
    whatsapp: '628123456789',
    phone: '08123456789',
    email: '',
    address: 'Jl. Melati No. 12, dekat Gereja Paroki',
    area: 'Wilayah 1',
    instagram: '@kateringbumaria',
    facebook: '',
    tiktok: '',
    operating_hours: { weekdays: '08:00 - 17:00', weekend: '07:00 - 14:00' },
    logo_url: '',
    status: 'approved',
    is_featured: true,
    rejection_note: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category: { id: '1', name: 'Kuliner & Minuman', slug: 'kuliner-minuman', icon: '🍜', sort_order: 1 },
    images: [],
  },
  'tailor-pak-budi': {
    id: 'demo2',
    owner_id: '',
    name: 'Tailor Pak Budi',
    slug: 'tailor-pak-budi',
    description:
      'Jahit dan perbaiki pakaian dengan presisi. Spesialisasi: seragam, hem, celana, gaun pesta. Accepting custom orders untuk baju choir dan altar server. Pengambilan dan antar dalam area paroki.',
    category_id: '',
    whatsapp: '628987654321',
    phone: '08987654321',
    email: '',
    address: 'Jl. Mawar No. 45',
    area: 'Wilayah 3',
    instagram: '',
    facebook: 'Tailor Pak Budi',
    tiktok: '',
    operating_hours: { weekdays: '09:00 - 18:00', saturday: '09:00 - 15:00' },
    logo_url: '',
    status: 'approved',
    is_featured: false,
    rejection_note: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category: { id: '2', name: 'Jasa & Service', slug: 'jasa-service', icon: '🔧', sort_order: 2 },
    images: [],
  },
};

const IG = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17" cy="7" r="0.6" fill="currentColor" />
  </svg>
);
const FB = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13.5 21v-7h2.3l.4-2.8h-2.7V9.4c0-.8.3-1.3 1.4-1.3h1.4V5.6c-.7-.1-1.4-.1-2.1-.1-2.1 0-3.5 1.2-3.5 3.6v2.1H8.3V14h2.3v7h2.9Z" />
  </svg>
);
const TT = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M14 3h2.6c.3 1.7 1.3 3.2 3.4 3.5v2.6c-1.3 0-2.5-.3-3.5-1v6.2a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.7a2.9 2.9 0 1 0 2 2.8V3H14Z" />
  </svg>
);

export default function BusinessDetail({ slug }: Props) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    (async () => {
      // Check demo data first (only when Supabase not configured)
      if (!isSupabaseConfigured && demoBusinesses[slug]) {
        setBusiness(demoBusinesses[slug]);
        setLoading(false);
        return;
      }

      // Fetch from Supabase
      const { data, error } = await supabase
        .from('businesses')
        .select(
          `
          *,
          category:categories(*),
          images:business_images(*)
        `,
        )
        .eq('slug', slug)
        .eq('status', 'approved')
        .single();

      if (!error && data) {
        setBusiness(data);
        // Fetch products for this business
        const { data: prods } = await supabase
          .from('products')
          .select('*')
          .eq('business_id', data.id)
          .eq('is_available', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false });
        setProducts(prods || []);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="aspect-[16/9] rounded-lg bg-paroki-100"></div>
          <div className="h-8 w-2/3 rounded bg-paroki-100"></div>
          <div className="h-4 w-full rounded bg-paroki-100"></div>
          <div className="h-4 w-5/6 rounded bg-paroki-100"></div>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-paroki-50 text-paroki-400">
          <IconSearch className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-paroki-900">Usaha Tidak Ditemukan</h1>
        <p className="mt-2 text-paroki-600">
          Usaha yang Anda cari mungkin belum terdaftar atau sudah dihapus.
        </p>
        <a
          href="/direktori"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-paroki-600 px-5 py-2.5 font-semibold text-white transition hover:bg-paroki-700 active:translate-y-px"
        >
          <IconArrowLeft className="h-4 w-4" />
          Kembali ke Direktori
        </a>
      </div>
    );
  }

  const waLink = business.whatsapp
    ? `https://wa.me/${business.whatsapp.replace(/[^0-9]/g, '')}?text=Halo, saya tertarik dengan ${encodeURIComponent(business.name)} yang saya lihat di Direktori UMKM St. Servatius.`
    : null;

  const allImages = [business.logo_url, ...(business.images || []).map((img) => img.image_url)].filter(
    Boolean,
  );

  const socials = [
    { label: 'Instagram', value: business.instagram, url: business.instagram ? `https://instagram.com/${business.instagram.replace('@', '')}` : null, Glyph: IG },
    { label: 'Facebook', value: business.facebook, url: business.facebook ? `https://facebook.com/${business.facebook}` : null, Glyph: FB },
    { label: 'TikTok', value: business.tiktok, url: business.tiktok ? `https://tiktok.com/@${business.tiktok}` : null, Glyph: TT },
  ].filter((s) => s.value) as { label: string; value: string; url: string; Glyph: (p: { className?: string }) => JSX.Element }[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-paroki-500">
        <a href="/" className="transition hover:text-paroki-700">Beranda</a>
        <span>/</span>
        <a href="/direktori" className="transition hover:text-paroki-700">Direktori</a>
        <span>/</span>
        <span className="font-medium text-paroki-700">{business.name}</span>
      </nav>

      {/* Hero Image */}
      {allImages.length > 0 ? (
        <div className="mb-6 overflow-hidden rounded-xl bg-paroki-100 shadow-soft">
          <img
            src={allImages[activeImage]}
            alt={business.name}
            className="aspect-[16/9] w-full object-cover"
          />
        </div>
      ) : (
        <div className="mb-6 flex aspect-[16/9] items-center justify-center rounded-xl bg-paroki-100 text-paroki-300">
          <IconStore className="h-20 w-20" />
        </div>
      )}

      {/* Image thumbnails */}
      {allImages.length > 1 && (
        <div className="mb-6 flex gap-2 overflow-x-auto">
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveImage(i)}
              className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${
                activeImage === i ? 'border-paroki-600' : 'border-transparent hover:border-paroki-300'
              }`}
            >
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            {business.category && (
              <a
                href={`/kategori/${business.category.slug}`}
                className="inline-flex items-center rounded-full bg-paroki-100 px-3 py-1 text-xs font-semibold text-paroki-700 transition hover:bg-paroki-200"
              >
                {business.category.name}
              </a>
            )}
            {business.area && (
              <span className="inline-flex items-center gap-1 rounded-full bg-paroki-50 px-3 py-1 text-xs font-medium text-paroki-600 ring-1 ring-paroki-200">
                <IconPin className="h-3.5 w-3.5" />
                {business.area}
              </span>
            )}
            {business.is_featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-400/20 px-3 py-1 text-xs font-semibold text-accent-600">
                <IconStar className="h-3.5 w-3.5" />
                Pilihan
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-paroki-900 break-words">{business.name}</h1>
        </div>

        {/* WhatsApp CTA */}
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-paroki-600 px-5 py-3 font-semibold text-white transition hover:bg-paroki-700 active:translate-y-px"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.5 14.4c-.3-.1-1.8-.9-2-.9-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4-.1-.5-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.2-.2-.5-.3M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2" />
            </svg>
            Hubungi via WhatsApp
          </a>
        )}
      </div>

      {/* Description */}
      {business.description && (
        <div className="mb-6">
          <h2 className="mb-2 font-display text-lg font-bold text-paroki-900">Tentang Usaha</h2>
          <p className="max-w-[65ch] whitespace-pre-wrap leading-relaxed text-paroki-700">{business.description}</p>
        </div>
      )}

      {/* Contact Info */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Contact card */}
        <div className="rounded-lg border border-paroki-200 bg-white p-5">
          <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-paroki-900">
            <IconPhone className="h-4.5 w-4.5 text-paroki-500" />
            Kontak
          </h3>
          <div className="space-y-2 text-sm">
            {business.phone && (
              <div className="flex items-center gap-2 text-paroki-700">
                <span className="w-16 shrink-0 text-paroki-500">Telepon</span>
                <a href={`tel:${business.phone}`} className="font-medium hover:text-paroki-900 hover:underline">
                  {business.phone}
                </a>
              </div>
            )}
            {business.email && (
              <div className="flex items-center gap-2 text-paroki-700">
                <span className="w-16 shrink-0 text-paroki-500">Email</span>
                <a href={`mailto:${business.email}`} className="font-medium hover:text-paroki-900 hover:underline">
                  {business.email}
                </a>
              </div>
            )}
            {business.address && (
              <div className="flex items-start gap-2 text-paroki-700">
                <span className="w-16 shrink-0 text-paroki-500">Alamat</span>
                <span className="leading-relaxed">{business.address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Hours / Socials */}
        <div className="rounded-lg border border-paroki-200 bg-white p-5">
          {Object.keys(business.operating_hours || {}).length > 0 && (
            <>
              <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-paroki-900">
                <IconClock className="h-4.5 w-4.5 text-paroki-500" />
                Jam Operasional
              </h3>
              <div className="mb-4 space-y-1.5 text-sm">
                {Object.entries(business.operating_hours).map(([day, hours]) => (
                  <div key={day} className="flex justify-between border-b border-paroki-100 pb-1.5 last:border-0">
                    <span className="capitalize text-paroki-500">{day}</span>
                    <span className="font-medium text-paroki-800">{hours}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {socials.length > 0 && (
            <>
              <h3 className="mb-2 font-display font-bold text-paroki-900">Media Sosial</h3>
              <div className="flex flex-wrap gap-2">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-paroki-50 px-3 py-1.5 text-sm font-medium text-paroki-700 transition hover:bg-paroki-100"
                  >
                    <s.Glyph />
                    {s.label}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Products Section */}
      {products.length > 0 && (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-paroki-900">
              <IconPackage className="h-5 w-5 text-paroki-500" />
              Produk Kami
            </h2>
            {(() => {
              const waAll = business.whatsapp
                ? `https://wa.me/${business.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Halo ${business.name}, saya melihat produk-produk di profil Anda. Boleh info lebih lanjut?`,
                  )}`
                : null;
              if (!waAll) return null;
              return (
                <a
                  href={waAll}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-paroki-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-paroki-700 active:translate-y-px"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-.9-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4-.1-.5-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.2-.2-.5-.3M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2"/></svg>
                  Tanya Produk
                </a>
              );
            })()}
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => {
              const pwa = business.whatsapp
                ? `https://wa.me/${business.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Halo, saya tertarik dengan *${p.name}* dari *${business.name}* yang saya lihat di Direktori UMKM St. Servatius. Apakah masih tersedia?`,
                  )}`
                : null;
              const priceStr = p.price
                ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(p.price)
                : p.price_note || 'Hubungi untuk harga';
              return (
                <div key={p.id} className="group flex flex-col overflow-hidden rounded-lg border border-paroki-200 bg-white transition hover:border-paroki-300 hover:shadow-soft">
                  <a href={`/produk/${p.slug}`} className="block">
                    <div className="relative aspect-square overflow-hidden bg-paroki-100">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-paroki-300"><IconPackage className="h-10 w-10" /></div>
                      )}
                    </div>
                  </a>
                  <div className="flex flex-1 flex-col p-3">
                    <a href={`/produk/${p.slug}`}>
                      <h3 className="font-display text-sm font-bold leading-snug text-paroki-900 break-words hover:text-paroki-700">{p.name}</h3>
                    </a>
                    {p.description && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-paroki-600">{p.description}</p>}
                    <div className="mt-1 text-sm font-bold text-paroki-700">{priceStr}</div>
                    <div className="mt-auto pt-2">
                      {pwa && (
                        <a href={pwa} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 rounded-md bg-paroki-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-paroki-700">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-.9-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4-.1-.5-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.2-.2-.5-.3M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2"/></svg>
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="mt-10 rounded-xl border border-paroki-200 bg-paroki-50 p-6 md:p-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="font-medium text-paroki-800">Punya usaha juga? Daftarkan di Direktori UMKM St. Servatius.</p>
          <a
            href="/daftar"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-paroki-600 px-5 py-2.5 font-semibold text-white transition hover:bg-paroki-700 active:translate-y-px"
          >
            Daftarkan Usaha Saya
            <IconArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
