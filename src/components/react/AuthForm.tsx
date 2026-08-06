import { useState, useEffect, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, Phone, Mail, MessageCircle, Sparkles, KeyRound } from 'lucide-react';

interface Props {
  mode: 'login' | 'register';
}

// ── Smart phone normalization: accepts 0813xxx, 62813xxx, +62813xxx, 813xxx ──
function normalizePhone(raw: string): string {
  let p = raw.trim().replace(/[\s\-().]/g, '');
  if (p.startsWith('+62')) return p;
  if (p.startsWith('62')) return '+' + p;
  if (p.startsWith('0')) return '+62' + p.slice(1);
  if (p.startsWith('8')) return '+62' + p;
  if (p.startsWith('+')) return p;
  return '+62' + p;
}

function isValidPhone(raw: string): boolean {
  return /^\+62\d{9,13}$/.test(normalizePhone(raw));
}

// ═══════════════════════════════════════════════════════════════════
// RATE LIMITER — localStorage-backed, client-side brute-force protection
// Thresholds: 5 fails → 60s, 10 fails → 5min, 20 fails → 30min
// ═══════════════════════════════════════════════════════════════════

const LIMITER_KEY = 'umkm_auth_limiter';
const REG_KEY = 'umkm_reg_limiter';
const HOUR_MS = 3600_000;

interface AttemptRecord { count: number; firstAt: number; lockedUntil: number; }

function getAttempts(identifier: string): AttemptRecord {
  try {
    const all: Record<string, AttemptRecord> = JSON.parse(localStorage.getItem(LIMITER_KEY) || '{}');
    return all[identifier] || { count: 0, firstAt: 0, lockedUntil: 0 };
  } catch {
    return { count: 0, firstAt: 0, lockedUntil: 0 };
  }
}

function getLockoutMs(count: number): number {
  if (count >= 20) return 30 * 60 * 1000; // 30 min
  if (count >= 10) return 5 * 60 * 1000;  // 5 min
  if (count >= 5)  return 60 * 1000;       // 60 sec
  return 0;
}

function triesBeforeLock(count: number): number {
  if (count >= 20) return 0;
  if (count >= 10) return 20 - count;
  if (count >= 5)  return 10 - count;
  return 5 - count;
}

function recordFail(identifier: string): { lockSecs: number; triesLeft: number } {
  const now = Date.now();
  let all: Record<string, AttemptRecord> = {};
  try { all = JSON.parse(localStorage.getItem(LIMITER_KEY) || '{}'); } catch {}
  const rec = all[identifier] || { count: 0, firstAt: now, lockedUntil: 0 };
  // Reset window after 1 hour of inactivity
  if (rec.firstAt && now - rec.firstAt > HOUR_MS) {
    rec.count = 0;
    rec.firstAt = now;
  }
  rec.count++;
  const lockMs = getLockoutMs(rec.count);
  if (lockMs > 0) rec.lockedUntil = now + lockMs;
  all[identifier] = rec;
  try { localStorage.setItem(LIMITER_KEY, JSON.stringify(all)); } catch {}
  return {
    lockSecs: lockMs > 0 ? Math.ceil(lockMs / 1000) : 0,
    triesLeft: triesBeforeLock(rec.count),
  };
}

function clearFail(identifier: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(LIMITER_KEY) || '{}');
    delete all[identifier];
    localStorage.setItem(LIMITER_KEY, JSON.stringify(all));
  } catch {}
}

function checkLockout(identifier: string): { locked: boolean; secs: number } {
  const rec = getAttempts(identifier);
  if (!rec.lockedUntil) return { locked: false, secs: 0 };
  const remaining = rec.lockedUntil - Date.now();
  if (remaining <= 0) return { locked: false, secs: 0 };
  return { locked: true, secs: Math.ceil(remaining / 1000) };
}

function canRegister(): boolean {
  try {
    const times: number[] = JSON.parse(localStorage.getItem(REG_KEY) || '[]');
    return times.filter(t => Date.now() - t < HOUR_MS).length < 3;
  } catch { return true; }
}

