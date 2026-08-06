import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { History, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface LogEntry {
  id: string;
  admin_name: string;
  action: string;
  target_type: string;
  target_id: string;
  target_name: string;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  verify_verified: { label: 'Verifikasi Anggota', color: 'bg-green-100 text-green-700' },
  verify_rejected: { label: 'Tolak Anggota', color: 'bg-red-100 text-red-700' },
  approve_member_verification: { label: 'Setujui Anggota', color: 'bg-green-100 text-green-700' },
  approve_umkm_verification: { label: 'Setujui UMKM', color: 'bg-green-100 text-green-700' },
  reject_member_verification: { label: 'Tolak Anggota', color: 'bg-red-100 text-red-700' },
  reject_umkm_verification: { label: 'Tolak UMKM', color: 'bg-red-100 text-red-700' },
  approve_business: { label: 'Setujui Listing', color: 'bg-green-100 text-green-700' },
  reject_business: { label: 'Tolak Listing', color: 'bg-red-100 text-red-700' },
  update_profile: { label: 'Edit Profil', color: 'bg-blue-100 text-blue-700' },
  approve_blog: { label: 'Setujui Artikel', color: 'bg-green-100 text-green-700' },
  reject_blog: { label: 'Tolak Artikel', color: 'bg-red-100 text-red-700' },
  toggle_featured: { label: 'Toggle Featured', color: 'bg-purple-100 text-purple-700' },
  delete_review: { label: 'Hapus Ulasan', color: 'bg-orange-100 text-orange-700' },
  delete_product: { label: 'Hapus Produk', color: 'bg-orange-100 text-orange-700' },
};

const PAGE_SIZE = 30;

export default function AdminActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchLogs = useCallback(async (pageNum: number, reset = false) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_admin_activity_log', {
      p_limit: PAGE_SIZE,
      p_offset: pageNum * PAGE_SIZE,
      p_action: filterAction || null,
    });
    if (error) {
      console.error('Log fetch error:', error);
      setLoading(false);
      return;
    }
    const entries = (data || []) as LogEntry[];
    if (reset) setLogs(entries);
    else setLogs(prev => [...prev, ...entries]);
    setHasMore(entries.length === PAGE_SIZE);
    setLoading(false);
  }, [filterAction]);

  useEffect(() => {
    setPage(0);
    fetchLogs(0, true);
  }, [fetchLogs]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchLogs(next);
  };

  const filtered = search
    ? logs.filter(l =>
        l.summary.toLowerCase().includes(search.toLowerCase()) ||
        l.admin_name.toLowerCase().includes(search.toLowerCase()) ||
        l.target_name?.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const actionOptions = Object.entries(ACTION_LABELS).map(([k, v]) => ({ key: k, label: v.label }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-paroki-100">
          <History className="h-5 w-5 text-paroki-700" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Log Aktivitas Admin</h2>
          <p className="text-sm text-gray-500">Riwayat lengkap semua aksi yang dilakukan oleh admin</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama, aksi, atau target..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm outline-none focus:border-paroki-400 focus:ring-2 focus:ring-paroki-100"
          />
        </div>
        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-paroki-400"
        >
          <option value="">Semua Aksi</option>
          {actionOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      {/* Log entries */}
      <div className="overflow-hidden rounded-xl border border-gray-200">
        {loading && filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Memuat log...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Belum ada aktivitas tercatat</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((log) => {
              const meta = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-700' };
              const time = new Date(log.created_at).toLocaleString('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              });
              const isExpanded = expanded === log.id;
              const hasDetails = log.details && Object.keys(log.details).length > 0;

              return (
                <div key={log.id} className="px-4 py-3 transition hover:bg-gray-50">
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : log.id)}
                  >
                    <span className={`mt-0.5 inline-flex shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${meta.color}`}>
                      {meta.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800">{log.summary}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
                        <span>👤 {log.admin_name}</span>
                        {log.target_name && <span>🎯 {log.target_name}</span>}
                        <span>🕒 {time}</span>
                        {hasDetails && <span className="font-medium text-paroki-600">{isExpanded ? '▲ Sembunyikan' : '▼ Detail'}</span>}
                      </div>
                    </div>
                  </div>
                  {isExpanded && hasDetails && (
                    <div className="mt-2 ml-12 rounded-lg bg-gray-50 p-3">
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Load more */}
      {hasMore && !loading && !search && (
        <button
          onClick={loadMore}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          Muat Lebih Banyak <ChevronRight className="h-4 w-4" />
        </button>
      )}
      {loading && filtered.length > 0 && (
        <div className="mt-4 text-center text-sm text-gray-400">Memuat...</div>
      )}
    </div>
  );
}
