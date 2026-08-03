import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  supabase,
  type Business,
  type Category,
  type BusinessStatus,
  type Wilayah,
  type Lingkungan,
} from '../../lib/supabase';

// ─────────────────────────────────────────────
// Status badge
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
    pending: 'Menunggu',
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
// Joined row types
// ─────────────────────────────────────────────
interface BusinessRow extends Business {
  category?: Category;
}

interface LingkunganRow extends Lingkungan {
  wilayah?: Wilayah;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: 'owner' | 'member' | 'admin' | null;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected' | null;
  verification_type: string | null;
  verified_at: string | null;
  created_at: string;
}

interface ReviewRow {
  id: string;
  business_id: string;
  reviewer_id: string;
  rating: number;
  title: string | null;
  content: string | null;
  is_visible: boolean;
  created_at: string;
  business?: { name: string };
  reviewer?: { full_name: string | null };
}

interface AdminStats {
  total: number;
  pending: number;
  approved: number;
  categories: number;
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
type TabKey = 'moderasi' | 'listing' | 'kategori' | 'wilayah' | 'users' | 'reviews';

export default function AdminPanel() {
  // ── Auth / loading ──
  const [authState, setAuthState] = useState<'loading' | 'denied' | 'ok'>('loading');
  const [loading, setLoading] = useState(true);

  // ── Data ──
  const [pendingBiz, setPendingBiz] = useState<BusinessRow[]>([]);
  const [allBiz, setAllBiz] = useState<BusinessRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<AdminStats>({ total: 0, pending: 0, approved: 0, categories: 0 });
  const [error, setError] = useState<string | null>(null);

  // ── UI state ──
  const [activeTab, setActiveTab] = useState<TabKey>('moderasi');
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Category form ──
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('');
  const [catSort, setCatSort] = useState('0');
  const [catSubmitting, setCatSubmitting] = useState(false);

  // ── Wilayah & Lingkungan data ──
  const [wilayahList, setWilayahList] = useState<Wilayah[]>([]);
  const [lingkunganList, setLingkunganList] = useState<LingkunganRow[]>([]);

  // ── Wilayah form ──
  const [wilName, setWilName] = useState('');
  const [wilSort, setWilSort] = useState('0');
  const [wilSubmitting, setWilSubmitting] = useState(false);
  const [editingWilId, setEditingWilId] = useState<string | null>(null);

  // ── Lingkungan form ──
  const [lingWilId, setLingWilId] = useState('');
  const [lingName, setLingName] = useState('');
  const [lingSort, setLingSort] = useState('0');
  const [lingSubmitting, setLingSubmitting] = useState(false);
  const [editingLingId, setEditingLingId] = useState<string | null>(null);

  // ── User verification ──
  const [userList, setUserList] = useState<UserProfile[]>([]);
  const [userVerifyingId, setUserVerifyingId] = useState<string | null>(null);

  // ── Reviews ──
  const [reviewList, setReviewList] = useState<ReviewRow[]>([]);
  const [reviewActionId, setReviewActionId] = useState<string | null>(null);

  // ───────────────────────────────────────────
  // Fetch helpers
  // ───────────────────────────────────────────
  const fetchPending = useCallback(async () => {
    const { data, error } = await supabase
      .from('businesses')
      .select(`*, category:categories(*)`)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;
    setPendingBiz((data || []) as BusinessRow[]);
  }, []);

  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase
      .from('businesses')
      .select(`*, category:categories(*)`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    setAllBiz((data || []) as BusinessRow[]);
  }, []);

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    setCategories((data || []) as Category[]);
  }, []);

  const fetchWilayah = useCallback(async () => {
    const { data, error } = await supabase
      .from('wilayah')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    setWilayahList((data || []) as Wilayah[]);
  }, []);

  const fetchLingkungan = useCallback(async () => {
    const { data, error } = await supabase
      .from('lingkungan')
      .select('*, wilayah:wilayah(*)')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    setLingkunganList((data || []) as LingkunganRow[]);
  }, []);

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    setUserList((data || []) as UserProfile[]);
  }, []);

  const fetchReviews = useCallback(async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, business:businesses(name), reviewer:profiles(full_name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    setReviewList((data || []) as ReviewRow[]);
  }, []);

  const computeStats = useCallback(
    (all: BusinessRow[], pending: BusinessRow[], cats: Category[]) => {
      setStats({
        total: all.length,
        pending: pending.length,
        approved: all.filter((b) => b.status === 'approved').length,
        categories: cats.length,
      });
    },
    [],
  );

  // ───────────────────────────────────────────
  // Initial auth check + data load
  // ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          window.location.href = '/masuk';
          return;
        }

        // Verify admin role
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profileErr || !profile || profile.role !== 'admin') {
          setAuthState('denied');
          setLoading(false);
          return;
        }

        setAuthState('ok');

        // Load all data
        await Promise.all([
          fetchPending(),
          fetchAll(),
          fetchCategories(),
          fetchWilayah(),
          fetchLingkungan(),
          fetchUsers(),
          fetchReviews(),
        ]);
      } catch (err) {
        console.error('Admin init error:', err);
        setError('Gagal memuat data. Silakan coba lagi.');
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchPending, fetchAll, fetchCategories, fetchWilayah, fetchLingkungan, fetchUsers, fetchReviews]);

  // Recompute stats whenever data changes
  useEffect(() => {
    computeStats(allBiz, pendingBiz, categories);
  }, [allBiz, pendingBiz, categories, computeStats]);

  // ───────────────────────────────────────────
  // Actions
  // ───────────────────────────────────────────
  const handleApprove = async (businessId: string) => {
    setActingId(businessId);
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc('approve_business', {
        p_business_id: businessId,
      });
      if (rpcErr) throw rpcErr;
      // Remove from pending list and refresh all-list
      setPendingBiz((prev) => prev.filter((b) => b.id !== businessId));
      await fetchAll();
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal menyetujui: ${err.message}`
          : 'Gagal menyetujui listing.',
      );
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (businessId: string) => {
    setActingId(businessId);
    setError(null);
    try {
      const note = rejectNote.trim() || 'Tidak memenuhi kriteria.';
      const { error: rpcErr } = await supabase.rpc('reject_business', {
        p_business_id: businessId,
        p_note: note,
      });
      if (rpcErr) throw rpcErr;
      setPendingBiz((prev) => prev.filter((b) => b.id !== businessId));
      await fetchAll();
      setRejectingId(null);
      setRejectNote('');
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal menolak: ${err.message}`
          : 'Gagal menolak listing.',
      );
    } finally {
      setActingId(null);
    }
  };

  const openRejectDialog = (businessId: string) => {
    setRejectingId(businessId);
    setRejectNote('');
  };

  const cancelReject = () => {
    setRejectingId(null);
    setRejectNote('');
  };

  const toggleFeatured = async (businessId: string, currentValue: boolean) => {
    setTogglingId(businessId);
    setError(null);
    try {
      const { error: updateErr } = await supabase
        .from('businesses')
        .update({ is_featured: !currentValue })
        .eq('id', businessId);
      if (updateErr) throw updateErr;
      setAllBiz((prev) =>
        prev.map((b) =>
          b.id === businessId ? { ...b, is_featured: !currentValue } : b,
        ),
      );
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal mengubah featured: ${err.message}`
          : 'Gagal mengubah status featured.',
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleAddCategory = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setCatSubmitting(true);
    setError(null);
    try {
      const slug = catName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const { error: insertErr } = await supabase.from('categories').insert({
        name: catName.trim(),
        slug,
        icon: catIcon.trim() || '🏷️',
        sort_order: parseInt(catSort, 10) || 0,
      });
      if (insertErr) throw insertErr;
      setCatName('');
      setCatIcon('');
      setCatSort('0');
      await fetchCategories();
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal menambah kategori: ${err.message}`
          : 'Gagal menambah kategori.',
      );
    } finally {
      setCatSubmitting(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Yakin ingin menghapus kategori ini?')) return;
    setError(null);
    try {
      const { error: delErr } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);
      if (delErr) throw delErr;
      await fetchCategories();
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal menghapus kategori: ${err.message}`
          : 'Gagal menghapus kategori.',
      );
    }
  };

  // ───────────────────────────────────────────
  // Wilayah actions
  // ───────────────────────────────────────────
  const handleSubmitWilayah = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!wilName.trim()) return;
    setWilSubmitting(true);
    setError(null);
    try {
      if (editingWilId) {
        const { error: updateErr } = await supabase
          .from('wilayah')
          .update({
            name: wilName.trim(),
            sort_order: parseInt(wilSort, 10) || 0,
          })
          .eq('id', editingWilId);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase.from('wilayah').insert({
          name: wilName.trim(),
          sort_order: parseInt(wilSort, 10) || 0,
        });
        if (insertErr) throw insertErr;
      }
      setWilName('');
      setWilSort('0');
      setEditingWilId(null);
      await fetchWilayah();
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal menyimpan wilayah: ${err.message}`
          : 'Gagal menyimpan wilayah.',
      );
    } finally {
      setWilSubmitting(false);
    }
  };

  const startEditWilayah = (w: Wilayah) => {
    setEditingWilId(w.id);
    setWilName(w.name);
    setWilSort(String(w.sort_order));
  };

  const cancelEditWilayah = () => {
    setEditingWilId(null);
    setWilName('');
    setWilSort('0');
  };

  const handleDeleteWilayah = async (wilayahId: string) => {
    if (
      !confirm(
        'Yakin ingin menghapus wilayah ini? Lingkungan di bawahnya juga akan terhapus.',
      )
    )
      return;
    setError(null);
    try {
      const { error: delErr } = await supabase
        .from('wilayah')
        .delete()
        .eq('id', wilayahId);
      if (delErr) throw delErr;
      await Promise.all([fetchWilayah(), fetchLingkungan()]);
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal menghapus wilayah: ${err.message}`
          : 'Gagal menghapus wilayah.',
      );
    }
  };

  // ───────────────────────────────────────────
  // Lingkungan actions
  // ───────────────────────────────────────────
  const handleSubmitLingkungan = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!lingName.trim() || !lingWilId) return;
    setLingSubmitting(true);
    setError(null);
    try {
      if (editingLingId) {
        const { error: updateErr } = await supabase
          .from('lingkungan')
          .update({
            wilayah_id: lingWilId,
            name: lingName.trim(),
            sort_order: parseInt(lingSort, 10) || 0,
          })
          .eq('id', editingLingId);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase.from('lingkungan').insert({
          wilayah_id: lingWilId,
          name: lingName.trim(),
          sort_order: parseInt(lingSort, 10) || 0,
        });
        if (insertErr) throw insertErr;
      }
      setLingName('');
      setLingSort('0');
      setEditingLingId(null);
      await fetchLingkungan();
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal menyimpan lingkungan: ${err.message}`
          : 'Gagal menyimpan lingkungan.',
      );
    } finally {
      setLingSubmitting(false);
    }
  };

  const startEditLingkungan = (l: LingkunganRow) => {
    setEditingLingId(l.id);
    setLingWilId(l.wilayah_id);
    setLingName(l.name);
    setLingSort(String(l.sort_order));
  };

  const cancelEditLingkungan = () => {
    setEditingLingId(null);
    setLingName('');
    setLingSort('0');
  };

  const handleDeleteLingkungan = async (lingkunganId: string) => {
    if (!confirm('Yakin ingin menghapus lingkungan ini?')) return;
    setError(null);
    try {
      const { error: delErr } = await supabase
        .from('lingkungan')
        .delete()
        .eq('id', lingkunganId);
      if (delErr) throw delErr;
      await fetchLingkungan();
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal menghapus lingkungan: ${err.message}`
          : 'Gagal menghapus lingkungan.',
      );
    }
  };

  // ───────────────────────────────────────────
  // User verification actions
  // ───────────────────────────────────────────
  const handleVerifyUser = async (
    userId: string,
    status: 'verified' | 'rejected',
  ) => {
    setUserVerifyingId(userId);
    setError(null);
    try {
      const params: Record<string, unknown> = {
        p_user_id: userId,
        p_status: status,
      };
      if (status === 'rejected') {
        params.p_note = 'Ditolak oleh admin';
      }
      const { error: rpcErr } = await supabase.rpc('verify_user', params);
      if (rpcErr) throw rpcErr;
      await fetchUsers();
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal memverifikasi user: ${err.message}`
          : 'Gagal memverifikasi user.',
      );
    } finally {
      setUserVerifyingId(null);
    }
  };

  // ───────────────────────────────────────────
  // Review actions
  // ───────────────────────────────────────────
  const toggleReviewVisibility = async (
    reviewId: string,
    currentVisible: boolean,
  ) => {
    setReviewActionId(reviewId);
    setError(null);
    try {
      const { error: updateErr } = await supabase
        .from('reviews')
        .update({ is_visible: !currentVisible })
        .eq('id', reviewId);
      if (updateErr) throw updateErr;
      setReviewList((prev) =>
        prev.map((r) =>
          r.id === reviewId ? { ...r, is_visible: !currentVisible } : r,
        ),
      );
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal mengubah visibilitas: ${err.message}`
          : 'Gagal mengubah visibilitas ulasan.',
      );
    } finally {
      setReviewActionId(null);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Yakin ingin menghapus ulasan ini?')) return;
    setReviewActionId(reviewId);
    setError(null);
    try {
      const { error: delErr } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);
      if (delErr) throw delErr;
      setReviewList((prev) => prev.filter((r) => r.id !== reviewId));
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal menghapus ulasan: ${err.message}`
          : 'Gagal menghapus ulasan.',
      );
    } finally {
      setReviewActionId(null);
    }
  };

  // ───────────────────────────────────────────
  // Render: Loading
  // ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-paroki-100" />
          <div className="h-24 rounded-xl bg-paroki-100" />
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────
  // Render: Access Denied
  // ───────────────────────────────────────────
  if (authState === 'denied') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mb-4 text-5xl">🚫</div>
        <h1 className="font-serif text-2xl font-bold text-paroki-900">
          Akses Ditolak
        </h1>
        <p className="mt-2 text-sm text-paroki-600">
          Anda tidak memiliki izin admin untuk mengakses halaman ini.
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-lg bg-paroki-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-paroki-700"
        >
          Kembali ke Beranda
        </a>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: string; badge?: number }[] = [
    { key: 'moderasi', label: 'Moderasi', icon: '⏳', badge: pendingBiz.length },
    { key: 'listing', label: 'Semua Listing', icon: '📋' },
    { key: 'kategori', label: 'Kategori', icon: '🗂️' },
    { key: 'wilayah', label: 'Wilayah & Lingkungan', icon: '📍' },
    { key: 'users', label: 'Verifikasi User', icon: '👥' },
    { key: 'reviews', label: 'Ulasan', icon: '⭐' },
  ];

  // ───────────────────────────────────────────
  // Render: Main panel
  // ───────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-paroki-900">
          Admin Panel
        </h1>
        <p className="mt-1 text-sm text-paroki-600">
          Moderasi listing, kelola kategori, dan kelola fitur unggulan.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Usaha" value={stats.total} icon="🏪" />
        <StatCard label="Menunggu" value={stats.pending} icon="⏳" />
        <StatCard label="Disetujui" value={stats.approved} icon="✅" />
        <StatCard label="Kategori" value={stats.categories} icon="🗂️" />
      </div>

      {/* Tab navigation */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-paroki-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative -mb-px flex items-center gap-1.5 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              activeTab === tab.key
                ? 'border-paroki-600 text-paroki-700'
                : 'border-transparent text-paroki-500 hover:text-paroki-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-0.5 rounded-full bg-yellow-400 px-1.5 py-0.5 text-[10px] font-bold text-yellow-900">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─────────────────────────────── */}
      {/* Moderasi tab */}
      {/* ─────────────────────────────── */}
      {activeTab === 'moderasi' && (
        <div className="space-y-4">
          {pendingBiz.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-paroki-300 bg-white py-16 text-center">
              <div className="mb-3 text-5xl">✨</div>
              <p className="font-medium text-paroki-700">
                Tidak ada listing menunggu moderasi
              </p>
              <p className="mt-1 text-sm text-paroki-400">
                Semua usaha sudah ditinjau.
              </p>
            </div>
          ) : (
            pendingBiz.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-paroki-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold text-paroki-900">
                      {b.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-paroki-500">
                      {b.category && (
                        <span className="rounded-full bg-paroki-100 px-2.5 py-0.5 font-medium text-paroki-700">
                          {b.category.icon} {b.category.name}
                        </span>
                      )}
                      {b.area && <span>📍 {b.area}</span>}
                    </div>
                    {b.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-paroki-600">
                        {b.description}
                      </p>
                    )}
                    {/* Contact info */}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-paroki-500">
                      {b.whatsapp && <span>💬 WhatsApp: {b.whatsapp}</span>}
                      {b.phone && <span>📞 {b.phone}</span>}
                      {b.email && <span>✉️ {b.email}</span>}
                      {b.address && <span>🏠 {b.address}</span>}
                    </div>
                  </div>

                  {/* Reject inline prompt */}
                  {rejectingId === b.id ? (
                    <div className="w-full sm:w-64">
                      <label className="mb-1 block text-xs font-medium text-paroki-700">
                        Catatan penolakan
                      </label>
                      <textarea
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        rows={2}
                        placeholder="Alasan penolakan..."
                        className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handleReject(b.id)}
                          disabled={actingId === b.id}
                          className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actingId === b.id ? 'Memproses...' : 'Konfirmasi Tolak'}
                        </button>
                        <button
                          onClick={cancelReject}
                          className="rounded-lg border border-paroki-200 px-3 py-2 text-xs font-medium text-paroki-600 hover:bg-paroki-50"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => handleApprove(b.id)}
                        disabled={actingId === b.id}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actingId === b.id ? '⏳' : '✓'} Approve
                      </button>
                      <button
                        onClick={() => openRejectDialog(b.id)}
                        disabled={actingId === b.id}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─────────────────────────────── */}
      {/* Semua Listing tab */}
      {/* ─────────────────────────────── */}
      {activeTab === 'listing' && (
        <div>
          {allBiz.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-paroki-300 bg-white py-16 text-center">
              <div className="mb-3 text-5xl">📋</div>
              <p className="text-paroki-600">Belum ada usaha terdaftar.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-2xl border border-paroki-200 bg-white shadow-sm md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-paroki-200 bg-paroki-50 text-paroki-700">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Nama Usaha</th>
                        <th className="px-4 py-3 font-semibold">Kategori</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Featured</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-paroki-100">
                      {allBiz.map((b) => (
                        <tr key={b.id} className="hover:bg-paroki-50/50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-paroki-900">
                              {b.name}
                            </div>
                            <div className="text-xs text-paroki-400">
                              {b.owner_id.slice(0, 8)}...
                            </div>
                          </td>
                          <td className="px-4 py-3 text-paroki-600">
                            {b.category
                              ? `${b.category.icon} ${b.category.name}`
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={b.status} />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() =>
                                toggleFeatured(b.id, b.is_featured)
                              }
                              disabled={togglingId === b.id}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-60 ${
                                b.is_featured
                                  ? 'bg-paroki-600'
                                  : 'bg-paroki-200'
                              }`}
                              aria-label="Toggle featured"
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                  b.is_featured ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {allBiz.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-paroki-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-medium text-paroki-900">{b.name}</h3>
                        <p className="mt-0.5 text-xs text-paroki-500">
                          {b.category
                            ? `${b.category.icon} ${b.category.name}`
                            : 'Tanpa kategori'}
                        </p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-paroki-500">
                        Featured:
                      </span>
                      <button
                        onClick={() => toggleFeatured(b.id, b.is_featured)}
                        disabled={togglingId === b.id}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-60 ${
                          b.is_featured ? 'bg-paroki-600' : 'bg-paroki-200'
                        }`}
                        aria-label="Toggle featured"
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                            b.is_featured ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─────────────────────────────── */}
      {/* Kategori tab */}
      {/* ─────────────────────────────── */}
      {activeTab === 'kategori' && (
        <div className="space-y-6">
          {/* Add category form */}
          <div className="rounded-2xl border border-paroki-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-serif text-lg font-bold text-paroki-900">
              Tambah Kategori Baru
            </h3>
            <form onSubmit={handleAddCategory} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-paroki-700">
                  Nama Kategori
                </label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  required
                  placeholder="cth. Kuliner"
                  className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-paroki-700">
                  Ikon (emoji)
                </label>
                <input
                  type="text"
                  value={catIcon}
                  onChange={(e) => setCatIcon(e.target.value)}
                  placeholder="🍽️"
                  className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-paroki-700">
                  Urutan
                </label>
                <input
                  type="number"
                  value={catSort}
                  onChange={(e) => setCatSort(e.target.value)}
                  min="0"
                  className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={catSubmitting}
                  className="w-full rounded-lg bg-paroki-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {catSubmitting ? 'Menyimpan...' : '+ Tambah'}
                </button>
              </div>
            </form>
            {catName.trim() && (
              <p className="mt-2 text-xs text-paroki-400">
                Slug otomatis:{' '}
                <code className="rounded bg-paroki-50 px-1.5 py-0.5">
                  {catName
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '')}
                </code>
              </p>
            )}
          </div>

          {/* Category list */}
          <div className="rounded-2xl border border-paroki-200 bg-white shadow-sm">
            <div className="border-b border-paroki-100 px-5 py-3">
              <h3 className="font-serif text-sm font-bold text-paroki-900">
                Daftar Kategori ({categories.length})
              </h3>
            </div>
            {categories.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mb-2 text-3xl">🗂️</div>
                <p className="text-sm text-paroki-400">
                  Belum ada kategori.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-paroki-100">
                {categories.map((cat) => (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{cat.icon || '🏷️'}</span>
                      <div>
                        <div className="font-medium text-paroki-900">
                          {cat.name}
                        </div>
                        <div className="text-xs text-paroki-400">
                          /{cat.slug} · urutan {cat.sort_order}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Hapus
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────── */}
      {/* Wilayah & Lingkungan tab */}
      {/* ─────────────────────────────── */}
      {activeTab === 'wilayah' && (
        <div className="space-y-6">
          {/* ── Wilayah Section ── */}
          <div className="rounded-2xl border border-paroki-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-serif text-lg font-bold text-paroki-900">
              {editingWilId ? 'Edit Wilayah' : 'Tambah Wilayah Baru'}
            </h3>
            <form onSubmit={handleSubmitWilayah} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-paroki-700">
                  Nama Wilayah
                </label>
                <input
                  type="text"
                  value={wilName}
                  onChange={(e) => setWilName(e.target.value)}
                  required
                  placeholder="cth. Paroki Pusat"
                  className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-paroki-700">
                  Urutan
                </label>
                <input
                  type="number"
                  value={wilSort}
                  onChange={(e) => setWilSort(e.target.value)}
                  min="0"
                  className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                />
              </div>
              <div className="flex items-end gap-2 sm:col-span-3">
                <button
                  type="submit"
                  disabled={wilSubmitting}
                  className="rounded-lg bg-paroki-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {wilSubmitting
                    ? 'Menyimpan...'
                    : editingWilId
                      ? '💾 Simpan'
                      : '+ Tambah'}
                </button>
                {editingWilId && (
                  <button
                    type="button"
                    onClick={cancelEditWilayah}
                    className="rounded-lg border border-paroki-200 px-4 py-2 text-sm font-medium text-paroki-600 hover:bg-paroki-50"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Wilayah list */}
          <div className="rounded-2xl border border-paroki-200 bg-white shadow-sm">
            <div className="border-b border-paroki-100 px-5 py-3">
              <h3 className="font-serif text-sm font-bold text-paroki-900">
                Daftar Wilayah ({wilayahList.length})
              </h3>
            </div>
            {wilayahList.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mb-2 text-3xl">📍</div>
                <p className="text-sm text-paroki-400">Belum ada wilayah.</p>
              </div>
            ) : (
              <ul className="divide-y divide-paroki-100">
                {wilayahList.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📍</span>
                      <div>
                        <div className="font-medium text-paroki-900">
                          {w.name}
                        </div>
                        <div className="text-xs text-paroki-400">
                          urutan {w.sort_order}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditWilayah(w)}
                        className="rounded-lg border border-paroki-200 px-3 py-1.5 text-xs font-medium text-paroki-600 transition hover:bg-paroki-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteWilayah(w.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Hapus
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Lingkungan Section ── */}
          <div className="rounded-2xl border border-paroki-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-serif text-lg font-bold text-paroki-900">
              {editingLingId ? 'Edit Lingkungan' : 'Tambah Lingkungan Baru'}
            </h3>
            <form
              onSubmit={handleSubmitLingkungan}
              className="grid grid-cols-1 gap-3 sm:grid-cols-4"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-paroki-700">
                  Wilayah
                </label>
                <select
                  value={lingWilId}
                  onChange={(e) => setLingWilId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                >
                  <option value="">Pilih wilayah...</option>
                  {wilayahList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-paroki-700">
                  Nama Lingkungan
                </label>
                <input
                  type="text"
                  value={lingName}
                  onChange={(e) => setLingName(e.target.value)}
                  required
                  placeholder="cth. Lingkungan St. Maria"
                  className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-paroki-700">
                  Urutan
                </label>
                <input
                  type="number"
                  value={lingSort}
                  onChange={(e) => setLingSort(e.target.value)}
                  min="0"
                  className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                />
              </div>
              <div className="flex items-end gap-2 sm:col-span-4">
                <button
                  type="submit"
                  disabled={lingSubmitting}
                  className="rounded-lg bg-paroki-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {lingSubmitting
                    ? 'Menyimpan...'
                    : editingLingId
                      ? '💾 Simpan'
                      : '+ Tambah'}
                </button>
                {editingLingId && (
                  <button
                    type="button"
                    onClick={cancelEditLingkungan}
                    className="rounded-lg border border-paroki-200 px-4 py-2 text-sm font-medium text-paroki-600 hover:bg-paroki-50"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Lingkungan list grouped by wilayah */}
          {lingkunganList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-paroki-300 bg-white py-12 text-center">
              <div className="mb-2 text-3xl">🏘️</div>
              <p className="text-sm text-paroki-400">Belum ada lingkungan.</p>
            </div>
          ) : (
            wilayahList.map((w) => {
              const lings = lingkunganList.filter(
                (l) => l.wilayah_id === w.id,
              );
              return (
                <div
                  key={w.id}
                  className="rounded-2xl border border-paroki-200 bg-white shadow-sm"
                >
                  <div className="border-b border-paroki-100 px-5 py-3">
                    <h3 className="font-serif text-sm font-bold text-paroki-900">
                      📍 {w.name} ({lings.length})
                    </h3>
                  </div>
                  {lings.length === 0 ? (
                    <div className="py-6 text-center text-sm text-paroki-400">
                      Belum ada lingkungan di wilayah ini.
                    </div>
                  ) : (
                    <ul className="divide-y divide-paroki-100">
                      {lings.map((l) => (
                        <li
                          key={l.id}
                          className="flex items-center justify-between px-5 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">🏘️</span>
                            <div>
                              <div className="font-medium text-paroki-900">
                                {l.name}
                              </div>
                              <div className="text-xs text-paroki-400">
                                urutan {l.sort_order}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditLingkungan(l)}
                              className="rounded-lg border border-paroki-200 px-3 py-1.5 text-xs font-medium text-paroki-600 transition hover:bg-paroki-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteLingkungan(l.id)}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                            >
                              Hapus
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─────────────────────────────── */}
      {/* Verifikasi User tab */}
      {/* ─────────────────────────────── */}
      {activeTab === 'users' && (
        <div>
          {userList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-paroki-300 bg-white py-16 text-center">
              <div className="mb-3 text-5xl">👥</div>
              <p className="text-paroki-600">Belum ada user terdaftar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {userList.map((u) => (
                <div
                  key={u.id}
                  className="rounded-2xl border border-paroki-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {/* User info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-paroki-900">
                          {u.full_name || '(Tanpa nama)'}
                        </h3>
                        {/* Role badge */}
                        {(() => {
                          const role = u.role;
                          const roleConfig: Record<string, { label: string; cls: string }> = {
                            owner: { label: 'UMKM', cls: 'bg-green-100 text-green-800' },
                            member: { label: 'Anggota', cls: 'bg-blue-100 text-blue-800' },
                            admin: { label: 'Admin', cls: 'bg-amber-100 text-amber-800' },
                          };
                          const rc = role ? roleConfig[role] : null;
                          if (!rc) return null;
                          return (
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${rc.cls}`}>
                              {rc.label}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Contact details */}
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-paroki-500">
                        {u.phone && <span>📞 {u.phone}</span>}
                        <span className="font-mono opacity-60">ID: {u.id.slice(0, 8)}...</span>
                      </div>

                      {/* Verification info */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {/* Verification status badge */}
                        {(() => {
                          const vs = u.verification_status || 'unverified';
                          const vsConfig: Record<string, { label: string; cls: string }> = {
                            unverified: { label: 'Belum Verifikasi', cls: 'bg-gray-100 text-gray-600' },
                            pending: { label: 'Menunggu', cls: 'bg-yellow-100 text-yellow-800' },
                            verified: { label: 'Terverifikasi', cls: 'bg-green-100 text-green-800' },
                            rejected: { label: 'Ditolak', cls: 'bg-red-100 text-red-800' },
                          };
                          const vc = vsConfig[vs] || vsConfig.unverified;
                          return (
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${vc.cls}`}>
                              {vc.label}
                            </span>
                          );
                        })()}
                        {u.verification_type && (
                          <span className="rounded-full bg-paroki-100 px-2.5 py-0.5 text-xs font-medium text-paroki-700">
                            📄 {u.verification_type}
                          </span>
                        )}
                        {u.verified_at && (
                          <span className="text-xs text-paroki-400">
                            Diverifikasi: {new Date(u.verified_at).toLocaleDateString('id-ID')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons for pending/unverified */}
                    {(u.verification_status === 'pending' ||
                      u.verification_status === 'unverified' ||
                      !u.verification_status) && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => handleVerifyUser(u.id, 'verified')}
                          disabled={userVerifyingId === u.id}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {userVerifyingId === u.id ? '⏳' : '✓'} Verifikasi
                        </button>
                        <button
                          onClick={() => handleVerifyUser(u.id, 'rejected')}
                          disabled={userVerifyingId === u.id}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          ✕ Tolak
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────── */}
      {/* Ulasan (Reviews) tab */}
      {/* ─────────────────────────────── */}
      {activeTab === 'reviews' && (
        <div>
          {reviewList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-paroki-300 bg-white py-16 text-center">
              <div className="mb-3 text-5xl">⭐</div>
              <p className="text-paroki-600">Belum ada ulasan.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviewList.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-2xl border bg-white p-5 shadow-sm ${
                    r.is_visible ? 'border-paroki-200' : 'border-gray-200 opacity-70'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {/* Review content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-paroki-900">
                          {r.business?.name || '(Usaha tidak diketahui)'}
                        </h3>
                        {!r.is_visible && (
                          <span className="inline-block rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                            Disembunyikan
                          </span>
                        )}
                      </div>

                      {/* Reviewer + rating */}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-paroki-500">
                        <span>oleh {r.reviewer?.full_name || 'Anonim'}</span>
                        <span className="text-amber-500">
                          {'★'.repeat(Math.max(1, Math.min(5, r.rating)))}
                          {'☆'.repeat(Math.max(0, 5 - Math.max(1, Math.min(5, r.rating))))}
                        </span>
                        <span className="text-paroki-400">
                          {new Date(r.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      {/* Title + content */}
                      {r.title && (
                        <p className="mt-2 text-sm font-medium text-paroki-800">
                          {r.title}
                        </p>
                      )}
                      {r.content && (
                        <p className="mt-1 text-sm text-paroki-600">{r.content}</p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => toggleReviewVisibility(r.id, r.is_visible)}
                        disabled={reviewActionId === r.id}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          r.is_visible
                            ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                            : 'border-green-300 text-green-700 hover:bg-green-50'
                        }`}
                      >
                        {reviewActionId === r.id
                          ? '⏳'
                          : r.is_visible
                            ? '🙈 Sembunyikan'
                            : '👁️ Tampilkan'}
                      </button>
                      <button
                        onClick={() => handleDeleteReview(r.id)}
                        disabled={reviewActionId === r.id}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        🗑️ Hapus
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Stat card sub-component
// ─────────────────────────────────────────────
function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-xl border border-paroki-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-paroki-500">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="mt-1 text-2xl font-bold text-paroki-900">{value}</div>
    </div>
  );
}
