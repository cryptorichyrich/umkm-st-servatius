import { useEffect, useState, useCallback } from "react";
import {
  Store,
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
  Receipt,
  ExternalLink,
  AlertTriangle,
  Search,
  X,
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
  assigned: "bg-amber-100 text-amber-800 border-amber-300",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  absent: "bg-red-100 text-red-800 border-red-300",
  completed: "bg-blue-100 text-blue-800 border-blue-300",
};

const ASSIGN_LABELS: Record<AssignmentStatus, string> = {
  assigned: "Ditugaskan",
  confirmed: "Dikonfirmasi",
  absent: "Tidak Hadir",
  completed: "Selesai",
};

const ARAH_ORDER: TableArah[] = ["selatan", "timur", "utara"];
const ARAH_LABELS: Record<TableArah, string> = {
  selatan: "Menghadap Selatan",
  timur: "Menghadap Timur",
  utara: "Menghadap Utara",
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
    biaya_partisipasi: "50000",
    bank_nama: "",
    bank_rekening: "",
    bank_atas_nama: "",
    pembayaran_pesan: "",
    anti_scam_pesan: "",
  });

  const [newTableArah, setNewTableArah] = useState<TableArah>("selatan");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Assign modal state
  const [assignModalTable, setAssignModalTable] = useState<BazarTable | null>(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignFilterArea, setAssignFilterArea] = useState("");

  // Pre-fetched rotation map for modal display
  const [rotationMap, setRotationMap] = useState<
    Map<string, { timesAssigned: number; lastAssigned: string | null }>
  >(new Map());

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

  function validateForm(): boolean {
    const errs: Record<string, string> = {};
    if (!form.nama.trim()) errs.nama = "Nama bazar wajib diisi";
    if (!form.tanggal) errs.tanggal = "Tanggal wajib diisi";
    if (!form.jam_mulai) errs.jam_mulai = "Jam mulai wajib diisi";
    if (!form.jam_selesai) errs.jam_selesai = "Jam selesai wajib diisi";
    if (!form.lokasi.trim()) errs.lokasi = "Lokasi wajib diisi";
    // Bank: if rekening filled, nama + atas_nama required too
    if (form.bank_rekening.trim()) {
      if (!form.bank_nama.trim()) errs.bank_nama = "Nama bank wajib diisi";
      if (!form.bank_atas_nama.trim()) errs.bank_atas_nama = "Atas nama wajib diisi";
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const fetchBusinesses = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from("businesses")
        .select("id,name,slug,category_id,area,lingkungan,category:categories(name)")
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

  // Deep-link: if URL is /admin/bazar/{id}, auto-open that bazar
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/admin\/bazar\/([0-9a-f-]+)/);
    if (!match || loading || bazars.length === 0) return;
    if (editingBazar?.id === match[1]) return; // already editing this one
    const target = bazars.find((b) => b.id === match[1]);
    if (target) {
      openEdit(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, bazars, editingBazar]);

  // Handle browser back button
  useEffect(() => {
    const onPop = () => {
      if (!window.location.pathname.match(/\/admin\/bazar\/.+/)) {
        setView("list");
        setEditingBazar(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

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

      // Fetch rotation history for ALL bazars (for modal badges)
      const { data: allAssignments } = await supabase
        .from("bazar_assignments")
        .select("business_id, bazar:bazars(tanggal)");
      const rMap = new Map<string, { timesAssigned: number; lastAssigned: string | null }>();
      for (const a of (allAssignments ?? [])) {
        const bid = (a as unknown as { business_id: string }).business_id;
        const tanggal = (a as unknown as { bazar: { tanggal: string } | null }).bazar?.tanggal ?? null;
        const entry = rMap.get(bid) ?? { timesAssigned: 0, lastAssigned: null };
        entry.timesAssigned += 1;
        if (tanggal && (!entry.lastAssigned || tanggal > entry.lastAssigned)) {
          entry.lastAssigned = tanggal;
        }
        rMap.set(bid, entry);
      }
      setRotationMap(rMap);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat detail bazar");
    }
  }, []);

  // -------------------------------------------------------------------------
  // Actions — Bazar CRUD
  // -------------------------------------------------------------------------

  function openCreateForm() {
    setFormErrors({});
    setForm({
      nama: "",
      tanggal: new Date().toISOString().slice(0, 10),
      jam_mulai: "06:00",
      jam_selesai: "10:00",
      lokasi: "Halaman parkiran Utama Gereja.",
      deskripsi: "",
      regulasi_url: "",
      banner_pesan: "",
      banner_aktif: false,
      status: "draft",
      biaya_partisipasi: "50000",
      bank_nama: "",
      bank_rekening: "",
      bank_atas_nama: "",
      pembayaran_pesan: "Setelah konfirmasi kehadiran, segera lakukan pembayaran paling lambat hari Jumat. Upload bukti transfer di bawah ini.",
      anti_scam_pesan: "PERHATIAN: Keamanan peserta adalah prioritas utama kami. Jangan pernah mentransfer ke nomor rekening selain yang tertera di atas. Kami tidak akan pernah meminta pembayaran via WhatsApp pribadi atau aplikasi lain. Jika ada yang mengaku dari panitia dan meminta transfer ke rekening berbeda, hubungi panitia resmi.",
    });
    setShowCreateForm(true);
  }

  async function handleCreateBazar() {
    if (!validateForm()) return;
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
          biaya_partisipasi: form.biaya_partisipasi ? parseInt(form.biaya_partisipasi) : null,
          bank_nama: form.bank_nama.trim(),
          bank_rekening: form.bank_rekening.trim(),
          bank_atas_nama: form.bank_atas_nama.trim(),
          pembayaran_pesan: form.pembayaran_pesan.trim(),
          anti_scam_pesan: form.anti_scam_pesan.trim(),
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
    setFormErrors({});
    setEditingBazar(b);
    setView("edit");
    // Update URL to reflect bazar being edited
    window.history.pushState({}, "", `/admin/bazar/${b.id}`);
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
      biaya_partisipasi: b.biaya_partisipasi?.toString() ?? "50000",
      bank_nama: b.bank_nama ?? "",
      bank_rekening: b.bank_rekening ?? "",
      bank_atas_nama: b.bank_atas_nama ?? "",
      pembayaran_pesan: b.pembayaran_pesan ?? "",
      anti_scam_pesan: b.anti_scam_pesan ?? "",
    });
    void fetchEditData(b.id);
    setRotation([]);
    setShowRotation(false);
  }

  async function handleSaveBazar() {
    if (!editingBazar) return;
    if (!validateForm()) return;
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
          biaya_partisipasi: form.biaya_partisipasi ? parseInt(form.biaya_partisipasi) : null,
          bank_nama: form.bank_nama.trim(),
          bank_rekening: form.bank_rekening.trim(),
          bank_atas_nama: form.bank_atas_nama.trim(),
          pembayaran_pesan: form.pembayaran_pesan.trim(),
          anti_scam_pesan: form.anti_scam_pesan.trim(),
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
    setError(null);
    try {
      // 1. Create new bazar: draft, empty name, copy settings
      const { data: created, error: bErr } = await supabase
        .from("bazars")
        .insert({
          nama: "",
          tanggal: null,
          jam_mulai: b.jam_mulai,
          jam_selesai: b.jam_selesai,
          lokasi: b.lokasi,
          deskripsi: b.deskripsi,
          regulasi_url: b.regulasi_url,
          banner_pesan: b.banner_pesan,
          banner_aktif: false,
          status: "draft",
          biaya_partisipasi: b.biaya_partisipasi,
          bank_nama: b.bank_nama,
          bank_rekening: b.bank_rekening,
          bank_atas_nama: b.bank_atas_nama,
          pembayaran_pesan: b.pembayaran_pesan,
          anti_scam_pesan: b.anti_scam_pesan,
        })
        .select()
        .single();
      if (bErr) throw bErr;

      // 2. Copy table layout (no assignments)
      const srcTables = (b as unknown as { tables?: BazarTable[] }).tables ?? [];
      if (srcTables.length > 0) {
        const tableRows = srcTables.map((t) => ({
          bazar_id: created.id,
          nomor: t.nomor,
          arah: t.arah,
          tenda: t.tenda ?? tendaForNomor(t.nomor),
        }));
        const { error: tErr } = await supabase
          .from("bazar_tables")
          .insert(tableRows);
        if (tErr) throw tErr;
      }

      await fetchBazars();
      // Auto-open the new clone for editing
      openEdit({ ...created, tables: [] } as unknown as Bazar);
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

  async function handleApprovePayment(a: BazarAssignment) {
    setError(null);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { error: err } = await supabase
        .from("bazar_assignments")
        .update({
          payment_status: "approved",
          payment_approved_at: new Date().toISOString(),
          payment_approved_by: user.user?.id ?? null,
        })
        .eq("id", a.id);
      if (err) throw err;
      setAssignments((prev) =>
        prev.map((x) =>
          x.id === a.id ? { ...x, payment_status: "approved" } : x
        )
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menyetujui pembayaran");
    }
  }

  async function handleRejectPayment(a: BazarAssignment) {
    const reason = prompt("Alasan penolakan (opsional):");
    if (reason === null) return; // user cancelled
    setError(null);
    try {
      const { error: err } = await supabase
        .from("bazar_assignments")
        .update({
          payment_status: "rejected",
          payment_reject_note: reason.trim(),
        })
        .eq("id", a.id);
      if (err) throw err;
      setAssignments((prev) =>
        prev.map((x) =>
          x.id === a.id
            ? { ...x, payment_status: "rejected", payment_reject_note: reason.trim() }
            : x
        )
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal menolak pembayaran");
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

  // Payment summaries
  const pendingPayments = assignments.filter(
    (a) => a.payment_status === "pending_review"
  );
  const approvedPayments = assignments.filter(
    (a) => a.payment_status === "approved"
  );
  const rejectedPayments = assignments.filter(
    (a) => a.payment_status === "rejected"
  );

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
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ASSIGN_STYLES[status] ?? ASSIGN_STYLES.assigned}`}
      >
        {status === "assigned" && <Clock className="h-3 w-3" />}
        {status === "confirmed" && <CheckCircle className="h-3 w-3" />}
        {status === "absent" && <XCircle className="h-3 w-3" />}
        {status === "completed" && <CheckCircle className="h-3 w-3" />}
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
              <Store className="h-5 w-5" />
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
              formErrors={formErrors}
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
            <Store className="mx-auto mb-3 h-10 w-10 text-gray-300" />
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
                      <Store className="h-4 w-4" />
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
              window.history.pushState({}, "", "/admin/bazar");
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
        <BazarFormFields form={form} setForm={setForm} formErrors={formErrors} />
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
          <Store className="h-5 w-5 text-gold-500" />
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
                      <button
                        onClick={() => {
                          setAssignModalTable(t);
                          setAssignSearch("");
                          setAssignFilterArea("");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-paroki-900 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-paroki-800"
                      >
                        <Users className="h-3.5 w-3.5" />
                        Pilih UMKM
                      </button>
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

      {/* Konfirmasi Pembayaran */}
      {editingBazar?.bank_rekening && assignments.length > 0 && (
        <section className="mb-6 rounded-lg border border-gold-300 bg-gold-50/30 p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-paroki-900">
            <Receipt className="h-5 w-5 text-gold-600" />
            Konfirmasi Pembayaran
            {pendingPayments.length > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
                {pendingPayments.length} menunggu
              </span>
            )}
          </h2>

          {/* Pending payments — need action */}
          {pendingPayments.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-sm font-medium text-amber-700">
                ⏳ Menunggu Verifikasi ({pendingPayments.length})
              </p>
              {pendingPayments.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-semibold text-paroki-900">
                        {a.business?.name ?? "UMKM"}
                      </p>
                      <p className="text-xs text-gray-500">
                        Meja {a.table?.nomor ?? "-"} · {formatIDR(editingBazar?.biaya_partisipasi ?? 0)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.payment_proof_url && (
                      <a
                        href={a.payment_proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-paroki-300 px-3 py-1.5 text-xs font-medium text-paroki-700 transition hover:bg-paroki-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Lihat Bukti
                      </a>
                    )}
                    <button
                      onClick={() => handleApprovePayment(a)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                    >
                      ✓ Setujui
                    </button>
                    <button
                      onClick={() => handleRejectPayment(a)}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      ✕ Tolak
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Approved payments */}
          {approvedPayments.length > 0 && (
            <div className="mb-3 space-y-1">
              <p className="text-sm font-medium text-emerald-700">
                ✓ Diterima ({approvedPayments.length})
              </p>
              {approvedPayments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-paroki-900">
                      {a.business?.name ?? "UMKM"}
                    </span>
                    {a.payment_proof_url && (
                      <a
                        href={a.payment_proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-paroki-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Bukti
                      </a>
                    )}
                  </div>
                  <span className="text-xs text-emerald-700">
                    {a.payment_approved_at
                      ? formatTanggal(a.payment_approved_at.slice(0, 10))
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Rejected payments */}
          {rejectedPayments.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-700">
                ✕ Ditolak ({rejectedPayments.length})
              </p>
              {rejectedPayments.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-1 rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-paroki-900">
                      {a.business?.name ?? "UMKM"}
                    </span>
                    {a.payment_proof_url && (
                      <a
                        href={a.payment_proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-paroki-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Bukti
                      </a>
                    )}
                    {a.payment_reject_note && (
                      <span className="text-xs text-red-500">
                        ({a.payment_reject_note})
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleApprovePayment(a)}
                    className="self-start rounded-lg border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 sm:self-auto"
                  >
                    Setujui ulang
                  </button>
                </div>
              ))}
            </div>
          )}

          {pendingPayments.length === 0 &&
            approvedPayments.length === 0 &&
            rejectedPayments.length === 0 && (
              <p className="text-sm text-gray-400">
                Belum ada peserta yang mengunggah bukti pembayaran.
              </p>
            )}
        </section>
      )}

      {/* Waitlist */}
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-paroki-900">
          <Clock className="h-5 w-5 text-gold-500" />
          Daftar Tunggu ({waitlist.length})
        </h2>
        <p className="mb-4 text-xs text-gray-400">
          UMKM yang ingin menggantikan peserta batal akan muncul di sini, urut berdasarkan siapa daftar lebih dulu. Klik "Promosikan" untuk assign ke meja kosong.
        </p>

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

      {/* Assign UMKM Modal */}
      {assignModalTable && (
        <AssignModal
          table={assignModalTable}
          businesses={businesses}
          assignedIds={new Set(assignments.map((a) => a.business_id))}
          rotationMap={rotationMap}
          search={assignSearch}
          setSearch={setAssignSearch}
          filterArea={assignFilterArea}
          setFilterArea={setAssignFilterArea}
          onAssign={(bizId) => {
            handleAssign(assignModalTable, bizId);
            setAssignModalTable(null);
          }}
          onClose={() => setAssignModalTable(null)}
        />
      )}

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
    biaya_partisipasi: string;
    bank_nama: string;
    bank_rekening: string;
    bank_atas_nama: string;
    pembayaran_pesan: string;
    anti_scam_pesan: string;
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
      biaya_partisipasi: string;
      bank_nama: string;
      bank_rekening: string;
      bank_atas_nama: string;
      pembayaran_pesan: string;
      anti_scam_pesan: string;
    }>
  >;
  formErrors: Record<string, string>;
}

function BazarFormFields({ form, setForm, formErrors }: FormFieldsProps) {
  const statusOptions: BazarStatus[] = [
    "draft",
    "published",
    "completed",
    "cancelled",
  ];

  const [pdfList, setPdfList] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.storage
        .from("bazar-files")
        .list("", { sortBy: { column: "created_at", order: "desc" } });
      if (error || !data) return;
      const items = data
        .filter((f) => f.name.toLowerCase().endsWith(".pdf"))
        .map((f) => {
          const { data: pub } = supabase.storage
            .from("bazar-files")
            .getPublicUrl(f.name);
          return { name: f.name, url: pub.publicUrl };
        });
      setPdfList(items);
    })();
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Nama */}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Nama Bazar <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.nama}
          onChange={(e) => setForm((p) => ({ ...p, nama: e.target.value }))}
          placeholder="Bazar Natal 2026"
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
            formErrors.nama
              ? "border-red-400 focus:border-red-500"
              : "border-gray-300 focus:border-paroki-700"
          }`}
        />
        {formErrors.nama && (
          <p className="mt-1 text-xs text-red-500">{formErrors.nama}</p>
        )}
      </div>

      {/* Tanggal */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Tanggal <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={form.tanggal}
          onChange={(e) => setForm((p) => ({ ...p, tanggal: e.target.value }))}
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
            formErrors.tanggal
              ? "border-red-400 focus:border-red-500"
              : "border-gray-300 focus:border-paroki-700"
          }`}
        />
        {formErrors.tanggal && (
          <p className="mt-1 text-xs text-red-500">{formErrors.tanggal}</p>
        )}
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
          Jam Mulai <span className="text-red-500">*</span>
        </label>
        <input
          type="time"
          value={form.jam_mulai}
          onChange={(e) =>
            setForm((p) => ({ ...p, jam_mulai: e.target.value }))
          }
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
            formErrors.jam_mulai
              ? "border-red-400 focus:border-red-500"
              : "border-gray-300 focus:border-paroki-700"
          }`}
        />
        {formErrors.jam_mulai && (
          <p className="mt-1 text-xs text-red-500">{formErrors.jam_mulai}</p>
        )}
      </div>

      {/* Jam Selesai */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Jam Selesai <span className="text-red-500">*</span>
        </label>
        <input
          type="time"
          value={form.jam_selesai}
          onChange={(e) =>
            setForm((p) => ({ ...p, jam_selesai: e.target.value }))
          }
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
            formErrors.jam_selesai
              ? "border-red-400 focus:border-red-500"
              : "border-gray-300 focus:border-paroki-700"
          }`}
        />
        {formErrors.jam_selesai && (
          <p className="mt-1 text-xs text-red-500">{formErrors.jam_selesai}</p>
        )}
      </div>

      {/* Lokasi */}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Lokasi <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.lokasi}
          onChange={(e) => setForm((p) => ({ ...p, lokasi: e.target.value }))}
          placeholder="Halaman parkiran Utara Gereja"
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
            formErrors.lokasi
              ? "border-red-400 focus:border-red-500"
              : "border-gray-300 focus:border-paroki-700"
          }`}
        />
        {formErrors.lokasi && (
          <p className="mt-1 text-xs text-red-500">{formErrors.lokasi}</p>
        )}
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

      {/* Pesan Banner (moved up) */}
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

      {/* Regulasi PDF */}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-gray-600">
          📄 Regulasi Bazar (PDF)
        </label>

        {/* Upload + manual URL */}
        <div className="flex gap-2">
          <label className="cursor-pointer whitespace-nowrap rounded-lg bg-paroki-50 px-3 py-2 text-sm font-medium text-paroki-700 transition hover:bg-paroki-100">
            {uploading ? "Mengunggah..." : "⬆ Upload PDF"}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                setUploadErr("");
                const fname = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
                const { error: ulErr } = await supabase.storage
                  .from("bazar-files")
                  .upload(fname, file, { contentType: "application/pdf" });
                setUploading(false);
                if (ulErr) {
                  setUploadErr("Gagal mengunggah: " + ulErr.message);
                  return;
                }
                const { data: pub } = supabase.storage
                  .from("bazar-files")
                  .getPublicUrl(fname);
                setPdfList((prev) => [
                  { name: fname, url: pub.publicUrl },
                  ...prev,
                ]);
                setForm((p) => ({ ...p, regulasi_url: pub.publicUrl }));
              }}
            />
          </label>

          <input
            type="url"
            value={form.regulasi_url}
            onChange={(e) =>
              setForm((p) => ({ ...p, regulasi_url: e.target.value }))
            }
            placeholder="Atau tempel link PDF eksternal..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-paroki-700 focus:outline-none"
          />
        </div>

        {/* Uploaded PDF list with select + delete */}
        {pdfList.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-xs font-medium text-gray-500">
              PDF tersimpan ({pdfList.length}):
            </p>
            {pdfList.map((pdf) => (
              <div
                key={pdf.name}
                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition ${
                  form.regulasi_url === pdf.url
                    ? "bg-paroki-50 ring-1 ring-paroki-300"
                    : "hover:bg-gray-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({ ...p, regulasi_url: pdf.url }))
                  }
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                >
                  <span className={`text-xs ${form.regulasi_url === pdf.url ? "text-paroki-700 font-medium" : "text-gray-600"}`}>
                    {form.regulasi_url === pdf.url ? "✓ " : "📄 "}
                  </span>
                  <span className={`truncate ${form.regulasi_url === pdf.url ? "text-paroki-700 font-medium" : "text-gray-600"}`}>
                    {decodeURIComponent(pdf.name.replace(/^\d+-/, ""))}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={pdf.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-400 hover:text-paroki-600"
                    title="Lihat PDF"
                  >
                    👁
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      const { error: delErr } = await supabase.storage
                        .from("bazar-files")
                        .remove([pdf.name]);
                      if (delErr) {
                        setUploadErr("Gagal menghapus: " + delErr.message);
                        return;
                      }
                      setPdfList((prev) =>
                        prev.filter((p) => p.name !== pdf.name)
                      );
                      if (form.regulasi_url === pdf.url) {
                        setForm((p) => ({ ...p, regulasi_url: "" }));
                      }
                    }}
                    className="text-xs text-gray-400 transition hover:text-red-500"
                    title="Hapus PDF"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {uploadErr && (
          <p className="mt-1 text-xs text-red-500">{uploadErr}</p>
        )}

        <p className="mt-1 text-xs text-gray-400">
          Peserta wajib membaca dan menyetujui regulasi ini sebelum konfirmasi ikut bazar.
        </p>
      </div>

      {/* ─── Payment Info ─── */}
      <div className="sm:col-span-2 mt-2">
        <div className="rounded-lg border border-paroki-200 bg-paroki-50/50 px-4 py-3">
          <p className="font-display text-sm font-bold text-paroki-800">
            💳 Informasi Pembayaran Peserta
          </p>
        </div>
      </div>

      {/* Biaya Partisipasi */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Biaya Partisipasi (Rp)
        </label>
        <input
          type="number"
          value={form.biaya_partisipasi}
          onChange={(e) =>
            setForm((p) => ({ ...p, biaya_partisipasi: e.target.value }))
          }
          placeholder="50000"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-paroki-700 focus:outline-none"
        />
      </div>

      {/* Nama Bank */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Nama Bank Tujuan {form.bank_rekening.trim() && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={form.bank_nama}
          onChange={(e) =>
            setForm((p) => ({ ...p, bank_nama: e.target.value }))
          }
          placeholder="BCA / Mandiri / BRI"
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
            formErrors.bank_nama
              ? "border-red-400 focus:border-red-500"
              : "border-gray-300 focus:border-paroki-700"
          }`}
        />
        {formErrors.bank_nama && (
          <p className="mt-1 text-xs text-red-500">{formErrors.bank_nama}</p>
        )}
      </div>

      {/* Nomor Rekening */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Nomor Rekening Tujuan
        </label>
        <input
          type="text"
          value={form.bank_rekening}
          onChange={(e) =>
            setForm((p) => ({ ...p, bank_rekening: e.target.value }))
          }
          placeholder="1234567890"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-paroki-700 focus:outline-none"
        />
      </div>

      {/* Atas Nama */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Atas Nama {form.bank_rekening.trim() && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={form.bank_atas_nama}
          onChange={(e) =>
            setForm((p) => ({ ...p, bank_atas_nama: e.target.value }))
          }
          placeholder="Panitia Bazar Paroki"
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
            formErrors.bank_atas_nama
              ? "border-red-400 focus:border-red-500"
              : "border-gray-300 focus:border-paroki-700"
          }`}
        />
        {formErrors.bank_atas_nama && (
          <p className="mt-1 text-xs text-red-500">{formErrors.bank_atas_nama}</p>
        )}
      </div>

      {/* Pesan Pembayaran Custom */}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-gray-600">
          Pesan Pembayaran (tampil setelah konfirmasi hadir)
        </label>
        <textarea
          value={form.pembayaran_pesan}
          onChange={(e) =>
            setForm((p) => ({ ...p, pembayaran_pesan: e.target.value }))
          }
          rows={3}
          placeholder="Setelah konfirmasi kehadiran, segera lakukan pembayaran paling lambat hari Jumat. Upload bukti transfer di bawah ini."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-paroki-700 focus:outline-none"
        />
      </div>

      {/* Anti-Scam Warning */}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-gray-600">
          ⚠️ Peringatan Keamanan / Anti-Scam
        </label>
        <textarea
          value={form.anti_scam_pesan}
          onChange={(e) =>
            setForm((p) => ({ ...p, anti_scam_pesan: e.target.value }))
          }
          rows={4}
          placeholder="PERHATIAN: Keamanan peserta adalah prioritas utama kami. Jangan pernah mentransfer ke nomor rekening selain yang tertera di atas. Kami tidak akan pernah meminta pembayaran via WhatsApp pribadi atau aplikasi lain. Jika ada yang mengaku dari panitia dan meminta transfer ke rekening berbeda, hubungi panitia resmi."
          className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm focus:border-paroki-700 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-400">
          Tampil dengan latar merah di dashboard peserta. Kosongkan untuk disembunyikan.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Assign UMKM Modal
// ---------------------------------------------------------------------------

interface AssignModalProps {
  table: BazarTable;
  businesses: Business[];
  assignedIds: Set<string>;
  rotationMap: Map<string, { timesAssigned: number; lastAssigned: string | null }>;
  search: string;
  setSearch: (v: string) => void;
  filterArea: string;
  setFilterArea: (v: string) => void;
  onAssign: (businessId: string) => void;
  onClose: () => void;
}

function AssignModal({
  table,
  businesses,
  assignedIds,
  rotationMap,
  search,
  setSearch,
  filterArea,
  setFilterArea,
  onAssign,
  onClose,
}: AssignModalProps) {
  // Unique areas for filter dropdown
  const areas = Array.from(
    new Set(businesses.map((b) => b.area).filter(Boolean))
  ).sort();

  // Available businesses = not already assigned to this bazar
  const available = businesses.filter((b) => !assignedIds.has(b.id));

  // Apply search + area filter
  const filtered = available.filter((b) => {
    const matchSearch =
      !search ||
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.area ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (b.category?.name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchArea = !filterArea || b.area === filterArea;
    return matchSearch && matchArea;
  });

  // Sort by rotation fairness (least assigned first, oldest last-assigned first)
  const sorted = [...filtered].sort((a, b) => {
    const ra = rotationMap.get(a.id) ?? { timesAssigned: 0, lastAssigned: null };
    const rb = rotationMap.get(b.id) ?? { timesAssigned: 0, lastAssigned: null };
    if (ra.timesAssigned !== rb.timesAssigned)
      return ra.timesAssigned - rb.timesAssigned;
    if (!ra.lastAssigned && !rb.lastAssigned) return 0;
    if (!ra.lastAssigned) return -1;
    if (!rb.lastAssigned) return 1;
    return ra.lastAssigned < rb.lastAssigned ? -1 : 1;
  });

  // Top 3 fair picks
  const fairPicks = sorted.slice(0, 3);
  const restList = sorted.slice(3);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-paroki-900">
              Pilih UMKM untuk Meja {table.nomor}
            </h3>
            <p className="text-xs text-gray-500">
              {ARAH_LABELS[table.arah]} · {available.length} tersedia
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col gap-2 border-b border-gray-100 px-5 py-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama UMKM, wilayah, kategori..."
              autoFocus
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-paroki-700 focus:outline-none"
            />
          </div>
          <select
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-paroki-700 focus:outline-none"
          >
            <option value="">Semua Wilayah</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {/* Fair rotation suggestions */}
          {fairPicks.length > 0 && !search && !filterArea && (
            <div className="mb-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle className="h-3.5 w-3.5" />
                Saran Rotasi Adil (paling jarang ikut)
              </p>
              <div className="space-y-1">
                {fairPicks.map((b, idx) => {
                  const rot = rotationMap.get(b.id);
                  return (
                    <BusinessPickRow
                      key={`fair-${b.id}`}
                      business={b}
                      rank={idx + 1}
                      rot={rot}
                      onAssign={onAssign}
                    />
                  );
                })}
              </div>
              {restList.length > 0 && (
                <p className="mt-3 mb-1 text-xs font-medium text-gray-400">
                  ─── Semua UMKM Lainnya ({restList.length}) ───
                </p>
              )}
            </div>
          )}

          {/* Rest of list (or full filtered list when searching) */}
          <div className="space-y-1">
            {(search || filterArea ? sorted : restList).map((b) => {
              const rot = rotationMap.get(b.id);
              return (
                <BusinessPickRow
                  key={b.id}
                  business={b}
                  rank={null}
                  rot={rot}
                  onAssign={onAssign}
                />
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400">
              Tidak ada UMKM yang cocok.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-sub-component: Business pick row inside modal
// ---------------------------------------------------------------------------

function BusinessPickRow({
  business,
  rank,
  rot,
  onAssign,
}: {
  business: Business;
  rank: number | null;
  rot?: { timesAssigned: number; lastAssigned: string | null };
  onAssign: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 transition hover:border-paroki-300 hover:bg-paroki-50/30">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {rank && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
            {rank}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-paroki-900">
              {business.name}
            </span>
            {business.category?.name && (
              <span className="hidden shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 sm:inline">
                {business.category.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            {business.area && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {business.area}
              </span>
            )}
            {rot && (
              <span>
                {rot.timesAssigned > 0
                  ? `${rot.timesAssigned}× ikut bazar`
                  : "Belum pernah ikut"}
              </span>
            )}
          </div>
        </div>
        {/* Detail link */}
        <a
          href={`/${business.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md px-2 py-1 text-xs text-gray-400 transition hover:text-paroki-600"
          title="Lihat detail UMKM"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <button
        onClick={() => onAssign(business.id)}
        className="shrink-0 rounded-lg bg-paroki-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-paroki-800"
      >
        Pilih
      </button>
    </div>
  );
}
