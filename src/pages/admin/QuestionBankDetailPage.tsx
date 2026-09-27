import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  CheckCircle,
  HelpCircle,
  Award,
  BookOpen,
  Upload,
  Download,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Sparkles,
  FileText,
  CheckCircle2,
  XCircle,
  RotateCw,
  Info,
  ExternalLink,
  Tag,
  ListFilter,
  Layers,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { QuestionBankItem, QuestionItem } from '../../types';
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
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { RichContent, hasHtmlTags } from '../../components/ui/RichContent';

interface QuestionBankDetailPageProps {
  bankId: string;
  onBack: () => void;
}

interface ParsedQuestionRow {
  pertanyaan: string;
  opsi_a: string;
  opsi_b: string;
  opsi_c: string;
  opsi_d: string;
  opsi_e?: string;
  kategori?: string;
  jawaban_benar: 'A' | 'B' | 'C' | 'D' | 'E';
  bobot: number;
  isValid: boolean;
  errorReason?: string;
}

const CATEGORY_PRESETS = [
  'Umum',
  'Mudah',
  'Sedang',
  'Sukar',
  'HOTS',
  'Literasi',
  'Numerasi',
  'Konseptual',
];

export const QuestionBankDetailPage: React.FC<QuestionBankDetailPageProps> = ({
  bankId,
  onBack,
}) => {
  const [bank, setBank] = useState<QuestionBankItem | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  // Form Add / Edit Question
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [useRichOptions, setUseRichOptions] = useState(false);
  const [formData, setFormData] = useState({
    pertanyaan: '',
    opsi_a: '',
    opsi_b: '',
    opsi_c: '',
    opsi_d: '',
    opsi_e: '',
    kategori: 'Umum',
    jumlah_opsi: 4,
    jawaban_benar: 'A' as 'A' | 'B' | 'C' | 'D' | 'E',
    bobot: 1.0,
  });
  const [formLoading, setFormLoading] = useState(false);

  // Bulk Upload Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<'file' | 'text' | 'guide'>('file');
  const [importText, setImportText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestionRow[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<QuestionItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchBankAndQuestions = async () => {
    setLoading(true);
    try {
      const [resBank, resQuestions] = await Promise.all([
        apiRequest<QuestionBankItem>(`/api/question-banks/${bankId}`),
        apiRequest<QuestionItem[]>(`/api/question-banks/${bankId}/questions`),
      ]);

      if (resBank.success && resBank.data) {
        setBank(resBank.data);
      }
      if (resQuestions.success && resQuestions.data) {
        setQuestions(resQuestions.data);
        // Clean selection
        setSelectedIds((prev) => {
          const currentIds = new Set(resQuestions.data!.map((q) => q.id));
          const next = new Set<string>();
          for (const id of prev) {
            if (currentIds.has(id)) next.add(id);
          }
          return next;
        });
      }
    } catch (e) {
      toast.error('Gagal memuat butir soal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBankAndQuestions();
  }, [bankId]);

  // Bulk Selection Handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.size === questions.length && questions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(questions.map((q) => q.id)));
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

  const handleExecuteBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleteLoading(true);
    try {
      const res = await apiRequest('/api/questions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ question_ids: Array.from(selectedIds) }),
      });

      if (res.success) {
        toast.success(res.message || 'Butir soal terpilih berhasil dihapus.');
        setSelectedIds(new Set());
        setBulkDeleteModalOpen(false);
        fetchBankAndQuestions();
      } else {
        toast.error(res.message || 'Gagal menghapus butir soal.');
      }
    } catch (e) {
      toast.error('Gagal menghapus butir soal secara massal.');
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  // Add / Edit Handlers
  const handleOpenAdd = () => {
    setEditingId(null);
    setUseRichOptions(false);
    setFormData({
      pertanyaan: '',
      opsi_a: '',
      opsi_b: '',
      opsi_c: '',
      opsi_d: '',
      opsi_e: '',
      kategori: 'Umum',
      jumlah_opsi: 4,
      jawaban_benar: 'A',
      bobot: 1.0,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (q: QuestionItem) => {
    setEditingId(q.id);
    const jOpts = q.jumlah_opsi || (q.opsi_e ? 5 : (q.opsi_d ? 4 : 3));
    const hasRichOption =
      hasHtmlTags(q.opsi_a) ||
      hasHtmlTags(q.opsi_b) ||
      hasHtmlTags(q.opsi_c) ||
      hasHtmlTags(q.opsi_d || '') ||
      hasHtmlTags(q.opsi_e || '');
    setUseRichOptions(hasRichOption);
    setFormData({
      pertanyaan: q.pertanyaan,
      opsi_a: q.opsi_a,
      opsi_b: q.opsi_b,
      opsi_c: q.opsi_c,
      opsi_d: q.opsi_d || '',
      opsi_e: q.opsi_e || '',
      kategori: q.kategori || 'Umum',
      jumlah_opsi: jOpts,
      jawaban_benar: (q.jawaban_benar || 'A') as any,
      bobot: q.bobot || 1.0,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.pertanyaan.trim() ||
      !formData.opsi_a.trim() ||
      !formData.opsi_b.trim() ||
      !formData.opsi_c.trim()
    ) {
      toast.error('Pertanyaan dan minimal 3 pilihan jawaban (A, B, C) wajib diisi.');
      return;
    }

    if (formData.jumlah_opsi >= 4 && !formData.opsi_d.trim()) {
      toast.error('Pilihan D wajib diisi untuk 4 opsi.');
      return;
    }

    if (formData.jumlah_opsi >= 5 && !formData.opsi_e.trim()) {
      toast.error('Pilihan E wajib diisi untuk 5 opsi jawaban.');
      return;
    }

    setFormLoading(true);
    try {
      const endpoint = editingId ? `/api/questions/${editingId}` : '/api/questions';
      const method = editingId ? 'PUT' : 'POST';
      const res = await apiRequest(endpoint, {
        method,
        body: JSON.stringify({
          ...formData,
          question_bank_id: bankId,
        }),
      });

      if (res.success) {
        toast.success(res.message || 'Soal berhasil disimpan.');
        setModalOpen(false);
        fetchBankAndQuestions();
      } else {
        toast.error(res.message || 'Gagal menyimpan butir soal.');
      }
    } catch (e: any) {
      toast.error('Terjadi kesalahan sistem: ' + (e?.message || e));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDuplicate = async (qId: string) => {
    try {
      const res = await apiRequest(`/api/questions/${qId}/duplicate`, { method: 'POST' });
      if (res.success) {
        toast.success('Soal berhasil diduplikasi.');
        fetchBankAndQuestions();
      } else {
        toast.error(res.message || 'Gagal menduplikasi soal.');
      }
    } catch (e) {
      toast.error('Gagal menduplikasi soal.');
    }
  };

  const handleDeleteQuestion = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await apiRequest(`/api/questions/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.success) {
        toast.success(res.message || 'Soal berhasil dihapus.');
        setDeleteTarget(null);
        fetchBankAndQuestions();
      } else {
        toast.error(res.message || 'Gagal menghapus soal.');
      }
    } catch (e) {
      toast.error('Gagal menghapus soal.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Export questions to CSV
  const handleExportCSV = () => {
    if (questions.length === 0) {
      toast.info('Tidak ada soal untuk diekspor.');
      return;
    }

    const headers = ['No', 'Pertanyaan', 'Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Opsi E', 'Kunci', 'Kategori', 'Bobot'];
    const rows = questions.map((q, i) => [
      i + 1,
      `"${q.pertanyaan.replace(/"/g, '""')}"`,
      `"${q.opsi_a.replace(/"/g, '""')}"`,
      `"${q.opsi_b.replace(/"/g, '""')}"`,
      `"${q.opsi_c.replace(/"/g, '""')}"`,
      `"${(q.opsi_d || '').replace(/"/g, '""')}"`,
      `"${(q.opsi_e || '').replace(/"/g, '""')}"`,
      q.jawaban_benar || 'A',
      `"${q.kategori || 'Umum'}"`,
      q.bobot || 1.0,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bank_soal_${bank?.nama_bank.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('File CSV berhasil diunduh.');
  };

  // Download CSV template
  const handleDownloadTemplate = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Pertanyaan,Opsi A,Opsi B,Opsi C,Opsi D,Opsi E,Kunci,Kategori,Bobot\n' +
      '"Apa ibukota negara Indonesia saat ini?","Bandung","Jakarta","Surabaya","Medan","Semarang","B","Umum",1.0\n' +
      '"Rumus kimia dari air murni adalah...","CO2","H2O","O2","NaCl","H2SO4","B","Mudah",1.0\n' +
      '"Hasil dari 15 x 12 adalah...","150","170","180","190","200","C","Numerasi",1.0';

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'template_upload_soal_cbt.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parser supporting both Aiken text and CSV formats
  const parseRawQuestions = (text: string): ParsedQuestionRow[] => {
    const results: ParsedQuestionRow[] = [];
    const trimmed = text.trim();
    if (!trimmed) return results;

    const isAikenFormat =
      trimmed.includes('KUNCI:') ||
      trimmed.includes('ANSWER:') ||
      trimmed.includes('A.') ||
      trimmed.includes('1.');

    if (isAikenFormat) {
      const blocks = trimmed.split(/\n\s*\n+/);
      for (const block of blocks) {
        const lines = block
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length < 4) continue;

        let qText = '';
        let opsiA = '';
        let opsiB = '';
        let opsiC = '';
        let opsiD = '';
        let opsiE = '';
        let key: 'A' | 'B' | 'C' | 'D' | 'E' = 'A';
        let bobot = 1.0;
        let kategori = 'Umum';

        for (const line of lines) {
          if (/^A[\.\)]\s*/i.test(line)) {
            opsiA = line.replace(/^A[\.\)]\s*/i, '');
          } else if (/^B[\.\)]\s*/i.test(line)) {
            opsiB = line.replace(/^B[\.\)]\s*/i, '');
          } else if (/^C[\.\)]\s*/i.test(line)) {
            opsiC = line.replace(/^C[\.\)]\s*/i, '');
          } else if (/^D[\.\)]\s*/i.test(line)) {
            opsiD = line.replace(/^D[\.\)]\s*/i, '');
          } else if (/^E[\.\)]\s*/i.test(line)) {
            opsiE = line.replace(/^E[\.\)]\s*/i, '');
          } else if (/^(KUNCI|ANSWER|JAWABAN)[\:\=]\s*/i.test(line)) {
            const rawKey = line.replace(/^(KUNCI|ANSWER|JAWABAN)[\:\=]\s*/i, '').trim().toUpperCase();
            if (['A', 'B', 'C', 'D', 'E'].includes(rawKey)) {
              key = rawKey as any;
            }
          } else if (/^(KATEGORI|CATEGORY)[\:\=]\s*/i.test(line)) {
            kategori = line.replace(/^(KATEGORI|CATEGORY)[\:\=]\s*/i, '').trim() || 'Umum';
          } else if (/^(BOBOT|SCORE|WEIGHT)[\:\=]\s*/i.test(line)) {
            const rawBobot = parseFloat(line.replace(/^(BOBOT|SCORE|WEIGHT)[\:\=]\s*/i, ''));
            if (!isNaN(rawBobot) && rawBobot > 0) bobot = rawBobot;
          } else {
            if (!opsiA) {
              const cleanQ = line.replace(/^\d+[\.\)]\s*/, '');
              qText += (qText ? ' ' : '') + cleanQ;
            }
          }
        }

        let errorReason = '';
        if (!qText) errorReason = 'Teks pertanyaan kosong';
        else if (!opsiA) errorReason = 'Pilihan A kosong';
        else if (!opsiB) errorReason = 'Pilihan B kosong';
        else if (!opsiC) errorReason = 'Pilihan C kosong';

        results.push({
          pertanyaan: qText,
          opsi_a: opsiA,
          opsi_b: opsiB,
          opsi_c: opsiC,
          opsi_d: opsiD,
          opsi_e: opsiE,
          kategori,
          jawaban_benar: key,
          bobot,
          isValid: !errorReason,
          errorReason,
        });
      }
    } else {
      // CSV format
      const lines = trimmed.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (
          i === 0 &&
          (line.toLowerCase().includes('pertanyaan') ||
            line.toLowerCase().includes('question') ||
            line.toLowerCase().includes('opsi_a'))
        ) {
          continue;
        }

        const parts: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let c = 0; c < line.length; c++) {
          const char = line[c];
          if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
          } else if ((char === ',' || char === ';' || char === '\t') && !inQuotes) {
            parts.push(current.trim().replace(/^["']|["']$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        parts.push(current.trim().replace(/^["']|["']$/g, ''));

        if (parts.length < 4) continue;

        const qText = parts[0] || '';
        const opsiA = parts[1] || '';
        const opsiB = parts[2] || '';
        const opsiC = parts[3] || '';
        let opsiD = '';
        let opsiE = '';
        let key: 'A' | 'B' | 'C' | 'D' | 'E' = 'A';
        let kategori = 'Umum';
        let bobot = 1.0;

        // Check if parts[4] is a single letter key (3 options) or option D
        if (parts.length >= 5) {
          if (['A', 'B', 'C'].includes(parts[4].toUpperCase())) {
            key = parts[4].toUpperCase() as any;
            bobot = parseFloat(parts[5]) || 1.0;
            kategori = parts[6] || 'Umum';
          } else {
            opsiD = parts[4];
            // Check parts[5]
            if (parts.length >= 6 && ['A', 'B', 'C', 'D'].includes(parts[5].toUpperCase())) {
              key = parts[5].toUpperCase() as any;
              bobot = parseFloat(parts[6]) || 1.0;
              kategori = parts[7] || 'Umum';
            } else if (parts.length >= 7) {
              opsiE = parts[5] || '';
              key = (['A', 'B', 'C', 'D', 'E'].includes((parts[6] || '').toUpperCase())
                ? parts[6].toUpperCase()
                : 'A') as any;
              kategori = parts[7] || 'Umum';
              bobot = parseFloat(parts[8]) || 1.0;
            }
          }
        }

        let errorReason = '';
        if (!qText) errorReason = 'Teks pertanyaan kosong';
        else if (!opsiA) errorReason = 'Opsi A kosong';
        else if (!opsiB) errorReason = 'Opsi B kosong';
        else if (!opsiC) errorReason = 'Opsi C kosong';

        results.push({
          pertanyaan: qText,
          opsi_a: opsiA,
          opsi_b: opsiB,
          opsi_c: opsiC,
          opsi_d: opsiD,
          opsi_e: opsiE,
          kategori,
          jawaban_benar: key,
          bobot,
          isValid: !errorReason,
          errorReason,
        });
      }
    }

    return results;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setImportText(text);
      const parsed = parseRawQuestions(text);
      setParsedQuestions(parsed);
    };
    reader.readAsText(file);
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
      const parsed = parseRawQuestions(text);
      setParsedQuestions(parsed);
    };
    reader.readAsText(file);
  };

  const handleOpenBulkUpload = () => {
    setImportText('');
    setParsedQuestions([]);
    setUploadedFileName('');
    setImportTab('file');
    setImportModalOpen(true);
  };

  const handleExecuteImport = async () => {
    const validRows = parsedQuestions.filter((q) => q.isValid);
    if (validRows.length === 0) {
      toast.error('Tidak ada butir soal yang valid untuk diimpor.');
      return;
    }

    setImportLoading(true);
    try {
      const res = await apiRequest(`/api/question-banks/${bankId}/questions/bulk-import`, {
        method: 'POST',
        body: JSON.stringify({
          questionsList: validRows.map((r) => ({
            pertanyaan: r.pertanyaan,
            opsi_a: r.opsi_a,
            opsi_b: r.opsi_b,
            opsi_c: r.opsi_c,
            opsi_d: r.opsi_d,
            opsi_e: r.opsi_e,
            kategori: r.kategori || 'Umum',
            jawaban_benar: r.jawaban_benar,
            bobot: r.bobot,
          })),
        }),
      });

      if (res.success) {
        toast.success(res.message || `${validRows.length} butir soal berhasil diimpor.`);
        setImportModalOpen(false);
        fetchBankAndQuestions();
      } else {
        toast.error(res.message || 'Gagal mengimpor butir soal.');
      }
    } catch (e) {
      toast.error('Terjadi kesalahan saat memproses impor soal.');
    } finally {
      setImportLoading(false);
    }
  };

  // Available unique categories in this bank
  const uniqueCategories = Array.from(
    new Set(questions.map((q) => q.kategori || 'Umum').filter(Boolean))
  );

  const filteredQuestions = questions.filter((q) => {
    const matchSearch = q.pertanyaan.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (categoryFilter === 'all') return true;
    return (q.kategori || 'Umum') === categoryFilter;
  });

  const isAllSelected = questions.length > 0 && selectedIds.size === questions.length;
  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < questions.length;

  // Options for Kunci Jawaban based on current jumlah_opsi
  const keyOptions = [
    { value: 'A', label: 'Pilihan A' },
    { value: 'B', label: 'Pilihan B' },
    { value: 'C', label: 'Pilihan C' },
    ...(formData.jumlah_opsi >= 4 ? [{ value: 'D', label: 'Pilihan D' }] : []),
    ...(formData.jumlah_opsi >= 5 ? [{ value: 'E', label: 'Pilihan E' }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Top Navigation & Info Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="secondary" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
            Kembali
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">{bank?.nama_bank}</h2>
              <Badge variant="indigo">{bank?.mata_pelajaran}</Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {bank?.nama_kelas ? `Peruntukan: ${bank.nama_kelas} • ` : ''}
              {bank?.deskripsi || 'Koleksi butir soal pilihan ganda'}
            </p>
          </div>
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
            className="text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200"
            icon={<Upload className="w-3.5 h-3.5 text-indigo-600" />}
          >
            Bulk Upload Soal
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            Export CSV
          </Button>
          <Button variant="primary" size="sm" onClick={handleOpenAdd} icon={<Plus className="w-4 h-4" />}>
            Tambah Soal
          </Button>
        </div>
      </div>

      {/* Bulk Delete Floating Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-900 text-white px-5 py-3.5 rounded-xl shadow-lg border border-indigo-700 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-indigo-500 text-white font-bold text-xs flex items-center justify-center">
              {selectedIds.size}
            </span>
            <span className="text-sm font-semibold">
              {selectedIds.size} dari {questions.length} butir soal dipilih
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
              className="bg-rose-600 hover:bg-rose-700 shadow-xs"
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Hapus {selectedIds.size} Soal Terpilih
            </Button>
          </div>
        </div>
      )}

      {/* Questions Search, Category Filter and List */}
      <Card noPadding>
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-1">
            <div className="w-full sm:w-72">
              <Input
                placeholder="Cari teks pertanyaan soal..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>

            {/* Filter Kategori Soal */}
            <div className="w-full sm:w-52">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 bg-white text-slate-900 text-sm px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">Semua Kategori ({questions.length})</option>
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    Kategori: {cat}
                  </option>
                ))}
              </select>
            </div>

            {questions.length > 0 && (
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shrink-0"
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
                <span>{isAllSelected ? 'Batalkan Semua' : 'Pilih Semua'}</span>
              </button>
            )}
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Total: <strong className="text-slate-800">{filteredQuestions.length}</strong> Butir Soal
          </span>
        </div>

        {loading ? (
          <Loading message="Memuat daftar butir soal..." />
        ) : filteredQuestions.length === 0 ? (
          <EmptyState
            title="Belum Ada Soal"
            description={
              search || categoryFilter !== 'all'
                ? `Tidak ditemukan soal yang cocok dengan filter.`
                : 'Bank soal ini masih kosong. Klik Tambah Soal atau gunakan Bulk Upload untuk mengunggah banyak soal sekaligus.'
            }
            actionText={!search && categoryFilter === 'all' ? 'Tambah Soal Sekarang' : undefined}
            onAction={!search && categoryFilter === 'all' ? handleOpenAdd : undefined}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredQuestions.map((q, index) => {
              const isSelected = selectedIds.has(q.id);
              const options = [
                { key: 'A', text: q.opsi_a },
                { key: 'B', text: q.opsi_b },
                { key: 'C', text: q.opsi_c },
                ...(q.opsi_d ? [{ key: 'D', text: q.opsi_d }] : []),
                ...(q.opsi_e ? [{ key: 'E', text: q.opsi_e }] : []),
              ];

              const optionLabel = q.opsi_e ? '5 Opsi (A-E)' : (q.opsi_d ? '4 Opsi (A-D)' : '3 Opsi (A-C)');

              return (
                <div
                  key={q.id}
                  className={`p-5 transition-colors ${
                    isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectOne(q.id)}
                        className="w-4 h-4 mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                      />

                      <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                        {index + 1}
                      </span>

                      {/* Question Rendered with RichContent */}
                      <div className="flex-1 min-w-0">
                        <RichContent
                          content={q.pertanyaan}
                          className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed"
                        />

                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
                          <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Kunci: Pilihan {q.jawaban_benar}
                          </span>
                          <span className="font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            Kategori: {q.kategori || 'Umum'}
                          </span>
                          <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {optionLabel}
                          </span>
                          <span>•</span>
                          <span>Bobot: {q.bobot}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(q.id)}
                        title="Duplikasi Soal"
                      >
                        <Copy className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(q)}
                        title="Edit Soal"
                      >
                        <Edit2 className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(q)}
                        title="Hapus Soal"
                        className="hover:bg-rose-50 text-rose-600"
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </Button>
                    </div>
                  </div>

                  {/* Options List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 ml-10 mt-3">
                    {options.map((opt) => {
                      const isCorrect = q.jawaban_benar === opt.key;
                      return (
                        <div
                          key={opt.key}
                          className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                            isCorrect
                              ? 'bg-emerald-50/80 border-emerald-300 shadow-2xs'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                              isCorrect
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {opt.key}
                          </span>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <RichContent
                              content={opt.text}
                              className={`leading-relaxed break-words text-xs ${
                                isCorrect ? 'font-bold text-emerald-950' : 'text-slate-700'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Bulk Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={bulkDeleteModalOpen}
        onClose={() => setBulkDeleteModalOpen(false)}
        onConfirm={handleExecuteBulkDelete}
        title="Hapus Butir Soal Terpilih?"
        message={`Apakah Anda yakin ingin menghapus ${selectedIds.size} butir soal yang dipilih secara permanen dari bank soal ini?`}
        confirmText="Ya, Hapus Masal"
        variant="danger"
        loading={bulkDeleteLoading}
      />

      {/* Add / Edit Question Modal with RichTextEditor */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Butir Soal' : 'Tambah Soal Baru'}
        subtitle="Lengkapi kategori soal, jumlah pilihan opsi, dan tentukan kunci jawaban yang benar"
        maxWidth="3xl"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit} loading={formLoading}>
              {editingId ? 'Perbarui Soal' : 'Simpan Soal'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Top Options: Kategori & Jumlah Opsi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            {/* Pilihan Kategori Soal */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Kategori Soal
              </label>
              <Input
                placeholder="Pilih atau ketik kategori (misal: HOTS, Literasi, Numerasi)"
                value={formData.kategori}
                onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                required
              />
              {/* Quick suggestion chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {CATEGORY_PRESETS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormData({ ...formData, kategori: cat })}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                      formData.kategori === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Pilihan Jumlah Opsi Jawaban */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Jumlah Pilihan Opsi
              </label>
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                {[
                  { count: 3, label: '3 Opsi (A - C)' },
                  { count: 4, label: '4 Opsi (A - D)' },
                  { count: 5, label: '5 Opsi (A - E)' },
                ].map((opt) => (
                  <button
                    key={opt.count}
                    type="button"
                    onClick={() => {
                      const newCount = opt.count;
                      let newKey = formData.jawaban_benar;
                      if (newCount === 3 && (newKey === 'D' || newKey === 'E')) newKey = 'A';
                      if (newCount === 4 && newKey === 'E') newKey = 'A';
                      setFormData({
                        ...formData,
                        jumlah_opsi: newCount,
                        jawaban_benar: newKey,
                      });
                    }}
                    className={`p-2 rounded-lg text-xs font-bold border transition-all text-center ${
                      formData.jumlah_opsi === opt.count
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-500 block pt-0.5">
                {formData.jumlah_opsi === 3
                  ? 'Format ringkas 3 opsi untuk penilaian kilat / SD'
                  : formData.jumlah_opsi === 4
                  ? 'Format standar CBT 4 opsi untuk SMP / SMA'
                  : 'Format standar 5 opsi untuk SMA / SMK / UTBK'}
              </span>
            </div>
          </div>

          {/* WYSIWYG Rich Text Editor for Question Text */}
          <RichTextEditor
            label="Pertanyaan / Butir Soal"
            value={formData.pertanyaan}
            onChange={(val) => setFormData({ ...formData, pertanyaan: val })}
            placeholder="Tuliskan butir soal di sini... Anda dapat menyisipkan format tebal, miring, rumus x², H₂O, simbol matematika (π, ±, √), gambar diagram, dan tabel."
            minHeight="150px"
            required
          />

          {/* Options Grid */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Pilihan Jawaban ({formData.jumlah_opsi === 3 ? 'A, B, C' : formData.jumlah_opsi === 4 ? 'A, B, C, D' : 'A, B, C, D, E'}) <span className="text-rose-500">*</span>
              </span>
              <button
                type="button"
                onClick={() => setUseRichOptions(!useRichOptions)}
                className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                  useRichOptions
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {useRichOptions ? 'Mode Editor Kaya Aktif' : 'Beralih ke RichText Editor Opsi'}
              </button>
            </div>

            {useRichOptions ? (
              <div className="space-y-4">
                {/* Opsi A */}
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800">Pilihan A</span>
                    {formData.jawaban_benar === 'A' && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        Kunci Jawaban Benar
                      </span>
                    )}
                  </div>
                  <RichTextEditor
                    value={formData.opsi_a}
                    onChange={(val) => setFormData({ ...formData, opsi_a: val })}
                    placeholder="Teks atau formula pilihan A..."
                    minHeight="80px"
                    compact
                    required
                  />
                </div>

                {/* Opsi B */}
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800">Pilihan B</span>
                    {formData.jawaban_benar === 'B' && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        Kunci Jawaban Benar
                      </span>
                    )}
                  </div>
                  <RichTextEditor
                    value={formData.opsi_b}
                    onChange={(val) => setFormData({ ...formData, opsi_b: val })}
                    placeholder="Teks atau formula pilihan B..."
                    minHeight="80px"
                    compact
                    required
                  />
                </div>

                {/* Opsi C */}
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800">Pilihan C</span>
                    {formData.jawaban_benar === 'C' && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        Kunci Jawaban Benar
                      </span>
                    )}
                  </div>
                  <RichTextEditor
                    value={formData.opsi_c}
                    onChange={(val) => setFormData({ ...formData, opsi_c: val })}
                    placeholder="Teks atau formula pilihan C..."
                    minHeight="80px"
                    compact
                    required
                  />
                </div>

                {/* Opsi D (if count >= 4) */}
                {formData.jumlah_opsi >= 4 && (
                  <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-800">Pilihan D</span>
                      {formData.jawaban_benar === 'D' && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          Kunci Jawaban Benar
                        </span>
                      )}
                    </div>
                    <RichTextEditor
                      value={formData.opsi_d}
                      onChange={(val) => setFormData({ ...formData, opsi_d: val })}
                      placeholder="Teks atau formula pilihan D..."
                      minHeight="80px"
                      compact
                      required
                    />
                  </div>
                )}

                {/* Opsi E (if count >= 5) */}
                {formData.jumlah_opsi >= 5 && (
                  <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-800">Pilihan E</span>
                      {formData.jawaban_benar === 'E' && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          Kunci Jawaban Benar
                        </span>
                      )}
                    </div>
                    <RichTextEditor
                      value={formData.opsi_e}
                      onChange={(val) => setFormData({ ...formData, opsi_e: val })}
                      placeholder="Teks atau formula pilihan E..."
                      minHeight="80px"
                      compact
                      required
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Pilihan A</label>
                    {formData.jawaban_benar === 'A' && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        Kunci Jawaban
                      </span>
                    )}
                  </div>
                  <Input
                    placeholder="Teks pilihan A"
                    value={formData.opsi_a}
                    onChange={(e) => setFormData({ ...formData, opsi_a: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Pilihan B</label>
                    {formData.jawaban_benar === 'B' && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        Kunci Jawaban
                      </span>
                    )}
                  </div>
                  <Input
                    placeholder="Teks pilihan B"
                    value={formData.opsi_b}
                    onChange={(e) => setFormData({ ...formData, opsi_b: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Pilihan C</label>
                    {formData.jawaban_benar === 'C' && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        Kunci Jawaban
                      </span>
                    )}
                  </div>
                  <Input
                    placeholder="Teks pilihan C"
                    value={formData.opsi_c}
                    onChange={(e) => setFormData({ ...formData, opsi_c: e.target.value })}
                    required
                  />
                </div>

                {formData.jumlah_opsi >= 4 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Pilihan D</label>
                      {formData.jawaban_benar === 'D' && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          Kunci Jawaban
                        </span>
                      )}
                    </div>
                    <Input
                      placeholder="Teks pilihan D"
                      value={formData.opsi_d}
                      onChange={(e) => setFormData({ ...formData, opsi_d: e.target.value })}
                      required
                    />
                  </div>
                )}

                {formData.jumlah_opsi >= 5 && (
                  <div className="space-y-1 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Pilihan E</label>
                      {formData.jawaban_benar === 'E' && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          Kunci Jawaban
                        </span>
                      )}
                    </div>
                    <Input
                      placeholder="Teks pilihan E"
                      value={formData.opsi_e}
                      onChange={(e) => setFormData({ ...formData, opsi_e: e.target.value })}
                      required
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Select
              label="Kunci Jawaban Benar"
              value={formData.jawaban_benar}
              onChange={(e) => setFormData({ ...formData, jawaban_benar: e.target.value as any })}
              options={keyOptions}
              required
            />

            <Input
              label="Bobot Nilai Soal"
              type="number"
              step="0.1"
              min="0.1"
              max="100"
              value={formData.bobot}
              onChange={(e) => setFormData({ ...formData, bobot: parseFloat(e.target.value) || 1.0 })}
              required
            />
          </div>
        </form>
      </Modal>

      {/* Bulk Upload Questions Modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Bulk Upload Butir Soal"
        subtitle="Unggah puluhan atau ratusan butir soal sekaligus melalui format CSV / teks"
        maxWidth="3xl"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setImportModalOpen(false)}>
              Tutup
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExecuteImport}
              disabled={parsedQuestions.filter((q) => q.isValid).length === 0}
              loading={importLoading}
              icon={<Upload className="w-4 h-4" />}
            >
              Impor {parsedQuestions.filter((q) => q.isValid).length} Soal Valid
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Tabs Navigation */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setImportTab('file')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                importTab === 'file'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Upload Berkas (.csv / .txt)
            </button>
            <button
              type="button"
              onClick={() => setImportTab('text')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                importTab === 'text'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Tempel Teks (Format Soal)
            </button>
            <button
              type="button"
              onClick={() => setImportTab('guide')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                importTab === 'guide'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Panduan Format
            </button>
          </div>

          {/* TAB 1: File Upload */}
          {importTab === 'file' && (
            <div className="space-y-3">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-indigo-500 hover:bg-indigo-50/30 transition-all cursor-pointer bg-slate-50/50"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm">
                  {uploadedFileName ? uploadedFileName : 'Klik atau Seret Berkas CSV ke Sini'}
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Mendukung berkas CSV atau format teks standar (.csv, .txt) dengan pemisah koma atau titik koma.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>Belum punya berkas contoh?</span>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="text-indigo-600 font-bold hover:underline flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh Template CSV
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Textarea Paste */}
          {importTab === 'text' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Tempel teks soal (Format Standar / Aiken):
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const sample = `1. Bentuk sederhana dari perkalian aljabar 2(3x + 4) adalah...
A. 6x + 8
B. 5x + 6
C. 6x + 4
D. 3x + 8
E. 6x - 8
KUNCI: A
KATEGORI: Aljabar
BOBOT: 1.0

2. Fungsi utama dari hemoglobin dalam darah manusia adalah...
A. Melawan infeksi bakteri
B. Membekukan darah saat luka
C. Mengangkut oksigen ke seluruh tubuh
D. Menghasilkan antibodi
E. Menjaga kadar gula
KUNCI: C
KATEGORI: Biologi
BOBOT: 1.0`;
                    setImportText(sample);
                    setParsedQuestions(parseRawQuestions(sample));
                  }}
                  className="text-xs text-indigo-600 hover:underline font-bold flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Isi Contoh Soal
                </button>
              </div>
              <textarea
                rows={7}
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setParsedQuestions(parseRawQuestions(e.target.value));
                }}
                placeholder={`1. Pertanyaan soal di sini...&#10;A. Pilihan jawaban A&#10;B. Pilihan jawaban B&#10;C. Pilihan jawaban C&#10;D. Pilihan jawaban D&#10;E. Pilihan jawaban E (opsional)&#10;KUNCI: A&#10;KATEGORI: HOTS&#10;BOBOT: 1.0&#10;&#10;2. Pertanyaan kedua...`}
                className="block w-full font-mono text-xs rounded-lg border border-slate-300 p-3 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          )}

          {/* TAB 3: Guide */}
          {importTab === 'guide' && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Info className="w-4 h-4 text-indigo-600" />
                Panduan Format Soal untuk Bulk Upload
              </h4>

              <div className="space-y-2">
                <p className="font-semibold text-indigo-900">Format 1: Format Standar Sekolah / Aiken (Rekomendasi)</p>
                <div className="bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-800 space-y-1">
                  <p>1. Apa ibukota negara Indonesia?</p>
                  <p>A. Bandung</p>
                  <p>B. Nusantara</p>
                  <p>C. Surabaya</p>
                  <p>D. Medan</p>
                  <p>E. Semarang</p>
                  <p className="text-emerald-700 font-bold">KUNCI: B</p>
                  <p className="text-amber-700 font-bold">KATEGORI: HOTS</p>
                  <p className="text-indigo-700 font-bold">BOBOT: 1.0</p>
                </div>
                <p className="text-[11px] text-slate-500">
                  * Pisahkan butir soal satu dengan lainnya menggunakan satu baris kosong (jarak enter). Pilihan E dan Kategori bersifat opsional.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200">
                <p className="font-semibold text-indigo-900">Format 2: Format Baris Berkas CSV (Excel)</p>
                <div className="bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-800">
                  "Pertanyaan", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Opsi E", "A", "Kategori", 1.0
                </div>
              </div>
            </div>
          )}

          {/* LIVE PREVIEW TABLE */}
          {parsedQuestions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Pratinjau Hasil Pembacaan ({parsedQuestions.filter((q) => q.isValid).length} Valid, {parsedQuestions.filter((q) => !q.isValid).length} Tidak Valid)
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Hanya baris dengan status valid yang akan disimpan ke database
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] sticky top-0">
                    <tr>
                      <th className="p-2.5 w-10 text-center">No</th>
                      <th className="p-2.5">Teks Soal</th>
                      <th className="p-2.5">Opsi Jawaban</th>
                      <th className="p-2.5 text-center">Kunci</th>
                      <th className="p-2.5 text-center">Kategori</th>
                      <th className="p-2.5 text-center">Bobot</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedQuestions.map((q, idx) => (
                      <tr key={idx} className={!q.isValid ? 'bg-rose-50/50' : ''}>
                        <td className="p-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-2.5 max-w-xs font-medium truncate text-slate-900" title={q.pertanyaan}>
                          {q.pertanyaan}
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-600">
                          A: {q.opsi_a} • B: {q.opsi_b} • C: {q.opsi_c}
                          {q.opsi_d ? ` • D: ${q.opsi_d}` : ''}
                          {q.opsi_e ? ` • E: ${q.opsi_e}` : ''}
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono">
                            {q.jawaban_benar}
                          </span>
                        </td>
                        <td className="p-2.5 text-center text-[10px] font-semibold text-slate-600">
                          {q.kategori || 'Umum'}
                        </td>
                        <td className="p-2.5 text-center font-mono">{q.bobot}</td>
                        <td className="p-2.5 text-center">
                          {q.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600" title={q.errorReason}>
                              <XCircle className="w-3.5 h-3.5" />
                              Error
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Question Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteQuestion}
        title="Hapus Butir Soal?"
        message="Apakah Anda yakin ingin menghapus butir soal ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Ya, Hapus"
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
};
