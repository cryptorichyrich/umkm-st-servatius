import { useState, useEffect, useCallback } from 'react';
import { supabase, type Business, type Profile, type BusinessStatus, type Product, type Favorite } from '../../lib/supabase';
import { Eye, EyeOff, Store } from 'lucide-react';
import FavoriteButton from './FavoriteButton';
import BazarSchedule from './BazarSchedule';
import BlogEditor from './BlogEditor';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface BusinessRow extends Business {
  category?: { id: string; name: string; slug: string; icon: string; sort_order: number };
}

interface FavoriteBusinessRow extends Favorite {
  business?: Business;
}

interface FavoriteProductRow extends Favorite {
  product?: Product & { business?: { id: string; name: string; slug: string } };
}

type TabKey = 'usaha' | 'verifikasi' | 'favorit' | 'pengaturan' | 'bazar' | 'artikel';

// ─────────────────────────────────────────────
// Status badge helper (preserved from original)
// ─────────────────────────────────────────────
function StatusBadge({ status }: { status: BusinessStatus }) {
  const styles: Record<BusinessStatus, string> = {
    draft: 'bg-gray-100 text-gray-700',
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };
  const labels: Record<BusinessStatus, string> = {
    draft: 'Draft',
    pending: 'Menunggu Review',
    approved: 'Disetujui',
    rejected: 'Ditolak',
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

// ─────────────────────────────────────────────
// Verification badge helper (for header)
// ─────────────────────────────────────────────
function VerificationBadge({ type, status, role }: { type: string; status: string; role?: string }) {
  // Admin always shows as admin badge
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-semibold text-gold-800 ring-1 ring-gold-300">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z"/></svg>
        Admin
      </span>
    );
  }
  if (status === 'verified' && type === 'umkm') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-300">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z"/></svg>
        UMKM
      </span>
    );
  }
  if (status === 'verified' && type === 'member') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 ring-1 ring-green-300">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
        Member
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800 ring-1 ring-yellow-300">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        Verifikasi Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500 ring-1 ring-gray-300">
      Belum terverifikasi
    </span>
  );
}

