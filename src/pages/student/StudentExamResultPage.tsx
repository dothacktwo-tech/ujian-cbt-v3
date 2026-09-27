import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  HelpCircle,
  ArrowLeft,
  School,
  Clock,
  Calendar,
  Lock,
  Printer,
  FileCheck,
  ShieldCheck,
  User,
  Hash,
  Download,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/ui/Loading';
import { toast } from '../../components/ui/Toast';
import { exportStudentExamResultReportPdf } from '../../utils/pdfExport';

interface StudentExamResultPageProps {
  examId: string;
  onBackToDashboard: () => void;
}

export const StudentExamResultPage: React.FC<StudentExamResultPageProps> = ({
  examId,
  onBackToDashboard,
}) => {
  const { user, settings } = useAuth();
  const [resultData, setResultData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      setLoading(true);
      try {
        const res = await apiRequest(`/api/student/exams/${examId}/result`);
        if (res.success && res.data) {
          setResultData(res.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [examId]);

  if (loading) {
    return <Loading message="Memverifikasi bukti pengerjaan ujian..." fullHeight />;
  }

  const exam = resultData?.exam;
  const participant = resultData?.participant;
  const submissionTime = participant?.submitted_at
    ? new Date(participant.submitted_at).toLocaleString('id-ID', {
        dateStyle: 'full',
        timeStyle: 'medium',
      })
    : new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' });

  const verificationCode = `CBT-VERIF-${(exam?.id || 'EXM').slice(0, 6).toUpperCase()}-${(user?.userId || 'USR').slice(0, 4).toUpperCase()}`;

  const canPrint = settings.allow_student_print_result !== '0';

  const handlePrint = () => {
    if (!canPrint) {
      toast.info('Fitur cetak tanda terima dinonaktifkan oleh administrator sekolah.');
      return;
    }
    window.print();
  };

  const handleDownloadPdf = () => {
    if (!canPrint) {
      toast.info('Fitur unduh laporan PDF dinonaktifkan oleh administrator sekolah.');
      return;
    }
    exportStudentExamResultReportPdf({
      studentName: user?.name || participant?.student_name || 'Siswa CBT',
      studentNis: user?.nis || participant?.student_nis || user?.username || '-',
      studentClass: user?.className || participant?.student_class || '-',
      examSubject: exam?.mata_pelajaran || 'Mata Pelajaran',
      examTitle: exam?.nama_ujian || 'Ujian CBT',
      submissionDate: submissionTime,
      score: participant?.score !== undefined ? participant.score : null,
      totalQuestions: exam?.total_questions || participant?.total_questions,
      correctAnswers: participant?.correct_answers,
      wrongAnswers: participant?.wrong_answers,
      verificationCode,
      schoolName: settings.school_name || 'SMA Negeri 1 Lumbung',
      academicYear: settings.academic_year || '2024/2025',
    });
  };

  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-10 space-y-6">
      {/* Top Notice */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={onBackToDashboard}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Kembali ke Dashboard
        </Button>
        {canPrint ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              icon={<Printer className="w-4 h-4" />}
            >
              Cetak
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadPdf}
              className="bg-emerald-600 hover:bg-emerald-700 font-bold"
              icon={<Download className="w-4 h-4" />}
            >
              Unduh Laporan PDF
            </Button>
          </div>
        ) : (
          <span className="text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
            Cetak Tanda Terima Dinonaktifkan oleh Admin
          </span>
        )}
      </div>

      {/* Main Official CBT Receipt Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden print:border-none print:shadow-none">
        {/* Card Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 px-6 py-8 text-white text-center relative overflow-hidden">
          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-xs border border-white/20 mb-3 shadow-inner">
              <ShieldCheck className="w-9 h-9 text-emerald-200" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Tanda Terima Pengerjaan CBT
            </h2>
            <p className="text-xs text-emerald-100 mt-1 font-medium">
              Lembar Jawaban Berhasil Terkunci & Tersimpan di Basis Data Sekolah
            </p>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Security Status Box */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950 space-y-0.5">
              <p className="font-bold text-emerald-800">
                Status Ujian: SELESAI (TERVERIFIKASI)
              </p>
              <p className="text-emerald-700 leading-relaxed">
                Seluruh butir jawaban Anda telah diarsipkan secara otomatis oleh server CBT. Sesi ujian telah ditutup secara aman.
              </p>
            </div>
          </div>

          {/* Verification Metadata Box */}
          <div className="border border-slate-200 rounded-2xl p-5 space-y-4 bg-slate-50/50 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                Identitas Peserta Ujian
              </span>
              <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {verificationCode}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 block text-[11px]">Nama Lengkap Siswa</span>
                <p className="font-bold text-slate-800 text-sm">{user?.name || '-'}</p>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Nomor Induk Siswa (NIS)</span>
                <p className="font-bold text-slate-800 font-mono">{user?.nis || user?.username || '-'}</p>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Kelas / Rombel</span>
                <p className="font-semibold text-slate-800">{user?.className || '-'}</p>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Nama Sekolah</span>
                <p className="font-semibold text-slate-800">{settings.school_name || 'Sekolah CBT'}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 block text-[11px]">Mata Pelajaran</span>
                <p className="font-bold text-indigo-700 text-sm">{exam?.mata_pelajaran || '-'}</p>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Nama Ujian</span>
                <p className="font-bold text-slate-800">{exam?.nama_ujian || '-'}</p>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Waktu Pengumpulan</span>
                <p className="font-medium text-slate-700">{submissionTime}</p>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Total Butir Soal</span>
                <p className="font-bold text-slate-800">{exam?.total_questions || participant?.total_questions || '-'} Butir Soal</p>
              </div>
            </div>
          </div>

          {/* Official Privacy Notice (Tidak Tampilkan Hasil Pada Siswa) */}
          <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4.5 flex items-start gap-3.5">
            <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <h4 className="font-bold text-amber-900">Kebijakan Privasi & Hasil Nilai</h4>
              <p className="text-amber-800 leading-relaxed">
                Sesuai dengan ketentuan pelaksanaan ujian berbasis komputer (CBT), skor dan evaluasi lembar jawaban <strong>tidak ditampilkan langsung kepada peserta ujian</strong>. Rekapitulasi nilai akhir dan pengumuman kelulusan akan diinformasikan secara resmi oleh bapak/ibu guru atau panitia akademik.
              </p>
            </div>
          </div>

          {/* Card Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3 print:hidden">
            {canPrint && (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleDownloadPdf}
                  className="flex-1 font-bold bg-emerald-600 hover:bg-emerald-700 shadow-md"
                  icon={<Download className="w-5 h-5" />}
                >
                  Unduh Laporan PDF (jsPDF)
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handlePrint}
                  className="flex-1 font-bold"
                  icon={<Printer className="w-4 h-4" />}
                >
                  Cetak Tanda Terima
                </Button>
              </>
            )}
            <Button
              variant="secondary"
              size="lg"
              onClick={onBackToDashboard}
              className="flex-1 font-bold"
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Kembali ke Beranda
            </Button>
          </div>
        </div>

        {/* Card Footer Stamp */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Sistem CBT Sekolah Modern</span>
          <span>Arsip Digital Terenkripsi</span>
        </div>
      </div>
    </div>
  );
};