function recordReg(): void {
  try {
    const times: number[] = JSON.parse(localStorage.getItem(REG_KEY) || '[]');
    times.push(Date.now());
    localStorage.setItem(REG_KEY, JSON.stringify(times.slice(-10)));
  } catch {}
}

function formatLockMsg(secs: number): string {
  if (secs >= 3600) return `Akun terkunci ${Math.floor(secs / 3600)} jam ${Math.ceil((secs % 3600) / 60)} menit. Terlalu banyak percobaan gagal.`;
  if (secs >= 60)   return `Akun terkunci ${Math.ceil(secs / 60)} menit. Terlalu banyak percobaan gagal.`;
  return `Tunggu ${secs} detik sebelum mencoba lagi.`;
}

// ═══════════════════════════════════════════════════════════════════

export default function AuthForm({ mode }: Props) {
  const isRegister = mode === 'register';

  // ── Login tabs ──
  const [authTab, setAuthTab] = useState<'email' | 'phone'>('email');

  // ── Phone sub-mode (password vs OTP) ──
  const [phoneMode, setPhoneMode] = useState<'password' | 'otp'>('password');

  // ── Form fields ──
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Login-specific
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPhonePw, setLoginPhonePw] = useState('');

  // OTP flow (phone)
  const [waCode, setWaCode] = useState('');
  const [waSent, setWaSent] = useState(false);
  const [waResendTimer, setWaResendTimer] = useState(0);

  // Magic link flow (email)
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Common
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // ── Lockout countdown ──
  const [lockSecs, setLockSecs] = useState(0);

  useEffect(() => {
    if (lockSecs <= 0) return;
    const t = setInterval(() => setLockSecs(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [lockSecs]);

  // ── Resend timer ──
  const startResendTimer = () => {
    setWaResendTimer(60);
    const interval = setInterval(() => {
      setWaResendTimer((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ═══════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════

  // ── Email + Password login ──
  const handleEmailLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null); setInfo(null);
    const id = email.toLowerCase().trim();
    const lock = checkLockout(id);
    if (lock.locked) {
      setError(formatLockMsg(lock.secs));
      setLockSecs(lock.secs);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      clearFail(id);
      window.location.href = '/dashboard';
    } catch (err) {
      const { lockSecs: ls, triesLeft } = recordFail(id);
      if (ls > 0) { setError(formatLockMsg(ls)); setLockSecs(ls); }
      else { setError(`Email atau kata sandi salah. Sisa percobaan: ${triesLeft}.`); }
    } finally { setLoading(false); }
  };

  // ── Email Magic Link ──
  const handleMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null);
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Masukkan email yang valid.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + '/dashboard' },
      });
      if (error) throw error;
      setMagicLinkSent(true);
      setInfo(`✓ Tautan magic link telah dikirim ke ${email}. Klik tautan di email untuk masuk.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim magic link.');
    } finally { setLoading(false); }
  };

  // ── Phone + Password login ──
  const handlePhoneLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null); setInfo(null);

    const normalized = normalizePhone(loginPhone);
    if (!isValidPhone(loginPhone)) {
      setError('Nomor HP tidak valid. Contoh: 08123456789, +628****6789, 628123456789');
      return;
    }
    const lock = checkLockout(normalized);
    if (lock.locked) {
      setError(formatLockMsg(lock.secs));
      setLockSecs(lock.secs);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        phone: normalized,
        password: loginPhonePw,
      });
      if (error) throw error;
      clearFail(normalized);
      window.location.href = '/dashboard';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk.';
      const { lockSecs: ls, triesLeft } = recordFail(normalized);
      if (ls > 0) { setError(formatLockMsg(ls)); setLockSecs(ls); }
      else if (msg.includes('Invalid login') || msg.includes('credentials')) {
        setError(`Nomor HP atau kata sandi salah. Sisa percobaan: ${triesLeft}.`);
      } else {
        setError(msg);
      }
    } finally { setLoading(false); }
  };

  // ── Phone OTP send ──
  const handleSendOtp = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null); setInfo(null);

    const normalized = normalizePhone(loginPhone);
    if (!isValidPhone(loginPhone)) {
      setError('Nomor HP tidak valid. Contoh: 08123456789, +628****6789, 628123456789');
      return;
    }
    // OTP send also has its own limiter (prevent SMS spam)
    const lock = checkLockout('otp:' + normalized);
    if (lock.locked) {
      setError(formatLockMsg(lock.secs));
      setLockSecs(lock.secs);
      return;
    }
    setLoading(true);
    try {
      const { data, error: otpError } = await supabase.auth.signInWithOtp({ phone: normalized });
      if (otpError) throw otpError;
      clearFail('otp:' + normalized);
      if (data?.session) { window.location.href = '/dashboard'; return; }
      setWaSent(true);
      setInfo(`Kode OTP telah dikirim ke ${normalized}`);
      startResendTimer();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim kode.';
      const { lockSecs: ls } = recordFail('otp:' + normalized);
      if (ls > 0) { setError(formatLockMsg(ls)); setLockSecs(ls); }
      else { setError(msg); }
      setWaSent(false);
    } finally { setLoading(false); }
  };

  // ── Phone OTP verify ──
  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const normalized = normalizePhone(loginPhone);
    const lock = checkLockout('otp:' + normalized);
    if (lock.locked) {
      setError(formatLockMsg(lock.secs));
      setLockSecs(lock.secs);
      return;
    }
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: normalized, token: waCode, type: 'sms',
      });
      if (verifyError) throw verifyError;
      clearFail('otp:' + normalized);
      window.location.href = '/dashboard';
    } catch (err) {
      const { lockSecs: ls, triesLeft } = recordFail('otp:' + normalized);
      if (ls > 0) { setError(formatLockMsg(ls)); setLockSecs(ls); }
      else { setError(`Kode salah atau kedaluwarsa. Sisa percobaan: ${triesLeft}.`); }
    } finally { setLoading(false); }
  };

  // ── Registration ──
  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null); setInfo(null);

    if (!canRegister()) {
      setError('Anda sudah mendaftar 3 kali dalam 1 jam. Coba lagi nanti.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Kata sandi tidak cocok.');
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setError('Nomor HP tidak valid. Contoh: 08123456789, +628****6789, 628123456789');
      return;
    }

    setLoading(true);
    try {
      const normalizedPhone = phone ? normalizePhone(phone) : '';
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName, phone: normalizedPhone, role: 'member' } },
      });
      if (error) throw error;

      if (data.user) {
        if (normalizedPhone) {
          await supabase.auth.updateUser({ phone: normalizedPhone }).catch(() => {});
        }
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName,
          phone: normalizedPhone,
          role: 'member',
          verification_status: 'unverified',
          verification_type: '',
        });
      }
      recordReg();
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan. Silakan coba lagi.');
    } finally { setLoading(false); }
  };

  // ── Shared UI helpers ──
  const inputClass =
    'w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-gold-400 focus:ring-2 focus:ring-gold-200';
  const labelClass = 'mb-1.5 block text-sm font-medium text-ink-soft';

  const eyeBtn = (show: boolean, toggle: () => void) => (
    <button type="button" onClick={toggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
      tabIndex={-1} aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  const ErrorBox = () => error ? (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error}
      {lockSecs > 0 && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-600">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
          Terkunci: {lockSecs >= 60 ? `${Math.floor(lockSecs / 60)}m ${lockSecs % 60}s` : `${lockSecs}s`}
        </div>
      )}
    </div>
  ) : null;

  const InfoBox = () => info ? (
    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{info}</div>
  ) : null;

  // ═══════════════════════════════════════
  // LOGIN MODE
  // ═══════════════════════════════════════
  if (!isRegister) {
    return (
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex rounded-lg border border-gray-200 p-1">
          <button type="button"
            onClick={() => { setAuthTab('email'); setError(null); setInfo(null); setMagicLinkSent(false); setLockSecs(0); }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
              authTab === 'email' ? 'bg-paroki-800 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Mail className="h-4 w-4" /> Email
          </button>
          <button type="button"
            onClick={() => { setAuthTab('phone'); setError(null); setInfo(null); setWaSent(false); setLockSecs(0); }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
              authTab === 'phone' ? 'bg-paroki-800 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Phone className="h-4 w-4" /> No. HP
          </button>
        </div>

        {/* ── Email tab ── */}
        {authTab === 'email' && (
          <div className="space-y-4">
            {magicLinkSent ? (
              <div className="space-y-4">
                <InfoBox />
                <button type="button" onClick={() => { setMagicLinkSent(false); setInfo(null); }}
                  className="w-full text-center text-sm font-medium text-paroki-700 hover:underline">
                  ← Kembali ke login
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div>
                    <label htmlFor="email" className={labelClass}>Email</label>
                    <input id="email" type="email" required value={email}
                      onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com"
                      className={inputClass} />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="password" className={labelClass}>Kata Sandi</label>
                      <a href="/lupa-sandi" className="text-xs font-medium text-paroki-700 hover:text-paroki-900 hover:underline">
                        Lupa kata sandi?
                      </a>
                    </div>
                    <div className="relative">
                      <input id="password" type={showPassword ? 'text' : 'password'} required minLength={8}
                        value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                        className={inputClass} />
                      {eyeBtn(showPassword, () => setShowPassword(!showPassword))}
                    </div>
                  </div>
                  <ErrorBox />
                  <button type="submit" disabled={loading || lockSecs > 0}
                    className="w-full rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gold-600 disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px">
                    {loading ? 'Memproses...' : lockSecs > 0 ? 'Terlalu cepat — tunggu...' : 'Masuk'}
                  </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs text-gray-400">atau</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                {/* Magic Link */}
                <button type="button" onClick={handleMagicLink} disabled={loading || !email}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-paroki-300 bg-white px-4 py-2.5 text-sm font-semibold text-paroki-800 transition hover:bg-paroki-50 disabled:cursor-not-allowed disabled:opacity-50">
                  <Sparkles className="h-4 w-4 text-gold-500" />
                  {loading ? 'Mengirim...' : 'Kirim Magic Link ke Email'}
                </button>
                <p className="text-center text-xs text-gray-400">
                  Tautan akan dikirim ke email Anda. Klik untuk masuk tanpa kata sandi.
                </p>
              </>
            )}
          </div>
        )}

        {/* ── Phone tab ── */}
        {authTab === 'phone' && (
          <div className="space-y-4">
            {/* Phone input always visible */}
            <div>
              <label htmlFor="login_phone" className={labelClass}>Nomor HP / WhatsApp</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input id="login_phone" type="tel" required value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="08123456789 / +628****6789 / 628123456789"
                  className={`${inputClass} pl-10`} />
              </div>
              {loginPhone && !isValidPhone(loginPhone) && (
                <p className="mt-1 text-xs text-red-400">Format nomor tidak dikenali</p>
              )}
              {loginPhone && isValidPhone(loginPhone) && (
                <p className="mt-1 text-xs text-green-500">→ {normalizePhone(loginPhone)}</p>
              )}
            </div>

            {/* OTP verify screen */}
            {waSent ? (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <InfoBox />
                <div>
                  <label htmlFor="wa_code" className={labelClass}>Kode Verifikasi (6 digit)</label>
                  <input id="wa_code" type="text" inputMode="numeric" pattern="\d{6}" maxLength={6} required
                    value={waCode} onChange={(e) => setWaCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className={`${inputClass} text-center text-2xl font-bold tracking-[0.5em]`} autoFocus />
                </div>
                <ErrorBox />
                <button type="submit" disabled={loading || waCode.length !== 6 || lockSecs > 0}
                  className="w-full rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gold-600 disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px">
                  {loading ? 'Memverifikasi...' : lockSecs > 0 ? 'Terlalu cepat — tunggu...' : 'Verifikasi'}
                </button>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => { setWaSent(false); setWaCode(''); setError(null); }}
                    className="font-medium text-paroki-700 hover:underline">← Ganti nomor</button>
                  {waResendTimer > 0 ? (
                    <span className="text-gray-400">Kirim ulang {waResendTimer}s</span>
                  ) : (
                    <button type="button" onClick={() => handleSendOtp()}
                      className="font-medium text-paroki-700 hover:underline">Kirim ulang kode</button>
                  )}
                </div>
              </form>
            ) : (
              <form onSubmit={handlePhoneLogin} className="space-y-4">
                <div>
                  <label htmlFor="login_phone_pw" className={labelClass}>Kata Sandi</label>
                  <div className="relative">
                    <input id="login_phone_pw" type={showPassword ? 'text' : 'password'} required minLength={8}
                      value={loginPhonePw} onChange={(e) => setLoginPhonePw(e.target.value)}
                      placeholder="••••••••" className={inputClass} />
                    {eyeBtn(showPassword, () => setShowPassword(!showPassword))}
                  </div>
                </div>
                <ErrorBox />
                <button type="submit" disabled={loading || lockSecs > 0}
                  className="w-full rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gold-600 disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px">
                  {loading ? 'Memproses...' : lockSecs > 0 ? 'Terlalu cepat — tunggu...' : 'Masuk'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Footer link */}
        <p className="text-center text-sm text-paroki-600">
          Belum punya akun?{' '}
          <a href="/daftar" className="font-semibold text-paroki-700 hover:text-paroki-900 hover:underline">
            Daftar di sini
          </a>
        </p>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // REGISTER MODE
  // ═══════════════════════════════════════
  return (
    <form onSubmit={handleRegister} className="space-y-4">
      <div>
        <label htmlFor="full_name" className={labelClass}>Nama Lengkap</label>
        <input id="full_name" type="text" required value={fullName}
          onChange={(e) => setFullName(e.target.value)} placeholder="Nama lengkap Anda"
          className={inputClass} />
      </div>

      <div>
        <label htmlFor="phone" className={labelClass}>Nomor WhatsApp / Telepon</label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input id="phone" type="tel" value={phone}
            onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx"
            className={`${inputClass} pl-10`} />
        </div>
        {phone && !isValidPhone(phone) && (
          <p className="mt-1 text-xs text-red-400">Format nomor tidak dikenali</p>
        )}
        {phone && isValidPhone(phone) && (
          <p className="mt-1 text-xs text-green-500">→ {normalizePhone(phone)}</p>
        )}
      </div>

      {/* BIDUK removed — now asked during member verification */}

      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input id="email" type="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com"
          className={inputClass} />
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>Kata Sandi</label>
        <div className="relative">
          <input id="password" type={showPassword ? 'text' : 'password'} required minLength={8}
            value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
            className={inputClass} />
          {eyeBtn(showPassword, () => setShowPassword(!showPassword))}
        </div>
      </div>

      <div>
        <label htmlFor="confirm_password" className={labelClass}>Ulangi Kata Sandi</label>
        <div className="relative">
          <input id="confirm_password" type={showConfirm ? 'text' : 'password'} required minLength={8}
            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••"
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

      {/* UMKM info removed — now asked during UMKM verification */}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Terms checkbox */}
      <label className="flex items-start gap-2.5">
        <input type="checkbox" checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-gold-500 focus:ring-gold-400" />
        <span className="text-xs leading-relaxed text-gray-600">
          Saya menyetujui{' '}
          <a href="/syarat-ketentuan" target="_blank" className="font-semibold text-paroki-700 hover:underline">Syarat &amp; Ketentuan</a>
          {' '}serta{' '}
          <a href="/kebijakan-privasi" target="_blank" className="font-semibold text-paroki-700 hover:underline">Kebijakan Privasi</a>
          {' '}UMKM St. Servatius.
        </span>
      </label>

      <button type="submit" disabled={loading || !termsAccepted}
        className="w-full rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gold-600 disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px">
        {loading ? 'Memproses...' : termsAccepted ? 'Daftar Sekarang' : 'Centang syarat untuk mendaftar'}
      </button>

      <p className="rounded-lg bg-paroki-50 px-4 py-3 text-xs leading-relaxed text-paroki-700">
        Setelah mendaftar, lakukan verifikasi anggota paroki dengan mengunggah foto KK Gereja (BIDUK). Setelah terverifikasi, Anda dapat memberikan ulasan dan mendaftarkan usaha.
      </p>

      <p className="text-center text-sm text-paroki-600">
        Sudah punya akun?{' '}
        <a href="/masuk" className="font-semibold text-paroki-700 hover:text-paroki-900 hover:underline">
          Masuk di sini
        </a>
      </p>
    </form>
  );
}
