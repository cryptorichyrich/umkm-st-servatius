import { useState, useEffect } from 'react';
import { supabase, type Business } from '../../lib/supabase';

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

export default function BusinessDetail({ slug }: Props) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    (async () => {
      // Check demo data first
      if (demoBusinesses[slug]) {
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
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="aspect-[16/9] rounded-2xl bg-paroki-100"></div>
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
        <div className="mb-4 text-6xl">🔍</div>
        <h2 className="font-serif text-2xl font-bold text-paroki-900">Usaha Tidak Ditemukan</h2>
        <p className="mt-2 text-paroki-600">
          Usaha yang Anda cari mungkin belum terdaftar atau sudah dihapus.
        </p>
        <a
          href="/direktori"
          className="mt-6 inline-block rounded-lg bg-paroki-600 px-6 py-2.5 font-semibold text-white hover:bg-paroki-700"
        >
          ← Kembali ke Direktori
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
    { label: 'Instagram', value: business.instagram, url: business.instagram ? `https://instagram.com/${business.instagram.replace('@', '')}` : null, icon: '📷' },
    { label: 'Facebook', value: business.facebook, url: business.facebook ? `https://facebook.com/${business.facebook}` : null, icon: '👤' },
    { label: 'TikTok', value: business.tiktok, url: business.tiktok ? `https://tiktok.com/@${business.tiktok}` : null, icon: '🎵' },
  ].filter((s) => s.value);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-paroki-500">
        <a href="/" className="hover:text-paroki-700">Home</a>
        <span className="mx-2">/</span>
        <a href="/direktori" className="hover:text-paroki-700">Direktori</a>
        <span className="mx-2">/</span>
        <span className="text-paroki-700">{business.name}</span>
      </nav>

      {/* Hero Image */}
      {allImages.length > 0 ? (
        <div className="mb-6 overflow-hidden rounded-2xl bg-paroki-100">
          <img
            src={allImages[activeImage]}
            alt={business.name}
            className="aspect-[16/9] w-full object-cover"
          />
        </div>
      ) : (
        <div className="mb-6 flex aspect-[16/9] items-center justify-center rounded-2xl bg-paroki-100 text-7xl">
          {business.category?.icon || '📦'}
        </div>
      )}

      {/* Image thumbnails */}
      {allImages.length > 1 && (
        <div className="mb-6 flex gap-2 overflow-x-auto">
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveImage(i)}
              className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 ${
                activeImage === i ? 'border-paroki-600' : 'border-transparent'
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
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {business.category && (
              <a
                href={`/kategori/${business.category.slug}`}
                className="inline-flex items-center gap-1 rounded-full bg-paroki-100 px-3 py-1 text-sm font-medium text-paroki-700"
              >
                {business.category.icon} {business.category.name}
              </a>
            )}
            {business.area && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
                📍 {business.area}
              </span>
            )}
            {business.is_featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
                ⭐ Pilihan
              </span>
            )}
          </div>
          <h1 className="font-serif text-3xl font-bold text-paroki-900 break-words">{business.name}</h1>
        </div>

        {/* WhatsApp CTA */}
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-semibold text-white shadow-md transition hover:bg-green-700"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.967-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Hubungi via WhatsApp
          </a>
        )}
      </div>

      {/* Description */}
      {business.description && (
        <div className="mb-6">
          <h2 className="mb-2 font-serif text-lg font-semibold text-paroki-900">Tentang Usaha</h2>
          <p className="whitespace-pre-wrap leading-relaxed text-paroki-700">{business.description}</p>
        </div>
      )}

      {/* Contact Info */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Contact card */}
        <div className="rounded-2xl border border-paroki-200 bg-white p-5">
          <h3 className="mb-3 font-semibold text-paroki-900">📞 Kontak</h3>
          <div className="space-y-2 text-sm">
            {business.phone && (
              <div className="flex items-center gap-2 text-paroki-700">
                <span className="text-paroki-400">Telepon:</span>
                <a href={`tel:${business.phone}`} className="font-medium hover:underline">
                  {business.phone}
                </a>
              </div>
            )}
            {business.email && (
              <div className="flex items-center gap-2 text-paroki-700">
                <span className="text-paroki-400">Email:</span>
                <a href={`mailto:${business.email}`} className="font-medium hover:underline">
                  {business.email}
                </a>
              </div>
            )}
            {business.address && (
              <div className="flex items-start gap-2 text-paroki-700">
                <span className="text-paroki-400">Alamat:</span>
                <span>{business.address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Hours / Socials */}
        <div className="rounded-2xl border border-paroki-200 bg-white p-5">
          {Object.keys(business.operating_hours || {}).length > 0 && (
            <>
              <h3 className="mb-3 font-semibold text-paroki-900">🕐 Jam Operasional</h3>
              <div className="mb-3 space-y-1 text-sm text-paroki-700">
                {Object.entries(business.operating_hours).map(([day, hours]) => (
                  <div key={day} className="flex justify-between">
                    <span className="capitalize text-paroki-500">{day}</span>
                    <span>{hours}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {socials.length > 0 && (
            <>
              <h3 className="mb-2 font-semibold text-paroki-900">🌐 Social Media</h3>
              <div className="flex flex-wrap gap-2">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-paroki-50 px-3 py-1.5 text-sm text-paroki-700 hover:bg-paroki-100"
                  >
                    {s.icon} {s.label}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8 rounded-2xl bg-paroki-50 p-6 text-center">
        <p className="text-paroki-700">Punya usaha juga? Daftarkan di Direktori UMKM St. Servatius!</p>
        <a
          href="/daftar"
          className="mt-3 inline-block rounded-lg bg-paroki-600 px-6 py-2.5 font-semibold text-white hover:bg-paroki-700"
        >
          Daftarkan Usaha Saya →
        </a>
      </div>
    </div>
  );
}
