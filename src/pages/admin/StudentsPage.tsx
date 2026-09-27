import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  KeyRound,
  Upload,
  Download,
  Filter,
  UserCheck,
  UserX,
  FileSpreadsheet,
  CheckSquare,
  Square,
  AlertTriangle,
  FileText,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { StudentItem, ClassItem } from '../../types';
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

interface ParsedStudentRow {
  nis: string;
  nama: string;
  username: string;
  password?: string;
  class_id?: string;
  class_name?: string;
  isValid: boolean;
  errorReason?: string;
}

export const StudentsPage: React.FC = () => {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  // Form Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nis: '',
    nama: '',
    username: '',
    password: '',
    class_id: '',
    status: 'aktif' as 'aktif' | 'nonaktif',
  });
  const [formLoading, setFormLoading] = useState(false);

  // Reset Password Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<StudentItem | null>(null);
  const [newPassword, setNewPassword] = useState('siswa123');
  const [resetLoading, setResetLoading] = useState(false);

  // Bulk Upload Modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<'file' | 'text'>('file');
  const [importText, setImportText] = useState('');
  const [importClassId, setImportClassId] = useState('');
  const [updateExisting, setUpdateExisting] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Single Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<StudentItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchClasses = async () => {
    try {
      const res = await apiRequest<ClassItem[]>('/api/classes');
      if (res.success && res.data) {
        setClasses(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      let query = `/api/students?class_id=${selectedClass}`;
      if (search.trim()) {
        query += `&q=${encodeURIComponent(search.trim())}`;
      }
      const res = await apiRequest<StudentItem[]>(query);
      if (res.success && res.data) {
        setStudents(res.data);
        // Clean selection of items that are no longer in the list
        setSelectedIds((prev) => {
          const newSet = new Set<string>();
          const currentIds = new Set(res.data!.map((s) => s.id));
          for (const id of prev) {
            if (currentIds.has(id)) newSet.add(id);
          }
          return newSet;
        });
      }
    } catch (e) {
      toast.error('Gagal mengambil data siswa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [selectedClass, search]);

  // Handle Selection
  const handleToggleSelectAll = () => {
    if (selectedIds.size === students.length && students.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.id)));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Bulk Delete Execution
  const handleExecuteBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleteLoading(true);
    try {
      const res = await apiRequest('/api/students/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ student_ids: Array.from(selectedIds) }),
      });

      if (res.success) {
        toast.success(res.message || 'Siswa berhasil dihapus secara massal.');
        setSelectedIds(new Set());
        setBulkDeleteModalOpen(false);
        fetchStudents();
      } else {
        toast.error(res.message || 'Gagal menghapus siswa.');
      }
    } catch (e: any) {
      toast.error('Gagal menghapus siswa massal.');
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  // Add / Edit Modal Handlers
  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      nis: '',
      nama: '',
      username: '',
      password: '',
      class_id: classes[0]?.id || '',
      status: 'aktif',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (std: StudentItem) => {
    setEditingId(std.id);
    setFormData({
      nis: std.nis,
      nama: std.nama,
      username: std.username,
      password: '',
      class_id: std.class_id,
      status: std.status,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nis.trim() || !formData.nama.trim() || !formData.username.trim() || !formData.class_id) {
      toast.error('NIS, Nama Lengkap, Username, dan Kelas wajib diisi.');
      return;
    }

    setFormLoading(true);
    try {
      const endpoint = editingId ? `/api/students/${editingId}` : '/api/students';
      const method = editingId ? 'PUT' : 'POST';
      const res = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(formData),
      });

      if (res.success) {
        toast.success(res.message || 'Data siswa berhasil disimpan.');
        setModalOpen(false);
        fetchStudents();
      } else {
        toast.error(res.message || 'Gagal menyimpan siswa.');
      }
    } catch (e: any) {
      toast.error('Terjadi kesalahan.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !newPassword.trim()) return;
    setResetLoading(true);
    try {
      const res = await apiRequest(`/api/students/${resetTarget.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword.trim() }),
      });
      if (res.success) {
        toast.success(res.message || 'Password siswa berhasil direset.');
        setResetModalOpen(false);
      } else {
        toast.error(res.message || 'Gagal mereset password.');
      }
    } catch (e) {
      toast.error('Gagal mereset password.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleDeleteSingle = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await apiRequest(`/api/students/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.success) {
        toast.success('Siswa berhasil dihapus.');
        setDeleteTarget(null);
        fetchStudents();
      } else {
        toast.error(res.message || 'Gagal menghapus siswa.');
      }
    } catch (e) {
      toast.error('Gagal menghapus siswa.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (students.length === 0) {
      toast.info('Tidak ada data siswa untuk diekspor.');
      return;
    }

    const headers = ['ID', 'NIS', 'Nama Lengkap', 'Username', 'Kelas', 'Status'];
    const rows = students.map((s) => [
      s.id,
      `"${s.nis}"`,
      `"${s.nama}"`,
      `"${s.username}"`,
      `"${s.nama_kelas || ''}"`,
      s.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `data-siswa-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Data siswa berhasil diunduh dalam format CSV.');
  };

  // Download Sample CSV Template
  const handleDownloadTemplate = () => {
    const defaultClassName = classes[0]?.nama_kelas || 'X IPA 1';
    const sampleRows = [
      ['nis', 'nama', 'username', 'password', 'nama_kelas'],
      ['1008', 'Muhammad Rizky Pratama', 'rizky', 'siswa123', defaultClassName],
      ['1009', 'Annisa Rahmawati', 'annisa', 'siswa123', defaultClassName],
      ['1010', 'Bagus Setiawan', 'bagus', 'siswa123', defaultClassName],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + sampleRows.map((r) => r.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'template_import_siswa_cbt.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Template CSV siswa berhasil diunduh.');
  };

  // Parse Raw Text / CSV String into Parsed Rows
  const parseRawContent = (content: string, fallbackClassId: string) => {
    if (!content.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = content.trim().split(/\r?\n/);
    const result: ParsedStudentRow[] = [];

    // Map class names for auto-matching
    const classNameMap = new Map<string, string>();
    for (const c of classes) {
      classNameMap.set(c.nama_kelas.toLowerCase().trim(), c.id);
      classNameMap.set(c.id.toLowerCase().trim(), c.id);
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Skip header row if matches common header names
      if (i === 0 && (line.toLowerCase().includes('nis') || line.toLowerCase().includes('nama'))) {
        continue;
      }

      // Split by comma, semicolon, or tab
      const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 2) continue;

      const nis = parts[0] || '';
      const nama = parts[1] || '';
      const username = parts[2] || nis;
      const password = parts[3] || 'siswa123';
      const classIdentifier = parts[4] || '';

      let matchedClassId = fallbackClassId;
      let matchedClassName = classes.find((c) => c.id === fallbackClassId)?.nama_kelas;

      if (classIdentifier) {
        const foundId = classNameMap.get(classIdentifier.toLowerCase().trim());
        if (foundId) {
          matchedClassId = foundId;
          matchedClassName = classes.find((c) => c.id === foundId)?.nama_kelas || classIdentifier;
        } else {
          matchedClassName = classIdentifier;
        }
      }

      const isValid = Boolean(nis && nama && (matchedClassId || fallbackClassId));
      let errorReason = '';
      if (!nis) errorReason = 'NIS kosong';
      else if (!nama) errorReason = 'Nama kosong';
      else if (!matchedClassId) errorReason = 'Kelas tidak ditemukan';

      result.push({
        nis,
        nama,
        username,
        password,
        class_id: matchedClassId,
        class_name: matchedClassName,
        isValid,
        errorReason,
      });
    }

    setParsedRows(result);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setImportText(text);
      parseRawContent(text, importClassId || classes[0]?.id || '');
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setImportText(text);
      parseRawContent(text, importClassId || classes[0]?.id || '');
    };
    reader.readAsText(file);
  };

  const handleOpenBulkUpload = () => {
    const defaultCls = classes[0]?.id || '';
    setImportClassId(defaultCls);
    setImportText('');
    setParsedRows([]);
    setUploadedFileName('');
    setUpdateExisting(false);
    setImportTab('file');
    setImportModalOpen(true);
  };

  const handleImportSubmit = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error('Tidak ada baris siswa yang valid untuk diimpor.');
      return;
    }

    setImportLoading(true);
    try {
      const res = await apiRequest('/api/students/import', {
        method: 'POST',
        body: JSON.stringify({
          studentsList: validRows.map((r) => ({
            nis: r.nis,
            nama: r.nama,
            username: r.username,
            password: r.password,
            class_id: r.class_id || importClassId,
            class_name: r.class_name,
          })),
          updateExisting,
        }),
      });

      if (res.success) {
        toast.success(res.message || 'Data siswa berhasil diimpor!');
        setImportModalOpen(false);
        fetchStudents();
      } else {
        toast.error(res.message || 'Gagal mengimpor data siswa.');
      }
    } catch (e: any) {
      toast.error('Terjadi kesalahan saat impor data.');
    } finally {
      setImportLoading(false);
    }
  };

  const isAllSelected = students.length > 0 && selectedIds.size === students.length;
  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < students.length;

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Manajemen Data Siswa</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola akun, kelas, kredensial login, impor berkas massal, dan aksi batch siswa
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadTemplate}
            icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />}
          >
            Template CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenBulkUpload}
            icon={<Upload className="w-3.5 h-3.5 text-indigo-600" />}
          >
            Bulk Upload CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            Export CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAdd}
            icon={<Plus className="w-4 h-4" />}
          >
            Tambah Siswa
          </Button>
        </div>
      </div>

      {/* Floating / Sticky Bulk Action Bar when items are selected */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-900 text-white px-5 py-3.5 rounded-xl shadow-lg border border-indigo-700 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-indigo-500 text-white font-bold text-xs flex items-center justify-center">
              {selectedIds.size}
            </span>
            <span className="text-sm font-semibold">
              {selectedIds.size} dari {students.length} siswa dipilih
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-indigo-200 border-indigo-700 hover:bg-indigo-800 hover:text-white"
            >
              Batal Pilih
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setBulkDeleteModalOpen(true)}
              className="bg-rose-600 hover:bg-rose-700 shadow-sm"
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Hapus {selectedIds.size} Siswa Terpilih
            </Button>
          </div>
        </div>
      )}

      {/* Filter and Table Card */}
      <Card noPadding>
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
            <div className="w-full sm:w-72">
              <Input
                placeholder="Cari NIS, nama, username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="w-full sm:w-56">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 bg-white text-slate-900 text-sm px-3.5 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">Semua Kelas</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.nama_kelas}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Ditemukan {students.length} Siswa
          </span>
        </div>

        {loading ? (
          <Loading message="Memuat data siswa..." />
        ) : students.length === 0 ? (
          <EmptyState
            title="Tidak Ada Data Siswa"
            description={
              search || selectedClass !== 'all'
                ? 'Tidak ditemukan siswa dengan filter pencarian ini.'
                : 'Belum ada data siswa terdaftar. Silakan tambahkan atau unggah berkas massal.'
            }
            actionText={!search && selectedClass === 'all' ? 'Tambah Siswa Pertama' : undefined}
            onAction={!search && selectedClass === 'all' ? handleOpenAdd : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 w-10">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-slate-500 hover:text-indigo-600 p-0.5 transition-colors"
                      title={isAllSelected ? 'Batalkan pilihan semua' : 'Pilih semua siswa'}
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : isPartiallySelected ? (
                        <div className="w-4 h-4 rounded border-2 border-indigo-600 bg-indigo-50 flex items-center justify-center">
                          <div className="w-2 h-0.5 bg-indigo-600"></div>
                        </div>
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3.5">NIS</th>
                  <th className="px-4 py-3.5">Nama Lengkap</th>
                  <th className="px-4 py-3.5">Username</th>
                  <th className="px-4 py-3.5">Kelas</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((std) => {
                  const isSelected = selectedIds.has(std.id);
                  return (
                    <tr
                      key={std.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(std.id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3.5 font-mono font-semibold text-slate-900">
                        {std.nis}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">{std.nama}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-600">
                        @{std.username}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant="indigo">{std.nama_kelas || 'Tanpa Kelas'}</Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={std.status === 'aktif' ? 'success' : 'neutral'}>
                          {std.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setResetTarget(std);
                              setNewPassword('siswa123');
                              setResetModalOpen(true);
                            }}
                            title="Reset Password Siswa"
                            className="hover:bg-amber-50 text-amber-700"
                          >
                            <KeyRound className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(std)}
                            title="Edit Siswa"
                          >
                            <Edit2 className="w-4 h-4 text-slate-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(std)}
                            title="Hapus Siswa"
                            className="hover:bg-rose-50 text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      {/* BULK UPLOAD MODAL */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Bulk Upload & Impor Data Siswa"
        subtitle="Unggah berkas CSV/Excel atau tempel format baris siswa secara massal"
        maxWidth="2xl"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setImportModalOpen(false)}
              disabled={importLoading}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleImportSubmit}
              loading={importLoading}
              disabled={parsedRows.filter((r) => r.isValid).length === 0}
              icon={<Upload className="w-4 h-4" />}
            >
              Impor {parsedRows.filter((r) => r.isValid).length} Siswa
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-1">
          {/* Tabs: File Upload vs Text Paste */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setImportTab('file')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                importTab === 'file'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              1. Unggah Berkas (.CSV / .TXT)
            </button>
            <button
              type="button"
              onClick={() => setImportTab('text')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                importTab === 'text'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              2. Tempel Teks Manual
            </button>
          </div>

          {/* Fallback Target Class & Overwrite Option */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <Select
              label="Kelas Bawaan (Jika Kolom Kelas Kosong)"
              value={importClassId}
              onChange={(e) => {
                setImportClassId(e.target.value);
                if (importText) parseRawContent(importText, e.target.value);
              }}
              options={classes.map((c) => ({ value: c.id, label: c.nama_kelas }))}
              required
            />

            <div className="flex flex-col justify-end pb-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Perbarui jika NIS/Username sudah ada</span>
              </label>
              <p className="text-[10px] text-slate-500 mt-1">
                Jika dicentang, siswa lama dengan NIS sama akan diperbarui datanya.
              </p>
            </div>
          </div>

          {/* TAB 1: File Dropzone */}
          {importTab === 'file' && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/80 rounded-xl p-6 text-center cursor-pointer transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-2.5">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  {uploadedFileName || 'Klik atau Tarik Berkas CSV / TXT ke Sini'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Format baris didukung: <code className="text-indigo-700">NIS, Nama, [Username], [Password], [Nama Kelas]</code>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadTemplate();
                  }}
                  className="mt-3 text-xs"
                  icon={<Download className="w-3.5 h-3.5" />}
                >
                  Unduh Contoh Template CSV
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: Textarea Paste */}
          {importTab === 'text' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Tempel Baris Data Siswa
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const sample = `1011, Bima Sakti, bima, siswa123, ${classes[0]?.nama_kelas || 'X IPA 1'}\n1012, Cantika Putri, cantika, siswa123, ${classes[0]?.nama_kelas || 'X IPA 1'}`;
                    setImportText(sample);
                    parseRawContent(sample, importClassId || classes[0]?.id || '');
                  }}
                  className="text-xs text-indigo-600 hover:underline font-bold"
                >
                  Isi Contoh
                </button>
              </div>
              <textarea
                rows={5}
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  parseRawContent(e.target.value, importClassId || classes[0]?.id || '');
                }}
                placeholder="1011, Bima Sakti, bima, siswa123, X IPA 1&#10;1012, Cantika Putri, cantika, siswa123, X IPA 1"
                className="block w-full font-mono text-xs rounded-lg border border-slate-300 p-3 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          )}

          {/* LIVE PREVIEW TABLE */}
          {parsedRows.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Pratinjau Data ({parsedRows.filter((r) => r.isValid).length} Valid,{' '}
                  {parsedRows.filter((r) => !r.isValid).length} Tidak Valid)
                </span>
                <span className="text-[11px] text-slate-500">
                  Total {parsedRows.length} baris terdeteksi
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">NIS</th>
                      <th className="px-3 py-2">Nama</th>
                      <th className="px-3 py-2">Username</th>
                      <th className="px-3 py-2">Kelas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.slice(0, 50).map((row, idx) => (
                      <tr
                        key={idx}
                        className={row.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/60'}
                      >
                        <td className="px-3 py-1.5">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                              <XCircle className="w-3.5 h-3.5" />
                              {row.errorReason}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-mono font-medium">{row.nis}</td>
                        <td className="px-3 py-1.5 font-semibold text-slate-900">{row.nama}</td>
                        <td className="px-3 py-1.5 text-slate-600 font-mono">@{row.username}</td>
                        <td className="px-3 py-1.5 text-slate-700">{row.class_name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 50 && (
                <p className="text-[10px] text-slate-400 text-center">
                  Menampilkan 50 baris pertama dari total {parsedRows.length} baris.
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* BULK DELETE CONFIRMATION MODAL */}
      <ConfirmDialog
        isOpen={bulkDeleteModalOpen}
        onClose={() => setBulkDeleteModalOpen(false)}
        onConfirm={handleExecuteBulkDelete}
        title="Hapus Siswa Massal?"
        message={
          <div className="space-y-2">
            <p>
              Apakah Anda yakin ingin menghapus sebanyak{' '}
              <strong className="text-rose-600 font-black">{selectedIds.size} siswa terpilih</strong>?
            </p>
            <p className="text-xs text-slate-500">
              Seluruh riwayat pengerjaan ujian, lembar jawaban, dan skor nilai dari seluruh siswa yang
              dipilih akan dihapus secara permanen dari server.
            </p>
          </div>
        }
        confirmText={`Ya, Hapus ${selectedIds.size} Siswa`}
        variant="danger"
        loading={bulkDeleteLoading}
      />

      {/* SINGLE DELETE CONFIRMATION MODAL */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteSingle}
        title="Hapus Siswa?"
        message={
          <span>
            Apakah Anda yakin ingin menghapus data siswa{' '}
            <strong className="text-slate-900 font-bold">{deleteTarget?.nama}</strong> (NIS:{' '}
            {deleteTarget?.nis})? Seluruh riwayat ujian siswa ini juga akan dihapus.
          </span>
        }
        confirmText="Ya, Hapus Siswa"
        loading={deleteLoading}
      />

      {/* SINGLE ADD / EDIT MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
        subtitle="Lengkapi data identitas dan akun login siswa untuk CBT"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit} loading={formLoading}>
              {editingId ? 'Perbarui Data' : 'Simpan Siswa'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nomor Induk Siswa (NIS)"
              placeholder="Contoh: 1008"
              value={formData.nis}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({
                  ...formData,
                  nis: val,
                  username:
                    !editingId && (!formData.username || formData.username === formData.nis)
                      ? val
                      : formData.username,
                });
              }}
              required
              autoFocus
            />

            <Select
              label="Kelas"
              value={formData.class_id}
              onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
              options={classes.map((c) => ({ value: c.id, label: c.nama_kelas }))}
              placeholder="-- Pilih Kelas --"
              required
            />
          </div>

          <Input
            label="Nama Lengkap Siswa"
            placeholder="Contoh: Muhammad Rizky Pratama"
            value={formData.nama}
            onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Username Login"
              placeholder="Username login"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
            />

            <Input
              label={editingId ? 'Ganti Password (Opsional)' : 'Password Awal'}
              placeholder={editingId ? 'Kosongkan jika tidak ganti' : 'Default: siswa123'}
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <Select
            label="Status Keaktifan"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            options={[
              { value: 'aktif', label: 'Aktif (Dapat Login & Ujian)' },
              { value: 'nonaktif', label: 'Nonaktif (Diblokir)' },
            ]}
          />
        </form>
      </Modal>

      {/* RESET PASSWORD MODAL */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset Password Siswa"
        subtitle={`Reset kata sandi akun untuk siswa: ${resetTarget?.nama}`}
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setResetModalOpen(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleResetPassword}
              loading={resetLoading}
            >
              Simpan Password Baru
            </Button>
          </>
        }
      >
        <div className="space-y-3 py-1">
          <p className="text-xs text-slate-500">
            Masukkan password baru yang akan digunakan oleh siswa{' '}
            <strong>{resetTarget?.nama}</strong> (NIS: {resetTarget?.nis}).
          </p>
          <Input
            label="Password Baru"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
};
