import { useEffect, useState, useCallback } from "react";
import {
  Tent,
  Plus,
  Trash2,
  Copy,
  CheckCircle,
  Clock,
  XCircle,
  ChevronRight,
  Users,
  Megaphone,
  Calendar,
  MapPin,
  DollarSign,
} from "lucide-react";
import {
  supabase,
  type Bazar,
  type BazarTable,
  type BazarAssignment,
  type BazarWaitlist,
  type BazarStatus,
  type AssignmentStatus,
  type TableArah,
  type Business,
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

function formatIDR(n: number): string {
  return "Rp" + new Intl.NumberFormat("id-ID").format(n ?? 0);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<BazarStatus, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  published: "bg-green-50 text-green-700 border-green-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABELS: Record<BazarStatus, string> = {
  draft: "Draft",
  published: "Terbit",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

const ASSIGN_STYLES: Record<AssignmentStatus, string> = {
  assigned: "bg-yellow-50 text-yellow-700 border-yellow-200",
  confirmed: "bg-green-50 text-green-700 border-green-200",
  absent: "bg-red-50 text-red-700 border-red-200",
};

const ASSIGN_LABELS: Record<AssignmentStatus, string> = {
  assigned: "Ditugaskan",
  confirmed: "Dikonfirmasi",
  absent: "Tidak Hadir",
};

const ARAH_ORDER: TableArah[] = ["selatan", "timur", "utara"];
const ARAH_LABELS: Record<TableArah, string> = {
  selatan: "Selatan",
  timur: "Timur",
  utara: "Utara",
  barat: "Barat",
};

const DEFAULT_TABLE_TEMPLATE: { arah: TableArah }[] = [
  { arah: "selatan" },
  { arah: "selatan" },
  { arah: "timur" },
  { arah: "utara" },
  { arah: "utara" },
];

// 1 tenda = max 5 meja. Tenda = ceil(nomor / 5)
function tendaForNomor(nomor: number): number {
  return Math.ceil(nomor / 5);
}
function tendaCount(totalTables: number): number {
  return Math.ceil(totalTables / 5);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BazarManager() {
  // top-level state
  const [view, setView] = useState<"list" | "edit">("list");
  const [bazars, setBazars] = useState<Bazar[]>([]);
  const [editingBazar, setEditingBazar] = useState<Bazar | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // edit sub-state
  const [tables, setTables] = useState<BazarTable[]>([]);
  const [assignments, setAssignments] = useState<BazarAssignment[]>([]);
  const [waitlist, setWaitlist] = useState<BazarWaitlist[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  // fair rotation
  const [rotation, setRotation] = useState<
    { business: Business; timesAssigned: number; lastAssigned: string | null }[]
  >([]);
  const [showRotation, setShowRotation] = useState(false);
  const [rotationLoading, setRotationLoading] = useState(false);

  // form state
  const [form, setForm] = useState({
    nama: "",
    tanggal: "",
    jam_mulai: "",
    jam_selesai: "",
    lokasi: "",
    deskripsi: "",
    regulasi_url: "",
    banner_pesan: "",
    banner_aktif: false,
    status: "draft" as BazarStatus,
  });

  const [newTableArah, setNewTableArah] = useState<TableArah>("selatan");

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchBazars = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("bazars")
        .select("*, tables:bazar_tables(*)")
        .order("tanggal", { ascending: false });
      if (err) throw err;
      setBazars((data ?? []) as unknown as Bazar[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat data bazar");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBusinesses = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from("businesses")
        .select("id,name")
        .eq("status", "approved")
        .order("name");
      if (err) throw err;
      setBusinesses((data ?? []) as unknown as Business[]);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    void fetchBazars();
    void fetchBusinesses();
  }, [fetchBazars, fetchBusinesses]);

  const fetchEditData = useCallback(async (bazarId: string) => {
    try {
      const [tablesRes, assignmentsRes, waitlistRes] = await Promise.all([
        supabase
          .from("bazar_tables")
          .select("*")
          .eq("bazar_id", bazarId)
          .order("nomor", { ascending: true }),
        supabase
          .from("bazar_assignments")
          .select(
            "*, business:businesses(id,name,slug,logo_url), table:bazar_tables(*)"
          )
          .eq("bazar_id", bazarId),
        supabase
          .from("bazar_waitlist")
          .select("*, business:businesses(id,name,slug,logo_url)")
          .eq("bazar_id", bazarId)
          .order("created_at", { ascending: true }),
      ]);

      if (tablesRes.error) throw tablesRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (waitlistRes.error) throw waitlistRes.error;

      setTables((tablesRes.data ?? []) as unknown as BazarTable[]);
      setAssignments((assignmentsRes.data ?? []) as unknown as BazarAssignment[]);
      setWaitlist((waitlistRes.data ?? []) as unknown as BazarWaitlist[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat detail bazar");
    }
  }, []);

  // -------------------------------------------------------------------------
  // Actions — Bazar CRUD
  // -------------------------------------------------------------------------

  function openCreateForm() {
    setForm({
      nama: "",
      tanggal: new Date().toISOString().slice(0, 10),
      jam_mulai: "08:00",
      jam_selesai: "16:00",
      lokasi: "",
      deskripsi: "",
      regulasi_url: "",
      banner_pesan: "",
      banner_aktif: false,
      status: "draft",
    });
    setShowCreateForm(true);
  }

  async function handleCreateBazar() {
    if (!form.nama.trim()) {
      setError("Nama bazar wajib diisi");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: created, error: err } = await supabase
        .from("bazars")
        .insert({
          nama: form.nama.trim(),
          tanggal: form.tanggal,
          jam_mulai: form.jam_mulai,
          jam_selesai: form.jam_selesai,
          lokasi: form.lokasi.trim(),
          deskripsi: form.deskripsi.trim(),
          regulasi_url: form.regulasi_url.trim(),
          banner_pesan: form.banner_pesan.trim(),
          banner_aktif: form.banner_aktif,
          status: form.status,
        })
        .select()
        .single();
      if (err) throw err;

      // Auto-create default 5 tables (Tenda 1)
      const tableRows = DEFAULT_TABLE_TEMPLATE.map((t, i) => ({
        bazar_id: created.id,
        nomor: i + 1,
        arah: t.arah,
        tenda: 1,
      }));
      const { error: tableErr } = await supabase
        .from("bazar_tables")
        .insert(tableRows);
      if (tableErr) throw tableErr;

      setShowCreateForm(false);
      await fetchBazars();
      openEdit(created);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal membuat bazar");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(b: Bazar) {
    setEditingBazar(b);
    setView("edit");
    setForm({
      nama: b.nama ?? "",
      tanggal: b.tanggal ?? "",
      jam_mulai: formatJam(b.jam_mulai ?? null),
      jam_selesai: formatJam(b.jam_selesai ?? null),
      lokasi: b.lokasi ?? "",
      deskripsi: b.deskripsi ?? "",
      regulasi_url: b.regulasi_url ?? "",
      banner_pesan: b.banner_pesan ?? "",
      banner_aktif: b.banner_aktif ?? false,
      status: b.status ?? "draft",
    });
    void fetchEditData(b.id);
    setRotation([]);
    setShowRotation(false);
  }

  async function handleSaveBazar() {
    if (!editingBazar) return;
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from("bazars")
        .update({
          nama: form.nama.trim(),
          tanggal: form.tanggal,
          jam_mulai: form.jam_mulai,
          jam_selesai: form.jam_selesai,
          lokasi: form.lokasi.trim(),
          deskripsi: form.deskripsi.trim(),
          regulasi_url: form.regulasi_url.trim(),
          banner_pesan: form.banner_pesan.trim(),
          banner_aktif: form.banner_aktif,
          status: form.status,
        })
        .eq("id", editingBazar.id);
      if (err) throw err;
      await fetchBazars();
      // refresh the editing bazar object
      setEditingBazar((prev) =>
        prev
          ? {
              ...prev,
              ...form,
            }
          : prev
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan bazar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBazar(b: Bazar) {
    if (!confirm(`Hapus bazar "${b.nama}"? Tindakan ini tidak dapat dibatalkan.`))
      return;
    setError(null);
    try {
      const { error: err } = await supabase
        .from("bazars")
        .delete()
        .eq("id", b.id);
      if (err) throw err;
      await fetchBazars();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menghapus bazar");
    }
  }

  async function handleTogglePublish(b: Bazar) {
    const newStatus: BazarStatus =
      b.status === "published" ? "draft" : "published";
    setError(null);
    try {
      const { error: err } = await supabase
        .from("bazars")
        .update({ status: newStatus })
        .eq("id", b.id);
      if (err) throw err;
      await fetchBazars();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal mengubah status");
    }
  }

  async function handleMarkCompleted(b: Bazar) {
    setError(null);
    try {
      const { error: err } = await supabase
        .from("bazars")
        .update({ status: "completed" })
        .eq("id", b.id);
      if (err) throw err;
      await fetchBazars();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menandai selesai");
    }
  }

  // -------------------------------------------------------------------------
  // Actions — Clone
  // -------------------------------------------------------------------------

  async function handleClone(b: Bazar) {
    const newNama = prompt("Nama bazar baru:", `${b.nama} (Salinan)`);
    if (!newNama?.trim()) return;
    const newTanggal = prompt(
      "Tanggal bazar baru (YYYY-MM-DD):",
      new Date().toISOString().slice(0, 10)
    );
    if (!newTanggal) return;
    setError(null);
    try {
      const { error: err } = await supabase.rpc("clone_bazar", {
        p_source_id: b.id,
        p_new_nama: newNama.trim(),
        p_new_tanggal: newTanggal,
      });
      if (err) throw err;
      await fetchBazars();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal mengkloning bazar");
    }
  }

  // -------------------------------------------------------------------------
  // Actions — Tables
  // -------------------------------------------------------------------------

  async function handleAddTable() {
    if (!editingBazar) return;
    const currentMax = tables.reduce(
      (max, t) => Math.max(max, t.nomor ?? 0),
      0
    );
    const nextNomor = currentMax + 1;
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("bazar_tables")
        .insert({
          bazar_id: editingBazar.id,
          nomor: nextNomor,
          arah: newTableArah,
          tenda: tendaForNomor(nextNomor),
        })
        .select()
        .single();
      if (err) throw err;
      setTables((prev) => [...prev, data as unknown as BazarTable]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menambah meja");
    }
  }

  async function handleRemoveTable(t: BazarTable) {
    const hasAssignment = assignments.some(
      (a) => a.table_id === t.id
    );
    if (hasAssignment) {
      setError("Meja ini masih memiliki penugasan. Hapus penugasan terlebih dahulu.");
      return;
    }
    setError(null);
    try {
      const { error: err } = await supabase
        .from("bazar_tables")
        .delete()
        .eq("id", t.id);
      if (err) throw err;
      setTables((prev) => prev.filter((x) => x.id !== t.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menghapus meja");
    }
  }

  // -------------------------------------------------------------------------
  // Actions — Assignments
  // -------------------------------------------------------------------------

  async function handleAssign(
    table: BazarTable,
    businessId: string
  ) {
    if (!editingBazar || !businessId) return;
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("bazar_assignments")
        .insert({
          bazar_id: editingBazar.id,
          table_id: table.id,
          business_id: businessId,
          status: "assigned",
        })
        .select(
          "*, business:businesses(id,name,slug,logo_url), table:bazar_tables(*)"
        )
        .single();
      if (err) throw err;
      setAssignments((prev) => [...prev, data as unknown as BazarAssignment]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menugaskan UMKM");
    }
  }

  async function handleUnassign(a: BazarAssignment) {
    setError(null);
    try {
      const { error: err } = await supabase
        .from("bazar_assignments")
        .delete()
        .eq("id", a.id);
      if (err) throw err;
      setAssignments((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal membatalkan penugasan");
    }
  }

  async function handleAssignmentStatus(
    a: BazarAssignment,
    status: AssignmentStatus
  ) {
    setError(null);
    try {
      const { error: err } = await supabase
        .from("bazar_assignments")
        .update({ status })
        .eq("id", a.id);
      if (err) throw err;
      setAssignments((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, status } : x))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal mengubah status");
    }
  }

  // -------------------------------------------------------------------------
  // Actions — Waitlist
  // -------------------------------------------------------------------------

  async function handlePromoteWaitlist(w: BazarWaitlist) {
    if (!editingBazar) return;
    const emptyTable = tables.find(
      (t) => !assignments.some((a) => a.table_id === t.id)
    );
    if (!emptyTable) {
      setError("Tidak ada meja kosong tersedia.");
      return;
    }
    setError(null);
    try {
      // assign
      const { data: assignData, error: assignErr } = await supabase
        .from("bazar_assignments")
        .insert({
          bazar_id: editingBazar.id,
          table_id: emptyTable.id,
          business_id: w.business_id,
          status: "assigned",
        })
        .select(
          "*, business:businesses(id,name,slug,logo_url), table:bazar_tables(*)"
        )
        .single();
      if (assignErr) throw assignErr;

      // remove from waitlist
      const { error: wlErr } = await supabase
        .from("bazar_waitlist")
        .delete()
        .eq("id", w.id);
      if (wlErr) throw wlErr;

      setAssignments((prev) => [
        ...prev,
        assignData as unknown as BazarAssignment,
      ]);
      setWaitlist((prev) => prev.filter((x) => x.id !== w.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal mempromosikan dari waitlist");
    }
  }

  async function handleCancelWaitlist(w: BazarWaitlist) {
    setError(null);
    try {
      const { error: err } = await supabase
        .from("bazar_waitlist")
        .delete()
        .eq("id", w.id);
      if (err) throw err;
      setWaitlist((prev) => prev.filter((x) => x.id !== w.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal membatalkan waitlist");
    }
  }

  // -------------------------------------------------------------------------
  // Actions — Fair Rotation
  // -------------------------------------------------------------------------

  async function handleSuggestRotation() {
    if (!editingBazar) return;
    setRotationLoading(true);
    setShowRotation(true);
    setError(null);
    try {
      // fetch all assignments across all bazars for approved businesses
      const { data, error: err } = await supabase
        .from("bazar_assignments")
        .select(
          "business_id, bazar:bazars(tanggal)"
        );
      if (err) throw err;

      const all = (data ?? []) as unknown as {
        business_id: string;
        bazar: { tanggal: string } | null;
      }[];

      const map = new Map<
        string,
        { timesAssigned: number; lastAssigned: string | null }
      >();

      for (const a of all) {
        const bid = a.business_id;
        const tanggal = a.bazar?.tanggal ?? null;
        const entry = map.get(bid) ?? {
          timesAssigned: 0,
          lastAssigned: null,
        };
        entry.timesAssigned += 1;
        if (
          tanggal &&
          (!entry.lastAssigned || tanggal > entry.lastAssigned)
        ) {
          entry.lastAssigned = tanggal;
        }
        map.set(bid, entry);
      }

      const result = businesses.map((biz) => {
        const stats = map.get(biz.id) ?? {
          timesAssigned: 0,
          lastAssigned: null,
        };
        return { business: biz, ...stats };
      });

      // sort: times assigned ascending, then last assigned oldest first (nulls first)
      result.sort((a, b) => {
        if (a.timesAssigned !== b.timesAssigned)
          return a.timesAssigned - b.timesAssigned;
        if (!a.lastAssigned && !b.lastAssigned) return 0;
        if (!a.lastAssigned) return -1;
        if (!b.lastAssigned) return 1;
        return a.lastAssigned < b.lastAssigned ? -1 : 1;
      });

      setRotation(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menganalisis rotasi");
    } finally {
      setRotationLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  const assignedCount = assignments.length;
  const emptyTables = tables.filter(
    (t) => !assignments.some((a) => a.table_id === t.id)
  );

  // Omset summary for completed bazars
  const omsetTotal = assignments.reduce(
    (sum, a) => sum + (a.omset ?? 0),
    0
  );
  const omsetReporters = assignments.filter(
    (a) => a.omset != null && a.omset > 0
  ).length;
  const omsetAvg =
    assignments.length > 0
      ? Math.round(omsetTotal / assignments.length)
      : 0;

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  function renderStatusBadge(status: BazarStatus) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
          STATUS_STYLES[status] ?? STATUS_STYLES.draft
        }`}
      >
        {status === "published" && <CheckCircle className="h-3 w-3" />}
        {status === "draft" && <Clock className="h-3 w-3" />}
        {status === "cancelled" && <XCircle className="h-3 w-3" />}
        {status === "completed" && <CheckCircle className="h-3 w-3" />}
        {STATUS_LABELS[status] ?? status}
      </span>
    );
  }

  function renderAssignmentBadge(status: AssignmentStatus) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
          ASSIGN_STYLES[status] ?? ASSIGN_STYLES.assigned
        }`}
      >
        {ASSIGN_LABELS[status] ?? status}
      </span>
    );
  }

  // -------------------------------------------------------------------------
  // Render — List View
  // -------------------------------------------------------------------------

  if (view === "list") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-paroki-900 text-gold-500">
              <Tent className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-paroki-900">
                Manajemen Bazar
              </h1>
              <p className="text-sm text-gray-500">
                Kelola acara bazar dan penugasan meja UMKM
              </p>
            </div>
          </div>
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-paroki-900 transition hover:bg-gold-600"
          >
            <Plus className="h-4 w-4" />
            Buat Bazar
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Create form modal */}
        {showCreateForm && (
          <div className="mb-6 rounded-lg border-2 border-gold-500 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-display text-lg font-bold text-paroki-900">
              Buat Bazar Baru
            </h2>
            <BazarFormFields
              form={form}
              setForm={setForm}
            />
            <div className="mt-4 flex items-center gap-3">
              <button
                disabled={saving}
                onClick={handleCreateBazar}
                className="rounded-lg bg-gold-500 px-5 py-2 text-sm font-semibold text-paroki-900 transition hover:bg-gold-600 disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan & Lanjut Atur Meja"}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Clock className="h-6 w-6 animate-spin text-gold-500" />
            <span className="ml-2 text-gray-500">Memuat data bazar...</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && bazars.length === 0 && !showCreateForm && (
          <div className="rounded-lg border-2 border-dashed border-gray-200 py-20 text-center">
            <Tent className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-gray-500">
              Belum ada bazar. Klik "Buat Bazar" untuk mulai.
            </p>
          </div>
        )}

        {/* Bazar cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {!loading &&
            bazars.map((b) => {
              const bTables = (b as unknown as { tables?: BazarTable[] }).tables ?? [];
              const tableCount = bTables.length;
              // we don't have assignment count in list view, approximate from tables
              return (
                <div
                  key={b.id}
                  className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="font-display text-lg font-bold text-paroki-900">
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
                      </div>
                      {b.lokasi && (
                        <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                          <MapPin className="h-3.5 w-3.5" />
                          {b.lokasi}
                        </p>
                      )}
                    </div>
                    {renderStatusBadge(b.status ?? "draft")}
                  </div>

                  <div className="mb-4 flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Tent className="h-4 w-4" />
                      {tableCount} meja
                    </span>
                    {b.banner_aktif && (
                      <span className="flex items-center gap-1 text-gold-600">
                        <Megaphone className="h-4 w-4" />
                        Banner aktif
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => openEdit(b)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-paroki-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-paroki-800"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleTogglePublish(b)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                    >
                      {b.status === "published" ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      onClick={() => handleMarkCompleted(b)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                    >
                      Tandai Selesai
                    </button>
                    <button
                      onClick={() => handleClone(b)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Kloning
                    </button>
                    <button
                      onClick={() => handleDeleteBazar(b)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render — Edit View
  // -------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setView("list");
              setEditingBazar(null);
            }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            ← Kembali
          </button>
          <h1 className="font-display text-2xl font-bold text-paroki-900">
            {editingBazar?.nama ?? "Edit Bazar"}
          </h1>
          {editingBazar && renderStatusBadge(editingBazar.status ?? "draft")}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bazar form */}
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-paroki-900">
          <Calendar className="h-5 w-5 text-gold-500" />
          Detail Bazar
        </h2>
        <BazarFormFields form={form} setForm={setForm} />
        <div className="mt-4 flex items-center gap-3">
          <button
            disabled={saving}
            onClick={handleSaveBazar}
            className="rounded-lg bg-gold-500 px-5 py-2 text-sm font-semibold text-paroki-900 transition hover:bg-gold-600 disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </section>

      {/* Table Layout Manager */}
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-paroki-900">
          <Tent className="h-5 w-5 text-gold-500" />
          Tata Letak Meja ({tables.length} meja · {tendaCount(tables.length)} tenda)
        </h2>

        {/* Tenda-grouped U-layout visualization */}
        <div className="mb-6 space-y-4">
          {Array.from({ length: tendaCount(tables.length) }, (_, i) => i + 1).map((tendaNum) => {
            const tendaTables = tables
              .filter((t) => (t.tenda || tendaForNomor(t.nomor)) === tendaNum)
              .sort((a, b) => a.nomor - b.nomor);
            if (tendaTables.length === 0) return null;
            return (
              <div key={tendaNum} className="rounded-lg border border-paroki-200 bg-paroki-50/50 p-4">
                <p className="mb-3 text-sm font-bold text-paroki-800">
                  🎪 Tenda {tendaNum} <span className="font-normal text-gray-400">({tendaTables.length} meja)</span>
                </p>
                <div className="space-y-2">
                  {ARAH_ORDER.map((arah) => {
                    const groupTables = tendaTables.filter((t) => t.arah === arah);
                    if (groupTables.length === 0) return null;
                    return (
                      <div key={arah}>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                          {ARAH_LABELS[arah]}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {groupTables.map((t) => {
                            const assignment = assignments.find((a) => a.table_id === t.id);
                            return (
                              <div
                                key={t.id}
                                className={`flex min-w-[160px] flex-col gap-1 rounded-lg border-2 p-3 ${
                                  assignment
                                    ? "border-gold-500 bg-gold-50"
                                    : "border-dashed border-gray-300 bg-white"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-bold text-paroki-900">
                                    Meja {t.nomor}
                                  </span>
                                  <button
                                    onClick={() => handleRemoveTable(t)}
                                    className="text-red-400 hover:text-red-600"
                                    title="Hapus meja"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                {assignment?.business ? (
                                  <span className="text-xs font-medium text-paroki-700">
                                    {assignment.business.name}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">Kosong</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {tables.length === 0 && (
            <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-400">
              Belum ada meja. Tambahkan meja di bawah.
            </p>
          )}
        </div>

        {/* Add table */}
        <div className="flex items-center gap-2">
          <select
            value={newTableArah}
            onChange={(e) => setNewTableArah(e.target.value as TableArah)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-paroki-700 focus:outline-none"
          >
            {ARAH_ORDER.map((a) => (
              <option key={a} value={a}>
                {ARAH_LABELS[a]}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddTable}
            className="inline-flex items-center gap-1.5 rounded-lg bg-paroki-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-paroki-800"
          >
            <Plus className="h-4 w-4" />
            Tambah Meja
          </button>
        </div>
      </section>

      {/* Assignment Manager */}
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-paroki-900">
          <Users className="h-5 w-5 text-gold-500" />
          Penugasan UMKM ({assignedCount}/{tables.length} terisi)
        </h2>

        {tables.length === 0 && (
          <p className="text-sm text-gray-400">
            Tambahkan meja terlebih dahulu untuk mengelola penugasan.
          </p>
        )}

        <div className="space-y-3">
          {tables
            .sort((a, b) => (a.nomor ?? 0) - (b.nomor ?? 0))
            .map((t) => {
              const assignment = assignments.find(
                (a) => a.table_id === t.id
              );
              return (
                <div
                  key={t.id}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-paroki-900 text-sm font-bold text-gold-500">
                      {t.nomor}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Meja {t.nomor} · {ARAH_LABELS[t.arah]}
                      </p>
                      {assignment?.business ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-paroki-900">
                            {assignment.business.name}
                          </span>
                          {renderAssignmentBadge(assignment.status ?? "assigned")}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Belum ditugaskan</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {assignment ? (
                      <>
                        <select
                          value={assignment.status ?? "assigned"}
                          onChange={(e) =>
                            handleAssignmentStatus(
                              assignment,
                              e.target.value as AssignmentStatus
                            )
                          }
                          className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-paroki-700 focus:outline-none"
                        >
                          <option value="assigned">Ditugaskan</option>
                          <option value="confirmed">Dikonfirmasi</option>
                          <option value="absent">Tidak Hadir</option>
                        </select>
                        <button
                          onClick={() => handleUnassign(assignment)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                        >
                          Batalkan
                        </button>
                      </>
                    ) : (
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) handleAssign(t, e.target.value);
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-paroki-700 focus:outline-none"
                      >
                        <option value="">Pilih UMKM...</option>
                        {businesses
                          .filter(
                            (biz) =>
                              !assignments.some(
                                (a) => a.business_id === biz.id
                              )
                          )
                          .map((biz) => (
                            <option key={biz.id} value={biz.id}>
                              {biz.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Fair Rotation */}
        <div className="mt-6 border-t border-gray-100 pt-4">
          <button
            onClick={handleSuggestRotation}
            disabled={rotationLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-paroki-700 px-4 py-2 text-sm font-semibold text-paroki-700 transition hover:bg-paroki-50 disabled:opacity-50"
          >
            <Users className="h-4 w-4" />
            {rotationLoading ? "Menganalisis..." : "Saran Rotasi Adil"}
          </button>

          {showRotation && !rotationLoading && rotation.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-gray-500">
                Diurutkan dari paling jarang ditugaskan / paling lama tidak ikut.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {rotation.slice(0, 12).map((r, idx) => (
                  <div
                    key={r.business.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-paroki-900 text-xs font-bold text-gold-500">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-paroki-900">
                        {r.business.name}
                      </span>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <span className="font-semibold">{r.timesAssigned}×</span>
                      {r.lastAssigned && (
                        <span className="ml-2">
                          terakhir: {formatTanggal(r.lastAssigned)}
                        </span>
                      )}
                      {!r.lastAssigned && (
                        <span className="ml-2 text-green-600">belum pernah</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Waitlist */}
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-paroki-900">
          <Clock className="h-5 w-5 text-gold-500" />
          Daftar Tunggu ({waitlist.length})
        </h2>

        {waitlist.length === 0 ? (
          <p className="text-sm text-gray-400">Tidak ada pendaftar waitlist.</p>
        ) : (
          <div className="space-y-2">
            {waitlist.map((w) => (
              <div
                key={w.id}
                className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-paroki-900">
                    {w.business?.name ?? "UMKM tidak diketahui"}
                  </p>
                  <p className="text-xs text-gray-400">
                    Mendaftar: {w.created_at
                      ? formatTanggal(w.created_at.slice(0, 10))
                      : "-"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePromoteWaitlist(w)}
                    disabled={emptyTables.length === 0}
                    className="rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-semibold text-paroki-900 transition hover:bg-gold-600 disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-1">
                      <ChevronRight className="h-3.5 w-3.5" />
                      Promosikan
                    </span>
                  </button>
                  <button
                    onClick={() => handleCancelWaitlist(w)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Batalkan
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Omset Summary */}
      {editingBazar?.status === "completed" && (
        <section className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-blue-900">
            <DollarSign className="h-5 w-5 text-blue-700" />
            Ringkasan Omset
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-blue-200 bg-white p-4">
              <p className="text-xs font-medium uppercase text-gray-400">
                Total Omset
              </p>
              <p className="mt-1 text-xl font-bold text-blue-700">
                {formatIDR(omsetTotal)}
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-white p-4">
              <p className="text-xs font-medium uppercase text-gray-400">
                Rata-rata per Meja
              </p>
              <p className="mt-1 text-xl font-bold text-blue-700">
                {formatIDR(omsetAvg)}
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-white p-4">
              <p className="text-xs font-medium uppercase text-gray-400">
                Pelapor Omset
              </p>
              <p className="mt-1 text-xl font-bold text-blue-700">
                {omsetReporters}/{tables.length}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Form Fields
// ---------------------------------------------------------------------------

interface FormFieldsProps {
  form: {
    nama: string;
    tanggal: string;
    jam_mulai: string;
    jam_selesai: string;
    lokasi: string;
    deskripsi: string;
    regulasi_url: string;
    banner_pesan: string;
    banner_aktif: boolean;
    status: BazarStatus;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      nama: string;
      tanggal: string;
      jam_mulai: string;
      jam_selesai: string;
      lokasi: string;
      deskripsi: string;
      regulasi_url: string;
      banner_pesan: string;
      banner_aktif: boolean;
      status: BazarStatus;
    }>
  >;
}

function BazarFormFields({ form, setForm }: FormFieldsProps) {
  const statusOptions: BazarStatus[] = [
    "draft",
    "published",
    "completed",
    "cancelled",
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Nama */}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Nama Bazar
        </label>
        <input
          type="text"
          value={form.nama}
          onChange={(e) => setForm((p) => ({ ...p, nama: e.target.value }))}
          placeholder="Bazar Natal 2026"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-paroki-700 focus:outline-none"
        />
      </div>

      {/* Tanggal */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Tanggal
        </label>
        <input
          type="date"
          value={form.tanggal}
          onChange={(e) => setForm((p) => ({ ...p, tanggal: e.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-paroki-700 focus:outline-none"
        />
      </div>

      {/* Status */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Status
        </label>
        <select
          value={form.status}
          onChange={(e) =>
            setForm((p) => ({ ...p, status: e.target.value as BazarStatus }))
          }
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-paroki-700 focus:outline-none"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Jam Mulai */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Jam Mulai
        </label>
        <input
          type="time"
          value={form.jam_mulai}
          onChange={(e) =>
            setForm((p) => ({ ...p, jam_mulai: e.target.value }))
          }
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-paroki-700 focus:outline-none"
        />
      </div>

      {/* Jam Selesai */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Jam Selesai
        </label>
        <input
          type="time"
          value={form.jam_selesai}
          onChange={(e) =>
            setForm((p) => ({ ...p, jam_selesai: e.target.value }))
          }
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-paroki-700 focus:outline-none"
        />
      </div>

      {/* Lokasi */}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Lokasi
        </label>
        <input
          type="text"
          value={form.lokasi}
          onChange={(e) => setForm((p) => ({ ...p, lokasi: e.target.value }))}
          placeholder="Halaman Gereja St. Servatius"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-paroki-700 focus:outline-none"
        />
      </div>

      {/* Deskripsi */}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Deskripsi
        </label>
        <textarea
          value={form.deskripsi}
          onChange={(e) =>
            setForm((p) => ({ ...p, deskripsi: e.target.value }))
          }
          rows={3}
          placeholder="Deskripsi singkat bazar..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-paroki-700 focus:outline-none"
        />
      </div>

      {/* Regulasi URL (PDF) */}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-gray-600">
          📄 Link Regulasi Bazar (PDF)
        </label>
        <input
          type="url"
          value={form.regulasi_url}
          onChange={(e) =>
            setForm((p) => ({ ...p, regulasi_url: e.target.value }))
          }
          placeholder="https://contoh.com/regulasi-bazar.pdf"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-paroki-700 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-400">
          Peserta wajib membaca dan menyetujui regulasi ini sebelum konfirmasi ikut bazar.
        </p>
      </div>

      {/* Banner Pesan */}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Pesan Banner
        </label>
        <textarea
          value={form.banner_pesan}
          onChange={(e) =>
            setForm((p) => ({ ...p, banner_pesan: e.target.value }))
          }
          rows={2}
          placeholder="Pengumuman singkat untuk ditampilkan di banner..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-paroki-700 focus:outline-none"
        />
      </div>

      {/* Banner Aktif */}
      <div className="sm:col-span-2">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={form.banner_aktif}
            onChange={(e) =>
              setForm((p) => ({ ...p, banner_aktif: e.target.checked }))
            }
            className="h-4 w-4 rounded border-gray-300 text-paroki-700 focus:ring-paroki-700"
          />
          <span className="text-sm font-medium text-gray-600">
            Tampilkan banner aktif di beranda
          </span>
        </label>
      </div>
    </div>
  );
}
