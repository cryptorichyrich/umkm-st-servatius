import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-sandi`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-200';

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-7 w-7 text-green-600" />
        </div>
        <p className="font-display text-lg font-bold text-ink">
          Email Terkirim!
        </p>
        <p className="mt-2 text-sm text-paroki-600">
          Kami telah mengirim tautan reset kata sandi ke:
        </p>
        <p className="mt-1 font-semibold text-ink">{email}</p>
        <p className="mt-3 text-xs text-paroki-400">
          Cek folder spam jika tidak menemukan email. Tautan berlaku 1 jam.
        </p>
        <a
          href="/masuk"
          className="mt-6 inline-block rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-paroki-700 transition hover:bg-paroki-50"
        >
          ← Kembali ke Masuk
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-soft">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@contoh.com"
          className={inputClass}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gold-600 disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px"
      >
        {loading ? 'Mengirim...' : 'Kirim Tautan Reset'}
      </button>
    </form>
  );
}
