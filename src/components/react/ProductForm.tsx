import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { ChevronDown, ImagePlus, Loader2, Save, X } from 'lucide-react';
import { supabase, ECOMMERCE_PLATFORMS } from '../../lib/supabase';
import WysiwygEditor from './WysiwygEditor';
import PhotoGalleryUploader from './PhotoGalleryUploader';

interface ProductFormProps {
  businessId: string;
  productId?: string;
  onSaved?: () => void;
  onCancel?: () => void;
}

interface ProductFormData {
  name: string;
  slug: string;
  description: string;
  price: string;
  price_note: string;
  product_type: string;
  image_url: string;
  is_available: boolean;
  rich_description: string;
  seo_title: string;
  seo_description: string;
  ecommerce_links: Record<string, string>;
}

const emptyForm: ProductFormData = {
  name: '',
  slug: '',
  description: '',
  price: '',
  price_note: '',
  product_type: 'produk',
  image_url: '',
  is_available: true,
  rich_description: '',
  seo_title: '',
  seo_description: '',
  ecommerce_links: {},
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // remove special chars
    .replace(/\s+/g, '-') // spaces → hyphens
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-|-$/g, ''); // trim leading/trailing hyphens
}

export default function ProductForm({ businessId, productId, onSaved, onCancel }: ProductFormProps) {
  const isEdit = Boolean(productId);

  const [form, setForm] = useState<ProductFormData>(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [showSeo, setShowSeo] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [userId, setUserId] = useState('');

  // ---- Fetch current user ID for storage path ----
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUserId(session.user.id);
    })();
  }, []);

  // ---- Fetch existing product if edit mode ----
  useEffect(() => {
    if (!productId) return;

    (async () => {
      setLoading(true);
      const { data: prod, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (prodErr) {
        setError('Gagal memuat data produk.');
        setLoading(false);
        return;
      }

      setForm({
        name: prod.name || '',
        slug: prod.slug || '',
        description: prod.description || '',
        price: prod.price != null ? String(prod.price) : '',
        price_note: prod.price_note || '',
        product_type: prod.product_type || 'produk',
        image_url: prod.image_url || '',
        is_available: prod.is_available ?? true,
        rich_description: prod.rich_description || '',
        seo_title: prod.seo_title || '',
        seo_description: prod.seo_description || '',
        ecommerce_links: prod.ecommerce_links || {},
      });
      setSlugManuallyEdited(true);

      // Fetch gallery images
      const { data: imgs } = await supabase
        .from('product_images')
        .select('image_url')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });
      setGalleryImages((imgs as { image_url: string }[])?.map((i) => i.image_url) || []);

      setLoading(false);
    })();
  }, [productId]);

  // ---- Auto-generate slug from name (only if user hasn't manually edited slug) ----
  useEffect(() => {
    if (!slugManuallyEdited) {
      setForm((prev) => ({ ...prev, slug: generateSlug(prev.name) }));
    }
  }, [form.name, slugManuallyEdited]);

  // ---- Handlers ----
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSlugChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSlugManuallyEdited(true);
    setForm((prev) => ({ ...prev, slug: e.target.value }));
  };

  const handleToggleAvailable = () => {
    setForm((prev) => ({ ...prev, is_available: !prev.is_available }));
  };

  const handleRichDescriptionChange = (html: string) => {
    setForm((prev) => ({ ...prev, rich_description: html }));
  };

  const handleEcommerceLinkChange = (platformKey: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      ecommerce_links: { ...prev.ecommerce_links, [platformKey]: value },
    }));
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError('Sesi berakhir. Silakan masuk kembali.');
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const userId = session.user.id;
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${userId}/products/product-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('business-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadErr) throw uploadErr;

      const { data: pubData } = supabase.storage
        .from('business-images')
        .getPublicUrl(fileName);

      setForm((prev) => ({ ...prev, image_url: pubData.publicUrl }));
    } catch (err) {
      setError(
        err instanceof Error
          ? `Gagal upload gambar: ${err.message}`
          : 'Gagal upload gambar.',
      );
    } finally {
      setUploadingImage(false);
    }
  };

  // ---- Build filtered ecommerce_links (only non-empty URLs) ----
  const buildEcommerceLinks = (): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(form.ecommerce_links)) {
      if (value && value.trim()) {
        result[key] = value.trim();
      }
    }
    return result;
  };

  // ---- Build payload for insert/update ----
  const buildPayload = () => {
    const slug = form.slug.trim() || generateSlug(form.name);
    return {
      business_id: businessId,
      name: form.name.trim(),
      slug,
      description: form.description.trim(),
      price: form.price ? Number(form.price) : null,
      price_note: form.price_note.trim(),
      product_type: form.product_type,
      image_url: form.image_url,
      is_available: form.is_available,
      rich_description: form.rich_description,
      seo_title: form.seo_title.trim(),
      seo_description: form.seo_description.trim(),
      ecommerce_links: buildEcommerceLinks(),
    };
  };

  // ---- Validate ----
  const validate = async (): Promise<string | null> => {
    if (!form.name.trim()) {
      return 'Nama produk wajib diisi.';
    }

    const slug = form.slug.trim() || generateSlug(form.name);
    if (!slug) {
      return 'Slug tidak valid.';
    }

    // Check slug uniqueness within the same business
    let query = supabase
      .from('products')
      .select('id')
      .eq('business_id', businessId)
      .eq('slug', slug);

    if (isEdit && productId) {
      query = query.neq('id', productId);
    }

    const { data: existing } = await query;
    if (existing && existing.length > 0) {
      return 'Slug sudah digunakan untuk produk lain di usaha ini. Gunakan slug yang berbeda.';
    }

    return null;
  };

  // ---- Save ----
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const validationError = await validate();
      if (validationError) {
        setError(validationError);
        setSaving(false);
        return;
      }

      if (isEdit && productId) {
        const { error: updateErr } = await supabase
          .from('products')
          .update(buildPayload())
          .eq('id', productId);
        if (updateErr) throw updateErr;

        // Sync gallery: delete old, insert new
        await supabase.from('product_images').delete().eq('product_id', productId);
        if (galleryImages.length > 0) {
          await supabase.from('product_images').insert(
            galleryImages.map((url, i) => ({
              product_id: productId,
              image_url: url,
              sort_order: i,
            }))
          );
        }
      } else {
        const { data: newProd, error: insertErr } = await supabase
          .from('products')
          .insert(buildPayload())
          .select('id')
          .single();
        if (insertErr) throw insertErr;

        // Insert gallery for new product
        if (newProd && galleryImages.length > 0) {
          await supabase.from('product_images').insert(
            galleryImages.map((url, i) => ({
              product_id: newProd.id,
              image_url: url,
              sort_order: i,
            }))
          );
        }
      }

      setSuccess('Produk berhasil disimpan!');
      if (onSaved) {
        onSaved();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal menyimpan produk.',
      );
    } finally {
      setSaving(false);
    }
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-paroki-100" />
          <div className="h-12 rounded-lg bg-paroki-100" />
          <div className="h-12 rounded-lg bg-paroki-100" />
          <div className="h-24 rounded-lg bg-paroki-100" />
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-lg border border-paroki-200 bg-white px-3 py-2.5 text-sm text-paroki-900 outline-none transition focus:border-paroki-500 focus:ring-2 focus:ring-paroki-200';
  const labelClass =
    'mb-1.5 block text-sm font-medium text-paroki-700';

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-6">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mb-3 inline-flex items-center gap-1 text-sm text-paroki-500 hover:text-paroki-700"
          >
            ← Kembali
          </button>
        )}
        <h1 className="font-serif text-2xl font-bold text-paroki-900">
          {isEdit ? 'Edit Produk' : 'Tambah Produk Baru'}
        </h1>
        <p className="mt-1 text-sm text-paroki-600">
          {isEdit
            ? 'Perbarui informasi produk/jasa Anda.'
            : 'Lengkapi formulir di bawah untuk menambahkan produk atau jasa.'}
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* ---- Section: Informasi Dasar ---- */}
        <div className="space-y-5">
          <h2 className="border-b border-paroki-100 pb-2 text-base font-semibold text-paroki-900">
            Informasi Produk
          </h2>

          {/* Name */}
          <div>
            <label htmlFor="name" className={labelClass}>
              Nama Produk <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={form.name}
              onChange={handleChange}
              placeholder="contoh: Keripik Singkong Asli"
              className={inputClass}
            />
          </div>

          {/* Slug */}
          <div>
            <label htmlFor="slug" className={labelClass}>
              Slug (URL)
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              value={form.slug}
              onChange={handleSlugChange}
              placeholder="otomatis-dari-nama"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-paroki-400">
              Otomatis dibuat dari nama. Bisa diedit manual.
            </p>
          </div>

          {/* Product type + Available toggle */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="product_type" className={labelClass}>
                Tipe Produk
              </label>
              <select
                id="product_type"
                name="product_type"
                value={form.product_type}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="produk">Produk</option>
                <option value="jasa">Jasa</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Ketersediaan
              </label>
              <button
                type="button"
                onClick={handleToggleAvailable}
                className="flex w-full items-center justify-between rounded-lg border border-paroki-200 bg-white px-3 py-2.5 text-sm transition hover:bg-paroki-50"
              >
                <span className="font-medium text-paroki-700">
                  {form.is_available ? 'Tersedia' : 'Tidak Tersedia'}
                </span>
                <span
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    form.is_available ? 'bg-green-500' : 'bg-paroki-200'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      form.is_available ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>

          {/* Price + Price note */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="price" className={labelClass}>
                Harga
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-paroki-400">
                  Rp
                </span>
                <input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="0"
                  className={`${inputClass} pl-9`}
                />
              </div>
              <p className="mt-1 text-xs text-paroki-400">
                Kosongkan jika harga variabel/nego.
              </p>
            </div>

            <div>
              <label htmlFor="price_note" className={labelClass}>
                Keterangan Harga
              </label>
              <input
                id="price_note"
                name="price_note"
                type="text"
                value={form.price_note}
                onChange={handleChange}
                placeholder="contoh: per kg, per box, per lusin"
                className={inputClass}
              />
            </div>
          </div>

          {/* Image upload */}
          <div>
            <label className={labelClass}>Gambar Produk Utama</label>
            <div className="flex items-center gap-4">
              {form.image_url ? (
                <img
                  src={form.image_url}
                  alt="Produk"
                  className="h-20 w-20 rounded-xl border border-paroki-200 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-paroki-300 bg-paroki-50 text-paroki-300">
                  <ImagePlus className="h-7 w-7" />
                </div>
              )}
              <div>
                <label
                  htmlFor="product-image"
                  className="inline-flex cursor-pointer items-center rounded-lg border border-paroki-200 bg-white px-4 py-2 text-sm font-medium text-paroki-700 hover:bg-paroki-50"
                >
                  {uploadingImage ? 'Mengupload...' : 'Pilih File'}
                </label>
                <input
                  id="product-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
                <p className="mt-1 text-xs text-paroki-400">
                  Format: JPG, PNG. Maks 2MB.
                </p>
              </div>
            </div>
          </div>

          {/* Gallery photos */}
          {userId && (
            <PhotoGalleryUploader
              bucket="product-images"
              folder={userId}
              images={galleryImages}
              onChange={setGalleryImages}
              max={6}
              label="Galeri Foto Produk"
            />
          )}

          {/* Short description */}
          <div>
            <label htmlFor="description" className={labelClass}>
              Deskripsi Singkat
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={300}
              value={form.description}
              onChange={handleChange}
              placeholder="Deskripsi singkat untuk kartu produk dan listing (maks 300 karakter)..."
              className={inputClass}
            />
            <p className="mt-1 text-right text-xs text-paroki-400">
              {form.description.length}/300
            </p>
          </div>
        </div>

        {/* ---- Section: Rich Description (WYSIWYG) ---- */}
        <div className="space-y-3">
          <h2 className="border-b border-paroki-100 pb-2 text-base font-semibold text-paroki-900">
            Deskripsi Produk (Detail)
          </h2>
          <p className="text-sm text-paroki-500">
            Jelaskan produk/jasa Anda secara detail. Gunakan format teks untuk hasil terbaik.
          </p>
          <WysiwygEditor
            value={form.rich_description}
            onChange={handleRichDescriptionChange}
            placeholder="Tulis deskripsi lengkap produk Anda di sini..."
          />
        </div>

        {/* ---- Section: E-commerce Links ---- */}
        <div className="space-y-4">
          <div className="border-b border-paroki-100 pb-2">
            <h2 className="text-base font-semibold text-paroki-900">
              Tautan Marketplace
            </h2>
            <p className="mt-1 text-sm text-paroki-500">
              Tambahkan link produk Anda di berbagai platform e-commerce. Pembeli akan langsung diarahkan ke toko Anda.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {ECOMMERCE_PLATFORMS.map((platform) => (
              <div
                key={platform.key}
                className="rounded-lg border border-paroki-100 bg-white p-3"
                style={{ borderLeft: `4px solid ${platform.color}` }}
              >
                <label htmlFor={`ecom-${platform.key}`} className="mb-1.5 flex items-center gap-2 text-sm font-medium text-paroki-700">
                  {'iconUrl' in platform && platform.iconUrl ? (
                    <img src={platform.iconUrl} alt={platform.label} className="h-5 w-5 rounded object-contain" />
                  ) : (
                    <span className="text-base">{platform.icon}</span>
                  )}
                  {platform.label}
                </label>
                <input
                  id={`ecom-${platform.key}`}
                  type="url"
                  value={form.ecommerce_links[platform.key] || ''}
                  onChange={(e) => handleEcommerceLinkChange(platform.key, e.target.value)}
                  placeholder={`https://www.${platform.key === 'website' ? 'tokoanda' : platform.key === 'whatsapp' ? 'wa.me' : platform.key === 'tiktok_shop' ? 'tiktok' : platform.key}.com/...`}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ---- Section: SEO (collapsible) ---- */}
        <div className="rounded-xl border border-paroki-100 bg-paroki-50/50">
          <button
            type="button"
            onClick={() => setShowSeo(!showSeo)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-paroki-800">
              Pengaturan SEO (Opsional)
            </span>
            <ChevronDown
              className={`h-4 w-4 text-paroki-500 transition-transform ${showSeo ? 'rotate-180' : ''}`}
            />
          </button>

          {showSeo && (
            <div className="space-y-4 px-4 pb-4">
              <p className="text-sm text-paroki-500">
                Kosongkan jika tidak yakin — sistem akan generate otomatis dari nama dan deskripsi produk.
              </p>

              <div>
                <label htmlFor="seo_title" className={labelClass}>
                  Judul untuk Google (kosongkan untuk otomatis)
                </label>
                <input
                  id="seo_title"
                  name="seo_title"
                  type="text"
                  maxLength={60}
                  value={form.seo_title}
                  onChange={handleChange}
                  placeholder="Judul SEO..."
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="seo_description" className={labelClass}>
                  Deskripsi untuk Google (maks 160 karakter)
                </label>
                <textarea
                  id="seo_description"
                  name="seo_description"
                  rows={2}
                  maxLength={160}
                  value={form.seo_description}
                  onChange={handleChange}
                  placeholder="Deskripsi SEO..."
                  className={inputClass}
                />
                <p className="mt-1 text-right text-xs text-paroki-400">
                  {form.seo_description.length}/160
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ---- Action buttons ---- */}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-paroki-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {isEdit ? 'Perbarui Produk' : 'Simpan Produk'}
              </>
            )}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-paroki-300 bg-white px-5 py-2.5 text-sm font-semibold text-paroki-700 shadow-sm transition hover:bg-paroki-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
            >
              <X className="h-4 w-4" />
              Batal
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
