import { useState, useEffect } from 'react';
import { supabase, type Profile } from '../../lib/supabase';
import {
  ShieldCheck,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface VerificationHubProps {
  currentStatus?: string;
  currentType?: string;
  verificationNote?: string;
}

export default function VerificationHub({
  currentStatus: propStatus,
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
  const note = verificationNote ?? profile?.verification_note ?? '';

  // ── Loading state ──
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-paroki-100" />
          <div className="h-32 rounded-xl bg-paroki-100" />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PENDING STATUS
  // ═══════════════════════════════════════════════════════════════
  if (currentStatus === 'pending') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-paroki-100 text-paroki-600">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-paroki-900 sm:text-3xl">
            Verifikasi Member
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
                Permintaan verifikasi Member Anda sedang dalam proses review oleh admin.
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
  // VERIFIED — MEMBER
  // ═══════════════════════════════════════════════════════════════
  if (currentStatus === 'verified') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
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
            <div className="flex items-start gap-2 text-sm text-green-800">
              <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>Bisa mendaftarkan usaha UMKM di dashboard</span>
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
  // UNVERIFIED / REJECTED — redirect to member verification form
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
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
          di direktori, menyimpan favorit, dan mendaftarkan usaha UMKM.
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

      {/* Requirements */}
      <div className="mb-6 rounded-lg bg-paroki-50/60 p-4">
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

      {/* CTA to member verification form */}
      <a
        href="/dashboard/verifikasi/member"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-paroki-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-paroki-700"
      >
        <ShieldCheck className="h-5 w-5" />
        Mulai Verifikasi Member
      </a>

      <div className="mt-6 text-center">
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
