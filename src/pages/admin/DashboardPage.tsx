import React, { useState, useEffect } from 'react';
import {
  Users,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  PlayCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ArrowUpRight,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Award,
  Layers,
  Percent,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import { apiRequest } from '../../services/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExamItem } from '../../types';

interface DashboardStats {
  totalStudents: number;
  totalClasses: number;
  totalQuestionBanks: number;
  totalExams: number;
  activeExamsCount: number;
}

interface AnalyticsData {
  scoreDistribution: {
    range: string;
    label: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  classAverages: {
    id: string;
    nama_kelas: string;
    tingkat: string;
    total_students: number;
    finished_count: number;
    avg_score: number;
    max_score: number;
    min_score: number;
  }[];
  examPerformances: {
    id: string;
    nama_ujian: string;
    mata_pelajaran: string;
    nama_kelas: string;
    finished_count: number;
    avg_score: number;
    max_score: number;
    min_score: number;
  }[];
  summary: {
    overallAvg: number;
    highestScore: number;
    lowestScore: number;
    passRate: number;
    totalFinishedSubmissions: number;
  };
}

interface DashboardPageProps {
  onNavigate: (tab: string, paramId?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [examsToday, setExamsToday] = useState<ExamItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChartTab, setActiveChartTab] = useState<'all' | 'histogram' | 'classes'>('all');

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/admin/dashboard');
      if (res.success) {
        const data = res as any;
        setStats(data.stats);
        setAnalytics(data.analytics || null);
        setExamsToday(data.examsToday || []);
        setRecentActivity(data.recentActivity || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading && !stats) {
    return <Loading message="Memuat ringkasan dashboard..." fullHeight />;
  }

  const statCards = [
    {
      title: 'Total Siswa',
      value: stats?.totalStudents || 0,
      icon: Users,
      color: 'bg-blue-50 text-blue-600 border-blue-200',
      actionTab: 'students',
    },
    {
      title: 'Total Kelas',
      value: stats?.totalClasses || 0,
      icon: GraduationCap,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      actionTab: 'classes',
    },
    {
      title: 'Total Bank Soal',
      value: stats?.totalQuestionBanks || 0,
      icon: BookOpen,
      color: 'bg-amber-50 text-amber-600 border-amber-200',
      actionTab: 'question-banks',
    },
    {
      title: 'Total Ujian',
      value: stats?.totalExams || 0,
      icon: CalendarCheck,
      color: 'bg-purple-50 text-purple-600 border-purple-200',
      actionTab: 'exams',
    },
    {
      title: 'Ujian Aktif',
      value: stats?.activeExamsCount || 0,
      icon: PlayCircle,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
      actionTab: 'exams',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Hero Banner with Orange Gradient Panel (#ffb646 to #ffb43e) */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#ffb646] via-[#f99e22] to-[#ffb43e] p-6 rounded-2xl border border-amber-300/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-slate-950">
        {/* Background decorative glass circles */}
        <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full bg-white/10 pointer-events-none border border-white/20" />
        <div className="absolute left-1/3 -top-10 w-32 h-32 rounded-full bg-amber-300/20 pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-slate-950/90 text-amber-300 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-wider border border-slate-900">
              Panel Kontrol Admin
            </span>
            <span className="text-xs font-semibold text-slate-900/80">CBT Ujian Online</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">Ringkasan Sistem CBT</h2>
          <p className="text-xs sm:text-sm font-medium text-slate-900/80 mt-0.5 max-w-xl">
            Monitoring pelaksanaan ujian, analitik nilai, dan pengelolaan data akademik sekolah
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            loading={loading}
            className="bg-white/90 hover:bg-white text-slate-900 border-amber-300 shadow-2xs font-bold"
            icon={<RefreshCw className="w-3.5 h-3.5 text-slate-800" />}
          >
            Segarkan
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('exams')}
            className="bg-slate-950 hover:bg-slate-900 text-white border border-slate-900 shadow-sm font-bold"
            icon={<PlayCircle className="w-3.5 h-3.5 text-amber-400" />}
          >
            Buat Ujian Baru
          </Button>
        </div>
      </div>

      {/* 5 Key Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={i}
              onClick={() => onNavigate(c.actionTab)}
              className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">
                  {c.title}
                </span>
                <div className={`p-2 rounded-lg border ${c.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900 tracking-tight">{c.value}</span>
                <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
              </div>
            </div>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* SECTION: DASBOR ANALITIK (HISTOGRAM & RATA-RATA KELAS) */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-6">
        {/* Header & View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  Dasbor Analitik Hasil Ujian
                </h3>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                  Grafik Interaktif
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Distribusi nilai siswa (histogram) dan performa rata-rata capaian antarkelas
              </p>
            </div>
          </div>

          {/* Tab Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setActiveChartTab('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeChartTab === 'all'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Grafik
            </button>
            <button
              onClick={() => setActiveChartTab('histogram')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeChartTab === 'histogram'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Distribusi (Histogram)
            </button>
            <button
              onClick={() => setActiveChartTab('classes')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeChartTab === 'classes'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rata-Rata Kelas
            </button>
          </div>
        </div>

        {/* Aggregate Summary Mini Cards */}
        {analytics && analytics.summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Rata-Rata Nilai
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-indigo-600 font-mono">
                  {analytics.summary.overallAvg}
                </span>
                <span className="text-[11px] text-slate-400">/ 100</span>
              </div>
            </div>

            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Ketuntasan (KKM ≥ 75)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-emerald-600 font-mono">
                  {analytics.summary.passRate}%
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold">Tuntas</span>
              </div>
            </div>

            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Tertinggi / Terendah
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-black text-slate-800 font-mono">
                  {analytics.summary.highestScore}
                </span>
                <span className="text-slate-400">/</span>
                <span className="text-xl font-bold text-rose-600 font-mono">
                  {analytics.summary.lowestScore}
                </span>
              </div>
            </div>

            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Jawaban Selesai
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {analytics.summary.totalFinishedSubmissions}
                </span>
                <span className="text-[11px] text-slate-500">Siswa</span>
              </div>
            </div>
          </div>
        )}

        {/* Charts Container */}
        {analytics?.summary?.totalFinishedSubmissions === 0 ? (
          <div className="bg-slate-50 rounded-xl p-8 text-center border border-dashed border-slate-200">
            <BarChart3 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <h4 className="font-bold text-slate-700 text-sm">Belum Ada Data Nilai Ujian</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Grafik distribusi nilai (histogram) dan rata-rata kelas akan otomatis digambar setelah siswa
              mulai mengumpulkan lembar jawaban ujian CBT.
            </p>
          </div>
        ) : (
          <div
            className={`grid gap-6 ${
              activeChartTab === 'all'
                ? 'grid-cols-1 lg:grid-cols-2'
                : 'grid-cols-1'
            }`}
          >
            {/* CHART 1: HISTOGRAM DISTRIBUSI NILAI */}
            {(activeChartTab === 'all' || activeChartTab === 'histogram') && (
              <div className="bg-slate-50/50 p-4 sm:p-5 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-indigo-600" />
                      Distribusi Nilai Siswa (Histogram)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Sebaran frekuensi rentang nilai siswa pada ujian yang telah selesai
                    </p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    Total: {analytics?.summary?.totalFinishedSubmissions || 0} Siswa
                  </span>
                </div>

                <div className="h-64 sm:h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics?.scoreDistribution || []}
                      margin={{ top: 15, right: 15, left: -10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="range"
                        tick={{ fontSize: 11, fill: '#475569' }}
                        interval={0}
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#475569' }}
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(241, 245, 249, 0.7)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-200 text-xs space-y-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: data.color }}
                                  />
                                  <span className="font-bold text-slate-900">
                                    Rentang: {data.range}
                                  </span>
                                </div>
                                <p className="text-slate-600 font-medium">
                                  Kategori: <span className="font-bold text-slate-800">{data.label}</span>
                                </p>
                                <p className="text-slate-600 font-medium">
                                  Jumlah: <span className="font-bold text-indigo-600">{data.count} Siswa</span> ({data.percentage}%)
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {(analytics?.scoreDistribution || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Histogram Legend Tiers */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-200 text-center">
                  {(analytics?.scoreDistribution || []).map((bucket, i) => (
                    <div key={i} className="p-2 rounded-lg bg-white border border-slate-100 shadow-2xs">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: bucket.color }} />
                        <span className="text-[10px] font-bold text-slate-700">{bucket.range}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900 block">{bucket.count} Siswa</span>
                      <span className="text-[10px] text-slate-400 font-medium">{bucket.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CHART 2: RATA-RATA NILAI PER KELAS */}
            {(activeChartTab === 'all' || activeChartTab === 'classes') && (
              <div className="bg-slate-50/50 p-4 sm:p-5 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-indigo-600" />
                      Rata-Rata Nilai per Kelas
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Perbandingan rata-rata capaian skor ujian di setiap kelas dengan standar KKM (75)
                    </p>
                  </div>
                  <span className="text-xs text-indigo-600 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                    Standar KKM: 75
                  </span>
                </div>

                <div className="h-64 sm:h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics?.classAverages || []}
                      margin={{ top: 15, right: 15, left: -10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="nama_kelas"
                        tick={{ fontSize: 11, fill: '#475569' }}
                        interval={0}
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: '#475569' }}
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(241, 245, 249, 0.7)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-200 text-xs space-y-1">
                                <p className="font-bold text-slate-900 text-sm">{data.nama_kelas}</p>
                                <p className="text-slate-600">
                                  Rata-Rata Nilai:{' '}
                                  <span className="font-extrabold text-indigo-600 font-mono text-sm">
                                    {data.avg_score}
                                  </span>
                                </p>
                                <p className="text-slate-500">
                                  Peserta Selesai: <span className="font-semibold text-slate-800">{data.finished_count}</span> dari {data.total_students} siswa
                                </p>
                                <div className="flex gap-3 pt-1 border-t border-slate-100 text-[11px]">
                                  <span className="text-emerald-700">Max: {data.max_score}</span>
                                  <span className="text-rose-700">Min: {data.min_score}</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine
                        y={75}
                        stroke="#6366f1"
                        strokeDasharray="4 4"
                        label={{
                          value: 'KKM 75',
                          fill: '#4f46e5',
                          fontSize: 10,
                          position: 'insideTopRight',
                          fontWeight: 'bold',
                        }}
                      />
                      <Bar dataKey="avg_score" fill="#6366f1" radius={[6, 6, 0, 0]}>
                        {(analytics?.classAverages || []).map((entry, index) => (
                          <Cell
                            key={`cls-${index}`}
                            fill={entry.avg_score >= 75 ? '#4f46e5' : '#f59e0b'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Class Quick Badges */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                      <span className="w-2.5 h-2.5 rounded bg-indigo-600 inline-block" />
                      Tuntas (≥ 75)
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                      <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />
                      Di Bawah KKM (&lt; 75)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate('classes')}
                    className="text-indigo-600 hover:text-indigo-700 text-xs p-0 h-auto"
                  >
                    Kelola Kelas &rarr;
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section: Ujian Hari Ini */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-indigo-600" />
            <span>Ujian Hari Ini</span>
          </div>
        }
        subtitle="Daftar jadwal ujian yang berlangsung pada tanggal hari ini"
        action={
          <Button variant="ghost" size="sm" onClick={() => onNavigate('exams')}>
            Lihat Semua Jadwal
          </Button>
        }
        noPadding
      >
        {examsToday.length === 0 ? (
          <EmptyState
            title="Tidak Ada Ujian Hari Ini"
            description="Belum ada jadwal ujian yang diset untuk tanggal hari ini."
            actionText="Jadwalkan Ujian"
            onAction={() => onNavigate('exams')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200/80">
                <tr>
                  <th className="px-5 py-3">Nama Ujian</th>
                  <th className="px-4 py-3">Mata Pelajaran</th>
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3">Waktu & Durasi</th>
                  <th className="px-4 py-3">Token</th>
                  <th className="px-4 py-3">Peserta</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {examsToday.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{exam.nama_ujian}</td>
                    <td className="px-4 py-3.5 text-slate-600">{exam.mata_pelajaran}</td>
                    <td className="px-4 py-3.5">
                      <Badge variant="indigo">{exam.nama_kelas || 'Semua'}</Badge>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{exam.waktu_mulai} - {exam.waktu_selesai}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">({exam.durasi_menit} Menit)</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono font-bold text-xs bg-slate-100 text-indigo-700 px-2.5 py-1 rounded-md border border-slate-300">
                        {exam.token}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      <span className="font-semibold text-slate-900">{exam.finished_participants || 0}</span>
                      <span className="text-slate-400"> / {exam.total_participants || 0} Selesai</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        variant={
                          exam.status === 'aktif'
                            ? 'success'
                            : exam.status === 'draft'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {exam.status === 'aktif' ? 'Aktif' : exam.status === 'draft' ? 'Draft' : 'Selesai'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onNavigate('exam-detail', exam.id)}
                      >
                        Lihat Hasil
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Section: Aktivitas Peserta Terbaru */}
      {recentActivity.length > 0 && (
        <Card
          title="Aktivitas Pengerjaan Ujian Terbaru"
          subtitle="Aktivitas langsung siswa saat memulai atau menyelesaikan ujian"
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200/80">
                <tr>
                  <th className="px-5 py-3">NIS</th>
                  <th className="px-4 py-3">Nama Siswa</th>
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3">Ujian</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Nilai Akhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentActivity.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50/60 transition-colors text-xs sm:text-sm">
                    <td className="px-5 py-3 font-mono font-medium text-slate-600">{act.nis}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{act.student_name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral">{act.nama_kelas}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-700 truncate max-w-xs">{act.nama_ujian}</td>
                    <td className="px-4 py-3">
                      {act.status === 'selesai' ? (
                        <Badge variant="success">Selesai</Badge>
                      ) : (
                        <Badge variant="warning">Mengerjakan</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {act.status === 'selesai' ? (
                        <span className="text-indigo-600 font-mono text-sm">{act.score}</span>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
