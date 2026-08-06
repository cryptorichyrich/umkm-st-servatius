import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import MapPicker from './MapPicker';
import { supabase, type Category } from '../../lib/supabase';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import PhotoGalleryUploader from './PhotoGalleryUploader';

// ── Operating hours structured editor ──
const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

function OperatingHoursEditor({ value, onChange, labelClass, inputClass }: {
  value: string;
  onChange: (val: string) => void;
  labelClass: string;
  inputClass: string;
}) {
  // Parse existing text into per-day entries
  const [mode, setMode] = useState<'same' | 'custom'>('same');
  const [sameHours, setSameHours] = useState({ open: '08:00', close: '17:00', days: 'Senin–Sabtu' });
  const [customHours, setCustomHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>(
    Object.fromEntries(DAYS.map(d => [d, { open: '08:00', close: '17:00', closed: false }]))
  );

  // Try parse existing value on mount
  useEffect(() => {
    if (!value) return;
    // Simple heuristic: if it looks like "Senin-Sabtu, 08:00-17:00"
    const m = value.match(/(.+?),\s*(\d{1,2}[:.]?\d*)\s*[-–]\s*(\d{1,2}[:.]?\d*)/);
    if (m) {
      setSameHours({ days: m[1].trim(), open: m[2].replace('.', ':'), close: m[3].replace('.', ':') });
    } else {
      // Just use as-is
      setSameHours(prev => ({ ...prev, days: value }));
    }
  }, []);

  const buildText = () => {
    if (mode === 'same') {
      if (!sameHours.open || !sameHours.close) return sameHours.days || '';
      return `${sameHours.days}, ${sameHours.open}–${sameHours.close}`;
    }
    // Custom: group consecutive days with same hours
    const entries = DAYS.map(d => ({ day: d, ...customHours[d] }));
    const groups: string[] = [];
    let i = 0;
    while (i < entries.length) {
      const e = entries[i];
      if (e.closed) { i++; continue; }
      let j = i + 1;
      while (j < entries.length && !entries[j].closed && entries[j].open === e.open && entries[j].close === e.close) j++;
      const range = j - i > 1 ? `${e.day}–${entries[j - 1].day}` : e.day;
      groups.push(`${range} ${e.open}–${e.close}`);
      i = j;
    }
    // Find closed days
    const closedDays = entries.filter(e => e.closed).map(e => e.day);
    if (closedDays.length) {
      const closedRange = closedDays.length > 1 ? closedDays.join(', ') : closedDays[0];
      groups.push(`${closedRange} tutup`);
    }
    return groups.join(', ');
  };

  useEffect(() => { onChange(buildText()); }, [mode, sameHours, customHours]);

  return (
    <div>
      <label className={labelClass}>Jam Operasional</label>

      {/* Mode toggle */}
      <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1">
        <button type="button" onClick={() => setMode('same')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${mode === 'same' ? 'bg-white text-paroki-800 shadow-sm' : 'text-gray-500'}`}>
          Jam Sama Setiap Hari
        </button>
        <button type="button" onClick={() => setMode('custom')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${mode === 'custom' ? 'bg-white text-paroki-800 shadow-sm' : 'text-gray-500'}`}>
          Jam Berbeda Per Hari
        </button>
      </div>

      {mode === 'same' ? (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Hari Buka</label>
            <input type="text" value={sameHours.days} onChange={e => setSameHours(p => ({ ...p, days: e.target.value }))}
              placeholder="Senin–Sabtu" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Buka</label>
            <input type="time" value={sameHours.open} onChange={e => setSameHours(p => ({ ...p, open: e.target.value }))}
              className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Tutup</label>
            <input type="time" value={sameHours.close} onChange={e => setSameHours(p => ({ ...p, close: e.target.value }))}
              className={inputClass} />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {DAYS.map(day => (
            <div key={day} className="flex items-center gap-2">
              <label className="flex w-20 shrink-0 items-center gap-1.5 text-sm text-paroki-700">
                <input type="checkbox" checked={!customHours[day].closed}
                  onChange={e => setCustomHours(p => ({ ...p, [day]: { ...p[day], closed: !e.target.checked } }))}
                  className="h-4 w-4 rounded border-gray-300 text-paroki-600 focus:ring-paroki-400" />
                {day}
              </label>
              {customHours[day].closed ? (
                <span className="text-xs text-gray-400">Tutup</span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input type="time" value={customHours[day].open}
                    onChange={e => setCustomHours(p => ({ ...p, [day]: { ...p[day], open: e.target.value } }))}
                    className={`${inputClass} w-32 py-1.5 text-xs`} />
                  <span className="text-gray-400">–</span>
                  <input type="time" value={customHours[day].close}
                    onChange={e => setCustomHours(p => ({ ...p, [day]: { ...p[day], close: e.target.value } }))}
                    className={`${inputClass} w-32 py-1.5 text-xs`} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Preview */}
      <p className="mt-2 rounded-lg bg-paroki-50 px-3 py-2 text-xs text-paroki-600">
        <span className="font-medium">Pratinjau:</span> {value || '—'}
      </p>
    </div>
  );
}

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
  lingkungan: string;
  latitude: number | null;
  longitude: number | null;
  instagram: string;
  facebook: string;
  tiktok: string;
  operating_hours_text: string;
  logo_url: string;
  ktp_url: string;
  catalog_url: string;
  omset_range: string;
  has_nib: boolean;
  has_pirt: boolean;
  has_halal: boolean;
  harapan_gabung: string;
}

const emptyForm: FormData = {
  name: '', description: '', category_id: '', whatsapp: '', phone: '', email: '',
  address: '', area: '', lingkungan: '', latitude: null, longitude: null, instagram: '', facebook: '', tiktok: '',
  operating_hours_text: '', logo_url: '',
  ktp_url: '', catalog_url: '',
  omset_range: '', has_nib: false, has_pirt: false, has_halal: false, harapan_gabung: '',
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
  const [currentStatus, setCurrentStatus] = useState<string>('draft');
  const [rejectionNote, setRejectionNote] = useState<string>('');
  const [uploadingKtp, setUploadingKtp] = useState(false);
  const [uploadingCatalog, setUploadingCatalog] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [originalLogo, setOriginalLogo] = useState<string>('');
  const [originalGallery, setOriginalGallery] = useState<string[]>([]);
  const [userId, setUserId] = useState('');

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
      setUserId(session.user.id);

      // Fetch categories
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      setCategories((catData || []) as Category[]);

      // Categories only — wilayah/lingkungan removed from business form

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
          lingkungan: biz.lingkungan || '',
          latitude: biz.latitude ?? null,
          longitude: biz.longitude ?? null,
          instagram: biz.instagram || '',
          facebook: biz.facebook || '',
          tiktok: biz.tiktok || '',
          operating_hours_text: hoursText,
          logo_url: biz.logo_url || '',
          ktp_url: biz.ktp_url || '',
          catalog_url: biz.catalog_url || '',
          omset_range: (biz as any).omset_range || '',
          has_nib: (biz as any).has_nib ?? false,
          has_pirt: (biz as any).has_pirt ?? false,
          has_halal: (biz as any).has_halal ?? false,
          harapan_gabung: (biz as any).harapan_gabung || '',
        });
        setCurrentStatus(biz.status || 'draft');
        setRejectionNote(biz.rejection_note || '');

        // Fetch existing gallery images
        const { data: bizImgs } = await supabase
          .from('business_images')
          .select('image_url')
          .eq('business_id', businessId)
          .order('sort_order', { ascending: true });
        setGalleryImages((bizImgs as { image_url: string }[])?.map((i) => i.image_url) || []);
        // Track originals to detect image changes on save
        setOriginalLogo(biz.logo_url || '');
        setOriginalGallery((bizImgs as { image_url: string }[])?.map((i) => i.image_url) || []);
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
      const fileName = `${userId}/logo-${Date.now()}.${ext}`;

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

  const handleKtpUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError('Sesi berakhir. Silakan masuk kembali.');
      return;
    }

    setUploadingKtp(true);
    setError(null);

    try {
      const userId = session.user.id;
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${userId}/ktp-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('verification-docs')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadErr) throw uploadErr;

      const { data: pubData } = supabase.storage
        .from('verification-docs')
        .getPublicUrl(fileName);

      setForm((prev) => ({ ...prev, ktp_url: pubData.publicUrl }));
    } catch (err) {
      setError(
        err instanceof Error
          ? `Gagal upload KTP: ${err.message}`
          : 'Gagal upload KTP.',
      );
    } finally {
      setUploadingKtp(false);
    }
  };

  const handleCatalogUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError('Sesi berakhir. Silakan masuk kembali.');
      return;
    }

    setUploadingCatalog(true);
    setError(null);

    try {
      const userId = session.user.id;
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${userId}/catalog-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('verification-docs')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadErr) throw uploadErr;

      const { data: pubData } = supabase.storage
        .from('verification-docs')
        .getPublicUrl(fileName);

      setForm((prev) => ({ ...prev, catalog_url: pubData.publicUrl }));
    } catch (err) {
      setError(
        err instanceof Error
          ? `Gagal upload katalog: ${err.message}`
          : 'Gagal upload katalog.',
      );
    } finally {
      setUploadingCatalog(false);
    }
  };

  const buildPayload = (status?: string) => {
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
      lingkungan: form.lingkungan.trim(),
      latitude: form.latitude || null,
      longitude: form.longitude || null,
      instagram: form.instagram.trim(),
      facebook: form.facebook.trim(),
      tiktok: form.tiktok.trim(),
      operating_hours: { text: form.operating_hours_text.trim() },
      logo_url: form.logo_url,
      ktp_url: form.ktp_url,
      catalog_url: form.catalog_url,
      omset_range: form.omset_range,
      has_nib: form.has_nib,
      has_pirt: form.has_pirt,
      has_halal: form.has_halal,
      harapan_gabung: form.harapan_gabung.trim(),
      status: status ?? 'draft',
      re_review_reason: null as string | null,
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
      let savedBizId = businessId;
      if (isEdit && businessId) {
        // Detect image changes on an approved listing
        const logoChanged = form.logo_url !== originalLogo;
        const galleryChanged =
          galleryImages.length !== originalGallery.length ||
          !galleryImages.every((url, i) => originalGallery[i] === url);
        const imagesChanged = logoChanged || galleryChanged;

        let saveStatus: string;
        let reReviewReason: string | null = null;

        if (currentStatus === 'approved' && imagesChanged) {
          // Images changed on approved listing → needs re-review
          saveStatus = 'pending';
          reReviewReason = 'Perubahan gambar (logo/galeri) — perlu tinjauan ulang panitia.';
        } else if (currentStatus === 'approved') {
          // Text-only changes on approved listing → stay approved
          saveStatus = 'approved';
        } else {
          saveStatus = 'draft';
        }

        const payload = buildPayload(saveStatus);
        if (saveStatus === 'pending') {
          payload.re_review_reason = reReviewReason;
        } else {
          payload.re_review_reason = null;
        }

        const { error: updateErr } = await supabase
          .from('businesses')
          .update(payload)
          .eq('id', businessId);
        if (updateErr) throw updateErr;

        // Show info to user about re-review
        if (saveStatus === 'pending' && reReviewReason) {
          alert(
            'ℹ️ Perubahan gambar terdeteksi!\n\n' +
            'Listing Anda sementara tidak tampil publik dan akan ditinjau ulang oleh panitia ' +
            'untuk memastikan gambar tidak mengandung konten yang tidak pantas. ' +
            'Proses ini biasanya cepat. Terima kasih atas pengertiannya!'
          );
        }
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error('Sesi berakhir');

        const { data: newBiz, error: insertErr } = await supabase.from('businesses').insert({
          ...buildPayload('draft'),
          owner_id: session.user.id,
        }).select('id').single();
        if (insertErr) throw insertErr;
        savedBizId = newBiz.id;
      }

      // Sync gallery images
      if (savedBizId) {
        await supabase.from('business_images').delete().eq('business_id', savedBizId);
        if (galleryImages.length > 0) {
          await supabase.from('business_images').insert(
            galleryImages.map((url, i) => ({
              business_id: savedBizId,
              image_url: url,
              sort_order: i,
            }))
          );
        }
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

    if (!form.ktp_url) {
      setError('Foto KTP wajib diupload untuk verifikasi.');
      return;
    }
    if (!form.catalog_url) {
      setError('Foto katalog produk wajib diupload untuk verifikasi.');
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
        p_business_id: savedId,
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

        {/* Gallery photos */}
        {userId && (
          <PhotoGalleryUploader
            bucket="business-images"
            folder={`${userId}/gallery`}
            images={galleryImages}
            onChange={setGalleryImages}
            max={8}
            label="Galeri Usaha"
          />
        )}

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

            {/* Map picker — open source (Leaflet + OpenStreetMap) */}
            <div className="sm:col-span-2">
              <label className={labelClass}>
                📍 Lokasi di Peta
              </label>
              <MapPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={(lat, lng) => {
                  // lat=0, lng=0 means "clear"
                  if (lat === 0 && lng === 0) {
                    setForm((prev) => ({ ...prev, latitude: null, longitude: null }));
                  } else {
                    setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
                  }
                }}
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

        {/* Operating hours — structured UI */}
        <OperatingHoursEditor
          value={form.operating_hours_text}
          onChange={(val) => setForm((prev) => ({ ...prev, operating_hours_text: val }))}
          labelClass={labelClass}
          inputClass={inputClass}
        />

        {/* Verification documents */}
        <div className="rounded-xl border border-paroki-100 bg-paroki-50/50 p-4">
          <h2 className="mb-2 font-serif text-sm font-semibold text-paroki-800">
            Dokumen Verifikasi UMKM
          </h2>

          {/* Status-based messaging */}
          {currentStatus === 'approved' && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
              <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
              <p className="text-xs text-green-700">
                Dokumen terverifikasi. Dokumen tidak dapat diubah demi keamanan.
              </p>
            </div>
          )}
          {currentStatus === 'pending' && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2.5">
              <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" />
              <p className="text-xs text-yellow-700">
                Dokumen sedang direview admin. Tidak dapat diubah sampai proses selesai.
              </p>
            </div>
          )}
          {currentStatus === 'rejected' && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3">
              <div className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-800">
                    Verifikasi UMKM ditolak
                  </p>
                  {rejectionNote && (
                    <p className="mt-1 text-sm text-red-600">
                      <span className="font-medium">Catatan admin:</span> {rejectionNote}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-red-500">
                    Silakan perbaiki dokumen dan kirim ulang untuk review.
                  </p>
                </div>
              </div>
            </div>
          )}
          {(currentStatus === 'draft' || currentStatus === 'rejected') && (
            <p className="mb-4 text-xs text-paroki-500">
              Dokumen ini diperlukan untuk verifikasi usaha Anda oleh admin paroki.
            </p>
          )}

          {/* Whether documents can be edited */}
          {(() => {
            const locked = currentStatus === 'approved' || currentStatus === 'pending';
            return (
              <div className="grid gap-4 sm:grid-cols-2">
                {/* KTP */}
                <div>
                  <label className={labelClass}>
                    Foto KTP Pemilik {currentStatus !== 'approved' && <span className="text-red-500">*</span>}
                  </label>
                  {form.ktp_url ? (
                    <div className="flex items-center gap-3 rounded-lg border border-paroki-200 bg-white p-3">
                      <img src={form.ktp_url} alt="KTP" className="h-16 w-16 rounded-lg border border-paroki-200 object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-paroki-700">KTP terupload</p>
                        {locked ? (
                          <p className="text-xs text-paroki-400">🔒 Terkunci</p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById('upload-ktp') as HTMLInputElement;
                              el?.click();
                            }}
                            className="text-sm font-medium text-paroki-600 hover:text-paroki-800"
                          >
                            Ganti Foto
                          </button>
                        )}
                      </div>
                    </div>
                  ) : locked ? (
                    <div className="flex items-center gap-3 rounded-lg border border-paroki-200 bg-white p-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-paroki-200 bg-paroki-50 text-paroki-300">
                        <XCircle className="h-6 w-6" />
                      </div>
                      <p className="text-sm text-paroki-400">Belum ada KTP</p>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        const el = document.getElementById('upload-ktp') as HTMLInputElement;
                        el?.click();
                      }}
                      className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-paroki-300 bg-white px-4 py-6 text-center transition hover:bg-paroki-50"
                    >
                      {uploadingKtp ? (
                        <span className="text-sm text-paroki-500">Mengupload...</span>
                      ) : (
                        <>
                          <svg className="mb-2 h-8 w-8 text-paroki-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                          <span className="text-sm text-paroki-500">Klik untuk upload foto KTP</span>
                          <span className="mt-1 text-xs text-paroki-400">JPG, PNG. Maks 2MB.</span>
                        </>
                      )}
                    </div>
                  )}
                  {!locked && (
                    <input id="upload-ktp" type="file" accept="image/*" onChange={handleKtpUpload} disabled={uploadingKtp} className="hidden" />
                  )}
                </div>

                {/* Catalog */}
                <div>
                  <label className={labelClass}>
                    Foto Katalog Produk {currentStatus !== 'approved' && <span className="text-red-500">*</span>}
                  </label>
                  {form.catalog_url ? (
                    <div className="flex items-center gap-3 rounded-lg border border-paroki-200 bg-white p-3">
                      <img src={form.catalog_url} alt="Katalog" className="h-16 w-16 rounded-lg border border-paroki-200 object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-paroki-700">Katalog terupload</p>
                        {locked ? (
                          <p className="text-xs text-paroki-400">🔒 Terkunci</p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById('upload-catalog') as HTMLInputElement;
                              el?.click();
                            }}
                            className="text-sm font-medium text-paroki-600 hover:text-paroki-800"
                          >
                            Ganti Foto
                          </button>
                        )}
                      </div>
                    </div>
                  ) : locked ? (
                    <div className="flex items-center gap-3 rounded-lg border border-paroki-200 bg-white p-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-paroki-200 bg-paroki-50 text-paroki-300">
                        <XCircle className="h-6 w-6" />
                      </div>
                      <p className="text-sm text-paroki-400">Belum ada katalog</p>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        const el = document.getElementById('upload-catalog') as HTMLInputElement;
                        el?.click();
                      }}
                      className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-paroki-300 bg-white px-4 py-6 text-center transition hover:bg-paroki-50"
                    >
                      {uploadingCatalog ? (
                        <span className="text-sm text-paroki-500">Mengupload...</span>
                      ) : (
                        <>
                          <svg className="mb-2 h-8 w-8 text-paroki-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                          <span className="text-sm text-paroki-500">Klik untuk upload foto katalog</span>
                          <span className="mt-1 text-xs text-paroki-400">JPG, PNG. Maks 2MB.</span>
                        </>
                      )}
                    </div>
                  )}
                  {!locked && (
                    <input id="upload-catalog" type="file" accept="image/*" onChange={handleCatalogUpload} disabled={uploadingCatalog} className="hidden" />
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Business info — private, for admin verification */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Informasi Usaha
            </p>
            <p className="text-xs text-gray-400">Privat — hanya untuk pengurus/admin</p>
          </div>

          <div>
            <label className={labelClass}>Kisaran Omset Tahunan</label>
            <select
              value={form.omset_range}
              onChange={(e) => setForm((p) => ({ ...p, omset_range: e.target.value }))}
              className={inputClass}
            >
              <option value="">— Pilih kisaran omset —</option>
              <option value="< 50jt">Belum ada omset / &lt; Rp 50 juta</option>
              <option value="50-300jt">Rp 50 juta – Rp 300 juta</option>
              <option value="300jt-2.5M">Rp 300 juta – Rp 2.5 miliar</option>
              <option value="> 2.5M">&gt; Rp 2.5 miliar</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.has_nib}
                onChange={(e) => setForm((p) => ({ ...p, has_nib: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-paroki-700 focus:ring-paroki-400" />
              <span className="text-sm text-ink-soft">Saya memiliki <strong>NIB</strong> (Nomor Induk Berusaha)</span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.has_pirt}
                onChange={(e) => setForm((p) => ({ ...p, has_pirt: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-paroki-700 focus:ring-paroki-400" />
              <span className="text-sm text-ink-soft">Saya memiliki <strong>PIRT</strong> (Sertifikat Laik Higiene Sanitasi)</span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.has_halal}
                onChange={(e) => setForm((p) => ({ ...p, has_halal: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-paroki-700 focus:ring-paroki-400" />
              <span className="text-sm text-ink-soft">Saya memiliki <strong>Sertifikasi Halal</strong> (MUI/BPJPH)</span>
            </label>
          </div>

          <div>
            <label className={labelClass}>Harapan Bergabung dengan UMKM Paroki</label>
            <textarea
              value={form.harapan_gabung}
              onChange={(e) => setForm((p) => ({ ...p, harapan_gabung: e.target.value }))}
              placeholder="Apa harapan Anda bergabung dengan komunitas UMKM Paroki St. Servatius?"
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        {/* Action buttons */}
        {currentStatus === 'approved' ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            ✅ Usaha ini sudah disetujui dan tampil di direktori publik. Perubahan teks kontak/deskripsi langsung tampil.
            {(() => {
              const imgChanged = form.logo_url !== originalLogo ||
                galleryImages.length !== originalGallery.length ||
                !galleryImages.every((url, i) => originalGallery[i] === url);
              if (!imgChanged) return null;
              return (
                <div className="mt-2 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                  ⚠️ <strong>Perubahan gambar terdeteksi!</strong> Saat disimpan, listing akan ditinjau ulang oleh panitia dan sementara tidak tampil publik.
                </div>
              );
            })()}
          </div>
        ) : null}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg border border-paroki-300 bg-white px-5 py-2.5 text-sm font-semibold text-paroki-700 shadow-sm transition hover:bg-paroki-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan sebagai Draft'}
          </button>
          {currentStatus !== 'approved' && currentStatus !== 'pending' && (
            <button
              type="button"
              onClick={handleSubmitForReview}
              disabled={saving}
              className="flex-1 rounded-lg bg-paroki-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Memproses...' : 'Kirim untuk Review'}
            </button>
          )}
          {currentStatus === 'pending' && (
            <div className="flex items-center justify-center rounded-lg border border-yellow-200 bg-yellow-50 px-5 py-2.5 text-sm font-semibold text-yellow-700">
              ⏳ Menunggu Review Admin
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
