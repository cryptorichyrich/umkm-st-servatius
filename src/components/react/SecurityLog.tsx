import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface SecurityEntry {
  id: string;
  event_type: string;
  identifier: string;
  success: boolean;
  details: Record<string, unknown>;
  created_at: string;
}

const EVENT_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  login_success:        { label: 'Login Berhasil',       color: 'bg-green-100 text-green-700',   icon: '✓' },
  login_failed:         { label: 'Login Gagal',          color: 'bg-red-100 text-red-700',       icon: '✕' },
  login_rate_limited:   { label: 'Rate Limited',         color: 'bg-orange-100 text-orange-700', icon: '⏱' },
  register_success:     { label: 'Daftar Berhasil',      color: 'bg-green-100 text-green-700',   icon: '✓' },
  register_failed:      { label: 'Daftar Gagal',         color: 'bg-red-100 text-red-700',       icon: '✕' },
  otp_sent:             { label: 'OTP Dikirim',          color: 'bg-blue-100 text-blue-700',     icon: '📱' },
  otp_failed:           { label: 'OTP Gagal',            color: 'bg-red-100 text-red-700',       icon: '✕' },
  otp_verify_failed:    { label: 'OTP Salah',            color: 'bg-orange-100 text-orange-700', icon: '✕' },
  magic_link_sent:      { label: 'Magic Link',           color: 'bg-blue-100 text-blue-700',     icon: '✨' },
  magic_link_failed:    { label: 'Magic Link Gagal',     color: 'bg-red-100 text-red-700',       icon: '✕' },
  password_reset_sent:  { label: 'Reset Sandi',          color: 'bg-blue-100 text-blue-700',     icon: '🔑' },
  password_reset_failed:{ label: 'Reset Gagal',          color: 'bg-red-100 text-red-700',       icon: '✕' },
  turnstile_blocked:    { label: 'Turnstile Blokir',     color: 'bg-red-100 text-red-700',       icon: '🛡' },
  honeypot_triggered:   { label: 'Honeypot Bot!',        color: 'bg-red-800 text-white',         icon: '🐝' },
};

const PAGE_SIZE = 30;

export default function SecurityLog() {
  const [logs, setLogs] = useState<SecurityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');

  const fetchLogs = useCallback(async (pageNum: number, reset = false) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_security_events', {
      p_limit: PAGE_SIZE,
      p_offset: pageNum * PAGE_SIZE,
      p_type: filterType || null,
    });
    if (error) { setLoading(false); return; }
    const entries = (data || []) as SecurityEntry[];
    if (reset) setLogs(entries);
    else setLogs(prev => [...prev, ...entries]);
    setHasMore(entries.length === PAGE_SIZE);
    setLoading(false);
  }, [filterType]);

  useEffect(() => { setPage(0); fetchLogs(0, true); }, [fetchLogs]);

  const loadMore = () => { const next = page + 1; setPage(next); fetchLogs(next); };

  const filtered = search
    ? logs.filter(l =>
        l.identifier.toLowerCase().includes(search.toLowerCase()) ||
        l.event_type.toLowerCase().includes(search.toLowerCase()))
    : logs;

  const eventOptions = Object.entries(EVENT_LABELS).map(([k, v]) => ({ key: k, label: v.label }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
          <Shield className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Log Keamanan</h2>
          <p className="text-sm text-gray-500">Aktivitas autentikasi &amp; percobaan bot — auto-hapus 90 hari</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari email / nomor HP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm outline-none focus:border-paroki-400 focus:ring-2 focus:ring-paroki-100"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-paroki-400"
        >
          <option value="">Semua Event</option>
          {eventOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      {/* Log entries */}
      <div className="overflow-hidden rounded-xl border border-gray-200">
        {loading && filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Memuat log...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Belum ada aktivitas keamanan tercatat</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((log) => {
              const meta = EVENT_LABELS[log.event_type] || { label: log.event_type, color: 'bg-gray-100 text-gray-700', icon: '?' };
              const time = new Date(log.created_at).toLocaleString('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              });
              const hasDetails = log.details && Object.keys(log.details).length > 0;

              return (
                <div key={log.id} className="px-4 py-3 transition hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 inline-flex shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${meta.color}`}>
                      {meta.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800">
                        {log.identifier || '(kosong)'}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
                        <span>🕒 {time}</span>
                        {hasDetails && (
                          <span className="font-mono text-gray-500">
                            {JSON.stringify(log.details)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
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
    </div>
  );
}
