import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff } from 'lucide-react';

interface Props {
  mode: 'login' | 'register';
}

export default function AuthForm({ mode }: Props) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === 'register';

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (isRegister && password !== confirmPassword) {
      setError('Kata sandi tidak cocok. Pastikan kedua kata sandi sama.');
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone,
              role: 'member',
            },
          },
        });
        if (error) throw error;

        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: fullName,
            phone,
            role: 'member',
            verification_status: 'unverified',
            verification_type: '',
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-200';
  const labelClass = 'mb-1.5 block text-sm font-medium text-ink-soft';

  const eyeBtn = (show: boolean, toggle: () => void) => (
    <button
      type="button"
      onClick={toggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
      tabIndex={-1}
      aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isRegister && (
        <>
          <div>
            <label htmlFor="full_name" className={labelClass}>Nama Lengkap</label>
            <input id="full_name" type="text" required value={fullName}
              onChange={(e) => setFullName(e.target.value)} placeholder="Nama lengkap Anda"
              className={inputClass} />
          </div>

          <div>
            <label htmlFor="phone" className={labelClass}>Nomor WhatsApp / Telepon</label>
            <input id="phone" type="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx"
              className={inputClass} />
          </div>
        </>
      )}

      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input id="email" type="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com"
          className={inputClass} />
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>Kata Sandi</label>
        <div className="relative">
          <input id="password" type={showPassword ? 'text' : 'password'} required minLength={6} value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
            className={inputClass} />
          {eyeBtn(showPassword, () => setShowPassword(!showPassword))}
        </div>
      </div>

      {isRegister && (
        <div>
          <label htmlFor="confirm_password" className={labelClass}>Ulangi Kata Sandi</label>
          <div className="relative">
            <input id="confirm_password" type={showConfirm ? 'text' : 'password'} required minLength={6} value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••"
              className={`${inputClass} ${confirmPassword && password !== confirmPassword ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : confirmPassword && password === confirmPassword ? 'border-green-300 focus:border-green-400 focus:ring-green-100' : ''}`}
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
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <button type="submit" disabled={loading}
        className="w-full rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gold-600 disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px">
        {loading ? 'Memproses...' : isRegister ? 'Daftar Sekarang' : 'Masuk'}
      </button>

      {isRegister && (
        <p className="rounded-lg bg-paroki-50 px-4 py-3 text-xs leading-relaxed text-paroki-700">
          Setelah mendaftar, lakukan verifikasi anggota paroki dengan mengunggah foto KK Gereja. Setelah terverifikasi, Anda dapat memberikan ulasan dan mendaftarkan usaha.
        </p>
      )}
    </form>
  );
}
