import { useState, useEffect, useCallback, type FormEvent, type DragEvent } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ShieldCheck,
  Upload,
  FileText,
  CheckCircle,
  Loader2,
  X,
  ArrowLeft,
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface MemberVerificationProps {
  onRequestSubmitted?: () => void;
}

interface UploadedFile {
  url: string;
  name: string;
  isImage: boolean;
}

interface Wilayah {
  id: string;
  name: string;
}

interface LingkunganRow {
  id: string;
  name: string;
  wilayah_id: string;
}

const ACCEPT_TYPES = 'image/jpeg,image/png,image/webp,application/pdf';

const inputClass =
  'w-full rounded-lg border border-paroki-200 bg-white px-4 py-2.5 text-sm text-paroki-900 outline-none transition focus:border-paroki-400 focus:ring-2 focus:ring-paroki-200';
const labelClass = 'mb-1.5 block text-sm font-medium text-paroki-800';

export default function MemberVerification({ onRequestSubmitted }: MemberVerificationProps) {
  const [kkFile, setKkFile] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(true);

  // Wilayah & Lingkungan
  const [wilayahList, setWilayahList] = useState<Wilayah[]>([]);
  const [lingkunganList, setLingkunganList] = useState<LingkunganRow[]>([]);
  const [selectedWilayah, setSelectedWilayah] = useState('');
  const [selectedLingkungan, setSelectedLingkungan] = useState('');

  // ── Check auth + load data on mount ──
  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/masuk';
        return;
      }

      // Fetch wilayah + lingkungan in parallel
      const [{ data: wilayahData }, { data: lingData }] = await Promise.all([
        supabase.from('wilayah').select('id, name').order('name'),
        supabase.from('lingkungan').select('id, name, wilayah_id').order('name'),
      ]);
      setWilayahList((wilayahData || []) as Wilayah[]);
      setLingkunganList((lingData || []) as LingkunganRow[]);

      setLoading(false);
    })();
  }, []);

  // ── Reset lingkungan when wilayah changes ──
  useEffect(() => {
    setSelectedLingkungan('');
  }, [selectedWilayah]);

  // ── Filtered lingkungan based on selected wilayah ──
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

  // ── Upload file to verification-docs bucket ──
  const uploadFile = useCallback(
    async (file: File): Promise<UploadedFile | null> => {
      const userId = await getUserId();
      if (!userId) {
        setError('Sesi berakhir. Silakan masuk kembali.');
        return null;
      }

      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${userId}/kk_gereja-${Date.now()}.${ext}`;

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
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    setError(null);
    try {
      const result = await uploadFile(file);
      if (result) setKkFile(result);
    } catch (err) {
      setError(
        err instanceof Error ? `Gagal upload: ${err.message}` : 'Gagal upload file.',
      );
    } finally {
      setUploading(false);
    }
  };

  // ── Handle drag-and-drop ──
  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const result = await uploadFile(file);
      if (result) setKkFile(result);
    } catch (err) {
      setError(
        err instanceof Error ? `Gagal upload: ${err.message}` : 'Gagal upload file.',
      );
    } finally {
      setUploading(false);
    }
  };

  // ── Submit member verification ──
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!kkFile) {
      setError('Foto KK Gereja wajib diupload.');
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
      const { error: insertErr } = await supabase.from('verification_requests').insert({
        user_id: userId,
        request_type: 'member',
        status: 'pending',
        kk_gereja_url: kkFile.url,
        wilayah: selectedWilayah,
        lingkungan: selectedLingkungan,
      });
      if (insertErr) throw insertErr;

      setSubmitted(true);
      onRequestSubmitted?.();
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
            Permintaan verifikasi Member Anda telah berhasil dikirim. Tim admin akan
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
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-paroki-100 text-paroki-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-paroki-900">
              Verifikasi Member
            </h1>
            <p className="text-xs text-paroki-500">Badge Member Terverifikasi</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-paroki-600">
          Dapatkan badge Member Terverifikasi untuk bisa memberikan review pada usaha
          di direktori.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Requirements box */}
        <div className="rounded-lg bg-paroki-50/60 p-4">
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

        {/* ── Wilayah & Lingkungan — searchable cascading dropdowns ── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="wilayah" className={labelClass}>
              Wilayah <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              id="wilayah"
              value={selectedWilayah}
              onChange={setSelectedWilayah}
              options={wilayahList.map((w) => w.name)}
              placeholder="Cari wilayah..."
              emptyText="Wilayah tidak ditemukan"
            />
          </div>
          <div>
            <label htmlFor="lingkungan" className={labelClass}>
              Lingkungan <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              id="lingkungan"
              value={selectedLingkungan}
              onChange={setSelectedLingkungan}
              options={filteredLingkungan.map((l) => l.name)}
              placeholder={selectedWilayah ? 'Cari lingkungan...' : 'Pilih wilayah dulu...'}
              emptyText="Lingkungan tidak ditemukan"
              disabled={!selectedWilayah}
            />
          </div>
        </div>

        {/* Upload zone */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-paroki-800">
            Foto KK Gereja <span className="text-red-500">*</span>
          </label>
          {kkFile ? (
            <div className="flex items-center gap-3 rounded-xl border border-paroki-200 bg-white p-3">
              {kkFile.isImage ? (
                <img
                  src={kkFile.url}
                  alt={kkFile.name}
                  className="h-14 w-14 flex-shrink-0 rounded-lg border border-paroki-200 object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-paroki-200 bg-paroki-50">
                  <FileText className="h-6 w-6 text-paroki-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-paroki-800">{kkFile.name}</p>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Telah diupload</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKkFile(null)}
                className="flex-shrink-0 rounded-lg p-1.5 text-paroki-400 transition hover:bg-red-50 hover:text-red-500"
                aria-label="Hapus file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => {
                const input = document.getElementById('upload-kk-gereja') as HTMLInputElement | null;
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
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
                id="upload-kk-gereja"
              />
            </div>
          )}
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
          disabled={submitting || !kkFile || !selectedWilayah || !selectedLingkungan}
          className="w-full rounded-lg border-2 border-paroki-300 bg-white px-4 py-2.5 text-sm font-semibold text-paroki-700 transition hover:border-paroki-500 hover:bg-paroki-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
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
  );
}
