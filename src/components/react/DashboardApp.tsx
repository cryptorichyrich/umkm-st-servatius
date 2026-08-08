import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { supabase, type Business, type Profile, type BusinessStatus, type Product, type Favorite } from '../../lib/supabase';
import { Eye, EyeOff, Store, Plus, ShieldCheck, Heart, Settings as SettingsIcon, LogOut, Calendar, FileText, ChevronRight, ExternalLink } from 'lucide-react';

const BazarSchedule = lazy(() => import('./BazarSchedule'));
const BlogEditor = lazy(() => import('./BlogEditor'));

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
// Status badge
// ─────────────────────────────────────────────
function StatusBadge({ status }: { status: BusinessStatus }) {
  const styles: Record<BusinessStatus, string> = {
    draft: 'bg-gray-100 text-gray-600',
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };
  const labels: Record<BusinessStatus, string> = {
    draft: 'Draft',
    pending: 'Menunggu Review',
    approved: 'Disetujui',
    rejected: 'Ditolak',
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

// ─────────────────────────────────────────────
// Verification badge
// ─────────────────────────────────────────────
function VerificationBadge({ type, status, role }: { type: string; status: string; role?: string }) {
  if (role === 'admin' || role === 'verifier') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-semibold text-gold-800 ring-1 ring-gold-300">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z"/></svg>
        {role === 'verifier' ? 'Verifier' : 'Admin'}
      </span>
    );
  }
  if (status === 'verified' && type === 'umkm') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-300">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6z"/></svg>
        UMKM Terverifikasi
      </span>
    );
  }
  if (status === 'verified' && type === 'member') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 ring-1 ring-green-300">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
        Member Terverifikasi
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

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
interface DashboardAppProps {
  initialTab?: TabKey;
}

