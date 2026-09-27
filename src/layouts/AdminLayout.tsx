import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  FileSpreadsheet,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  School,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

interface AdminLayoutProps {
  currentTab: string;
  onTabChange: (tab: string, paramId?: string) => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  onTabChange,
  children,
}) => {
  const { user, logout, settings } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'classes', label: 'Data Kelas', icon: GraduationCap },
    { id: 'students', label: 'Data Siswa', icon: Users },
    { id: 'question-banks', label: 'Bank Soal', icon: BookOpen },
    { id: 'exams', label: 'Jadwal Ujian', icon: CalendarCheck },
    { id: 'student-reports', label: 'Laporan Nilai', icon: FileSpreadsheet },
    { id: 'exam-cards', label: 'Kartu Ujian', icon: CreditCard },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ];

  const handleNavClick = (id: string) => {
    onTabChange(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-slate-800 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between shadow-md sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ffb646] to-[#ffb43e] flex items-center justify-center font-black text-slate-950 shadow-xs">
            <School className="w-4 h-4 text-slate-950" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">CBT UJIAN</h1>
            <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{settings.school_name}</p>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Sidebar Desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-200 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:inset-auto md:min-h-screen shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand / Logo Area */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffb646] to-[#ffb43e] flex items-center justify-center text-slate-950 font-black shadow-md">
              <School className="w-5 h-5 text-slate-950" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                CBT UJIAN
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/30">
                  SERVER
                </span>
              </h2>
              <p className="text-xs text-slate-400 truncate">{settings.school_name}</p>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Academic Year Info Badge */}
        <div className="mx-4 my-3 px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-between text-xs">
          <span className="text-slate-400">Tahun Ajaran</span>
          <span className="font-semibold text-slate-200">{settings.academic_year}</span>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentTab === item.id ||
              (item.id === 'question-banks' && currentTab === 'question-bank-detail') ||
              (item.id === 'exams' && currentTab === 'exam-detail');

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                  isActive
                    ? 'bg-gradient-to-r from-[#ffb646] to-[#ffb43e] text-slate-950 font-bold shadow-md'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Info & Logout Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/90">
          <div className="px-3 py-2 flex items-center justify-between mb-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name || 'Administrator'}</p>
              <p className="text-[11px] text-slate-400 truncate">@{user?.username || 'admin'}</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" title="Online"></span>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-300 hover:text-rose-100 hover:bg-rose-900/40 border border-rose-900/50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar Sistem
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen bg-[#faf8f5]">
        {/* Top bar desktop */}
        <header className="hidden md:flex items-center justify-between bg-white border-b border-amber-200/60 px-8 py-3.5 shadow-2xs">
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              {menuItems.find((m) => m.id === currentTab)?.label || 'Panel Kontrol CBT'}
            </h1>
            <p className="text-xs text-slate-500">
              Kelola ujian berbasis komputer {settings.school_name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-800">{user?.name}</p>
              <p className="text-[11px] text-slate-500 capitalize">Role: {user?.role}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ffb646] to-[#ffb43e] text-slate-950 font-bold flex items-center justify-center border border-amber-300/80 shadow-2xs">
              {user?.name?.charAt(0) || 'A'}
            </div>
          </div>
        </header>

        {/* Page View Body */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</div>
      </main>
    </div>
  );
};
