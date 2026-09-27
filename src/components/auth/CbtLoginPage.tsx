import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, Info, School, Loader2, GraduationCap, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AppSettings } from '../../types';
import { toast } from '../ui/Toast';

interface CbtLoginPageProps {
  initialRole: 'siswa' | 'admin';
  onSwitchRole: (newRole: 'siswa' | 'admin') => void;
  overrideSettings?: AppSettings;
  isEmbeddedPreview?: boolean;
}

export const CbtLoginPage: React.FC<CbtLoginPageProps> = ({
  initialRole,
  onSwitchRole,
  overrideSettings,
  isEmbeddedPreview = false
}) => {
  const { login, settings } = useAuth();
  const [role, setRole] = useState<'siswa' | 'admin'>(initialRole);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const effectiveSettings = overrideSettings || settings;

  const schoolName = effectiveSettings?.school_name || 'SMA Negeri 1 Nusantara';
  const schoolShortName = effectiveSettings?.school_short_name || 'SMA 1 Nusantara';
  const schoolLogoUrl = effectiveSettings?.school_logo_url || effectiveSettings?.school_logo || '';
  const loginTitle = effectiveSettings?.login_title || 'Login Ujian CBT';
  const loginDescription = effectiveSettings?.login_description || 'Silakan masuk menggunakan akun resmi Anda untuk mengikuti ujian.';
  const loginButtonText = effectiveSettings?.login_button_text || 'MASUK KE PORTAL UJIAN';

  const primaryColor = effectiveSettings?.primary_color || '#3b82f6'; // Clean blue
  const buttonColor = effectiveSettings?.button_color || '#2563eb';   // Indigo/blue
  const backgroundColor = effectiveSettings?.background_color || '#f8fafc'; // Neutral slate-50

  const handleRoleChange = (selected: 'siswa' | 'admin') => {
    setRole(selected);
    setError('');
    onSwitchRole(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const cleanPass = password;

    if (!cleanUser || !cleanPass) {
      setError('Silakan masukkan username/email dan password Anda.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await login(cleanUser, cleanPass);
      if (res.success) {
        if (role === 'admin' && res.role !== 'admin') {
          setError('Akun ini terdaftar sebagai Siswa. Mengarahkan ke Portal Siswa...');
          toast.info('Akun siswa terdeteksi.');
          setTimeout(() => {
            handleRoleChange('siswa');
          }, 800);
        } else if (role === 'siswa' && res.role === 'admin') {
          toast.success('Login Admin berhasil!');
        } else {
          toast.success('Login berhasil! Selamat datang.');
        }
      } else {
        const failureMessage = res.message || 'Email/Username atau Password salah.';
        setError(failureMessage);
        if (res.statusCode && res.statusCode >= 500) {
          toast.error('Gagal terhubung ke database/server. Periksa log server.');
        } else {
          toast.error(failureMessage);
        }
      }
    } catch (err: any) {
      console.error('[CbtLoginPage] Form Submit Error:', err);
      const errText = err?.message || 'Terjadi gangguan koneksi ke server CBT.';
      setError(errText);
      toast.error(errText);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    toast.info('Silakan hubungi proktor, wali kelas, atau administrator sekolah untuk mereset password.');
  };

  return (
    <div
      className={`min-h-screen font-sans relative flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-x-hidden`}
      style={{ backgroundColor }}
    >
      {/* Subtle modern radial background grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35 pointer-events-none" />

      {/* Modern floating ambient glow effects */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-blue-400/10 blur-[100px] -top-40 -left-40 pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] rounded-full bg-indigo-400/10 blur-[100px] -bottom-40 -right-40 pointer-events-none" />

      {/* ================= MAIN WRAPPER CARD ================= */}
      <main className="relative z-10 w-full max-w-[1020px] bg-white rounded-2xl md:rounded-3xl shadow-[0_32px_64px_-16px_rgba(15,23,42,0.08)] overflow-hidden flex flex-col md:flex-row border border-slate-100">
        
        {/* ================= LEFT BRANDING PANEL ================= */}
        <section
          className="md:w-5/12 relative overflow-hidden flex flex-col justify-between p-8 md:p-10 lg:p-12 text-white select-none shrink-0"
          style={{ backgroundColor: primaryColor }}
        >
          {/* Subtle glowing lines & pattern on left panel */}
          <div className="absolute inset-0 bg-gradient-to-tr from-black/15 via-transparent to-white/10 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)] pointer-events-none" />

          {/* Top Section: Institution Name */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-3">
              <div className="w-10 h-10 bg-white/15 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-sm overflow-hidden">
                {schoolLogoUrl ? (
                  <img src={schoolLogoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <School className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="text-left leading-tight">
                <span className="text-[10px] font-bold tracking-widest text-white/70 uppercase block">PORTAL CBT</span>
                <span className="text-sm font-extrabold tracking-wide text-white block truncate max-w-[180px]">
                  {schoolShortName || schoolName}
                </span>
              </div>
            </div>
          </div>

          {/* Middle Section: Clean Illustration/Shield Card */}
          <div className="relative z-10 my-8 flex flex-col items-center justify-center">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-white/10 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-xl animate-fade-in">
              {schoolLogoUrl ? (
                <img
                  src={schoolLogoUrl}
                  alt="School Logo Big"
                  className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-md"
                />
              ) : (
                <GraduationCap className="w-12 h-12 sm:w-16 sm:h-16 text-white drop-shadow-sm" />
              )}
            </div>

            {/* Micro badge indicator */}
            <div className="mt-4 px-3 py-1 bg-white/15 backdrop-blur-md border border-white/20 rounded-full flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white">Sistem Aktif</span>
            </div>
          </div>

          {/* Bottom Section: Branding Footer */}
          <div className="relative z-10">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white mb-2 leading-snug">
              {loginTitle}
            </h1>
            <p className="text-xs text-white/80 leading-relaxed font-medium">
              Aplikasi ujian berbasis komputer yang andal, jujur, transparan, dan berstandar nasional.
            </p>
          </div>
        </section>

        {/* ================= RIGHT FORM PANEL ================= */}
        <section className="md:w-7/12 bg-slate-50/50 p-8 sm:p-10 md:p-12 lg:p-14 flex items-center">
          <div className="w-full max-w-[380px] mx-auto">
            
            {/* Header Text */}
            <div className="text-left mb-6">
              <span className="text-[10px] font-extrabold tracking-widest text-indigo-600 uppercase block mb-1">
                SELAMAT DATANG DI CBT
              </span>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-2">
                Masuk ke Akun Anda
              </h2>
              <p className="text-slate-500 text-xs leading-relaxed">
                {loginDescription}
              </p>
            </div>

            {/* Premium Role Selector (Segmented Pill Buttons) */}
            <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-xl mb-6 border border-slate-200/50">
              <button
                type="button"
                onClick={() => handleRoleChange('siswa')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  role === 'siswa'
                    ? 'bg-white text-slate-800 shadow-xs border border-slate-200/20'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <GraduationCap className={`w-4 h-4 ${role === 'siswa' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>Portal Siswa</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('admin')}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  role === 'admin'
                    ? 'bg-white text-slate-800 shadow-xs border border-slate-200/20'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <ShieldCheck className={`w-4 h-4 ${role === 'admin' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>Admin / Proktor</span>
              </button>
            </div>

            {/* Error Message banner */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold leading-relaxed flex items-start gap-2 animate-shake">
                <Info className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Form Fields */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Field */}
              <div>
                <label htmlFor="username" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {role === 'siswa' ? 'Username / NIS' : 'Username Administrator'}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={role === 'siswa' ? 'Masukkan username atau nomor NIS' : 'Masukkan username proktor'}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-11 pr-3.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-3xs font-medium"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock className="w-4.5 h-4.5" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan sandi rahasia Anda"
                    className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-3xs font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              {/* Remember & Lupa Password */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-500 hover:text-slate-800 transition select-none font-semibold">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Ingat saya</span>
                </label>

                <a
                  href="#forgot"
                  onClick={handleForgotPassword}
                  className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Lupa password?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                style={{ backgroundColor: buttonColor }}
                className="w-full h-11 rounded-xl mt-3 text-white font-extrabold tracking-wide shadow-lg hover:brightness-105 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer border border-black/5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    <span>MEMVALIDASI AKUN...</span>
                  </>
                ) : (
                  <span>{loginButtonText || 'MASUK KE PORTAL UJIAN'}</span>
                )}
              </button>
            </form>

            {/* Info Notice Container */}
            <div className="mt-6 rounded-xl bg-slate-100/70 border border-slate-200/30 p-3.5 shadow-3xs flex gap-3 items-start">
              <div className="shrink-0 w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mt-0.5">
                <Info className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-700">Panduan Masuk</p>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  Pastikan koneksi internet stabil dan gunakan browser modern yang up-to-date demi kelancaran pengerjaan ujian.
                </p>
              </div>
            </div>

            {/* Bottom copyright */}
            <div className="text-center mt-6 pt-2">
              <p className="text-[10px] text-slate-400 font-bold">
                © {new Date().getFullYear()} {schoolName}
              </p>
              <p className="text-[9px] text-slate-400/80 uppercase font-extrabold tracking-wider mt-0.5">
                Computer Based Test System • V2.5
              </p>
            </div>

          </div>
        </section>

      </main>
    </div>
  );
};
