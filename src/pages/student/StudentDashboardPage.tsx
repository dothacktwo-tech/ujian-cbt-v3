import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Clock,
  Calendar,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Play,
  Award,
  HelpCircle,
  Sparkles,
  ArrowRight,
  GraduationCap,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { ExamItem } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { toast } from '../../components/ui/Toast';

interface StudentDashboardPageProps {
  onStartExam: (examId: string) => void;
  onViewResult: (examId: string) => void;
}

export const StudentDashboardPage: React.FC<StudentDashboardPageProps> = ({
  onStartExam,
  onViewResult,
}) => {
  const { user, settings } = useAuth();
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Token Modal
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<ExamItem | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [startLoading, setStartLoading] = useState(false);
  const [tokenError, setTokenError] = useState('');

  const fetchStudentExams = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<ExamItem[]>('/api/student/exams');
      if (res.success && res.data) {
        setExams(res.data);
      }
    } catch (e) {
      toast.error('Gagal memuat jadwal ujian.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentExams();
  }, []);

  const handleOpenTokenPrompt = (exam: ExamItem) => {
    setSelectedExam(exam);
    setTokenInput('');
    setTokenError('');
    setTokenModalOpen(true);
  };

  const handleConfirmStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam || !tokenInput.trim()) {
      setTokenError('Harap masukkan token ujian.');
      return;
    }

    setStartLoading(true);
    setTokenError('');

    try {
      const res = await apiRequest(`/api/student/exams/${selectedExam.id}/start`, {
        method: 'POST',
        body: JSON.stringify({ token: tokenInput.trim().toUpperCase() }),
      });

      if (res.success) {
        setTokenModalOpen(false);
        toast.success('Token valid! Ujian dimulai.');
        onStartExam(selectedExam.id);
      } else {
        setTokenError(res.message || 'Token tidak valid. Silakan coba lagi.');
      }
    } catch (err: any) {
      setTokenError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setStartLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 rounded-2xl p-6 sm:p-8 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-indigo-100 text-xs font-semibold border border-white/20">
            <GraduationCap className="w-3.5 h-3.5 text-emerald-300" />
            <span>Tahun Ajaran {settings.academic_year}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Selamat datang, {user?.name || 'Siswa'}!
          </h2>
          <p className="text-xs sm:text-sm text-indigo-100">
            Kelas: <strong className="text-white font-bold">{user?.className || 'Terdaftar'}</strong> • NIS: {user?.nis || user?.username}
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-4 bg-white/10 backdrop-blur-xs px-5 py-3.5 rounded-xl border border-white/20">
          <div className="text-right">
            <span className="text-xs text-indigo-200">Ujian Tersedia</span>
            <p className="text-2xl font-black text-white">{exams.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Section: Ujian Tersedia */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">UJIAN TERSEDIA</h3>
            <p className="text-xs text-slate-500">
              Daftar ujian yang ditujukan khusus untuk kelas Anda
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchStudentExams} loading={loading}>
            Segarkan
          </Button>
        </div>

        {loading ? (
          <Loading message="Memeriksa jadwal ujian kelas Anda..." />
        ) : exams.length === 0 ? (
          <Card>
            <EmptyState
              title="Tidak Ada Ujian Aktif"
              description="Saat ini belum ada jadwal ujian aktif untuk kelas Anda. Silakan hubungi guru atau administrator jika ujian seharusnya sudah dimulai."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {exams.map((exam) => {
              const isFinished = exam.participant_status === 'selesai';
              const isOngoing = exam.participant_status === 'sedang_mengerjakan';

              return (
                <div
                  key={exam.id}
                  className={`bg-white rounded-2xl border transition-all overflow-hidden flex flex-col justify-between ${
                    isFinished
                      ? 'border-slate-200 shadow-2xs opacity-90'
                      : isOngoing
                      ? 'border-amber-400 shadow-md ring-2 ring-amber-400/30'
                      : 'border-slate-200/90 shadow-2xs hover:shadow-md hover:border-indigo-300'
                  }`}
                >
                  <div className="p-5 sm:p-6 space-y-4">
                    {/* Top Badges */}
                    <div className="flex items-start justify-between gap-3">
                      <Badge variant="indigo">{exam.mata_pelajaran}</Badge>
                      {isFinished ? (
                        <Badge variant="success">Ujian Selesai</Badge>
                      ) : isOngoing ? (
                        <Badge variant="warning">Sedang Mengerjakan</Badge>
                      ) : (
                        <Badge variant="neutral">Tersedia</Badge>
                      )}
                    </div>

                    {/* Title */}
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-lg leading-snug">
                        {exam.nama_ujian}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Kelas: <span className="font-semibold text-slate-700">{exam.nama_kelas}</span>
                      </p>
                    </div>

                    {/* Schedule Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 block">Tanggal</span>
                          <span className="font-semibold text-slate-800">{exam.tanggal}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 block">Waktu / Durasi</span>
                          <span className="font-semibold text-slate-800">
                            {exam.waktu_mulai} ({exam.durasi_menit}m)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 block">Jumlah Soal</span>
                          <span className="font-semibold text-slate-800">{exam.total_questions || 0} Butir</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-indigo-500 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 block">Tipe Ujian</span>
                          <span className="font-semibold text-slate-800">Pilihan Ganda</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Action */}
                  <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                    {isFinished ? (
                      <>
                        <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Telah Dikumpulkan
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onViewResult(exam.id)}
                          icon={<FileCheck className="w-3.5 h-3.5 text-emerald-600" />}
                        >
                          Bukti Selesai
                        </Button>
                      </>
                    ) : isOngoing ? (
                      <>
                        <span className="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
                          <Clock className="w-4 h-4 animate-spin" />
                          Sesi sedang berjalan
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => onStartExam(exam.id)}
                          className="bg-amber-600 hover:bg-amber-700 font-bold"
                          icon={<Play className="w-3.5 h-3.5" />}
                        >
                          Lanjutkan Ujian
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-slate-500">Memerlukan Token Ujian</span>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenTokenPrompt(exam)}
                          className="font-bold"
                          icon={<KeyRound className="w-3.5 h-3.5" />}
                        >
                          MULAI UJIAN
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Token Prompt Modal */}
      <Modal
        isOpen={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        title="Konfirmasi Token Ujian"
        subtitle={`Ujian: ${selectedExam?.nama_ujian}`}
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setTokenModalOpen(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmStart}
              loading={startLoading}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Verifikasi & Mulai
            </Button>
          </>
        }
      >
        <form onSubmit={handleConfirmStart} className="space-y-4 py-1">
          <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
            <p className="font-bold mb-1">Petunjuk Memulai Ujian:</p>
            <ul className="list-disc list-inside space-y-0.5 text-indigo-800">
              <li>Minta token ujian kepada pengawas / guru di kelas.</li>
              <li>Waktu akan mulai berjalan otomatis setelah Anda menekan tombol mulai.</li>
            </ul>
          </div>

          {tokenError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              {tokenError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Masukkan Token Ujian (6 Karakter)
            </label>
            <input
              type="text"
              placeholder="Contoh: MAT101"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
              className="block w-full text-center font-mono font-black text-xl tracking-widest uppercase rounded-xl border border-slate-300 py-3 text-indigo-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
              maxLength={10}
              required
              autoFocus
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
