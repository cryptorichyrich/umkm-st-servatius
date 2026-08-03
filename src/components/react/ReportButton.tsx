import { useState } from 'react';
import { supabase, type ReportTarget, type ReportReason } from '../../lib/supabase';
import { Flag, X, CheckCircle2 } from 'lucide-react';

const REASONS: { value: ReportReason; label: string; icon: string }[] = [
  { value: 'adult', label: 'Konten Dewasa / Pornografi', icon: '🔞' },
  { value: 'scam', label: 'Penipuan / Fraud', icon: '🦹' },
  { value: 'spam', label: 'Spam / Iklan Berlebihan', icon: '📢' },
  { value: 'offensive', label: 'Konten Ofensif / SARA', icon: '⚠️' },
  { value: 'false_info', label: 'Informasi Palsu / Misleading', icon: '❌' },
  { value: 'other', label: 'Lainnya', icon: '📝' },
];

interface Props {
  targetType: ReportTarget;
  targetId: string;
  /** Compact (icon only) or full (icon + text) */
  variant?: 'compact' | 'full';
  className?: string;
}

export default function ReportButton({ targetType, targetId, variant = 'compact', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setSubmitting(true);
    const { data: session } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/masuk';
      return;
    }
    const { error } = await supabase.rpc('create_report', {
      p_target_type: targetType,
      p_target_id: targetId,
      p_reason: reason,
      p_detail: detail,
    });
    setSubmitting(false);
    if (!error) {
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setReason('');
        setDetail('');
      }, 2000);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 transition hover:text-red-500 ${className}`}
      >
        <Flag className="h-3.5 w-3.5" />
        {variant === 'full' && <span>Laporkan</span>}
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          {done ? (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 className="mb-3 h-12 w-12 text-green-500" />
              <h3 className="font-display text-lg font-bold text-ink">Laporan Terkirim</h3>
              <p className="mt-1 text-sm text-gray-500">Terima kasih. Tim admin akan meninjau laporan Anda.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-ink">Laporkan Konten</h3>
                <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Alasan Laporan</label>
                  <div className="space-y-1.5">
                    {REASONS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setReason(r.value)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                          reason === r.value
                            ? 'border-red-400 bg-red-50 text-red-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-lg">{r.icon}</span>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Detail (opsional)</label>
                  <textarea
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Jelaskan masalah dengan konten ini..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={!reason || submitting}
                    className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                  >
                    {submitting ? 'Mengirim...' : 'Kirim Laporan'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
