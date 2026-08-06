import { useState, useEffect, useCallback, useMemo, lazy, Suspense, type FormEvent } from 'react';
import {
  ShieldCheck,
  Clock,
  CheckCircle,
  XCircle,
  Store,
  Search,
  MapPin,
  Package,
  Star,
  Users,
  FileText,
  ExternalLink,
  Inbox,
  AlertCircle,
  Flag,
  Eye,
  Newspaper,
} from 'lucide-react';
import {
  supabase,
  type Business,
  type Category,
  type BusinessStatus,
  type Wilayah,
  type Lingkungan,
  type Report,
  type ReportStatus,
} from '../../lib/supabase';
// Lazy-load heavy admin sub-components — only fetched when tab is opened
const BazarManager = lazy(() => import('./BazarManager'));
const NewsManager = lazy(() => import('./NewsManager'));
const BlogModeration = lazy(() => import('./BlogModeration'));

const TabFallback = () => (
  <div className="flex items-center justify-center py-20">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-paroki-200 border-t-paroki-600" />
  </div>
);

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
  email: string | null;
  phone: string | null;
  role: 'owner' | 'member' | 'admin' | null;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected' | null;
  verification_type: string | null;
  verified_at: string | null;
  created_at: string;
  has_nib: boolean | null;
  omset_range: string | null;
  biduk_number: string | null;
  has_pirt: boolean | null;
  has_halal: boolean | null;
  harapan_gabung: string | null;
  wilayah: string | null;
  lingkungan: string | null;
}

interface VerificationRequest {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  request_type: 'member' | 'umkm' | null;
  status: 'pending' | 'approved' | 'rejected';
  kk_gereja_url: string | null;
  ktp_url: string | null;
  catalog_url: string | null;
  owner_name: string | null;
  business_name: string | null;
  business_address: string | null;
  business_phone: string | null;
  category_id: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  biduk_number: string | null;
  wilayah: string | null;
  lingkungan: string | null;
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
  totalUsers: number;
  pendingVerifikasi: number;
}

// ─────────────────────────────────────────────
// Tab helpers
// ─────────────────────────────────────────────
type TabKey =
  | 'moderasi'
  | 'verifikasi'
  | 'listing'
  | 'kategori'
  | 'wilayah'
  | 'users'
  | 'reviews'
  | 'laporan'
  | 'bazar'
  | 'berita'
  | 'moderasi-blog';

const VALID_TABS: TabKey[] = [
  'moderasi',
  'verifikasi',
  'listing',
  'kategori',
  'wilayah',
  'users',
  'reviews',
  'laporan',
  'bazar',
  'berita',
  'moderasi-blog',
];

function getTabFromURL(): TabKey {
  if (typeof window === 'undefined') return 'moderasi';
  // Path-based routing: /admin/<tab> instead of /admin/?tab=<tab>
  // Also handles deep-links like /admin/bazar/{id} → tab='bazar'
  const segments = window.location.pathname.replace(/\/+$/, '').split('/');
  for (const seg of segments) {
    if (VALID_TABS.includes(seg as TabKey)) return seg as TabKey;
  }
  // Legacy: also check query param for backward compatibility
  const param = new URLSearchParams(window.location.search).get('tab');
  if (param && VALID_TABS.includes(param as TabKey)) return param as TabKey;
  return 'moderasi';
}

