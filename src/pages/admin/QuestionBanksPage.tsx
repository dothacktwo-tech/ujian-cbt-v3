import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  BookOpen,
  Edit2,
  Trash2,
  ArrowRight,
  HelpCircle,
  GraduationCap,
  CalendarCheck,
  Clock,
  KeyRound,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { QuestionBankItem, ClassItem } from '../../types';
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

interface QuestionBanksPageProps {
  onSelectBank: (id: string) => void;
  onNavigateToExams?: () => void;
}

export const QuestionBanksPage: React.FC<QuestionBanksPageProps> = ({
  onSelectBank,
  onNavigateToExams,
}) => {
  const [banks, setBanks] = useState<QuestionBankItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');

  // Form Modal Bank Soal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nama_bank: '',
    mata_pelajaran: '',
    kelas_id: '',
    deskripsi: '',
    status: 'aktif' as 'aktif' | 'nonaktif',
  });
  const [formLoading, setFormLoading] = useState(false);

  // Schedule Exam Modal from Bank Soal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleBank, setScheduleBank] = useState<QuestionBankItem | null>(null);
  const [scheduleFormData, setScheduleFormData] = useState({
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
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<QuestionBankItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchClasses = async () => {
    try {
      const res = await apiRequest<ClassItem[]>('/api/classes');
      if (res.success && res.data) setClasses(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBanks = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<QuestionBankItem[]>('/api/question-banks');
      if (res.success && res.data) {
        setBanks(res.data);
      }
    } catch (e) {
      toast.error('Gagal mengambil data bank soal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
    fetchBanks();
  }, []);

  const generateRandomToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = '';
    for (let i = 0; i < 6; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  const getDayNameIndonesian = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return '';
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return days[date.getDay()];
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      nama_bank: '',
      mata_pelajaran: '',
      kelas_id: '',
      deskripsi: '',
      status: 'aktif',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (bank: QuestionBankItem) => {
    setEditingId(bank.id);
    setFormData({
      nama_bank: bank.nama_bank,
      mata_pelajaran: bank.mata_pelajaran,
      kelas_id: bank.kelas_id || '',
      deskripsi: bank.deskripsi || '',
      status: bank.status,
    });
    setModalOpen(true);
  };

  const handleOpenScheduleFromBank = (bank: QuestionBankItem) => {
    setScheduleBank(bank);
    const today = new Date().toISOString().split('T')[0];
    setScheduleFormData({
      nama_ujian: `Ujian ${bank.mata_pelajaran} - ${bank.nama_bank}`,
      mata_pelajaran: bank.mata_pelajaran,
      class_id: bank.kelas_id || (classes[0]?.id || ''),
      question_bank_id: bank.id,
      tanggal: today,
      waktu_mulai: '07:30',
      waktu_selesai: '09:30',
      durasi_menit: 60,
      token: generateRandomToken(),
      shuffle_questions: 0,
      shuffle_answers: 0,
      tampilkan_nilai: 1,
      status: 'aktif',
    });
    setScheduleModalOpen(true);
  };

  const handleSubmitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !scheduleFormData.nama_ujian.trim() ||
      !scheduleFormData.class_id ||
      !scheduleFormData.tanggal ||
      !scheduleFormData.waktu_mulai ||
      !scheduleFormData.waktu_selesai ||
      !scheduleFormData.token.trim()
    ) {
      toast.error('Harap lengkapi semua kolom jadwal ujian.');
      return;
    }

    setScheduleLoading(true);
    try {
      const res = await apiRequest('/api/exams', {
        method: 'POST',
        body: JSON.stringify(scheduleFormData),
      });

      if (res.success) {
        toast.success(`Jadwal ujian "${scheduleFormData.nama_ujian}" berhasil diterbitkan! Token: ${scheduleFormData.token}`);
        setScheduleModalOpen(false);
        if (onNavigateToExams) {
          onNavigateToExams();
        }
      } else {
        toast.error(res.message || 'Gagal membuat jadwal ujian.');
      }
    } catch (e) {
      toast.error('Terjadi kesalahan sistem.');
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama_bank.trim() || !formData.mata_pelajaran.trim()) {
      toast.error('Nama bank soal dan mata pelajaran wajib diisi.');
      return;
    }

    setFormLoading(true);
    try {
      const endpoint = editingId ? `/api/question-banks/${editingId}` : '/api/question-banks';
      const method = editingId ? 'PUT' : 'POST';
      const res = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(formData),
      });

      if (res.success) {
        toast.success(res.message || 'Bank soal berhasil disimpan.');
        setModalOpen(false);
        fetchBanks();
      } else {
        toast.error(res.message || 'Gagal menyimpan bank soal.');
      }
    } catch (e) {
      toast.error('Terjadi kesalahan sistem.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await apiRequest(`/api/question-banks/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.success) {
        toast.success('Bank soal berhasil dihapus.');
        setDeleteTarget(null);
        fetchBanks();
      } else {
        toast.error(res.message || 'Gagal menghapus bank soal.');
      }
    } catch (e) {
      toast.error('Gagal menghapus bank soal.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const uniqueSubjects = Array.from(new Set(banks.map((b) => b.mata_pelajaran))).filter(Boolean);

  const filteredBanks = banks.filter((b) => {
    const matchSearch =
      b.nama_bank.toLowerCase().includes(search.toLowerCase()) ||
      b.mata_pelajaran.toLowerCase().includes(search.toLowerCase()) ||
      (b.deskripsi && b.deskripsi.toLowerCase().includes(search.toLowerCase()));
    const matchSubject = subjectFilter === 'all' || b.mata_pelajaran === subjectFilter;
    return matchSearch && matchSubject;
  });

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Bank Soal & Penjadwalan</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Wadah koleksi butir soal pilihan ganda dan penjadwalan ujian CBT instan berdasarkan mapel
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenAdd} icon={<Plus className="w-4 h-4" />}>
          Buat Bank Soal
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-1">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Cari judul bank soal atau mapel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="w-full sm:w-60">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 bg-white text-slate-900 text-sm px-3.5 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">Semua Mata Pelajaran</option>
              {uniqueSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Total {banks.length} Bank Soal ({filteredBanks.length} Ditampilkan)
        </span>
      </div>

      {/* Question Banks Card Grid */}
      {loading ? (
        <Loading message="Memuat daftar bank soal..." />
      ) : filteredBanks.length === 0 ? (
        <Card>
          <EmptyState
            title="Belum Ada Bank Soal"
            description={
              search || subjectFilter !== 'all'
                ? 'Tidak ada bank soal yang cocok dengan filter yang dipilih.'
                : 'Buat bank soal pertama Anda untuk mulai menginput butir pertanyaan ujian.'
            }
            actionText={!search && subjectFilter === 'all' ? 'Buat Bank Soal Baru' : undefined}
            onAction={!search && subjectFilter === 'all' ? handleOpenAdd : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBanks.map((bank) => (
            <div
              key={bank.id}
              className="bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between overflow-hidden group"
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <Badge variant="indigo">{bank.mata_pelajaran}</Badge>
                  <Badge variant={bank.status === 'aktif' ? 'success' : 'neutral'}>
                    {bank.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </div>

                <h3
                  onClick={() => onSelectBank(bank.id)}
                  className="font-bold text-slate-900 text-base leading-snug hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  {bank.nama_bank}
                </h3>

                {bank.deskripsi && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {bank.deskripsi}
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <HelpCircle className="w-4 h-4 text-indigo-500" />
                    <span>{bank.total_questions || 0} Butir Soal</span>
                  </div>
                  {bank.nama_kelas && (
                    <div className="flex items-center gap-1 text-slate-500">
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>{bank.nama_kelas}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(bank)}
                    title="Edit Data Bank"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(bank)}
                    title="Hapus Bank Soal"
                    className="hover:bg-rose-50 text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenScheduleFromBank(bank)}
                    className="text-xs font-semibold py-1.5 px-2.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200"
                    icon={<CalendarCheck className="w-3.5 h-3.5 text-indigo-600" />}
                    title="Jadwalkan Ujian dari Bank Soal Ini"
                  >
                    Jadwalkan Ujian
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onSelectBank(bank.id)}
                    className="text-xs font-semibold py-1.5 px-2.5"
                    icon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    Kelola
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SCHEDULE EXAM FROM BANK MODAL */}
      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="Jadwalkan Ujian dari Bank Soal"
        subtitle={`Atur hari, waktu mulai/selesai, kelas, dan token masuk ujian untuk mapel: ${scheduleBank?.mata_pelajaran}`}
        maxWidth="2xl"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setScheduleModalOpen(false)}
              disabled={scheduleLoading}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmitSchedule}
              loading={scheduleLoading}
              icon={<CalendarCheck className="w-4 h-4" />}
            >
              Terbitkan Jadwal Ujian
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmitSchedule} className="space-y-4 py-1">
          {/* Header Mapel & Soal Badge */}
          <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider block">
                Sumber Bank Soal:
              </span>
              <p className="font-bold text-slate-900 text-sm">{scheduleBank?.nama_bank}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="indigo">{scheduleBank?.mata_pelajaran}</Badge>
              <Badge variant="neutral">{scheduleBank?.total_questions || 0} Soal</Badge>
            </div>
          </div>

          <Input
            label="Nama / Judul Ujian"
            placeholder="Contoh: Penilaian Harian Matematika"
            value={scheduleFormData.nama_ujian}
            onChange={(e) =>
              setScheduleFormData({ ...scheduleFormData, nama_ujian: e.target.value })
            }
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Kelas Peserta Ujian"
              value={scheduleFormData.class_id}
              onChange={(e) =>
                setScheduleFormData({ ...scheduleFormData, class_id: e.target.value })
              }
              options={classes.map((c) => ({ value: c.id, label: c.nama_kelas }))}
              placeholder="-- Pilih Kelas --"
              required
            />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Hari & Tanggal Pelaksanaan
              </label>
              <div className="space-y-1">
                <input
                  type="date"
                  value={scheduleFormData.tanggal}
                  onChange={(e) =>
                    setScheduleFormData({ ...scheduleFormData, tanggal: e.target.value })
                  }
                  className="block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  required
                />
                {scheduleFormData.tanggal && (
                  <span className="text-[11px] font-bold text-indigo-600 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Hari {getDayNameIndonesian(scheduleFormData.tanggal)}, {scheduleFormData.tanggal}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Jam Mulai"
              type="time"
              value={scheduleFormData.waktu_mulai}
              onChange={(e) =>
                setScheduleFormData({ ...scheduleFormData, waktu_mulai: e.target.value })
              }
              required
            />
            <Input
              label="Jam Akhir (Selesai)"
              type="time"
              value={scheduleFormData.waktu_selesai}
              onChange={(e) =>
                setScheduleFormData({ ...scheduleFormData, waktu_selesai: e.target.value })
              }
              required
            />
            <Input
              label="Durasi (Menit)"
              type="number"
              min="5"
              max="300"
              value={scheduleFormData.durasi_menit}
              onChange={(e) =>
                setScheduleFormData({
                  ...scheduleFormData,
                  durasi_menit: parseInt(e.target.value) || 60,
                })
              }
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Token Masuk Ujian
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={scheduleFormData.token}
                  onChange={(e) =>
                    setScheduleFormData({
                      ...scheduleFormData,
                      token: e.target.value.toUpperCase(),
                    })
                  }
                  className="block w-full font-mono uppercase font-black tracking-widest text-base rounded-lg border border-indigo-300 px-3.5 py-2 text-indigo-900 bg-indigo-50/50 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  required
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setScheduleFormData({ ...scheduleFormData, token: generateRandomToken() })
                  }
                  title="Generate Token Acak Baru"
                  icon={<RotateCw className="w-3.5 h-3.5" />}
                >
                  Acak
                </Button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Token 6 karakter untuk verifikasi siswa sebelum mulai ujian.
              </p>
            </div>

            <Select
              label="Status Ujian"
              value={scheduleFormData.status}
              onChange={(e) =>
                setScheduleFormData({ ...scheduleFormData, status: e.target.value as any })
              }
              options={[
                { value: 'aktif', label: 'Aktif (Dapat Dikerjakan Siswa)' },
                { value: 'draft', label: 'Draft (Disimpan Sementara)' },
              ]}
            />
          </div>

          {/* Configuration Toggles */}
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Opsi Pelaksanaan Ujian:
            </span>

            <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={scheduleFormData.shuffle_questions === 1}
                onChange={(e) =>
                  setScheduleFormData({
                    ...scheduleFormData,
                    shuffle_questions: e.target.checked ? 1 : 0,
                  })
                }
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <span>Acak Urutan Butir Soal untuk Tiap Siswa</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={scheduleFormData.shuffle_answers === 1}
                onChange={(e) =>
                  setScheduleFormData({
                    ...scheduleFormData,
                    shuffle_answers: e.target.checked ? 1 : 0,
                  })
                }
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <span>Acak Pilihan Jawaban (A/B/C/D)</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={scheduleFormData.tampilkan_nilai === 1}
                onChange={(e) =>
                  setScheduleFormData({
                    ...scheduleFormData,
                    tampilkan_nilai: e.target.checked ? 1 : 0,
                  })
                }
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <span>Tampilkan Nilai Langsung ke Siswa Setelah Submit</span>
            </label>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Bank Soal Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Bank Soal' : 'Buat Bank Soal Baru'}
        subtitle="Kelompokkan butir soal berdasarkan mata pelajaran dan kelas"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit} loading={formLoading}>
              {editingId ? 'Perbarui Bank Soal' : 'Simpan Bank Soal'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nama Bank Soal"
            placeholder="Contoh: Matematika Wajib - Aljabar & Fungsi"
            value={formData.nama_bank}
            onChange={(e) => setFormData({ ...formData, nama_bank: e.target.value })}
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Mata Pelajaran"
              placeholder="Contoh: Matematika, Biologi"
              value={formData.mata_pelajaran}
              onChange={(e) => setFormData({ ...formData, mata_pelajaran: e.target.value })}
              required
            />

            <Select
              label="Peruntukan Kelas (Opsional)"
              value={formData.kelas_id}
              onChange={(e) => setFormData({ ...formData, kelas_id: e.target.value })}
              options={classes.map((c) => ({ value: c.id, label: c.nama_kelas }))}
              placeholder="-- Semua Kelas / Umum --"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Deskripsi Singkat (Opsional)
            </label>
            <textarea
              rows={3}
              value={formData.deskripsi}
              onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
              placeholder="Catatan mengenai silabus, bab materi, atau petunjuk bank soal..."
              className="block w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <Select
            label="Status Bank Soal"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            options={[
              { value: 'aktif', label: 'Aktif' },
              { value: 'nonaktif', label: 'Nonaktif' },
            ]}
          />
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Bank Soal?"
        message={
          <span>
            Apakah Anda yakin ingin menghapus bank soal{' '}
            <strong className="text-slate-900 font-bold">{deleteTarget?.nama_bank}</strong>? Seluruh
            butir soal di dalamnya akan terhapus permanen.
          </span>
        }
        confirmText="Ya, Hapus Bank Soal"
        loading={deleteLoading}
      />
    </div>
  );
};
