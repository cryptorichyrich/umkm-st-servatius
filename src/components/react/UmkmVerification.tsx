import {
  useState,
  useEffect,
  useCallback,
  type FormEvent,
  type DragEvent,
} from 'react';
import { supabase, type Category, type Profile } from '../../lib/supabase';
import {
  Store,
  Upload,
  FileText,
  CheckCircle,
  Loader2,
  X,
  ArrowLeft,
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface UploadedFile {
  url: string;
  name: string;
  isImage: boolean;
}

type UploadField = 'kk_gereja' | 'ktp' | 'catalog';

const ACCEPT_TYPES = 'image/jpeg,image/png,image/webp,application/pdf';

const inputClass =
  'w-full rounded-lg border border-paroki-200 bg-white px-4 py-2.5 text-sm text-paroki-900 outline-none transition focus:border-paroki-400 focus:ring-2 focus:ring-paroki-200';
const labelClass = 'mb-1.5 block text-sm font-medium text-paroki-800';

export default function UmkmVerification() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMemberVerified, setIsMemberVerified] = useState(false);

  // File state
  const [files, setFiles] = useState<Record<UploadField, UploadedFile | null>>({
    kk_gereja: null,
    ktp: null,
    catalog: null,
  });
  const [uploading, setUploading] = useState<UploadField | null>(null);
  const [dragOver, setDragOver] = useState<UploadField | null>(null);

  // Form state
  const [form, setForm] = useState({
    owner_name: '',
    business_name: '',
    business_address: '',
    business_phone: '',
    category_id: '',
    omset_range: '',
    has_nib: false,
    has_pirt: false,
    has_halal: false,
    harapan_gabung: '',
  });

  // Wilayah & Lingkungan
  const [wilayahList, setWilayahList] = useState<{ id: string; name: string }[]>([]);
  const [lingkunganList, setLingkunganList] = useState<{ id: string; name: string; wilayah_id: string }[]>([]);
  const [selectedWilayah, setSelectedWilayah] = useState('');
  const [selectedLingkungan, setSelectedLingkungan] = useState('');

  // ── Fetch auth + profile on mount ──
  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = '/masuk';
        return;
      }

      // Check if member-verified
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileData) {
        const p = profileData as Profile;
        if (p.verification_status === 'verified' && p.verification_type === 'member') {
          setIsMemberVerified(true);
        }
        // Pre-fill owner name if available
        if (p.full_name) {
          setForm((prev) => ({ ...prev, owner_name: p.full_name }));
        }
      }

      setLoading(false);
    })();
  }, []);

  // ── Fetch categories + wilayah/lingkungan on mount ──
  useEffect(() => {
    (async () => {
      const [{ data: catData }, { data: wData }, { data: lData }] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
        supabase.from('wilayah').select('id, name').order('name'),
        supabase.from('lingkungan').select('id, name, wilayah_id').order('name'),
      ]);
      setCategories((catData || []) as Category[]);
      setWilayahList((wData || []) as { id: string; name: string }[]);
      setLingkunganList((lData || []) as { id: string; name: string; wilayah_id: string }[]);
      setLoadingCats(false);
    })();
  }, []);

  // ── Reset lingkungan when wilayah changes ──
  useEffect(() => {
    setSelectedLingkungan('');
  }, [selectedWilayah]);

  // ── Filtered lingkungan ──
  const filteredLingkungan = lingkunganList.filter((l) => {
    const matchedWilayah = wilayahList.find((w) => w.name === selectedWilayah);
    return matchedWilayah ? l.wilayah_id === matchedWilayah.id : false;
  });

  // ── Get current user ID ──
  const getUserId = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  }, []);

  // ── Upload a file to verification-docs bucket ──
  const uploadFile = useCallback(
    async (field: UploadField, file: File): Promise<UploadedFile | null> => {
      const userId = await getUserId();
      if (!userId) {
        setError('Sesi berakhir. Silakan masuk kembali.');
        return null;
      }

      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${userId}/${field}-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('verification-docs')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadErr) throw uploadErr;

      const { data: pubData } = supabase.storage
        .from('verification-docs')
        .getPublicUrl(fileName);

      const isImage = file.type.startsWith('image/');
      return { url: pubData.publicUrl, name: file.name, isImage };
    },
    [getUserId],
  );

  // ── Handle file selection ──
  const handleFileSelect = async (
    field: UploadField,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(field);
    setError(null);
    try {
      const result = await uploadFile(field, file);
      if (result) {
        setFiles((prev) => ({ ...prev, [field]: result }));
      }
    } catch (err) {
      setError(
        err instanceof Error ? `Gagal upload: ${err.message}` : 'Gagal upload file.',
      );
    } finally {
      setUploading(null);
    }
  };

  // ── Handle drag-and-drop ──
  const handleDrop = async (field: UploadField, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setUploading(field);
    setError(null);
    try {
      const result = await uploadFile(field, file);
      if (result) {
        setFiles((prev) => ({ ...prev, [field]: result }));
      }
    } catch (err) {
      setError(
        err instanceof Error ? `Gagal upload: ${err.message}` : 'Gagal upload file.',
      );
    } finally {
      setUploading(null);
    }
  };

  // ── Submit UMKM verification ──
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate fields (KK Gereja only if NOT member-verified)
    if (!isMemberVerified && !files.kk_gereja) {
      setError('Foto KK Gereja wajib diupload.');
      return;
    }
    if (!files.ktp) {
      setError('Foto KTP wajib diupload.');
      return;
    }
    if (!files.catalog) {
      setError('Katalog produk wajib diupload.');
      return;
    }
    if (!form.owner_name.trim()) {
      setError('Nama pemilik wajib diisi.');
      return;
    }
    if (!form.business_name.trim()) {
      setError('Nama UMKM wajib diisi.');
      return;
    }
    if (!form.business_address.trim()) {
      setError('Alamat wajib diisi.');
      return;
    }
    if (!form.business_phone.trim()) {
      setError('No. HP wajib diisi.');
      return;
    }
    if (!form.category_id) {
      setError('Kategori wajib dipilih.');
      return;
    }
    if (!selectedWilayah) {
      setError('Wilayah wajib dipilih.');
      return;
    }
    if (!selectedLingkungan) {
      setError('Lingkungan wajib dipilih.');
      return;
    }

    const userId = await getUserId();
    if (!userId) {
      setError('Sesi berakhir. Silakan masuk kembali.');
      return;
    }

    setSubmitting(true);
    try {
      const insertData: Record<string, unknown> = {
        user_id: userId,
        request_type: 'umkm',
        status: 'pending',
        ktp_url: files.ktp!.url,
        catalog_url: files.catalog!.url,
        owner_name: form.owner_name.trim(),
        business_name: form.business_name.trim(),
        business_address: form.business_address.trim(),
        business_phone: form.business_phone.trim(),
        category_id: form.category_id,
        omset_range: form.omset_range,
        has_nib: form.has_nib,
        has_pirt: form.has_pirt,
        has_halal: form.has_halal,
        harapan_gabung: form.harapan_gabung.trim(),
        wilayah: selectedWilayah,
        lingkungan: selectedLingkungan,
      };

      // Only include KK Gereja if not member-verified
      if (!isMemberVerified && files.kk_gereja) {
        insertData.kk_gereja_url = files.kk_gereja.url;
      }

      const { error: insertErr } = await supabase
        .from('verification_requests')
        .insert(insertData);
      if (insertErr) throw insertErr;

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Gagal mengirim: ${err.message}`
          : 'Gagal mengirim verifikasi.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reusable upload zone ──
  const UploadZone = ({
    field,
    label,
    file,
    isUploading,
    isDragOver,
  }: {
    field: UploadField;
    label: string;
    file: UploadedFile | null;
    isUploading: boolean;
    isDragOver: boolean;
  }) => (
    <div>
      <label className={labelClass}>
        {label} <span className="text-red-500">*</span>
      </label>
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-paroki-200 bg-white p-3">
          {file.isImage ? (
            <img
              src={file.url}
              alt={file.name}
              className="h-14 w-14 flex-shrink-0 rounded-lg border border-paroki-200 object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-paroki-200 bg-paroki-50">
              <FileText className="h-6 w-6 text-paroki-400" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-paroki-800">{file.name}</p>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-green-600">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Telah diupload</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFiles((prev) => ({ ...prev, [field]: null }))}
            className="flex-shrink-0 rounded-lg p-1.5 text-paroki-400 transition hover:bg-red-50 hover:text-red-500"
            aria-label="Hapus file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onDrop={(e) => handleDrop(field, e)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(field);
          }}
          onDragLeave={() => setDragOver(null)}
          onClick={() => {
            const el = document.getElementById(`upload-${field}`) as HTMLInputElement | null;
            el?.click();
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
            isDragOver
              ? 'border-paroki-500 bg-paroki-50'
              : 'border-paroki-300 bg-white hover:bg-paroki-50'
          }`}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-paroki-400" />
              <p className="text-sm text-paroki-500">Mengupload...</p>
            </>
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paroki-100 text-paroki-500">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-paroki-700">
                  Klik atau seret file ke sini
                </p>
                <p className="mt-0.5 text-xs text-paroki-400">
                  JPG, PNG, WEBP, atau PDF — maks 5MB
                </p>
              </div>
            </>
          )}
          <input
            type="file"
            accept={ACCEPT_TYPES}
            onChange={(e) => handleFileSelect(field, e)}
            disabled={isUploading}
            className="hidden"
            id={`upload-${field}`}
          />
        </div>
      )}
    </div>
  );

  // ── Loading state ──
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-paroki-100" />
          <div className="h-32 rounded-xl bg-paroki-100" />
          <div className="h-32 rounded-xl bg-paroki-100" />
        </div>
      </div>
    );
  }

  // ── Success screen ──
  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center sm:p-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h2 className="font-serif text-xl font-bold text-green-900">
            Permintaan Terkirim!
          </h2>
          <p className="mt-2 text-sm text-green-700">
            Permintaan verifikasi UMKM Anda telah berhasil dikirim. Tim admin akan
            meninjau dokumen Anda dalam 1–3 hari kerja.
          </p>
          <a
            href="/dashboard/verifikasi"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            ← Kembali ke Halaman Verifikasi
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
      {/* Back link */}
      <a
        href="/dashboard/verifikasi"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-paroki-500 transition hover:text-paroki-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Halaman Verifikasi
      </a>

      {/* Header */}
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-paroki-600 text-white">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-paroki-900">
              Verifikasi UMKM
            </h1>
            <p className="text-xs text-paroki-500">Badge UMKM Terverifikasi</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-paroki-600">
          Daftarkan usaha Anda dan dapatkan badge UMKM Terverifikasi untuk tampil di
          direktori Paroki UMKM.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Member-verified note */}
        {isMemberVerified && (
          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
            <p className="text-sm text-green-700">
              ✅ Anda sudah terverifikasi sebagai member. Untuk verifikasi UMKM, cukup
              lengkapi data di bawah.
            </p>
          </div>
        )}

        {/* Requirements list (only if NOT member-verified) */}
        {!isMemberVerified && (
          <div className="rounded-lg bg-paroki-50/60 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-paroki-500">
              Persyaratan
            </p>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <li className="flex items-center gap-2 text-sm text-paroki-700">
                <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
                <span>Foto KK Gereja</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-paroki-700">
                <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
                <span>Foto KTP</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-paroki-700">
                <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
                <span>Data pemilik & usaha</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-paroki-700">
                <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
                <span>Foto katalog produk</span>
              </li>
            </ul>
          </div>
        )}

        {/* KK Gereja upload — only if NOT member-verified */}
        {!isMemberVerified && (
          <UploadZone
            field="kk_gereja"
            label="Upload Foto KK Gereja"
            file={files.kk_gereja}
            isUploading={uploading === 'kk_gereja'}
            isDragOver={dragOver === 'kk_gereja'}
          />
        )}

        {/* KTP upload */}
        <UploadZone
          field="ktp"
          label="Upload KTP"
          file={files.ktp}
          isUploading={uploading === 'ktp'}
          isDragOver={dragOver === 'ktp'}
        />

        {/* Owner Name */}
        <div>
          <label htmlFor="owner_name" className={labelClass}>
            Nama Pemilik <span className="text-red-500">*</span>
          </label>
          <input
            id="owner_name"
            type="text"
            required
            value={form.owner_name}
            onChange={(e) =>
              setForm((p) => ({ ...p, owner_name: e.target.value }))
            }
            placeholder="Nama lengkap pemilik usaha"
            className={inputClass}
          />
        </div>

        {/* Business Name */}
        <div>
          <label htmlFor="business_name" className={labelClass}>
            Nama UMKM <span className="text-red-500">*</span>
          </label>
          <input
            id="business_name"
            type="text"
            required
            value={form.business_name}
            onChange={(e) =>
              setForm((p) => ({ ...p, business_name: e.target.value }))
            }
            placeholder="Nama usaha / jasa Anda"
            className={inputClass}
          />
        </div>

        {/* Address */}
        <div>
          <label htmlFor="business_address" className={labelClass}>
            Alamat <span className="text-red-500">*</span>
          </label>
          <textarea
            id="business_address"
            required
            rows={3}
            value={form.business_address}
            onChange={(e) =>
              setForm((p) => ({ ...p, business_address: e.target.value }))
            }
            placeholder="Alamat lengkap usaha Anda"
            className={inputClass}
          />
        </div>

        {/* Phone + Category */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="business_phone" className={labelClass}>
              No. HP <span className="text-red-500">*</span>
            </label>
            <input
              id="business_phone"
              type="tel"
              required
              value={form.business_phone}
              onChange={(e) =>
                setForm((p) => ({ ...p, business_phone: e.target.value }))
              }
              placeholder="08xxxxxxxxxx"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="umkm_category" className={labelClass}>
              Jenis/Kategori <span className="text-red-500">*</span>
            </label>
            <select
              id="umkm_category"
              required
              value={form.category_id}
              onChange={(e) =>
                setForm((p) => ({ ...p, category_id: e.target.value }))
              }
              disabled={loadingCats}
              className={inputClass}
            >
              <option value="">
                {loadingCats ? 'Memuat kategori...' : 'Pilih kategori...'}
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Wilayah + Lingkungan — searchable cascading dropdowns */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="umkm_wilayah" className={labelClass}>
              Wilayah <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              id="umkm_wilayah"
              value={selectedWilayah}
              onChange={setSelectedWilayah}
              options={wilayahList.map((w) => w.name)}
              placeholder="Cari wilayah..."
              emptyText="Wilayah tidak ditemukan"
            />
          </div>
          <div>
            <label htmlFor="umkm_lingkungan" className={labelClass}>
              Lingkungan <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              id="umkm_lingkungan"
              value={selectedLingkungan}
              onChange={setSelectedLingkungan}
              options={filteredLingkungan.map((l) => l.name)}
              placeholder={selectedWilayah ? 'Cari lingkungan...' : 'Pilih wilayah dulu...'}
              emptyText="Lingkungan tidak ditemukan"
              disabled={!selectedWilayah}
            />
          </div>
        </div>

        {/* Catalog upload */}
        <UploadZone
          field="catalog"
          label="Upload Katalog Produk"
          file={files.catalog}
          isUploading={uploading === 'catalog'}
          isDragOver={dragOver === 'catalog'}
        />

        {/* Business info — private, for admin */}
        <div className="rounded-xl border border-paroki-200 bg-paroki-50/50 p-4 space-y-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-paroki-600">
              Informasi Usaha
            </p>
            <p className="text-xs text-paroki-400">Privat — hanya untuk pengurus/admin</p>
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
              <span className="text-sm text-paroki-800">Saya memiliki <strong>NIB</strong> (Nomor Induk Berusaha)</span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.has_pirt}
                onChange={(e) => setForm((p) => ({ ...p, has_pirt: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-paroki-700 focus:ring-paroki-400" />
              <span className="text-sm text-paroki-800">Saya memiliki <strong>PIRT</strong> (Sertifikat Laik Higiene Sanitasi)</span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.has_halal}
                onChange={(e) => setForm((p) => ({ ...p, has_halal: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-paroki-700 focus:ring-paroki-400" />
              <span className="text-sm text-paroki-800">Saya memiliki <strong>Sertifikasi Halal</strong> (MUI/BPJPH)</span>
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

        {/* Error message */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-paroki-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Mengirim...
            </span>
          ) : (
            'Kirim Verifikasi UMKM'
          )}
        </button>
      </form>
    </div>
  );
}
