-- CBT UJIAN Relational Database Schema
-- Compatible with PostgreSQL & SQLite

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin', -- 'admin'
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  nama_kelas TEXT NOT NULL,
  tingkat TEXT NOT NULL, -- e.g. '10', '11', '12' or 'X', 'XI', 'XII'
  tahun_ajaran TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktif', -- 'aktif', 'nonaktif'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  nis TEXT UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'aktif', -- 'aktif', 'nonaktif'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS question_banks (
  id TEXT PRIMARY KEY,
  nama_bank TEXT NOT NULL,
  mata_pelajaran TEXT NOT NULL,
  kelas_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
  deskripsi TEXT,
  status TEXT NOT NULL DEFAULT 'aktif',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  question_bank_id TEXT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
  pertanyaan TEXT NOT NULL,
  opsi_a TEXT NOT NULL,
  opsi_b TEXT NOT NULL,
  opsi_c TEXT NOT NULL,
  opsi_d TEXT NOT NULL,
  opsi_e TEXT DEFAULT '',
  jawaban_benar TEXT NOT NULL, -- 'A', 'B', 'C', 'D', 'E'
  bobot REAL NOT NULL DEFAULT 1.0,
  kategori TEXT NOT NULL DEFAULT 'Umum',
  jumlah_opsi INTEGER NOT NULL DEFAULT 4,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  nama_ujian TEXT NOT NULL,
  mata_pelajaran TEXT NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  question_bank_id TEXT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
  tanggal TEXT NOT NULL, -- YYYY-MM-DD
  waktu_mulai TEXT NOT NULL, -- HH:MM
  waktu_selesai TEXT NOT NULL, -- HH:MM
  durasi_menit INTEGER NOT NULL,
  token TEXT NOT NULL,
  shuffle_questions INTEGER NOT NULL DEFAULT 0, -- 0 or 1
  shuffle_answers INTEGER NOT NULL DEFAULT 0, -- 0 or 1
  tampilkan_nilai INTEGER NOT NULL DEFAULT 1, -- 0 or 1
  status TEXT NOT NULL DEFAULT 'aktif', -- 'draft', 'aktif', 'selesai'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_participants (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  started_at TEXT,
  submitted_at TEXT,
  status TEXT NOT NULL DEFAULT 'belum_mulai', -- 'belum_mulai', 'sedang_mengerjakan', 'selesai'
  score REAL DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  wrong_answers INTEGER DEFAULT 0,
  last_heartbeat TEXT,
  current_question_index INTEGER DEFAULT 0,
  answered_count INTEGER DEFAULT 0,
  ip_address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(exam_id, student_id)
);

CREATE TABLE IF NOT EXISTS answers (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer TEXT, -- 'A', 'B', 'C', 'D'
  is_correct INTEGER DEFAULT 0,
  score REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(exam_id, student_id, question_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Indexes for optimal relational query performance
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_questions_bank ON questions(question_bank_id);
CREATE INDEX IF NOT EXISTS idx_exams_class ON exams(class_id);
CREATE INDEX IF NOT EXISTS idx_participants_exam ON exam_participants(exam_id);
CREATE INDEX IF NOT EXISTS idx_participants_student ON exam_participants(student_id);
CREATE INDEX IF NOT EXISTS idx_answers_exam_student ON answers(exam_id, student_id);
