import { useState, useEffect, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'checking' | 'ready' | 'success' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);

  // Check if we have a valid recovery session from the email link
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setStatus('ready');
      } else {
        // Listen for the recovery event
        const { data: listener } = supabase.auth.onAuthStateChange((event, sess) => {
          if (event === 'PASSWORD_RECOVERY' && sess) {
            setStatus('ready');
          }
        });
        // Also check after a short delay in case the event already fired
        setTimeout(async () => {
          const { data: { session: s2 } } = await supabase.auth.getSession();
          if (s2) setStatus('ready');
        }, 2000);
        return () => listener.subscription.unsubscribe();
      }
    })();
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Kata sandi tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah kata sandi.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-200';

  const eyeBtn = (show: boolean, toggle: () => void) => (
    <button
      type="button"
      onClick={toggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
      tabIndex={-1}
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  // Loading state
  if (status === 'checking') {
    return (
      <div className="flex flex-col items-center py-8">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-paroki-400" />
        <p className="text-sm text-paroki-600">Memverifikasi tautan...</p>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-7 w-7 text-green-600" />
        </div>
        <h1 class="font-display text-xl font-bold text-ink">Kata Sandi Diperbarui!</h1>
        <p className="mt-2 text-sm text-paroki-600">
          Kata sandi Anda berhasil diubah. Silakan masuk dengan kata sandi baru.
        </p>
        <a
          href="/masuk"
          className="mt-6 inline-block rounded-lg bg-gold-500 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-gold-600"
        >
          Masuk Sekarang
        </a>
      </div>
    );
  }

  // Error state — no valid session
  if (status === 'error') {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-7 w-7 text-red-600" />
        </div>
        <h1 class="font-display text-xl font-bold text-ink">Tautan Tidak Valid</h1>
        <p className="mt-2 text-sm text-paroki-600">
          Tautan reset mungkin sudah kedaluwarsa atau tidak valid.
        </p>
        <a
          href="/lupa-sandi"
          className="mt-6 inline-block rounded-lg bg-gold-500 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-gold-600"
        >
          Minta Tautan Baru
        </a>
      </div>
    );
  }

  // Ready — show password form
  return (
    <div>
      <div className="mb-6 text-center">
        <h1 class="font-display text-2xl font-bold text-ink">Reset Kata Sandi</h1>
        <p className="mt-1 text-sm text-paroki-600">
          Masukkan kata sandi baru Anda.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-soft">
            Kata Sandi Baru
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
            {eyeBtn(showPassword, () => setShowPassword(!showPassword))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-soft">
            Ulangi Kata Sandi Baru
          </label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={`${inputClass} ${
                confirmPassword && password !== confirmPassword
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                  : confirmPassword && password === confirmPassword
                    ? 'border-green-300 focus:border-green-400 focus:ring-green-100'
                    : ''
              }`}
            />
            {eyeBtn(showConfirm, () => setShowConfirm(!showConfirm))}
          </div>
          {confirmPassword && password !== confirmPassword && (
            <p className="mt-1 text-xs text-red-500">Kata sandi tidak cocok</p>
          )}
          {confirmPassword && password === confirmPassword && (
            <p className="mt-1 text-xs text-green-600">✓ Kata sandi cocok</p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (!!confirmPassword && password !== confirmPassword)}
          className="w-full rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gold-600 disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px"
        >
          {loading ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
        </button>
      </form>
    </div>
  );
}
