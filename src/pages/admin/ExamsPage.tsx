import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  CalendarCheck,
  Edit2,
  Trash2,
  KeyRound,
  RefreshCw,
  Copy,
  Clock,
  CheckCircle2,
  Users,
  Eye,
  FileBarChart2,
  Radio,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { ExamItem, ClassItem, QuestionBankItem } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Badge } from '../../components/ui/Badge';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { toast } from '../../components/ui/Toast';

interface ExamsPageProps {
  onSelectExam: (id: string) => void;
}

export const ExamsPage: React.FC<ExamsPageProps> = ({ onSelectExam }) => {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [questionBanks, setQuestionBanks] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nama_ujian: '',
    mata_pelajaran: '',
    class_id: '',
    question_bank_id: '',
    tanggal: new Date().toISOString().split('T')[0],
    waktu_mulai: '07:30',
    waktu_selesai: '09:30',
    durasi_menit: 60,
    token: '',
    shuffle_questions: 0,
    shuffle_answers: 0,
    tampilkan_nilai: 1,
    status: 'aktif' as 'draft' | 'aktif' | 'selesai',
  });
  const [formLoading, setFormLoading] = useState(false);

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<ExamItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchDependencies = async () => {
    try {
      const [resClasses, resBanks] = await Promise.all([
        apiRequest<ClassItem[]>('/api/classes'),
        apiRequest<QuestionBankItem[]>('/api/question-banks'),
      ]);
      if (resClasses.success && resClasses.data) setClasses(resClasses.data);
      if (resBanks.success && resBanks.data) setQuestionBanks(resBanks.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchExams = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<ExamItem[]>('/api/exams');
      if (res.success && res.data) {
        setExams(res.data);
      }
    } catch (e) {
      toast.error('Gagal mengambil daftar ujian.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDependencies();
    fetchExams();
  }, []);

  const generateRandomToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = '';
    for (let i = 0; i < 6; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      nama_ujian: '',
      mata_pelajaran: '',
      class_id: classes[0]?.id || '',
      question_bank_id: questionBanks[0]?.id || '',
      tanggal: new Date().toISOString().split('T')[0],
      waktu_mulai: '07:30',
      waktu_selesai: '10:00',
      durasi_menit: 60,
      token: generateRandomToken(),
      shuffle_questions: 0,
      shuffle_answers: 0,
      tampilkan_nilai: 1,
      status: 'aktif',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (exam: ExamItem) => {
    setEditingId(exam.id);
    setFormData({
      nama_ujian: exam.nama_ujian,
      mata_pelajaran: exam.mata_pelajaran,
      class_id: exam.class_id,
      question_bank_id: exam.question_bank_id,
      tanggal: exam.tanggal,
      waktu_mulai: exam.waktu_mulai,
      waktu_selesai: exam.waktu_selesai,
      durasi_menit: exam.durasi_menit,
      token: exam.token,
      shuffle_questions: exam.shuffle_questions,
      shuffle_answers: exam.shuffle_answers,
      tampilkan_nilai: exam.tampilkan_nilai,
      status: exam.status,
    });
    setModalOpen(true);
  };

  const getDayNameIndonesian = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return '';
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return days[date.getDay()];
  };

  const handleBankSelectChange = (bankId: string) => {
    const selected = questionBanks.find((b) => b.id === bankId);
    setFormData((prev) => ({
      ...prev,
      question_bank_id: bankId,
      mata_pelajaran: selected?.mata_pelajaran || prev.mata_pelajaran,
      class_id: selected?.kelas_id || prev.class_id || (classes[0]?.id || ''),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.nama_ujian.trim() ||
      !formData.mata_pelajaran.trim() ||
      !formData.class_id ||
      !formData.question_bank_id ||
      !formData.tanggal ||
      !formData.waktu_mulai ||
      !formData.waktu_selesai ||
      !formData.durasi_menit
    ) {
      toast.error('Harap lengkapi semua kolom jadwal ujian.');
      return;
    }

    setFormLoading(true);
    try {
      const endpoint = editingId ? `/api/exams/${editingId}` : '/api/exams';
      const method = editingId ? 'PUT' : 'POST';
      const res = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(formData),
      });

      if (res.success) {
        toast.success(res.message || 'Jadwal ujian berhasil disimpan.');
        setModalOpen(false);
        fetchExams();
      } else {
        toast.error(res.message || 'Gagal menyimpan ujian.');
      }
    } catch (e) {
      toast.error('Terjadi kesalahan sistem.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleRegenerateToken = async (examId: string) => {
    try {
      const res = await apiRequest<{ token: string }>(`/api/exams/${examId}/regenerate-token`, {
        method: 'POST',
      });
      if (res.success) {
        toast.success(`Token baru: ${res.token}`);
        fetchExams();
      } else {
        toast.error(res.message || 'Gagal meregenerate token.');
      }
    } catch (e) {
      toast.error('Gagal meregenerate token.');
    }
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast.success(`Token "${token}" disalin ke papan klip.`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await apiRequest(`/api/exams/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.success) {
        toast.success('Jadwal ujian berhasil dihapus.');
        setDeleteTarget(null);
        fetchExams();
      } else {
        toast.error(res.message || 'Gagal menghapus ujian.');
      }
    } catch (e) {
      toast.error('Gagal menghapus ujian.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredExams = exams.filter(
    (e) =>
      e.nama_ujian.toLowerCase().includes(search.toLowerCase()) ||
      e.mata_pelajaran.toLowerCase().includes(search.toLowerCase()) ||
      (e.nama_kelas && e.nama_kelas.toLowerCase().includes(search.toLowerCase())) ||
      e.token.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Jadwal & Token Ujian</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Atur jadwal pelaksanaan ujian CBT, generate token peserta, dan monitoring kelulusan
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenAdd} icon={<Plus className="w-4 h-4" />}>
          Buat Jadwal Ujian
        </Button>
      </div>

      {/* Filter Card */}
      <Card noPadding>
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Cari judul ujian, mapel, kelas, token..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total {filteredExams.length} Jadwal Ujian
          </span>
        </div>

        {loading ? (
          <Loading message="Memuat jadwal ujian..." />
        ) : filteredExams.length === 0 ? (
          <EmptyState
            title="Tidak Ada Jadwal Ujian"
            description={
              search
                ? `Tidak ditemukan ujian yang cocok dengan kata kunci "${search}".`
                : 'Belum ada jadwal ujian yang dibuat. Silakan buat jadwal ujian baru.'
            }
            actionText={!search ? 'Buat Ujian Baru' : undefined}
            onAction={!search ? handleOpenAdd : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Nama Ujian & Mapel</th>
                  <th className="px-4 py-3.5">Kelas</th>
                  <th className="px-4 py-3.5">Tanggal & Jam</th>
                  <th className="px-4 py-3.5">Durasi</th>
                  <th className="px-4 py-3.5">Token Ujian</th>
                  <th className="px-4 py-3.5">Partisipasi</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <p
                        onClick={() => onSelectExam(exam.id)}
                        className="font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer"
                      >
                        {exam.nama_ujian}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{exam.mata_pelajaran}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant="indigo">{exam.nama_kelas || 'Semua'}</Badge>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      <div className="font-semibold text-slate-800">{exam.tanggal}</div>
                      <div className="text-slate-500 mt-0.5">
                        {exam.waktu_mulai} - {exam.waktu_selesai}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-semibold text-slate-700">
                      {exam.durasi_menit} Menit
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-indigo-700 px-2.5 py-1 rounded-md border border-slate-300">
                          {exam.token}
                        </span>
                        <button
                          onClick={() => handleCopyToken(exam.token)}
                          title="Salin Token"
                          className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRegenerateToken(exam.id)}
                          title="Regenerate Token"
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      <span className="font-bold text-slate-900">{exam.finished_participants || 0}</span>
                      <span className="text-slate-500"> / {exam.total_participants || 0} Selesai</span>
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
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onSelectExam(exam.id)}
                          className={exam.status === 'aktif' ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 font-semibold' : ''}
                          icon={exam.status === 'aktif' ? <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" /> : <FileBarChart2 className="w-3.5 h-3.5" />}
                        >
                          {exam.status === 'aktif' ? 'Monitoring Live' : 'Hasil Ujian'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(exam)}
                          title="Edit Jadwal"
                        >
                          <Edit2 className="w-4 h-4 text-slate-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(exam)}
                          title="Hapus Ujian"
                          className="hover:bg-rose-50 text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Exam Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Jadwal Ujian' : 'Buat Jadwal Ujian Baru'}
        subtitle="Tentukan kelas peserta, bank soal rujukan, durasi pengerjaan, dan token ujian"
        maxWidth="2xl"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit} loading={formLoading}>
              {editingId ? 'Perbarui Jadwal' : 'Simpan & Terbitkan Jadwal'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nama Ujian"
            placeholder="Contoh: Penilaian Akhir Semester Ganjil"
            value={formData.nama_ujian}
            onChange={(e) => setFormData({ ...formData, nama_ujian: e.target.value })}
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Pilih Bank Soal"
              value={formData.question_bank_id}
              onChange={(e) => handleBankSelectChange(e.target.value)}
              options={questionBanks.map((b) => ({
                value: b.id,
                label: `${b.nama_bank} (${b.mata_pelajaran})`,
              }))}
              placeholder="-- Pilih Bank Soal --"
              required
            />

            <Select
              label="Kelas Peserta"
              value={formData.class_id}
              onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
              options={classes.map((c) => ({ value: c.id, label: c.nama_kelas }))}
              placeholder="-- Pilih Kelas --"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Mata Pelajaran"
              placeholder="Contoh: Matematika"
              value={formData.mata_pelajaran}
              onChange={(e) => setFormData({ ...formData, mata_pelajaran: e.target.value })}
              required
            />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Hari & Tanggal Pelaksanaan
              </label>
              <div className="space-y-1">
                <input
                  type="date"
                  value={formData.tanggal}
                  onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                  className="block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  required
                />
                {formData.tanggal && (
                  <span className="text-[11px] font-bold text-indigo-600 block">
                    Hari {getDayNameIndonesian(formData.tanggal)}, {formData.tanggal}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Jam Mulai"
              type="time"
              value={formData.waktu_mulai}
              onChange={(e) => setFormData({ ...formData, waktu_mulai: e.target.value })}
              required
            />
            <Input
              label="Jam Akhir (Selesai)"
              type="time"
              value={formData.waktu_selesai}
              onChange={(e) => setFormData({ ...formData, waktu_selesai: e.target.value })}
              required
            />
            <Input
              label="Durasi (Menit)"
              type="number"
              min="5"
              max="300"
              value={formData.durasi_menit}
              onChange={(e) => setFormData({ ...formData, durasi_menit: parseInt(e.target.value) || 60 })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Token Ujian
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.token}
                  onChange={(e) => setFormData({ ...formData, token: e.target.value.toUpperCase() })}
                  className="block w-full font-mono uppercase font-bold tracking-wider rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  required
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setFormData({ ...formData, token: generateRandomToken() })}
                  title="Generate Token Acak"
                >
                  Acak
                </Button>
              </div>
            </div>

            <Select
              label="Status Ujian"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              options={[
                { value: 'aktif', label: 'Aktif (Dapat Dikerjakan)' },
                { value: 'draft', label: 'Draft (Disembunyikan)' },
                { value: 'selesai', label: 'Selesai (Ditutup)' },
              ]}
            />
          </div>

          {/* Configuration Toggles */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.shuffle_questions === 1}
                onChange={(e) =>
                  setFormData({ ...formData, shuffle_questions: e.target.checked ? 1 : 0 })
                }
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <span>Acak Urutan Soal (Shuffle Questions)</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.shuffle_answers === 1}
                onChange={(e) =>
                  setFormData({ ...formData, shuffle_answers: e.target.checked ? 1 : 0 })
                }
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <span>Acak Urutan Pilihan Jawaban (Shuffle Choices)</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.tampilkan_nilai === 1}
                onChange={(e) =>
                  setFormData({ ...formData, tampilkan_nilai: e.target.checked ? 1 : 0 })
                }
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <span>Tampilkan Nilai & Skor ke Siswa setelah Ujian Selesai</span>
            </label>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Jadwal Ujian?"
        message={
          <span>
            Apakah Anda yakin ingin menghapus jadwal ujian{' '}
            <strong className="text-slate-900 font-bold">{deleteTarget?.nama_ujian}</strong>? Semua
            riwayat nilai dan jawaban peserta akan ikut terhapus.
          </span>
        }
        confirmText="Ya, Hapus Ujian"
        loading={deleteLoading}
      />
    </div>
  );
};
