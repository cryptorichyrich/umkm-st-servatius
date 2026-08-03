import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { supabase, type Category } from '../../lib/supabase';

interface Props {
  businessId?: string;
}

interface FormData {
  name: string;
  description: string;
  category_id: string;
  whatsapp: string;
  phone: string;
  email: string;
  address: string;
  area: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  operating_hours_text: string;
  logo_url: string;
}

const emptyForm: FormData = {
  name: '',
  description: '',
  category_id: '',
  whatsapp: '',
  phone: '',
  email: '',
  address: '',
  area: '',
  instagram: '',
  facebook: '',
  tiktok: '',
  operating_hours_text: '',
  logo_url: '',
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

export default function BusinessForm({ businessId: propBusinessId }: Props) {
  // Read business ID from URL query param if not passed as prop
  const urlId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('id')
    : null;
  const businessId = propBusinessId || urlId || undefined;
  const isEdit = Boolean(businessId);

  const [form, setForm] = useState<FormData>(emptyForm);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Fetch categories + existing business (if edit mode)
  useEffect(() => {
    (async () => {
      // Get session first
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/masuk';
        return;
      }

      // Fetch categories
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      setCategories((catData || []) as Category[]);

      // If editing, fetch existing business
      if (businessId) {
        const { data: biz, error: bizErr } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', businessId)
          .single();

        if (bizErr) {
          setError('Gagal memuat data usaha.');
          setLoading(false);
          return;
        }

        // Convert operating_hours JSONB to text
        let hoursText = '';
        if (biz.operating_hours && typeof biz.operating_hours === 'object') {
          // If it has a 'text' key, use that; otherwise join key-value pairs
          if (biz.operating_hours.text) {
            hoursText = biz.operating_hours.text;
          } else {
            hoursText = Object.entries(biz.operating_hours)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ');
          }
        }

        setForm({
          name: biz.name || '',
          description: biz.description || '',
          category_id: biz.category_id || '',
          whatsapp: biz.whatsapp || '',
          phone: biz.phone || '',
          email: biz.email || '',
          address: biz.address || '',
          area: biz.area || '',
          instagram: biz.instagram || '',
          facebook: biz.facebook || '',
          tiktok: biz.tiktok || '',
          operating_hours_text: hoursText,
          logo_url: biz.logo_url || '',
        });
      }

      setLoading(false);
    })();
  }, [businessId]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError('Sesi berakhir. Silakan masuk kembali.');
      return;
    }

    setUploadingLogo(true);
    setError(null);

    try {
      const userId = session.user.id;
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `business-images/${userId}/logo-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('business-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadErr) throw uploadErr;

      const { data: pubData } = supabase.storage
        .from('business-images')
        .getPublicUrl(fileName);

      setForm((prev) => ({ ...prev, logo_url: pubData.publicUrl }));
    } catch (err) {
      setError(
        err instanceof Error
          ? `Gagal upload logo: ${err.message}`
          : 'Gagal upload logo.',
      );
    } finally {
      setUploadingLogo(false);
    }
  };

  const buildPayload = (status: 'draft') => {
    return {
      name: form.name.trim(),
      slug: generateSlug(form.name),
      description: form.description.trim(),
      category_id: form.category_id || null,
      whatsapp: form.whatsapp.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      area: form.area.trim(),
      instagram: form.instagram.trim(),
      facebook: form.facebook.trim(),
      tiktok: form.tiktok.trim(),
      operating_hours: { text: form.operating_hours_text.trim() },
      logo_url: form.logo_url,
      status,
    };
  };

  const handleSaveDraft = async (e: FormEvent) => {
    e.preventDefault();

    // Validation
    if (!form.name.trim()) {
      setError('Nama usaha wajib diisi.');
      return;
    }
    if (!form.category_id) {
      setError('Kategori wajib dipilih.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEdit && businessId) {
        const { error: updateErr } = await supabase
          .from('businesses')
          .update(buildPayload('draft'))
          .eq('id', businessId);
        if (updateErr) throw updateErr;
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error('Sesi berakhir');

        const { error: insertErr } = await supabase.from('businesses').insert({
          ...buildPayload('draft'),
          owner_id: session.user.id,
        });
        if (insertErr) throw insertErr;
      }

      window.location.href = '/dashboard';
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal menyimpan usaha.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setError('Nama usaha wajib diisi.');
      return;
    }
    if (!form.category_id) {
      setError('Kategori wajib dipilih.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let savedId = businessId;

      // Step 1: Save as draft first
      if (isEdit && businessId) {
        const { error: updateErr } = await supabase
          .from('businesses')
          .update(buildPayload('draft'))
          .eq('id', businessId);
        if (updateErr) throw updateErr;
        savedId = businessId;
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error('Sesi berakhir');

        const { data: insertData, error: insertErr } = await supabase
          .from('businesses')
          .insert({
            ...buildPayload('draft'),
            owner_id: session.user.id,
          })
          .select('id')
          .single();

        if (insertErr) throw insertErr;
        savedId = insertData.id;
      }

      // Step 2: Call submit_for_review RPC
      if (!savedId) throw new Error('Gagal mendapatkan ID usaha');

      const { error: rpcErr } = await supabase.rpc('submit_for_review', {
        business_id: savedId,
      });
      if (rpcErr) throw rpcErr;

      window.location.href = '/dashboard';
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal mengirim usaha untuk review.',
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
    'w-full rounded-lg border border-paroki-200 bg-white px-4 py-2.5 text-sm text-paroki-900 outline-none transition focus:border-paroki-400 focus:ring-2 focus:ring-paroki-200';
  const labelClass =
    'mb-1.5 block text-sm font-medium text-paroki-800';

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-6">
        <a
          href="/dashboard"
          className="mb-3 inline-flex items-center gap-1 text-sm text-paroki-500 hover:text-paroki-700"
        >
          ← Kembali ke Dashboard
        </a>
        <h1 className="font-serif text-2xl font-bold text-paroki-900">
          {isEdit ? 'Edit Usaha' : 'Tambah Usaha Baru'}
        </h1>
        <p className="mt-1 text-sm text-paroki-600">
          {isEdit
            ? 'Perbarui informasi usaha Anda.'
            : 'Lengkapi formulir di bawah untuk mendaftarkan usaha Anda.'}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSaveDraft} className="space-y-5">
        {/* Name */}
        <div>
          <label htmlFor="name" className={labelClass}>
            Nama Usaha <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={form.name}
            onChange={handleChange}
            placeholder="contoh: Kerajinan Tangan Maria"
            className={inputClass}
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category_id" className={labelClass}>
            Kategori <span className="text-red-500">*</span>
          </label>
          <select
            id="category_id"
            name="category_id"
            required
            value={form.category_id}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">Pilih kategori...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className={labelClass}>
            Deskripsi
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            value={form.description}
            onChange={handleChange}
            placeholder="Jelaskan usaha/jasa Anda secara singkat..."
            className={inputClass}
          />
        </div>

        {/* Logo upload */}
        <div>
          <label className={labelClass}>Logo / Foto Usaha</label>
          <div className="flex items-center gap-4">
            {form.logo_url ? (
              <img
                src={form.logo_url}
                alt="Logo"
                className="h-20 w-20 rounded-xl border border-paroki-200 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-paroki-300 bg-paroki-50 text-paroki-300">
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/></svg>
              </div>
            )}
            <div>
              <label
                htmlFor="logo"
                className="inline-flex cursor-pointer items-center rounded-lg border border-paroki-200 bg-white px-4 py-2 text-sm font-medium text-paroki-700 hover:bg-paroki-50"
              >
                {uploadingLogo ? 'Mengupload...' : 'Pilih File'}
              </label>
              <input
                id="logo"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploadingLogo}
                className="hidden"
              />
              <p className="mt-1 text-xs text-paroki-400">
                Format: JPG, PNG. Maks 2MB.
              </p>
            </div>
          </div>
        </div>

        {/* Area */}
        <div>
          <label htmlFor="area" className={labelClass}>
            Wilayah
          </label>
          <input
            id="area"
            name="area"
            type="text"
            value={form.area}
            onChange={handleChange}
            placeholder="contoh: Wilayah 1"
            className={inputClass}
          />
        </div>

        {/* Contact info */}
        <div className="rounded-xl border border-paroki-100 bg-paroki-50/50 p-4">
          <h2 className="mb-4 font-serif text-sm font-semibold text-paroki-800">
            Informasi Kontak
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="whatsapp" className={labelClass}>
                WhatsApp
              </label>
              <input
                id="whatsapp"
                name="whatsapp"
                type="text"
                value={form.whatsapp}
                onChange={handleChange}
                placeholder="08xxxxxxxxxx"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="phone" className={labelClass}>
                Telepon
              </label>
              <input
                id="phone"
                name="phone"
                type="text"
                value={form.phone}
                onChange={handleChange}
                placeholder="021-xxxxxxx"
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="email" className={labelClass}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="email@contoh.com"
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="address" className={labelClass}>
                Alamat
              </label>
              <textarea
                id="address"
                name="address"
                rows={2}
                value={form.address}
                onChange={handleChange}
                placeholder="Alamat lengkap usaha..."
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Social media */}
        <div className="rounded-xl border border-paroki-100 bg-paroki-50/50 p-4">
          <h2 className="mb-4 font-serif text-sm font-semibold text-paroki-800">
            Media Sosial
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="instagram" className={labelClass}>
                Instagram
              </label>
              <input
                id="instagram"
                name="instagram"
                type="text"
                value={form.instagram}
                onChange={handleChange}
                placeholder="@username"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="facebook" className={labelClass}>
                Facebook
              </label>
              <input
                id="facebook"
                name="facebook"
                type="text"
                value={form.facebook}
                onChange={handleChange}
                placeholder="nama halaman / URL"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="tiktok" className={labelClass}>
                TikTok
              </label>
              <input
                id="tiktok"
                name="tiktok"
                type="text"
                value={form.tiktok}
                onChange={handleChange}
                placeholder="@username"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Operating hours */}
        <div>
          <label htmlFor="operating_hours_text" className={labelClass}>
            Jam Operasional
          </label>
          <input
            id="operating_hours_text"
            name="operating_hours_text"
            type="text"
            value={form.operating_hours_text}
            onChange={handleChange}
            placeholder="contoh: Senin–Sabtu, 08.00–17.00"
            className={inputClass}
          />
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg border border-paroki-300 bg-white px-5 py-2.5 text-sm font-semibold text-paroki-700 shadow-sm transition hover:bg-paroki-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan sebagai Draft'}
          </button>
          <button
            type="button"
            onClick={handleSubmitForReview}
            disabled={saving}
            className="flex-1 rounded-lg bg-paroki-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Memproses...' : 'Kirim untuk Review'}
          </button>
        </div>
      </form>
    </div>
  );
}
