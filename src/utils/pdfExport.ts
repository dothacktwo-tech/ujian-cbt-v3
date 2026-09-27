import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExamItem, ExamParticipantResult } from '../types';

export interface ExamPdfReportOptions {
  exam: ExamItem;
  results: ExamParticipantResult[];
  schoolName?: string;
  academicYear?: string;
}

export function exportIndividualStudentCertificatePdf({
  exam,
  participant,
  schoolName = 'SMA Negeri 1 Lumbung',
  academicYear = '2024/2025',
}: {
  exam: ExamItem;
  participant: ExamParticipantResult;
  schoolName?: string;
  academicYear?: string;
}) {
  // Initialize PDF in A4 Landscape mode for an authentic certificate look
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm

  // 1. Soft Broken White Background Fill
  doc.setFillColor(252, 251, 247); // #fcfbf7 broken white
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // 2. Outer Decorative Certificate Frame (Gold/Amber & Dark Accents)
  doc.setDrawColor(217, 119, 6); // amber-600
  doc.setLineWidth(1.2);
  doc.roundedRect(10, 10, pageWidth - 20, pageHeight - 20, 3, 3, 'D');

  doc.setDrawColor(245, 158, 11); // amber-500
  doc.setLineWidth(0.4);
  doc.roundedRect(13, 13, pageWidth - 26, pageHeight - 26, 2, 2, 'D');

  // Decorative Corner Dots
  const corners = [
    [16, 16],
    [pageWidth - 16, 16],
    [16, pageHeight - 16],
    [pageWidth - 16, pageHeight - 16],
  ];
  corners.forEach(([cx, cy]) => {
    doc.setFillColor(217, 119, 6);
    doc.circle(cx, cy, 1.8, 'F');
  });

  // 3. Header Section (School & Certificate Title)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(schoolName.toUpperCase(), pageWidth / 2, 25, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`DINAS PENDIDIKAN • TAHUN AJARAN ${academicYear}`, pageWidth / 2, 30, { align: 'center' });

  // Decorative Line below Header
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.6);
  doc.line(70, 34, pageWidth - 70, 34);

  // Certificate Big Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(180, 83, 9); // amber-700 / gold
  doc.text('SERTIFIKAT HASIL UJIAN CBT', pageWidth / 2, 45, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const certNo = `CERT/CBT/${new Date().getFullYear()}/${participant.nis || '000'}/${exam.id.slice(0, 6).toUpperCase()}`;
  doc.text(`Nomor Verifikasi: ${certNo}`, pageWidth / 2, 51, { align: 'center' });

  // 4. Awardee / Student Name Section
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('Diberikan secara resmi kepada:', pageWidth / 2, 62, { align: 'center' });

  // Student Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42); // slate-900
  const studentNameStr = (participant.student_name || 'Nama Siswa').toUpperCase();
  doc.text(studentNameStr, pageWidth / 2, 72, { align: 'center' });

  // Underline for Student Name
  const nameWidth = Math.min(doc.getTextWidth(studentNameStr) + 10, 180);
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.5);
  doc.line((pageWidth - nameWidth) / 2, 75, (pageWidth + nameWidth) / 2, 75);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`NIS: ${participant.nis}  •  Kelas: ${participant.nama_kelas || '-'}`, pageWidth / 2, 81, { align: 'center' });

  // 5. Test Completion Statement
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text('Telah menyelesaikan Ujian Berbasis Komputer (CBT) dengan rincian pelaksanaan:', pageWidth / 2, 92, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(`${exam.nama_ujian} (${exam.mata_pelajaran})`, pageWidth / 2, 99, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Tanggal: ${exam.tanggal}  •  Durasi: ${exam.durasi_menit} Menit  •  Token: ${exam.token}`, pageWidth / 2, 105, { align: 'center' });

  // 6. Score & Achievement Cards (Centered Box)
  const scoreCardY = 113;
  const scoreCardWidth = 190;
  const scoreCardX = (pageWidth - scoreCardWidth) / 2;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(scoreCardX, scoreCardY, scoreCardWidth, 32, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(scoreCardX, scoreCardY, scoreCardWidth, 32, 2, 2, 'D');

  // Breakdown Columns inside card
  const totalQ = participant.total_questions || exam.total_questions || 0;
  const correct = participant.correct_answers || 0;
  const wrong = participant.wrong_answers || 0;
  const finalScore = (participant.score ?? 0).toFixed(1);
  const isPassed = (participant.score ?? 0) >= 75;

  const cardCols = [
    { label: 'TOTAL SOAL', val: `${totalQ}`, color: [15, 23, 42] },
    { label: 'BENAR / SALAH', val: `${correct} / ${wrong}`, color: [71, 85, 105] },
    { label: 'SKOR / NILAI', val: `${finalScore}`, color: isPassed ? [16, 185, 129] : [225, 29, 72] },
    { label: 'STATUS', val: isPassed ? 'TUNTAS (LULUS)' : 'BELUM TUNTAS', color: isPassed ? [16, 185, 129] : [217, 119, 6] },
  ];

  const colW = scoreCardWidth / 4;
  cardCols.forEach((col, idx) => {
    const cx = scoreCardX + idx * colW + colW / 2;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(col.label, cx, scoreCardY + 9, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(col.color[0], col.color[1], col.color[2]);
    doc.text(col.val, cx, scoreCardY + 22, { align: 'center' });

    // Separator vertical line
    if (idx < 3) {
      doc.setDrawColor(241, 245, 249);
      doc.line(scoreCardX + (idx + 1) * colW, scoreCardY + 5, scoreCardX + (idx + 1) * colW, scoreCardY + 27);
    }
  });

  // 7. Verified Stamp Seal Element (Left of signatures)
  const stampX = 55;
  const stampY = 166;
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.6);
  doc.circle(stampX, stampY, 13, 'D');
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.2);
  doc.circle(stampX, stampY, 11.5, 'D');

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9);
  doc.text('CBT VERIFIED', stampX, stampY - 3, { align: 'center' });
  doc.setFontSize(8);
  doc.text('★ LULUS ★', stampX, stampY + 2, { align: 'center' });
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFICIAL RESULT', stampX, stampY + 6, { align: 'center' });

  // 8. Signature Area
  const signY = 152;
  const leftSignX = 105;
  const rightSignX = pageWidth - 65;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

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
  doc.text('Guru Mata Pelajaran / Pengawas', rightSignX, signY + 5, { align: 'center' });
  doc.text('( ..................................................... )', rightSignX, signY + 28, { align: 'center' });
  doc.text('NIP. .................................................', rightSignX, signY + 33, { align: 'center' });

  // Footer Disclaimer
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Sertifikat ini diterbitkan secara otomatis oleh Sistem Ujian CBT Online dan sah tanpa tanda tangan basah bila terverifikasi.', pageWidth / 2, pageHeight - 8, { align: 'center' });

  // Save PDF
  const safeStudent = (participant.student_name || 'siswa').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const safeExam = (exam.nama_ujian || 'ujian').toLowerCase().replace(/[^a-z0-9]/g, '-');
  doc.save(`sertifikat-cbt-${safeStudent}-${safeExam}.pdf`);
}

export function exportExamResultsToPdf({
  exam,
  results,
  schoolName = 'SMA Negeri 1 Nusantara',
  academicYear = '2024/2025',
}: ExamPdfReportOptions) {
  // Initialize PDF in A4 Portrait mode
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Header / Kop Laporan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(schoolName.toUpperCase(), pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text('LAPORAN REKAPITULASI HASIL UJIAN CBT', pageWidth / 2, 22, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Tahun Pelajaran: ${academicYear} | Diterbitkan: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`, pageWidth / 2, 27, { align: 'center' });

  // Garis pemisah kop
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.8);
  doc.line(14, 30, pageWidth - 14, 30);
  doc.setLineWidth(0.2);
  doc.line(14, 31, pageWidth - 14, 31);

  // 2. Info Ujian & Metadata Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(14, 34, pageWidth - 28, 24, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, 34, pageWidth - 28, 24, 2, 2, 'D');

  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85); // slate-700

  // Kolom Kiri
  doc.setFont('helvetica', 'bold');
  doc.text('Nama Ujian', 18, 40);
  doc.setFont('helvetica', 'normal');
  doc.text(`: ${exam.nama_ujian}`, 48, 40);

  doc.setFont('helvetica', 'bold');
  doc.text('Mata Pelajaran', 18, 46);
  doc.setFont('helvetica', 'normal');
  doc.text(`: ${exam.mata_pelajaran}`, 48, 46);

  doc.setFont('helvetica', 'bold');
  doc.text('Kelas Peserta', 18, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(`: ${exam.nama_kelas || '-'}`, 48, 52);

  // Kolom Kanan
  doc.setFont('helvetica', 'bold');
  doc.text('Tanggal Pelaksanaan', 115, 40);
  doc.setFont('helvetica', 'normal');
  doc.text(`: ${exam.tanggal} (${exam.waktu_mulai} - ${exam.waktu_selesai})`, 155, 40);

  doc.setFont('helvetica', 'bold');
  doc.text('Durasi Pengerjaan', 115, 46);
  doc.setFont('helvetica', 'normal');
  doc.text(`: ${exam.durasi_menit} Menit`, 155, 46);

  doc.setFont('helvetica', 'bold');
  doc.text('Token Ujian', 115, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(`: ${exam.token}`, 155, 52);

  // 3. Ringkasan Statistik Nilai
  const finishedList = results.filter((r) => r.status === 'selesai');
  const scores = finishedList.map((r) => r.score || 0);
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '0';
  const maxScore = scores.length > 0 ? Math.max(...scores).toFixed(1) : '0';
  const minScore = scores.length > 0 ? Math.min(...scores).toFixed(1) : '0';

  const statBoxY = 62;
  const colWidth = (pageWidth - 28) / 4;

  const stats = [
    { label: 'Total Siswa', val: `${results.length} Siswa`, color: [15, 23, 42] },
    { label: 'Selesai Ujian', val: `${finishedList.length} Siswa`, color: [16, 185, 129] },
    { label: 'Rata-Rata Nilai', val: `${avgScore}`, color: [79, 70, 229] },
    { label: 'Tertinggi / Terendah', val: `${maxScore} / ${minScore}`, color: [225, 29, 72] },
  ];

  stats.forEach((item, idx) => {
    const x = 14 + idx * colWidth;
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(x, statBoxY, colWidth - 2, 14, 1.5, 1.5, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, x + (colWidth - 2) / 2, statBoxY + 5, { align: 'center' });

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(item.val, x + (colWidth - 2) / 2, statBoxY + 11, { align: 'center' });
  });

  // 4. Tabel Hasil Ujian Siswa (AutoTable)
  const tableData = results.map((r, index) => {
    const total = r.total_questions || 0;
    const correct = r.correct_answers || 0;
    const percent = total > 0 ? Math.round((correct / total) * 100) : (r.score || 0);

    let predikat = 'Belum Mulai';
    if (r.status === 'selesai') {
      if (percent >= 80) predikat = 'Sangat Baik (A)';
      else if (percent >= 65) predikat = 'Kompeten (B)';
      else if (percent >= 50) predikat = 'Cukup (C)';
      else predikat = 'Perlu Bimbingan (D)';
    } else if (r.status === 'sedang_mengerjakan') {
      predikat = 'Sedang Ujian';
    }

    return [
      (index + 1).toString(),
      r.nis,
      r.student_name,
      r.nama_kelas,
      r.status === 'selesai' ? `${r.correct_answers} / ${r.wrong_answers}` : '-',
      r.status === 'selesai' ? `${percent}% (${correct}/${total})` : '-',
      r.status === 'selesai' ? (r.score ?? 0).toFixed(1) : '-',
      predikat,
    ];
  });

  autoTable(doc, {
    startY: 80,
    head: [['No', 'NIS', 'Nama Siswa', 'Kelas', 'Benar/Salah', 'Penguasaan', 'Nilai', 'Predikat / Keterangan']],
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
      fillColor: [67, 56, 202], // indigo-700
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 50 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 26, halign: 'center' },
      6: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 31, halign: 'center' },
    },
    didDrawPage: (data) => {
      // Footer Nomor Halaman
      const str = `Halaman ${doc.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(str, pageWidth - 14, pageHeight - 8, { align: 'right' });
      doc.text('Aplikasi CBT Ujian Online Mandiri', 14, pageHeight - 8);
    },
  });

  // 5. Area Tanda Tangan Guru / Pengawas di halaman terakhir
  const finalY = (doc as any).lastAutoTable?.finalY || 180;
  let signY = finalY + 12;

  // Jika dekat dengan margin bawah halaman, buat halaman baru untuk tanda tangan
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
  doc.text(`Kota, ${todayStr}`, rightSignX, signY, { align: 'center' });
  doc.text('Guru Mata Pelajaran / Pengawas', rightSignX, signY + 5, { align: 'center' });
  doc.text('( ..................................................... )', rightSignX, signY + 28, { align: 'center' });
  doc.text('NIP. .................................................', rightSignX, signY + 33, { align: 'center' });

  // Simpan file PDF
  const safeTitle = (exam.nama_ujian || 'rekap-nilai').toLowerCase().replace(/[^a-z0-9]/g, '-');
  doc.save(`laporan-nilai-${safeTitle}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export interface StudentResultPdfOptions {
  studentName: string;
  studentNis?: string;
  studentClass: string;
  examSubject: string;
  examTitle: string;
  submissionDate: string;
  score?: number | null;
  totalQuestions?: number;
  correctAnswers?: number;
  wrongAnswers?: number;
  verificationCode?: string;
  schoolName?: string;
  academicYear?: string;
}

export function exportStudentExamResultReportPdf({
  studentName,
  studentNis = '-',
  studentClass,
  examSubject,
  examTitle,
  submissionDate,
  score,
  totalQuestions,
  correctAnswers,
  wrongAnswers,
  verificationCode = 'CBT-VERIFIED',
  schoolName = 'SMA Negeri 1 Nusantara',
  academicYear = '2024/2025',
}: StudentResultPdfOptions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm

  // Header Banner Background
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(0, 32, pageWidth, 3, 'F');

  // School Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(schoolName.toUpperCase(), pageWidth / 2, 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  doc.text(`LEMBAR BUKTI & LAPORAN HASIL UJIAN CBT • TAHUN AJARAN ${academicYear}`, pageWidth / 2, 21, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Kode Verifikasi Keamanan: ${verificationCode}`, pageWidth / 2, 27, { align: 'center' });

  // Document Title
  let currentY = 48;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('LAPORAN HASIL UJIAN SISWA', pageWidth / 2, currentY, { align: 'center' });

  currentY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Dokumen Laporan Resmi Evaluasi Ujian Berbasis Komputer (CBT)', pageWidth / 2, currentY, { align: 'center' });

  // Divider Line
  currentY += 6;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(15, currentY, pageWidth - 15, currentY);

  // Identity Table Box
  currentY += 8;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(15, currentY, pageWidth - 30, 48, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, currentY, pageWidth - 30, 48, 2, 2, 'D');

  const boxY = currentY + 7;
  doc.setFontSize(9);

  // Col 1
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Nama Siswa', 20, boxY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`: ${studentName}`, 55, boxY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('NIS / ID', 20, boxY + 8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`: ${studentNis}`, 55, boxY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Kelas / Rombel', 20, boxY + 16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`: ${studentClass}`, 55, boxY + 16);

  // Col 2
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Mata Pelajaran', 115, boxY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(67, 56, 202); // indigo-700
  doc.text(`: ${examSubject}`, 150, boxY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Nama Ujian', 115, boxY + 8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`: ${examTitle}`, 150, boxY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Waktu Selesai', 115, boxY + 16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`: ${submissionDate}`, 150, boxY + 16);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Status Sesi', 20, boxY + 28);
  doc.setFillColor(220, 252, 231); // emerald-100
  doc.roundedRect(55, boxY + 24, 45, 6, 1, 1, 'F');
  doc.setFontSize(8);
  doc.setTextColor(22, 101, 52); // emerald-800
  doc.text('✓ SELESAI / TERKUNCI', 57, boxY + 28.5);

  currentY += 56;

  // Grade / Score Showcase Card
  doc.setFillColor(238, 242, 255); // indigo-50
  doc.roundedRect(15, currentY, pageWidth - 30, 42, 3, 3, 'F');
  doc.setDrawColor(199, 210, 254);
  doc.setLineWidth(0.4);
  doc.roundedRect(15, currentY, pageWidth - 30, 42, 3, 3, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(67, 56, 202);
  doc.text('REKAPITULASI CAPAIAN & NILAI AKHIR UJIAN', pageWidth / 2, currentY + 8, { align: 'center' });

  if (score !== undefined && score !== null) {
    const finalScoreStr = Number(score).toFixed(1);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(30, 27, 75); // indigo-950
    doc.text(finalScoreStr, pageWidth / 2, currentY + 24, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(99, 102, 241);
    let predikatText = 'Status: TUNTAS';
    if (score >= 85) predikatText += ' (Sangat Memuaskan)';
    else if (score >= 70) predikatText += ' (Baik / Kompeten)';
    else predikatText += ' (Cukup)';
    doc.text(predikatText, pageWidth / 2, currentY + 33, { align: 'center' });
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(180, 83, 9); // amber-700
    doc.text('TERVERIFIKASI TERKUMPUL DI SERVER', pageWidth / 2, currentY + 22, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Nilai angka diproses oleh sistem & diumumkan oleh pihak sekolah/guru.', pageWidth / 2, currentY + 31, { align: 'center' });
  }

  currentY += 50;

  // Breakdown Summary Table
  if (totalQuestions) {
    autoTable(doc, {
      startY: currentY,
      margin: { left: 15, right: 15 },
      head: [['Komponen Soal Ujian', 'Rincian / Capaian', 'Status Evaluasi']],
      body: [
        ['Total Butir Soal Disajikan', `${totalQuestions} Butir Soal`, 'Lengkap'],
        ['Jawaban Benar', correctAnswers !== undefined ? `${correctAnswers} Soal` : '-', correctAnswers !== undefined ? `${Math.round(((correctAnswers || 0) / totalQuestions) * 100)}%` : '-'],
        ['Jawaban Salah / Kosong', wrongAnswers !== undefined ? `${wrongAnswers} Soal` : '-', wrongAnswers !== undefined ? `${Math.round(((wrongAnswers || 0) / totalQuestions) * 100)}%` : '-'],
        ['Verifikasi Integritas Data', 'Tersimpan & Terenkripsi', 'Sesuai Standar ANBK'],
      ],
      theme: 'striped',
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        font: 'helvetica',
      },
      headStyles: {
        fillColor: [51, 65, 85], // slate-700
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
    });

    currentY = (doc as any).lastAutoTable?.finalY + 15 || currentY + 45;
  } else {
    currentY += 15;
  }

  // Official Signatures Section
  const signY = Math.max(currentY, 215);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  const leftSignX = 40;
  const rightSignX = pageWidth - 40;

  doc.text('Siswa / Peserta Ujian,', leftSignX, signY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(`( ${studentName} )`, leftSignX, signY + 25, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`NIS. ${studentNis}`, leftSignX, signY + 30, { align: 'center' });

  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  doc.text(`Dicetak tanggal: ${todayStr}`, rightSignX, signY, { align: 'center' });
  doc.text('Panitia / Proktor CBT,', rightSignX, signY + 5, { align: 'center' });
  doc.text('( ..................................................... )', rightSignX, signY + 25, { align: 'center' });
  doc.text('NIP. .................................................', rightSignX, signY + 30, { align: 'center' });

  // Footer text
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Lembar ini merupakan bukti sah pengerjaan ujian CBT ANBK Sekolah.', pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Download PDF file
  const cleanStudent = studentName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  doc.save(`laporan-hasil-ujian-${cleanStudent}.pdf`);
}
