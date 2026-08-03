import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, type Business, type Product, type Review } from '../../lib/supabase';
import { Search, MapPin, Star, Phone, Clock, Store, Package, ArrowLeft, ArrowRight, MessageCircle } from 'lucide-react';
import FavoriteButton from './FavoriteButton';
import ViewCounter from './ViewCounter';
import PageViewTracker from './PageViewTracker';

interface Props { slug: string; }

const demoBusinesses: Record<string, Business> = {
  'katering-bu-maria': {
    id: 'demo1', owner_id: '', name: 'Katering Bu Maria', slug: 'katering-bu-maria',
    description: 'Katering rumahan dengan menu harian berganti. Masakan Indonesia autentik.', category_id: '',
    whatsapp: '628123456789', phone: '08123456789', email: '', address: 'Jl. Melati No. 12', area: 'Wilayah 1',
    instagram: '@kateringbumaria', facebook: '', tiktok: '', operating_hours: { weekdays: '08:00 - 17:00', weekend: '07:00 - 14:00' },
    logo_url: '', status: 'approved', is_featured: true, rejection_note: '',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    view_count: 42,
    category: { id: '1', name: 'Kuliner & Minuman', slug: 'kuliner-minuman', icon: '', sort_order: 1 }, images: [],
  },
};

const TikTokIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M14 3h2.6c.3 1.7 1.3 3.2 3.4 3.5v2.6c-1.3 0-2.5-.3-3.5-1v6.2a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.7a2.9 2.9 0 1 0 2 2.8V3H14Z" />
  </svg>
);
const InstagramIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17" cy="7" r="0.6" fill="currentColor" />
  </svg>
);
const FacebookIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13.5 21v-7h2.3l.4-2.8h-2.7V9.4c0-.8.3-1.3 1.4-1.3h1.4V5.6c-.7-.1-1.4-.1-2.1-.1-2.1 0-3.5 1.2-3.5 3.6v2.1H8.3V14h2.3v7h2.9Z" />
  </svg>
);

