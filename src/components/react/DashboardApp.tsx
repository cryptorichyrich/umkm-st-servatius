import { useState, useEffect } from 'react';
import {
  supabase,
  type Business,
  type Profile,
  type BusinessStatus,
} from '../../lib/supabase';

// ----- Status badge helper -----
function StatusBadge({ status }: { status: BusinessStatus }) {
  const styles: Record<BusinessStatus, string> = {
    draft: 'bg-gray-100 text-gray-700',
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };
  const labels: Record<BusinessStatus, string> = {
    draft: 'Draft',
    pending: 'Menunggu Review',
    approved: 'Disetujui',
    rejected: 'Ditolak',
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

interface BusinessRow extends Business {
  category?: { id: string; name: string; slug: string; icon: string; sort_order: number };
}

export default function DashboardApp() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = '/masuk';
        return;
      }

      const userId = session.user.id;

      // Fetch profile
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileErr) {
        console.error('Profile fetch error:', profileErr);
      } else {
        setProfile(profileData as Profile);
      }

      // Fetch businesses with category join
      const { data: bizData, error: bizErr } = await supabase
        .from('businesses')
        .select(
          `
          *,
          category:categories(*)
        `,
        )
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (bizErr) {
        console.error('Businesses fetch error:', bizErr);
        setError('Gagal memuat data usaha. Silakan coba lagi.');
      } else {
        setBusinesses((bizData || []) as BusinessRow[]);
      }

      setLoading(false);
    })();
  }, []);

  const handleSubmitForReview = async (businessId: string) => {
    setSubmittingId(businessId);
    try {
      const { error: rpcErr } = await supabase.rpc('submit_for_review', {
        business_id: businessId,
      });
      if (rpcErr) throw rpcErr;

      // Update local state
      setBusinesses((prev) =>
        prev.map((b) => (b.id === businessId ? { ...b, status: 'pending' } : b)),
      );
    } catch (err) {
      alert(
        err instanceof Error
          ? `Gagal mengirim untuk review: ${err.message}`
          : 'Gagal mengirim untuk review.',
      );
    } finally {
      setSubmittingId(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // ---- Loading state ----
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-paroki-900">Dashboard</h1>
          <p className="mt-1 text-sm text-paroki-600">
            {profile?.full_name
              ? `Selamat datang, ${profile.full_name}!`
              : 'Kelola usaha Anda di sini.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/dashboard/baru"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-paroki-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-paroki-700"
          >
            <span>+</span> Tambah Usaha Baru
          </a>
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            Keluar
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Businesses list */}
      {businesses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-paroki-300 bg-white py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-paroki-50 text-paroki-400">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5 5.5 5h13L20 9.5M4 9.5h16M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5M9.5 20v-4.5h5V20"/></svg>
          </div>
          <p className="font-medium text-paroki-700">Belum ada usaha terdaftar</p>
          <p className="mt-1 text-sm text-paroki-400">
            Klik "Tambah Usaha Baru" untuk mulai mendaftarkan usaha Anda.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-paroki-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-paroki-200 bg-paroki-50 text-paroki-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nama Usaha</th>
                  <th className="px-4 py-3 font-semibold">Kategori</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Dibuat</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paroki-100">
                {businesses.map((b) => (
                  <tr key={b.id} className="hover:bg-paroki-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-paroki-900">{b.name}</div>
                      {b.status === 'rejected' && b.rejection_note && (
                        <div className="mt-1 max-w-xs text-xs text-red-600">
                          Catatan: {b.rejection_note}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-paroki-600">
                      {b.category ? `${b.category.icon} ${b.category.name}` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3 text-paroki-500">
                      {formatDate(b.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {b.status === 'approved' && (
                          <a
                            href={`/umkm/${b.slug}`}
                            className="rounded-md border border-paroki-200 px-3 py-1.5 text-xs font-medium text-paroki-700 hover:bg-paroki-50"
                          >
                            Lihat
                          </a>
                        )}
                        <a
                          href={`/dashboard/edit?id=${b.id}`}
                          className="rounded-md border border-paroki-200 px-3 py-1.5 text-xs font-medium text-paroki-700 hover:bg-paroki-50"
                        >
                          Edit
                        </a>
                        {b.status === 'draft' && (
                          <button
                            onClick={() => handleSubmitForReview(b.id)}
                            disabled={submittingId === b.id}
                            className="rounded-md bg-paroki-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {submittingId === b.id ? 'Mengirim...' : 'Kirim untuk Review'}
                          </button>
                        )}
                        {b.status === 'rejected' && (
                          <button
                            onClick={() => handleSubmitForReview(b.id)}
                            disabled={submittingId === b.id}
                            className="rounded-md bg-paroki-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {submittingId === b.id ? 'Mengirim...' : 'Kirim Ulang'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {businesses.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-paroki-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium text-paroki-900">{b.name}</h3>
                    <p className="mt-0.5 text-xs text-paroki-500">
                      {b.category ? `${b.category.icon} ${b.category.name}` : 'Tanpa kategori'}
                      {' · '}
                      {formatDate(b.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>

                {b.status === 'rejected' && b.rejection_note && (
                  <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                    Catatan penolakan: {b.rejection_note}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {b.status === 'approved' && (
                    <a
                      href={`/umkm/${b.slug}`}
                      className="rounded-md border border-paroki-200 px-3 py-1.5 text-xs font-medium text-paroki-700 hover:bg-paroki-50"
                    >
                      Lihat
                    </a>
                  )}
                  <a
                    href={`/dashboard/edit?id=${b.id}`}
                    className="rounded-md border border-paroki-200 px-3 py-1.5 text-xs font-medium text-paroki-700 hover:bg-paroki-50"
                  >
                    Edit
                  </a>
                  {(b.status === 'draft' || b.status === 'rejected') && (
                    <button
                      onClick={() => handleSubmitForReview(b.id)}
                      disabled={submittingId === b.id}
                      className="rounded-md bg-paroki-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submittingId === b.id
                        ? 'Mengirim...'
                        : b.status === 'rejected'
                          ? 'Kirim Ulang'
                          : 'Kirim untuk Review'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
