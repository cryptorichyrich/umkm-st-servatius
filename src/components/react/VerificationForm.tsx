import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
  type DragEvent,
} from 'react';
import { supabase, type Category } from '../../lib/supabase';
import {
  ShieldCheck,
  Upload,
  FileText,
  Store,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  Image as ImageIcon,
  X,
} from 'lucide-react';

interface VerificationFormProps {
  currentStatus: string; // 'unverified' | 'pending' | 'verified' | 'rejected'
  currentType: string; // '' | 'member' | 'umkm'
  onRequestSubmitted?: () => void;
}

// ── Field type for upload zones ──
type UploadField = 'kk_gereja' | 'ktp' | 'catalog';

interface UploadedFile {
  url: string;
  name: string;
  isImage: boolean;
}

export default function VerificationForm({
  currentStatus,
  currentType,
  onRequestSubmitted,
}: VerificationFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Member form state
  const [memberKkUrl, setMemberKkUrl] = useState<UploadedFile | null>(null);
  const [memberUploading, setMemberUploading] = useState(false);
  const [memberSubmitting, setMemberSubmitting] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  // UMKM form state
  const [umkmFiles, setUmkmFiles] = useState<Record<UploadField, UploadedFile | null>>({
    kk_gereja: null,
    ktp: null,
    catalog: null,
  });
  const [umkmUploading, setUmkmUploading] = useState<UploadField | null>(null);
  const [umkmSubmitting, setUmkmSubmitting] = useState(false);
  const [umkmError, setUmkmError] = useState<string | null>(null);
  const [umkmForm, setUmkmForm] = useState({
    owner_name: '',
    business_name: '',
    business_address: '',
    business_phone: '',
    category_id: '',
  });

  // Wilayah & Lingkungan (member + UMKM)
  const [wilayahList, setWilayahList] = useState<{ id: string; name: string }[]>([]);
  const [lingkunganList, setLingkunganList] = useState<{ id: string; name: string; wilayah_id: string }[]>([]);
  const [memberWilayah, setMemberWilayah] = useState('');
  const [memberLingkungan, setMemberLingkungan] = useState('');
  const [umkmWilayah, setUmkmWilayah] = useState('');
  const [umkmLingkungan, setUmkmLingkungan] = useState('');

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
  useEffect(() => { setMemberLingkungan(''); }, [memberWilayah]);
  useEffect(() => { setUmkmLingkungan(''); }, [umkmWilayah]);

  const filteredMemberLing = lingkunganList.filter((l) => {
    const w = wilayahList.find((x) => x.name === memberWilayah);
    return w ? l.wilayah_id === w.id : false;
  });
  const filteredUmkmLing = lingkunganList.filter((l) => {
    const w = wilayahList.find((x) => x.name === umkmWilayah);
    return w ? l.wilayah_id === w.id : false;
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
    async (
      field: UploadField,
      file: File,
    ): Promise<UploadedFile | null> => {
      const userId = await getUserId();
      if (!userId) {
        setSubmitError('Sesi berakhir. Silakan masuk kembali.');
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

  // ── Handle member KK upload ──
  const handleMemberFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset input

    setMemberUploading(true);
    setMemberError(null);
    try {
      const result = await uploadFile('kk_gereja', file);
      if (result) setMemberKkUrl(result);
    } catch (err) {
      setMemberError(
        err instanceof Error ? `Gagal upload: ${err.message}` : 'Gagal upload file.',
      );
    } finally {
      setMemberUploading(false);
    }
  };

  // ── Handle UMKM file uploads ──
  const handleUmkmFile = async (
    field: UploadField,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUmkmUploading(field);
    setUmkmError(null);
    try {
      const result = await uploadFile(field, file);
      if (result) {
        setUmkmFiles((prev) => ({ ...prev, [field]: result }));
      }
    } catch (err) {
      setUmkmError(
        err instanceof Error ? `Gagal upload: ${err.message}` : 'Gagal upload file.',
      );
    } finally {
      setUmkmUploading(null);
    }
  };

  // ── Handle drag-and-drop for member ──
  const memberDropRef = useRef<HTMLDivElement>(null);
  const [memberDragOver, setMemberDragOver] = useState(false);

  const handleMemberDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setMemberDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setMemberUploading(true);
    setMemberError(null);
    try {
      const result = await uploadFile('kk_gereja', file);
      if (result) setMemberKkUrl(result);
    } catch (err) {
      setMemberError(
        err instanceof Error ? `Gagal upload: ${err.message}` : 'Gagal upload file.',
      );
    } finally {
      setMemberUploading(false);
    }
  };

  // ── Handle drag-and-drop for UMKM fields ──
  const [umkmDragOver, setUmkmDragOver] = useState<UploadField | null>(null);

  const handleUmkmDrop = async (field: UploadField, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setUmkmDragOver(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setUmkmUploading(field);
    setUmkmError(null);
    try {
      const result = await uploadFile(field, file);
      if (result) {
        setUmkmFiles((prev) => ({ ...prev, [field]: result }));
      }
    } catch (err) {
      setUmkmError(
        err instanceof Error ? `Gagal upload: ${err.message}` : 'Gagal upload file.',
      );
    } finally {
      setUmkmUploading(null);
    }
  };

  // ── Submit member verification ──
  const handleMemberSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMemberError(null);

    if (!memberKkUrl) {
      setMemberError('Foto KK Gereja wajib diupload.');
      return;
    }
    if (!memberWilayah) {
      setMemberError('Wilayah wajib dipilih.');
      return;
    }
    if (!memberLingkungan) {
      setMemberError('Lingkungan wajib dipilih.');
      return;
    }

    const userId = await getUserId();
    if (!userId) {
      setMemberError('Sesi berakhir. Silakan masuk kembali.');
      return;
    }

    setMemberSubmitting(true);
    try {
      const { error: insertErr } = await supabase.from('verification_requests').insert({
        user_id: userId,
        request_type: 'member',
        status: 'pending',
        kk_gereja_url: memberKkUrl.url,
        wilayah: memberWilayah,
        lingkungan: memberLingkungan,
      });
      if (insertErr) throw insertErr;

      setSubmitted(true);
      onRequestSubmitted?.();
    } catch (err) {
      setMemberError(
        err instanceof Error
          ? `Gagal mengirim: ${err.message}`
          : 'Gagal mengirim verifikasi.',
      );
    } finally {
      setMemberSubmitting(false);
    }
  };

  // ── Submit UMKM verification ──
  const handleUmkmSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setUmkmError(null);

    // Validate all fields
    if (!umkmFiles.kk_gereja) {
      setUmkmError('Foto KK Gereja wajib diupload.');
      return;
    }
    if (!umkmFiles.ktp) {
      setUmkmError('Foto KTP wajib diupload.');
      return;
    }
    if (!umkmFiles.catalog) {
      setUmkmError('Katalog produk wajib diupload.');
      return;
    }
    if (!umkmForm.owner_name.trim()) {
      setUmkmError('Nama pemilik wajib diisi.');
      return;
    }
    if (!umkmForm.business_name.trim()) {
      setUmkmError('Nama UMKM wajib diisi.');
      return;
    }
    if (!umkmForm.business_address.trim()) {
      setUmkmError('Alamat wajib diisi.');
      return;
    }
    if (!umkmForm.business_phone.trim()) {
      setUmkmError('No. HP wajib diisi.');
      return;
    }
    if (!umkmForm.category_id) {
      setUmkmError('Kategori wajib dipilih.');
      return;
    }
    if (!umkmWilayah) {
      setUmkmError('Wilayah wajib dipilih.');
      return;
    }
    if (!umkmLingkungan) {
      setUmkmError('Lingkungan wajib dipilih.');
      return;
    }

    const userId = await getUserId();
    if (!userId) {
      setUmkmError('Sesi berakhir. Silakan masuk kembali.');
      return;
    }

    setUmkmSubmitting(true);
    try {
      const { error: insertErr } = await supabase.from('verification_requests').insert({
        user_id: userId,
        request_type: 'umkm',
        status: 'pending',
        kk_gereja_url: umkmFiles.kk_gereja!.url,
        ktp_url: umkmFiles.ktp!.url,
        catalog_url: umkmFiles.catalog!.url,
        owner_name: umkmForm.owner_name.trim(),
        business_name: umkmForm.business_name.trim(),
        business_address: umkmForm.business_address.trim(),
        business_phone: umkmForm.business_phone.trim(),
        category_id: umkmForm.category_id,
        wilayah: umkmWilayah,
        lingkungan: umkmLingkungan,
      });
      if (insertErr) throw insertErr;

      setSubmitted(true);
      onRequestSubmitted?.();
    } catch (err) {
      setUmkmError(
        err instanceof Error
          ? `Gagal mengirim: ${err.message}`
          : 'Gagal mengirim verifikasi.',
      );
    } finally {
      setUmkmSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────
  // VERIFIED STATUS
  // ─────────────────────────────────────────────
  if (currentStatus === 'verified') {
    const isUmkm = currentType === 'umkm';
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-green-900">
                Terverifikasi sebagai {isUmkm ? 'UMKM' : 'Member'}
              </h2>
              <p className="mt-0.5 text-sm text-green-700">
                {isUmkm
                  ? 'Akun Anda telah terverifikasi sebagai pelaku UMKM.'
                  : 'Akun Anda telah terverifikasi sebagai anggota paroki.'}
              </p>
            </div>
          </div>

          {isUmkm ? (
            <div className="mt-6 space-y-3 border-t border-green-200 pt-6">
              <div className="flex items-start gap-2 text-sm text-green-800">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>Bisa memberikan review pada usaha di direktori</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-green-800">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>Bisa mendaftarkan dan mengelola usaha Anda</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-green-800">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>Menampilkan badge UMKM Terverifikasi di profil Anda</span>
              </div>
            </div>
          ) : (
            <div className="mt-6 border-t border-green-200 pt-6">
              <div className="rounded-xl bg-white/70 p-4">
                <div className="flex items-start gap-3">
                  <Store className="mt-0.5 h-5 w-5 flex-shrink-0 text-paroki-600" />
                  <div>
                    <p className="text-sm font-semibold text-paroki-900">
                      Ingin mendaftarkan usaha?
                    </p>
                    <p className="mt-1 text-sm text-paroki-700">
                      Anda dapat upgrade ke verifikasi UMKM untuk mendaftarkan dan
                      menampilkan usaha Anda di direktori Paroki UMKM.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // PENDING STATUS
  // ─────────────────────────────────────────────
  if (currentStatus === 'pending') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-500 text-white">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-yellow-900">
                Menunggu Review
              </h2>
              <p className="mt-0.5 text-sm text-yellow-700">
                Permintaan verifikasi{' '}
                <span className="font-semibold">
                  {currentType === 'umkm' ? 'UMKM' : 'Member'}
                </span>{' '}
                Anda sedang dalam proses review oleh admin.
              </p>
            </div>
          </div>
          <div className="mt-6 border-t border-yellow-200 pt-6">
            <div className="flex items-center gap-2 text-sm text-yellow-800">
              <Clock className="h-4 w-4" />
              <span>
                Proses verifikasi biasanya membutuhkan waktu 1–3 hari kerja.
                Anda akan mendapatkan notifikasi setelah proses selesai.
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // SUBMITTED SUCCESS
  // ─────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center sm:p-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h2 className="font-serif text-xl font-bold text-green-900">
            Permintaan Terkirim!
          </h2>
          <p className="mt-2 text-sm text-green-700">
            Permintaan verifikasi Anda telah berhasil dikirim. Tim admin akan
            meninjau dokumen Anda dalam 1–3 hari kerja.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            Muat Ulang Status
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // FORM VIEW (unverified / rejected)
  // ─────────────────────────────────────────────
  const inputClass =
    'w-full rounded-lg border border-paroki-200 bg-white px-4 py-2.5 text-sm text-paroki-900 outline-none transition focus:border-paroki-400 focus:ring-2 focus:ring-paroki-200';
  const labelClass = 'mb-1.5 block text-sm font-medium text-paroki-800';

  const ACCEPT_TYPES = 'image/jpeg,image/png,image/webp,application/pdf';

  // ── Reusable upload zone component ──
  const UploadZone = ({
    field,
    label,
    file,
    uploading,
    dragOver,
    onFileSelect,
    onDrop,
    onDragOver,
    onDragLeave,
    onRemove,
    error,
  }: {
    field: string;
    label: string;
    file: UploadedFile | null;
    uploading: boolean;
    dragOver: boolean;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onDrop: (e: DragEvent<HTMLDivElement>) => void;
    onDragOver: (e: DragEvent<HTMLDivElement>) => void;
    onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
    onRemove?: () => void;
    error?: string | null;
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
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="flex-shrink-0 rounded-lg p-1.5 text-paroki-400 transition hover:bg-red-50 hover:text-red-500"
              aria-label="Hapus file"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            onDragOver(e);
          }}
          onDragLeave={onDragLeave}
          onClick={() => {
            const input = document.getElementById(`upload-${field}`) as HTMLInputElement | null;
            input?.click();
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
            dragOver
              ? 'border-paroki-500 bg-paroki-50'
              : 'border-paroki-300 bg-white hover:bg-paroki-50'
          }`}
        >
          {uploading ? (
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
            onChange={onFileSelect}
            disabled={uploading}
            className="hidden"
            id={`upload-${field}`}
          />
        </div>
      )}
      {/* Hidden clickable overlay for the drop zone */}
      {!file && !uploading && (
        <label
          htmlFor={`upload-${field}`}
          className="sr-only"
        >
          {label}
        </label>
      )}
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      {/* Page header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-paroki-100 text-paroki-600">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-paroki-900 sm:text-3xl">
          Verifikasi Akun
        </h1>
        <p className="mt-2 text-sm text-paroki-600">
          Pilih jenis verifikasi untuk mendapatkan badge dan fitur tambahan
        </p>
      </div>

      {/* Rejected banner */}
      {currentStatus === 'rejected' && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-medium text-red-800">
              Permintaan verifikasi sebelumnya ditolak
            </p>
            <p className="mt-0.5 text-sm text-red-600">
              Silakan kirim ulang dengan dokumen yang sesuai.
            </p>
          </div>
        </div>
      )}

      {/* Two cards side by side */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* ════════════════════════════════════════
            CARD 1: MEMBER VERIFICATION
           ════════════════════════════════════════ */}
        <div className="rounded-2xl border border-paroki-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-paroki-100 text-paroki-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-paroki-900">
                Verifikasi Member
              </h2>
              <p className="text-xs text-paroki-500">Badge Member Terverifikasi</p>
            </div>
          </div>

          <p className="mb-4 text-sm leading-relaxed text-paroki-600">
            Dapatkan badge Member Terverifikasi untuk bisa memberikan review pada
            usaha di direktori.
          </p>

          {/* Requirements */}
          <div className="mb-5 rounded-lg bg-paroki-50/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-paroki-500">
              Persyaratan
            </p>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-sm text-paroki-700">
                <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
                <span>Foto KK Gereja Katolik Servas</span>
              </li>
            </ul>
          </div>

          <form onSubmit={handleMemberSubmit} className="space-y-4">
            {/* Wilayah + Lingkungan */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  Wilayah <span className="text-red-500">*</span>
                </label>
                <select
                  value={memberWilayah}
                  onChange={(e) => setMemberWilayah(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Pilih Wilayah...</option>
                  {wilayahList.map((w) => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  Lingkungan <span className="text-red-500">*</span>
                </label>
                <select
                  value={memberLingkungan}
                  onChange={(e) => setMemberLingkungan(e.target.value)}
                  disabled={!memberWilayah}
                  className={`${inputClass} disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400`}
                >
                  <option value="">
                    {memberWilayah ? 'Pilih Lingkungan...' : 'Pilih wilayah dulu...'}
                  </option>
                  {filteredMemberLing.map((l) => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <UploadZone
              field="member-kk"
              label="Foto KK Gereja"
              file={memberKkUrl}
              uploading={memberUploading}
              dragOver={memberDragOver}
              onFileSelect={handleMemberFile}
              onDrop={handleMemberDrop}
              onDragOver={() => setMemberDragOver(true)}
              onDragLeave={() => setMemberDragOver(false)}
              onRemove={() => setMemberKkUrl(null)}
              error={memberError}
            />

            <button
              type="submit"
              disabled={memberSubmitting || !memberKkUrl}
              className="w-full rounded-lg border-2 border-paroki-300 bg-white px-4 py-2.5 text-sm font-semibold text-paroki-700 transition hover:border-paroki-500 hover:bg-paroki-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {memberSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mengirim...
                </span>
              ) : (
                'Kirim Verifikasi Member'
              )}
            </button>
          </form>
        </div>

        {/* ════════════════════════════════════════
            CARD 2: UMKM VERIFICATION (RECOMMENDED)
           ════════════════════════════════════════ */}
        <div className="relative rounded-2xl border-2 border-paroki-600 bg-white p-6 shadow-lg shadow-paroki-100 sm:p-7 lg:-mt-2 lg:scale-[1.01]">
          {/* Recommended badge */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 lg:left-6 lg:translate-x-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-paroki-600 px-4 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-md">
              <Store className="h-3.5 w-3.5" />
              Direkomendasikan
            </span>
          </div>

          <div className="mb-5 flex items-center gap-3 pt-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-paroki-600 text-white">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-paroki-900">
                Verifikasi UMKM
              </h2>
              <p className="text-xs text-paroki-500">Badge UMKM Terverifikasi</p>
            </div>
          </div>

          <p className="mb-3 text-sm leading-relaxed text-paroki-600">
            Daftarkan usaha Anda dan dapatkan badge UMKM Terverifikasi untuk
            tampil di direktori Paroki UMKM.
          </p>

          <div className="mb-5 flex items-start gap-2 rounded-lg border border-paroki-100 bg-paroki-50/60 p-3">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-paroki-600" />
            <p className="text-sm text-paroki-700">
              <span className="font-semibold">Verifikasi UMKM otomatis mencakup
              verifikasi member.</span> Anda mendapat semua benefit member dan UMKM.
            </p>
          </div>

          {/* Requirements checklist */}
          <div className="mb-5 rounded-lg bg-paroki-50/60 p-3">
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

          <form onSubmit={handleUmkmSubmit} className="space-y-4">
            {/* KK Gereja */}
            <UploadZone
              field="umkm-kk"
              label="Upload Foto KK Gereja"
              file={umkmFiles.kk_gereja}
              uploading={umkmUploading === 'kk_gereja'}
              dragOver={umkmDragOver === 'kk_gereja'}
              onFileSelect={(e) => handleUmkmFile('kk_gereja', e)}
              onDrop={(e) => handleUmkmDrop('kk_gereja', e)}
              onDragOver={() => setUmkmDragOver('kk_gereja')}
              onDragLeave={() => setUmkmDragOver(null)}
              onRemove={() =>
                setUmkmFiles((prev) => ({ ...prev, kk_gereja: null }))
              }
            />

            {/* KTP */}
            <UploadZone
              field="umkm-ktp"
              label="Upload KTP"
              file={umkmFiles.ktp}
              uploading={umkmUploading === 'ktp'}
              dragOver={umkmDragOver === 'ktp'}
              onFileSelect={(e) => handleUmkmFile('ktp', e)}
              onDrop={(e) => handleUmkmDrop('ktp', e)}
              onDragOver={() => setUmkmDragOver('ktp')}
              onDragLeave={() => setUmkmDragOver(null)}
              onRemove={() =>
                setUmkmFiles((prev) => ({ ...prev, ktp: null }))
              }
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
                value={umkmForm.owner_name}
                onChange={(e) =>
                  setUmkmForm((p) => ({ ...p, owner_name: e.target.value }))
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
                value={umkmForm.business_name}
                onChange={(e) =>
                  setUmkmForm((p) => ({ ...p, business_name: e.target.value }))
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
                value={umkmForm.business_address}
                onChange={(e) =>
                  setUmkmForm((p) => ({ ...p, business_address: e.target.value }))
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
                  value={umkmForm.business_phone}
                  onChange={(e) =>
                    setUmkmForm((p) => ({ ...p, business_phone: e.target.value }))
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
                  value={umkmForm.category_id}
                  onChange={(e) =>
                    setUmkmForm((p) => ({ ...p, category_id: e.target.value }))
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

            {/* Wilayah + Lingkungan */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="umkm_wilayah" className={labelClass}>
                  Wilayah <span className="text-red-500">*</span>
                </label>
                <select
                  id="umkm_wilayah"
                  value={umkmWilayah}
                  onChange={(e) => setUmkmWilayah(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Pilih Wilayah...</option>
                  {wilayahList.map((w) => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="umkm_lingkungan" className={labelClass}>
                  Lingkungan <span className="text-red-500">*</span>
                </label>
                <select
                  id="umkm_lingkungan"
                  value={umkmLingkungan}
                  onChange={(e) => setUmkmLingkungan(e.target.value)}
                  disabled={!umkmWilayah}
                  className={`${inputClass} disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400`}
                >
                  <option value="">
                    {umkmWilayah ? 'Pilih Lingkungan...' : 'Pilih wilayah dulu...'}
                  </option>
                  {filteredUmkmLing.map((l) => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Catalog upload */}
            <UploadZone
              field="umkm-catalog"
              label="Upload Katalog Produk"
              file={umkmFiles.catalog}
              uploading={umkmUploading === 'catalog'}
              dragOver={umkmDragOver === 'catalog'}
              onFileSelect={(e) => handleUmkmFile('catalog', e)}
              onDrop={(e) => handleUmkmDrop('catalog', e)}
              onDragOver={() => setUmkmDragOver('catalog')}
              onDragLeave={() => setUmkmDragOver(null)}
              onRemove={() =>
                setUmkmFiles((prev) => ({ ...prev, catalog: null }))
              }
            />

            {umkmError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {umkmError}
              </div>
            )}

            <button
              type="submit"
              disabled={umkmSubmitting}
              className="w-full rounded-lg bg-paroki-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px"
            >
              {umkmSubmitting ? (
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
      </div>
    </div>
  );
}