export default function BusinessDetail({ slug }: Props) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ratingSummary, setRatingSummary] = useState<{ avg_rating: number; review_count: number } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured && demoBusinesses[slug]) { setBusiness(demoBusinesses[slug]); setLoading(false); return; }
      const { data, error } = await supabase.from('businesses').select(`*, category:categories(*), images:business_images(*)`).eq('slug', slug).eq('status', 'approved').single();
      if (!error && data) {
        setBusiness(data);
        const { data: prods } = await supabase.from('products').select('*').eq('business_id', data.id).eq('is_available', true).order('sort_order', { ascending: true }).order('created_at', { ascending: false });
        setProducts(prods || []);
      }
      setLoading(false);
    })();
  }, [slug]);

  // Fetch reviews & rating summary when business loads
  useEffect(() => {
    if (!business || !isSupabaseConfigured) return;
    (async () => {
      const { data: rating } = await supabase.rpc('get_business_rating', { p_business_id: business.id });
      setRatingSummary(rating as { avg_rating: number; review_count: number } | null);
      await fetchReviews(business.id);
    })();
  }, [business]);

  // Check auth status once
  useEffect(() => {
    if (!isSupabaseConfigured) { setAuthChecked(true); return; }
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUserId(session.user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('verification_status')
          .eq('id', session.user.id)
          .single();
        setIsVerified(profile?.verification_status === 'verified');
      }
      setAuthChecked(true);
    })();
  }, []);

  async function fetchReviews(businessId: string) {
    const { data: revs } = await supabase
      .from('reviews')
      .select('*, reviewer:profiles(id, full_name, verification_status)')
      .eq('business_id', businessId)
      .eq('is_visible', true)
      .order('created_at', { ascending: false });
    setReviews((revs as Review[]) || []);
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !currentUserId || formRating === 0 || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from('reviews').insert({
      business_id: business.id,
      reviewer_id: currentUserId,
      rating: formRating,
      title: formTitle,
      content: formContent,
    });
    setSubmitting(false);
    if (!error) {
      setFormRating(0);
      setFormTitle('');
      setFormContent('');
      const { data: rating } = await supabase.rpc('get_business_rating', { p_business_id: business.id });
      setRatingSummary(rating as { avg_rating: number; review_count: number } | null);
      await fetchReviews(business.id);
    }
  };

  const renderStars = (rating: number, size = 'h-4 w-4') => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${size} ${i <= Math.round(rating) ? 'text-gold-500' : 'text-gray-300'}`}
          fill={i <= Math.round(rating) ? 'currentColor' : 'none'}
        />
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="aspect-[16/9] rounded-lg bg-gray-100"></div>
          <div className="h-8 w-2/3 rounded bg-gray-100"></div>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-gray-50 text-gray-400"><Search className="h-7 w-7" /></div>
        <h1 className="font-display text-2xl font-bold text-ink">Usaha Tidak Ditemukan</h1>
        <p className="mt-2 text-gray-500">Usaha yang Anda cari mungkin belum terdaftar atau sudah dihapus.</p>
        <a href="/direktori" className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-5 py-2.5 font-bold text-white transition hover:bg-gold-600 active:translate-y-px">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Direktori
        </a>
      </div>
    );
  }

  const waLink = business.whatsapp ? `https://wa.me/${business.whatsapp.replace(/[^0-9]/g, '')}?text=Halo, saya tertarik dengan ${encodeURIComponent(business.name)} yang saya lihat di Direktori UMKM St. Servatius.` : null;
  const allImages = [business.logo_url, ...(business.images || []).map((img) => img.image_url)].filter(Boolean);
  const socials = [
    { label: 'Instagram', value: business.instagram, url: business.instagram ? `https://instagram.com/${business.instagram.replace('@', '')}` : null, Icon: InstagramIcon },
    { label: 'Facebook', value: business.facebook, url: business.facebook ? `https://facebook.com/${business.facebook}` : null, Icon: FacebookIcon },
    { label: 'TikTok', value: business.tiktok, url: business.tiktok ? `https://tiktok.com/@${business.tiktok}` : null, Icon: TikTokIcon },
  ].filter((s) => s.value) as { label: string; value: string; url: string; Icon: React.FC<{ className?: string }> }[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageViewTracker type="business" slug={slug} />
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-gray-400">
        <a href="/" className="transition hover:text-paroki-700">Beranda</a><span>/</span>
        <a href="/direktori" className="transition hover:text-paroki-700">Direktori</a><span>/</span>
        <span className="font-medium text-gray-700">{business.name}</span>
      </nav>

      {allImages.length > 0 ? (
        <div className="mb-6 overflow-hidden rounded-xl bg-gray-100 shadow-soft">
          <img src={allImages[activeImage]} alt={business.name} className="aspect-[16/9] w-full object-cover" />
        </div>
      ) : (
        <div className="mb-6 flex aspect-[16/9] items-center justify-center rounded-xl bg-gray-50 text-gray-300"><Store className="h-20 w-20" /></div>
      )}

      {allImages.length > 1 && (
        <div className="mb-6 flex gap-2 overflow-x-auto">
          {allImages.map((img, i) => (
            <button key={i} onClick={() => setActiveImage(i)} className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${activeImage === i ? 'border-gold-500' : 'border-transparent hover:border-gray-300'}`}>
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            {business.category && <a href={`/kategori/${business.category.slug}`} className="inline-flex items-center rounded-full bg-paroki-50 px-3 py-1 text-xs font-semibold text-paroki-800 transition hover:bg-paroki-100">{business.category.name}</a>}
            {business.area && <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200"><MapPin className="h-3.5 w-3.5" />{business.area}</span>}
            {business.is_featured && <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-3 py-1 text-xs font-bold text-gold-700"><Star className="h-3.5 w-3.5" />Pilihan</span>}
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink break-words">{business.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <ViewCounter count={business.view_count || 0} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FavoriteButton targetType="business" targetId={business.id} variant="button" />
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-5 py-3 font-bold text-white transition hover:bg-gold-600 active:translate-y-px">
              <MessageCircle className="h-5 w-5" />Hubungi via WhatsApp
            </a>
          )}
        </div>
      </div>

      {business.description && (
        <div className="mb-6">
          <h2 className="mb-2 font-display text-lg font-bold text-ink">Tentang Usaha</h2>
          <p className="max-w-[65ch] whitespace-pre-wrap leading-relaxed text-gray-600">{business.description}</p>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-ink"><Phone className="h-4 w-4 text-gray-400" />Kontak</h3>
          <div className="space-y-2 text-sm">
            {business.phone && <div className="flex items-center gap-2 text-gray-600"><span className="w-16 shrink-0 text-gray-400">Telepon</span><a href={`tel:${business.phone}`} className="font-medium text-ink hover:text-paroki-700 hover:underline">{business.phone}</a></div>}
            {business.email && <div className="flex items-center gap-2 text-gray-600"><span className="w-16 shrink-0 text-gray-400">Email</span><a href={`mailto:${business.email}`} className="font-medium text-ink hover:text-paroki-700 hover:underline">{business.email}</a></div>}
            {business.address && <div className="flex items-start gap-2 text-gray-600"><span className="w-16 shrink-0 text-gray-400">Alamat</span><span className="leading-relaxed">{business.address}</span></div>}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          {Object.keys(business.operating_hours || {}).length > 0 && (
            <>
              <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-ink"><Clock className="h-4 w-4 text-gray-400" />Jam Operasional</h3>
              <div className="mb-4 space-y-1.5 text-sm">
                {Object.entries(business.operating_hours).map(([day, hours]) => (
                  <div key={day} className="flex justify-between border-b border-gray-100 pb-1.5 last:border-0">
                    <span className="capitalize text-gray-400">{day}</span><span className="font-medium text-gray-700">{hours}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {socials.length > 0 && (
            <>
              <h3 className="mb-2 font-display font-bold text-ink">Media Sosial</h3>
              <div className="flex flex-wrap gap-2">
                {socials.map((s) => (
                  <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100">
                    <s.Icon className="h-4 w-4" />{s.label}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {products.length > 0 && (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Package className="h-5 w-5 text-gray-400" />Produk Kami</h2>
            {(() => {
              const waAll = business.whatsapp ? `https://wa.me/${business.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Halo ${business.name}, saya melihat produk-produk di profil Anda. Boleh info lebih lanjut?`)}` : null;
              if (!waAll) return null;
              return <a href={waAll} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-gold-600 active:translate-y-px"><MessageCircle className="h-4 w-4" />Tanya Produk</a>;
            })()}
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => {
              const pwa = business.whatsapp ? `https://wa.me/${business.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Halo, saya tertarik dengan *${p.name}* dari *${business.name}* yang saya lihat di Direktori UMKM St. Servatius. Apakah masih tersedia?`)}` : null;
              const priceStr = p.price ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(p.price) : p.price_note || 'Hubungi untuk harga';
              return (
                <div key={p.id} className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:border-gold-400 hover:shadow-soft">
                  <a href={`/produk/${p.slug}`} className="block">
                    <div className="relative aspect-square overflow-hidden bg-gray-100">
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center text-gray-300"><Package className="h-10 w-10" /></div>}
                    </div>
                  </a>
                  <div className="flex flex-1 flex-col p-3">
                    <a href={`/produk/${p.slug}`}><h3 className="font-display text-sm font-bold leading-snug text-ink break-words hover:text-paroki-700">{p.name}</h3></a>
                    {p.description && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500">{p.description}</p>}
                    <div className="mt-1 text-sm font-bold text-paroki-700">{priceStr}</div>
                    <div className="mt-auto pt-2">
                      {pwa && <a href={pwa} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 rounded-md bg-gold-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-gold-600"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reviews Section */}
      <div className="mt-8">
        <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold text-ink">
          <Star className="h-5 w-5 text-gray-400" />Ulasan Pelanggan
        </h2>

        {/* Rating Summary */}
        {ratingSummary && ratingSummary.review_count > 0 ? (
          <div className="mb-6 flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-5">
            <div className="text-center">
              <div className="font-display text-3xl font-extrabold text-ink">{ratingSummary.avg_rating.toFixed(1)}</div>
              <div className="mt-1">{renderStars(ratingSummary.avg_rating, 'h-4 w-4')}</div>
            </div>
            <div className="text-sm text-gray-500">Berdasarkan {ratingSummary.review_count} ulasan</div>
          </div>
        ) : (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-500">Belum ada ulasan untuk usaha ini.</div>
        )}

        {/* Review Form / Auth Prompt */}
        {authChecked && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
            {currentUserId && isVerified ? (
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <h3 className="font-display font-bold text-ink">Tulis Ulasan</h3>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Rating</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <button key={i} type="button" onClick={() => setFormRating(i)} className="transition hover:scale-110">
                        <Star className={`h-7 w-7 ${i <= formRating ? 'text-gold-500' : 'text-gray-300'}`} fill={i <= formRating ? 'currentColor' : 'none'} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Judul</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    required
                    maxLength={100}
                    placeholder="Ringkasan ulasan Anda"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Ulasan</label>
                  <textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    required
                    rows={4}
                    maxLength={1000}
                    placeholder="Bagikan pengalaman Anda..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || formRating === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-5 py-2.5 font-bold text-white transition hover:bg-gold-600 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Mengirim...' : 'Kirim Ulasan'}
                </button>
              </form>
            ) : !currentUserId ? (
              <p className="text-sm text-gray-500">
                <a href="/masuk" className="font-semibold text-paroki-700 hover:underline">Masuk untuk memberi ulasan</a>
              </p>
            ) : (
              <p className="text-sm text-gray-500">Akun Anda belum terverifikasi untuk memberi ulasan.</p>
            )}
          </div>
        )}

        {/* Review List */}
        {reviews.length > 0 && (
          <div className="space-y-4">
            {reviews.map((rev) => (
              <div key={rev.id} className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-ink">{rev.reviewer?.full_name || 'Anonim'}</span>
                      {rev.reviewer?.verification_status === 'verified' && (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-green-200">Terverifikasi</span>
                      )}
                    </div>
                    <div className="mt-1">{renderStars(rev.rating, 'h-3.5 w-3.5')}</div>
                  </div>
                  <time className="shrink-0 text-xs text-gray-400">{new Date(rev.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</time>
                </div>
                {rev.title && <h4 className="mb-1 font-display font-bold text-ink">{rev.title}</h4>}
                {rev.content && <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{rev.content}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 rounded-xl bg-paroki-50 p-6 md:p-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="font-medium text-paroki-900">Punya usaha juga? Daftarkan di Direktori UMKM St. Servatius.</p>
          <a href="/daftar" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gold-500 px-5 py-2.5 font-bold text-white transition hover:bg-gold-600 active:translate-y-px">Daftarkan Usaha Saya<ArrowRight className="h-4 w-4" /></a>
        </div>
      </div>
    </div>
  );
}
