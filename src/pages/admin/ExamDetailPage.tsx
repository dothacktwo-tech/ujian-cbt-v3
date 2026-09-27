import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  Download,
  RotateCcw,
  CheckCircle2,
  Clock,
  Award,
  Users,
  AlertCircle,
  BarChart,
  HelpCircle,
  FileDown,
  Printer,
  Radio,
  PowerOff,
  Activity,
  Check,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { ExamItem, ExamParticipantResult } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Badge } from '../../components/ui/Badge';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { exportExamResultsToPdf, exportIndividualStudentCertificatePdf } from '../../utils/pdfExport';

interface ExamDetailPageProps {
  examId: string;
  onBack: () => void;
}

export const ExamDetailPage: React.FC<ExamDetailPageProps> = ({ examId, onBack }) => {
  const { settings } = useAuth();
  const [exam, setExam] = useState<ExamItem | null>(null);
  const [results, setResults] = useState<ExamParticipantResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Real-time live monitoring mode & auto refresh
  const [liveMonitoring, setLiveMonitoring] = useState(true);
  const [monitoringSummary, setMonitoringSummary] = useState({
    total_students: 0,
    online_count: 0,
    ongoing_count: 0,
    finished_count: 0,
    not_started_count: 0,
  });

  // Force Finish Student Dialog
  const [forceFinishTarget, setForceFinishTarget] = useState<ExamParticipantResult | null>(null);
  const [forceFinishLoading, setForceFinishLoading] = useState(false);

  // Reset Student Dialog
  const [resetTarget, setResetTarget] = useState<ExamParticipantResult | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const fetchMonitoringData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await apiRequest<any>(`/api/exams/${examId}/monitoring`);
      if (res.success && res.data) {
        setExam(res.data.exam);
        setResults(res.data.participants || []);
        if (res.data.summary) {
          setMonitoringSummary(res.data.summary);
        }
      }
    } catch (e) {
      if (!isBackground) {
        toast.error('Gagal mengambil data monitoring ujian.');
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData(false);
  }, [examId]);

  // Periodic polling every 5 seconds for Real-time Monitoring
  useEffect(() => {
    if (!liveMonitoring) return;

    const interval = setInterval(() => {
      fetchMonitoringData(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [examId, liveMonitoring]);

  const handleForceFinish = async () => {
    if (!forceFinishTarget) return;
    setForceFinishLoading(true);
    try {
      const res = await apiRequest(`/api/exams/${examId}/participants/${forceFinishTarget.student_id}/force-finish`, {
        method: 'POST',
      });
      if (res.success) {
        toast.success(res.message || 'Sesi siswa berhasil diakhiri secara paksa.');
        setForceFinishTarget(null);
        fetchMonitoringData(false);
      } else {
        toast.error(res.message || 'Gagal force-finish ujian.');
      }
    } catch (e: any) {
      toast.error('Gagal force-finish sesi ujian: ' + (e?.message || e));
    } finally {
      setForceFinishLoading(false);
    }
  };

  const handleResetParticipant = async () => {
    if (!resetTarget) return;
    setResetLoading(true);
    try {
      const res = await apiRequest(`/api/exams/${examId}/reset-participant/${resetTarget.student_id}`, {
        method: 'POST',
      });
      if (res.success) {
        toast.success(res.message || 'Sesi siswa berhasil direset.');
        setResetTarget(null);
        fetchMonitoringData(false);
      } else {
        toast.error(res.message || 'Gagal mereset sesi.');
      }
    } catch (e) {
      toast.error('Gagal mereset sesi siswa.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (results.length === 0) {
      toast.info('Tidak ada hasil untuk diekspor.');
      return;
    }

    const headers = ['No', 'NIS', 'Nama Siswa', 'Kelas', 'Status', 'Soal Terjawab', 'Total Soal', 'Nilai', 'Waktu Mulai', 'Waktu Selesai'];
    const rows = results.map((r, i) => [
      i + 1,
      `"${r.nis}"`,
      `"${r.student_name}"`,
      `"${r.nama_kelas}"`,
      r.status,
      r.answered_count || 0,
      r.total_questions || exam?.total_questions || 0,
      r.score || 0,
      r.started_at || '-',
      r.submitted_at || '-',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `monitoring_ujian_${exam?.nama_ujian?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Data monitoring ujian berhasil diunduh sebagai file CSV.');
  };

  const handleExportPDF = () => {
    if (!exam) return;
    if (results.length === 0) {
      toast.info('Tidak ada data peserta untuk dicetak ke PDF.');
      return;
    }

    try {
      exportExamResultsToPdf({
        exam,
        results,
        schoolName: 'SMA Negeri 1 Nusantara',
        academicYear: '2024/2025',
      });
      toast.success('Laporan rekapitulasi nilai berhasil diekspor ke PDF.');
    } catch (err: any) {
      console.error('PDF Export Error:', err);
      toast.error('Gagal mencetak PDF: ' + (err?.message || 'Terjadi kesalahan sistem.'));
    }
  };

  const filteredParticipants = results.filter((r) => {
    const matchSearch =
      r.student_name.toLowerCase().includes(search.toLowerCase()) ||
      r.nis.toLowerCase().includes(search.toLowerCase());

    if (!matchSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'online') return r.is_online;
    return r.status === statusFilter;
  });

  const formatRemaining = (seconds?: number) => {
    if (!seconds || seconds <= 0) return 'Habis';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="secondary" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
            Kembali
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">{exam?.nama_ujian}</h2>
              <Badge variant="indigo">{exam?.mata_pelajaran}</Badge>
              {liveMonitoring && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Live Monitoring
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelas: {exam?.nama_kelas} • Tanggal: {exam?.tanggal} ({exam?.waktu_mulai} - {exam?.waktu_selesai}) • Durasi: {exam?.durasi_menit} Menit
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-mono font-bold bg-slate-100 text-indigo-700 px-3 py-1.5 rounded-lg border border-slate-300">
            Token: {exam?.token}
          </span>
          <button
            type="button"
            onClick={() => setLiveMonitoring(!liveMonitoring)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ${
              liveMonitoring
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
            title="Nyalakan / Matikan Auto Refresh Real-time"
          >
            <Activity className="w-3.5 h-3.5" />
            {liveMonitoring ? 'Auto-Refresh (5s) ON' : 'Auto-Refresh OFF'}
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchMonitoringData(false)}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Segarkan
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportPDF}
            className="bg-indigo-600 hover:bg-indigo-700 shadow-2xs font-semibold"
            icon={<FileDown className="w-3.5 h-3.5" />}
          >
            Cetak PDF Nilai
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} icon={<Download className="w-3.5 h-3.5" />}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* 4 Real-Time Monitoring Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Card 1: Online Sekarang */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Siswa Online Saat Ini</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-black text-emerald-600 font-mono">
              {monitoringSummary.online_count}
            </p>
            <span className="text-xs text-slate-400">/ {monitoringSummary.total_students} Siswa</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
            Aktif berinteraksi di CBT
          </span>
        </div>

        {/* Card 2: Sedang Mengerjakan */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">Sedang Mengerjakan</span>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-black text-amber-600 font-mono">
              {monitoringSummary.ongoing_count}
            </p>
            <span className="text-xs text-slate-400">Siswa</span>
          </div>
          <span className="text-[11px] text-amber-700 font-semibold mt-1 block">
            Sesi ujian sedang berjalan
          </span>
        </div>

        {/* Card 3: Sudah Selesai */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">Telah Mengumpulkan</span>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-black text-indigo-600 font-mono">
              {monitoringSummary.finished_count}
            </p>
            <span className="text-xs text-slate-400">Siswa</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Lembar jawaban tersimpan aman
          </span>
        </div>

        {/* Card 4: Belum Masuk */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">Belum Memulai</span>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-black text-slate-700 font-mono">
              {monitoringSummary.not_started_count}
            </p>
            <span className="text-xs text-slate-400">Siswa</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Belum memasukkan token ujian
          </span>
        </div>
      </div>

      {/* Real-time Monitoring & Results Table */}
      <Card noPadding>
        {/* Table Filters Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-1">
            <div className="w-full sm:w-72">
              <Input
                placeholder="Cari NIS atau nama siswa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="w-full sm:w-56">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 bg-white text-slate-900 text-sm px-3.5 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 font-medium"
              >
                <option value="all">Semua Siswa ({results.length})</option>
                <option value="online">🟢 Sedang Online ({monitoringSummary.online_count})</option>
                <option value="sedang_mengerjakan">⏱️ Sedang Mengerjakan ({monitoringSummary.ongoing_count})</option>
                <option value="selesai">✅ Telah Selesai ({monitoringSummary.finished_count})</option>
                <option value="belum_mulai">⚪ Belum Mulai ({monitoringSummary.not_started_count})</option>
              </select>
            </div>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Menampilkan <strong className="text-slate-800">{filteredParticipants.length}</strong> dari {results.length} siswa
          </span>
        </div>

        {/* Participants Table */}
        {loading && results.length === 0 ? (
          <Loading message="Memuat pemantauan ujian siswa..." fullHeight />
        ) : filteredParticipants.length === 0 ? (
          <EmptyState
            title="Tidak Ada Peserta Ujian Ditemukan"
            description={
              search
                ? `Tidak ada siswa yang sesuai dengan filter pencarian "${search}".`
                : 'Belum ada data siswa terdaftar untuk ujian ini.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">Nama Siswa / NIS</th>
                  <th className="py-3.5 px-4 text-center">Status Kehadiran</th>
                  <th className="py-3.5 px-4">Progres Pengerjaan</th>
                  <th className="py-3.5 px-4 text-center">Soal Aktif</th>
                  <th className="py-3.5 px-4 text-center">Sisa Waktu</th>
                  <th className="py-3.5 px-4 text-center">Nilai Admin</th>
                  <th className="py-3.5 px-5 text-right w-44">Tindakan Pengawas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredParticipants.map((r, index) => {
                  const totalQ = r.total_questions || exam?.total_questions || 1;
                  const answered = r.answered_count || 0;
                  const percent = Math.min(100, Math.round((answered / totalQ) * 100));

                  return (
                    <tr key={r.student_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 text-center text-xs text-slate-500 font-mono">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 leading-snug">{r.student_name}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          NIS: {r.nis} • {r.nama_kelas}
                        </div>
                      </td>

                      {/* Status Kehadiran Live */}
                      <td className="px-4 py-3.5 text-center">
                        {r.status === 'selesai' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Check className="w-3 h-3 text-indigo-600" />
                            Selesai
                          </span>
                        ) : r.status === 'sedang_mengerjakan' ? (
                          r.is_online ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                              Online Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                              Idle / Disconnect
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            Belum Masuk
                          </span>
                        )}
                      </td>

                      {/* Progres Pengerjaan Real-time */}
                      <td className="px-4 py-3.5">
                        {r.status !== 'belum_mulai' ? (
                          <div className="space-y-1 min-w-[150px]">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-800 font-mono">
                                {answered} / {totalQ} Soal
                              </span>
                              <span className="font-semibold text-indigo-600 font-mono text-[11px]">
                                {percent}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  r.status === 'selesai'
                                    ? 'bg-emerald-500'
                                    : r.is_online
                                    ? 'bg-indigo-600'
                                    : 'bg-amber-400'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Belum ada progres</span>
                        )}
                      </td>

                      {/* Soal Aktif */}
                      <td className="px-4 py-3.5 text-center">
                        {r.status === 'sedang_mengerjakan' ? (
                          <span className="font-mono text-xs font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md border border-indigo-200">
                            No. {(Number(r.current_question_index) || 0) + 1}
                          </span>
                        ) : r.status === 'selesai' ? (
                          <span className="text-xs text-slate-400">Tuntas</span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>

                      {/* Sisa Waktu Ujian */}
                      <td className="px-4 py-3.5 text-center font-mono text-xs">
                        {r.status === 'sedang_mengerjakan' ? (
                          <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {formatRemaining(r.remaining_seconds)}
                          </span>
                        ) : r.status === 'selesai' ? (
                          <span className="text-emerald-700 font-semibold">Tersimpan</span>
                        ) : (
                          <span className="text-slate-400">{exam?.durasi_menit}m</span>
                        )}
                      </td>

                      {/* Skor Admin (Hanya terlihat oleh guru/admin) */}
                      <td className="px-4 py-3.5 text-center font-black">
                        {r.status === 'selesai' ? (
                          <span className="font-mono text-sm text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {r.score}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal text-xs">-</span>
                        )}
                      </td>

                      {/* Tindakan Pengawas (Force Finish, Reset, & Sertifikat) */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === 'selesai' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                if (!exam) return;
                                exportIndividualStudentCertificatePdf({
                                  exam,
                                  participant: r,
                                  schoolName: settings?.school_name || 'SMA Negeri 1 Lumbung',
                                  academicYear: settings?.academic_year || '2024/2025',
                                });
                                toast.success(`Sertifikat PDF ${r.student_name} berhasil diekspor.`);
                              }}
                              title="Unduh Sertifikat Kelulusan & Hasil Ujian PDF"
                              className="bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200/80 font-bold text-xs py-1 px-2.5 shadow-2xs"
                              icon={<FileDown className="w-3.5 h-3.5 text-amber-600" />}
                            >
                              Sertifikat PDF
                            </Button>
                          )}

                          {r.status === 'sedang_mengerjakan' && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setForceFinishTarget(r)}
                              title="Paksa Selesai Ujian Siswa (Force Finish)"
                              className="font-bold bg-rose-600 hover:bg-rose-700 text-xs py-1 px-2.5"
                              icon={<PowerOff className="w-3.5 h-3.5" />}
                            >
                              Paksa Selesai
                            </Button>
                          )}

                          {r.status !== 'belum_mulai' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setResetTarget(r)}
                              title="Reset Sesi Siswa (Mulai Ulang Dari Awal)"
                              className="hover:bg-amber-50 text-amber-700 text-xs py-1 px-2"
                              icon={<RotateCcw className="w-3.5 h-3.5" />}
                            >
                              Reset
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Force Finish Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!forceFinishTarget}
        onClose={() => setForceFinishTarget(null)}
        onConfirm={handleForceFinish}
        title="Paksa Selesai Ujian Siswa?"
        message={
          <span>
            Apakah Anda yakin ingin <strong>mengakhiri sesi ujian secara paksa (force finish)</strong> untuk siswa{' '}
            <strong className="text-slate-900 font-bold">{forceFinishTarget?.student_name}</strong> (NIS: {forceFinishTarget?.nis})?
            <br />
            <br />
            Lembar jawaban yang telah dijawab hingga detik ini akan langsung dikunci, dinilai secara otomatis di server, dan siswa tidak dapat melanjutkan pengerjaan lagi.
          </span>
        }
        confirmText="Ya, Paksa Selesai"
        variant="danger"
        loading={forceFinishLoading}
      />

      {/* Reset Participant Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!resetTarget}
        onClose={() => setResetTarget(null)}
        onConfirm={handleResetParticipant}
        title="Reset Sesi Ujian Siswa?"
        message={
          <span>
            Apakah Anda yakin ingin mereset sesi ujian untuk{' '}
            <strong className="text-slate-900 font-bold">{resetTarget?.student_name}</strong> (NIS: {resetTarget?.nis})?
            Jawaban yang tersimpan akan dihapus dan siswa dapat memasukkan token untuk memulai ulang.
          </span>
        }
        confirmText="Ya, Reset Sesi"
        variant="danger"
        loading={resetLoading}
      />
    </div>
  );
};