// ─────────────────────────────────────────────
// Role badge helper
// ─────────────────────────────────────────────
function RoleBadge({ role }: { role: string | null }) {
  if (!role) return null;
  const config: Record<string, { label: string; cls: string }> = {
    owner: { label: 'UMKM', cls: 'bg-paroki-100 text-paroki-800' },
    member: { label: 'Anggota', cls: 'bg-blue-100 text-blue-800' },
    admin: { label: 'Admin', cls: 'bg-gold-100 text-gold-800' },
  };
  const rc = config[role];
  if (!rc) return null;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${rc.cls}`}
    >
      {rc.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Verification status badge helper
// ─────────────────────────────────────────────
function VerificationStatusBadge({
  status,
}: {
  status: string | null;
}) {
  const vs = status || 'unverified';
  const config: Record<string, { label: string; cls: string }> = {
    unverified: { label: 'Belum Verifikasi', cls: 'bg-gray-100 text-gray-600' },
    pending: { label: 'Menunggu', cls: 'bg-yellow-100 text-yellow-800' },
    verified: { label: 'Terverifikasi', cls: 'bg-green-100 text-green-800' },
    rejected: { label: 'Ditolak', cls: 'bg-red-100 text-red-800' },
  };
  const vc = config[vs] || config.unverified;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${vc.cls}`}
    >
      {vc.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Verification request status badge
// ─────────────────────────────────────────────
function VerificationRequestBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Menunggu', cls: 'bg-yellow-100 text-yellow-800' },
    approved: { label: 'Disetujui', cls: 'bg-green-100 text-green-800' },
    rejected: { label: 'Ditolak', cls: 'bg-red-100 text-red-800' },
  };
  const vc = config[status] || config.pending;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${vc.cls}`}
    >
      {vc.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Empty state component
// ─────────────────────────────────────────────
function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-paroki-300 bg-white py-16 text-center">
      <div className="mb-3 flex justify-center">
        <Icon className="h-12 w-12 text-paroki-300" />
      </div>
      <p className="font-medium text-paroki-700">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-paroki-400">{description}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton loading component
// ─────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="rounded-2xl border border-paroki-200 bg-white p-5 shadow-sm">
      <div className="animate-pulse space-y-3">
        <div className="h-5 w-1/3 rounded bg-paroki-100" />
        <div className="h-4 w-2/3 rounded bg-paroki-100" />
        <div className="h-4 w-1/2 rounded bg-paroki-100" />
      </div>
    </div>
  );
}

function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Stat card sub-component
// ─────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-paroki-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-paroki-500">{label}</span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold text-paroki-900">{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Document thumbnail component
// ─────────────────────────────────────────────
function DocThumbnail({
  url,
  label,
}: {
  url: string;
  label: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
    >
      <div className="relative overflow-hidden rounded-xl border border-paroki-200 bg-paroki-50 transition group-hover:border-paroki-400">
        <img
          src={url}
          alt={label}
          className="h-24 w-full object-cover"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/10">
          <ExternalLink className="h-5 w-5 text-white opacity-0 transition group-hover:opacity-100" />
        </div>
      </div>
      <p className="mt-1 text-center text-xs font-medium text-paroki-600">
        {label}
      </p>
    </a>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function AdminPanel() {
  // ── Auth / loading ──
  const [authState, setAuthState] = useState<'loading' | 'denied' | 'ok'>('loading');
  const [loading, setLoading] = useState(true);

  // ── URL-based tab routing ──
  const [activeTab, setActiveTab] = useState<TabKey>(getTabFromURL());

  // ── Data ──
  const [pendingBiz, setPendingBiz] = useState<BusinessRow[]>([]);
  const [allBiz, setAllBiz] = useState<BusinessRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [verifRequests, setVerifRequests] = useState<VerificationRequest[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    total: 0,
    pending: 0,
    approved: 0,
    categories: 0,
    totalUsers: 0,
    pendingVerifikasi: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // ── UI state ──
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

  // ── Reports ──
  const [reports, setReports] = useState<Report[]>([]);
  const [reportActionId, setReportActionId] = useState<string | null>(null);
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'actioned' | 'dismissed'>('pending');

  // ── User data (redesigned) ──
  const [userList, setUserList] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userVerifyingId, setUserVerifyingId] = useState<string | null>(null);

  // ── User detail modal ──
  const [detailUser, setDetailUser] = useState<UserProfile | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailBusinesses, setDetailBusinesses] = useState<BusinessRow[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editVerifStatus, setEditVerifStatus] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  // ── Verification request actions ──
  const [verifActionId, setVerifActionId] = useState<string | null>(null);
  const [rejectingVerifId, setRejectingVerifId] = useState<string | null>(null);
  const [verifRejectNote, setVerifRejectNote] = useState('');
  // ── Verifikasi filters + sorting + profile detail ──
  const [verifFilterStatus, setVerifFilterStatus] = useState<string>('all');
  const [verifFilterType, setVerifFilterType] = useState<string>('all');
  const [verifSort, setVerifSort] = useState<string>('pending_first');
  const [verifProfileCache, setVerifProfileCache] = useState<Record<string, UserProfile | null>>({});
  const [verifExpandedId, setVerifExpandedId] = useState<string | null>(null);
  // ── Reject checklist reasons ──
  const REJECT_REASONS = [
    'Foto KK Gereja tidak jelas / blur',
    'KK Gereja tidak terbaca',
    'Bukan anggota Paroki St. Servatius',
    'Dokumen tidak lengkap',
    'Identitas tidak cocok dengan data pendaftaran',
    'Pengajuan duplikat / sudah pernah diverifikasi',
  ];
  const [verifRejectReasons, setVerifRejectReasons] = useState<Set<string>>(new Set());
  const [verifRejectCustom, setVerifRejectCustom] = useState('');

  // ── Reviews ──
  const [reviewList, setReviewList] = useState<ReviewRow[]>([]);
  const [reviewActionId, setReviewActionId] = useState<string | null>(null);

  // ── Listing CRUD: search, filter, detail modal ──
  const [listingSearch, setListingSearch] = useState('');
  const [listingStatusFilter, setListingStatusFilter] = useState<string>('all');
  const [listingCatFilter, setListingCatFilter] = useState<string>('all');
  const [detailBiz, setDetailBiz] = useState<BusinessRow | null>(null);
  const [bizEditMode, setBizEditMode] = useState(false);
  const [bizSaving, setBizSaving] = useState(false);
  const [bizDeleting, setBizDeleting] = useState(false);
  const [bizDeleteConfirm, setBizDeleteConfirm] = useState(false);
  // Edit form fields
  const [editBizName, setEditBizName] = useState('');
  const [editBizCat, setEditBizCat] = useState('');
  const [editBizArea, setEditBizArea] = useState('');
  const [editBizPhone, setEditBizPhone] = useState('');
  const [editBizWa, setEditBizWa] = useState('');
  const [editBizEmail, setEditBizEmail] = useState('');
  const [editBizAddr, setEditBizAddr] = useState('');
  const [editBizDesc, setEditBizDesc] = useState('');
  const [editBizStatus, setEditBizStatus] = useState<string>('approved');
  const [editBizFeatured, setEditBizFeatured] = useState(false);

  // ───────────────────────────────────────────
  // Tab URL sync
  // ───────────────────────────────────────────
  useEffect(() => {
    const onPop = () => setActiveTab(getTabFromURL());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // ───────────────────────────────────────────
  // Fetch helpers
  // ───────────────────────────────────────────
  const fetchPending = useCallback(async () => {
    const { data, error } = await supabase
      .from('businesses')
      .select(`*, category:categories(*), images:business_images(*)`)
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

  const fetchVerifRequests = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_admin_verification_requests');
    if (error) throw error;
    setVerifRequests((data || []) as VerificationRequest[]);
  }, []);

  const fetchReports = useCallback(async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    setReports((data || []) as Report[]);
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
    const { data, error } = await supabase.rpc('get_admin_profiles');
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
    (
      all: BusinessRow[],
      pending: BusinessRow[],
      cats: Category[],
      users: UserProfile[],
      verifReqs: VerificationRequest[],
    ) => {
      setStats({
        total: all.length,
        pending: pending.length,
        approved: all.filter((b) => b.status === 'approved').length,
        categories: cats.length,
        totalUsers: users.length,
        pendingVerifikasi: verifReqs.filter(
          (v) => v.status === 'pending',
        ).length,
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
          fetchVerifRequests(),
          fetchWilayah(),
          fetchLingkungan(),
          fetchUsers(),
          fetchReviews(),
          fetchReports(),
        ]);
      } catch (err) {
        console.error('Admin init error:', err);
        setError('Gagal memuat data. Silakan coba lagi.');
      } finally {
        setLoading(false);
      }
    })();
  }, [
    fetchPending,
    fetchAll,
    fetchCategories,
    fetchVerifRequests,
    fetchWilayah,
    fetchLingkungan,
    fetchUsers,
    fetchReviews,
    fetchReports,
  ]);

  // Recompute stats whenever data changes
  useEffect(() => {
    computeStats(allBiz, pendingBiz, categories, userList, verifRequests);
  }, [allBiz, pendingBiz, categories, userList, verifRequests, computeStats]);

  // ───────────────────────────────────────────
  // Actions: Business moderation
  // ───────────────────────────────────────────
  const handleApprove = async (businessId: string) => {
    setActingId(businessId);
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc('approve_business', {
        p_business_id: businessId,
      });
      if (rpcErr) throw rpcErr;
      // Clear re_review_reason on approve
      await supabase.from('businesses').update({ re_review_reason: null }).eq('id', businessId);
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

  // ───────────────────────────────────────────
  // Category actions
  // ───────────────────────────────────────────
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
  // User verification actions (from users tab)
  // ───────────────────────────────────────────
  const handleVerifyUser = async (
    userId: string,
    status: 'verified' | 'rejected' | 'unverified',
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
  // User detail modal
  // ───────────────────────────────────────────
  const openUserDetail = async (user: UserProfile) => {
    setDetailUser(user);
    setDetailLoading(true);
    setEditMode(false);
    setEditName(user.full_name || '');
    setEditPhone(user.phone || '');
    setEditRole(user.role || 'member');
    setEditVerifStatus(user.verification_status || 'unverified');

    // Fetch user's businesses
    try {
      const { data: biz } = await supabase
        .from('businesses')
        .select(`*, category:categories(name)`)
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      setDetailBusinesses((biz || []) as BusinessRow[]);
    } catch {
      setDetailBusinesses([]);
    }
    setDetailLoading(false);
  };

  const closeUserDetail = () => {
    setDetailUser(null);
    setEditMode(false);
    setDetailBusinesses([]);
  };

  const handleSaveProfile = async () => {
    if (!detailUser) return;
    setSavingProfile(true);
    setError(null);
    try {
      const updates: Record<string, string | null> = {};
      if (editName !== (detailUser.full_name || '')) updates.p_full_name = editName.trim() || null;
      if (editPhone !== (detailUser.phone || '')) updates.p_phone = editPhone.trim() || null;
      if (editRole !== (detailUser.role || 'member')) updates.p_role = editRole;
      if (editVerifStatus !== (detailUser.verification_status || 'unverified')) updates.p_verification_status = editVerifStatus;

      if (Object.keys(updates).length === 0) {
        setEditMode(false);
        setSavingProfile(false);
        return;
      }

      const { error: rpcErr } = await supabase.rpc('admin_update_profile', {
        p_user_id: detailUser.id,
        ...updates,
      });
      if (rpcErr) throw rpcErr;

      // Update local state
      const updated = { ...detailUser, full_name: editName, phone: editPhone, role: editRole as UserProfile['role'], verification_status: editVerifStatus as UserProfile['verification_status'] };
      setDetailUser(updated);
      setUserList(prev => prev.map(u => u.id === detailUser.id ? updated : u));
      setEditMode(false);
    } catch (err) {
      alert(err instanceof Error ? `Gagal menyimpan: ${err.message}` : 'Gagal menyimpan profil.');
    } finally {
      setSavingProfile(false);
    }
  };

  // ───────────────────────────────────────────
  // Admin impersonation — generates a Supabase magic link to log in as target user.
  // Saves admin session to localStorage so it can be restored with one click.
  // ───────────────────────────────────────────
  const handleImpersonate = async (userId: string, fullName: string) => {
    const ok = confirm(
      `Masuk sebagai "${fullName}"?\n\n` +
      `Anda akan melihat dashboard sebagai user ini. ` +
      `Klik tombol "Kembali ke Admin" untuk kembali ke sesi admin Anda.`,
    );
    if (!ok) return;

    setImpersonatingId(userId);
    try {
      // Save current admin page path so we can return here
      localStorage.setItem('impersonation_admin_path', window.location.pathname);

      // Save current admin session before switching
      const { data: { session: adminSession } } = await supabase.auth.getSession();
      if (adminSession) {
        localStorage.setItem('impersonation_admin_session', JSON.stringify({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
          expires_at: adminSession.expires_at,
        }));
      }

      const { data, error } = await supabase.functions.invoke('admin-impersonate', {
        body: { userId, redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Navigate to the magic link — Supabase verifies the token and redirects
      // to /dashboard with the target user's session tokens in the URL hash.
      window.location.href = data.magicLink;
    } catch (err) {
      // Clean up saved session on failure
      localStorage.removeItem('impersonation_admin_session');
      alert(
        err instanceof Error
          ? `Gagal impersonasi: ${err.message}`
          : 'Gagal melakukan impersonasi.',
      );
    } finally {
      setImpersonatingId(null);
    }
  };

  // ───────────────────────────────────────────
  const handleApproveVerif = async (req: VerificationRequest) => {
    setVerifActionId(req.id);
    setError(null);
    try {
      // Use approve_member_verification — copies BIDUK/wilayah/lingkungan to profiles
      const { error: rpcErr } = await supabase.rpc('approve_member_verification', {
        p_request_id: req.id,
      });
      if (rpcErr) throw rpcErr;
      await Promise.all([fetchVerifRequests(), fetchUsers()]);
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal menyetujui permintaan: ${err.message}`
          : 'Gagal menyetujui permintaan verifikasi.',
      );
    } finally {
      setVerifActionId(null);
    }
  };

  const openVerifReject = (reqId: string) => {
    setRejectingVerifId(reqId);
    setVerifRejectReasons(new Set());
    setVerifRejectCustom('');
    setVerifRejectNote('');
  };

  const cancelVerifReject = () => {
    setRejectingVerifId(null);
    setVerifRejectReasons(new Set());
    setVerifRejectCustom('');
    setVerifRejectNote('');
  };

  const toggleRejectReason = (reason: string) => {
    setVerifRejectReasons((prev) => {
      const next = new Set(prev);
      if (next.has(reason)) next.delete(reason);
      else next.add(reason);
      return next;
    });
  };

  const handleRejectVerif = async (req: VerificationRequest) => {
    // Combine checklist + custom note
    const reasons = Array.from(verifRejectReasons);
    if (verifRejectCustom.trim()) reasons.push(verifRejectCustom.trim());
    const note = reasons.length > 0 ? reasons.join('; ') : 'Permintaan verifikasi ditolak oleh admin.';
    setVerifActionId(req.id);
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc('verify_user', {
        p_user_id: req.user_id,
        p_status: 'rejected',
        p_note: note,
      });
      if (rpcErr) throw rpcErr;
      const { error: updateErr } = await supabase
        .from('verification_requests')
        .update({
          status: 'rejected',
          review_note: note,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', req.id);
      if (updateErr) throw updateErr;
      setRejectingVerifId(null);
      setVerifRejectReasons(new Set());
      setVerifRejectCustom('');
      setVerifRejectNote('');
      await Promise.all([fetchVerifRequests(), fetchUsers()]);
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal menolak permintaan: ${err.message}`
          : 'Gagal menolak permintaan verifikasi.',
      );
    } finally {
      setVerifActionId(null);
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

  // ── Report actions ──
  const handleReportAction = async (reportId: string, newStatus: ReportStatus) => {
    setReportActionId(reportId);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error: updErr } = await supabase
        .from('reports')
        .update({
          status: newStatus,
          reviewed_by: session?.user.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reportId);
      if (updErr) throw updErr;
      setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status: newStatus } : r));
    } catch (err) {
      alert(err instanceof Error ? `Gagal: ${err.message}` : 'Gagal memperbarui laporan.');
    } finally {
      setReportActionId(null);
    }
  };

  // ───────────────────────────────────────────
  // Computed: filtered + sorted verification requests
  // ───────────────────────────────────────────
  const sortedVerifRequests = useMemo(() => {
    let result = [...verifRequests];
    // Apply status filter
    if (verifFilterStatus !== 'all') {
      result = result.filter((r) => r.status === verifFilterStatus);
    }
    // Apply type filter
    if (verifFilterType !== 'all') {
      result = result.filter((r) => r.request_type === verifFilterType);
    }
    // Sort
    result.sort((a, b) => {
      if (verifSort === 'pending_first') {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (verifSort === 'unverified_first') {
        // Sort by user verification_status (unverified/pending first)
        const aUnverified = !a.status || a.status === 'pending' || a.status === 'rejected';
        const bUnverified = !b.status || b.status === 'pending' || b.status === 'rejected';
        if (aUnverified && !bUnverified) return -1;
        if (!aUnverified && bUnverified) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (verifSort === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      // newest (default)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return result;
  }, [verifRequests, verifFilterStatus, verifFilterType, verifSort]);

  // ───────────────────────────────────────────
  // Fetch user profile for verification request
  // ───────────────────────────────────────────
  const fetchVerifProfile = async (userId: string) => {
    if (verifProfileCache[userId] !== undefined) return;
    try {
      const { data, error } = await supabase.rpc('get_admin_user_detail', {
        p_user_id: userId,
      });
      if (!error && data && data.length > 0) {
        setVerifProfileCache((prev) => ({ ...prev, [userId]: data[0] as UserProfile }));
      } else {
        setVerifProfileCache((prev) => ({ ...prev, [userId]: null }));
      }
    } catch {
      setVerifProfileCache((prev) => ({ ...prev, [userId]: null }));
    }
  };

  const toggleVerifExpand = (reqId: string, userId: string) => {
    if (verifExpandedId === reqId) {
      setVerifExpandedId(null);
    } else {
      setVerifExpandedId(reqId);
      fetchVerifProfile(userId);
    }
  };

  // ───────────────────────────────────────────
  // Computed: filtered users (search)
  // ───────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return userList;
    const q = userSearch.toLowerCase().trim();
    return userList.filter((u) => {
      const name = (u.full_name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [userList, userSearch]);

  const userCounts = useMemo(() => {
    return {
      total: userList.length,
      verified: userList.filter((u) => u.verification_status === 'verified')
        .length,
      pending: userList.filter((u) => u.verification_status === 'pending')
        .length,
      unverified: userList.filter(
        (u) =>
          !u.verification_status || u.verification_status === 'unverified',
      ).length,
    };
  }, [userList]);

  // ───────────────────────────────────────────
  // Computed: filtered + searched listings
  // ───────────────────────────────────────────
  const filteredBiz = useMemo(() => {
    let result = allBiz;
    if (listingStatusFilter !== 'all') {
      result = result.filter((b) => b.status === listingStatusFilter);
    }
    if (listingCatFilter !== 'all') {
      result = result.filter((b) => b.category_id === listingCatFilter);
    }
    if (listingSearch.trim()) {
      const q = listingSearch.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.area || '').toLowerCase().includes(q) ||
          (b.description || '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [allBiz, listingStatusFilter, listingCatFilter, listingSearch]);

  // ───────────────────────────────────────────
  // Business detail / edit / delete
  // ───────────────────────────────────────────
  const openBizDetail = (biz: BusinessRow) => {
    setDetailBiz(biz);
    setBizEditMode(false);
    setBizDeleteConfirm(false);
    setEditBizName(biz.name || '');
    setEditBizCat(biz.category_id || '');
    setEditBizArea(biz.area || '');
    setEditBizPhone(biz.phone || '');
    setEditBizWa(biz.whatsapp || '');
    setEditBizEmail(biz.email || '');
    setEditBizAddr(biz.address || '');
    setEditBizDesc(biz.description || '');
    setEditBizStatus(biz.status);
    setEditBizFeatured(biz.is_featured);
  };

  const closeBizDetail = () => {
    setDetailBiz(null);
    setBizEditMode(false);
    setBizDeleteConfirm(false);
  };

  const handleSaveBiz = async () => {
    if (!detailBiz) return;
    setBizSaving(true);
    setError(null);
    try {
      const updates = {
        name: editBizName.trim(),
        category_id: editBizCat || null,
        area: editBizArea.trim() || null,
        phone: editBizPhone.trim() || null,
        whatsapp: editBizWa.trim() || null,
        email: editBizEmail.trim() || null,
        address: editBizAddr.trim() || null,
        description: editBizDesc.trim() || null,
        status: editBizStatus,
        is_featured: editBizFeatured,
      };
      const { error: updateErr } = await supabase
        .from('businesses')
        .update(updates)
        .eq('id', detailBiz.id);
      if (updateErr) throw updateErr;
      // Update local state
      const cat = categories.find((c) => c.id === editBizCat);
      const updated = {
        ...detailBiz,
        ...updates,
        category: cat,
      };
      setDetailBiz(updated);
      setAllBiz((prev) =>
        prev.map((b) => (b.id === detailBiz.id ? updated : b)),
      );
      // Update pending list if status changed
      if (editBizStatus === 'pending' && detailBiz.status !== 'pending') {
        setPendingBiz((prev) => [updated, ...prev]);
      } else if (detailBiz.status === 'pending' && editBizStatus !== 'pending') {
        setPendingBiz((prev) => prev.filter((b) => b.id !== detailBiz.id));
      }
      setBizEditMode(false);
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal menyimpan: ${err.message}`
          : 'Gagal menyimpan listing.',
      );
    } finally {
      setBizSaving(false);
    }
  };

  const handleDeleteBiz = async () => {
    if (!detailBiz) return;
    setBizDeleting(true);
    setError(null);
    try {
      // Delete related products first
      await supabase.from('products').delete().eq('business_id', detailBiz.id);
      // Delete business images
      await supabase
        .from('business_images')
        .delete()
        .eq('business_id', detailBiz.id);
      // Delete reviews
      await supabase
        .from('reviews')
        .delete()
        .eq('business_id', detailBiz.id);
      // Delete favorites
      await supabase
        .from('favorites')
        .delete()
        .eq('business_id', detailBiz.id);
      // Delete business
      const { error: delErr } = await supabase
        .from('businesses')
        .delete()
        .eq('id', detailBiz.id);
      if (delErr) throw delErr;
      setAllBiz((prev) => prev.filter((b) => b.id !== detailBiz.id));
      setPendingBiz((prev) => prev.filter((b) => b.id !== detailBiz.id));
      closeBizDetail();
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal menghapus: ${err.message}`
          : 'Gagal menghapus listing.',
      );
    } finally {
      setBizDeleting(false);
    }
  };

  // ───────────────────────────────────────────
  // Tab navigation config
  // ───────────────────────────────────────────
  const tabs: {
    key: TabKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { key: 'moderasi', label: 'Moderasi', icon: Clock, badge: pendingBiz.length },
    { key: 'verifikasi', label: 'Verifikasi', icon: ShieldCheck, badge: stats.pendingVerifikasi },
    { key: 'listing', label: 'Semua Listing', icon: Store },
    { key: 'kategori', label: 'Kategori', icon: Package },
    { key: 'wilayah', label: 'Wilayah & Lingkungan', icon: MapPin },
    { key: 'users', label: 'Pengguna', icon: Users },
    { key: 'reviews', label: 'Ulasan', icon: Star },
    { key: 'laporan', label: 'Laporan', icon: Flag },
    { key: 'bazar', label: 'Bazar', icon: Store },
    { key: 'berita', label: 'Berita', icon: Newspaper },
    { key: 'moderasi-blog', label: 'Moderasi Blog', icon: FileText },
  ];

  // ───────────────────────────────────────────
  // Render: Loading
  // ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-paroki-100" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-paroki-100" />
            ))}
          </div>
          <SkeletonCards count={4} />
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
        <div className="mb-4 flex justify-center">
          <AlertCircle className="h-16 w-16 text-red-400" />
        </div>
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
          Moderasi listing, verifikasi member, kelola kategori, dan fitur
          unggulan.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Stats summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Usaha"
          value={stats.total}
          icon={Store}
          color="bg-paroki-100 text-paroki-600"
        />
        <StatCard
          label="Pending Listing"
          value={stats.pending}
          icon={Clock}
          color="bg-yellow-100 text-yellow-700"
        />
        <StatCard
          label="Pending Verifikasi"
          value={stats.pendingVerifikasi}
          icon={ShieldCheck}
          color="bg-gold-100 text-gold-700"
        />
        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          icon={Users}
          color="bg-paroki-100 text-paroki-600"
        />
      </div>

      {/* Tab navigation */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-paroki-200">
        {tabs.map((tab) => (
          <a
            key={tab.key}
            href={`/admin/${tab.key}`}
            className={`relative -mb-px flex items-center gap-1.5 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              activeTab === tab.key
                ? 'border-paroki-600 text-paroki-700'
                : 'border-transparent text-paroki-500 hover:text-paroki-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-0.5 rounded-full bg-yellow-400 px-1.5 py-0.5 text-[10px] font-bold text-yellow-900">
                {tab.badge}
              </span>
            )}
          </a>
        ))}
      </div>

      {/* ─────────────────────────────── */}
      {/* Moderasi tab */}
      {/* ─────────────────────────────── */}
      {activeTab === 'moderasi' && (
        <div className="space-y-4">
          {pendingBiz.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="Tidak ada listing menunggu moderasi"
              description="Semua usaha sudah ditinjau."
            />
          ) : (
            pendingBiz.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-paroki-200 bg-white p-5 shadow-sm"
              >
                {/* Re-review badge */}
                {b.re_review_reason && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-gold-300 bg-gold-50 px-3 py-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-gold-600" />
                    <span className="text-xs font-semibold text-gold-800">
                      📸 Tinjau Ulang — {b.re_review_reason}
                    </span>
                  </div>
                )}
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
                      {b.area && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {b.area}
                        </span>
                      )}
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
                          {actingId === b.id
                            ? 'Memproses...'
                            : 'Konfirmasi Tolak'}
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
                        onClick={() => openBizDetail(b)}
                        className="flex items-center gap-1.5 rounded-lg border border-paroki-200 px-4 py-2 text-sm font-medium text-paroki-700 transition hover:bg-paroki-50"
                      >
                        <Eye className="h-4 w-4" />
                        Lihat
                      </button>
                      <button
                        onClick={() => handleApprove(b.id)}
                        disabled={actingId === b.id}
                        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actingId === b.id ? (
                          <Clock className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => openRejectDialog(b.id)}
                        disabled={actingId === b.id}
                        className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>

                {/* Owner / pengaju info */}
                {(() => {
                  const owner = userList.find((u) => u.id === b.owner_id);
                  const verifDoc = verifRequests.find((v) => v.user_id === b.owner_id);
                  const hasOwnerInfo = owner || verifDoc;
                  if (!hasOwnerInfo) return null;
                  return (
                    <div className="mt-4 rounded-xl border border-paroki-100 bg-paroki-50/50 p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-paroki-700">
                        <Users className="h-3.5 w-3.5" />
                        Data Pengaju
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 text-sm text-paroki-600 sm:grid-cols-2">
                        {owner && (
                          <>
                            <div>
                              <span className="text-xs text-paroki-400">Nama: </span>
                              <span className="font-semibold text-paroki-800">{owner.full_name || '(Tanpa nama)'}</span>
                            </div>
                            <div>
                              <span className="text-xs text-paroki-400">Telepon: </span>
                              <span className="font-medium">{owner.phone || '-'}</span>
                            </div>
                            <div>
                              <span className="text-xs text-paroki-400">Verifikasi: </span>
                              <VerificationStatusBadge status={owner.verification_status} />
                            </div>
                            {owner.biduk_number && (
                              <div>
                                <span className="text-xs text-paroki-400">BIDUK: </span>
                                <span className="font-semibold text-paroki-800">{owner.biduk_number}</span>
                              </div>
                            )}
                            {owner.wilayah && (
                              <div>
                                <span className="text-xs text-paroki-400">Wilayah: </span>
                                <span className="font-medium">{owner.wilayah}</span>
                              </div>
                            )}
                            {owner.lingkungan && (
                              <div>
                                <span className="text-xs text-paroki-400">Lingkungan: </span>
                                <span className="font-medium">{owner.lingkungan}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Verification documents from verifikasi request */}
                      {(verifDoc?.ktp_url || verifDoc?.kk_gereja_url || verifDoc?.catalog_url) && (
                        <div className="mt-3">
                          <div className="mb-1.5 text-xs font-medium text-paroki-500">Dokumen Verifikasi:</div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {verifDoc.kk_gereja_url && (
                              <DocThumbnail url={verifDoc.kk_gereja_url} label="KK Gereja" />
                            )}
                            {verifDoc.ktp_url && (
                              <DocThumbnail url={verifDoc.ktp_url} label="KTP" />
                            )}
                            {verifDoc.catalog_url && (
                              <DocThumbnail url={verifDoc.catalog_url} label="Katalog Produk" />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Business logo + images */}
                      {(b.logo_url || (b.images && b.images.length > 0)) && (
                        <div className="mt-3">
                          <div className="mb-1.5 text-xs font-medium text-paroki-500">Foto Usaha:</div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {b.logo_url && (
                              <DocThumbnail url={b.logo_url} label="Logo" />
                            )}
                            {b.images?.map((img) => (
                              <DocThumbnail key={img.id} url={img.image_url} label={img.caption || 'Foto'} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))
          )}
        </div>
      )}

      {/* ─────────────────────────────── */}
      {/* Verifikasi tab */}
      {/* ─────────────────────────────── */}
      {activeTab === 'verifikasi' && (
        <div className="space-y-4">
          {/* Filter + Sort bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={verifFilterStatus}
              onChange={(e) => setVerifFilterStatus(e.target.value)}
              className="rounded-lg border border-paroki-200 bg-white px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="pending">Menunggu</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
            </select>
            <select
              value={verifFilterType}
              onChange={(e) => setVerifFilterType(e.target.value)}
              className="rounded-lg border border-paroki-200 bg-white px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none"
            >
              <option value="all">Semua Tipe</option>
              <option value="member">Member</option>
              <option value="umkm">UMKM</option>
            </select>
            <select
              value={verifSort}
              onChange={(e) => setVerifSort(e.target.value)}
              className="rounded-lg border border-paroki-200 bg-white px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none"
            >
              <option value="pending_first">Urutkan: Menunggu Dahulu</option>
              <option value="unverified_first">Urutkan: Belum Terverifikasi Dahulu</option>
              <option value="newest">Urutkan: Terbaru</option>
              <option value="oldest">Urutkan: Terlama</option>
            </select>
            <span className="text-xs text-paroki-500">
              {sortedVerifRequests.length} dari {verifRequests.length} permintaan
            </span>
          </div>

          {sortedVerifRequests.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Tidak ada permintaan verifikasi"
              description={
                verifRequests.length === 0
                  ? 'Belum ada member yang mengajukan verifikasi.'
                  : 'Tidak ada permintaan yang cocok dengan filter.'
              }
            />
          ) : (
            sortedVerifRequests.map((req) => {
              const isPending = req.status === 'pending';
              const isExpanded = verifExpandedId === req.id;
              const profile = verifProfileCache[req.user_id];
              return (
                <div
                  key={req.id}
                  className="rounded-2xl border border-paroki-200 bg-white p-5 shadow-sm"
                >
                  {/* Header row */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-paroki-900">
                          {req.user_name || '(Tanpa nama)'}
                        </h3>
                        <VerificationRequestBadge status={req.status} />
                        {req.request_type && (
                          <span className="inline-block rounded-full bg-paroki-100 px-2.5 py-0.5 text-xs font-medium text-paroki-700">
                            {req.request_type === 'umkm' ? 'UMKM' : 'Member'}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-paroki-500">
                        {req.user_email && <span>✉️ {req.user_email}</span>}
                        <span className="text-paroki-400">
                          Diajukan:{' '}
                          {new Date(req.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                    {/* Expand profile button */}
                    <button
                      onClick={() => toggleVerifExpand(req.id, req.user_id)}
                      className="rounded-lg border border-paroki-200 px-3 py-1.5 text-xs font-medium text-paroki-600 transition hover:bg-paroki-50"
                    >
                      {isExpanded ? '▲ Sembunyikan Profil' : '▼ Lihat Profil User'}
                    </button>
                  </div>

                  {/* Member verification cross-check data */}
                  {(req.biduk_number || req.wilayah || req.lingkungan) && (
                    <div className="mt-3 rounded-xl border border-gold-200 bg-gold-50/40 p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-paroki-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Data Verifikasi Member
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 text-sm text-paroki-600 sm:grid-cols-3">
                        {req.biduk_number && (
                          <div>
                            <span className="text-xs text-paroki-400">No. BIDUK: </span>
                            <span className="font-semibold text-paroki-800">{req.biduk_number}</span>
                          </div>
                        )}
                        {req.wilayah && (
                          <div>
                            <span className="text-xs text-paroki-400">Wilayah: </span>
                            <span className="font-medium">{req.wilayah}</span>
                          </div>
                        )}
                        {req.lingkungan && (
                          <div>
                            <span className="text-xs text-paroki-400">Lingkungan: </span>
                            <span className="font-medium">{req.lingkungan}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Expanded user profile */}
                  {isExpanded && (
                    <div className="mt-3 rounded-xl border border-paroki-100 bg-paroki-50/50 p-4">
                      {profile === undefined ? (
                        <p className="text-xs text-paroki-400">Memuat profil...</p>
                      ) : profile ? (
                        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <span className="text-xs text-paroki-400">Nama Lengkap:</span>{' '}
                            <span className="font-medium text-paroki-700">{profile.full_name || '-'}</span>
                          </div>
                          <div>
                            <span className="text-xs text-paroki-400">Email:</span>{' '}
                            <span className="font-medium text-paroki-700">{profile.email || req.user_email || '-'}</span>
                          </div>
                          <div>
                            <span className="text-xs text-paroki-400">Telepon:</span>{' '}
                            <span className="font-medium text-paroki-700">{profile.phone || '-'}</span>
                          </div>
                          <div>
                            <span className="text-xs text-paroki-400">Role:</span>{' '}
                            <RoleBadge role={profile.role} />
                          </div>
                          <div>
                            <span className="text-xs text-paroki-400">Status Verifikasi:</span>{' '}
                            <VerificationStatusBadge status={profile.verification_status} />
                          </div>
                          <div>
                            <span className="text-xs text-paroki-400">Bergabung:</span>{' '}
                            <span className="text-paroki-700">
                              {new Date(profile.created_at).toLocaleDateString('id-ID')}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-paroki-400">Profil tidak ditemukan.</p>
                      )}
                    </div>
                  )}

                  {/* Documents */}
                  {(req.kk_gereja_url || req.ktp_url || req.catalog_url) && (
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {req.kk_gereja_url && (
                        <DocThumbnail url={req.kk_gereja_url} label="KK Gereja" />
                      )}
                      {req.ktp_url && (
                        <DocThumbnail url={req.ktp_url} label="KTP" />
                      )}
                      {req.catalog_url && (
                        <DocThumbnail url={req.catalog_url} label="Katalog" />
                      )}
                    </div>
                  )}

                  {/* Business details (if UMKM) */}
                  {(req.business_name ||
                    req.owner_name ||
                    req.business_address ||
                    req.business_phone) && (
                    <div className="mt-4 rounded-xl border border-paroki-100 bg-paroki-50/50 p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-paroki-700">
                        <Store className="h-3.5 w-3.5" />
                        Detail Usaha
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 text-sm text-paroki-600 sm:grid-cols-2">
                        {req.business_name && (
                          <div>
                            <span className="text-xs text-paroki-400">Nama Usaha: </span>
                            <span className="font-medium">{req.business_name}</span>
                          </div>
                        )}
                        {req.owner_name && (
                          <div>
                            <span className="text-xs text-paroki-400">Pemilik: </span>
                            <span className="font-medium">{req.owner_name}</span>
                          </div>
                        )}
                        {req.business_address && (
                          <div>
                            <span className="text-xs text-paroki-400">Alamat: </span>
                            <span>{req.business_address}</span>
                          </div>
                        )}
                        {req.business_phone && (
                          <div>
                            <span className="text-xs text-paroki-400">Telepon: </span>
                            <span>{req.business_phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Review note for rejected */}
                  {req.status === 'rejected' && req.review_note && (
                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <span className="font-medium">Catatan penolakan: </span>
                        {req.review_note}
                      </div>
                    </div>
                  )}

                  {/* Action buttons (only for pending) */}
                  {isPending && (
                    <div className="mt-4">
                      {rejectingVerifId === req.id ? (
                        <div className="rounded-xl border border-paroki-200 bg-paroki-50/50 p-4">
                          <label className="mb-2 block text-xs font-semibold text-paroki-700">
                            Pilih alasan penolakan:
                          </label>
                          <div className="space-y-1.5">
                            {REJECT_REASONS.map((reason) => (
                              <label
                                key={reason}
                                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-paroki-700 transition hover:bg-white"
                              >
                                <input
                                  type="checkbox"
                                  checked={verifRejectReasons.has(reason)}
                                  onChange={() => toggleRejectReason(reason)}
                                  className="h-4 w-4 rounded border-paroki-300 text-red-600 focus:ring-red-400"
                                />
                                {reason}
                              </label>
                            ))}
                          </div>
                          {/* Custom reason */}
                          <div className="mt-2">
                            <label className="mb-1 block text-xs font-medium text-paroki-700">
                              Alasan lain (opsional):
                            </label>
                            <textarea
                              value={verifRejectCustom}
                              onChange={(e) => setVerifRejectCustom(e.target.value)}
                              rows={2}
                              placeholder="Tulis alasan tambahan..."
                              className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                            />
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => handleRejectVerif(req)}
                              disabled={verifActionId === req.id || (verifRejectReasons.size === 0 && !verifRejectCustom.trim())}
                              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {verifActionId === req.id ? 'Memproses...' : 'Konfirmasi Tolak'}
                            </button>
                            <button
                              onClick={cancelVerifReject}
                              className="rounded-lg border border-paroki-200 px-3 py-2 text-xs font-medium text-paroki-600 hover:bg-paroki-50"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveVerif(req)}
                            disabled={verifActionId === req.id}
                            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {verifActionId === req.id ? (
                              <Clock className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            Setujui
                          </button>
                          <button
                            onClick={() => openVerifReject(req.id)}
                            disabled={verifActionId === req.id}
                            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <XCircle className="h-4 w-4" />
                            Tolak
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reviewed info for processed */}
                  {!isPending && req.reviewed_at && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-paroki-400">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Diproses pada:{' '}
                      {new Date(req.reviewed_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─────────────────────────────── */}
      {/* Semua Listing tab (CRUD) */}
      {/* ─────────────────────────────── */}
      {activeTab === 'listing' && (
        <div>
          {/* Search + filters */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paroki-400" />
              <input
                type="text"
                value={listingSearch}
                onChange={(e) => setListingSearch(e.target.value)}
                placeholder="Cari nama usaha, area, deskripsi..."
                className="w-full rounded-lg border border-paroki-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
              />
            </div>
            <select
              value={listingStatusFilter}
              onChange={(e) => setListingStatusFilter(e.target.value)}
              className="rounded-lg border border-paroki-200 bg-white px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="approved">Disetujui</option>
              <option value="pending">Menunggu</option>
              <option value="draft">Draft</option>
              <option value="rejected">Ditolak</option>
            </select>
            <select
              value={listingCatFilter}
              onChange={(e) => setListingCatFilter(e.target.value)}
              className="rounded-lg border border-paroki-200 bg-white px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none"
            >
              <option value="all">Semua Kategori</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Result count */}
          <p className="mb-3 text-xs text-paroki-500">
            Menampilkan {filteredBiz.length} dari {allBiz.length} usaha
          </p>

          {filteredBiz.length === 0 ? (
            <EmptyState
              icon={Store}
              title="Tidak ada usaha ditemukan"
              description={
                allBiz.length === 0
                  ? 'Belum ada usaha terdaftar.'
                  : 'Coba ubah filter atau kata kunci pencarian.'
              }
            />
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
                        <th className="px-4 py-3 font-semibold">Area</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Featured</th>
                        <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-paroki-100">
                      {filteredBiz.map((b) => (
                        <tr
                          key={b.id}
                          className="cursor-pointer hover:bg-paroki-50/50"
                          onClick={() => openBizDetail(b)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-paroki-900">
                              {b.name}
                            </div>
                            {b.whatsapp && (
                              <div className="text-xs text-paroki-400">
                                💬 {b.whatsapp}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-paroki-600">
                            {b.category
                              ? `${b.category.icon} ${b.category.name}`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-paroki-500">
                            {b.area || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={b.status} />
                          </td>
                          <td className="px-4 py-3">
                            {b.is_featured && (
                              <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-medium text-gold-700">
                                ★ Featured
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openBizDetail(b);
                                }}
                                className="rounded-lg border border-paroki-200 px-2.5 py-1 text-xs font-medium text-paroki-600 transition hover:bg-paroki-50"
                              >
                                Detail
                              </button>
                              <a
                                href={`/umkm/${b.slug}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-lg border border-paroki-200 px-2.5 py-1 text-xs font-medium text-paroki-600 transition hover:bg-paroki-50"
                              >
                                ↗ Lihat
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {filteredBiz.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => openBizDetail(b)}
                    className="cursor-pointer rounded-xl border border-paroki-200 bg-white p-4 shadow-sm transition hover:border-paroki-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-paroki-900">{b.name}</h3>
                        <p className="mt-0.5 text-xs text-paroki-500">
                          {b.category
                            ? `${b.category.icon} ${b.category.name}`
                            : 'Tanpa kategori'}
                          {b.area ? ` · ${b.area}` : ''}
                        </p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      {b.is_featured && (
                        <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-medium text-gold-700">
                          ★ Featured
                        </span>
                      )}
                      <span className="text-xs text-paroki-400">Ketuk untuk detail →</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Business detail / edit / delete modal — top-level so it works on ALL tabs */}
      {detailBiz && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
              onClick={closeBizDetail}
            >
              <div
                className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal header */}
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-paroki-100 bg-white px-5 py-3">
                  <h3 className="font-serif text-base font-bold text-paroki-900">
                    {bizEditMode ? 'Edit Listing' : 'Detail Listing'}
                  </h3>
                  <button
                    onClick={closeBizDetail}
                    className="rounded-lg p-1.5 text-paroki-400 hover:bg-paroki-50"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                  {!bizEditMode ? (
                    <>
                      {/* View mode */}
                      <div>
                        <h4 className="text-lg font-bold text-paroki-900">
                          {detailBiz.name}
                        </h4>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <StatusBadge status={detailBiz.status} />
                          {detailBiz.is_featured && (
                            <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-medium text-gold-700">
                              ★ Featured
                            </span>
                          )}
                          {detailBiz.category && (
                            <span className="rounded-full bg-paroki-100 px-2.5 py-0.5 text-xs font-medium text-paroki-700">
                              {detailBiz.category.icon} {detailBiz.category.name}
                            </span>
                          )}
                        </div>
                      </div>
                      {detailBiz.description && (
                        <p className="text-sm text-paroki-600">
                          {detailBiz.description}
                        </p>
                      )}
                      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                        {detailBiz.area && (
                          <div>
                            <span className="text-paroki-400">Area:</span>{' '}
                            <span className="text-paroki-700">{detailBiz.area}</span>
                          </div>
                        )}
                        {detailBiz.phone && (
                          <div>
                            <span className="text-paroki-400">Telepon:</span>{' '}
                            <span className="text-paroki-700">{detailBiz.phone}</span>
                          </div>
                        )}
                        {detailBiz.whatsapp && (
                          <div>
                            <span className="text-paroki-400">WhatsApp:</span>{' '}
                            <span className="text-paroki-700">{detailBiz.whatsapp}</span>
                          </div>
                        )}
                        {detailBiz.email && (
                          <div>
                            <span className="text-paroki-400">Email:</span>{' '}
                            <span className="text-paroki-700">{detailBiz.email}</span>
                          </div>
                        )}
                        {detailBiz.address && (
                          <div className="sm:col-span-2">
                            <span className="text-paroki-400">Alamat:</span>{' '}
                            <span className="text-paroki-700">{detailBiz.address}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-paroki-400">Dibuat:</span>{' '}
                          <span className="text-paroki-700">
                            {new Date(detailBiz.created_at).toLocaleDateString('id-ID')}
                          </span>
                        </div>
                        <div>
                          <span className="text-paroki-400">Slug:</span>{' '}
                          <code className="rounded bg-paroki-50 px-1.5 py-0.5 text-xs text-paroki-600">
                            /{detailBiz.slug}
                          </code>
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 border-t border-paroki-100 pt-4">
                        <a
                          href={`/umkm/${detailBiz.slug}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg border border-paroki-200 px-4 py-2 text-sm font-medium text-paroki-600 transition hover:bg-paroki-50"
                        >
                          <ExternalLink className="h-4 w-4" /> Lihat di Situs
                        </a>
                        <button
                          onClick={() => setBizEditMode(true)}
                          className="flex items-center gap-1.5 rounded-lg bg-paroki-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-paroki-700"
                        >
                          ✏️ Edit Listing
                        </button>
                        {!bizDeleteConfirm ? (
                          <button
                            onClick={() => setBizDeleteConfirm(true)}
                            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                          >
                            🗑️ Hapus
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-red-600">
                              Yakin?
                            </span>
                            <button
                              onClick={handleDeleteBiz}
                              disabled={bizDeleting}
                              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                            >
                              {bizDeleting ? 'Menghapus...' : 'Ya, Hapus'}
                            </button>
                            <button
                              onClick={() => setBizDeleteConfirm(false)}
                              className="rounded-lg border border-paroki-200 px-3 py-2 text-xs font-medium text-paroki-500"
                            >
                              Batal
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Edit mode */}
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-paroki-700">
                            Nama Usaha
                          </label>
                          <input
                            type="text"
                            value={editBizName}
                            onChange={(e) => setEditBizName(e.target.value)}
                            className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-paroki-700">
                              Kategori
                            </label>
                            <select
                              value={editBizCat}
                              onChange={(e) => setEditBizCat(e.target.value)}
                              className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none"
                            >
                              <option value="">Tanpa kategori</option>
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.icon} {cat.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-paroki-700">
                              Status
                            </label>
                            <select
                              value={editBizStatus}
                              onChange={(e) => setEditBizStatus(e.target.value)}
                              className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none"
                            >
                              <option value="approved">Disetujui</option>
                              <option value="pending">Menunggu</option>
                              <option value="draft">Draft</option>
                              <option value="rejected">Ditolak</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-paroki-700">
                            Area / Wilayah
                          </label>
                          <input
                            type="text"
                            value={editBizArea}
                            onChange={(e) => setEditBizArea(e.target.value)}
                            placeholder="cth. LINGKUNGAN ST. YOSEF"
                            className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-paroki-700">
                              Telepon
                            </label>
                            <input
                              type="text"
                              value={editBizPhone}
                              onChange={(e) => setEditBizPhone(e.target.value)}
                              className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-paroki-700">
                              WhatsApp
                            </label>
                            <input
                              type="text"
                              value={editBizWa}
                              onChange={(e) => setEditBizWa(e.target.value)}
                              className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-paroki-700">
                            Email
                          </label>
                          <input
                            type="text"
                            value={editBizEmail}
                            onChange={(e) => setEditBizEmail(e.target.value)}
                            className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-paroki-700">
                            Alamat
                          </label>
                          <input
                            type="text"
                            value={editBizAddr}
                            onChange={(e) => setEditBizAddr(e.target.value)}
                            className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-paroki-700">
                            Deskripsi
                          </label>
                          <textarea
                            value={editBizDesc}
                            onChange={(e) => setEditBizDesc(e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-paroki-200 px-3 py-2 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-paroki-700">
                          <input
                            type="checkbox"
                            checked={editBizFeatured}
                            onChange={(e) => setEditBizFeatured(e.target.checked)}
                            className="h-4 w-4 rounded border-paroki-300 text-paroki-600 focus:ring-paroki-400"
                          />
                          ★ Tampilkan sebagai Featured
                        </label>
                      </div>
                      {/* Save / Cancel */}
                      <div className="flex gap-2 border-t border-paroki-100 pt-4">
                        <button
                          onClick={handleSaveBiz}
                          disabled={bizSaving}
                          className="flex-1 rounded-lg bg-paroki-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-paroki-700 disabled:opacity-60"
                        >
                          {bizSaving ? 'Menyimpan...' : '💾 Simpan Perubahan'}
                        </button>
                        <button
                          onClick={() => setBizEditMode(false)}
                          className="rounded-lg border border-paroki-200 px-4 py-2 text-sm font-medium text-paroki-600 hover:bg-paroki-50"
                        >
                          Batal
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
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
            <form
              onSubmit={handleAddCategory}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
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
              <EmptyState icon={Package} title="Belum ada kategori" />
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
            <form
              onSubmit={handleSubmitWilayah}
              className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            >
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
              <EmptyState icon={MapPin} title="Belum ada wilayah" />
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
            <EmptyState icon={MapPin} title="Belum ada lingkungan" />
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
      {/* Pengguna (Users) tab — REDESIGNED */}
      {/* ─────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search bar + counts */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paroki-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Cari nama atau email..."
                className="w-full rounded-lg border border-paroki-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-paroki-400 focus:outline-none focus:ring-2 focus:ring-paroki-200"
              />
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-paroki-100 px-3 py-1 font-medium text-paroki-700">
                Total: {userCounts.total}
              </span>
              <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-800">
                Terverifikasi: {userCounts.verified}
              </span>
              <span className="rounded-full bg-yellow-100 px-3 py-1 font-medium text-yellow-800">
                Menunggu: {userCounts.pending}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-600">
                Belum: {userCounts.unverified}
              </span>
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title={userSearch.trim() ? 'Tidak ada hasil pencarian' : 'Belum ada user terdaftar'}
              description={
                userSearch.trim()
                  ? `Tidak ada user yang cocok dengan "${userSearch}"`
                  : 'User yang terdaftar akan muncul di sini.'
              }
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-2xl border border-paroki-200 bg-white shadow-sm md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-paroki-200 bg-paroki-50 text-paroki-700">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Nama</th>
                        <th className="px-4 py-3 font-semibold">Email</th>
                        <th className="px-4 py-3 font-semibold">Telepon</th>
                        <th className="px-4 py-3 font-semibold">Role</th>
                        <th className="px-4 py-3 font-semibold">Verifikasi</th>
                        <th className="px-4 py-3 font-semibold">Bergabung</th>
                        <th className="px-4 py-3 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-paroki-100">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="cursor-pointer hover:bg-paroki-50/50" onClick={() => openUserDetail(u)}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-paroki-900">
                              {u.full_name || '(Tanpa nama)'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-paroki-600">
                            {u.email || '-'}
                          </td>
                          <td className="px-4 py-3 text-paroki-600">
                            {u.phone || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <RoleBadge role={u.role} />
                          </td>
                          <td className="px-4 py-3">
                            <VerificationStatusBadge
                              status={u.verification_status}
                            />
                          </td>
                          <td className="px-4 py-3 text-xs text-paroki-500">
                            {u.created_at
                              ? new Date(u.created_at).toLocaleDateString(
                                  'id-ID',
                                  {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  },
                                )
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            {(u.verification_status === 'pending' ||
                              u.verification_status === 'unverified' ||
                              !u.verification_status) && (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() =>
                                    handleVerifyUser(u.id, 'verified')
                                  }
                                  disabled={userVerifyingId === u.id}
                                  className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Verifikasi
                                </button>
                                <button
                                  onClick={() =>
                                    handleVerifyUser(u.id, 'rejected')
                                  }
                                  disabled={userVerifyingId === u.id}
                                  className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Tolak
                                </button>
                              </div>
                            )}
                            {(u.verification_status === 'verified' ||
                              u.verification_status === 'rejected') && (
                              <button
                                onClick={() =>
                                  handleVerifyUser(u.id, 'unverified')
                                }
                                disabled={userVerifyingId === u.id}
                                className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Batalkan
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => openUserDetail(u)}
                    className="cursor-pointer rounded-2xl border border-paroki-200 bg-white p-4 shadow-sm transition hover:border-paroki-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-paroki-900">
                          {u.full_name || '(Tanpa nama)'}
                        </h3>
                        {u.email && (
                          <p className="mt-0.5 text-xs text-paroki-500">
                            {u.email}
                          </p>
                        )}
                        {u.phone && (
                          <p className="mt-0.5 text-xs text-paroki-500">
                            📞 {u.phone}
                          </p>
                        )}
                      </div>
                      <RoleBadge role={u.role} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <VerificationStatusBadge
                        status={u.verification_status}
                      />
                      {u.created_at && (
                        <span className="text-xs text-paroki-400">
                          Bergabung:{' '}
                          {new Date(u.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                    {(u.verification_status === 'pending' ||
                      u.verification_status === 'unverified' ||
                      !u.verification_status) && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleVerifyUser(u.id, 'verified')}
                          disabled={userVerifyingId === u.id}
                          className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {userVerifyingId === u.id
                            ? 'Memproses...'
                            : 'Verifikasi'}
                        </button>
                        <button
                          onClick={() => handleVerifyUser(u.id, 'rejected')}
                          disabled={userVerifyingId === u.id}
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Tolak
                        </button>
                      </div>
                    )}
                    {(u.verification_status === 'verified' ||
                      u.verification_status === 'rejected') && (
                      <button
                        onClick={() => handleVerifyUser(u.id, 'unverified')}
                        disabled={userVerifyingId === u.id}
                        className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Batalkan Verifikasi
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─────────────────────────────── */}
      {/* Ulasan (Reviews) tab */}
      {/* ─────────────────────────────── */}
      {activeTab === 'reviews' && (
        <div>
          {reviewList.length === 0 ? (
            <EmptyState
              icon={Star}
              title="Belum ada ulasan"
              description="Ulasan yang masuk akan muncul di sini."
            />
          ) : (
            <div className="space-y-3">
              {reviewList.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-2xl border bg-white p-5 shadow-sm ${
                    r.is_visible
                      ? 'border-paroki-200'
                      : 'border-gray-200 opacity-70'
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
                          {'☆'.repeat(
                            Math.max(0, 5 - Math.max(1, Math.min(5, r.rating))),
                          )}
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
                        <p className="mt-1 text-sm text-paroki-600">
                          {r.content}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() =>
                          toggleReviewVisibility(r.id, r.is_visible)
                        }
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

      {/* ─────────────────────────────────────────── */}
      {/* LAPORAN TAB */}
      {/* ─────────────────────────────────────────── */}
      {activeTab === 'laporan' && (
        <div>
          {/* Filter */}
          <div className="mb-4 flex flex-wrap gap-2">
            {([
              { v: 'pending', l: 'Menunggu' },
              { v: 'actioned', l: 'Ditindaklanjuti' },
              { v: 'dismissed', l: 'Dibatalkan' },
              { v: 'all', l: 'Semua' },
            ] as { v: typeof reportFilter; l: string }[]).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setReportFilter(opt.v)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  reportFilter === opt.v
                    ? 'bg-paroki-600 text-white'
                    : 'border border-paroki-200 bg-white text-paroki-600 hover:bg-paroki-50'
                }`}
              >
                {opt.l}
                {opt.v === 'pending' && reports.filter((r) => r.status === 'pending').length > 0 && (
                  <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-xs text-white">
                    {reports.filter((r) => r.status === 'pending').length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {reports.filter((r) => reportFilter === 'all' || r.status === reportFilter).length === 0 ? (
            <EmptyState
              icon={Flag}
              title="Tidak ada laporan"
              description="Laporan konten dari pengguna akan muncul di sini."
            />
          ) : (
            <div className="space-y-3">
              {reports
                .filter((r) => reportFilter === 'all' || r.status === reportFilter)
                .map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-2xl border bg-white p-5 shadow-sm ${
                      r.status === 'pending' ? 'border-red-200' : 'border-paroki-200 opacity-75'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        {/* Reason + target */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700">
                            {r.reason === 'adult' ? '🔞 Dewasa' :
                             r.reason === 'scam' ? '🦹 Penipuan' :
                             r.reason === 'spam' ? '📢 Spam' :
                             r.reason === 'offensive' ? '⚠️ Ofensif' :
                             r.reason === 'false_info' ? '❌ Info Palsu' :
                             '📝 Lainnya'}
                          </span>
                          <span className="text-xs text-paroki-500">
                            Target: <strong className="text-paroki-700">{r.target_type}</strong>
                          </span>
                          <span className="text-xs text-paroki-400">
                            {new Date(r.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {/* Detail */}
                        {r.detail && (
                          <p className="mt-2 text-sm text-paroki-600">{r.detail}</p>
                        )}
                        {/* Status */}
                        {r.status !== 'pending' && (
                          <p className="mt-1 text-xs text-paroki-400">
                            Status: {r.status === 'actioned' ? '✅ Ditindaklanjuti' : '⚪ Dibatalkan'}
                          </p>
                        )}
                      </div>
                      {/* Actions */}
                      {r.status === 'pending' && (
                        <div className="flex shrink-0 gap-2">
                          <button
                            onClick={() => handleReportAction(r.id, 'actioned')}
                            disabled={reportActionId === r.id}
                            className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 transition hover:bg-green-50 disabled:opacity-60"
                          >
                            ✅ Tindaklanjuti
                          </button>
                          <button
                            onClick={() => handleReportAction(r.id, 'dismissed')}
                            disabled={reportActionId === r.id}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
                          >
                            ⚪ Abaikan
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

      {/* ─────────────────────────────────────────── */}
      {/* BAZAR TAB */}
      {/* ─────────────────────────────────────────── */}
      {activeTab === 'bazar' && (
        <Suspense fallback={<TabFallback />}>
          <BazarManager />
        </Suspense>
      )}

      {/* ─────────────────────────────────────────── */}
      {/* BERITA TAB (Admin only) */}
      {/* ─────────────────────────────────────────── */}
      {activeTab === 'berita' && authState === 'ok' && (
        <Suspense fallback={<TabFallback />}>
          <NewsManager />
        </Suspense>
      )}

      {/* ─────────────────────────────────────────── */}
      {/* MODERASI BLOG TAB (Admin + Blogger) */}
      {/* ─────────────────────────────────────────── */}
      {activeTab === 'moderasi-blog' && authState === 'ok' && (
        <Suspense fallback={<TabFallback />}>
          <BlogModeration />
        </Suspense>
      )}

      {/* ─────────────────────────────────────────── */}
      {/* USER DETAIL MODAL */}
      {/* ─────────────────────────────────────────── */}
      {detailUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeUserDetail}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-paroki-200 bg-white px-6 py-4">
              <h2 className="font-serif text-lg font-bold text-paroki-900">
                Detail Pengguna
              </h2>
              <button
                onClick={closeUserDetail}
                className="rounded-lg p-1.5 text-paroki-400 transition hover:bg-paroki-50 hover:text-paroki-700"
                aria-label="Tutup"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              {/* Avatar + name */}
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-paroki-100 font-display text-lg font-bold text-paroki-700">
                  {(detailUser.full_name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  {editMode ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Nama lengkap"
                      className="w-full rounded-lg border border-paroki-300 px-3 py-1.5 text-sm focus:border-paroki-500 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                    />
                  ) : (
                    <h3 className="truncate font-display text-lg font-bold text-paroki-900">
                      {detailUser.full_name || '(Tanpa nama)'}
                    </h3>
                  )}
                  {detailUser.email && (
                    <p className="truncate text-sm text-paroki-500">{detailUser.email}</p>
                  )}
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Phone */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-paroki-500">Telepon</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="No. telepon"
                      className="w-full rounded-lg border border-paroki-300 px-3 py-1.5 text-sm focus:border-paroki-500 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                    />
                  ) : (
                    <p className="text-sm text-paroki-800">{detailUser.phone || '-'}</p>
                  )}
                </div>

                {/* Role */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-paroki-500">Role</label>
                  {editMode ? (
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full rounded-lg border border-paroki-300 px-3 py-1.5 text-sm focus:border-paroki-500 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                    >
                      <option value="member">Member</option>
                      <option value="owner">UMKM</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <RoleBadge role={detailUser.role} />
                  )}
                </div>

                {/* Verification status */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-paroki-500">Verifikasi</label>
                  {editMode ? (
                    <select
                      value={editVerifStatus}
                      onChange={(e) => setEditVerifStatus(e.target.value)}
                      className="w-full rounded-lg border border-paroki-300 px-3 py-1.5 text-sm focus:border-paroki-500 focus:outline-none focus:ring-2 focus:ring-paroki-200"
                    >
                      <option value="unverified">Belum Verifikasi</option>
                      <option value="pending">Menunggu</option>
                      <option value="verified">Terverifikasi</option>
                      <option value="rejected">Ditolak</option>
                    </select>
                  ) : (
                    <VerificationStatusBadge status={detailUser.verification_status} />
                  )}
                </div>

                {/* Joined date */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-paroki-500">Bergabung</label>
                  <p className="text-sm text-paroki-800">
                    {detailUser.created_at
                      ? new Date(detailUser.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                      : '-'}
                  </p>
                </div>

                {/* BIDUK number — member verification cross-check */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-paroki-500">No. BIDUK</label>
                  <p className="text-sm text-paroki-800">{detailUser.biduk_number || <span className="text-gray-400">Belum diisi</span>}</p>
                </div>

                {/* Wilayah */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-paroki-500">Wilayah</label>
                  <p className="text-sm text-paroki-800">{detailUser.wilayah || <span className="text-gray-400">Belum diisi</span>}</p>
                </div>

                {/* Lingkungan */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-paroki-500">Lingkungan</label>
                  <p className="text-sm text-paroki-800">{detailUser.lingkungan || <span className="text-gray-400">Belum diisi</span>}</p>
                </div>
              </div>

              {/* Harapan */}
              {detailUser.harapan_gabung && (
                <div className="rounded-lg bg-paroki-50 px-4 py-3">
                  <label className="mb-1 block text-xs font-medium text-paroki-500">Harapan Bergabung</label>
                  <p className="text-sm italic text-paroki-700">"{detailUser.harapan_gabung}"</p>
                </div>
              )}

              {/* User's businesses */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-paroki-500">
                  Usaha ({detailBusinesses.length})
                </h4>
                {detailLoading ? (
                  <div className="space-y-2">
                    <div className="h-12 animate-pulse rounded-lg bg-paroki-100" />
                  </div>
                ) : detailBusinesses.length === 0 ? (
                  <p className="rounded-lg bg-paroki-50 px-3 py-3 text-sm text-paroki-500">
                    Belum punya usaha terdaftar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detailBusinesses.map((b) => (
                      <a
                        key={b.id}
                        href={`/umkm/${b.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-lg border border-paroki-200 px-3 py-2 transition hover:bg-paroki-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-paroki-900">{b.name}</p>
                          <p className="text-xs text-paroki-500">
                            {b.category?.name || 'Tanpa kategori'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <StatusBadge status={b.status} />
                          <ExternalLink className="h-4 w-4 text-paroki-400" />
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 border-t border-paroki-100 pt-4">
                {editMode ? (
                  <>
                    <button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="flex-1 rounded-lg bg-paroki-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                    <button
                      onClick={() => setEditMode(false)}
                      disabled={savingProfile}
                      className="rounded-lg border border-paroki-200 px-4 py-2.5 text-sm font-medium text-paroki-600 transition hover:bg-paroki-50"
                    >
                      Batal
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex-1 rounded-lg border border-paroki-300 bg-white px-4 py-2.5 text-sm font-semibold text-paroki-700 transition hover:bg-paroki-50"
                    >
                      ✏️ Edit Profil
                    </button>
                    {(detailUser.verification_status === 'pending' ||
                      detailUser.verification_status === 'unverified' ||
                      !detailUser.verification_status) && (
                      <button
                        onClick={() => {
                          handleVerifyUser(detailUser.id, 'verified');
                          closeUserDetail();
                        }}
                        disabled={userVerifyingId === detailUser.id}
                        className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {userVerifyingId === detailUser.id ? '⏳' : '✓'} Verifikasi
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Impersonation — login as this user via magic link */}
              <button
                onClick={() => handleImpersonate(detailUser.id, detailUser.full_name || detailUser.email || 'User')}
                disabled={impersonatingId === detailUser.id}
                className="w-full rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {impersonatingId === detailUser.id ? '⏳ Membuat link...' : '🔑 Login sebagai user ini'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
