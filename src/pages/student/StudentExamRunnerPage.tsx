import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Send,
  CheckCircle,
  AlertTriangle,
  Grid,
  Check,
  Save,
  Menu,
  X,
  School,
  Maximize2,
  Minimize2,
  Type,
  Flag,
  HelpCircle,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { QuestionItem } from '../../types';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Loading } from '../../components/ui/Loading';
import { toast } from '../../components/ui/Toast';
import { RichContent } from '../../components/ui/RichContent';

interface StudentExamRunnerPageProps {
  examId: string;
  onFinishExam: (examId: string) => void;
  onExit: () => void;
}

type TextSize = 'sm' | 'base' | 'lg';

export const StudentExamRunnerPage: React.FC<StudentExamRunnerPageProps> = ({
  examId,
  onFinishExam,
  onExit,
}) => {
  const { user, settings } = useAuth();
  const [examData, setExamData] = useState<any>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [navigatorFilter, setNavigatorFilter] = useState<'all' | 'unanswered' | 'flagged'>('all');
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [textSize, setTextSize] = useState<TextSize>('base');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load flagged status from local storage cache for CBT persistence
  useEffect(() => {
    try {
      const cachedFlags = localStorage.getItem(`cbt_flagged_${examId}`);
      if (cachedFlags) {
        setFlagged(JSON.parse(cachedFlags));
      }
    } catch (e) {
      // ignore
    }
  }, [examId]);

  const toggleFlagCurrent = () => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;
    setFlagged((prev) => {
      const next = { ...prev, [currentQ.id]: !prev[currentQ.id] };
      try {
        localStorage.setItem(`cbt_flagged_${examId}`, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  // Toggle Fullscreen mode
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Fetch Questions & saved state from server
  const loadExamState = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/student/exams/${examId}/questions`);
      if (res.success && res.data) {
        if (res.isTimeUp || res.data.participant_status === 'selesai') {
          toast.info('Sesi ujian telah selesai.');
          onFinishExam(examId);
          return;
        }

        setExamData(res.data.exam);
        setQuestions(res.data.questions || []);
        setAnswers(res.data.answers || {});
        setRemainingSeconds(res.data.remaining_seconds || 0);
      } else {
        toast.error(res.message || 'Gagal memuat soal ujian.');
        onExit();
      }
    } catch (e) {
      toast.error('Gagal terhubung ke server CBT.');
      onExit();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExamState();
  }, [examId]);

  // Countdown Timer
  useEffect(() => {
    if (remainingSeconds <= 0) return;

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [remainingSeconds]);

  // Auto submit when time runs out
  const handleAutoSubmit = async () => {
    toast.error('Waktu ujian telah berakhir! Sistem otomatis mengumpulkan lembar jawaban.');
    await doSubmitExam();
  };

  // Format seconds to HH:MM:SS
  const formatTime = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Handle Option Select & Save to Server
  const handleSelectAnswer = async (optionKey: 'A' | 'B' | 'C' | 'D' | 'E') => {
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion) return;

    // Optimistic state update
    const newAnswers = { ...answers, [currentQuestion.id]: optionKey };
    setAnswers(newAnswers);
    setSavingStatus('saving');

    try {
      const res = await apiRequest(`/api/student/exams/${examId}/answer`, {
        method: 'POST',
        body: JSON.stringify({
          question_id: currentQuestion.id,
          answer: optionKey,
          current_question_index: currentIndex,
        }),
      });

      if ((res as any).isTimeUp || (res as any).forceFinished) {
        toast.error(res.message || 'Sesi ujian telah diakhiri.');
        onFinishExam(examId);
        return;
      }

      setSavingStatus('saved');
      setTimeout(() => setSavingStatus('idle'), 1200);
    } catch (e) {
      setSavingStatus('idle');
      toast.error('Gagal menyimpan jawaban ke server.');
    }
  };

  // Periodic Auto-save Sync every 30 seconds to prevent data loss
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (loading || remainingSeconds <= 0) return;

    const syncInterval = setInterval(async () => {
      try {
        setIsSyncing(true);
        const res = await apiRequest(`/api/student/exams/${examId}/sync`, {
          method: 'POST',
          body: JSON.stringify({
            answers,
            current_question_index: currentIndex,
          }),
        });

        if ((res as any).forceFinished || (res as any).isTimeUp) {
          toast.error(res.message || 'Sesi ujian Anda telah diakhiri oleh pengawas.');
          clearInterval(syncInterval);
          onFinishExam(examId);
          return;
        }

        if (res.success) {
          const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLastSyncedTime(nowStr);
        }
      } catch (err) {
        // Silently retry on next auto-save
      } finally {
        setIsSyncing(false);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(syncInterval);
  }, [examId, answers, currentIndex, loading, remainingSeconds]);

  // Sync on tab switch or visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && Object.keys(answers).length > 0) {
        apiRequest(`/api/student/exams/${examId}/sync`, {
          method: 'POST',
          body: JSON.stringify({
            answers,
            current_question_index: currentIndex,
          }),
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [examId, answers, currentIndex]);

  // Clear answer for current question
  const handleClearAnswer = async () => {
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion || !answers[currentQuestion.id]) return;

    const newAnswers = { ...answers };
    delete newAnswers[currentQuestion.id];
    setAnswers(newAnswers);
    setSavingStatus('saving');

    try {
      await apiRequest(`/api/student/exams/${examId}/answer`, {
        method: 'POST',
        body: JSON.stringify({
          question_id: currentQuestion.id,
          answer: null,
        }),
      });
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus('idle'), 1000);
    } catch (e) {
      setSavingStatus('idle');
    }
  };

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if modal or inputs are open
      if (isSubmitModalOpen) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const key = e.key.toUpperCase();
      if (key === 'A' || key === 'B' || key === 'C' || key === 'D' || key === 'E') {
        handleSelectAnswer(key as 'A' | 'B' | 'C' | 'D' | 'E');
      } else if (key === 'R') {
        toggleFlagCurrent();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, questions, answers, isSubmitModalOpen]);

  // Submit Exam
  const doSubmitExam = async () => {
    setSubmitting(true);
    try {
      const res = await apiRequest(`/api/student/exams/${examId}/submit`, {
        method: 'POST',
      });

      if (res.success) {
        toast.success('Ujian berhasil dikumpulkan dan tersimpan!');
        setIsSubmitModalOpen(false);
        try {
          localStorage.removeItem(`cbt_flagged_${examId}`);
        } catch (e) {}
        onFinishExam(examId);
      } else {
        toast.error(res.message || 'Gagal mengumpulkan ujian.');
      }
    } catch (e) {
      toast.error('Gagal menghubungi server untuk pengumpulan ujian.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loading message="Mempersiapkan lembar ujian CBT Anda..." fullHeight />;
  }

  const currentQ = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).filter((qId) => !!answers[qId]).length;
  const flaggedCount = Object.keys(flagged).filter((qId) => !!flagged[qId]).length;
  const unansweredCount = totalQuestions - answeredCount;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const isUrgent = remainingSeconds < 300; // < 5 minutes
  const isCurrentFlagged = !!(currentQ && flagged[currentQ.id]);

  const currentOptions = currentQ
    ? [
        { key: 'A' as const, text: currentQ.opsi_a },
        { key: 'B' as const, text: currentQ.opsi_b },
        { key: 'C' as const, text: currentQ.opsi_c },
        ...(currentQ.opsi_d ? [{ key: 'D' as const, text: currentQ.opsi_d }] : []),
        ...(currentQ.opsi_e ? [{ key: 'E' as const, text: currentQ.opsi_e }] : []),
      ]
    : [];

  const textSizeClasses = {
    sm: {
      question: 'text-sm sm:text-base',
      option: 'text-xs sm:text-sm',
    },
    base: {
      question: 'text-base sm:text-lg',
      option: 'text-sm sm:text-base',
    },
    lg: {
      question: 'text-lg sm:text-xl',
      option: 'text-base sm:text-lg',
    },
  }[textSize];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none relative">
      {/* ======================================================== */}
      {/* PROMINENT FLOATING COUNTDOWN TIMER */}
      {/* ======================================================== */}
      <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 pointer-events-auto">
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl transition-all ${
            isUrgent
              ? 'bg-gradient-to-r from-rose-600 via-rose-700 to-red-600 text-white border-rose-400 shadow-rose-600/50 animate-pulse ring-4 ring-rose-300/40'
              : 'bg-slate-900/95 text-emerald-400 border-slate-700 backdrop-blur-md shadow-slate-900/30'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
              isUrgent ? 'bg-white/20 text-white' : 'bg-slate-800 text-emerald-400'
            }`}
          >
            <Clock className={`w-5 h-5 ${isUrgent ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
          </div>

          <div className="flex flex-col">
            <span
              className={`text-[10px] font-black uppercase tracking-wider ${
                isUrgent ? 'text-rose-100' : 'text-slate-400'
              }`}
            >
              {isUrgent ? '⚠️ Sisa Waktu (< 5 Menit)' : 'Sisa Waktu Ujian'}
            </span>
            <span className="font-mono font-black text-lg sm:text-xl tracking-tight leading-none">
              {formatTime(remainingSeconds)}
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* CBT HEADER BAR */}
      {/* ======================================================== */}
      <header className="bg-slate-900 text-white sticky top-0 z-40 shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          {/* School & Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shrink-0 shadow-md border border-indigo-400/30">
              <School className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                  CBT ANBK
                </span>
                <h1 className="text-sm sm:text-base font-extrabold truncate text-white">
                  {examData?.nama_ujian || 'Ujian CBT'}
                </h1>
              </div>
              <p className="text-xs text-slate-300 truncate mt-0.5">
                <span className="font-bold text-indigo-300">{examData?.mata_pelajaran}</span> • {user?.name} ({user?.className} - NIS: {user?.nis || user?.username})
              </p>
            </div>
          </div>

          {/* Tools & Timer */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Visual Progress Bar (Answered vs Total) */}
            <div className="hidden md:flex flex-col gap-1 min-w-[150px] lg:min-w-[200px]">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {answeredCount} / {totalQuestions} Terjawab
                </span>
                <span className="font-mono text-white font-black">{progressPercent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-teal-400 to-emerald-400 transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Font Size Adjuster */}
            <div className="hidden sm:flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
              <span className="text-[10px] text-slate-400 px-2 font-bold flex items-center gap-1">
                <Type className="w-3 h-3" /> Fon
              </span>
              <button
                type="button"
                onClick={() => setTextSize('sm')}
                className={`px-2 py-1 rounded font-bold transition-colors ${
                  textSize === 'sm' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Ukuran Fon Kecil"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setTextSize('base')}
                className={`px-2 py-1 rounded font-bold transition-colors ${
                  textSize === 'base' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Ukuran Fon Standar"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setTextSize('lg')}
                className={`px-2 py-1 rounded font-bold transition-colors ${
                  textSize === 'lg' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Ukuran Fon Besar"
              >
                A+
              </button>
            </div>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors hidden sm:flex items-center justify-center"
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh (Fullscreen)'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Sisa Waktu Ujian (Hitung Mundur) */}
            <div
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl border font-mono font-black text-sm sm:text-base tracking-tight shadow-inner ${
                isUrgent
                  ? 'bg-rose-950 text-rose-300 border-rose-500 animate-pulse'
                  : 'bg-slate-800 text-emerald-400 border-slate-700'
              }`}
            >
              <Clock className={`w-4 h-4 ${isUrgent ? 'text-rose-400' : 'text-emerald-400'}`} />
              <div className="flex flex-col leading-none">
                <span className="text-[9px] text-slate-400 font-sans font-semibold uppercase tracking-wider">
                  Sisa Waktu
                </span>
                <span>{formatTime(remainingSeconds)}</span>
              </div>
            </div>

            {/* Mobile palette toggle */}
            <button
              type="button"
              onClick={() => setMobilePaletteOpen(!mobilePaletteOpen)}
              className="lg:hidden p-2 rounded-xl bg-indigo-600 text-white shadow-xs font-bold flex items-center gap-1.5 text-xs"
            >
              <Grid className="w-4 h-4" />
              <span>Daftar Soal</span>
            </button>
          </div>
        </div>

        {/* Mobile Sub-Header Progress Bar */}
        <div className="md:hidden bg-slate-800 px-4 py-1.5 flex items-center justify-between gap-3 text-xs border-t border-slate-800">
          <div className="flex items-center gap-1.5 font-bold text-slate-200 text-[11px]">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Progres: {answeredCount} dari {totalQuestions} Terjawab</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-slate-900 rounded-full border border-slate-700 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="font-mono font-black text-emerald-400 text-[11px]">{progressPercent}%</span>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* MAIN EXAM RUNNER AREA */}
      {/* ======================================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* KOLOM LEMBAR SOAL (COL 8/12) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-8">
            {/* Question Top Header */}
            <div className="flex flex-wrap items-center justify-between pb-4 mb-5 border-b border-slate-100 gap-3">
              <div className="flex items-center gap-2.5">
                <span className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-black text-sm shadow-xs">
                  SOAL NO. {currentIndex + 1}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  dari {totalQuestions} Soal
                </span>
                {currentQ?.kategori && (
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg">
                    {currentQ.kategori}
                  </span>
                )}
                {isCurrentFlagged && (
                  <span className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    <Flag className="w-3 h-3 fill-amber-600 text-amber-600" />
                    Ragu-ragu
                  </span>
                )}
              </div>

              {/* Autosave Status & Reset Answer */}
              <div className="flex items-center gap-2 sm:gap-3 text-xs">
                {/* 30s Auto-Sync Periodic Indicator */}
                <div
                  className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200"
                  title="Jawaban otomatis disinkronkan ke server setiap 30 detik untuk mencegah data hilang"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isSyncing ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                  <span className="hidden sm:inline font-semibold text-slate-700">Auto-Save</span>
                  {lastSyncedTime && <span className="font-mono text-slate-400 text-[10px]">({lastSyncedTime})</span>}
                </div>
                {savingStatus === 'saving' && (
                  <span className="text-amber-600 font-semibold flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                    Menyimpan...
                  </span>
                )}
                {savingStatus === 'saved' && (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Tersimpan
                  </span>
                )}
                {savingStatus === 'idle' && answers[currentQ?.id] && (
                  <button
                    type="button"
                    onClick={handleClearAnswer}
                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                    title="Kosongkan pilihan Anda pada soal ini"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Pilihan</span>
                  </button>
                )}
              </div>
            </div>

            {/* Question Text */}
            <div className="mb-8">
              <RichContent
                content={currentQ?.pertanyaan || ''}
                className={`text-slate-900 font-medium leading-relaxed ${textSizeClasses.question}`}
              />
            </div>

            {/* Multiple Choice Options */}
            <div className="space-y-3.5">
              {currentOptions.map((opt) => {
                const isSelected = answers[currentQ?.id] === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleSelectAnswer(opt.key)}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-indigo-50/90 border-indigo-600 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs scale-105'
                          : 'bg-slate-100 text-slate-700 border border-slate-300 group-hover:bg-slate-200'
                      }`}
                    >
                      {opt.key}
                    </span>
                    <div className="flex-1 pt-1">
                      <RichContent
                        content={opt.text}
                        className={`leading-relaxed break-words ${textSizeClasses.option} ${
                          isSelected ? 'font-bold text-indigo-950' : 'text-slate-800'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ======================================================== */}
          {/* CBT ACTION FOOTER (PREV - RAGU-RAGU - NEXT) */}
          {/* ======================================================== */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            {/* Tombol Sebelumnya */}
            <Button
              variant="secondary"
              size="md"
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              icon={<ChevronLeft className="w-4 h-4" />}
            >
              Sebelumnya
            </Button>

            {/* Checkbox / Tombol RAGU-RAGU (Standard CBT / ANBK) */}
            <button
              type="button"
              onClick={toggleFlagCurrent}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                isCurrentFlagged
                  ? 'bg-amber-400 text-amber-950 border-amber-500 shadow-xs'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <input
                type="checkbox"
                checked={isCurrentFlagged}
                onChange={toggleFlagCurrent}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer pointer-events-none"
              />
              <Flag className={`w-4 h-4 ${isCurrentFlagged ? 'fill-amber-950' : ''}`} />
              <span>RAGU-RAGU</span>
            </button>

            {/* Tombol Berikutnya atau Selesai */}
            {currentIndex === totalQuestions - 1 ? (
              <Button
                variant="danger"
                size="md"
                onClick={() => setIsSubmitModalOpen(true)}
                className="font-bold bg-rose-600 hover:bg-rose-700 shadow-xs"
                icon={<Send className="w-4 h-4" />}
              >
                Selesai Ujian
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                className="font-bold bg-indigo-600 hover:bg-indigo-700 shadow-xs"
              >
                Berikutnya
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* PANEL PALET NOMOR SOAL (COL 4/12) */}
        {/* ======================================================== */}
        <div
          className={`lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 lg:sticky lg:top-20 ${
            mobilePaletteOpen
              ? 'fixed inset-x-4 top-20 z-50 shadow-2xl max-h-[80vh] overflow-y-auto'
              : 'hidden lg:block'
          }`}
        >
          {/* Header Panel Palet */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Grid className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">Daftar Nomor Soal</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                {progressPercent}% Selesai
              </span>
              {mobilePaletteOpen && (
                <button
                  type="button"
                  onClick={() => setMobilePaletteOpen(false)}
                  className="lg:hidden text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Navigator Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl mb-3 border border-slate-200/80 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setNavigatorFilter('all')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                navigatorFilter === 'all'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua ({totalQuestions})
            </button>
            <button
              type="button"
              onClick={() => setNavigatorFilter('unanswered')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                navigatorFilter === 'unanswered'
                  ? 'bg-rose-600 text-white shadow-xs font-black'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Kosong ({unansweredCount})
            </button>
            <button
              type="button"
              onClick={() => setNavigatorFilter('flagged')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                navigatorFilter === 'flagged'
                  ? 'bg-amber-400 text-amber-950 shadow-xs'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              Ragu ({flaggedCount})
            </button>
          </div>

          {/* Legenda Warna CBT Resmi */}
          <div className="grid grid-cols-3 gap-1.5 text-[10px] font-semibold text-slate-600 mb-3 bg-slate-50 p-2 rounded-xl border border-slate-200/70">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-emerald-600 shrink-0"></span>
              <span>Terisi ({answeredCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-400 shrink-0"></span>
              <span>Ragu ({flaggedCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-rose-100 border border-rose-300 shrink-0"></span>
              <span className="text-rose-700 font-bold">Kosong ({unansweredCount})</span>
            </div>
          </div>

          {/* Grid Tombol Soal */}
          <div className="grid grid-cols-5 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
            {questions.map((q, idx) => {
              const isAnswered = !!answers[q.id];
              const isFlag = !!flagged[q.id];
              const isCurrent = idx === currentIndex;

              // Filter condition
              if (navigatorFilter === 'unanswered' && isAnswered) return null;
              if (navigatorFilter === 'flagged' && !isFlag) return null;

              // Styling for buttons - Highlight unanswered questions clearly
              let btnStyle = 'bg-rose-50/80 text-rose-900 border-rose-200/90 hover:bg-rose-100/90 font-medium';
              if (isAnswered) {
                btnStyle = 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700';
              }
              if (isFlag) {
                btnStyle = 'bg-amber-400 text-amber-950 border-amber-500 font-bold hover:bg-amber-500';
              }
              if (isCurrent) {
                btnStyle += ' ring-3 ring-indigo-500 ring-offset-2 font-black shadow-md';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setCurrentIndex(idx);
                    setMobilePaletteOpen(false);
                  }}
                  className={`h-11 rounded-xl font-bold text-xs sm:text-sm border transition-all flex flex-col items-center justify-center relative cursor-pointer ${btnStyle}`}
                  title={!isAnswered ? 'Soal ini belum dijawab!' : `Jawaban: ${answers[q.id]}`}
                >
                  <span className="leading-none">{idx + 1}</span>
                  {isAnswered ? (
                    <span className={`text-[9px] font-mono leading-none mt-0.5 ${isFlag ? 'text-amber-950' : 'text-emerald-100'}`}>
                      {answers[q.id]}
                    </span>
                  ) : (
                    <span className="text-[8px] font-extrabold text-rose-600 leading-none mt-0.5">
                      KOSONG
                    </span>
                  )}
                  {/* Highlight indicator for unanswered question */}
                  {!isAnswered && (
                    <span className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
                  )}
                  {isFlag && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-600 border border-white" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Finish Button */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSubmitModalOpen(true)}
              className="w-full text-rose-600 border-rose-200 hover:bg-rose-50 font-bold"
              icon={<Send className="w-3.5 h-3.5" />}
            >
              Kumpulkan Ujian Sekarang
            </Button>
          </div>
        </div>
      </main>

      {/* ======================================================== */}
      {/* MODAL KONFIRMASI PENGUMPULAN UJIAN (CBT SUBMIT MODAL) */}
      {/* ======================================================== */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Kumpulkan Lembar Jawaban Ujian?"
        subtitle="Konfirmasi pengakhiran pengerjaan CBT"
        maxWidth="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsSubmitModalOpen(false)}
              disabled={submitting}
            >
              Kembali Mengerjakan
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={doSubmitExam}
              disabled={!confirmCheckbox || submitting}
              loading={submitting}
              icon={<CheckCircle className="w-4 h-4" />}
            >
              KUMPULKAN & AKHIRI
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          {/* Warning Notices */}
          {flaggedCount > 0 && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Perhatian:</strong> Terdapat <strong>{flaggedCount} butir soal</strong> yang masih bertanda <span className="underline font-bold">Ragu-ragu</span>. Pastikan Anda telah meninjau kembali sebelum mengumpulkan.
              </div>
            </div>
          )}

          {unansweredCount > 0 && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Peringatan:</strong> Masih terdapat <strong>{unansweredCount} butir soal</strong> yang belum Anda jawab sama sekali!
              </div>
            </div>
          )}

          {/* Rekapitulasi Status */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-3 gap-3 text-center text-xs">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Terjawab</span>
              <span className="text-lg font-black text-emerald-600 font-mono">{answeredCount}</span>
              <span className="text-[10px] text-slate-400 block">/ {totalQuestions}</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Ragu-Ragu</span>
              <span className="text-lg font-black text-amber-600 font-mono">{flaggedCount}</span>
              <span className="text-[10px] text-slate-400 block">Soal</span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Kosong</span>
              <span className="text-lg font-black text-rose-600 font-mono">{unansweredCount}</span>
              <span className="text-[10px] text-slate-400 block">Soal</span>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Setelah dikumpulkan, sesi pengerjaan ujian Anda akan ditutup secara permanen dan seluruh lembar jawaban disimpan di server. Anda tidak dapat membuka kembali ujian ini.
          </p>

          {/* Checkbox Persetujuan */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-indigo-50/60 border border-indigo-200/80 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmCheckbox}
              onChange={(e) => setConfirmCheckbox(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 mt-0.5 cursor-pointer"
            />
            <span className="text-xs text-indigo-950 font-medium leading-snug">
              Saya yakin telah menyelesaikan pengerjaan ujian ini dengan jujur dan bersedia mengumpulkan lembar jawaban ke server.
            </span>
          </label>
        </div>
      </Modal>
    </div>
  );
};
