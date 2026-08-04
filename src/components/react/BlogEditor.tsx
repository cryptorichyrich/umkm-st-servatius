import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import {
  Plus,
  FileText,
  Image as ImageIcon,
  X,
  ArrowLeft,
  AlertCircle,
  Save,
  Send,
  Trash2,
  Edit3,
} from 'lucide-react';
import { supabase, type Category } from '../../lib/supabase';
import WysiwygEditor from './WysiwygEditor';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type BlogStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';

interface BlogPost {
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

interface BusinessOption {
  id: string;
  name: string;
  slug: string;
  category_id: string | null;
  category?: { name: string; slug: string };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractInternalLinks(html: string): Set<string> {
  const links = new Set<string>();
  const regex = /href="(\/[^"]*)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    links.add(match[1]);
  }
  return links;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const val of a) {
    if (!b.has(val)) return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────
function BlogStatusBadge({ status }: { status: BlogStatus }) {
  const styles: Record<BlogStatus, string> = {
    draft: 'bg-gray-100 text-gray-700',
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
    archived: 'bg-gray-100 text-gray-500',
  };
  const labels: Record<BlogStatus, string> = {
    draft: 'Draft',
    pending: 'Menunggu Review',
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
// Form data interface
// ─────────────────────────────────────────────
interface PostForm {
  id: string | null;
  business_id: string;
  category_id: string;
  title: string;
  excerpt: string;
  cover_image: string;
  content: string;
  status: BlogStatus;
}

const emptyForm: PostForm = {
  id: null,
  business_id: '',
  category_id: '',
  title: '',
  excerpt: '',
  cover_image: '',
  content: '',
  status: 'draft',
};

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function BlogEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [form, setForm] = useState<PostForm>(emptyForm);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [originalCoverImage, setOriginalCoverImage] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [originalStatus, setOriginalStatus] = useState<BlogStatus>('draft');
  const [reReviewBanner, setReReviewBanner] = useState(false);

  // ───────────────────────────────────────────
  // Initial load
  // ───────────────────────────────────────────
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
      await loadData(session.user.id);
    })();
  }, []);

  const loadData = async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch approved businesses owned by user
      const { data: bizData, error: bizErr } = await supabase
        .from('businesses')
        .select('id, name, slug, category_id, category:categories(name, slug)')
        .eq('owner_id', uid)
        .eq('status', 'approved')
        .order('name');

      if (bizErr) throw bizErr;
      setBusinesses((bizData || []) as unknown as BusinessOption[]);

      // Fetch all categories (for override dropdown)
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      setCategories((catData || []) as Category[]);

      // Fetch user's blog posts (all statuses)
      const bizIds = (bizData || []).map((b) => (b as { id: string }).id);
      let postData: BlogPost[] | null = null;
      if (bizIds.length > 0) {
        const { data: pd, error: postErr } = await supabase
          .from('blog_posts')
          .select(
            '*, business:businesses(id, name, slug), category:categories(id, name, slug)',
          )
          .in('business_id', bizIds)
          .order('updated_at', { ascending: false });

        if (postErr) throw postErr;
        postData = pd as BlogPost[];
      }
      setPosts(postData || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal memuat data.',
      );
    } finally {
      setLoading(false);
    }
  };

  // ───────────────────────────────────────────
  // Detect re-review need when form fields change
  // ───────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'form' || !form.id || originalStatus !== 'approved') {
      setReReviewBanner(false);
      return;
    }
    const coverChanged = form.cover_image !== originalCoverImage;
    const linksChanged = !setsEqual(
      extractInternalLinks(form.content),
      extractInternalLinks(originalContent),
    );
    setReReviewBanner(coverChanged || linksChanged);
  }, [form.cover_image, form.content, form.id, mode, originalStatus, originalCoverImage, originalContent]);

  // ───────────────────────────────────────────
  // Image upload
  // ───────────────────────────────────────────
  const handleCoverUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${userId}/cover-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('article-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadErr) throw uploadErr;

      const { data: pubData } = supabase.storage
        .from('article-images')
        .getPublicUrl(fileName);

      setForm((prev) => ({ ...prev, cover_image: pubData.publicUrl }));
    } catch (err) {
      setError(
        err instanceof Error
          ? `Gagal upload foto: ${err.message}`
          : 'Gagal upload foto.',
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const removeCover = () => {
    setForm((prev) => ({ ...prev, cover_image: '' }));
  };

  // ───────────────────────────────────────────
  // Auto-set category from selected business
  // ───────────────────────────────────────────
  const handleBusinessChange = (bizId: string) => {
    const biz = businesses.find((b) => b.id === bizId);
    setForm((prev) => ({
      ...prev,
      business_id: bizId,
      category_id: biz?.category_id || prev.category_id,
    }));
  };

  // ───────────────────────────────────────────
  // Start new post
  // ───────────────────────────────────────────
  const startNewPost = () => {
    setForm(emptyForm);
    setOriginalCoverImage('');
    setOriginalContent('');
    setOriginalStatus('draft');
    setReReviewBanner(false);
    setError(null);
    setMode('form');
  };

  // ───────────────────────────────────────────
  // Start editing existing post
  // ───────────────────────────────────────────
  const startEditPost = (post: BlogPost) => {
    setForm({
      id: post.id,
      business_id: post.business_id,
      category_id: post.category_id || '',
      title: post.title,
      excerpt: post.excerpt || '',
      cover_image: post.cover_image || '',
      content: post.content || '',
      status: post.status,
    });
    setOriginalCoverImage(post.cover_image || '');
    setOriginalContent(post.content || '');
    setOriginalStatus(post.status);
    setReReviewBanner(false);
    setError(null);
    setMode('form');
  };

  // ───────────────────────────────────────────
  // Validate
  // ───────────────────────────────────────────
  const validate = (): string | null => {
    if (!form.title.trim()) return 'Judul artikel wajib diisi.';
    if (!form.business_id) return 'Pilih UMKM untuk artikel ini.';
    if (!form.content.trim()) return 'Konten artikel wajib diisi.';
    return null;
  };

  // ───────────────────────────────────────────
  // Build payload
  // ───────────────────────────────────────────
  const buildPayload = (status: string, reReviewReason: string | null = null) => ({
    business_id: form.business_id,
    category_id: form.category_id || null,
    title: form.title.trim(),
    slug: slugify(form.title),
    excerpt: form.excerpt.trim(),
    cover_image: form.cover_image,
    content: form.content,
    status,
    re_review_reason: reReviewReason,
  });

  // ───────────────────────────────────────────
  // Save Draft
  // ───────────────────────────────────────────
  const handleSaveDraft = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // For approved posts, check if re-review needed
      let saveStatus: string = 'draft';
      let reReviewReason: string | null = null;

      if (form.id && originalStatus === 'approved') {
        const coverChanged = form.cover_image !== originalCoverImage;
        const linksChanged = !setsEqual(
          extractInternalLinks(form.content),
          extractInternalLinks(originalContent),
        );
        if (coverChanged || linksChanged) {
          saveStatus = 'approved';
          reReviewReason = coverChanged
            ? 'Perubahan foto sampul — perlu tinjauan ulang editor.'
            : 'Perubahan link internal — perlu tinjauan ulang editor.';
        } else {
          saveStatus = 'approved';
        }
      }

      if (form.id) {
        const { error: updateErr } = await supabase
          .from('blog_posts')
          .update(buildPayload(saveStatus, reReviewReason))
          .eq('id', form.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('blog_posts')
          .insert(buildPayload('draft', null));
        if (insertErr) throw insertErr;
      }

      await loadData(userId);
      setMode('list');
    } catch (err) {
      setError(
        err instanceof Error
          ? `Gagal menyimpan: ${err.message}`
          : 'Gagal menyimpan artikel.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ───────────────────────────────────────────
  // Submit for Review
  // ───────────────────────────────────────────
  const handleSubmitForReview = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let savedId = form.id;

      // Step 1: Save as draft first
      if (form.id) {
        const { error: updateErr } = await supabase
          .from('blog_posts')
          .update(buildPayload('draft', null))
          .eq('id', form.id);
        if (updateErr) throw updateErr;
        savedId = form.id;
      } else {
        const { data: insertData, error: insertErr } = await supabase
          .from('blog_posts')
          .insert(buildPayload('draft', null))
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        savedId = insertData.id;
      }

      if (!savedId) throw new Error('Gagal mendapatkan ID artikel');

      // Step 2: Call submit_blog_for_review RPC
      const { error: rpcErr } = await supabase.rpc('submit_blog_for_review', {
        p_post_id: savedId,
      });
      if (rpcErr) throw rpcErr;

      await loadData(userId);
      setMode('list');
    } catch (err) {
      setError(
        err instanceof Error
          ? `Gagal mengirim: ${err.message}`
          : 'Gagal mengirim artikel untuk review.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ───────────────────────────────────────────
  // Delete post
  // ───────────────────────────────────────────
  const handleDelete = async (post: BlogPost) => {
    if (!confirm(`Yakin ingin menghapus artikel "${post.title}"?`)) return;
    setError(null);
    try {
      const { error: delErr } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', post.id);
      if (delErr) throw delErr;
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (err) {
      setError(
        err instanceof Error
          ? `Gagal menghapus: ${err.message}`
          : 'Gagal menghapus artikel.',
      );
    }
  };

  // ───────────────────────────────────────────
  // Cancel form
  // ───────────────────────────────────────────
  const cancelForm = () => {
    setMode('list');
    setForm(emptyForm);
    setError(null);
    setReReviewBanner(false);
  };

  // ───────────────────────────────────────────
  // Loading state
  // ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-paroki-100" />
          <div className="h-24 rounded-2xl bg-paroki-100" />
          <div className="h-24 rounded-2xl bg-paroki-100" />
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────
  // No approved businesses
  // ───────────────────────────────────────────
  if (businesses.length === 0 && mode === 'list') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <EmptyState
          icon={FileText}
          title="Anda belum punya UMKM yang disetujui"
          description="Daftarkan UMKM terlebih dahulu untuk menulis artikel."
        />
        <div className="mt-4 text-center">
          <a
            href="/dashboard/baru"
            className="inline-block rounded-xl bg-paroki-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-paroki-700"
          >
            Daftarkan UMKM
          </a>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────
  // Form mode
  // ───────────────────────────────────────────
  if (mode === 'form') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Back button */}
        <button
          onClick={cancelForm}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-paroki-600 hover:text-paroki-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke daftar artikel
        </button>

        <h2 className="mb-6 text-2xl font-bold text-paroki-900">
          {form.id ? 'Edit Artikel' : 'Tulis Artikel Baru'}
        </h2>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Re-review warning banner */}
        {reReviewBanner && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span>
              Perubahan foto/link memerlukan tinjauan ulang oleh editor.
              Artikel tetap tersimpan, namun perubahan ini akan ditinjau sebelum tampil publik.
            </span>
          </div>
        )}

        {/* Rejection note display */}
        {form.id && originalStatus === 'rejected' && posts.find((p) => p.id === form.id)?.rejection_note && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-semibold text-red-700">
              Catatan penolakan:
            </p>
            <p className="mt-1 text-sm text-red-600">
              {posts.find((p) => p.id === form.id)?.rejection_note}
            </p>
          </div>
        )}

        <form className="space-y-5">
          {/* Business select */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-paroki-700">
              UMKM <span className="text-red-500">*</span>
            </label>
            <select
              value={form.business_id}
              onChange={(e) => handleBusinessChange(e.target.value)}
              required
              className="w-full rounded-lg border border-paroki-200 bg-white px-4 py-2.5 text-sm text-paroki-800 outline-none focus:border-paroki-500 focus:ring-2 focus:ring-paroki-200"
            >
              <option value="">Pilih UMKM…</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category — auto-set from UMKM, read-only */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-paroki-700">
              Kategori Artikel
            </label>
            {form.business_id ? (
              <div className="flex items-center gap-2 rounded-lg border border-paroki-200 bg-paroki-50/60 px-4 py-2.5 text-sm text-paroki-800">
                {(() => {
                  const biz = businesses.find((b) => b.id === form.business_id);
                  const cat = categories.find((c) => c.id === biz?.category_id);
                  return (
                    <>
                      <span className="text-base">{cat?.icon || '📦'}</span>
                      <span className="font-medium">{cat?.name || biz?.category?.name || 'Tanpa kategori'}</span>
                      <span className="ml-auto text-xs text-paroki-400">Otomatis dari kategori UMKM</span>
                    </>
                  );
                })()}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-paroki-200 bg-paroki-50/30 px-4 py-2.5 text-sm text-paroki-400">
                Pilih UMKM dulu untuk menentukan kategori artikel.
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-paroki-700">
              Judul Artikel <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Masukkan judul artikel…"
              required
              className="w-full rounded-lg border border-paroki-200 bg-white px-4 py-2.5 text-sm text-paroki-800 outline-none focus:border-paroki-500 focus:ring-2 focus:ring-paroki-200"
            />
            {form.title && (
              <p className="mt-1 text-xs text-paroki-400">
                Slug: {slugify(form.title)}
              </p>
            )}
          </div>

          {/* Excerpt */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-paroki-700">
              Ringkasan (Excerpt)
            </label>
            <textarea
              value={form.excerpt}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, excerpt: e.target.value }))
              }
              placeholder="Ringkasan singkat untuk card artikel…"
              rows={2}
              className="w-full rounded-lg border border-paroki-200 bg-white px-4 py-2.5 text-sm text-paroki-800 outline-none focus:border-paroki-500 focus:ring-2 focus:ring-paroki-200"
            />
          </div>

          {/* Cover image */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-paroki-700">
              Foto Sampul
            </label>
            {form.cover_image ? (
              <div className="relative inline-block">
                <img
                  src={form.cover_image}
                  alt="Preview"
                  className="h-32 w-48 rounded-xl border border-paroki-200 object-cover"
                />
                <button
                  type="button"
                  onClick={removeCover}
                  className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-paroki-200 bg-paroki-50 px-4 py-8 text-center transition hover:border-paroki-400 hover:bg-paroki-100 ${
                  uploadingImage ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                <ImageIcon className="mb-2 h-8 w-8 text-paroki-400" />
                <span className="text-sm font-medium text-paroki-600">
                  {uploadingImage ? 'Mengupload…' : 'Klik untuk upload foto sampul'}
                </span>
                <span className="mt-0.5 text-xs text-paroki-400">
                  JPG, PNG — maks 5MB
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Content (WYSIWYG) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-paroki-700">
              Konten Artikel <span className="text-red-500">*</span>
            </label>
            <WysiwygEditor
              value={form.content}
              onChange={(html) => setForm((prev) => ({ ...prev, content: html }))}
              placeholder="Tulis artikel Anda di sini…"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-paroki-300 bg-white px-6 py-2.5 text-sm font-semibold text-paroki-700 transition hover:bg-paroki-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Simpan Draft
            </button>
            <button
              type="button"
              onClick={handleSubmitForReview}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-paroki-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Kirim untuk Review
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ───────────────────────────────────────────
  // List mode
  // ───────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-paroki-900">Artikel Saya</h2>
        <button
          onClick={startNewPost}
          className="inline-flex items-center gap-2 rounded-xl bg-paroki-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-paroki-700"
        >
          <Plus className="h-4 w-4" />
          Tulis Artikel Baru
        </button>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Belum ada artikel"
          description={'Klik "Tulis Artikel Baru" untuk membuat artikel pertama Anda.'}
        />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="rounded-2xl border border-paroki-200 bg-white p-5 shadow-sm transition hover:border-paroki-300 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <BlogStatusBadge status={post.status} />
                    {post.re_review_reason && (
                      <span className="inline-block rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-medium text-gold-800 border border-gold-300">
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
                    <p className="mt-1.5 line-clamp-2 text-sm text-paroki-400">
                      {post.excerpt}
                    </p>
                  )}
                  {post.status === 'rejected' && post.rejection_note && (
                    <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                      <p className="text-xs font-semibold text-red-700">
                        Ditolak: {post.rejection_note}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    onClick={() => startEditPost(post)}
                    title="Edit"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-paroki-200 bg-white text-paroki-600 transition hover:bg-paroki-50"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(post)}
                    title="Hapus"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-500 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
