import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportItem {
  student_id: string;
  nis: string;
  student_name: string;
  username: string;
  class_id: string;
  nama_kelas: string;
  exam_id: string;
  nama_ujian: string;
  mata_pelajaran: string;
  tanggal: string;
  durasi_menit: number;
  token: string;
  status: 'selesai' | 'sedang_mengerjakan' | 'belum_mulai';
  score: number;
  correct_answers: number;
  wrong_answers: number;
  total_questions: number;
  started_at?: string;
  submitted_at?: string;
}

export interface ReportExportOptions {
  schoolName?: string;
  academicYear?: string;
  filterClassName?: string;
  filterExamName?: string;
}

// 1. Export CSV (Microsoft Excel Compatible with UTF-8 BOM)
export function exportReportsToCsv(reports: ReportItem[], filename = 'laporan-nilai-siswa.csv') {
  if (!reports || reports.length === 0) return;

  const headers = [
    'No',
    'NIS',
    'Nama Siswa',
    'Kelas',
    'Mata Pelajaran',
    'Nama Ujian',
    'Status Ujian',
    'Benar',
    'Salah',
    'Total Soal',
    'Nilai Akhir',
    'Predikat',
    'Waktu Selesai',
  ];

  const rows = reports.map((r, index) => {
    let predikat = 'Belum Ujian';
    if (r.status === 'selesai') {
      if (r.score >= 85) predikat = 'Sangat Baik (A)';
      else if (r.score >= 70) predikat = 'Baik (B)';
      else if (r.score >= 55) predikat = 'Cukup (C)';
      else predikat = 'Perlu Bimbingan (D)';
    } else if (r.status === 'sedang_mengerjakan') {
      predikat = 'Sedang Ujian';
    }

    const submittedDateStr = r.submitted_at
      ? new Date(r.submitted_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
      : '-';

    return [
      index + 1,
      `"${r.nis || ''}"`,
      `"${(r.student_name || '').replace(/"/g, '""')}"`,
      `"${(r.nama_kelas || '').replace(/"/g, '""')}"`,
      `"${(r.mata_pelajaran || '').replace(/"/g, '""')}"`,
      `"${(r.nama_ujian || '').replace(/"/g, '""')}"`,
      `"${r.status === 'selesai' ? 'Selesai' : r.status === 'sedang_mengerjakan' ? 'Sedang Mengerjakan' : 'Belum Ujian'}"`,
      r.status === 'selesai' ? r.correct_answers : '-',
      r.status === 'selesai' ? r.wrong_answers : '-',
      r.total_questions || 0,
      r.status === 'selesai' ? r.score.toFixed(1) : '-',
      `"${predikat}"`,
      `"${submittedDateStr}"`,
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 2. Export PDF Laporan Rekapitulasi Nilai
export function exportReportsToPdf(
  reports: ReportItem[],
  options: ReportExportOptions = {}
) {
  const {
    schoolName = 'SMA Negeri 1 Lumbung',
    academicYear = '2024/2025',
    filterClassName = 'Semua Kelas',
    filterExamName = 'Semua Ujian',
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header / Kop Laporan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(schoolName.toUpperCase(), pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text('LAPORAN HASIL NILAI UJIAN SISWA', pageWidth / 2, 22, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Tahun Pelajaran: ${academicYear} | Filter: ${filterClassName} • ${filterExamName}`, pageWidth / 2, 27, { align: 'center' });

  // Garis Pemisah Kop
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.8);
  doc.line(14, 30, pageWidth - 14, 30);
  doc.setLineWidth(0.2);
  doc.line(14, 31, pageWidth - 14, 31);

  // Statistics Summary Box
  const finishedList = reports.filter((r) => r.status === 'selesai');
  const scores = finishedList.map((r) => Number(r.score) || 0);
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '0';
  const maxScore = scores.length > 0 ? Math.max(...scores).toFixed(1) : '0';
  const minScore = scores.length > 0 ? Math.min(...scores).toFixed(1) : '0';
  const passedCount = scores.filter((s) => s >= 75).length;

  const statBoxY = 35;
  const colWidth = (pageWidth - 28) / 4;

  const stats = [
    { label: 'Total Peserta', val: `${reports.length} Siswa`, color: [15, 23, 42] },
    { label: 'Selesai Ujian', val: `${finishedList.length} Siswa`, color: [16, 185, 129] },
    { label: 'Rata-Rata Nilai', val: `${avgScore}`, color: [79, 70, 229] },
    { label: 'Ketuntasan (KKM ≥ 75)', val: `${passedCount} (${finishedList.length > 0 ? Math.round((passedCount / finishedList.length) * 100) : 0}%)`, color: [217, 119, 6] },
  ];

  stats.forEach((item, idx) => {
    const x = 14 + idx * colWidth;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, statBoxY, colWidth - 2, 14, 1.5, 1.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, statBoxY, colWidth - 2, 14, 1.5, 1.5, 'D');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, x + (colWidth - 2) / 2, statBoxY + 5, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(item.val, x + (colWidth - 2) / 2, statBoxY + 11, { align: 'center' });
  });

  // Table
  const tableData = reports.map((r, index) => {
    let predikat = 'Belum Ujian';
    if (r.status === 'selesai') {
      if (r.score >= 85) predikat = 'Sangat Baik (A)';
      else if (r.score >= 70) predikat = 'Baik (B)';
      else if (r.score >= 55) predikat = 'Cukup (C)';
      else predikat = 'Perlu Bimbingan (D)';
    } else if (r.status === 'sedang_mengerjakan') {
      predikat = 'Sedang Ujian';
    }

    return [
      (index + 1).toString(),
      r.nis || '-',
      r.student_name,
      r.nama_kelas,
      r.mata_pelajaran || '-',
      r.status === 'selesai' ? `${r.correct_answers}/${r.total_questions}` : '-',
      r.status === 'selesai' ? r.score.toFixed(1) : '-',
      predikat,
    ];
  });

  autoTable(doc, {
    startY: 53,
    head: [['No', 'NIS', 'Nama Siswa', 'Kelas', 'Mata Pelajaran', 'Benar', 'Nilai', 'Status / Predikat']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [67, 56, 202],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 48 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 32 },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 24, halign: 'center' },
    },
    didDrawPage: () => {
      const str = `Halaman ${doc.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(str, pageWidth - 14, pageHeight - 8, { align: 'right' });
      doc.text('CBT Ujian Online • Dokumen Resmi Laporan Nilai', 14, pageHeight - 8);
    },
  });

  // Signature Block
  const finalY = (doc as any).lastAutoTable?.finalY || 180;
  let signY = finalY + 12;

  if (signY + 36 > pageHeight - 15) {
    doc.addPage();
    signY = 25;
  }

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  const leftSignX = 25;
  const rightSignX = pageWidth - 65;

  doc.text('Mengetahui,', leftSignX, signY, { align: 'center' });
  doc.text('Kepala Sekolah', leftSignX, signY + 5, { align: 'center' });
  doc.text('( ..................................................... )', leftSignX, signY + 28, { align: 'center' });
  doc.text('NIP. .................................................', leftSignX, signY + 33, { align: 'center' });

  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  doc.text(`Lumbung, ${todayStr}`, rightSignX, signY, { align: 'center' });
  doc.text('Guru / Admin CBT', rightSignX, signY + 5, { align: 'center' });
  doc.text('( ..................................................... )', rightSignX, signY + 28, { align: 'center' });
  doc.text('NIP. .................................................', rightSignX, signY + 33, { align: 'center' });

  const safeFilename = `laporan-nilai-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(safeFilename);
}

// 3. Export JSON
export function exportReportsToJson(reports: ReportItem[], filename = 'laporan-nilai-siswa.json') {
  if (!reports || reports.length === 0) return;
  const dataStr = JSON.stringify(reports, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
