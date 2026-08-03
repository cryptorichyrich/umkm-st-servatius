import { useState, useEffect } from 'react';
import { supabase, type Profile } from '../../lib/supabase';
import {
  ShieldCheck,
  Clock,
  CheckCircle,
  Store,
  ArrowRight,
  XCircle,
} from 'lucide-react';

interface VerificationHubProps {
  currentStatus?: string;
  currentType?: string;
  verificationNote?: string;
}

export default function VerificationHub({
  currentStatus: propStatus,
  currentType: propType,
  verificationNote,
}: VerificationHubProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch profile on mount ──
  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = '/masuk';
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (data) setProfile(data as Profile);
      setLoading(false);
    })();
  }, []);

  const currentStatus = propStatus ?? profile?.verification_status ?? 'unverified';
  const currentType = propType ?? profile?.verification_type ?? '';
  const note = verificationNote ?? profile?.verification_note ?? '';

  // ── Loading state ──
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-paroki-100" />
          <div className="h-24 rounded-xl bg-paroki-100" />
          <div className="h-24 rounded-xl bg-paroki-100" />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PENDING STATUS
  // ═══════════════════════════════════════════════════════════════
  if (currentStatus === 'pending') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-paroki-100 text-paroki-600">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-paroki-900 sm:text-3xl">
            Verifikasi Akun
          </h1>
        </div>
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
        <div className="mt-6 text-center">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-paroki-200 bg-white px-5 py-2.5 text-sm font-semibold text-paroki-700 transition hover:bg-paroki-50"
          >
            ← Kembali ke Dashboard
          </a>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // VERIFIED — UMKM
  // ═══════════════════════════════════════════════════════════════
  if (currentStatus === 'verified' && currentType === 'umkm') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-green-900">
                Terverifikasi sebagai UMKM
              </h2>
              <p className="mt-0.5 text-sm text-green-700">
                Akun Anda telah terverifikasi sebagai pelaku UMKM.
              </p>
            </div>
          </div>

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
        </div>
        <div className="mt-6 text-center">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-paroki-200 bg-white px-5 py-2.5 text-sm font-semibold text-paroki-700 transition hover:bg-paroki-50"
          >
            ← Kembali ke Dashboard
          </a>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // VERIFIED — MEMBER
  // ═══════════════════════════════════════════════════════════════
  if (currentStatus === 'verified' && currentType === 'member') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-green-900">
                Terverifikasi sebagai Member
              </h2>
              <p className="mt-0.5 text-sm text-green-700">
                Akun Anda telah terverifikasi sebagai anggota paroki.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3 border-t border-green-200 pt-6">
            <div className="flex items-start gap-2 text-sm text-green-800">
              <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>Bisa memberikan review pada usaha di direktori</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-green-800">
              <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>Bisa menyimpan usaha dan produk ke favorit</span>
            </div>
          </div>
        </div>
        <div className="mt-6 text-center">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-paroki-200 bg-white px-5 py-2.5 text-sm font-semibold text-paroki-700 transition hover:bg-paroki-50"
          >
            ← Kembali ke Dashboard
          </a>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // UNVERIFIED / REJECTED — Show option cards
  // ═══════════════════════════════════════════════════════════════
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
              {note
                ? note
                : 'Silakan kirim ulang dengan dokumen yang sesuai.'}
            </p>
          </div>
        </div>
      )}

      {/* Two link cards */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* ══ MEMBER CARD ══ */}
        <a
          href="/dashboard/verifikasi/member"
          className="group block rounded-2xl border border-paroki-200 bg-white p-6 shadow-sm transition hover:border-paroki-300 hover:shadow-md sm:p-7"
        >
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

          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-paroki-600 transition group-hover:text-paroki-800">
            Mulai Verifikasi
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
        </a>

        {/* ══ UMKM CARD (RECOMMENDED) ══ */}
        <a
          href="/dashboard/verifikasi/umkm"
          className="group relative block rounded-2xl border-2 border-paroki-600 bg-white p-6 shadow-lg shadow-paroki-100 transition hover:shadow-xl sm:p-7 lg:-mt-2 lg:scale-[1.01]"
        >
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

          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-paroki-700 transition group-hover:text-paroki-900">
            Mulai Verifikasi
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
        </a>
      </div>

      {/* Back link */}
      <div className="mt-8 text-center">
        <a
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-paroki-500 transition hover:text-paroki-700"
        >
          ← Kembali ke Dashboard
        </a>
      </div>
    </div>
  );
}
