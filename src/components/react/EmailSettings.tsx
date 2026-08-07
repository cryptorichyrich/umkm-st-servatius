import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, AlertCircle } from 'lucide-react';

// Shape returned by the get_email_settings() RPC
interface EmailSetting {
  event_key: string;
  label: string;
  category: 'client' | 'admin';
  enabled: boolean;
}

const SECTION_META: Record<
  'client' | 'admin',
  { title: string; subtitle: string }
> = {
  client: {
    title: 'Notifikasi Klien',
    subtitle: 'Email yang dikirim ke pelanggan / klien UMKM',
  },
  admin: {
    title: 'Notifikasi Admin',
    subtitle: 'Email yang dikirim ke tim admin paroki',
  },
};

export default function EmailSettings() {
  const [settings, setSettings] = useState<EmailSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load all settings on mount ──
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('get_email_settings');
    if (error) {
      setError('Gagal memuat pengaturan email: ' + error.message);
    } else {
      setSettings((data ?? []) as EmailSetting[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Optimistic toggle ──
  const toggle = async (eventKey: string, nextEnabled: boolean) => {
    // Optimistic update — flip immediately
    setSettings((prev) =>
      prev.map((s) =>
        s.event_key === eventKey ? { ...s, enabled: nextEnabled } : s
      )
    );
    const { error } = await supabase.rpc('toggle_email_setting', {
      p_event_key: eventKey,
      p_enabled: nextEnabled,
    });
    if (error) {
      // Rollback on failure
      setSettings((prev) =>
        prev.map((s) =>
          s.event_key === eventKey ? { ...s, enabled: !nextEnabled } : s
        )
      );
      setError('Gagal menyimpan: ' + error.message);
    } else {
      setError(null);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-paroki-200 border-t-paroki-600" />
      </div>
    );
  }

  const clientRows = settings.filter((s) => s.category === 'client');
  const adminRows = settings.filter((s) => s.category === 'admin');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-serif text-xl font-bold text-paroki-900">
          Pengaturan Email
        </h2>
        <p className="mt-1 text-sm text-paroki-600">
          Aktifkan atau nonaktifkan notifikasi email untuk setiap peristiwa.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {settings.length === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-paroki-300 bg-white py-16 text-center">
          <div className="mb-3 flex justify-center">
            <Mail className="h-12 w-12 text-paroki-300" />
          </div>
          <p className="font-medium text-paroki-700">
            Belum ada pengaturan email
          </p>
        </div>
      ) : (
        <>
          <SettingSection
            meta={SECTION_META.client}
            rows={clientRows}
            onToggle={toggle}
          />
          <SettingSection
            meta={SECTION_META.admin}
            rows={adminRows}
            onToggle={toggle}
          />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Section with header + rows
// ─────────────────────────────────────────────
function SettingSection({
  meta,
  rows,
  onToggle,
}: {
  meta: { title: string; subtitle: string };
  rows: EmailSetting[];
  onToggle: (eventKey: string, next: boolean) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="mb-3 rounded-xl bg-paroki-800 px-5 py-3">
        <h3 className="font-serif text-base font-bold text-white">
          {meta.title}
        </h3>
        <p className="text-xs text-paroki-100">{meta.subtitle}</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-paroki-200 bg-white shadow-sm">
        {rows.map((row, idx) => (
          <div
            key={row.event_key}
            className={`flex items-center justify-between px-5 py-4 ${
              idx > 0 ? 'border-t border-paroki-100' : ''
            }`}
          >
            <div>
              <p className="text-sm font-medium text-paroki-800">
                {row.label}
              </p>
              <p className="font-mono text-xs text-paroki-400">
                {row.event_key}
              </p>
            </div>
            <ToggleSwitch
              checked={row.enabled}
              onChange={(next) => onToggle(row.event_key, next)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Toggle switch (green when on)
// ─────────────────────────────────────────────
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 ${
        checked ? 'bg-green-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
