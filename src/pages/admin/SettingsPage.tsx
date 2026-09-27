import React, { useState, useEffect } from 'react';
import {
  School,
  Settings,
  Lock,
  User,
  Save,
  Database,
  Copy,
  CheckCircle2,
  ShieldCheck,
  Layers,
  Sparkles,
  Play,
  KeyRound,
  Image as ImageIcon,
  Upload,
  Trash2,
  Palette,
  Eye,
  Loader2,
  Check,
  Zap,
  RotateCcw,
  Sliders,
  Type,
  Printer,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { AppSettings } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { toast } from '../../components/ui/Toast';
import { compressImage, CompressResult } from '../../utils/imageCompressor';
import { uploadToSupabaseStorage } from '../../services/supabaseStorage';
import { CbtLoginPage } from '../../components/auth/CbtLoginPage';

type ActiveTab = 'login_branding' | 'school' | 'account' | 'database';

export const SettingsPage: React.FC = () => {
  const { user, settings, refreshSettings, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('login_branding');

  // 1. Identitas Sekolah
  const [schoolNameInput, setSchoolNameInput] = useState(settings.school_name || 'SMA Negeri 1 Lumbung');
  const [schoolShortNameInput, setSchoolShortNameInput] = useState(settings.school_short_name || 'SMAN 1 Lumbung');
  const [schoolDescriptionInput, setSchoolDescriptionInput] = useState(settings.school_description || 'Sistem Computer Based Test');

  // 2. Logo Sekolah
  const [schoolLogoUrl, setSchoolLogoUrl] = useState(settings.school_logo_url || settings.school_logo || '');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [confirmDeleteLogoOpen, setConfirmDeleteLogoOpen] = useState(false);

  // 3. Ilustrasi Login
  const [loginIllustrationUrl, setLoginIllustrationUrl] = useState(settings.login_illustration_url || settings.login_image_url || '');
  const [uploadingIllustration, setUploadingIllustration] = useState(false);
  const [confirmDeleteIllustrationOpen, setConfirmDeleteIllustrationOpen] = useState(false);
  const [illustrationPosition, setIllustrationPosition] = useState<'center' | 'top' | 'bottom'>(
    settings.illustration_position || 'center'
  );
  const [illustrationSize, setIllustrationSize] = useState<number>(
    settings.illustration_size !== undefined ? Number(settings.illustration_size) : 100
  );
  const [illustrationFit, setIllustrationFit] = useState<'contain' | 'cover'>(
    settings.illustration_fit || 'contain'
  );

  // 4. Konten Halaman Login
  const [loginTitleInput, setLoginTitleInput] = useState(settings.login_title || 'Login Ujian CBT');
  const [loginSubtitleInput, setLoginSubtitleInput] = useState(settings.login_subtitle || 'SMA Negeri 1 Lumbung');
  const [loginDescriptionInput, setLoginDescriptionInput] = useState(settings.login_description || 'Silakan masuk untuk mengikuti ujian.');
  const [loginButtonTextInput, setLoginButtonTextInput] = useState(settings.login_button_text || 'MASUK KE UJIAN');

  // 5. Warna Tampilan
  const [primaryColor, setPrimaryColor] = useState(settings.primary_color || '#FFB646');
  const [buttonColor, setButtonColor] = useState(settings.button_color || '#6097EA');
  const [backgroundColor, setBackgroundColor] = useState(settings.background_color || '#EAF2FF');

  // 6. Cetak Tanda Terima / Hasil Ujian Permintaan Tambahan
  const [allowStudentPrintResult, setAllowStudentPrintResult] = useState<boolean>(
    settings.allow_student_print_result !== '0'
  );

  // General Settings States
  const [academicYear, setAcademicYear] = useState(settings.academic_year || '2024/2025');
  const [defaultShuffleQuestions, setDefaultShuffleQuestions] = useState(settings.default_shuffle_questions === '1');
  const [defaultShuffleAnswers, setDefaultShuffleAnswers] = useState(settings.default_shuffle_answers === '1');
  const [defaultShowScore, setDefaultShowScore] = useState(settings.default_show_score !== '0');
  const [savingSettings, setSavingSettings] = useState(false);

  // Admin Account States
  const [adminName, setAdminName] = useState(user?.name || 'Administrator');
  const [adminUsername, setAdminUsername] = useState(user?.username || 'admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // Database Migration States
  const [testingDb, setTestingDb] = useState(false);
  const [dbPasswordInput, setDbPasswordInput] = useState('');
  const [migrateModalOpen, setMigrateModalOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<{
    success: boolean;
    message: string;
    createdTables?: string[];
  } | null>(null);

  useEffect(() => {
    setSchoolNameInput(settings.school_name || 'SMA Negeri 1 Lumbung');
    setSchoolShortNameInput(settings.school_short_name || 'SMAN 1 Lumbung');
    setSchoolDescriptionInput(settings.school_description || 'Sistem Computer Based Test');
    setSchoolLogoUrl(settings.school_logo_url || settings.school_logo || '');
    setLoginIllustrationUrl(settings.login_illustration_url || settings.login_image_url || '');
    setIllustrationPosition(settings.illustration_position || 'center');
    setIllustrationSize(settings.illustration_size !== undefined ? Number(settings.illustration_size) : 100);
    setIllustrationFit(settings.illustration_fit || 'contain');
    setLoginTitleInput(settings.login_title || 'Login Ujian CBT');
    setLoginSubtitleInput(settings.login_subtitle || 'SMA Negeri 1 Lumbung');
    setLoginDescriptionInput(settings.login_description || 'Silakan masuk untuk mengikuti ujian.');
    setLoginButtonTextInput(settings.login_button_text || 'MASUK KE UJIAN');
    setPrimaryColor(settings.primary_color || '#FFB646');
    setButtonColor(settings.button_color || '#6097EA');
    setBackgroundColor(settings.background_color || '#EAF2FF');
    setAcademicYear(settings.academic_year || '2024/2025');
    setDefaultShuffleQuestions(settings.default_shuffle_questions === '1');
    setDefaultShuffleAnswers(settings.default_shuffle_answers === '1');
    setDefaultShowScore(settings.default_show_score !== '0');
    setAllowStudentPrintResult(settings.allow_student_print_result !== '0');
  }, [settings]);

  useEffect(() => {
    if (user) {
      setAdminName(user.name);
      setAdminUsername(user.username);
    }
  }, [user]);

  // Handle Logo Upload (<= 2MB, compress, upload to Supabase storage)
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran berkas logo maksimal 2 MB.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Format berkas harus berupa gambar (PNG, JPG, WEBP, SVG).');
      return;
    }

    setUploadingLogo(true);
    toast.info('Memproses logo sekolah...');

    try {
      const compressed = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.9,
        mimeType: 'image/png',
      });

      const uploadRes = await uploadToSupabaseStorage(compressed.file, 'hero', compressed.dataUrl);

      if (uploadRes.success && uploadRes.url) {
        setSchoolLogoUrl(uploadRes.url);
        toast.success('Logo sekolah berhasil diunggah!');
      } else {
        setSchoolLogoUrl(compressed.dataUrl);
        toast.success('Logo sekolah terkompresi siap disimpan.');
      }
    } catch (err: any) {
      toast.error('Gagal mengunggah logo: ' + err.message);
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  // Handle Illustration Upload (<= 5MB, compress, upload to Supabase storage)
  const handleIllustrationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran berkas ilustrasi maksimal 5 MB.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Format berkas harus berupa gambar (PNG, JPG, WEBP, SVG).');
      return;
    }

    setUploadingIllustration(true);
    toast.info('Memproses gambar ilustrasi login...');

    try {
      const compressed = await compressImage(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.85,
        mimeType: 'image/png',
      });

      const uploadRes = await uploadToSupabaseStorage(compressed.file, 'hero', compressed.dataUrl);

      if (uploadRes.success && uploadRes.url) {
        setLoginIllustrationUrl(uploadRes.url);
        toast.success('Ilustrasi login berhasil diunggah!');
      } else {
        setLoginIllustrationUrl(compressed.dataUrl);
        toast.success('Ilustrasi login terkompresi siap disimpan.');
      }
    } catch (err: any) {
      toast.error('Gagal mengunggah ilustrasi: ' + err.message);
    } finally {
      setUploadingIllustration(false);
      e.target.value = '';
    }
  };

  // Reset Colors to Default (#FFB646, #6097EA, #EAF2FF)
  const handleResetDefaultColors = () => {
    setPrimaryColor('#FFB646');
    setButtonColor('#6097EA');
    setBackgroundColor('#EAF2FF');
    toast.info('Warna tampilan dikembalikan ke default (#FFB646, #6097EA, #EAF2FF).');
  };

  // Save All Login Branding Settings
  const handleSaveLoginBranding = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();

    if (!schoolNameInput.trim()) {
      toast.error('Nama sekolah wajib diisi.');
      return;
    }

    setSavingSettings(true);

    try {
      const payloadSettings = {
        school_name: schoolNameInput.trim(),
        school_short_name: schoolShortNameInput.trim(),
        school_description: schoolDescriptionInput.trim(),
        school_logo_url: schoolLogoUrl.trim(),
        school_logo: schoolLogoUrl.trim(),
        login_title: loginTitleInput.trim(),
        login_subtitle: loginSubtitleInput.trim(),
        login_description: loginDescriptionInput.trim(),
        login_button_text: loginButtonTextInput.trim(),
        login_illustration_url: loginIllustrationUrl.trim(),
        login_image_url: loginIllustrationUrl.trim(),
        illustration_position: illustrationPosition,
        illustration_size: String(illustrationSize),
        illustration_fit: illustrationFit,
        primary_color: primaryColor.trim(),
        button_color: buttonColor.trim(),
        background_color: backgroundColor.trim(),
        allow_student_print_result: allowStudentPrintResult ? '1' : '0',
      };

      const res = await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: payloadSettings }),
      });

      if (res.success) {
        toast.success('Pengaturan tampilan berhasil disimpan.');
        refreshSettings();
      } else {
        toast.error(res.message || 'Gagal menyimpan pengaturan tampilan.');
      }
    } catch (err: any) {
      toast.error('Terjadi gangguan koneksi saat menyimpan pengaturan.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Handlers for School Settings Tab
  const handleSaveSchoolSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          settings: {
            school_name: schoolNameInput.trim(),
            academic_year: academicYear.trim(),
            default_shuffle_questions: defaultShuffleQuestions ? '1' : '0',
            default_shuffle_answers: defaultShuffleAnswers ? '1' : '0',
            default_show_score: defaultShowScore ? '1' : '0',
            allow_student_print_result: allowStudentPrintResult ? '1' : '0',
          },
        }),
      });

      if (res.success) {
        toast.success('Pengaturan sekolah & ujian berhasil diperbarui.');
        refreshSettings();
      } else {
        toast.error(res.message || 'Gagal menyimpan pengaturan.');
      }
    } catch (e) {
      toast.error('Terjadi kesalahan.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Handlers for Admin Account Tab
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim() || !adminUsername.trim()) {
      toast.error('Nama dan username admin wajib diisi.');
      return;
    }

    if (adminPassword && adminPassword !== confirmPassword) {
      toast.error('Konfirmasi password tidak cocok.');
      return;
    }

    setSavingAccount(true);
    try {
      const res = await apiRequest('/api/settings/account', {
        method: 'PUT',
        body: JSON.stringify({
          name: adminName.trim(),
          username: adminUsername.trim(),
          password: adminPassword.trim() ? adminPassword.trim() : undefined,
        }),
      });

      if (res.success) {
        toast.success('Akun administrator berhasil diperbarui.');
        setAdminPassword('');
        setConfirmPassword('');
        refreshUser();
      } else {
        toast.error(res.message || 'Gagal memperbarui akun.');
      }
    } catch (e) {
      toast.error('Terjadi kesalahan.');
    } finally {
      setSavingAccount(false);
    }
  };

  // Handlers for Database Migration Modal
  const handleRunAutoMigration = async () => {
    setMigrating(true);
    setMigrateResult(null);
    try {
      const res = await apiRequest('/api/supabase/auto-migrate', {
        method: 'POST',
        body: JSON.stringify({ password: dbPasswordInput.trim() || undefined }),
      });

      setMigrateResult({
        success: res.success,
        message: res.message || (res.success ? 'Migrasi tabel selesai.' : 'Gagal membuat tabel.'),
        createdTables: res.createdTables,
      });
      if (res.success) {
        toast.success(res.message || 'Tabel berhasil dibuat otomatis di Supabase!');
      } else {
        toast.error(res.message || 'Gagal membuat tabel.');
      }
    } catch (e: any) {
      setMigrateResult({
        success: false,
        message: e.message || 'Terjadi gangguan jaringan saat migrasi.',
      });
      toast.error('Gagal menjalankan migrasi.');
    } finally {
      setMigrating(false);
    }
  };

  const handleCopySupabaseConfig = () => {
    const configText = `SUPABASE_URL=https://nsieuoxrzanautfecwtu.supabase.co
host=aws-0-ap-south-1.pooler.supabase.com
port=6543
database=postgres
user=postgres.nsieuoxrzanautfecwtu`;
    navigator.clipboard.writeText(configText);
    toast.success('Kredensial database Supabase disalin ke clipboard.');
  };

  const handleCopySqlSchema = async () => {
    try {
      const res = await apiRequest('/api/supabase/schema-sql');
      if (res.success && res.sql) {
        navigator.clipboard.writeText(res.sql);
        toast.success('Skema SQL lengkap disalin ke clipboard!');
      }
    } catch (e) {
      toast.error('Gagal mengambil skema SQL.');
    }
  };

  // Draft settings object for Live Preview
  const draftPreviewSettings: AppSettings = {
    school_name: schoolNameInput || 'SMA Negeri 1 Lumbung',
    school_short_name: schoolShortNameInput || 'SMAN 1 Lumbung',
    school_description: schoolDescriptionInput || 'Sistem Computer Based Test',
    school_logo_url: schoolLogoUrl,
    school_logo: schoolLogoUrl,
    academic_year: academicYear,
    login_title: loginTitleInput || 'Login Ujian CBT',
    login_subtitle: loginSubtitleInput || schoolNameInput,
    login_description: loginDescriptionInput || 'Silakan masuk untuk mengikuti ujian.',
    login_button_text: loginButtonTextInput || 'MASUK KE UJIAN',
    login_illustration_url: loginIllustrationUrl,
    login_image_url: loginIllustrationUrl,
    illustration_position: illustrationPosition,
    illustration_size: illustrationSize,
    illustration_fit: illustrationFit,
    primary_color: primaryColor,
    button_color: buttonColor,
    background_color: backgroundColor,
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Title */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          <span>Pengaturan Sistem</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Kelola kustomisasi tampilan login CBT, identitas sekolah, preferensi ujian, serta akun administrator.
        </p>
      </div>

      {/* Submenu Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('login_branding')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'login_branding'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/70 shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Palette className="w-4 h-4 text-amber-500" />
          <span>Tampilan Login</span>
          <Badge variant="indigo" className="text-[9px] px-1.5 py-0">Custom UI</Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('school')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'school'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/70 shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <School className="w-4 h-4 text-indigo-600" />
          <span>Identitas & Preferensi Ujian</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('account')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'account'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/70 shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Lock className="w-4 h-4 text-emerald-600" />
          <span>Akun Administrator</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('database')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'database'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/70 shadow-2xs'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Database className="w-4 h-4 text-purple-600" />
          <span>Database & Supabase</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* SECTION: TAMPILAN LOGIN */}
      {/* ======================================================== */}
      {activeTab === 'login_branding' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* LEFT COLUMN: CARDS 1 - 5 */}
            <div className="space-y-6">
              {/* CARD 1: IDENTITAS SEKOLAH */}
              <Card
                title={
                  <div className="flex items-center gap-2">
                    <School className="w-5 h-5 text-indigo-600" />
                    <span>Identitas Sekolah</span>
                  </div>
                }
                subtitle="Informasi atribut resmi sekolah yang ditampilkan pada portal login"
              >
                <div className="space-y-3.5">
                  <Input
                    label="Nama Sekolah"
                    value={schoolNameInput}
                    onChange={(e) => setSchoolNameInput(e.target.value)}
                    placeholder="SMA Negeri 1 Lumbung"
                    required
                  />

                  <Input
                    label="Nama Singkat"
                    value={schoolShortNameInput}
                    onChange={(e) => setSchoolShortNameInput(e.target.value)}
                    placeholder="SMAN 1 Lumbung"
                  />

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Deskripsi
                    </label>
                    <textarea
                      value={schoolDescriptionInput}
                      onChange={(e) => setSchoolDescriptionInput(e.target.value)}
                      placeholder="Sistem Computer Based Test"
                      rows={2}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </Card>

              {/* CARD 2: LOGO SEKOLAH */}
              <Card
                title={
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-amber-500" />
                    <span>Logo Sekolah</span>
                  </div>
                }
                subtitle="Kelola logo resmi sekolah yang muncul di atas formulir login"
              >
                <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 flex flex-col items-center justify-center text-center space-y-3">
                  {schoolLogoUrl ? (
                    <div className="space-y-3">
                      <div className="w-24 h-24 mx-auto rounded-2xl bg-white p-2 border border-slate-200 shadow-md flex items-center justify-center overflow-hidden">
                        <img src={schoolLogoUrl} alt="Logo Preview" className="w-full h-full object-contain" />
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Ganti Logo</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            onChange={handleLogoUpload}
                            disabled={uploadingLogo}
                            className="hidden"
                          />
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDeleteLogoOpen(true)}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold"
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                        >
                          Hapus
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-xs">
                        <School className="w-8 h-8 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Logo Sekolah</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">PNG, JPG, WEBP, SVG • Maks. 2 MB</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Rekomendasi: PNG transparan rasio 1:1</p>
                      </div>
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors">
                        {uploadingLogo ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>Pilih Logo</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handleLogoUpload}
                          disabled={uploadingLogo}
                          className="hidden"
                        />
                      </label>
                    </>
                  )}
                </div>
              </Card>

              {/* CARD 3: ILUSTRASI LOGIN */}
              <Card
                title={
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    <span>Ilustrasi Login</span>
                  </div>
                }
                subtitle="Gambar ilustrasi atau maskot yang ditampilkan pada PANEL KIRI halaman login CBT"
              >
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 flex flex-col items-center justify-center text-center space-y-3">
                    {loginIllustrationUrl ? (
                      <div className="space-y-3 w-full">
                        <div className="w-32 h-32 mx-auto rounded-full bg-slate-900/10 border border-slate-200 p-2 flex items-center justify-center overflow-hidden shadow-inner relative">
                          <img
                            src={loginIllustrationUrl}
                            alt="Ilustrasi"
                            className="w-full h-full rounded-full transition-all"
                            style={{
                              objectFit: illustrationFit,
                              transform: `scale(${illustrationSize / 100})`,
                              objectPosition: illustrationPosition === 'top' ? 'top' : illustrationPosition === 'bottom' ? 'bottom' : 'center',
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Ganti</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/svg+xml"
                              onChange={handleIllustrationUpload}
                              disabled={uploadingIllustration}
                              className="hidden"
                            />
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteIllustrationOpen(true)}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold"
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                          >
                            Hapus
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 shadow-xs">
                          <ImageIcon className="w-8 h-8 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">Unggah Gambar Ilustrasi</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">PNG, JPG, WEBP, SVG • Maks. 5 MB</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Rekomendasi: PNG transparan, rasio 1:1 (600×600 px)</p>
                        </div>
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors">
                          {uploadingIllustration ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          <span>Upload Ilustrasi</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            onChange={handleIllustrationUpload}
                            disabled={uploadingIllustration}
                            className="hidden"
                          />
                        </label>
                      </>
                    )}
                  </div>

                  {/* Settings for Illustration: Posisi, Ukuran Slider, Fit */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                    <span className="block font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                      Pengaturan Tata Letak Ilustrasi:
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Posisi:</label>
                        <select
                          value={illustrationPosition}
                          onChange={(e) => setIllustrationPosition(e.target.value as any)}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="center">Center (Tengah)</option>
                          <option value="top">Top (Atas)</option>
                          <option value="bottom">Bottom (Bawah)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Fit Mode:</label>
                        <div className="flex items-center gap-4 pt-1">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700">
                            <input
                              type="radio"
                              name="fitMode"
                              value="contain"
                              checked={illustrationFit === 'contain'}
                              onChange={() => setIllustrationFit('contain')}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Contain</span>
                          </label>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700">
                            <input
                              type="radio"
                              name="fitMode"
                              value="cover"
                              checked={illustrationFit === 'cover'}
                              onChange={() => setIllustrationFit('cover')}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Cover</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between font-semibold text-slate-700 mb-1">
                        <span>Ukuran Ilustrasi:</span>
                        <span className="font-mono text-indigo-700">{illustrationSize}%</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="150"
                        step="5"
                        value={illustrationSize}
                        onChange={(e) => setIllustrationSize(Number(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                        <span>50%</span>
                        <span>100% (Default)</span>
                        <span>150%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* CARD 4: KONTEN LOGIN */}
              <Card
                title={
                  <div className="flex items-center gap-2">
                    <Type className="w-5 h-5 text-indigo-600" />
                    <span>Konten Halaman Login</span>
                  </div>
                }
                subtitle="Atur judul, subjudul, deskripsi panduan, dan teks pada tombol login"
              >
                <div className="space-y-3.5">
                  <Input
                    label="Judul Login"
                    value={loginTitleInput}
                    onChange={(e) => setLoginTitleInput(e.target.value)}
                    placeholder="Login Ujian CBT"
                  />

                  <Input
                    label="Subjudul"
                    value={loginSubtitleInput}
                    onChange={(e) => setLoginSubtitleInput(e.target.value)}
                    placeholder="SMA Negeri 1 Lumbung"
                  />

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Deskripsi
                    </label>
                    <textarea
                      value={loginDescriptionInput}
                      onChange={(e) => setLoginDescriptionInput(e.target.value)}
                      placeholder="Silakan masuk untuk mengikuti ujian."
                      rows={2}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <Input
                    label="Teks Tombol"
                    value={loginButtonTextInput}
                    onChange={(e) => setLoginButtonTextInput(e.target.value)}
                    placeholder="MASUK KE UJIAN"
                  />
                </div>
              </Card>

              {/* CARD 5: WARNA TAMPILAN */}
              <Card
                title={
                  <div className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-indigo-600" />
                    <span>Warna Tampilan</span>
                  </div>
                }
                subtitle="Sesuaikan skema warna panel kiri, tombol login, dan warna latar belakang"
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Warna Panel Kiri */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <label className="block text-xs font-bold text-slate-800">Warna Panel Kiri</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer shrink-0"
                        />
                        <input
                          type="text"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-300 font-mono uppercase font-bold"
                        />
                      </div>
                    </div>

                    {/* Warna Tombol */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <label className="block text-xs font-bold text-slate-800">Warna Tombol</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={buttonColor}
                          onChange={(e) => setButtonColor(e.target.value)}
                          className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer shrink-0"
                        />
                        <input
                          type="text"
                          value={buttonColor}
                          onChange={(e) => setButtonColor(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-300 font-mono uppercase font-bold"
                        />
                      </div>
                    </div>

                    {/* Warna Background */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <label className="block text-xs font-bold text-slate-800">Warna Background</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer shrink-0"
                        />
                        <input
                          type="text"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-300 font-mono uppercase font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <p className="text-[11px] text-slate-500">Default: Panel #FFB646, Tombol #6097EA, Background #EAF2FF</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResetDefaultColors}
                      icon={<RotateCcw className="w-3.5 h-3.5" />}
                    >
                      Reset Default
                    </Button>
                  </div>
                </div>
              </Card>

              {/* CARD 6: CETAK RESULT PERIINZINAN (PERMINTAAN TAMBAHAN) */}
              <Card
                title={
                  <div className="flex items-center gap-2">
                    <Printer className="w-5 h-5 text-indigo-600" />
                    <span>Pengaturan Cetak Tanda Terima Ujian</span>
                  </div>
                }
                subtitle="Aktifkan atau nonaktifkan hak akses siswa untuk mencetak / mengunduh tanda terima hasil ujian"
              >
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Izinkan Siswa Cetak Tanda Terima / Laporan PDF</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Jika dinonaktifkan, tombol cetak dan unduh laporan hasil di portal siswa akan disembunyikan.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={allowStudentPrintResult}
                      onChange={(e) => setAllowStudentPrintResult(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </Card>
            </div>

            {/* RIGHT COLUMN: LIVE PREVIEW & SAVE BUTTON */}
            <div className="space-y-6 lg:sticky lg:top-20">
              {/* CARD 7: LIVE PREVIEW */}
              <Card
                title={
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-amber-500" />
                      <span>Preview Halaman Login</span>
                    </div>
                    <Badge variant="success" className="text-[9px] font-mono">REAL-TIME</Badge>
                  </div>
                }
                subtitle="Pratinjau langsung struktur halaman login CBT dengan konfigurasi terkini"
              >
                <div className="border border-slate-300 rounded-2xl overflow-hidden shadow-xl bg-slate-900 p-1">
                  <div className="bg-slate-800 px-3 py-1.5 rounded-t-xl flex items-center justify-between text-[10px] text-slate-300 font-mono border-b border-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="ml-1 text-slate-400">cbt.sekolah.sch.id/login</span>
                    </span>
                    <span>LIVE PREVIEW</span>
                  </div>

                  {/* Scaled Preview Frame with fixed height and absolute container to prevent stretch */}
                  <div className="relative h-[480px] bg-slate-200/60 rounded-b-xl overflow-hidden flex items-center justify-center">
                    <div className="absolute top-0 left-0 w-[150%] h-[150%] origin-top-left transform scale-[0.66] p-4 flex items-center justify-center">
                      <div className="w-full max-w-[920px] shadow-lg">
                        <CbtLoginPage
                          initialRole="siswa"
                          onSwitchRole={() => {}}
                          overrideSettings={draftPreviewSettings}
                          isEmbeddedPreview={true}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* SAVE BUTTON BAR */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-md space-y-3">
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  loading={savingSettings}
                  onClick={handleSaveLoginBranding}
                  className="w-full font-black text-sm py-3 bg-indigo-600 hover:bg-indigo-700 shadow-md cursor-pointer"
                  icon={<Save className="w-5 h-5" />}
                >
                  Simpan Perubahan
                </Button>
                <p className="text-[11px] text-slate-500 text-center">
                  Perubahan akan langsung diterapkan pada portal login CBT tanpa perlu memulai ulang server.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION: IDENTITAS & PREFERENSI UJIAN */}
      {/* ======================================================== */}
      {activeTab === 'school' && (
        <Card
          title={
            <div className="flex items-center gap-2">
              <School className="w-5 h-5 text-indigo-600" />
              <span>Identitas & Konfigurasi Ujian</span>
            </div>
          }
          subtitle="Atribut umum sekolah dan preferensi default pelaksanaan CBT"
        >
          <form onSubmit={handleSaveSchoolSettings} className="space-y-4 max-w-xl">
            <Input
              label="Nama Sekolah"
              value={schoolNameInput}
              onChange={(e) => setSchoolNameInput(e.target.value)}
              placeholder="Contoh: SMA Negeri 1 Lumbung"
              required
            />

            <Input
              label="Tahun Ajaran Aktif"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="2024/2025"
              required
            />

            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Preferensi Default Ujian:
              </span>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={defaultShuffleQuestions}
                  onChange={(e) => setDefaultShuffleQuestions(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Default: Acak Urutan Butir Soal</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={defaultShuffleAnswers}
                  onChange={(e) => setDefaultShuffleAnswers(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Default: Acak Pilihan Jawaban (A/B/C/D)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={defaultShowScore}
                  onChange={(e) => setDefaultShowScore(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Default: Tampilkan Nilai Langsung ke Siswa</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowStudentPrintResult}
                  onChange={(e) => setAllowStudentPrintResult(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Izinkan Siswa Mencetak Tanda Terima & Unduh Laporan PDF</span>
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={savingSettings}
              className="mt-2 font-bold bg-indigo-600 hover:bg-indigo-700"
              icon={<Save className="w-4 h-4" />}
            >
              Simpan Pengaturan Sekolah
            </Button>
          </form>
        </Card>
      )}

      {/* ======================================================== */}
      {/* SECTION: AKUN ADMINISTRATOR */}
      {/* ======================================================== */}
      {activeTab === 'account' && (
        <Card
          title={
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-600" />
              <span>Akun Administrator</span>
            </div>
          }
          subtitle="Ubah nama admin, username, dan perbarui kata sandi"
        >
          <form onSubmit={handleSaveAccount} className="space-y-4 max-w-xl">
            <Input
              label="Nama Lengkap Admin"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="Nama administrator"
              leftIcon={<User className="w-4 h-4" />}
              required
            />

            <Input
              label="Username Admin"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              placeholder="Username login"
              required
            />

            <div className="pt-3 border-t border-slate-100 space-y-3">
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Ganti Kata Sandi (Opsional):
              </span>

              <Input
                label="Password Baru"
                type="password"
                placeholder="Kosongkan jika tidak ingin mengubah"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
              />

              {adminPassword && (
                <Input
                  label="Konfirmasi Password Baru"
                  type="password"
                  placeholder="Ulangi password baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  required
                />
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={savingAccount}
              className="mt-2 font-bold bg-indigo-600 hover:bg-indigo-700"
              icon={<Save className="w-4 h-4" />}
            >
              Simpan Data Akun
            </Button>
          </form>
        </Card>
      )}

      {/* ======================================================== */}
      {/* SECTION: SUPABASE & DATABASE ARCHITECTURE */}
      {/* ======================================================== */}
      {activeTab === 'database' && (
        <Card
          title={
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              <span>Konektivitas Supabase & PostgreSQL</span>
            </div>
          }
          subtitle="Otomatisasi pembuatan tabel, relasi, dan konfigurasi database Supabase"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block mb-0.5">Supabase Project URL:</span>
                <p className="font-mono font-semibold text-slate-800 break-all">
                  https://nsieuoxrzanautfecwtu.supabase.co
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block mb-0.5">Host PostgreSQL (Pooler):</span>
                <p className="font-mono font-semibold text-slate-800">
                  aws-0-ap-south-1.pooler.supabase.com:6543
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block mb-0.5">Database / User:</span>
                <p className="font-mono font-semibold text-slate-800">postgres / postgres.nsieuoxrzanautfecwtu</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block mb-0.5">Status Proteksi:</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="success">RLS Enabled</Badge>
                  <Badge variant="indigo">Foreign Key Cascades</Badge>
                </div>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Buat otomatis 9 tabel, indeks performa, dan aturan keamanan RLS di Supabase.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setMigrateModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                  icon={<Sparkles className="w-3.5 h-3.5" />}
                >
                  Otomatis Buat Tabel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopySqlSchema}
                  icon={<Copy className="w-3.5 h-3.5" />}
                >
                  Salin Skema SQL
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopySupabaseConfig}
                  icon={<Database className="w-3.5 h-3.5" />}
                >
                  Parameter
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* CONFIRMATION MODAL DELETE LOGO */}
      <Modal
        isOpen={confirmDeleteLogoOpen}
        onClose={() => setConfirmDeleteLogoOpen(false)}
        title="Konfirmasi Hapus Logo Sekolah"
        subtitle="Hapus logo resmi dari halaman login CBT"
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteLogoOpen(false)}>
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setSchoolLogoUrl('');
                setConfirmDeleteLogoOpen(false);
                toast.success('Logo sekolah dihapus dari draf.');
              }}
              className="bg-rose-600 hover:bg-rose-700 font-bold"
            >
              HAPUS LOGO
            </Button>
          </>
        }
      >
        <div className="p-2 text-xs text-slate-600 space-y-2">
          <p className="font-semibold text-slate-800">Apakah Anda yakin ingin menghapus logo sekolah?</p>
          <p>Tampilan login akan kembali menggunakan ikon default sekolah jika logo dihapus.</p>
        </div>
      </Modal>

      {/* CONFIRMATION MODAL DELETE ILLUSTRATION */}
      <Modal
        isOpen={confirmDeleteIllustrationOpen}
        onClose={() => setConfirmDeleteIllustrationOpen(false)}
        title="Konfirmasi Hapus Ilustrasi Login"
        subtitle="Hapus gambar ilustrasi panel kiri"
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteIllustrationOpen(false)}>
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setLoginIllustrationUrl('');
                setConfirmDeleteIllustrationOpen(false);
                toast.success('Ilustrasi login dihapus dari draf.');
              }}
              className="bg-rose-600 hover:bg-rose-700 font-bold"
            >
              HAPUS ILUSTRASI
            </Button>
          </>
        }
      >
        <div className="p-2 text-xs text-slate-600 space-y-2">
          <p className="font-semibold text-slate-800">Apakah Anda yakin ingin menghapus gambar ilustrasi login?</p>
          <p>Panel kiri login akan menggunakan karakter vektor default atau pola warna pilihan.</p>
        </div>
      </Modal>

      {/* AUTOMATIC TABLE MIGRATION MODAL */}
      <Modal
        isOpen={migrateModalOpen}
        onClose={() => setMigrateModalOpen(false)}
        title="Otomatis Buat Tabel di Database Supabase"
        subtitle="Mengeksekusi pembuatan seluruh tabel relasional CBT, indeks, dan RLS"
        maxWidth="lg"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMigrateModalOpen(false)}
              disabled={migrating}
            >
              Tutup
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunAutoMigration}
              loading={migrating}
              className="bg-emerald-600 hover:bg-emerald-700 font-bold"
              icon={<Play className="w-3.5 h-3.5" />}
            >
              Jalankan Pembuatan Tabel
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-1">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 space-y-1.5">
            <p className="font-bold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Tabel yang akan dibuat secara otomatis:
            </p>
            <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px] font-mono text-emerald-800">
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">1. users</span>
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">2. classes</span>
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">3. students</span>
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">4. question_banks</span>
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">5. questions</span>
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">6. exams</span>
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">7. exam_participants</span>
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">8. answers</span>
              <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">9. settings</span>
            </div>
          </div>

          <div className="space-y-2">
            <Input
              label="Password Database PostgreSQL (Opsional jika sudah diatur di environment)"
              type="password"
              placeholder="Masukkan password database postgres jika diminta"
              value={dbPasswordInput}
              onChange={(e) => setDbPasswordInput(e.target.value)}
              leftIcon={<KeyRound className="w-4 h-4" />}
            />
            <p className="text-[11px] text-slate-500">
              Host: <code className="text-slate-800 font-semibold">aws-0-ap-south-1.pooler.supabase.com:6543</code> (User: postgres.nsieuoxrzanautfecwtu, DB: postgres)
            </p>
          </div>

          {/* Migration Result Feedback */}
          {migrateResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                migrateResult.success
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              <div className="flex items-start gap-2">
                {migrateResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Database className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">{migrateResult.message}</p>
                  {migrateResult.createdTables && migrateResult.createdTables.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {migrateResult.createdTables.map((t) => (
                        <span
                          key={t}
                          className="bg-white/80 px-2 py-0.5 rounded border font-mono text-[10px] text-emerald-800"
                        >
                          ✓ {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Alternative SQL Copy fallback */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600">
              Atau salin skema SQL dan jalankan di SQL Editor Supabase:
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopySqlSchema}
              icon={<Copy className="w-3.5 h-3.5" />}
            >
              Salin SQL
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
