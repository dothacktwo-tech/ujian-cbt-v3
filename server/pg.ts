import pg from 'pg';
import dotenv from 'dotenv';
import dns from 'dns';

// Force DNS resolution to prefer IPv4 to avoid ECONNREFUSED issues with IPv6 in sandbox environments
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

// Custom lookup function that forces IPv4 resolution
export function ipv4Lookup(hostname: string, options: any, callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  dns.lookup(hostname, { ...options, family: 4 }, callback);
}

dotenv.config({ override: true });

const { Pool, Client } = pg;

// Dynamic PostgreSQL configuration with safe fallbacks and serverless optimizations
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.SERVERLESS);

export const pgConfig: any = {
  host: 'aws-0-ap-northeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '',
  ssl: {
    rejectUnauthorized: false,
  },
  max: isServerless ? 2 : 10,
  idleTimeoutMillis: isServerless ? 1000 : 30000,
  connectionTimeoutMillis: 5000, // 5s connection timeout for responsive failure handling
  family: 4,
  lookup: ipv4Lookup,
};

let pgDnsResolvePromise: Promise<void> | null = null;

export function ensurePgConfigResolved(): Promise<void> {
  if (pgDnsResolvePromise) return pgDnsResolvePromise;

  pgDnsResolvePromise = new Promise<void>((resolve) => {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      try {
        const parsed = new URL(dbUrl);
        pgConfig.host = parsed.hostname;
        pgConfig.port = parseInt(parsed.port || '5432', 10);
        pgConfig.database = parsed.pathname.substring(1);
        pgConfig.user = decodeURIComponent(parsed.username);
        pgConfig.password = decodeURIComponent(parsed.password);
        console.info('[pgConfig] Parsed configuration from DATABASE_URL successfully.');
      } catch (err: any) {
        console.error('[pgConfig Parse Error] Failed to parse DATABASE_URL:', err.message);
      }
    } else {
      pgConfig.host = process.env.PGHOST || 'db.wpzvwwxnfurztyejkhsm.supabase.co';
      pgConfig.port = parseInt(process.env.PGPORT || '5432', 10);
      pgConfig.database = process.env.PGDATABASE || 'postgres';
      pgConfig.user = process.env.PGUSER || 'postgres';
      pgConfig.password = process.env.PGPASSWORD || process.env.SUPABASE_DB_PASSWORD || '';
    }

    // We must NOT bypass Node.js DNS lookup or override the host with a direct IP.
    // Pooled database connections (like Supabase PgCat / Transaction Pooler) require Server Name Indication (SNI) 
    // to map the database connection to the correct project container. Overriding hostname with IP breaks SNI.
    resolve();
  });

  return pgDnsResolvePromise;
}

// Fire the DNS resolution on module load
ensurePgConfigResolved();

let pool: pg.Pool | null = null;

export function getPgPool(customPassword?: string): pg.Pool {
  if (customPassword) {
    return new Pool({
      ...pgConfig,
      password: customPassword,
      max: 4,
    } as any);
  }

  if (!pool) {
    pool = new Pool({
      ...pgConfig,
      max: 4,
    } as any);

    pool.on('error', (err) => {
      console.warn('[PostgreSQL Pool Warning]', err.message);
    });
  }
  return pool;
}

