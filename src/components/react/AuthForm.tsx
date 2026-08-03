import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { Store, UserCheck, Check } from 'lucide-react';

interface Props {
  mode: 'login' | 'register';
}

export default function AuthForm({ mode }: Props) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState<'owner' | 'member'>('member');
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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone,
              role: selectedRole,
            },
          },
        });
        if (error) throw error;

        // If signup succeeded and we have a user, upsert profile with role + verification_type
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: fullName,
            phone,
            role: selectedRole,
            verification_status: 'pending',
            verification_type: selectedRole === 'owner' ? 'umkm' : 'member',
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

          {/* Role Selection */}
          <div>
            <label className={labelClass}>Daftar sebagai</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedRole('member')}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition ${
                  selectedRole === 'member'
                    ? 'border-gold-500 bg-gold-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  selectedRole === 'member' ? 'bg-gold-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <UserCheck className="h-5 w-5" />
                </span>
                <span className="text-sm font-bold text-ink">Anggota Umat</span>
                <span className="text-[11px] leading-tight text-gray-500">Verifikasi anggota paroki untuk beri ulasan</span>
                {selectedRole === 'member' && (
                  <span className="flex items-center gap-0.5 text-[11px] font-bold text-gold-600">
                    <Check className="h-3 w-3" /> Dipilih
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('owner')}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition ${
                  selectedRole === 'owner'
                    ? 'border-paroki-600 bg-paroki-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  selectedRole === 'owner' ? 'bg-paroki-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  <Store className="h-5 w-5" />
                </span>
                <span className="text-sm font-bold text-ink">Pelaku UMKM</span>
                <span className="text-[11px] leading-tight text-gray-500">Daftarkan usaha, perlu verifikasi bisnis</span>
                {selectedRole === 'owner' && (
                  <span className="flex items-center gap-0.5 text-[11px] font-bold text-paroki-700">
                    <Check className="h-3 w-3" /> Dipilih
                  </span>
                )}
              </button>
            </div>
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
        <input id="password" type="password" required minLength={6} value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
          className={inputClass} />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <button type="submit" disabled={loading}
        className="w-full rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gold-600 disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px">
        {loading ? 'Memproses...' : isRegister ? 'Daftar Sekarang' : 'Masuk'}
      </button>

      {isRegister && (
        <p className="rounded-lg bg-paroki-50 px-4 py-3 text-xs leading-relaxed text-paroki-700">
          {selectedRole === 'owner'
            ? 'Setelah daftar, lengkapi profil usaha Anda. Admin akan memverifikasi bisnis Anda sebelum tampil di direktori.'
            : 'Setelah daftar, admin akan memverifikasi keanggotaan paroki Anda. Setelah terverifikasi, Anda dapat memberikan ulasan.'}
        </p>
      )}
    </form>
  );
}
