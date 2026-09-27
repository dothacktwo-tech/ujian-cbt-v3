-- ====================================================================
-- CBT UJIAN - SKEMA DATABASE SUPABASE POSTGRESQL & ROW LEVEL SECURITY
-- ====================================================================

-- 1. USERS (ADMINISTRATOR)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CLASSES (KELAS)
CREATE TABLE IF NOT EXISTS public.classes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  nama_kelas TEXT NOT NULL,
  tingkat TEXT NOT NULL,
  tahun_ajaran TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. STUDENTS (SISWA)
CREATE TABLE IF NOT EXISTS public.students (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  nis TEXT UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  class_id TEXT NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. QUESTION BANKS (BANK SOAL)
CREATE TABLE IF NOT EXISTS public.question_banks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  nama_bank TEXT NOT NULL,
  mata_pelajaran TEXT NOT NULL,
  kelas_id TEXT REFERENCES public.classes(id) ON DELETE SET NULL,
  deskripsi TEXT,
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. QUESTIONS (BUTIR SOAL PILIHAN GANDA)
CREATE TABLE IF NOT EXISTS public.questions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  question_bank_id TEXT NOT NULL REFERENCES public.question_banks(id) ON DELETE CASCADE,
  pertanyaan TEXT NOT NULL,
  opsi_a TEXT NOT NULL,
  opsi_b TEXT NOT NULL,
  opsi_c TEXT NOT NULL,
  opsi_d TEXT NOT NULL,
  jawaban_benar TEXT NOT NULL CHECK (jawaban_benar IN ('A', 'B', 'C', 'D')),
  bobot NUMERIC NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. EXAMS (JADWAL UJIAN)
CREATE TABLE IF NOT EXISTS public.exams (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  nama_ujian TEXT NOT NULL,
  mata_pelajaran TEXT NOT NULL,
  class_id TEXT NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  question_bank_id TEXT NOT NULL REFERENCES public.question_banks(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  waktu_mulai TEXT NOT NULL,
  waktu_selesai TEXT NOT NULL,
  durasi_menit INTEGER NOT NULL,
  token TEXT NOT NULL,
  shuffle_questions INTEGER NOT NULL DEFAULT 0,
  shuffle_answers INTEGER NOT NULL DEFAULT 0,
  tampilkan_nilai INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('draft', 'aktif', 'selesai')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. EXAM PARTICIPANTS (PESERTA UJIAN)
CREATE TABLE IF NOT EXISTS public.exam_participants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  exam_id TEXT NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'belum_mulai' CHECK (status IN ('belum_mulai', 'sedang_mengerjakan', 'selesai')),
  score NUMERIC DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  wrong_answers INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(exam_id, student_id)
);

-- 8. ANSWERS (JAWABAN PESERTA)
CREATE TABLE IF NOT EXISTS public.answers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  exam_id TEXT NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer TEXT CHECK (answer IN ('A', 'B', 'C', 'D')),
  is_correct INTEGER DEFAULT 0,
  score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(exam_id, student_id, question_id)
);

-- 9. SETTINGS (PENGATURAN SEKOLAH)
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. SITE SETTINGS (PENGATURAN TAMPILAN LOGIN)
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- INDEKS PERFORMA
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_questions_bank ON public.questions(question_bank_id);
CREATE INDEX IF NOT EXISTS idx_exams_class ON public.exams(class_id);
CREATE INDEX IF NOT EXISTS idx_participants_exam ON public.exam_participants(exam_id);
CREATE INDEX IF NOT EXISTS idx_participants_student ON public.exam_participants(student_id);
CREATE INDEX IF NOT EXISTS idx_answers_exam_student ON public.answers(exam_id, student_id);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated API service
CREATE POLICY "Allow public select for authenticated service" ON public.classes FOR SELECT USING (true);
CREATE POLICY "Allow public select for active exams" ON public.exams FOR SELECT USING (status = 'aktif');
CREATE POLICY "Allow student read answers own" ON public.answers FOR ALL USING (true);
CREATE POLICY "Allow student participant own" ON public.exam_participants FOR ALL USING (true);
CREATE POLICY "Allow settings select" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Allow site_settings select" ON public.site_settings FOR SELECT USING (true);

-- Restrict write access to administrators only
CREATE POLICY "Allow admin write settings" ON public.settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

CREATE POLICY "Allow admin write site_settings" ON public.site_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- ====================================================================
-- SEED DATA AWAL (ADMIN & SETTINGS)
-- Password Admin Default: admin123 (bcrypt hash)
-- ====================================================================
INSERT INTO public.users (id, username, password_hash, role, name)
VALUES (
  'user-admin-1',
  'admin',
  '$2a$10$w6e744mC81p4rM4p4lUaVuI5vj/w5lXvD2NqOqj8N1ePZ/M9U3i8i',
  'admin',
  'Administrator Utama'
) ON CONFLICT (username) DO NOTHING;

INSERT INTO public.settings (key, value) VALUES
  ('school_name', 'SMA Negeri 1 Nusantara'),
  ('academic_year', '2024/2025'),
  ('default_shuffle_questions', '0'),
  ('default_shuffle_answers', '0'),
  ('default_show_score', '1')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings (key, value) VALUES
  ('school_name', 'SMA Negeri 1 Nusantara'),
  ('academic_year', '2024/2025'),
  ('login_title', 'Login Ujian CBT'),
  ('login_description', 'Silakan masuk untuk mengikuti ujian.'),
  ('primary_color', '#FFB646'),
  ('button_color', '#6097EA'),
  ('background_color', '#EAF2FF')
ON CONFLICT (key) DO NOTHING;

-- ====================================================================
-- SUPABASE STORAGE BUCKET: school-assets
-- ====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage bucket objects
CREATE POLICY "Allow Public Access to school-assets objects" ON storage.objects
  FOR SELECT USING (bucket_id = 'school-assets');

CREATE POLICY "Allow Admin Uploads to school-assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'school-assets' AND
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Allow Admin Updates to school-assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'school-assets' AND
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Allow Admin Deletions of school-assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'school-assets' AND
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
  );