export async function testPostgresConnection(customPassword?: string): Promise<{
  connected: boolean;
  message: string;
  serverTime?: string;
  pgVersion?: string;
}> {
  await ensurePgConfigResolved();
  const currentPool = customPassword ? getPgPool(customPassword) : getPgPool();
  try {
    const client = await currentPool.connect();
    try {
      const res = await client.query('SELECT NOW() as now_time, version() as pg_version');
      return {
        connected: true,
        message: 'Koneksi ke Supabase PostgreSQL berhasil.',
        serverTime: res.rows[0]?.now_time?.toString(),
        pgVersion: res.rows[0]?.pg_version?.toString(),
      };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return {
      connected: false,
      message: err.message || 'Gagal terhubung ke host PostgreSQL.',
    };
  }
}

export const SUPABASE_SQL_STATEMENTS = [
  // 1. Users table
  `CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  // 2. Classes table
  `CREATE TABLE IF NOT EXISTS public.classes (
    id TEXT PRIMARY KEY,
    nama_kelas TEXT NOT NULL,
    tingkat TEXT NOT NULL,
    tahun_ajaran TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  // 3. Students table
  `CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY,
    nis TEXT UNIQUE NOT NULL,
    nama TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    class_id TEXT NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  // 4. Question banks table
  `CREATE TABLE IF NOT EXISTS public.question_banks (
    id TEXT PRIMARY KEY,
    nama_bank TEXT NOT NULL,
    mata_pelajaran TEXT NOT NULL,
    kelas_id TEXT REFERENCES public.classes(id) ON DELETE SET NULL,
    deskripsi TEXT,
    status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  // 5. Questions table
  `CREATE TABLE IF NOT EXISTS public.questions (
    id TEXT PRIMARY KEY,
    question_bank_id TEXT NOT NULL REFERENCES public.question_banks(id) ON DELETE CASCADE,
    pertanyaan TEXT NOT NULL,
    opsi_a TEXT NOT NULL,
    opsi_b TEXT NOT NULL,
    opsi_c TEXT NOT NULL,
    opsi_d TEXT NOT NULL,
    opsi_e TEXT DEFAULT '',
    kategori TEXT DEFAULT 'Umum',
    jumlah_opsi INTEGER DEFAULT 4,
    jawaban_benar TEXT NOT NULL,
    bobot NUMERIC NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  // 6. Exams table
  `CREATE TABLE IF NOT EXISTS public.exams (
    id TEXT PRIMARY KEY,
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
  );`,

  // 7. Exam participants table
  `CREATE TABLE IF NOT EXISTS public.exam_participants (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'belum_mulai' CHECK (status IN ('belum_mulai', 'sedang_mengerjakan', 'selesai')),
    score NUMERIC DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    wrong_answers INTEGER DEFAULT 0,
    last_heartbeat TEXT,
    current_question_index INTEGER DEFAULT 0,
    answered_count INTEGER DEFAULT 0,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(exam_id, student_id)
  );`,

  // 8. Answers table
  `CREATE TABLE IF NOT EXISTS public.answers (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    answer TEXT,
    is_correct INTEGER DEFAULT 0,
    score NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(exam_id, student_id, question_id)
  );`,

  // 9. Settings table
  `CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  // 10. Site Settings table
  `CREATE TABLE IF NOT EXISTS public.site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_id);`,
  `CREATE INDEX IF NOT EXISTS idx_questions_bank ON public.questions(question_bank_id);`,
  `CREATE INDEX IF NOT EXISTS idx_exams_class ON public.exams(class_id);`,
  `CREATE INDEX IF NOT EXISTS idx_participants_exam ON public.exam_participants(exam_id);`,
  `CREATE INDEX IF NOT EXISTS idx_participants_student ON public.exam_participants(student_id);`,
  `CREATE INDEX IF NOT EXISTS idx_answers_exam_student ON public.answers(exam_id, student_id);`,

  // Row Level Security (RLS)
  `ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.question_banks ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.exam_participants ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;`,

  // Policies (ignoring duplicates via TRY/CATCH equivalent or IF NOT EXISTS)
  `CREATE POLICY "Allow public select classes" ON public.classes FOR SELECT USING (true);`,
  `CREATE POLICY "Allow public select exams" ON public.exams FOR SELECT USING (status = 'aktif');`,
  `CREATE POLICY "Allow student read answers" ON public.answers FOR ALL USING (true);`,
  `CREATE POLICY "Allow student participant" ON public.exam_participants FOR ALL USING (true);`,
  `CREATE POLICY "Allow settings select" ON public.settings FOR SELECT USING (true);`,
  `CREATE POLICY "Allow site_settings select" ON public.site_settings FOR SELECT USING (true);`,

  `CREATE POLICY "Allow admin write settings" ON public.settings
     FOR ALL TO authenticated
     USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
     WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));`,

  `CREATE POLICY "Allow admin write site_settings" ON public.site_settings
     FOR ALL TO authenticated
     USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
     WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));`,

  // Default seed values
  `INSERT INTO public.users (id, username, password_hash, role, name)
   VALUES ('user-admin-1', 'admin', '$2b$10$HXjcUrmWNpna0bNMuewgX.VOr8KqPF7dB7IYGBoNTfKPFyCzXsiBC', 'admin', 'Administrator Utama')
   ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;`,

  `INSERT INTO public.settings (key, value) VALUES
    ('school_name', 'SMA Negeri 1 Nusantara'),
    ('academic_year', '2024/2025'),
    ('default_shuffle_questions', '0'),
    ('default_shuffle_answers', '0'),
    ('default_show_score', '1')
   ON CONFLICT (key) DO NOTHING;`,

  `INSERT INTO public.site_settings (key, value) VALUES
    ('school_name', 'SMA Negeri 1 Nusantara'),
    ('academic_year', '2024/2025'),
    ('login_title', 'Login Ujian CBT'),
    ('login_description', 'Silakan masuk untuk mengikuti ujian.'),
    ('primary_color', '#FFB646'),
    ('button_color', '#6097EA'),
    ('background_color', '#EAF2FF')
   ON CONFLICT (key) DO NOTHING;`,

  // Storage bucket and policies
  `INSERT INTO storage.buckets (id, name, public)
   VALUES ('school-assets', 'school-assets', true)
   ON CONFLICT (id) DO NOTHING;`,

  `CREATE POLICY "Allow Public Access to school-assets objects" ON storage.objects
    FOR SELECT USING (bucket_id = 'school-assets');`,

  `CREATE POLICY "Allow Admin Uploads to school-assets" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'school-assets' AND
      EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
    );`,

  `CREATE POLICY "Allow Admin Updates to school-assets" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'school-assets' AND
      EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
    );`,

  `CREATE POLICY "Allow Admin Deletions of school-assets" ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'school-assets' AND
      EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
    );`
];

export async function runSupabaseAutoMigration(customPassword?: string): Promise<{
  success: boolean;
  message: string;
  createdTables: string[];
  errors: string[];
}> {
  await ensurePgConfigResolved();
  const pwd = customPassword || pgConfig.password;
  const client = new Client({
    ...pgConfig,
    password: pwd,
  } as any);

  const createdTables: string[] = [
    'users',
    'classes',
    'students',
    'question_banks',
    'questions',
    'exams',
    'exam_participants',
    'answers',
    'settings',
    'site_settings',
  ];
  const errors: string[] = [];

  try {
    await client.connect();

    for (const statement of SUPABASE_SQL_STATEMENTS) {
      try {
        await client.query(statement);
      } catch (stmtErr: any) {
        // Ignore duplicate policy errors
        if (!stmtErr.message.includes('already exists')) {
          errors.push(stmtErr.message);
        }
      }
    }

    await client.end();

    return {
      success: errors.length === 0,
      message:
        errors.length === 0
          ? 'Seluruh 9 tabel, indeks performa, dan seed data berhasil dibuat otomatis di Supabase PostgreSQL.'
          : 'Tabel berhasil dibuat dengan beberapa catatan: ' + errors.join(', '),
      createdTables,
      errors,
    };
  } catch (err: any) {
    try {
      await client.end();
    } catch (_) {}
    return {
      success: false,
      message: err.message || 'Gagal mengeksekusi pembuatan tabel di database Supabase.',
      createdTables: [],
      errors: [err.message],
    };
  }
}
