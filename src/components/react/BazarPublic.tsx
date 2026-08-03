import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Tent,
  Megaphone,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  Loader2,
  History,
  Store,
} from "lucide-react";
import {
  supabase,
  type Bazar,
  type BazarStatus,
  type TableArah,
} from "../../lib/supabase";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTanggal(tanggal: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(tanggal));
  } catch {
    return tanggal;
  }
}

function formatJam(jam: string | null): string {
  if (!jam) return "--:--";
  return jam.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ARAH_ORDER: TableArah[] = ["selatan", "timur", "utara"];
const ARAH_LABELS: Record<string, string> = {
  selatan: "Selatan",
  timur: "Timur",
  utara: "Utara",
  barat: "Barat",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  published: "bg-green-50 text-green-700 border-green-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  published: "Terbit",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

// ---------------------------------------------------------------------------
// Types for nested query result
// ---------------------------------------------------------------------------

interface TableAssignment {
  id: string;
  business_id: string;
  status: string;
  omset: number | null;
  business?: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    category?: { name: string } | null;
  };
}

interface BazarTableWithAssignments {
  id: string;
  bazar_id: string;
  nomor: number;
  label: string;
  arah: string;
  sort_order: number;
  assignments?: TableAssignment[];
}

type BazarWithTables = Bazar & {
  tables?: BazarTableWithAssignments[];
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BazarPublic() {
  const [bazars, setBazars] = useState<BazarWithTables[]>([]);
  const [pastBazars, setPastBazars] = useState<BazarWithTables[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch upcoming bazars
  // -------------------------------------------------------------------------

  const fetchBazars = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);

      const { data, error: err } = await supabase
        .from("bazars")
        .select(
          "*, tables:bazar_tables(*, assignments:bazar_assignments(*, business:businesses(id,name,slug,logo_url,category:categories(name))))"
        )
        .eq("status", "published")
        .gte("tanggal", today)
        .order("tanggal");

      if (err) throw err;

      setBazars((data ?? []) as unknown as BazarWithTables[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat data bazar");
    } finally {
      setLoading(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Fetch past bazars (on demand)
  // -------------------------------------------------------------------------

  const fetchPastBazars = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);

    try {
      const { data, error: err } = await supabase
        .from("bazars")
        .select(
          "*, tables:bazar_tables(*, assignments:bazar_assignments(*, business:businesses(id,name,slug,logo_url,category:categories(name))))"
        )
        .eq("status", "completed")
        .lt("tanggal", today)
        .order("tanggal", { ascending: false })
        .limit(10);

      if (err) throw err;

      setPastBazars((data ?? []) as unknown as BazarWithTables[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat bazar lampau");
    }
  }, []);

  useEffect(() => {
    void fetchBazars();
  }, [fetchBazars]);

  useEffect(() => {
    if (showPast && pastBazars.length === 0) {
      void fetchPastBazars();
    }
  }, [showPast, pastBazars.length, fetchPastBazars]);

  // -------------------------------------------------------------------------
  // Active banner (first bazar with active banner)
  // -------------------------------------------------------------------------

  const activeBanner = useMemo(
    () => bazars.find((b) => b.banner_aktif && b.banner_pesan),
    [bazars]
  );

  // -------------------------------------------------------------------------
  // Render: table layout section
  // -------------------------------------------------------------------------

  function renderTableLayout(bazar: BazarWithTables) {
    const tables = bazar.tables ?? [];

    if (tables.length === 0) {
      return (
        <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-400">
          Belum ada denah meja untuk bazar ini.
        </p>
      );
    }

    return (
      <div className="space-y-4">
        {ARAH_ORDER.map((arah) => {
          const groupTables = tables.filter((t) => t.arah === arah);
          if (groupTables.length === 0) return null;

          return (
            <div key={arah}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {ARAH_LABELS[arah] ?? arah}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {groupTables
                  .sort((a, b) => (a.nomor ?? 0) - (b.nomor ?? 0))
                  .map((t) => {
                    // first assignment with a business (or empty)
                    const assignment = (t.assignments ?? []).find(
                      (a) => a.business
                    );
                    const biz = assignment?.business;

                    return (
                      <div
                        key={t.id}
                        className={`flex min-h-[72px] flex-col gap-1 rounded-lg border-2 p-2.5 transition ${
                          biz
                            ? "border-gold-400 bg-gold-50"
                            : "border-dashed border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
                              biz
                                ? "bg-gold-500 text-paroki-900"
                                : "bg-gray-300 text-gray-600"
                            }`}
                          >
                            {t.nomor}
                          </span>
                          {biz && (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-gold-700">
                              Terisi
                            </span>
                          )}
                        </div>
                        {biz ? (
                          <a
                            href={`/umkm/${biz.slug}`}
                            className="group flex items-center gap-1.5 text-xs font-semibold text-paroki-800 hover:text-gold-700"
                          >
                            {biz.logo_url && (
                              <img
                                src={biz.logo_url}
                                alt=""
                                className="h-4 w-4 shrink-0 rounded-full object-cover"
                                loading="lazy"
                              />
                            )}
                            <span className="line-clamp-2 group-hover:underline">
                              {biz.name}
                            </span>
                          </a>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
                            <Store className="h-3.5 w-3.5" />
                            Tersedia
                          </span>
                        )}
                        {biz?.category?.name && (
                          <span className="text-[10px] text-gray-400">
                            {biz.category.name}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: single bazar card
  // -------------------------------------------------------------------------

  function renderBazarCard(bazar: BazarWithTables, isPast: boolean) {
    const tables = bazar.tables ?? [];
    const filledTables = tables.filter((t) =>
      (t.assignments ?? []).some((a) => a.business)
    ).length;

    return (
      <div
        key={bazar.id}
        className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
      >
        {/* Card header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-paroki-900 text-gold-500">
              <Tent className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-paroki-900">
                {bazar.nama}
              </h3>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatTanggal(bazar.tanggal ?? "")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatJam(bazar.jam_mulai)}–{formatJam(bazar.jam_selesai)}
                </span>
              </div>
            </div>
          </div>

          {isPast && (
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                STATUS_STYLES[bazar.status ?? "completed"] ??
                STATUS_STYLES.completed
              }`}
            >
              <CheckCircle className="h-3 w-3" />
              {STATUS_LABELS[bazar.status ?? "completed"] ?? bazar.status}
            </span>
          )}
        </div>

        {/* Card body */}
        <div className="px-5 py-4">
          {/* Lokasi */}
          {bazar.lokasi && (
            <p className="mb-3 flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4 shrink-0 text-gold-500" />
              {bazar.lokasi}
            </p>
          )}

          {/* Deskripsi */}
          {bazar.deskripsi && (
            <p className="mb-4 rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
              {bazar.deskripsi}
            </p>
          )}

          {/* Table count summary */}
          <div className="mb-4 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-paroki-700">
              <Tent className="h-4 w-4 text-gold-500" />
              {filledTables}/{tables.length} meja terisi
            </span>
          </div>

          {/* Table layout */}
          {renderTableLayout(bazar)}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
          <span className="ml-2 font-display text-gray-500">
            Memuat data bazar...
          </span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Page header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-paroki-900 text-gold-500">
          <Tent className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-paroki-900">
            Bazar UMKM
          </h1>
          <p className="text-sm text-gray-500">
            Jadwal bazar dan denah stand UMKM Paroki St. Servatius
          </p>
        </div>
      </div>

      {/* Active banner */}
      {activeBanner?.banner_pesan && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-gold-500 bg-gradient-to-r from-gold-50 to-gold-100 px-5 py-4 shadow-sm">
          <Megaphone className="mt-0.5 h-6 w-6 shrink-0 text-gold-600" />
          <div>
            <p className="font-display font-semibold text-gold-800">
              {activeBanner.nama}
            </p>
            <p className="mt-0.5 text-sm text-gold-700">
              {activeBanner.banner_pesan}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Upcoming bazars */}
      {bazars.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <Tent className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p className="font-display text-lg text-gray-500">
            Belum ada bazar yang dijadwalkan
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Pantau halaman ini untuk info bazar selanjutnya
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {bazars.map((b) => renderBazarCard(b, false))}
        </div>
      )}

      {/* Past bazars toggle */}
      <div className="mt-8 border-t border-gray-200 pt-6">
        <button
          onClick={() => setShowPast((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
        >
          <History className="h-4 w-4" />
          {showPast ? "Sembunyikan" : "Tampilkan"} Bazar Lampau
        </button>

        {showPast && (
          <div className="mt-4 space-y-6">
            {pastBazars.length === 0 ? (
              <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
                Belum ada bazar lampau.
              </p>
            ) : (
              pastBazars.map((b) => renderBazarCard(b, true))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
