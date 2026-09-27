import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  CheckSquare,
  Square,
  Users,
  CheckCircle2,
  BarChart3,
  Award,
  Clock,
  Printer,
  FileText,
  FileCode,
  School,
  GraduationCap,
  Eye,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Loading } from '../../components/ui/Loading';
import { toast } from '../../components/ui/Toast';
import {
  ReportItem,
  exportReportsToCsv,
  exportReportsToPdf,
  exportReportsToJson,
} from '../../utils/reportsExport';
import { exportIndividualStudentCertificatePdf } from '../../utils/pdfExport';

export const StudentReportsPage: React.FC = () => {
  const { settings } = useAuth();

  // Data States
  const [loading, setLoading] = useState(true);
  const [classesList, setClassesList] = useState<{ id: string; nama_kelas: string; tingkat?: string }[]>([]);
  const [examsList, setExamsList] = useState<{ id: string; nama_ujian: string; mata_pelajaran: string; nama_kelas?: string }[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    total_students: 0,
    total_completed: 0,
    average_score: 0,
    max_score: 0,
    min_score: 0,
    passed_count: 0,
    passed_rate: 0,
  });

  // Filter States
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table Multi-Select State
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Detail Modal State
  const [selectedDetailItem, setSelectedDetailItem] = useState<ReportItem | null>(null);

  // Fetch Reports from API
  const fetchReports = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedClassId !== 'all') queryParams.set('class_id', selectedClassId);
      if (selectedExamId !== 'all') queryParams.set('exam_id', selectedExamId);
      if (selectedStatus !== 'all') queryParams.set('status', selectedStatus);
      if (searchQuery.trim()) queryParams.set('q', searchQuery.trim());

      const res = await apiRequest(`/api/admin/student-reports?${queryParams.toString()}`);

      if (res.success && res.data) {
        setClassesList(res.data.classes || []);
        setExamsList(res.data.exams || []);
        setReports(res.data.reports || []);
        if (res.data.summary) {
          setSummaryStats(res.data.summary);
        }
      } else {
        toast.error(res.message || 'Gagal memuat laporan nilai siswa.');
      }
    } catch (err: any) {
      toast.error('Terjadi gangguan jaringan saat memuat data laporan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedClassId, selectedExamId, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReports();
  };

  const handleResetFilters = () => {
    setSelectedClassId('all');
    setSelectedExamId('all');
    setSelectedStatus('all');
    setSearchQuery('');
    setSelectedRowIds(new Set());
  };

  // Row selection logic
  const handleToggleSelectAll = () => {
    if (selectedRowIds.size === reports.length && reports.length > 0) {
      setSelectedRowIds(new Set());
    } else {
      const allIds = new Set(reports.map((r) => `${r.student_id}_${r.exam_id}`));
      setSelectedRowIds(allIds);
    }
  };

  const handleToggleSelectRow = (key: string) => {
    const next = new Set(selectedRowIds);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedRowIds(next);
  };

  // Get items to export (either selected rows or all filtered reports)
  const getExportData = (): ReportItem[] => {
    if (selectedRowIds.size > 0) {
      return reports.filter((r) => selectedRowIds.has(`${r.student_id}_${r.exam_id}`));
    }
    return reports;
  };

  // Get active filter labels for PDF export title
  const getFilterLabels = () => {
    const className = selectedClassId === 'all'
      ? 'Semua Kelas'
      : classesList.find((c) => c.id === selectedClassId)?.nama_kelas || 'Kelas Terpilih';

    const examName = selectedExamId === 'all'
      ? 'Semua Ujian'
      : examsList.find((e) => e.id === selectedExamId)?.nama_ujian || 'Ujian Terpilih';

    return { filterClassName: className, filterExamName: examName };
  };

  // Export handlers
  const handleExportCsv = () => {
    const exportData = getExportData();
    if (exportData.length === 0) {
      toast.error('Tidak ada data nilai untuk dieksport.');
      return;
    }
    const filename = `laporan-nilai-${getFilterLabels().filterClassName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`;
    exportReportsToCsv(exportData, filename);
    toast.success(`Berhasil mengunduh ${exportData.length} data nilai dalam format CSV / Excel.`);
  };

  const handleExportPdf = () => {
    const exportData = getExportData();
    if (exportData.length === 0) {
      toast.error('Tidak ada data nilai untuk dieksport.');
      return;
    }
    const { filterClassName, filterExamName } = getFilterLabels();
    exportReportsToPdf(exportData, {
      schoolName: settings.school_name,
      academicYear: settings.academic_year,
      filterClassName,
      filterExamName,
    });
    toast.success(`Berhasil mengunduh Laporan Nilai PDF (${exportData.length} siswa).`);
  };

  const handleExportJson = () => {
    const exportData = getExportData();
    if (exportData.length === 0) {
      toast.error('Tidak ada data nilai untuk dieksport.');
      return;
    }
    const filename = `laporan-nilai-${getFilterLabels().filterClassName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`;
    exportReportsToJson(exportData, filename);
    toast.success(`Berhasil mengunduh data JSON (${exportData.length} baris).`);
  };

  // Download Individual Certificate PDF
  const handleDownloadSingleCertificate = (item: ReportItem) => {
    exportIndividualStudentCertificatePdf({
      exam: {
        id: item.exam_id,
        nama_ujian: item.nama_ujian,
        mata_pelajaran: item.mata_pelajaran,
        tanggal: item.tanggal,
        durasi_menit: item.durasi_menit,
        token: item.token,
      } as any,
      participant: {
        student_id: item.student_id,
        student_name: item.student_name,
        nis: item.nis,
        nama_kelas: item.nama_kelas,
        status: item.status,
        score: item.score,
        correct_answers: item.correct_answers,
        wrong_answers: item.wrong_answers,
        total_questions: item.total_questions,
      } as any,
      schoolName: settings.school_name,
      academicYear: settings.academic_year,
    });
    toast.success(`Sertifikat hasil ujian ${item.student_name} berhasil diunduh.`);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <span>Laporan Nilai Siswa</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Rekapitulasi dan analisis nilai ujian siswa per kelas dan mata pelajaran. Unduh laporan dalam berbagai format dokumen.
          </p>
        </div>

        {/* Global Export Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="success"
            size="sm"
            onClick={handleExportCsv}
            icon={<FileSpreadsheet className="w-4 h-4" />}
            className="font-bold cursor-pointer"
          >
            Export Excel (CSV)
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportPdf}
            icon={<FileText className="w-4 h-4" />}
            className="bg-indigo-600 hover:bg-indigo-700 font-bold cursor-pointer"
          >
            Export PDF
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportJson}
            icon={<FileCode className="w-4 h-4" />}
            className="font-bold cursor-pointer"
          >
            Export JSON
          </Button>
        </div>
      </div>

      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold shrink-0">
            <Users className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Siswa Terdata</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{summaryStats.total_students} Siswa</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Selesai Ujian</p>
            <p className="text-lg font-black text-emerald-700 mt-0.5">
              {summaryStats.total_completed} / {summaryStats.total_students}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shrink-0">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Rata-Rata Nilai</p>
            <p className="text-lg font-black text-indigo-700 mt-0.5">{summaryStats.average_score}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold shrink-0">
            <Award className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ketuntasan (≥ 75)</p>
            <p className="text-lg font-black text-amber-700 mt-0.5">
              {summaryStats.passed_rate}% ({summaryStats.passed_count} Siswa)
            </p>
          </div>
        </div>
      </div>

      {/* Filter Control Card */}
      <Card
        title={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-indigo-600" />
              <span>Filter Data Laporan per Kelas & Ujian</span>
            </div>
            {(selectedClassId !== 'all' || selectedExamId !== 'all' || selectedStatus !== 'all' || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                className="text-xs text-rose-600 hover:bg-rose-50 font-bold"
              >
                Reset Filter
              </Button>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Filter Kelas */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
              <span>Pilih Kelas:</span>
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Kelas</option>
              {classesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nama_kelas} {c.tingkat ? `(Tingkat ${c.tingkat})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Ujian */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-indigo-600" />
              <span>Pilih Ujian:</span>
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Ujian / Mata Pelajaran</option>
              {examsList.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.nama_ujian} ({ex.mata_pelajaran}) - {ex.nama_kelas || 'Kelas'}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status Ujian */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Status Ujian:</span>
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="selesai">Selesai Ujian</option>
              <option value="sedang_mengerjakan">Sedang Mengerjakan</option>
              <option value="belum_mulai">Belum Ujian</option>
            </select>
          </div>

          {/* Search Query Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-indigo-600" />
              <span>Cari Siswa / NIS:</span>
            </label>
            <form onSubmit={handleSearchSubmit} className="flex gap-1.5">
              <input
                type="text"
                placeholder="Nama / NISN / Mata Pelajaran..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:ring-indigo-500 focus:border-indigo-500"
              />
              <Button type="submit" variant="primary" size="sm" className="px-3 bg-indigo-600 hover:bg-indigo-700 shrink-0">
                Cari
              </Button>
            </form>
          </div>
        </div>
      </Card>

      {/* Multi-Select Action Bar (Shows when items are checked) */}
      {selectedRowIds.size > 0 && (
        <div className="p-3.5 bg-indigo-900 text-white rounded-2xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="bg-amber-400 text-slate-950 text-xs font-black px-2.5 py-1 rounded-lg">
              {selectedRowIds.size} Siswa Dipilih
            </span>
            <p className="text-xs text-indigo-200">Pilih format dokumen untuk mengeksport data siswa terpilih:</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="success"
              size="sm"
              onClick={handleExportCsv}
              icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
              className="font-bold text-xs"
            >
              Export Excel ({selectedRowIds.size})
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportPdf}
              icon={<FileText className="w-3.5 h-3.5" />}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
            >
              Export PDF ({selectedRowIds.size})
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportJson}
              icon={<FileCode className="w-3.5 h-3.5" />}
              className="font-bold text-xs"
            >
              Export JSON ({selectedRowIds.size})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRowIds(new Set())}
              className="text-xs text-indigo-200 hover:text-white"
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      {/* Main Reports Table */}
      <Card
        title={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              <span>Daftar Nilai Siswa ({reports.length} Rekaman)</span>
            </div>
            <span className="text-xs font-normal text-slate-500">
              Menampilkan data sesuai filter kelas & ujian
            </span>
          </div>
        }
      >
        {loading ? (
          <Loading message="Memuat rekapitulasi laporan nilai..." />
        ) : reports.length === 0 ? (
          <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <GraduationCap className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">Tidak Ada Data Nilai Ditemukan</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Tidak ada hasil ujian yang cocok dengan kriteria filter kelas atau pencarian yang dipilih.
            </p>
            <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-4 font-bold">
              Reset Semua Filter
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:-mx-6">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-y border-slate-200">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-slate-500 hover:text-indigo-600 cursor-pointer"
                      title="Pilih Semua"
                    >
                      {selectedRowIds.size === reports.length && reports.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="p-3 w-10 text-center">No</th>
                  <th className="p-3">NIS & Username</th>
                  <th className="p-3">Nama Siswa</th>
                  <th className="p-3">Kelas</th>
                  <th className="p-3">Mata Pelajaran & Ujian</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Benar/Salah</th>
                  <th className="p-3 text-center">Nilai Akhir</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {reports.map((r, idx) => {
                  const key = `${r.student_id}_${r.exam_id}`;
                  const isSelected = selectedRowIds.has(key);
                  const isPassed = r.score >= 75;

                  return (
                    <tr
                      key={key}
                      className={`hover:bg-indigo-50/40 transition-colors ${
                        isSelected ? 'bg-indigo-50/80 font-semibold' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectRow(key)}
                          className="text-slate-400 hover:text-indigo-600 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="p-3 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-3">
                        <span className="font-mono font-bold text-slate-800 block">{r.nis || '-'}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">@{r.username}</span>
                      </td>
                      <td className="p-3 font-bold text-slate-900">{r.student_name}</td>
                      <td className="p-3">
                        <Badge variant="indigo" className="font-mono text-[10px]">
                          {r.nama_kelas}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-800 block">{r.mata_pelajaran}</span>
                        <span className="text-[10px] text-slate-500 block truncate max-w-[200px]">{r.nama_ujian}</span>
                      </td>
                      <td className="p-3 text-center">
                        {r.status === 'selesai' ? (
                          <Badge variant="success" className="text-[10px]">
                            Selesai
                          </Badge>
                        ) : r.status === 'sedang_mengerjakan' ? (
                          <Badge variant="warning" className="text-[10px]">
                            Sedang Ujian
                          </Badge>
                        ) : (
                          <Badge variant="neutral" className="text-[10px] text-slate-400">
                            Belum Ujian
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono">
                        {r.status === 'selesai' ? (
                          <span className="text-slate-700">
                            <span className="text-emerald-600 font-bold">{r.correct_answers}</span> /{' '}
                            <span className="text-rose-600">{r.wrong_answers}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono">
                        {r.status === 'selesai' ? (
                          <span
                            className={`text-sm font-black px-2 py-0.5 rounded-lg ${
                              isPassed
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}
                          >
                            {r.score.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedDetailItem(r)}
                            icon={<Eye className="w-3.5 h-3.5" />}
                            className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 font-bold"
                          >
                            Detail
                          </Button>
                          {r.status === 'selesai' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadSingleCertificate(r)}
                              icon={<Printer className="w-3.5 h-3.5" />}
                              className="text-amber-700 border-amber-300 hover:bg-amber-50 font-bold"
                              title="Unduh Sertifikat Hasil PDF"
                            >
                              Cetak
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

      {/* DETAIL STUDENT GRADE MODAL */}
      <Modal
        isOpen={!!selectedDetailItem}
        onClose={() => setSelectedDetailItem(null)}
        title="Rincian Hasil Ujian Siswa"
        subtitle={selectedDetailItem ? `${selectedDetailItem.student_name} (${selectedDetailItem.nama_kelas})` : ''}
        maxWidth="md"
        footer={
          selectedDetailItem ? (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-500 font-mono">ID: {selectedDetailItem.student_id}</span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSelectedDetailItem(null)}>
                  Tutup
                </Button>
                {selectedDetailItem.status === 'selesai' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      handleDownloadSingleCertificate(selectedDetailItem);
                      setSelectedDetailItem(null);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 font-bold"
                    icon={<Printer className="w-4 h-4" />}
                  >
                    Unduh Sertifikat PDF
                  </Button>
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {selectedDetailItem && (
          <div className="space-y-4 text-xs">
            {/* Identity Box */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Nama Siswa:</span>
                <p className="font-bold text-slate-900 text-sm">{selectedDetailItem.student_name}</p>
                <p className="text-slate-500 font-mono mt-0.5">NIS: {selectedDetailItem.nis || '-'}</p>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Kelas:</span>
                <Badge variant="indigo" className="mt-1">{selectedDetailItem.nama_kelas}</Badge>
              </div>
            </div>

            {/* Exam Box */}
            <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-indigo-900 text-sm">{selectedDetailItem.mata_pelajaran}</span>
                <span className="text-xs text-indigo-700 font-semibold">{selectedDetailItem.tanggal}</span>
              </div>
              <p className="text-slate-600 font-medium">{selectedDetailItem.nama_ujian}</p>
              <p className="text-[11px] text-slate-500">
                Durasi: {selectedDetailItem.durasi_menit} Menit • Token: <code className="font-bold text-indigo-800">{selectedDetailItem.token}</code>
              </p>
            </div>

            {/* Score Breakdown Box */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <span className="block font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                Rekapitulasi Capaian Ujian:
              </span>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">Total Soal</span>
                  <p className="font-extrabold text-slate-900 text-base">{selectedDetailItem.total_questions}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="text-emerald-700 block text-[10px]">Benar / Salah</span>
                  <p className="font-extrabold text-emerald-800 text-base">
                    {selectedDetailItem.correct_answers} / {selectedDetailItem.wrong_answers}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200">
                  <span className="text-indigo-700 block text-[10px]">Nilai Akhir</span>
                  <p className="font-black text-indigo-900 text-xl">{selectedDetailItem.score.toFixed(1)}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-600">
                <span>Waktu Submit / Selesai:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {selectedDetailItem.submitted_at
                    ? new Date(selectedDetailItem.submitted_at).toLocaleString('id-ID')
                    : '-'}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
