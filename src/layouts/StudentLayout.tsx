import React from 'react';
import { School, LogOut, User, Award, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

interface StudentLayoutProps {
  children: React.ReactNode;
  hideHeader?: boolean;
}

export const StudentLayout: React.FC<StudentLayoutProps> = ({
  children,
  hideHeader = false,
}) => {
  const { user, logout, settings } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {!hideHeader && (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            {/* Logo & School Name */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
                <School className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                  CBT UJIAN
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    SISWA
                  </span>
                </h1>
                <p className="text-xs text-slate-500 truncate max-w-[200px] sm:max-w-xs">{settings.school_name}</p>
              </div>
            </div>

            {/* Student Info & Logout */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-bold text-slate-800 leading-tight">{user?.name}</p>
                <div className="flex items-center justify-end gap-1.5 text-xs text-slate-500">
                  <span className="font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                    {user?.className || 'Kelas Siswa'}
                  </span>
                  <span>•</span>
                  <span>NIS: {user?.nis || user?.username}</span>
                </div>
              </div>

              <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold flex items-center justify-center sm:hidden">
                {user?.name?.charAt(0) || 'S'}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
                icon={<LogOut className="w-3.5 h-3.5" />}
              >
                <span className="hidden sm:inline">Keluar</span>
              </Button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8">{children}</main>

      {!hideHeader && (
        <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
          <p>© {new Date().getFullYear()} {settings.school_name} — Sistem Ujian Berbasis Komputer (CBT UJIAN)</p>
        </footer>
      )}
    </div>
  );
};
