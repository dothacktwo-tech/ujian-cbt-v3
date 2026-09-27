import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Printer,
  Settings,
  Search,
  CheckSquare,
  Square,
  Users,
  School,
  QrCode,
  UserCheck,
  RotateCcw,
  Save,
  Palette,
  FileText,
  HelpCircle,
  Eye,
  Check,
  GraduationCap,
  Sliders,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Loading } from '../../components/ui/Loading';
import { toast } from '../../components/ui/Toast';

interface StudentCardData {
  id: string;
  nis: string;
  nama: string;
  username: string;
  class_id: string;
  nama_kelas?: string;
  password?: string;
}

export const ExamCardsPage: React.FC = () => {
  const { settings, refreshSettings } = useAuth();

  // Active Main Tab: 'print' | 'settings'
  const [activeTab, setActiveTab] = useState<'print' | 'settings'>('print');

  // Data States
  const [loading, setLoading] = useState(true);
  const [classesList, setClassesList] = useState<{ id: string; nama_kelas: string; tingkat?: string }[]>([]);
  const [studentsList, setStudentsList] = useState<StudentCardData[]>([]);

  // Filter States
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selection State for Printing
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Card Settings Form States
  const [savingSettings, setSavingSettings] = useState(false);
  const [cardTitle, setCardTitle] = useState(settings.card_title || 'KARTU PESERTA UJIAN CBT');
  const [cardSubtitle, setCardSubtitle] = useState(settings.card_subtitle || 'PENILAIAN AKHIR SEMESTER (PAS) / UTS');
  const [cardHeaderColor, setCardHeaderColor] = useState(settings.card_header_color || 'indigo');
  const [cardLayoutGrid, setCardLayoutGrid] = useState(settings.card_layout_grid || '8');
  const [cardShowPhoto, setCardShowPhoto] = useState(settings.card_show_photo !== '0');
  const [cardShowQr, setCardShowQr] = useState(settings.card_show_qr !== '0');
  const [cardShowRules, setCardShowRules] = useState(settings.card_show_rules !== '0');
  const [cardRulesText, setCardRulesText] = useState(
    settings.card_rules_text ||
      '1. Bawa kartu ini setiap mengikuti ujian.\n2. Jaga kerahasiaan username & password Anda.\n3. Dilarang membawa HP / alat bantu tanpa izin.'
  );
  const [cardSignLocation, setCardSignLocation] = useState(settings.card_sign_location || 'Lumbung');
  const [cardSignTitle, setCardSignTitle] = useState(settings.card_sign_title || 'Kepala Sekolah');
  const [cardSignName, setCardSignName] = useState(settings.card_sign_name || 'Drs. H. Mamat Rahmat, M.Pd');
  const [cardSignNip, setCardSignNip] = useState(settings.card_sign_nip || '19750812 200212 1 003');

  // Sync state if context settings update
  useEffect(() => {
    if (settings) {
      setCardTitle(settings.card_title || 'KARTU PESERTA UJIAN CBT');
      setCardSubtitle(settings.card_subtitle || 'PENILAIAN AKHIR SEMESTER (PAS) / UTS');
      setCardHeaderColor(settings.card_header_color || 'indigo');
      setCardLayoutGrid(settings.card_layout_grid || '8');
      setCardShowPhoto(settings.card_show_photo !== '0');
      setCardShowQr(settings.card_show_qr !== '0');
      setCardShowRules(settings.card_show_rules !== '0');
      setCardRulesText(
        settings.card_rules_text ||
          '1. Bawa kartu ini setiap mengikuti ujian.\n2. Jaga kerahasiaan username & password Anda.\n3. Dilarang membawa HP / alat bantu tanpa izin.'
      );
      setCardSignLocation(settings.card_sign_location || 'Lumbung');
      setCardSignTitle(settings.card_sign_title || 'Kepala Sekolah');
      setCardSignName(settings.card_sign_name || 'Drs. H. Mamat Rahmat, M.Pd');
      setCardSignNip(settings.card_sign_nip || '19750812 200212 1 003');
    }
  }, [settings]);

  // Fetch classes and students
  const fetchData = async () => {
    setLoading(true);
    try {
      const [resClasses, resStudents] = await Promise.all([
        apiRequest<{ id: string; nama_kelas: string; tingkat?: string }[]>('/api/classes'),
        apiRequest<StudentCardData[]>('/api/students'),
      ]);

      if (resClasses.success && resClasses.data) {
        setClassesList(resClasses.data);
      }

      if (resStudents.success && resStudents.data) {
        setStudentsList(resStudents.data);
        // Default select all students
        setSelectedStudentIds(new Set(resStudents.data.map((s) => s.id)));
      }
    } catch (err: any) {
      toast.error('Gagal memuat data siswa dan kelas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Students
  const filteredStudents = studentsList.filter((student) => {
    const matchesClass = selectedClassId === 'all' || student.class_id === selectedClassId;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      student.nama.toLowerCase().includes(q) ||
      (student.nis && student.nis.toLowerCase().includes(q)) ||
      student.username.toLowerCase().includes(q);
    return matchesClass && matchesQuery;
  });

  // Toggle select student
  const handleToggleStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedStudentIds(next);
  };

  const handleSelectAllFiltered = () => {
    if (selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudentIds(new Set());
    } else {
      const allIds = new Set(filteredStudents.map((s) => s.id));
      setSelectedStudentIds(allIds);
    }
  };

  // Trigger Browser Print Window
  const handlePrintCards = () => {
    if (selectedStudentIds.size === 0) {
      toast.error('Pilih minimal satu siswa untuk dicetak kartu ujiannya.');
      return;
    }
    window.print();
  };

  // Save Card Settings
  const handleSaveCardSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    try {
      const payload = {
        settings: {
          card_title: cardTitle.trim(),
          card_subtitle: cardSubtitle.trim(),
          card_header_color: cardHeaderColor,
          card_layout_grid: cardLayoutGrid,
          card_show_photo: cardShowPhoto ? '1' : '0',
          card_show_qr: cardShowQr ? '1' : '0',
          card_show_rules: cardShowRules ? '1' : '0',
          card_rules_text: cardRulesText.trim(),
          card_sign_location: cardSignLocation.trim(),
          card_sign_title: cardSignTitle.trim(),
          card_sign_name: cardSignName.trim(),
          card_sign_nip: cardSignNip.trim(),
        },
      };

      const res = await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        toast.success('Pengaturan kartu ujian berhasil disimpan.');
        await refreshSettings();
      } else {
        toast.error(res.message || 'Gagal menyimpan pengaturan.');
      }
    } catch (err: any) {
      toast.error('Terjadi kesalahan saat menyimpan pengaturan kartu.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Get Header Color Classes
  const getHeaderColorStyle = (colorKey: string) => {
    switch (colorKey) {
      case 'emerald':
        return { bg: 'bg-emerald-700', text: 'text-white', border: 'border-emerald-800' };
      case 'rose':
        return { bg: 'bg-rose-700', text: 'text-white', border: 'border-rose-800' };
      case 'slate':
        return { bg: 'bg-slate-800', text: 'text-white', border: 'border-slate-900' };
      case 'amber':
        return { bg: 'bg-amber-600', text: 'text-white', border: 'border-amber-700' };
      case 'indigo':
      default:
        return { bg: 'bg-indigo-700', text: 'text-white', border: 'border-indigo-800' };
    }
  };

  const currentHeaderStyle = getHeaderColorStyle(cardHeaderColor);

  // Selected students list for rendering print view
  const printableStudents = studentsList.filter((s) => selectedStudentIds.has(s.id));

  return (
    <div className="space-y-6 max-w-7xl">
      {/* SCREEN ONLY HEADER & TAB NAVIGATION */}
      <div className="print:hidden space-y-4">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                <CreditCard className="w-6 h-6" />
              </div>
              <span>Cetak & Pengaturan Kartu Ujian Siswa</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Cetak kartu peserta ujian CBT per kelas dengan format siap cetak A4. Sesuaikan tata letak dan pengesahan di menu pengaturan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === 'print' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('print')}
              icon={<Printer className="w-4 h-4" />}
              className="font-bold cursor-pointer"
            >
              Cetak Kartu Ujian
            </Button>
            <Button
              variant={activeTab === 'settings' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('settings')}
              icon={<Sliders className="w-4 h-4" />}
              className="font-bold cursor-pointer"
            >
              Pengaturan Kartu
            </Button>
          </div>
        </div>

        {/* Tab Badges */}
        <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('print')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-t-xl transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'print'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/70 shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            <span>1. Pilih & Cetak Kartu ({selectedStudentIds.size} Terpilih)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-t-xl transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'settings'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/70 shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Settings className="w-4 h-4 text-amber-500" />
            <span>2. Pengaturan Tampilan Kartu</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: CETAK KARTU UJIAN */}
      {/* ========================================================= */}
      {activeTab === 'print' && (
        <div className="print:hidden space-y-6">
          {/* Filter Bar Card */}
          <Card
            title={
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <span>Pilih Siswa untuk Dicetak Kartu Ujian</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={handlePrintCards}
                    disabled={selectedStudentIds.size === 0}
                    icon={<Printer className="w-4 h-4" />}
                    className="font-bold cursor-pointer"
                  >
                    Cetak {selectedStudentIds.size} Kartu Ujian (PDF/Print)
                  </Button>
                </div>
              </div>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              {/* Filter Kelas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Filter Kelas:</span>
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">Semua Kelas ({studentsList.length} Siswa)</option>
                  {classesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama_kelas}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Query */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Cari Nama / NISN:</span>
                </label>
                <input
                  type="text"
                  placeholder="Ketik nama atau NISN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Multi-Select Quick Actions */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAllFiltered}
                  icon={
                    selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )
                  }
                  className="w-full font-bold text-xs"
                >
                  {selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0
                    ? 'Batal Pilih Semua'
                    : `Pilih Semua (${filteredStudents.length})`}
                </Button>
              </div>
            </div>
          </Card>

          {/* Cards Preview Grid */}
          {loading ? (
            <Loading message="Memuat data kartu siswa..." />
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <CreditCard className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">Tidak Ada Siswa Ditemukan</p>
              <p className="text-xs text-slate-500 mt-1">Coba ganti filter kelas atau kata kunci pencarian Anda.</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-700">
                  Pratinjau Kartu ({printableStudents.length} dari {filteredStudents.length} siswa siap dicetak):
                </p>
                <span className="text-[11px] text-slate-500 font-mono">
                  Ukuran Cetak: A4 ({cardLayoutGrid} Kartu Per Halaman)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStudents.map((student) => {
                  const isSelected = selectedStudentIds.has(student.id);

                  return (
                    <div
                      key={student.id}
                      onClick={() => handleToggleStudent(student.id)}
                      className={`relative bg-white rounded-2xl border transition-all cursor-pointer overflow-hidden shadow-xs hover:shadow-md ${
                        isSelected
                          ? 'border-indigo-600 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {/* Checkbox badge */}
                      <div className="absolute top-2 right-2 z-10">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isSelected ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-200 text-slate-400'
                          }`}
                        >
                          {isSelected ? <Check className="w-4 h-4" /> : null}
                        </div>
                      </div>

                      {/* Card Render Container */}
                      <div className="p-3 text-xs space-y-2">
                        {/* Header Box */}
                        <div className={`${currentHeaderStyle.bg} text-white p-2.5 rounded-xl flex items-center gap-2.5`}>
                          <div className="w-8 h-8 rounded-lg bg-white/20 shrink-0 flex items-center justify-center font-bold text-white text-xs">
                            <School className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-white/80 truncate">
                              {settings.school_name}
                            </p>
                            <p className="text-[11px] font-black tracking-tight leading-tight uppercase truncate">
                              {cardTitle}
                            </p>
                            <p className="text-[8px] text-white/70 font-mono truncate">{settings.academic_year}</p>
                          </div>
                        </div>

                        {/* Student Details Grid */}
                        <div className="flex gap-3 items-start pt-1">
                          {cardShowPhoto && (
                            <div className="w-14 h-18 rounded-lg bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 shrink-0">
                              <UserCheck className="w-6 h-6 mb-0.5 text-slate-400" />
                              <span className="text-[8px] font-mono">3 x 4</span>
                            </div>
                          )}

                          <div className="flex-1 space-y-1 text-[11px]">
                            <div>
                              <span className="text-[9px] text-slate-400 block font-semibold uppercase">Nama Siswa:</span>
                              <p className="font-extrabold text-slate-900 leading-snug line-clamp-1">{student.nama}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                              <div>
                                <span className="text-slate-400 block font-semibold uppercase text-[8px]">NIS:</span>
                                <span className="font-mono font-bold text-slate-800">{student.nis || '-'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block font-semibold uppercase text-[8px]">Kelas:</span>
                                <span className="font-bold text-indigo-700">{student.nama_kelas || '-'}</span>
                              </div>
                            </div>

                            {/* Credentials Box */}
                            <div className="p-1.5 rounded-lg bg-indigo-50/80 border border-indigo-100 font-mono text-[10px] space-y-0.5">
                              <div className="flex justify-between">
                                <span className="text-slate-500 text-[9px]">Username:</span>
                                <span className="font-bold text-indigo-900">{student.username}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500 text-[9px]">Password:</span>
                                <span className="font-bold text-slate-900">
                                  {student.nis ? student.nis.slice(-6) : '******'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {cardShowQr && (
                            <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0">
                              <QrCode className="w-9 h-9 text-slate-800" />
                            </div>
                          )}
                        </div>

                        {/* Rules snippet if active */}
                        {cardShowRules && (
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[9px] text-slate-600 leading-tight">
                            <span className="font-bold text-slate-800 block text-[8px]">PETUNJUK PESERTA:</span>
                            <p className="whitespace-pre-line line-clamp-2">{cardRulesText}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: PENGATURAN KARTU UJIAN */}
      {/* ========================================================= */}
      {activeTab === 'settings' && (
        <div className="print:hidden grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* LEFT COLUMN: SETTINGS FORM */}
          <form onSubmit={handleSaveCardSettings} className="space-y-6">
            {/* CARD 1: KOP & TERTULIS */}
            <Card
              title={
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-indigo-600" />
                  <span>Kop & Teks Judul Kartu</span>
                </div>
              }
              subtitle="Sesuaikan judul header dan informasi ujian yang tercetak di kartu peserta"
            >
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Judul Utama Kartu:</label>
                  <input
                    type="text"
                    value={cardTitle}
                    onChange={(e) => setCardTitle(e.target.value)}
                    placeholder="misal: KARTU PESERTA UJIAN CBT"
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sub Judul Ujian:</label>
                  <input
                    type="text"
                    value={cardSubtitle}
                    onChange={(e) => setCardSubtitle(e.target.value)}
                    placeholder="misal: PENILAIAN AKHIR SEMESTER (PAS) / UTS"
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300"
                  />
                </div>

                {/* Warna Header Kartu */}
                <div>
                  <label className="block font-bold text-slate-700 mb-2">Tema Warna Header Kartu:</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { key: 'indigo', label: 'Indigo', bg: 'bg-indigo-700' },
                      { key: 'emerald', label: 'Emerald', bg: 'bg-emerald-700' },
                      { key: 'rose', label: 'Crimson', bg: 'bg-rose-700' },
                      { key: 'amber', label: 'Amber', bg: 'bg-amber-600' },
                      { key: 'slate', label: 'Slate', bg: 'bg-slate-800' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setCardHeaderColor(item.key)}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          cardHeaderColor === item.key
                            ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg ${item.bg} shadow-2xs`} />
                        <span className="text-[10px] font-semibold text-slate-700">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* CARD 2: TATA LETAK & OPSI TAMPILAN */}
            <Card
              title={
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  <span>Tata Letak & Komponen Kartu</span>
                </div>
              }
              subtitle="Atur jumlah kartu per kertas A4 dan elemen visual yang ditampilkan"
            >
              <div className="space-y-4 text-xs">
                {/* Grid layout */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jumlah Kartu Per Halaman A4:</label>
                  <select
                    value={cardLayoutGrid}
                    onChange={(e) => setCardLayoutGrid(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 font-bold bg-white cursor-pointer"
                  >
                    <option value="8">8 Kartu Per Halaman (2 Kolom x 4 Baris) - Standar</option>
                    <option value="6">6 Kartu Per Halaman (2 Kolom x 3 Baris) - Sedang</option>
                    <option value="4">4 Kartu Per Halaman (2 Kolom x 2 Baris) - Besar</option>
                  </select>
                </div>

                {/* Switches */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 block">Tampilkan Pas Foto Placeholder</span>
                      <span className="text-[11px] text-slate-500">Sediakan kotak pas foto 3x4 pada kartu</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={cardShowPhoto}
                      onChange={(e) => setCardShowPhoto(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 block">Tampilkan Kode QR Login</span>
                      <span className="text-[11px] text-slate-500">Sediakan barcode QR verifikasi login siswa</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={cardShowQr}
                      onChange={(e) => setCardShowQr(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 block">Tampilkan Petunjuk Ujian</span>
                      <span className="text-[11px] text-slate-500">Cetak poin aturan ujian di bagian bawah kartu</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={cardShowRules}
                      onChange={(e) => setCardShowRules(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>
                </div>

                {cardShowRules && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Teks Aturan / Petunjuk Peserta:</label>
                    <textarea
                      rows={3}
                      value={cardRulesText}
                      onChange={(e) => setCardRulesText(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-slate-300 font-mono leading-relaxed"
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* CARD 3: PENGESAHAN KEPALA SEKOLAH / PANITIA */}
            <Card
              title={
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <span>Pengesahan Kartu Ujian</span>
                </div>
              }
              subtitle="Data tanda tangan pengesahan oleh kepala sekolah atau panitia ujian"
            >
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lokasi Pengesahan:</label>
                  <input
                    type="text"
                    value={cardSignLocation}
                    onChange={(e) => setCardSignLocation(e.target.value)}
                    placeholder="misal: Lumbung"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jabatan Penandatangan:</label>
                  <input
                    type="text"
                    value={cardSignTitle}
                    onChange={(e) => setCardSignTitle(e.target.value)}
                    placeholder="misal: Kepala Sekolah / Ketua Panitia"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Penandatangan:</label>
                  <input
                    type="text"
                    value={cardSignName}
                    onChange={(e) => setCardSignName(e.target.value)}
                    placeholder="Nama Lengkap & Gelar"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIP Penandatangan:</label>
                  <input
                    type="text"
                    value={cardSignNip}
                    onChange={(e) => setCardSignNip(e.target.value)}
                    placeholder="NIP. 1975xxxx..."
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>
            </Card>

            {/* SAVE BUTTON */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-md">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={savingSettings}
                className="w-full font-black text-sm py-3 bg-indigo-600 hover:bg-indigo-700 shadow-md cursor-pointer"
                icon={<Save className="w-5 h-5" />}
              >
                Simpan Pengaturan Kartu
              </Button>
            </div>
          </form>

          {/* RIGHT COLUMN: LIVE CARD PREVIEW */}
          <div className="sticky top-20 space-y-4">
            <Card
              title={
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-amber-500" />
                    <span>Live Preview Kartu Peserta</span>
                  </div>
                  <Badge variant="success" className="text-[9px] font-mono">
                    REAL-TIME
                  </Badge>
                </div>
              }
              subtitle="Pratinjau fisik kartu ujian yang akan dicetak pada kertas A4"
            >
              <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 flex justify-center">
                {/* Single Card Model */}
                <div className="w-full max-w-[380px] bg-white rounded-2xl border-2 border-slate-300 shadow-xl overflow-hidden font-sans">
                  {/* Header Bar */}
                  <div className={`${currentHeaderStyle.bg} text-white p-3 flex items-center gap-3 border-b-2 ${currentHeaderStyle.border}`}>
                    <div className="w-9 h-9 rounded-xl bg-white/20 shrink-0 flex items-center justify-center font-bold text-white text-sm">
                      <School className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/80 truncate">
                        {settings.school_name}
                      </p>
                      <p className="text-xs font-black tracking-tight leading-tight uppercase truncate">{cardTitle}</p>
                      <p className="text-[9px] text-white/70 font-mono truncate">{cardSubtitle}</p>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-3.5 space-y-3">
                    {/* Identity Grid */}
                    <div className="flex gap-3 items-start">
                      {cardShowPhoto && (
                        <div className="w-16 h-20 rounded-xl bg-slate-100 border-2 border-slate-200 flex flex-col items-center justify-center text-slate-400 shrink-0 shadow-2xs">
                          <UserCheck className="w-7 h-7 mb-0.5 text-slate-400" />
                          <span className="text-[9px] font-mono font-bold">FOTO 3x4</span>
                        </div>
                      )}

                      <div className="flex-1 space-y-1.5 text-xs">
                        <div>
                          <span className="text-[9px] text-slate-400 block font-bold uppercase">Nama Siswa:</span>
                          <p className="font-extrabold text-slate-900 text-sm leading-tight">M. Rizky Ramadhan</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-400 block font-bold uppercase text-[9px]">NIS / NISN:</span>
                            <span className="font-mono font-bold text-slate-800">2024101001</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-bold uppercase text-[9px]">Kelas:</span>
                            <Badge variant="indigo" className="font-mono font-bold text-[10px]">
                              X IPA 1
                            </Badge>
                          </div>
                        </div>

                        {/* Credentials Box */}
                        <div className="p-2 rounded-xl bg-indigo-50/80 border border-indigo-100 font-mono text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-500 text-[10px]">Username:</span>
                            <span className="font-bold text-indigo-900">siswa1001</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 text-[10px]">Password:</span>
                            <span className="font-bold text-slate-900">101001</span>
                          </div>
                        </div>
                      </div>

                      {cardShowQr && (
                        <div className="w-14 h-14 rounded-xl bg-slate-50 border-2 border-slate-200 p-1 flex flex-col items-center justify-center shrink-0 shadow-2xs">
                          <QrCode className="w-10 h-10 text-slate-800" />
                          <span className="text-[7px] font-mono text-slate-400">LOGIN QR</span>
                        </div>
                      )}
                    </div>

                    {/* Rules Box */}
                    {cardShowRules && (
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[10px] text-slate-600 leading-tight">
                        <span className="font-bold text-slate-800 block text-[9px] uppercase">PETUNJUK PESERTA UJIAN:</span>
                        <p className="whitespace-pre-line mt-0.5">{cardRulesText}</p>
                      </div>
                    )}

                    {/* Sign Box */}
                    <div className="pt-2 border-t border-slate-100 flex justify-between items-end text-[10px] text-slate-600">
                      <div>
                        <span className="font-mono text-[9px] text-slate-400 block">
                          Tahun Pelajaran: {settings.academic_year}
                        </span>
                      </div>
                      <div className="text-right leading-tight">
                        <p>{cardSignLocation}, {new Date().toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}</p>
                        <p className="font-bold text-slate-800">{cardSignTitle}</p>
                        <div className="h-6" />
                        <p className="font-bold text-slate-900 underline">{cardSignName}</p>
                        <p className="font-mono text-[9px] text-slate-500">NIP. {cardSignNip}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PRINT STYLESHEET VIEW ONLY (TRIGGERED ON WINDOW.PRINT) */}
      {/* ========================================================= */}
      <div className="hidden print:block font-sans text-slate-900 bg-white">
        <style>{`
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          @media print {
            body {
              background: #fff !important;
              color: #000 !important;
            }
            .print\\:hidden {
              display: none !important;
            }
          }
        `}</style>

        <div className="text-center mb-4 pb-2 border-b-2 border-slate-800">
          <h1 className="text-base font-black uppercase tracking-wide">{settings.school_name}</h1>
          <p className="text-xs font-bold uppercase">{cardTitle} - {cardSubtitle}</p>
          <p className="text-[10px] font-mono">TAHUN PELAJARAN: {settings.academic_year}</p>
        </div>

        {/* Printable Grid of Selected Student Cards */}
        <div
          className={`grid gap-3 ${
            cardLayoutGrid === '4'
              ? 'grid-cols-2 text-xs'
              : cardLayoutGrid === '6'
              ? 'grid-cols-2 text-xs'
              : 'grid-cols-2 text-[11px]'
          }`}
        >
          {printableStudents.map((s) => (
            <div
              key={`print-${s.id}`}
              className="border-2 border-slate-800 rounded-xl p-3 bg-white break-inside-avoid flex flex-col justify-between"
              style={{ minHeight: cardLayoutGrid === '4' ? '240px' : cardLayoutGrid === '6' ? '180px' : '150px' }}
            >
              <div>
                {/* Header Kop */}
                <div className={`${currentHeaderStyle.bg} text-white p-2 rounded-lg flex items-center justify-between gap-2 mb-2`}>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider">{settings.school_name}</p>
                    <p className="text-[11px] font-black uppercase leading-tight">{cardTitle}</p>
                  </div>
                  <span className="text-[9px] font-mono bg-white/20 px-1.5 py-0.5 rounded text-white">CBT</span>
                </div>

                {/* Body Details */}
                <div className="flex gap-2.5 items-start">
                  {cardShowPhoto && (
                    <div className="w-12 h-16 rounded border-2 border-slate-400 bg-slate-100 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[8px] font-mono font-bold text-slate-500">3 x 4</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-1">
                    <div>
                      <span className="text-[8px] text-slate-500 block font-bold uppercase">Nama Siswa:</span>
                      <p className="font-extrabold text-slate-900 text-xs leading-tight">{s.nama}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      <div>
                        <span className="text-[8px] text-slate-500 block uppercase">NIS:</span>
                        <span className="font-mono font-bold">{s.nis || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-500 block uppercase">Kelas:</span>
                        <span className="font-bold">{s.nama_kelas || '-'}</span>
                      </div>
                    </div>

                    <div className="p-1.5 rounded bg-slate-100 border border-slate-300 font-mono text-[10px] space-y-0.5">
                      <div className="flex justify-between">
                        <span>Username:</span>
                        <span className="font-bold">{s.username}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Password:</span>
                        <span className="font-bold">{s.nis ? s.nis.slice(-6) : '******'}</span>
                      </div>
                    </div>
                  </div>

                  {cardShowQr && (
                    <div className="w-11 h-11 border-2 border-slate-800 rounded p-0.5 flex items-center justify-center shrink-0">
                      <QrCode className="w-9 h-9 text-slate-900" />
                    </div>
                  )}
                </div>

                {cardShowRules && (
                  <div className="mt-2 p-1 rounded bg-slate-50 border border-slate-300 text-[8px] leading-tight text-slate-700">
                    <span className="font-bold block uppercase">Petunjuk Ujian:</span>
                    <p className="whitespace-pre-line">{cardRulesText}</p>
                  </div>
                )}
              </div>

              {/* Signature Box */}
              <div className="mt-2 pt-1 border-t border-slate-300 flex justify-between items-end text-[8px]">
                <span className="font-mono text-slate-500">KARTU UJIAN RESMI CBT</span>
                <div className="text-right leading-none">
                  <p>{cardSignLocation}, {cardSignTitle}</p>
                  <div className="h-5" />
                  <p className="font-bold underline">{cardSignName}</p>
                  <p className="font-mono text-[7px]">NIP. {cardSignNip}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
