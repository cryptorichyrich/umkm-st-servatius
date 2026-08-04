import { useEffect, useState, useCallback } from "react";
import {
  Megaphone,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  Loader2,
  DollarSign,
  Users,
  AlertCircle,
  FileText,
  ExternalLink,
  Upload,
  Copy,
  ShieldAlert,
  CreditCard,
  Store,
} from "lucide-react";
import { BazarCardSkeleton } from "./SkeletonLoader";
import {
  supabase,
  type Bazar,
  type BazarAssignment,
  type AssignmentStatus,
} from "../../lib/supabase";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BazarScheduleProps {
  businessId: string;
  businessName: string;
}

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

function formatIDR(n: number): string {
  return "Rp" + new Intl.NumberFormat("id-ID").format(n ?? 0);
}

/** Parse an IDR-formatted string (e.g. "Rp1.500.000") back to a number. */
function parseIDR(str: string): number {
  return parseInt(str.replace(/[^\d]/g, ""), 10) || 0;
}

/** Live-format user keystrokes into IDR display. */
function formatIDRInput(str: string): string {
  const num = parseIDR(str);
  if (num === 0) return "";
  return new Intl.NumberFormat("id-ID").format(num);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ASSIGN_STYLES: Record<AssignmentStatus, string> = {
  assigned: "bg-yellow-50 text-yellow-700 border-yellow-200",
  confirmed: "bg-green-50 text-green-700 border-green-200",
  absent: "bg-red-50 text-red-700 border-red-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
};

const ASSIGN_LABELS: Record<AssignmentStatus, string> = {
  assigned: "Menunggu Konfirmasi",
  confirmed: "Dikonfirmasi",
  absent: "Tidak Hadir",
  completed: "Selesai",
};

// ---------------------------------------------------------------------------
// Assignment with nested bazar/table data (from joined query)
// ---------------------------------------------------------------------------

type AssignmentWithRelations = BazarAssignment & {
  bazar?: Bazar;
  table?: {
    id: string;
    nomor: number;
    label: string;
    arah: string;
  };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BazarSchedule({
  businessId,
  businessName,
}: BazarScheduleProps) {
  const [assignments, setAssignments] = useState<AssignmentWithRelations[]>([]);
  const [waitlistBazars, setWaitlistBazars] = useState<Bazar[]>([]);
  const [waitlistIds, setWaitlistIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // action loading per assignment id
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // omset input per assignment id
  const [omsetInputs, setOmsetInputs] = useState<Record<string, string>>({});
  const [omsetSubmitting, setOmsetSubmitting] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Fetch assignments
  // -------------------------------------------------------------------------

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("bazar_assignments")
        .select("*, bazar:bazars(*), table:bazar_tables(*)")
        .eq("business_id", businessId)
        .order("tanggal", { referencedTable: "bazar", ascending: false });

      if (err) throw err;

      setAssignments((data ?? []) as unknown as AssignmentWithRelations[]);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Gagal memuat jadwal bazar Anda"
      );
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  // -------------------------------------------------------------------------
  // Fetch upcoming bazars for waitlist + existing waitlist entries
  // -------------------------------------------------------------------------

  const fetchWaitlistData = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);

      // Step 1: Find published bazars where at least one assigned participant
      // has declined (status = "absent"), meaning a spot opened up.
      const { data: absentData, error: absentErr } = await supabase
        .from("bazar_assignments")
        .select("bazar_id, bazar:bazars!inner(*)")
        .eq("status", "absent")
        .gt("bazar.tanggal", today);

      if (absentErr) throw absentErr;

      // Deduplicate bazars that have absent participants
      const bazarMap = new Map<string, Bazar>();
      for (const row of absentData ?? []) {
        const b = (row as unknown as { bazar: Bazar }).bazar;
        if (b && b.status === "published" && !bazarMap.has(b.id)) {
          bazarMap.set(b.id, b);
        }
      }
      const openBazars = Array.from(bazarMap.values());

      // Step 2: Get current user's waitlist entries
      const [waitlistRes] = await Promise.all([
        supabase
          .from("bazar_waitlist")
          .select("bazar_id")
          .eq("business_id", businessId)
          .eq("status", "waiting"),
      ]);

      setWaitlistBazars(openBazars);

      const wlSet = new Set(
        ((waitlistRes.data ?? []) as { bazar_id: string }[]).map(
          (w) => w.bazar_id
        )
      );
      setWaitlistIds(wlSet);
    } catch {
      // non-fatal — don't override the main error
    }
  }, [businessId]);

  useEffect(() => {
    void fetchAssignments();
    void fetchWaitlistData();
  }, [fetchAssignments, fetchWaitlistData]);

  // -------------------------------------------------------------------------
  // Derived: active banner (from the most recent bazar with active banner)
  // -------------------------------------------------------------------------

  const [localRegulasiChecked, setLocalRegulasiChecked] = useState<Record<string, boolean>>({});
  const [confirmDialogAssignment, setConfirmDialogAssignment] = useState<AssignmentWithRelations | null>(null);
  const activeBanner = assignments
    .map((a) => a.bazar)
    .find((b) => b?.banner_aktif && b?.banner_pesan);

  // -------------------------------------------------------------------------
  // Actions: confirm / decline
  // -------------------------------------------------------------------------

  async function handleConfirm(a: AssignmentWithRelations) {
    setActionLoading(a.id);
    setError(null);
    try {
      const now = new Date().toISOString();
      const update: Record<string, unknown> = {
        status: "confirmed",
        confirmed_at: now,
      };
      // Mark regulasi as accepted together with confirmation
      if (a.bazar?.regulasi_url) {
        update.regulasi_accepted = true;
        update.regulasi_accepted_at = now;
      }
      const { error: err } = await supabase
        .from("bazar_assignments")
        .update(update)
        .eq("id", a.id);
      if (err) throw err;

      setAssignments((prev) =>
        prev.map((x) =>
          x.id === a.id
            ? {
                ...x,
                status: "confirmed",
                confirmed_at: now,
                ...(a.bazar?.regulasi_url
                  ? { regulasi_accepted: true, regulasi_accepted_at: now }
                  : {}),
              }
            : x
        )
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal mengonfirmasi kehadiran");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDecline(a: AssignmentWithRelations) {
    setActionLoading(a.id);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("bazar_assignments")
        .update({ status: "absent" })
        .eq("id", a.id);
      if (err) throw err;

      setAssignments((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, status: "absent" } : x))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memperbarui status");
    } finally {
      setActionLoading(null);
    }
  }

  // -------------------------------------------------------------------------
  // Actions: omset reporting
  // -------------------------------------------------------------------------

  async function handleOmsetSubmit(a: AssignmentWithRelations) {
    const raw = omsetInputs[a.id] ?? "";
    const omset = parseIDR(raw);
    if (omset <= 0) {
      setError("Masukkan jumlah omset yang valid");
      return;
    }
    setOmsetSubmitting(a.id);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("bazar_assignments")
        .update({
          omset,
          omset_reported_at: new Date().toISOString(),
        })
        .eq("id", a.id);
      if (err) throw err;

      setAssignments((prev) =>
        prev.map((x) =>
          x.id === a.id
            ? {
                ...x,
                omset,
                omset_reported_at: new Date().toISOString(),
              }
            : x
        )
      );
      setOmsetInputs((prev) => {
        const next = { ...prev };
        delete next[a.id];
        return next;
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan laporan omset");
    } finally {
      setOmsetSubmitting(null);
    }
  }

  // -------------------------------------------------------------------------
  // Actions: join waitlist
  // -------------------------------------------------------------------------

  async function handleJoinWaitlist(bazarId: string) {
    setError(null);
    try {
      const { error: err } = await supabase
        .from("bazar_waitlist")
        .insert({
          bazar_id: bazarId,
          business_id: businessId,
          status: "waiting",
        });
      if (err) throw err;

      setWaitlistIds((prev) => new Set(prev).add(bazarId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal bergabung daftar tunggu");
    }
  }

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  function renderStatusBadge(status: AssignmentStatus) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
          ASSIGN_STYLES[status] ?? ASSIGN_STYLES.assigned
        }`}
      >
        {status === "confirmed" && <CheckCircle className="h-3 w-3" />}
        {status === "absent" && <XCircle className="h-3 w-3" />}
        {ASSIGN_LABELS[status] ?? status}
      </span>
    );
  }

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-4">
        <BazarCardSkeleton />
        <BazarCardSkeleton />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-paroki-900 text-gold-500">
          <Store className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-paroki-900">
            Jadwal Bazar
          </h1>
          <p className="text-sm text-gray-500">
            {businessName} — jadwal dan penugasan meja Anda
          </p>
        </div>
      </div>

      {/* Active banner */}
      {activeBanner?.banner_pesan && (
        <div className="sticky top-0 z-10 mb-6 flex items-start gap-3 rounded-lg border border-gold-500 bg-gradient-to-r from-gold-50 to-gold-100 px-4 py-3 shadow-sm">
          <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
          <div>
            <p className="font-display text-sm font-semibold text-gold-700">
              Pengumuman Bazar {activeBanner.nama}
            </p>
            <p className="mt-0.5 text-sm text-gold-800">
              {activeBanner.banner_pesan}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Schedule list */}
      {assignments.length === 0 ? (
        <div className="mb-8 rounded-lg border-2 border-dashed border-gray-200 py-20 text-center">
          <Calendar className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="font-display text-gray-500">
            Belum ada jadwal bazar untuk Anda
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Anda akan ditugaskan ke bazar berikutnya oleh panitia
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => {
            const bazar = a.bazar;
            if (!bazar) return null;

            const isCompletedBazar = bazar.status === "completed";
            const omsetReported = a.omset != null && a.omset > 0;
            const showOmsetForm = isCompletedBazar && !omsetReported;
            const showConfirmButtons = a.status === "assigned";
            const hasRegulasi = !!bazar.regulasi_url;
            const regulasiCheckedLocal = !!localRegulasiChecked[a.id];
            const showRegulasiGate = showConfirmButtons && hasRegulasi;
            const canConfirm = !hasRegulasi || regulasiCheckedLocal;

            return (
              <div
                key={a.id}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
              >
                {/* Card header */}
                <div className="border-b border-gray-100 bg-gray-50/50 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-paroki-900">
                      {bazar.nama}
                    </h3>
                    {a.status && renderStatusBadge(a.status)}
                  </div>
                </div>

                {/* Card body */}
                <div className="px-5 py-4">
                  {/* Info grid */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <p className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4 shrink-0 text-gold-500" />
                      {formatTanggal(bazar.tanggal ?? "")}
                    </p>
                    <p className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4 shrink-0 text-gold-500" />
                      {formatJam(bazar.jam_mulai)} – {formatJam(bazar.jam_selesai)}
                    </p>
                    {bazar.lokasi && (
                      <p className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="h-4 w-4 shrink-0 text-gold-500" />
                        {bazar.lokasi}
                      </p>
                    )}
                    {a.table && (
                      <p className="flex items-center gap-2 text-sm text-gray-600">
                        <Store className="h-4 w-4 shrink-0 text-gold-500" />
                        Meja {a.table.nomor}
                        {a.table.arah && ` · ${capitalize(a.table.arah)}`}
                      </p>
                    )}
                  </div>

                  {/* Deskripsi */}
                  {bazar.deskripsi && (
                    <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
                      {bazar.deskripsi}
                    </p>
                  )}

                  {/* Regulasi Gate — must check before confirming */}
                  {showRegulasiGate && (
                    <div className="mt-4 rounded-lg border-2 border-gold-300 bg-gold-50 p-4">
                      <div className="flex items-start gap-3">
                        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-paroki-900">
                            Wajib Baca Regulasi Bazar
                          </p>
                          <p className="mt-0.5 text-xs text-gray-600">
                            Anda harus membaca dan menyetujui regulasi sebelum dapat mengonfirmasi kehadiran.
                          </p>
                          <a
                            href={bazar.regulasi_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-gold-600"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Baca Regulasi (PDF)
                          </a>
                          <label className="mt-3 flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={regulasiCheckedLocal}
                              onChange={(e) =>
                                setLocalRegulasiChecked((prev) => ({
                                  ...prev,
                                  [a.id]: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 rounded border-gray-300 text-paroki-700 focus:ring-paroki-700"
                            />
                            <span className="text-sm font-medium text-gray-700">
                              Saya telah membaca dan menyetujui regulasi bazar
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Regulasi accepted badge — only after confirmed */}
                  {hasRegulasi && a.regulasi_accepted && a.status !== "assigned" && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-green-600">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Regulasi bazar telah disetujui
                    </div>
                  )}

                  {/* Confirm / Decline buttons */}
                  {showConfirmButtons && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        disabled={actionLoading === a.id || !canConfirm}
                        onClick={() => setConfirmDialogAssignment(a)}
                        title={!canConfirm ? "Setujui regulasi terlebih dahulu" : undefined}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Saya Hadir
                      </button>
                      <button
                        disabled={actionLoading === a.id}
                        onClick={() => handleDecline(a)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Tidak Bisa
                      </button>
                    </div>
                  )}

                  {/* ─── Payment Section (confirmed participants) ─── */}
                  {a.status === "confirmed" && bazar.bank_rekening && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      {/* Payment status badge */}
                      {a.payment_status === "approved" && (
                        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                          <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
                          <div>
                            <p className="text-xs font-medium text-green-600">
                              Pembayaran Dikonfirmasi ✓
                            </p>
                            <p className="text-xs text-green-500">
                              Partisipasi Anda lunas. Terima kasih!
                            </p>
                          </div>
                        </div>
                      )}
                      {a.payment_status === "pending_review" && (
                        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
                          <Clock className="h-5 w-5 shrink-0 text-yellow-600" />
                          <div>
                            <p className="text-xs font-medium text-yellow-700">
                              Bukti Pembayaran Diterima
                            </p>
                            <p className="text-xs text-yellow-500">
                              Menunggu konfirmasi panitia.
                            </p>
                          </div>
                        </div>
                      )}
                      {a.payment_status === "rejected" && (
                        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                          <div>
                            <p className="text-xs font-medium text-red-700">
                              Bukti Pembayaran Ditolak
                            </p>
                            {a.payment_reject_note && (
                              <p className="text-xs text-red-500">
                                {a.payment_reject_note}
                              </p>
                            )}
                            <p className="mt-0.5 text-xs text-red-400">
                              Silakan upload ulang bukti transfer.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Proof image — ALWAYS visible if uploaded */}
                      {a.payment_proof_url && (
                        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                          <p className="border-b border-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500">
                            Bukti Transfer
                          </p>
                          {a.payment_proof_url.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                            <a
                              href={a.payment_proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <img
                                src={a.payment_proof_url}
                                alt="Bukti transfer"
                                className="max-h-64 w-full object-contain"
                              />
                            </a>
                          ) : (
                            <a
                              href={a.payment_proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-3 text-sm text-paroki-600 hover:underline"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Lihat bukti transfer (PDF)
                            </a>
                          )}
                        </div>
                      )}

                      {/* Bank details + upload form — only if no proof, or rejected */}
                      {(!a.payment_proof_url || a.payment_status === "rejected") && (
                        <>
                          {/* Custom payment message */}
                          {bazar.pembayaran_pesan && (
                            <div className="mt-3 rounded-lg border border-paroki-200 bg-paroki-50/50 px-4 py-3">
                              <p className="text-sm text-paroki-700">
                                {bazar.pembayaran_pesan}
                              </p>
                            </div>
                          )}

                          {/* Bank details card */}
                          <div className="mt-3 rounded-lg border-2 border-paroki-300 bg-white overflow-hidden">
                            <div className="flex items-center gap-2 bg-paroki-900 px-4 py-2.5">
                              <CreditCard className="h-4 w-4 text-gold-400" />
                              <span className="font-display text-sm font-bold text-white">
                                Transfer Pembayaran
                              </span>
                            </div>
                            <div className="px-4 py-3 space-y-2">
                              {bazar.biaya_partisipasi != null && bazar.biaya_partisipasi > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Jumlah</span>
                                  <span className="font-display font-bold text-paroki-900">
                                    Rp {bazar.biaya_partisipasi.toLocaleString("id-ID")}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">Bank</span>
                                <span className="text-sm font-medium text-gray-800">{bazar.bank_nama}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">No. Rekening</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-bold text-gray-800">{bazar.bank_rekening}</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard?.writeText(bazar.bank_rekening);
                                    }}
                                    className="text-gray-400 transition hover:text-paroki-600"
                                    title="Salin nomor rekening"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">Atas Nama</span>
                                <span className="text-sm font-medium text-gray-800">{bazar.bank_atas_nama}</span>
                              </div>
                            </div>
                          </div>

                          {/* Anti-scam warning */}
                          {bazar.anti_scam_pesan && (
                            <div className="mt-3 flex items-start gap-2.5 rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3">
                              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                              <div>
                                <p className="text-xs font-bold text-red-800 mb-1">
                                  ⚠️ PERINGATAN KEAMANAN
                                </p>
                                <p className="text-xs leading-relaxed text-red-700">
                                  {bazar.anti_scam_pesan}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Upload proof */}
                          <div className="mt-3">
                            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-paroki-300 bg-paroki-50/30 px-4 py-3 text-sm font-medium text-paroki-700 transition hover:bg-paroki-50">
                              <Upload className="h-4 w-4" />
                              {a.payment_status === "rejected" ? "Upload Ulang Bukti Transfer" : "Upload Bukti Transfer"}
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setActionLoading(a.id);
                                  const fname = `${a.id}-${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
                                  const { error: ulErr } = await supabase.storage
                                    .from("bazar-files")
                                    .upload(fname, file);
                                  if (ulErr) {
                                    setError("Gagal upload: " + ulErr.message);
                                    setActionLoading(null);
                                    return;
                                  }
                                  const { data: pub } = supabase.storage
                                    .from("bazar-files")
                                    .getPublicUrl(fname);
                                  const { error: updErr } = await supabase
                                    .from("bazar_assignments")
                                    .update({
                                      payment_proof_url: pub.publicUrl,
                                      payment_status: "pending_review",
                                      payment_uploaded_at: new Date().toISOString(),
                                    })
                                    .eq("id", a.id);
                                  setActionLoading(null);
                                  if (updErr) {
                                    setError("Gagal menyimpan: " + updErr.message);
                                    return;
                                  }
                                  setAssignments((prev) =>
                                    prev.map((x) =>
                                      x.id === a.id
                                        ? {
                                            ...x,
                                            payment_proof_url: pub.publicUrl,
                                            payment_status: "pending_review",
                                            payment_uploaded_at: new Date().toISOString(),
                                          }
                                        : x
                                    )
                                  );
                                }}
                              />
                            </label>
                            {actionLoading === a.id && (
                              <p className="mt-1 text-center text-xs text-gray-400">
                                <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                                Mengunggah...
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Omset reporting */}
                  {isCompletedBazar && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      {omsetReported ? (
                        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                          <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
                          <div>
                            <p className="text-xs font-medium text-green-600">
                              Omset Dilaporkan
                            </p>
                            <p className="font-display text-lg font-bold text-green-700">
                              {formatIDR(a.omset ?? 0)}
                            </p>
                          </div>
                        </div>
                      ) : showOmsetForm ? (
                        <div className="rounded-lg border border-gold-300 bg-gold-50/50 p-4">
                          <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-paroki-900">
                            <DollarSign className="h-4 w-4 text-gold-600" />
                            Laporan Omset (Wajib)
                          </label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <div className="relative flex-1">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                                Rp
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={formatIDRInput(omsetInputs[a.id] ?? "")}
                                onChange={(e) =>
                                  setOmsetInputs((prev) => ({
                                    ...prev,
                                    [a.id]: e.target.value,
                                  }))
                                }
                                placeholder="0"
                                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-paroki-700 focus:outline-none focus:ring-1 focus:ring-paroki-700"
                              />
                            </div>
                            <button
                              disabled={omsetSubmitting === a.id}
                              onClick={() => handleOmsetSubmit(a)}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold-500 px-5 py-2 text-sm font-semibold text-paroki-900 transition hover:bg-gold-600 disabled:opacity-50"
                            >
                              {omsetSubmitting === a.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Menyimpan...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4" />
                                  Laporkan
                                </>
                              )}
                            </button>
                          </div>
                          <p className="mt-1.5 text-xs text-gray-400">
                            Masukkan total penjualan kotor Anda selama bazar ini.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Waitlist section — only shows bazars with open spots from absent participants */}
      {waitlistBazars.length > 0 && (
        <section className="mt-8">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-gold-500" />
            <h2 className="font-display text-lg font-bold text-paroki-900">
              Lowongan Tersedia
            </h2>
          </div>
          <p className="mb-3 text-sm text-gray-500">
            Ada peserta bazar yang tidak bisa hadir. Daftar segera sebelum panitia menutup lowongan!
          </p>

          <div className="space-y-3">
            {waitlistBazars.map((b) => {
              const alreadyAssigned = assignments.some(
                (a) => a.bazar_id === b.id
              );
              const onWaitlist = waitlistIds.has(b.id);

              return (
                <div
                  key={b.id}
                  className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="font-display font-bold text-paroki-900">
                      {b.nama}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatTanggal(b.tanggal ?? "")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatJam(b.jam_mulai)}–{formatJam(b.jam_selesai)}
                      </span>
                      {b.lokasi && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {b.lokasi}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {alreadyAssigned ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700">
                        <CheckCircle className="h-4 w-4" />
                        Sudah ditugaskan
                      </span>
                    ) : onWaitlist ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-sm font-medium text-yellow-700">
                        <Clock className="h-4 w-4" />
                        Di daftar tunggu
                      </span>
                    ) : (
                      <button
                        onClick={() => handleJoinWaitlist(b.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-paroki-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-paroki-800"
                      >
                        <Users className="h-4 w-4" />
                        Gabung Daftar Tunggu
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Confirmation dialog */}
      {confirmDialogAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-100">
                <FileText className="h-5 w-5 text-gold-600" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-paroki-900">
                  Konfirmasi Kehadiran
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  {confirmDialogAssignment.bazar?.regulasi_url
                    ? "Pastikan Anda sudah membaca regulasi UMKM. Dengan menekan \"Ya, Saya Hadir\", Anda menyatakan telah membaca dan menyetujui seluruh regulasi bazar."
                    : "Anda akan mengonfirmasi kehadiran untuk bazar ini. Lanjutkan?"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDialogAssignment(null)}
                disabled={actionLoading === confirmDialogAssignment.id}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const a = confirmDialogAssignment;
                  setConfirmDialogAssignment(null);
                  handleConfirm(a);
                }}
                disabled={actionLoading === confirmDialogAssignment.id}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading === confirmDialogAssignment.id ? "Memproses..." : "Ya, Saya Hadir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
