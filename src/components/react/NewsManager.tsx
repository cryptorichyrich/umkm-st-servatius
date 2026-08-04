import { useState, useEffect, useCallback, useRef } from 'react';
import { sanitizeHtml } from '../../lib/sanitize';
import {
  supabase,
} from '../../lib/supabase';
import {
  Newspaper,
  Tag,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  XCircle,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  Upload,
  Pin,
  X,
  Check,
} from 'lucide-react';
import WysiwygEditor from './WysiwygEditor';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type NewsStatus = 'draft' | 'published' | 'archived';

interface NewsCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
}

interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  status: NewsStatus;
  is_pinned: boolean;
  published_at: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  author_id: string | null;
  category_id: string | null;
  category?: NewsCategory | null;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove special chars
    .replace(/[\s_-]+/g, '-') // collapse spaces/underscores to hyphens
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────
function StatusBadge({ status }: { status: NewsStatus }) {
  const config: Record<NewsStatus, { label: string; cls: string }> = {
    draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-700' },
    published: { label: 'Dipublikasikan', cls: 'bg-green-100 text-green-800' },
    archived: { label: 'Diarsipkan', cls: 'bg-yellow-100 text-yellow-800' },
  };
  const c = config[status] || config.draft;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${c.cls}`}
    >
      {c.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function NewsManager() {
  // ── Auth ──
  const [authState, setAuthState] = useState<'loading' | 'denied' | 'ok'>(
    'loading',
  );

  // ── Mode ──
  const [mode, setMode] = useState<'list' | 'categories'>('list');

  // ── Data ──
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Filters ──
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // ── Detail modal ──
  const [detailArticle, setDetailArticle] = useState<NewsArticle | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // ── Edit form fields ──
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formSlugEdited, setFormSlugEdited] = useState(false);
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formExcerpt, setFormExcerpt] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCoverImage, setFormCoverImage] = useState('');
  const [formStatus, setFormStatus] = useState<NewsStatus>('draft');
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── "New article" state ──
  const [isNewArticle, setIsNewArticle] = useState(false);

  // ── Category form ──
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('');
  const [catSort, setCatSort] = useState('0');
  const [catSubmitting, setCatSubmitting] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // ───────────────────────────────────────────
  // Auth check
  // ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setAuthState('denied');
          return;
        }

        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileErr || !profile || profile.role !== 'admin') {
          setAuthState('denied');
          return;
        }

        setAuthState('ok');
      } catch {
        setAuthState('denied');
      }
    })();
  }, []);

  // ───────────────────────────────────────────
  // Fetch helpers
  // ───────────────────────────────────────────
  const fetchArticles = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('news')
      .select(
        `*, category:news_categories(id, name, slug, icon, sort_order, created_at)`,
      )
      .order('created_at', { ascending: false });
    if (err) {
      console.error('Fetch articles error:', err);
      setError('Gagal memuat artikel.');
    } else {
      setArticles((data || []) as unknown as NewsArticle[]);
    }
    setLoading(false);
  }, []);

  const fetchCategories = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('news_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (err) {
      console.error('Fetch categories error:', err);
    } else {
      setCategories((data || []) as NewsCategory[]);
    }
  }, []);

  // ── Load data after auth ──
  useEffect(() => {
    if (authState === 'ok') {
      fetchArticles();
      fetchCategories();
    }
  }, [authState, fetchArticles, fetchCategories]);

  // ───────────────────────────────────────────
  // Filtered articles (client-side filter for search + status)
  // ───────────────────────────────────────────
  const filteredArticles = articles.filter((a) => {
    if (search.trim() && !a.title.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (filterCategory && a.category_id !== filterCategory) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    return true;
  });

  // ───────────────────────────────────────────
  // Modal helpers
  // ───────────────────────────────────────────
  const openDetail = (a: NewsArticle) => {
    setDetailArticle(a);
    setEditMode(false);
    setDeleteConfirm(false);
    setIsNewArticle(false);
    // Reset form to this article's data
    setFormTitle(a.title);
    setFormSlug(a.slug);
    setFormSlugEdited(true);
    setFormCategoryId(a.category_id || '');
    setFormExcerpt(a.excerpt || '');
    setFormContent(a.content || '');
    setFormCoverImage(a.cover_image || '');
    setFormStatus(a.status);
    setFormIsPinned(a.is_pinned);
  };

  const openNewArticle = () => {
    setDetailArticle(null);
    setEditMode(true);
    setIsNewArticle(true);
    setDeleteConfirm(false);
    setFormTitle('');
    setFormSlug('');
    setFormSlugEdited(false);
    setFormCategoryId('');
    setFormExcerpt('');
    setFormContent('');
    setFormCoverImage('');
    setFormStatus('draft');
    setFormIsPinned(false);
  };

  const closeDetail = () => {
    setDetailArticle(null);
    setEditMode(false);
    setDeleteConfirm(false);
    setIsNewArticle(false);
    setError(null);
  };

  // ── Auto-generate slug from title ──
  useEffect(() => {
    if (!formSlugEdited && formTitle) {
      setFormSlug(slugify(formTitle));
    }
  }, [formTitle, formSlugEdited]);

  // ───────────────────────────────────────────
  // Image upload
  // ───────────────────────────────────────────
  const handleImageUpload = async (file: File) => {
    setImageUploading(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `news-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('article-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('article-images')
        .getPublicUrl(fileName);

      setFormCoverImage(urlData.publicUrl);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Gagal upload gambar: ${err.message}`
          : 'Gagal upload gambar.',
      );
    } finally {
      setImageUploading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  };

  // ───────────────────────────────────────────
  // Save article (create or update)
  // ───────────────────────────────────────────
  const handleSave = async () => {
    if (!formTitle.trim()) {
      setError('Judul tidak boleh kosong.');
      return;
    }
    if (!formSlug.trim()) {
      setError('Slug tidak boleh kosong.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        title: formTitle.trim(),
        slug: slugify(formSlug.trim()),
        excerpt: formExcerpt.trim() || null,
        content: formContent,
        cover_image: formCoverImage || null,
        category_id: formCategoryId || null,
        status: formStatus,
        is_pinned: formIsPinned,
      };

      // Set published_at when status changes to published
      if (formStatus === 'published' && !detailArticle?.published_at) {
        payload.published_at = new Date().toISOString();
      }

      if (isNewArticle || !detailArticle) {
        // Create
        const {
          data: { user },
        } = await supabase.auth.getUser();
        payload.author_id = user?.id || null;

        const { error: insertErr } = await supabase
          .from('news')
          .insert(payload);
        if (insertErr) throw insertErr;
      } else {
        // Update
        const { error: updateErr } = await supabase
          .from('news')
          .update(payload)
          .eq('id', detailArticle.id);
        if (updateErr) throw updateErr;
      }

      await fetchArticles();
      closeDetail();
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
  // Delete article
  // ───────────────────────────────────────────
  const handleDelete = async () => {
    if (!detailArticle) return;
    setDeleting(true);
    setError(null);
    try {
      const { error: delErr } = await supabase
        .from('news')
        .delete()
        .eq('id', detailArticle.id);
      if (delErr) throw delErr;

      await fetchArticles();
      closeDetail();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Gagal menghapus: ${err.message}`
          : 'Gagal menghapus artikel.',
      );
    } finally {
      setDeleting(false);
    }
  };

  // ───────────────────────────────────────────
  // Category CRUD
  // ───────────────────────────────────────────
  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setCatSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: catName.trim(),
        slug: slugify(catName.trim()),
        icon: catIcon.trim() || null,
        sort_order: parseInt(catSort) || 0,
      };

      if (editingCatId) {
        const { error: updErr } = await supabase
          .from('news_categories')
          .update(payload)
          .eq('id', editingCatId);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('news_categories')
          .insert(payload);
        if (insErr) throw insErr;
      }

      setCatName('');
      setCatIcon('');
      setCatSort('0');
      setEditingCatId(null);
      await fetchCategories();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Gagal menyimpan kategori: ${err.message}`
          : 'Gagal menyimpan kategori.',
      );
    } finally {
      setCatSubmitting(false);
    }
  };

  const handleCatEdit = (c: NewsCategory) => {
    setEditingCatId(c.id);
    setCatName(c.name);
    setCatIcon(c.icon || '');
    setCatSort(String(c.sort_order));
  };

  const handleCatCancel = () => {
    setEditingCatId(null);
    setCatName('');
    setCatIcon('');
    setCatSort('0');
  };

  const handleCatDelete = async (catId: string) => {
    // Check if any articles use this category
    const articleCount = articles.filter(
      (a) => a.category_id === catId,
    ).length;
    if (articleCount > 0) {
      setError(
        `Tidak dapat menghapus: masih ada ${articleCount} artikel dengan kategori ini.`,
      );
      return;
    }
    if (!window.confirm('Yakin ingin menghapus kategori ini?')) return;

    try {
      const { error: delErr } = await supabase
        .from('news_categories')
        .delete()
        .eq('id', catId);
      if (delErr) throw delErr;
      await fetchCategories();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Gagal menghapus: ${err.message}`
          : 'Gagal menghapus kategori.',
      );
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Auth states
  // ═══════════════════════════════════════════════════════════════
  if (authState === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-paroki-400" />
        <span className="ml-2 text-sm text-paroki-400">
          Memeriksa akses...
        </span>
      </div>
    );
  }

  if (authState === 'denied') {
    return null; // Show nothing if not admin
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER: Main panel
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">
      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Mode toggle ── */}
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-xl border border-paroki-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setMode('list')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === 'list'
                ? 'bg-paroki-600 text-white'
                : 'text-paroki-600 hover:bg-paroki-50'
            }`}
          >
            <Newspaper className="h-4 w-4" />
            Artikel
          </button>
          <button
            onClick={() => setMode('categories')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === 'categories'
                ? 'bg-paroki-600 text-white'
                : 'text-paroki-600 hover:bg-paroki-50'
            }`}
          >
            <Tag className="h-4 w-4" />
            Kategori
          </button>
        </div>

        {mode === 'list' && (
          <button
            onClick={openNewArticle}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-gold-600"
          >
            <Plus className="h-4 w-4" />
            Tulis Berita
          </button>
        )}
      </div>

      {/* ════ LIST MODE ════ */}
      {mode === 'list' && (
        <div>
          {/* ── Filters ── */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari judul berita..."
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-gray-400 focus:border-paroki-400"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-paroki-400"
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ''}
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-paroki-400"
            >
              <option value="">Semua Status</option>
              <option value="draft">Draft</option>
              <option value="published">Dipublikasikan</option>
              <option value="archived">Diarsipkan</option>
            </select>
          </div>

          {/* ── Loading ── */}
          {loading ? (
            <div className="animate-pulse space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl border border-paroki-100 bg-white"
                />
              ))}
            </div>
          ) : filteredArticles.length === 0 ? (
            /* ── Empty ── */
            <div className="rounded-xl border border-dashed border-paroki-300 bg-white py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-paroki-50 text-paroki-400">
                <Newspaper className="h-6 w-6" />
              </div>
              <p className="font-medium text-paroki-700">Belum ada berita</p>
              <p className="mt-1 text-sm text-paroki-400">
                Klik "Tulis Berita" untuk membuat artikel pertama.
              </p>
            </div>
          ) : (
            <>
              {/* ═══ Desktop table ═══ */}
              <div className="hidden overflow-hidden rounded-xl border border-paroki-200 bg-white shadow-sm md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-paroki-200 bg-paroki-50 text-paroki-700">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Judul</th>
                      <th className="px-4 py-3 font-semibold">Kategori</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Dilihat</th>
                      <th className="px-4 py-3 font-semibold">Tanggal</th>
                      <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paroki-100">
                    {filteredArticles.map((a) => (
                      <tr
                        key={a.id}
                        onClick={() => openDetail(a)}
                        className="cursor-pointer transition hover:bg-paroki-50/50"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {a.cover_image ? (
                              <div className="h-10 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                                <img
                                  src={a.cover_image}
                                  alt={a.title}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="flex h-10 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-paroki-50 text-paroki-300">
                                <ImageIcon className="h-4 w-4" />
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-paroki-900">
                                {a.title}
                              </span>
                              {a.is_pinned && (
                                <span className="ml-1.5 text-gold-500">
                                  📌
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-paroki-600">
                          {a.category
                            ? `${a.category.icon || ''} ${a.category.name}`.trim()
                            : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={a.status} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-paroki-500">
                            <Eye className="h-3.5 w-3.5" />
                            {a.view_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-paroki-500">
                          {formatDate(a.published_at || a.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(a);
                            }}
                            className="rounded-lg border border-paroki-200 px-2.5 py-1 text-xs font-medium text-paroki-600 transition hover:bg-paroki-50"
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ═══ Mobile cards ═══ */}
              <div className="space-y-3 md:hidden">
                {filteredArticles.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => openDetail(a)}
                    className="cursor-pointer rounded-xl border border-paroki-200 bg-white p-4 shadow-sm transition hover:border-paroki-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-paroki-900">
                          {a.title}
                          {a.is_pinned && <span className="ml-1.5">📌</span>}
                        </h3>
                        <p className="mt-0.5 text-xs text-paroki-500">
                          {a.category
                            ? `${a.category.icon || ''} ${a.category.name}`.trim()
                            : 'Tanpa kategori'}
                        </p>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-paroki-400">
                        {formatDate(a.published_at || a.created_at)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-paroki-400">
                        <Eye className="h-3 w-3" />
                        {a.view_count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ════ CATEGORIES MODE ════ */}
      {mode === 'categories' && (
        <div className="space-y-5">
          {/* Add/Edit form */}
          <form
            onSubmit={handleCatSubmit}
            className="rounded-xl border border-paroki-200 bg-white p-5 shadow-sm"
          >
            <h3 className="mb-3 flex items-center gap-2 font-bold text-paroki-900">
              <Tag className="h-4 w-4 text-paroki-500" />
              {editingCatId ? 'Edit Kategori' : 'Tambah Kategori Baru'}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-paroki-600">
                  Nama Kategori
                </label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="contoh: Pengumuman"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-paroki-400"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-paroki-600">
                  Ikon (emoji)
                </label>
                <input
                  type="text"
                  value={catIcon}
                  onChange={(e) => setCatIcon(e.target.value)}
                  placeholder="📢"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-paroki-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-paroki-600">
                  Urutan
                </label>
                <input
                  type="number"
                  value={catSort}
                  onChange={(e) => setCatSort(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-paroki-400"
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={catSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-paroki-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-paroki-700 disabled:opacity-60"
              >
                {catSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingCatId ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {editingCatId ? 'Simpan' : 'Tambah'}
              </button>
              {editingCatId && (
                <button
                  type="button"
                  onClick={handleCatCancel}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                >
                  Batal
                </button>
              )}
            </div>
          </form>

          {/* Category list */}
          {categories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-paroki-300 bg-white py-12 text-center">
              <p className="font-medium text-paroki-700">
                Belum ada kategori
              </p>
              <p className="mt-1 text-sm text-paroki-400">
                Tambahkan kategori untuk mengelompokkan berita.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-paroki-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-paroki-200 bg-paroki-50 text-paroki-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Kategori</th>
                    <th className="px-4 py-3 font-semibold">Slug</th>
                    <th className="px-4 py-3 font-semibold">Urutan</th>
                    <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-paroki-100">
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-paroki-50/50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-paroki-900">
                          {c.icon ? `${c.icon} ` : ''}
                          {c.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-paroki-50 px-1.5 py-0.5 text-xs text-paroki-600">
                          {c.slug}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-paroki-500">
                        {c.sort_order}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleCatEdit(c)}
                            className="inline-flex items-center gap-1 rounded-md border border-paroki-200 px-2.5 py-1.5 text-xs font-medium text-paroki-700 hover:bg-paroki-50"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleCatDelete(c.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════ */}
      {/* DETAIL / EDIT MODAL                          */}
      {/* ════════════════════════════════════════ */}
      {(detailArticle || isNewArticle) && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={closeDetail}
        >
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-paroki-100 bg-white px-5 py-3">
              <h3 className="font-bold text-paroki-900">
                {isNewArticle
                  ? 'Tulis Berita Baru'
                  : editMode
                    ? 'Edit Berita'
                    : 'Detail Berita'}
              </h3>
              <button
                onClick={closeDetail}
                className="rounded-lg p-1.5 text-paroki-400 hover:bg-paroki-50"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {/* ── Error inside modal ── */}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}

              {!editMode ? (
                /* ═══ VIEW MODE ═══ */
                <>
                  {/* Cover image */}
                  {detailArticle?.cover_image && (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <img
                        src={detailArticle.cover_image}
                        alt={detailArticle.title}
                        className="max-h-64 w-full object-cover"
                      />
                    </div>
                  )}

                  {/* Title + badges */}
                  <div>
                    <h4 className="text-lg font-bold text-paroki-900">
                      {detailArticle?.title}
                    </h4>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {detailArticle && (
                        <StatusBadge status={detailArticle.status} />
                      )}
                      {detailArticle?.is_pinned && (
                        <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-medium text-gold-700">
                          📌 Disematkan
                        </span>
                      )}
                      {detailArticle?.category && (
                        <span className="rounded-full bg-paroki-100 px-2.5 py-0.5 text-xs font-medium text-paroki-700">
                          {detailArticle.category.icon
                            ? `${detailArticle.category.icon} `
                            : ''}
                          {detailArticle.category.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Excerpt */}
                  {detailArticle?.excerpt && (
                    <div>
                      <span className="text-xs font-semibold uppercase text-paroki-400">
                        Ringkasan
                      </span>
                      <p className="mt-1 text-sm text-paroki-600">
                        {detailArticle.excerpt}
                      </p>
                    </div>
                  )}

                  {/* Content preview */}
                  {detailArticle?.content && (
                    <div>
                      <span className="text-xs font-semibold uppercase text-paroki-400">
                        Isi
                      </span>
                      <div
                        className="wysiwyg-content mt-1 max-h-48 overflow-y-auto rounded-lg border border-paroki-100 bg-gray-50 p-3 text-sm"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(detailArticle.content),
                        }}
                      />
                    </div>
                  )}

                  {/* Meta */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-paroki-400">Slug:</span>{' '}
                      <code className="rounded bg-paroki-50 px-1.5 py-0.5 text-xs text-paroki-600">
                        /berita/{detailArticle?.slug}
                      </code>
                    </div>
                    <div>
                      <span className="text-paroki-400">Dilihat:</span>{' '}
                      <span className="text-paroki-700">
                        {detailArticle?.view_count || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-paroki-400">Dibuat:</span>{' '}
                      <span className="text-paroki-700">
                        {formatDate(detailArticle?.created_at || null)}
                      </span>
                    </div>
                    <div>
                      <span className="text-paroki-400">Dipublikasi:</span>{' '}
                      <span className="text-paroki-700">
                        {formatDate(detailArticle?.published_at || null)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 border-t border-paroki-100 pt-4">
                    {detailArticle?.status === 'published' && (
                      <a
                        href={`/berita/${detailArticle.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-paroki-200 px-4 py-2 text-sm font-medium text-paroki-600 transition hover:bg-paroki-50"
                      >
                        <ExternalLink className="h-4 w-4" /> Lihat di Situs
                      </a>
                    )}
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex items-center gap-1.5 rounded-lg bg-paroki-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-paroki-700"
                    >
                      <Edit className="h-4 w-4" /> Edit
                    </button>
                    {!deleteConfirm ? (
                      <button
                        onClick={() => setDeleteConfirm(true)}
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 className="mr-1 inline h-4 w-4" /> Hapus
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-red-600">
                          Yakin?
                        </span>
                        <button
                          onClick={handleDelete}
                          disabled={deleting}
                          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                        >
                          {deleting ? 'Menghapus...' : 'Ya, Hapus'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(false)}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50"
                        >
                          Batal
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* ═══ EDIT MODE ═══ */
                <>
                  {/* Title */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-paroki-600">
                      Judul *
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Judul berita..."
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-ink outline-none focus:border-paroki-400"
                    />
                  </div>

                  {/* Slug */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-paroki-600">
                      Slug (URL)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">/berita/</span>
                      <input
                        type="text"
                        value={formSlug}
                        onChange={(e) => {
                          setFormSlug(e.target.value);
                          setFormSlugEdited(true);
                        }}
                        placeholder="judul-berita"
                        className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-paroki-400"
                      />
                      {formSlugEdited && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormSlugEdited(false);
                            setFormSlug(slugify(formTitle));
                          }}
                          className="whitespace-nowrap text-xs font-medium text-paroki-500 hover:text-paroki-700"
                        >
                          ↻ Auto
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Category + Status */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-paroki-600">
                        Kategori
                      </label>
                      <select
                        value={formCategoryId}
                        onChange={(e) => setFormCategoryId(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-paroki-400"
                      >
                        <option value="">— Tanpa kategori —</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.icon ? `${c.icon} ` : ''}
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-paroki-600">
                        Status
                      </label>
                      <select
                        value={formStatus}
                        onChange={(e) =>
                          setFormStatus(e.target.value as NewsStatus)
                        }
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-paroki-400"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Dipublikasikan</option>
                        <option value="archived">Diarsipkan</option>
                      </select>
                    </div>
                  </div>

                  {/* Excerpt */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-paroki-600">
                      Ringkasan (excerpt)
                    </label>
                    <textarea
                      value={formExcerpt}
                      onChange={(e) => setFormExcerpt(e.target.value)}
                      placeholder="Ringkasan singkat berita (opsional, tampil di daftar berita)..."
                      rows={2}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-paroki-400"
                    />
                  </div>

                  {/* Cover image upload */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-paroki-600">
                      Gambar Cover
                    </label>
                    <div className="flex items-start gap-3">
                      {formCoverImage && (
                        <div className="relative h-20 w-32 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200">
                          <img
                            src={formCoverImage}
                            alt="Cover"
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setFormCoverImage('')}
                            className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={onFileChange}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={imageUploading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-paroki-300 bg-paroki-50 px-4 py-2.5 text-sm font-medium text-paroki-600 transition hover:bg-paroki-100 disabled:opacity-60"
                        >
                          {imageUploading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Mengupload...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4" />
                              Upload Gambar
                            </>
                          )}
                        </button>
                        <p className="mt-1 text-xs text-gray-400">
                          Atau tempel URL gambar di bawah
                        </p>
                        <input
                          type="url"
                          value={formCoverImage}
                          onChange={(e) => setFormCoverImage(e.target.value)}
                          placeholder="https://..."
                          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-paroki-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Content WYSIWYG */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-paroki-600">
                      Isi Berita
                    </label>
                    <WysiwygEditor
                      value={formContent}
                      onChange={setFormContent}
                      placeholder="Tulis isi berita di sini..."
                    />
                  </div>

                  {/* Is pinned */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsPinned}
                      onChange={(e) => setFormIsPinned(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-paroki-600 focus:ring-paroki-500"
                    />
                    <span className="flex items-center gap-1 text-sm font-medium text-paroki-700">
                      <Pin className="h-4 w-4 text-gold-500" />
                      Sematkan berita (tampil di atas daftar)
                    </span>
                  </label>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 border-t border-paroki-100 pt-4">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-paroki-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-paroki-700 disabled:opacity-60"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      {saving ? 'Menyimpan...' : 'Simpan'}
                    </button>
                    <button
                      onClick={() => {
                        if (isNewArticle) {
                          closeDetail();
                        } else {
                          setEditMode(false);
                          // Restore form to original values
                          if (detailArticle) {
                            setFormTitle(detailArticle.title);
                            setFormSlug(detailArticle.slug);
                            setFormSlugEdited(true);
                            setFormCategoryId(
                              detailArticle.category_id || '',
                            );
                            setFormExcerpt(detailArticle.excerpt || '');
                            setFormContent(detailArticle.content);
                            setFormCoverImage(detailArticle.cover_image || '');
                            setFormStatus(detailArticle.status);
                            setFormIsPinned(detailArticle.is_pinned);
                          }
                          setError(null);
                        }
                      }}
                      className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
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
    </div>
  );
}