export default function DashboardApp({ initialTab = 'usaha' }: DashboardAppProps) {
  const activeTab: TabKey = initialTab;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [favorites, setFavorites] = useState<{ businesses: FavoriteBusinessRow[]; products: FavoriteProductRow[] }>({ businesses: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
  // Initial load
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

      setUserId(session.user.id);
      setUserEmail(session.user.email || null);

      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileErr) {
        console.error('Profile fetch error:', profileErr);
      } else {
        setProfile(profileData as Profile);
      }

      const { data: bizData, error: bizErr } = await supabase
        .from('businesses')
        .select(`*, category:categories(*)`)
        .eq('owner_id', session.user.id)
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

      const { data: bizFavs, error: bizFavErr } = await supabase
        .from('favorites')
        .select(`*, business:businesses(*)`)
        .eq('user_id', session.user.id)
        .not('business_id', 'is', null)
        .order('created_at', { ascending: false });

      if (bizFavErr) throw bizFavErr;

      const { data: prodFavs, error: prodFavErr } = await supabase
        .from('favorites')
        .select(`*, product:products(*, business:businesses(id, name, slug))`)
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

  useEffect(() => {
    if (activeTab === 'favorit') {
      fetchFavorites();
    }
  }, [activeTab, fetchFavorites]);

  // ─────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────
  const handleSubmitForReview = useCallback(async (businessId: string) => {
    setSubmittingId(businessId);
    try {
      const { error: rpcErr } = await supabase.rpc('submit_for_review', { p_business_id: businessId });
      if (rpcErr) throw rpcErr;
      setBusinesses((prev) => prev.map((b) => (b.id === businessId ? { ...b, status: 'pending' } : b)));
    } catch (err) {
      alert(err instanceof Error ? `Gagal mengirim: ${err.message}` : 'Gagal mengirim untuk review.');
    } finally {
      setSubmittingId(null);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }, []);

  const handleRemoveFavorite = useCallback(async (favId: string, type: 'business' | 'product') => {
    try {
      const { error: delErr } = await supabase.from('favorites').delete().eq('id', favId);
      if (delErr) throw delErr;
      if (type === 'business') {
        setFavorites((prev) => ({ ...prev, businesses: prev.businesses.filter((f) => f.id !== favId) }));
      } else {
        setFavorites((prev) => ({ ...prev, products: prev.products.filter((f) => f.id !== favId) }));
      }
    } catch (err) {
      alert(err instanceof Error ? `Gagal menghapus: ${err.message}` : 'Gagal menghapus favorit.');
    }
  }, []);

  const isAdmin = profile?.role === 'admin';
  const canAccessAdmin = isAdmin || profile?.role === 'verifier';
  const isVerifiedStatus = profile?.verification_status === 'verified';
  const canAddBusiness = isAdmin || (isVerifiedStatus && (profile?.verification_type === 'member' || profile?.verification_type === 'umkm'));

  const approvedCount = businesses.filter(b => b.status === 'approved').length;
  const pendingCount = businesses.filter(b => b.status === 'pending').length;

  // ─────────────────────────────────────────────
  // Sidebar nav items
  // ─────────────────────────────────────────────
  const navItems: { key: TabKey; label: string; href: string; icon: React.ComponentType<{ className?: string }>; show?: boolean }[] = [
    { key: 'usaha', label: 'Usaha Saya', href: '/dashboard', icon: Store },
    { key: 'verifikasi', label: 'Verifikasi', href: '/dashboard/verifikasi', icon: ShieldCheck },
    { key: 'favorit', label: 'Favorit', href: '/dashboard/favorit', icon: Heart },
    { key: 'bazar', label: 'Bazar', href: '/dashboard/bazar', icon: Calendar, show: businesses.length > 0 },
    { key: 'artikel', label: 'Tulis Artikel', href: '/dashboard/artikel', icon: FileText, show: businesses.length > 0 },
    { key: 'pengaturan', label: 'Pengaturan', href: '/dashboard/pengaturan', icon: SettingsIcon },
  ];

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Loading
  // ═══════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse space-y-3 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-paroki-200" />
          <div className="mx-auto h-4 w-32 rounded bg-paroki-100" />
          <div className="mx-auto h-3 w-48 rounded bg-paroki-50" />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Main — sidebar layout
  // ═══════════════════════════════════════════════════════════════
  const activeLabel = navItems.find(n => n.key === activeTab)?.label || 'Dashboard';

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      {/* ───── Mobile overlay ───── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ───── Sidebar ───── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto bg-gradient-to-b from-paroki-900 to-paroki-800 text-paroki-100 transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Profile header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold-500/20 text-sm font-bold text-gold-300 ring-1 ring-gold-400/30">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              (profile?.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-sm font-bold text-gold-400">{profile?.full_name || 'Pengguna'}</p>
            <p className="truncate text-[11px] text-paroki-300">{userEmail}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-paroki-300 hover:text-white lg:hidden">
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
        </div>

        {/* Verification badge */}
        {profile && (
          <div className="px-5 py-3 border-b border-white/10">
            <VerificationBadge type={profile.verification_type} status={profile.verification_status} role={profile.role} />
          </div>
        )}

        {/* Stats chips */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5">
            <Store className="h-3 w-3 text-paroki-400" />
            <span className="text-xs font-semibold text-white">{businesses.length}</span>
            <span className="text-[10px] text-paroki-400">Usaha</span>
          </div>
          {approvedCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-green-500/10 px-2.5 py-1.5">
              <span className="text-xs font-semibold text-green-300">{approvedCount}</span>
              <span className="text-[10px] text-green-400">Aktif</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4">
          {navItems.filter(n => n.show !== false).map((item) => (
            <a
              key={item.key}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all ${
                activeTab === item.key
                  ? 'bg-white/10 font-medium text-white shadow-sm'
                  : 'text-paroki-200 hover:bg-white/5 hover:text-white'
              }`}
            >
              {activeTab === item.key && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gold-400" />
              )}
              <item.icon className={`h-4 w-4 shrink-0 ${activeTab === item.key ? 'text-gold-400' : 'text-paroki-400 group-hover:text-paroki-200'}`} />
              <span className="truncate">{item.label}</span>
              {item.key === 'usaha' && pendingCount > 0 && (
                <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{pendingCount}</span>
              )}
            </a>
          ))}
        </nav>

        {/* Footer */}
        <div className="space-y-1 border-t border-white/10 px-3 py-3">
          {canAccessAdmin && (
            <a href="/admin" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-gold-300 transition hover:bg-white/5 hover:text-gold-200">
              <ShieldCheck className="h-4 w-4" />
              {profile?.role === 'verifier' ? 'Panel Verifikasi' : 'Admin Panel'}
            </a>
          )}
          <a href="/" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-paroki-300 transition hover:bg-white/5 hover:text-white">
            <ExternalLink className="h-3.5 w-3.5" />
            Lihat Situs Publik
          </a>
          <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/10 hover:text-red-200">
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </aside>

      {/* ───── Main content ───── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/80 backdrop-blur-lg">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
            </button>
            <div className="flex-1">
              <h1 className="font-serif text-lg font-bold text-paroki-900 sm:text-xl">{activeLabel}</h1>
            </div>
            {/* Quick action */}
            {activeTab === 'usaha' && (
              canAddBusiness ? (
                <a href="/dashboard/baru" className="inline-flex items-center gap-1.5 rounded-xl bg-gold-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gold-600">
                  <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Tambah Usaha</span><span className="sm:hidden">Tambah</span>
                </a>
              ) : (
                <a href="/dashboard/verifikasi" className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100">
                  <ShieldCheck className="h-4 w-4" /> <span className="hidden sm:inline">Verifikasi Diperlukan</span><span className="sm:hidden">Verifikasi</span>
                </a>
              )
            )}
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6">
            {error}
          </div>
        )}

        {/* ───── Tab content ───── */}
        <div className="flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-4xl">

            {/* ═══ TAB 1: USAHA ═══ */}
            {activeTab === 'usaha' && (
              <>
                {businesses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-paroki-300 bg-white py-20 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-paroki-50">
                      <Store className="h-8 w-8 text-paroki-400" />
                    </div>
                    <p className="font-serif text-lg font-bold text-paroki-800">Belum ada usaha terdaftar</p>
                    <p className="mt-1 max-w-sm text-sm text-paroki-500">
                      Mulai daftarkan usaha Anda untuk tampil di direktori UMKM Paroki St. Servatius.
                    </p>
                    {canAddBusiness && (
                      <a href="/dashboard/baru" className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gold-600">
                        <Plus className="h-4 w-4" /> Tambah Usaha Baru
                      </a>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-gray-200 bg-gray-50 text-gray-700">
                          <tr>
                            <th className="px-5 py-3 font-semibold">Nama Usaha</th>
                            <th className="px-4 py-3 font-semibold">Kategori</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 font-semibold">Dibuat</th>
                            <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {businesses.map((b) => (
                            <tr key={b.id} className="transition hover:bg-gray-50/50">
                              <td className="px-5 py-3.5">
                                <a href={`/${b.slug}`} target="_blank" rel="noopener noreferrer" className="font-medium text-paroki-900 transition hover:text-gold-600 hover:underline">
                                  {b.name}
                                </a>
                                {b.status === 'rejected' && b.rejection_note && (
                                  <div className="mt-1 max-w-xs text-xs text-red-600">Catatan: {b.rejection_note}</div>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-gray-600">
                                {b.category ? `${b.category.icon} ${b.category.name}` : '-'}
                              </td>
                              <td className="px-4 py-3.5"><StatusBadge status={b.status} /></td>
                              <td className="px-4 py-3.5 text-gray-400">{formatDate(b.created_at)}</td>
                              <td className="px-4 py-3.5">
                                <div className="flex justify-end gap-1.5">
                                  {b.status === 'approved' && (
                                    <a href={`/${b.slug}`} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50">Lihat</a>
                                  )}
                                  <a href={`/dashboard/edit?id=${b.id}`} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50">Edit</a>
                                  {(b.status === 'draft' || b.status === 'rejected') && (
                                    <button onClick={() => handleSubmitForReview(b.id)} disabled={submittingId === b.id} className="rounded-lg bg-paroki-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60">
                                      {submittingId === b.id ? 'Mengirim...' : b.status === 'rejected' ? 'Kirim Ulang' : 'Kirim Review'}
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
                        <div key={b.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-medium">
                                <a href={`/${b.slug}`} target="_blank" rel="noopener noreferrer" className="text-paroki-900 transition hover:text-gold-600 hover:underline">{b.name}</a>
                              </h3>
                              <p className="mt-0.5 text-xs text-gray-500">
                                {b.category ? `${b.category.icon} ${b.category.name}` : 'Tanpa kategori'} {' \u00B7 '} {formatDate(b.created_at)}
                              </p>
                            </div>
                            <StatusBadge status={b.status} />
                          </div>
                          {b.status === 'rejected' && b.rejection_note && (
                            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">Catatan: {b.rejection_note}</p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {b.status === 'approved' && (
                              <a href={`/${b.slug}`} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50">Lihat</a>
                            )}
                            <a href={`/dashboard/edit?id=${b.id}`} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50">Edit</a>
                            {(b.status === 'draft' || b.status === 'rejected') && (
                              <button onClick={() => handleSubmitForReview(b.id)} disabled={submittingId === b.id} className="rounded-lg bg-paroki-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60">
                                {submittingId === b.id ? 'Mengirim...' : b.status === 'rejected' ? 'Kirim Ulang' : 'Kirim Review'}
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

            {/* ═══ TAB 2: VERIFIKASI ═══ */}
            {activeTab === 'verifikasi' && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-paroki-300 bg-white py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-paroki-50">
                  <ShieldCheck className="h-8 w-8 text-paroki-400" />
                </div>
                <p className="font-serif text-lg font-bold text-paroki-800">Verifikasi Akun</p>
                <p className="mt-1 max-w-sm text-sm text-paroki-500">
                  Verifikasi keanggotaan untuk mengakses fitur pendaftaran usaha dan layanan lainnya.
                </p>
                <a href="/dashboard/verifikasi/member" className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-paroki-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-paroki-700">
                  Ke Halaman Verifikasi <ChevronRight className="h-4 w-4" />
                </a>
              </div>
            )}

            {/* ═══ TAB 3: FAVORIT ═══ */}
            {activeTab === 'favorit' && (
              <>
                {favoritesLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-20 w-full rounded-xl bg-gray-100" />
                    <div className="h-20 w-full rounded-xl bg-gray-100" />
                  </div>
                ) : favorites.businesses.length === 0 && favorites.products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-paroki-300 bg-white py-20 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-paroki-50">
                      <Heart className="h-8 w-8 text-paroki-400" />
                    </div>
                    <p className="font-serif text-lg font-bold text-paroki-800">Belum ada favorit</p>
                    <p className="mt-1 max-w-sm text-sm text-paroki-500">
                      Jelajahi direktori untuk menyimpan usaha dan produk favorit Anda.
                    </p>
                    <a href="/umkm" className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-paroki-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-paroki-700">
                      Jelajahi Direktori
                    </a>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {favorites.businesses.length > 0 && (
                      <div>
                        <h3 className="mb-3 font-serif text-lg font-bold text-paroki-900">Usaha Favorit</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {favorites.businesses.map((fav) => {
                            const biz = fav.business;
                            if (!biz) return null;
                            return (
                              <div key={fav.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md">
                                <a href={`/${biz.slug}`} className="shrink-0">
                                  <div className="h-14 w-14 overflow-hidden rounded-lg bg-gray-100">
                                    {biz.logo_url ? (
                                      <img src={biz.logo_url} alt={biz.name} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-gray-300"><Store className="h-6 w-6" /></div>
                                    )}
                                  </div>
                                </a>
                                <a href={`/${biz.slug}`} className="min-w-0 flex-1">
                                  <h4 className="truncate font-medium text-paroki-900 hover:text-paroki-700">{biz.name}</h4>
                                  <p className="truncate text-xs text-gray-500">{biz.area || 'Lokasi tidak tersedia'}</p>
                                </a>
                                <button onClick={() => handleRemoveFavorite(fav.id, 'business')} className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500" title="Hapus dari favorit">
                                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {favorites.products.length > 0 && (
                      <div>
                        <h3 className="mb-3 font-serif text-lg font-bold text-paroki-900">Produk Favorit</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {favorites.products.map((fav) => {
                            const prod = fav.product;
                            if (!prod) return null;
                            return (
                              <div key={fav.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md">
                                <a href={`/${prod.business?.slug || '_'}/${prod.slug}`} className="shrink-0">
                                  <div className="h-14 w-14 overflow-hidden rounded-lg bg-gray-100">
                                    {prod.image_url ? (
                                      <img src={prod.image_url} alt={prod.name} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-gray-300"><FileText className="h-6 w-6" /></div>
                                    )}
                                  </div>
                                </a>
                                <a href={`/${prod.business?.slug || '_'}/${prod.slug}`} className="min-w-0 flex-1">
                                  <h4 className="truncate font-medium text-paroki-900 hover:text-paroki-700">{prod.name}</h4>
                                  <p className="truncate text-xs text-gray-500">
                                    {prod.business?.name || ''}{prod.price != null ? ` \u00B7 Rp ${new Intl.NumberFormat('id-ID').format(prod.price)}` : ''}
                                  </p>
                                </a>
                                <button onClick={() => handleRemoveFavorite(fav.id, 'product')} className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500" title="Hapus dari favorit">
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

            {/* ═══ TAB 4: PENGATURAN ═══ */}
            {activeTab === 'pengaturan' && (
              <div className="space-y-6">
                {/* Profile card */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-5 font-serif text-lg font-bold text-paroki-900">Informasi Akun</h3>
                  <div className="mb-5 flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-paroki-700 to-paroki-900 text-xl font-bold text-white shadow-md ring-2 ring-gold-300/30">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (profile?.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                      )}
                    </div>
                    <div>
                      <label className="cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                        Ganti Foto
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !userId) return;
                            try {
                              const { uploadToR2 } = await import('../../lib/r2-upload');
                              const { url } = await uploadToR2(file);
                              await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
                              setProfile(p => p ? { ...p, avatar_url: url } : p);
                            } catch (err) {
                              alert('Gagal upload: ' + (err instanceof Error ? err.message : 'Unknown error'));
                            }
                          }}
                        />
                      </label>
                      <p className="mt-1 text-xs text-gray-400">JPG/PNG, maks 2MB</p>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    {[
                      { label: 'Nama', value: profile?.full_name || '-' },
                      { label: 'Email', value: userEmail || '-' },
                      { label: 'Telepon', value: profile?.phone || '-' },
                      { label: 'Role', value: (profile?.role || '-').charAt(0).toUpperCase() + (profile?.role || '-').slice(1) },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between border-b border-gray-100 pb-3">
                        <span className="text-gray-500">{row.label}</span>
                        <span className="font-medium text-paroki-900">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Change password */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-1 font-serif text-lg font-bold text-paroki-900">Ubah Kata Sandi</h3>
                  <p className="mb-5 text-sm text-gray-500">Pastikan menggunakan kata sandi yang kuat (min. 6 karakter).</p>

                  {passwordSuccess && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
                      Kata sandi berhasil diubah!
                    </div>
                  )}

                  {passwordError && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{passwordError}</div>
                  )}

                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Kata Sandi Baru</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min. 6 karakter"
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-100"
                        />
                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600" tabIndex={-1}>
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Ulangi Kata Sandi Baru</label>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Ulangi kata sandi"
                        className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2 ${
                          confirmNewPassword && newPassword !== confirmNewPassword
                            ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                            : confirmNewPassword && newPassword === confirmNewPassword
                              ? 'border-green-300 focus:border-green-400 focus:ring-green-100'
                              : 'border-gray-200 focus:border-gold-400 focus:ring-gold-100'
                        }`}
                      />
                      {confirmNewPassword && newPassword !== confirmNewPassword && (
                        <p className="mt-1 text-xs text-red-500">Kata sandi tidak cocok</p>
                      )}
                      {confirmNewPassword && newPassword === confirmNewPassword && (
                        <p className="mt-1 text-xs text-green-600">Kata sandi cocok</p>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={passwordLoading || (!!confirmNewPassword && newPassword !== confirmNewPassword)}
                      className="rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-gold-600 disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px"
                    >
                      {passwordLoading ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ═══ TAB 5: BAZAR ═══ */}
            {activeTab === 'bazar' && businesses.length > 0 && (
              <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-paroki-600" /></div>}>
                <BazarSchedule businessId={businesses[0].id} businessName={businesses[0].name} />
              </Suspense>
            )}

            {/* ═══ TAB 6: ARTIKEL ═══ */}
            {activeTab === 'artikel' && (
              <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-paroki-600" /></div>}>
                <BlogEditor />
              </Suspense>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
