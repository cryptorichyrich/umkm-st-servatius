import { useState, useEffect, useMemo } from 'react';
import { sanitizeHtml } from '../../lib/sanitize';
import {
  Search,
  Inbox,
  CheckCircle,
  XCircle,
  Trash2,
  AlertCircle,
  FileText,
  X,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type BlogStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';

interface BlogPostRow {
  id: string;
  business_id: string;
  category_id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image: string;
  status: BlogStatus;
  rejection_note: string | null;
  re_review_reason: string | null;
  published_at: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  business?: { id: string; name: string; slug: string };
  category?: { id: string; name: string; slug: string };
}

type ViewMode = 'queue' | 'all';
type FilterMode = 'all' | 'pending' | 're-review' | 'rejected';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────
function StatusBadge({ status }: { status: BlogStatus }) {
  const styles: Record<BlogStatus, string> = {
    draft: 'bg-gray-100 text-gray-700',
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
    archived: 'bg-gray-100 text-gray-500',
  };
  const labels: Record<BlogStatus, string> = {
    draft: 'Draft',
    pending: 'Menunggu',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    archived: 'Arsip',
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
// Reject checklist reasons
// ─────────────────────────────────────────────
const REJECT_REASONS = [
  'Konten tidak sesuai dengan kategori UMKM',
  'Foto/gambar tidak jelas atau tidak pantas',
  'Terdapat link yang tidak relevan atau mencurigakan',
  'Konten terlalu singkat atau kurang informatif',
  'Terindikasi plagiarisme',
  'Lainnya (tulis alasan)',
];

// ─────────────────────────────────────────────
// Empty state
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
// Skeleton
// ─────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="rounded-2xl border border-paroki-200 bg-white p-5 shadow-sm">
      <div className="animate-pulse space-y-3">
        <div className="h-5 w-1/3 rounded bg-paroki-100" />
        <div className="h-4 w-2/3 rounded bg-paroki-100" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function BlogModeration() {
  const [authState, setAuthState] = useState<'loading' | 'denied' | 'ok'>('loading');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('queue');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [selectedPost, setSelectedPost] = useState<BlogPostRow | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReasons, setRejectReasons] = useState<Set<string>>(new Set());
  const [rejectCustom, setRejectCustom] = useState('');
  const [acting, setActing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ───────────────────────────────────────────
  // Auth check + data load
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

        // Verify admin or blogger role
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profileErr || !profile) {
          setAuthState('denied');
          setLoading(false);
          return;
        }

        if (profile.role !== 'admin' && profile.role !== 'blogger') {
          setAuthState('denied');
          setLoading(false);
          return;
        }

        setAuthState('ok');
        await fetchPosts();
      } catch (err) {
        console.error('BlogModeration init error:', err);
        setError('Gagal memuat data. Silakan coba lagi.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ───────────────────────────────────────────
  // Fetch posts
  // ───────────────────────────────────────────
  const fetchPosts = async () => {
    setError(null);
    try {
      // Fetch all posts with joins — we filter client-side for flexibility
      const { data, error: fetchErr } = await supabase
        .from('blog_posts')
        .select(
          '*, business:businesses(id, name, slug), category:categories(id, name, slug)',
        )
        .order('updated_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setPosts((data || []) as BlogPostRow[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal memuat artikel.',
      );
    }
  };

  // ───────────────────────────────────────────
  // Filtered posts
  // ───────────────────────────────────────────
  const filteredPosts = useMemo(() => {
    let result = [...posts];

    // View mode filter
    if (viewMode === 'queue') {
      result = result.filter(
        (p) =>
          p.status === 'pending' ||
          p.status === 'rejected' ||
          p.re_review_reason !== null,
      );
    }

    // Status filter
    if (filterMode !== 'all') {
      if (filterMode === 're-review') {
        result = result.filter((p) => p.re_review_reason !== null);
      } else {
        result = result.filter((p) => p.status === filterMode);
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.business?.name?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [posts, viewMode, filterMode, searchQuery]);

  // ───────────────────────────────────────────
  // Pending count for queue badge
  // ───────────────────────────────────────────
  const queueCount = useMemo(
    () =>
      posts.filter(
        (p) =>
          p.status === 'pending' ||
          p.status === 'rejected' ||
          p.re_review_reason !== null,
      ).length,
    [posts],
  );

  // ───────────────────────────────────────────
  // Modal helpers
  // ───────────────────────────────────────────
  const openModal = (post: BlogPostRow) => {
    setSelectedPost(post);
    setShowRejectForm(false);
    setRejectReasons(new Set());
    setRejectCustom('');
    setDeleteConfirm(false);
  };

  const closeModal = () => {
    setSelectedPost(null);
    setShowRejectForm(false);
    setRejectReasons(new Set());
    setRejectCustom('');
    setDeleteConfirm(false);
  };

  // ───────────────────────────────────────────
  // Approve
  // ───────────────────────────────────────────
  const handleApprove = async (postId: string) => {
    setActing(true);
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc('approve_blog_post', {
        p_post_id: postId,
      });
      if (rpcErr) throw rpcErr;
      // Clear re_review_reason
      await supabase
        .from('blog_posts')
        .update({ re_review_reason: null })
        .eq('id', postId);
      await fetchPosts();
      closeModal();
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal menyetujui: ${err.message}`
          : 'Gagal menyetujui artikel.',
      );
    } finally {
      setActing(false);
    }
  };

  // ───────────────────────────────────────────
  // Reject
  // ───────────────────────────────────────────
  const toggleRejectReason = (reason: string) => {
    setRejectReasons((prev) => {
      const next = new Set(prev);
      if (next.has(reason)) {
        next.delete(reason);
      } else {
        next.add(reason);
      }
      return next;
    });
  };

  const handleReject = async (postId: string) => {
    setActing(true);
    setError(null);
    try {
      // Build combined note
      const selectedReasons = REJECT_REASONS.filter((r) =>
        rejectReasons.has(r),
      );
      const reasons = [...selectedReasons];
      if (rejectCustom.trim()) {
        reasons.push(rejectCustom.trim());
      }
      const combinedNote =
        reasons.length > 0 ? reasons.join('; ') : 'Tidak memenuhi kriteria.';

      const { error: rpcErr } = await supabase.rpc('reject_blog_post', {
        p_post_id: postId,
        p_note: combinedNote,
      });
      if (rpcErr) throw rpcErr;
      await fetchPosts();
      closeModal();
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal menolak: ${err.message}`
          : 'Gagal menolak artikel.',
      );
    } finally {
      setActing(false);
    }
  };

  // ───────────────────────────────────────────
  // Delete (2-step confirm)
  // ───────────────────────────────────────────
  const handleDelete = async (postId: string) => {
    setDeleting(true);
    setError(null);
    try {
      const { error: delErr } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', postId);
      if (delErr) throw delErr;
      await fetchPosts();
      closeModal();
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal menghapus: ${err.message}`
          : 'Gagal menghapus artikel.',
      );
    } finally {
      setDeleting(false);
    }
  };

  // ───────────────────────────────────────────
  // Denied state
  // ───────────────────────────────────────────
  if (authState === 'denied') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
          <p className="font-semibold text-red-700">Akses Ditolak</p>
          <p className="mt-1 text-sm text-red-600">
            Halaman ini hanya tersedia untuk admin dan blogger.
          </p>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────
  // Loading state
  // ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-4 h-8 w-48 animate-pulse rounded bg-paroki-100" />
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-paroki-900">Moderasi Artikel</h2>
      </div>

      {/* View mode toggle */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setViewMode('queue')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
            viewMode === 'queue'
              ? 'bg-paroki-600 text-white'
              : 'border border-paroki-200 bg-white text-paroki-600 hover:bg-paroki-50'
          }`}
        >
          <Inbox className="h-4 w-4" />
          Antrian Moderasi
          {queueCount > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                viewMode === 'queue'
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {queueCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setViewMode('all')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
            viewMode === 'all'
              ? 'bg-paroki-600 text-white'
              : 'border border-paroki-200 bg-white text-paroki-600 hover:bg-paroki-50'
          }`}
        >
          <FileText className="h-4 w-4" />
          Semua Artikel
        </button>
      </div>

      {/* Search + Filter */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paroki-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul atau UMKM…"
            className="w-full rounded-xl border border-paroki-200 bg-white py-2.5 pl-10 pr-4 text-sm text-paroki-800 outline-none focus:border-paroki-500 focus:ring-2 focus:ring-paroki-200"
          />
        </div>
        <select
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value as FilterMode)}
          className="rounded-xl border border-paroki-200 bg-white px-4 py-2.5 text-sm font-medium text-paroki-700 outline-none focus:border-paroki-500"
        >
          <option value="all">Semua Status</option>
          <option value="pending">Menunggu</option>
          <option value="re-review">Tinjau Ulang</option>
          <option value="rejected">Ditolak</option>
        </select>
      </div>

      {/* Post list */}
      {filteredPosts.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Tidak ada artikel"
          description={
            viewMode === 'queue'
              ? 'Tidak ada artikel dalam antrian moderasi.'
              : 'Belum ada artikel yang dibuat.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => (
            <button
              key={post.id}
              onClick={() => openModal(post)}
              className="block w-full rounded-2xl border border-paroki-200 bg-white p-5 text-left shadow-sm transition hover:border-paroki-300 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <StatusBadge status={post.status} />
                    {post.re_review_reason && (
                      <span className="inline-block rounded-full border border-gold-300 bg-gold-100 px-2.5 py-0.5 text-xs font-medium text-gold-800">
                        📸 Tinjau Ulang
                      </span>
                    )}
                    <span className="text-xs text-paroki-400">
                      {formatDate(post.created_at)}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-paroki-900">
                    {post.title || '(Tanpa judul)'}
                  </h3>
                  <p className="mt-0.5 text-sm text-paroki-500">
                    {post.business?.name || '—'}
                    {post.category ? ` • ${post.category.name}` : ''}
                  </p>
                  {post.excerpt && (
                    <p className="mt-1 line-clamp-1 text-sm text-paroki-400">
                      {post.excerpt}
                    </p>
                  )}
                </div>
                <ChevronRight className="mt-1 h-5 w-5 flex-shrink-0 text-paroki-300" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ──────── Modal ──────── */}
      {selectedPost && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={closeModal}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-paroki-100 bg-white px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={selectedPost.status} />
                {selectedPost.re_review_reason && (
                  <span className="inline-block rounded-full border border-gold-300 bg-gold-100 px-2.5 py-0.5 text-xs font-medium text-gold-800">
                    📸 Tinjau Ulang
                  </span>
                )}
              </div>
              <button
                onClick={closeModal}
                className="flex h-9 w-9 items-center justify-center rounded-full text-paroki-400 transition hover:bg-paroki-50 hover:text-paroki-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-5">
              {/* Cover image */}
              {selectedPost.cover_image && (
                <img
                  src={selectedPost.cover_image}
                  alt={selectedPost.title}
                  className="mb-4 h-48 w-full rounded-xl object-cover"
                />
              )}

              {/* Title */}
              <h3 className="text-xl font-bold text-paroki-900">
                {selectedPost.title || '(Tanpa judul)'}
              </h3>

              {/* Meta info */}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-paroki-500">
                <span>
                  <span className="font-medium text-paroki-600">UMKM:</span>{' '}
                  {selectedPost.business?.name || '—'}
                </span>
                {selectedPost.category && (
                  <span>
                    <span className="font-medium text-paroki-600">Kategori:</span>{' '}
                    {selectedPost.category.name}
                  </span>
                )}
                <span>
                  <span className="font-medium text-paroki-600">Tanggal:</span>{' '}
                  {formatDate(selectedPost.created_at)}
                </span>
                <span>
                  <span className="font-medium text-paroki-600">Views:</span>{' '}
                  {selectedPost.view_count || 0}
                </span>
              </div>

              {/* Excerpt */}
              {selectedPost.excerpt && (
                <p className="mt-3 rounded-lg bg-paroki-50 px-4 py-2.5 text-sm italic text-paroki-600">
                  {selectedPost.excerpt}
                </p>
              )}

              {/* Rejection note */}
              {selectedPost.rejection_note && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
                    <XCircle className="h-4 w-4" />
                    Catatan Penolakan
                  </p>
                  <p className="mt-1 text-sm text-red-600">
                    {selectedPost.rejection_note}
                  </p>
                </div>
              )}

              {/* Re-review reason */}
              {selectedPost.re_review_reason && (
                <div className="mt-4 rounded-xl border border-gold-300 bg-gold-50 px-4 py-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-gold-800">
                    📸 Perlu Tinjau Ulang
                  </p>
                  <p className="mt-1 text-sm text-gold-700">
                    {selectedPost.re_review_reason}
                  </p>
                </div>
              )}

              {/* Content */}
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-paroki-600">
                  Konten Artikel:
                </p>
                <div
                  className="prose prose-sm max-w-none rounded-xl border border-paroki-100 bg-gray-50 px-4 py-3 wysiwyg-content"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(selectedPost.content || '<p class="text-paroki-400">Konten kosong</p>'),
                  }}
                />
              </div>

              {/* Reject form */}
              {showRejectForm && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-4">
                  <p className="mb-3 text-sm font-semibold text-red-700">
                    Pilih alasan penolakan:
                  </p>
                  <div className="space-y-2">
                    {REJECT_REASONS.map((reason) => (
                      <label
                        key={reason}
                        className="flex items-start gap-2 text-sm text-red-700"
                      >
                        <input
                          type="checkbox"
                          checked={rejectReasons.has(reason)}
                          onChange={() => toggleRejectReason(reason)}
                          className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-400"
                        />
                        <span>{reason}</span>
                      </label>
                    ))}
                  </div>
                  {rejectReasons.has('Lainnya (tulis alasan)') && (
                    <textarea
                      value={rejectCustom}
                      onChange={(e) => setRejectCustom(e.target.value)}
                      placeholder="Tulis alasan lainnya…"
                      rows={2}
                      className="mt-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-700 outline-none focus:border-red-400"
                    />
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleReject(selectedPost.id)}
                      disabled={acting}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      {acting ? 'Memproses…' : 'Konfirmasi Tolak'}
                    </button>
                    <button
                      onClick={() => setShowRejectForm(false)}
                      className="rounded-lg border border-paroki-200 bg-white px-4 py-2 text-sm font-medium text-paroki-600 transition hover:bg-paroki-50"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {/* Delete confirm */}
              {deleteConfirm && (
                <div className="mt-5 rounded-xl border border-red-300 bg-red-50 px-4 py-4">
                  <p className="text-sm font-semibold text-red-700">
                    Yakin ingin menghapus artikel ini secara permanen?
                  </p>
                  <p className="mt-1 text-xs text-red-500">
                    Tindakan ini tidak dapat dibatalkan.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleDelete(selectedPost.id)}
                      disabled={deleting}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? 'Menghapus…' : 'Ya, Hapus Permanen'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="rounded-lg border border-paroki-200 bg-white px-4 py-2 text-sm font-medium text-paroki-600 transition hover:bg-paroki-50"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer — action buttons */}
            {!showRejectForm && !deleteConfirm && (
              <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-paroki-100 bg-white px-5 py-4">
                <button
                  onClick={() => handleApprove(selectedPost.id)}
                  disabled={acting}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={acting}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Hapus
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