// ─────────────────────────────────────────────
// Tab link (URL-based navigation)
// ─────────────────────────────────────────────
function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
        active
          ? 'border-paroki-600 text-paroki-700'
          : 'border-transparent text-paroki-500 hover:text-paroki-700'
      }`}
    >
      {children}
    </a>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
interface DashboardAppProps {
  initialTab?: 'usaha' | 'verifikasi' | 'favorit' | 'pengaturan' | 'bazar' | 'artikel';
}

export default function DashboardApp({ initialTab = 'usaha' }: DashboardAppProps) {
  const activeTab: TabKey = initialTab;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [favorites, setFavorites] = useState<{ businesses: FavoriteBusinessRow[]; products: FavoriteProductRow[] }>({ businesses: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Favorites tab state
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  // ── Settings / Change Password state ──
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError('Kata sandi minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Kata sandi tidak cocok.');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Gagal mengubah kata sandi.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // Initial load: session + profile + businesses
  // ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = '/masuk';
        return;
      }

      const userId = session.user.id;
      setUserEmail(session.user.email || null);

      // Fetch profile
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileErr) {
        console.error('Profile fetch error:', profileErr);
      } else {
        setProfile(profileData as Profile);
      }

      // Fetch businesses with category join
      const { data: bizData, error: bizErr } = await supabase
        .from('businesses')
        .select(
          `
          *,
          category:categories(*)
        `,
        )
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (bizErr) {
        console.error('Businesses fetch error:', bizErr);
        setError('Gagal memuat data usaha. Silakan coba lagi.');
      } else {
        setBusinesses((bizData || []) as BusinessRow[]);
      }

      setLoading(false);
    })();
  }, []);

  // ─────────────────────────────────────────────
  // Fetch favorites
  // ─────────────────────────────────────────────
  const fetchFavorites = useCallback(async () => {
    setFavoritesLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch business favorites with business details
      const { data: bizFavs, error: bizFavErr } = await supabase
        .from('favorites')
        .select(
          `
          *,
          business:businesses(*)
        `,
        )
        .eq('user_id', session.user.id)
        .not('business_id', 'is', null)
        .order('created_at', { ascending: false });

      if (bizFavErr) throw bizFavErr;

      // Fetch product favorites with product + business details
      const { data: prodFavs, error: prodFavErr } = await supabase
        .from('favorites')
        .select(
          `
          *,
          product:products(
            *,
            business:businesses(id, name, slug)
          )
        `,
        )
        .eq('user_id', session.user.id)
        .not('product_id', 'is', null)
        .order('created_at', { ascending: false });

      if (prodFavErr) throw prodFavErr;

      setFavorites({
        businesses: (bizFavs || []) as FavoriteBusinessRow[],
        products: (prodFavs || []) as FavoriteProductRow[],
      });
    } catch (err) {
      console.error('Favorites fetch error:', err);
    } finally {
      setFavoritesLoading(false);
    }
  }, []);

  // ─────────────────────────────────────────────
  // Lazy-load tab data based on initialTab prop
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'favorit') {
      fetchFavorites();
    }
  }, [activeTab, fetchFavorites]);

  // ─────────────────────────────────────────────
  // Business handlers (preserved from original)
  // ─────────────────────────────────────────────
  const handleSubmitForReview = useCallback(async (businessId: string) => {
    setSubmittingId(businessId);
    try {
      const { error: rpcErr } = await supabase.rpc('submit_for_review', {
        p_business_id: businessId,
      });
      if (rpcErr) throw rpcErr;

      // Update local state
      setBusinesses((prev) =>
        prev.map((b) => (b.id === businessId ? { ...b, status: 'pending' } : b)),
      );
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal mengirim untuk review: ${err.message}`
          : 'Gagal mengirim untuk review.',
      );
    } finally {
      setSubmittingId(null);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  // ─────────────────────────────────────────────
  // Favorite removal
  // ─────────────────────────────────────────────
  const handleRemoveFavorite = useCallback(
    async (favId: string, type: 'business' | 'product') => {
      try {
        const { error: delErr } = await supabase
          .from('favorites')
          .delete()
          .eq('id', favId);

        if (delErr) throw delErr;

        if (type === 'business') {
          setFavorites((prev) => ({
            ...prev,
            businesses: prev.businesses.filter((f) => f.id !== favId),
          }));
        } else {
          setFavorites((prev) => ({
            ...prev,
            products: prev.products.filter((f) => f.id !== favId),
          }));
        }
      } catch (err) {
        alert(
          err instanceof Error
            ? `Gagal menghapus favorit: ${err.message}`
            : 'Gagal menghapus favorit.',
        );
      }
    },
    [],
  );

  // Derived values
  // Admin bypasses verification — always can add businesses
  const isAdmin = profile?.role === 'admin';
  const isVerifiedStatus = profile?.verification_status === 'verified';
  const canAddBusiness =
    isAdmin ||
    (isVerifiedStatus &&
     (profile?.verification_type === 'member' || profile?.verification_type === 'umkm'));

  // ─────────────────────────────────────────────
  // Loading state
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-paroki-100" />
          <div className="h-24 rounded-xl bg-paroki-100" />
          <div className="h-24 rounded-xl bg-paroki-100" />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-paroki-900">Dashboard</h1>
          <p className="mt-1 text-sm text-paroki-600">
            {profile?.full_name
              ? `Selamat datang, ${profile.full_name}!`
              : 'Kelola usaha Anda di sini.'}
          </p>
          {profile && (
            <div className="mt-2">
              <VerificationBadge
                type={profile.verification_type}
                status={profile.verification_status}
                role={profile.role}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {profile?.role === 'admin' && (
            <a
              href="/admin"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-paroki-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-paroki-800"
            >
              ⚙️ Admin
            </a>
          )}
          {canAddBusiness ? (
            <a
              href="/dashboard/baru"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-paroki-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-paroki-700"
            >
              <span>+</span> Tambah Usaha Baru
            </a>
          ) : (
            <a
              href="/dashboard/verifikasi"
              title="Anda harus verifikasi member terlebih dahulu untuk menambah usaha"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100"
            >
              ⚠ Verifikasi Diperlukan
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Tab Bar ── */}
      <div className="mb-6 overflow-x-auto border-b border-paroki-200">
        <div className="flex">
          <TabLink href="/dashboard" active={activeTab === 'usaha'}>
            Usaha Saya
          </TabLink>
          <TabLink href="/dashboard/verifikasi" active={activeTab === 'verifikasi'}>
            Verifikasi Member
          </TabLink>
          <TabLink href="/dashboard/favorit" active={activeTab === 'favorit'}>
            Favorit Saya
          </TabLink>
          <TabLink href="/dashboard/pengaturan" active={activeTab === 'pengaturan'}>
            Pengaturan
          </TabLink>
          {businesses.length > 0 && (
            <TabLink href="/dashboard/bazar" active={activeTab === 'bazar'}>
              🎪 Bazar
            </TabLink>
          )}
          {businesses.length > 0 && (
            <TabLink href="/dashboard/artikel" active={activeTab === 'artikel'}>
              ✍️ Tulis Artikel
            </TabLink>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          TAB 1: USAHA SAYA (Business Management — preserved)
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'usaha' && (
        <>
          {businesses.length === 0 ? (
            <div className="rounded-lg border border-dashed border-paroki-300 bg-white py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-paroki-50 text-paroki-400">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5 5.5 5h13L20 9.5M4 9.5h16M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5M9.5 20v-4.5h5V20"/></svg>
              </div>
              <p className="font-medium text-paroki-700">Belum ada usaha terdaftar</p>
              <p className="mt-1 text-sm text-paroki-400">
                Klik "Tambah Usaha Baru" untuk mulai mendaftarkan usaha Anda.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-2xl border border-paroki-200 bg-white shadow-sm md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-paroki-200 bg-paroki-50 text-paroki-700">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Nama Usaha</th>
                      <th className="px-4 py-3 font-semibold">Kategori</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Dibuat</th>
                      <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paroki-100">
                    {businesses.map((b) => (
                      <tr key={b.id} className="hover:bg-paroki-50/50">
                        <td className="px-4 py-3">
                          <a href={`/umkm/${b.slug}`} target="_blank" rel="noopener noreferrer" className="font-medium text-paroki-900 transition hover:text-gold-600 hover:underline">
                            {b.name}
                          </a>
                          {b.status === 'rejected' && b.rejection_note && (
                            <div className="mt-1 max-w-xs text-xs text-red-600">
                              Catatan: {b.rejection_note}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-paroki-600">
                          {b.category ? `${b.category.icon} ${b.category.name}` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={b.status} />
                        </td>
                        <td className="px-4 py-3 text-paroki-500">
                          {formatDate(b.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            {b.status === 'approved' && (
                              <a
                                href={`/umkm/${b.slug}`}
                                className="rounded-md border border-paroki-200 px-3 py-1.5 text-xs font-medium text-paroki-700 hover:bg-paroki-50"
                              >
                                Lihat
                              </a>
                            )}
                            <a
                              href={`/dashboard/edit?id=${b.id}`}
                              className="rounded-md border border-paroki-200 px-3 py-1.5 text-xs font-medium text-paroki-700 hover:bg-paroki-50"
                            >
                              Edit
                            </a>
                            {b.status === 'draft' && (
                              <button
                                onClick={() => handleSubmitForReview(b.id)}
                                disabled={submittingId === b.id}
                                className="rounded-md bg-paroki-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {submittingId === b.id ? 'Mengirim...' : 'Kirim untuk Review'}
                              </button>
                            )}
                            {b.status === 'rejected' && (
                              <button
                                onClick={() => handleSubmitForReview(b.id)}
                                disabled={submittingId === b.id}
                                className="rounded-md bg-paroki-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {submittingId === b.id ? 'Mengirim...' : 'Kirim Ulang'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {businesses.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-paroki-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-medium">
                          <a href={`/umkm/${b.slug}`} target="_blank" rel="noopener noreferrer" className="text-paroki-900 transition hover:text-gold-600 hover:underline">
                            {b.name}
                          </a>
                        </h3>
                        <p className="mt-0.5 text-xs text-paroki-500">
                          {b.category ? `${b.category.icon} ${b.category.name}` : 'Tanpa kategori'}
                          {' · '}
                          {formatDate(b.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>

                    {b.status === 'rejected' && b.rejection_note && (
                      <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                        Catatan penolakan: {b.rejection_note}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {b.status === 'approved' && (
                        <a
                          href={`/umkm/${b.slug}`}
                          className="rounded-md border border-paroki-200 px-3 py-1.5 text-xs font-medium text-paroki-700 hover:bg-paroki-50"
                        >
                          Lihat
                        </a>
                      )}
                      <a
                        href={`/dashboard/edit?id=${b.id}`}
                        className="rounded-md border border-paroki-200 px-3 py-1.5 text-xs font-medium text-paroki-700 hover:bg-paroki-50"
                      >
                        Edit
                      </a>
                      {(b.status === 'draft' || b.status === 'rejected') && (
                        <button
                          onClick={() => handleSubmitForReview(b.id)}
                          disabled={submittingId === b.id}
                          className="rounded-md bg-paroki-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {submittingId === b.id
                            ? 'Mengirim...'
                            : b.status === 'rejected'
                              ? 'Kirim Ulang'
                              : 'Kirim untuk Review'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 2: VERIFIKASI — redirect to dedicated page
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'verifikasi' && (
        <div className="py-10 text-center">
          <a
            href="/dashboard/verifikasi"
            className="inline-flex items-center gap-1.5 rounded-lg bg-paroki-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-paroki-700"
          >
            Ke Halaman Verifikasi →
          </a>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 3: FAVORIT SAYA
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'favorit' && (
        <>
          {favoritesLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-20 w-full rounded-lg bg-paroki-100" />
              <div className="h-20 w-full rounded-lg bg-paroki-100" />
            </div>
          ) : favorites.businesses.length === 0 && favorites.products.length === 0 ? (
            /* Empty state */
            <div className="rounded-lg border border-dashed border-paroki-300 bg-white py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-paroki-50 text-paroki-400">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg>
              </div>
              <p className="font-medium text-paroki-700">Belum ada favorit</p>
              <p className="mt-1 text-sm text-paroki-400">
                Anda belum memiliki favorit. Jelajahi direktori untuk menyimpan usaha/produk favorit Anda!
              </p>
              <a
                href="/umkm"
                className="mt-4 inline-flex items-center rounded-lg bg-paroki-600 px-4 py-2 text-sm font-semibold text-white hover:bg-paroki-700"
              >
                Jelajahi Direktori
              </a>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Usaha Favorit */}
              {favorites.businesses.length > 0 && (
                <div>
                  <h3 className="mb-3 font-serif text-lg font-bold text-paroki-900">
                    Usaha Favorit
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {favorites.businesses.map((fav) => {
                      const biz = fav.business;
                      if (!biz) return null;
                      return (
                        <div
                          key={fav.id}
                          className="flex items-center gap-3 rounded-xl border border-paroki-200 bg-white p-3 shadow-sm"
                        >
                          {/* Thumbnail / Logo */}
                          <a href={`/umkm/${biz.slug}`} className="flex-shrink-0">
                            <div className="h-14 w-14 overflow-hidden rounded-lg bg-paroki-50">
                              {biz.logo_url ? (
                                <img src={biz.logo_url} alt={biz.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-paroki-300">
                                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 9.5 5.5 5h13L20 9.5M4 9.5h16M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5M9.5 20v-4.5h5V20"/></svg>
                                </div>
                              )}
                            </div>
                          </a>

                          {/* Info */}
                          <a href={`/umkm/${biz.slug}`} className="min-w-0 flex-1">
                            <h4 className="truncate font-medium text-paroki-900 hover:text-paroki-700">{biz.name}</h4>
                            <p className="truncate text-xs text-paroki-500">
                              {biz.area || 'Lokasi tidak tersedia'}
                            </p>
                          </a>

                          {/* Remove */}
                          <button
                            onClick={() => handleRemoveFavorite(fav.id, 'business')}
                            className="flex-shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                            title="Hapus dari favorit"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Produk Favorit */}
              {favorites.products.length > 0 && (
                <div>
                  <h3 className="mb-3 font-serif text-lg font-bold text-paroki-900">
                    Produk Favorit
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {favorites.products.map((fav) => {
                      const prod = fav.product;
                      if (!prod) return null;
                      return (
                        <div
                          key={fav.id}
                          className="flex items-center gap-3 rounded-xl border border-paroki-200 bg-white p-3 shadow-sm"
                        >
                          {/* Thumbnail */}
                          <a href={`/${prod.business?.slug || '_'}/${prod.slug}`} className="flex-shrink-0">
                            <div className="h-14 w-14 overflow-hidden rounded-lg bg-paroki-50">
                              {prod.image_url ? (
                                <img src={prod.image_url} alt={prod.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-paroki-300">
                                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L9 20"/></svg>
                                </div>
                              )}
                            </div>
                          </a>

                          {/* Info */}
                          <a href={`/${prod.business?.slug || '_'}/${prod.slug}`} className="min-w-0 flex-1">
                            <h4 className="truncate font-medium text-paroki-900 hover:text-paroki-700">{prod.name}</h4>
                            <p className="truncate text-xs text-paroki-500">
                              {prod.business?.name || ''}
                              {prod.price != null
                                ? ` · Rp ${new Intl.NumberFormat('id-ID').format(prod.price)}`
                                : ''}
                            </p>
                          </a>

                          {/* Remove */}
                          <button
                            onClick={() => handleRemoveFavorite(fav.id, 'product')}
                            className="flex-shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                            title="Hapus dari favorit"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 4: PENGATURAN (Settings / Change Password)
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'pengaturan' && (
        <div className="space-y-6">
          {/* Profile info card */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="mb-4 font-display text-lg font-bold text-ink">Informasi Akun</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">Nama</span>
                <span className="font-medium text-ink">{profile?.full_name || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-ink">{userEmail || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">Telepon</span>
                <span className="font-medium text-ink">{profile?.phone || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Role</span>
                <span className="font-medium text-ink capitalize">{profile?.role || '-'}</span>
              </div>
            </div>
          </div>

          {/* Change password card */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="mb-1 font-display text-lg font-bold text-ink">Ubah Kata Sandi</h3>
            <p className="mb-4 text-sm text-gray-500">
              Pastikan menggunakan kata sandi yang kuat (min. 6 karakter).
            </p>

            {passwordSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
                Kata sandi berhasil diubah!
              </div>
            )}

            {passwordError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-soft">
                  Kata Sandi Baru
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-soft">
                  Ulangi Kata Sandi Baru
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:ring-2 ${
                    confirmNewPassword && newPassword !== confirmNewPassword
                      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                      : confirmNewPassword && newPassword === confirmNewPassword
                        ? 'border-green-300 focus:border-green-400 focus:ring-green-100'
                        : 'border-gray-200 focus:border-gold-400 focus:ring-gold-200'
                  }`}
                />
                {confirmNewPassword && newPassword !== confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">Kata sandi tidak cocok</p>
                )}
                {confirmNewPassword && newPassword === confirmNewPassword && (
                  <p className="mt-1 text-xs text-green-600">✓ Kata sandi cocok</p>
                )}
              </div>

              <button
                type="submit"
                disabled={passwordLoading || (!!confirmNewPassword && newPassword !== confirmNewPassword)}
                className="rounded-lg bg-gold-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-gold-600 disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px"
              >
                {passwordLoading ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 5: BAZAR (Jadwal & Konfirmasi)
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'bazar' && businesses.length > 0 && (
        <BazarSchedule businessId={businesses[0].id} businessName={businesses[0].name} />
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 6: ARTIKEL (Tulis Blog)
      ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'artikel' && <BlogEditor />}
    </div>
  );
}
