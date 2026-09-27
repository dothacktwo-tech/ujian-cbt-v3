import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, GraduationCap, Users } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { ClassItem } from '../../types';
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

export const ClassesPage: React.FC = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nama_kelas: '',
    tingkat: '10',
    tahun_ajaran: '2024/2025',
    status: 'aktif' as 'aktif' | 'nonaktif',
  });
  const [formLoading, setFormLoading] = useState(false);

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<ClassItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<ClassItem[]>('/api/classes');
      if (res.success && res.data) {
        setClasses(res.data);
      }
    } catch (e) {
      toast.error('Gagal mengambil data kelas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      nama_kelas: '',
      tingkat: '10',
      tahun_ajaran: '2024/2025',
      status: 'aktif',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (cls: ClassItem) => {
    setEditingId(cls.id);
    setFormData({
      nama_kelas: cls.nama_kelas,
      tingkat: cls.tingkat,
      tahun_ajaran: cls.tahun_ajaran,
      status: cls.status,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama_kelas.trim() || !formData.tingkat || !formData.tahun_ajaran) {
      toast.error('Semua data kelas wajib diisi.');
      return;
    }

    setFormLoading(true);
    try {
      const endpoint = editingId ? `/api/classes/${editingId}` : '/api/classes';
      const method = editingId ? 'PUT' : 'POST';
      const res = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(formData),
      });

      if (res.success) {
        toast.success(res.message || 'Kelas berhasil disimpan.');
        setModalOpen(false);
        fetchClasses();
      } else {
        toast.error(res.message || 'Gagal menyimpan kelas.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Terjadi kesalahan sistem.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await apiRequest(`/api/classes/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.success) {
        toast.success('Kelas berhasil dihapus.');
        setDeleteTarget(null);
        fetchClasses();
      } else {
        toast.error(res.message || 'Gagal menghapus kelas.');
      }
    } catch (e: any) {
      toast.error('Gagal menghapus kelas.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredClasses = classes.filter(
    (c) =>
      c.nama_kelas.toLowerCase().includes(search.toLowerCase()) ||
      c.tingkat.toLowerCase().includes(search.toLowerCase()) ||
      c.tahun_ajaran.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Manajemen Data Kelas</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar kelas terdaftar untuk penempatan siswa dan penjadwalan ujian
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleOpenAdd}
          icon={<Plus className="w-4 h-4" />}
        >
          Tambah Kelas Baru
        </Button>
      </div>

      {/* Filter and Table Card */}
      <Card noPadding>
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Cari nama kelas atau tingkat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total {filteredClasses.length} Kelas
          </span>
        </div>

        {loading ? (
          <Loading message="Memuat data kelas..." />
        ) : filteredClasses.length === 0 ? (
          <EmptyState
            title="Tidak Ada Data Kelas"
            description={
              search
                ? `Tidak ditemukan kelas dengan kata kunci "${search}".`
                : 'Belum ada data kelas yang ditambahkan ke dalam sistem.'
            }
            actionText={!search ? 'Tambah Kelas Pertama' : undefined}
            onAction={!search ? handleOpenAdd : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Nama Kelas</th>
                  <th className="px-4 py-3.5">Tingkat</th>
                  <th className="px-4 py-3.5">Tahun Ajaran</th>
                  <th className="px-4 py-3.5">Jumlah Siswa</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClasses.map((cls) => (
                  <tr key={cls.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-100">
                        {cls.tingkat}
                      </div>
                      <span>{cls.nama_kelas}</span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">Tingkat {cls.tingkat}</td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-600">{cls.tahun_ajaran}</td>
                    <td className="px-4 py-3.5">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{cls.student_count || 0} Siswa</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={cls.status === 'aktif' ? 'success' : 'neutral'}>
                        {cls.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(cls)}
                          title="Edit Kelas"
                        >
                          <Edit2 className="w-4 h-4 text-slate-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(cls)}
                          title="Hapus Kelas"
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

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Data Kelas' : 'Tambah Kelas Baru'}
        subtitle="Masukkan rincian informasi nama kelas dan tahun ajaran"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit} loading={formLoading}>
              {editingId ? 'Perbarui Kelas' : 'Simpan Kelas'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nama Kelas"
            placeholder="Contoh: X IPA 1, XI IPS 2, XII TKJ"
            value={formData.nama_kelas}
            onChange={(e) => setFormData({ ...formData, nama_kelas: e.target.value })}
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tingkat / Jenjang"
              value={formData.tingkat}
              onChange={(e) => setFormData({ ...formData, tingkat: e.target.value })}
              options={[
                { value: '10', label: 'Tingkat 10 (X)' },
                { value: '11', label: 'Tingkat 11 (XI)' },
                { value: '12', label: 'Tingkat 12 (XII)' },
                { value: '7', label: 'Tingkat 7 (VII)' },
                { value: '8', label: 'Tingkat 8 (VIII)' },
                { value: '9', label: 'Tingkat 9 (IX)' },
              ]}
              required
            />

            <Input
              label="Tahun Ajaran"
              placeholder="2024/2025"
              value={formData.tahun_ajaran}
              onChange={(e) => setFormData({ ...formData, tahun_ajaran: e.target.value })}
              required
            />
          </div>

          <Select
            label="Status Kelas"
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
        title="Hapus Kelas?"
        message={
          <span>
            Apakah Anda yakin ingin menghapus kelas{' '}
            <strong className="text-slate-900 font-bold">{deleteTarget?.nama_kelas}</strong>? Siswa
            yang berada pada kelas ini juga akan terhapus.
          </span>
        }
        confirmText="Ya, Hapus Kelas"
        loading={deleteLoading}
      />
    </div>
  );
};
