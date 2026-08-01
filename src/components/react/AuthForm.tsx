import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

interface Props {
  mode: 'login' | 'register';
}

export default function AuthForm({ mode }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === 'register';

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }

      // Redirect to dashboard on success
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isRegister && (
        <div>
          <label
            htmlFor="full_name"
            className="mb-1.5 block text-sm font-medium text-paroki-800"
          >
            Nama Lengkap
          </label>
          <input
            id="full_name"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nama lengkap Anda"
            className="w-full rounded-lg border border-paroki-200 bg-white px-4 py-2.5 text-sm text-paroki-900 outline-none transition focus:border-paroki-400 focus:ring-2 focus:ring-paroki-200"
          />
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium text-paroki-800"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@contoh.com"
          className="w-full rounded-lg border border-paroki-200 bg-white px-4 py-2.5 text-sm text-paroki-900 outline-none transition focus:border-paroki-400 focus:ring-2 focus:ring-paroki-200"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-sm font-medium text-paroki-800"
        >
          Kata Sandi
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-lg border border-paroki-200 bg-white px-4 py-2.5 text-sm text-paroki-900 outline-none transition focus:border-paroki-400 focus:ring-2 focus:ring-paroki-200"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-paroki-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-paroki-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? 'Memproses...'
          : isRegister
            ? 'Daftar Sekarang'
            : 'Masuk'}
      </button>
    </form>
  );
}
