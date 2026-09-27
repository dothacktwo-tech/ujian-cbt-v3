import dns from 'dns';
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { getPgPool, SUPABASE_SQL_STATEMENTS, ensurePgConfigResolved, pgConfig } from './pg.js';
import { AsyncLocalStorage } from 'async_hooks';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// AsyncLocalStorage to capture query context per Express request
export const dbStorage = new AsyncLocalStorage<Promise<any>[]>();

let dbInstance: Database | null = null;
let lastSyncTime = 0;
const SYNC_COOLDOWN = 5000; // 5-second cache to prevent duplicate Postgres requests on parallel API calls
let activeSyncPromise: Promise<void> | null = null;

export interface SqlDatabase {
  query<T = any>(sql: string, params?: any[]): T[];
  queryOne<T = any>(sql: string, params?: any[]): T | null;
  run(sql: string, params?: any[]): { changes: number; lastInsertRowid: number };
  transaction<T>(fn: () => T): T;
  exportBinary(): Uint8Array;
  persist(): void;
}

let cachedSqlJsPromise: Promise<any> | null = null;

async function getSqlJsEngine() {
  if (cachedSqlJsPromise) return cachedSqlJsPromise;

  cachedSqlJsPromise = (async () => {
    let wasmBinary: Buffer | undefined;

    // 1. Cek via require.resolve untuk lokasi ter-bundle
    try {
      const resolvedPath = require.resolve('sql.js/dist/sql-wasm.wasm');
      if (fs.existsSync(resolvedPath)) {
        wasmBinary = fs.readFileSync(resolvedPath);
      }
    } catch (_) {}

    // 2. Cek jalur lokal alternatif di sistem berkas
    if (!wasmBinary) {
      const localCandidates = [
        path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
        path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
        path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
        path.join(process.cwd(), 'sql-wasm.wasm'),
      ];

      for (const p of localCandidates) {
        if (fs.existsSync(p)) {
          try {
            wasmBinary = fs.readFileSync(p);
            break;
          } catch (_) {}
        }
      }
    }

    // 3. Jika tidak ditemukan di sistem berkas (misal di Vercel serverless tanpa file asset), fetch binary buffer
    if (!wasmBinary && typeof fetch === 'function') {
      try {
        const wasmRes = await fetch('https://unpkg.com/sql.js@1.14.2/dist/sql-wasm.wasm');
        if (wasmRes.ok) {
          wasmBinary = Buffer.from(await wasmRes.arrayBuffer());
        }
      } catch (err: any) {
        console.warn('[SQL.js WASM Fetch Warning] Gagal mengunduh wasm binary dari CDN:', err?.message);
      }
    }

    if (!wasmBinary) {
      throw new Error('Database WASM engine binary tidak dapat dimuat. Silakan periksa kembali konfigurasi DATABASE_URL di Vercel.');
    }

    return initSqlJs({
      wasmBinary: wasmBinary.buffer.slice(
        wasmBinary.byteOffset,
        wasmBinary.byteOffset + wasmBinary.byteLength
      ) as ArrayBuffer,
    });
  })();

  return cachedSqlJsPromise;
}

export async function getDb(): Promise<SqlDatabase> {
  const SQL = await getSqlJsEngine();

  if (!dbInstance) {
    dbInstance = new SQL.Database();
  }

  const now = Date.now();
  if (now - lastSyncTime > SYNC_COOLDOWN) {
    if (!activeSyncPromise) {
      activeSyncPromise = (async () => {
        try {
          await syncFromPostgres(dbInstance!);
          lastSyncTime = Date.now();
        } finally {
          activeSyncPromise = null;
        }
      })();
    }
    await activeSyncPromise;
  }

  return createWrapper(dbInstance!);
}

function translateSql(sql: string): string {
  let pgSql = sql;

  // 1. Replace placeholder ? with $1, $2, etc.
  let paramIndex = 1;
  pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

  // 2. Map SQLite-specific commands to PostgreSQL compliant upserts
  const lower = pgSql.toLowerCase();

  if (lower.includes('insert or replace into settings') || lower.includes('replace into settings')) {
    pgSql = `INSERT INTO public.settings (key, value, updated_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`;
  } 
  else if (lower.includes('insert or replace into site_settings') || lower.includes('replace into site_settings')) {
    pgSql = `INSERT INTO public.site_settings (key, value, updated_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`;
  } 
  else if (lower.includes('insert or replace into answers') || lower.includes('replace into answers')) {
    pgSql = `INSERT INTO public.answers (id, exam_id, student_id, question_id, answer, is_correct, score, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (exam_id, student_id, question_id) DO UPDATE SET
               answer = EXCLUDED.answer,
               is_correct = EXCLUDED.is_correct,
               score = EXCLUDED.score,
               updated_at = EXCLUDED.updated_at`;
  }
  else if (lower.includes('insert or ignore into')) {
    pgSql = pgSql.replace(/insert or ignore into/i, 'INSERT INTO');
    pgSql += ' ON CONFLICT DO NOTHING';
  }

  return pgSql;
}

async function syncFromPostgres(db: Database) {
  // 1. Ensure target schema and migrations exist inside SQLite FIRST
  try {
    let schemaSql = '';
    const schemaPath = path.resolve(process.cwd(), 'server', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      schemaSql = fs.readFileSync(schemaPath, 'utf8');
    } else {
      schemaSql = LOCAL_SQLITE_SCHEMA;
    }
    db.run(schemaSql);

    const sqliteMigrations = [
      "ALTER TABLE questions ADD COLUMN opsi_e TEXT DEFAULT '';",
      "ALTER TABLE questions ADD COLUMN kategori TEXT DEFAULT 'Umum';",
      "ALTER TABLE questions ADD COLUMN jumlah_opsi INTEGER DEFAULT 4;",
      "ALTER TABLE exam_participants ADD COLUMN last_heartbeat TEXT;",
      "ALTER TABLE exam_participants ADD COLUMN current_question_index INTEGER DEFAULT 0;",
      "ALTER TABLE exam_participants ADD COLUMN answered_count INTEGER DEFAULT 0;",
      "ALTER TABLE exam_participants ADD COLUMN ip_address TEXT;",
      `CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT
      );`
    ];
    for (const mig of sqliteMigrations) {
      try {
        db.run(mig);
      } catch (_) {}
    }

    // Seed default admin, classes, and students in SQLite if empty as resilient fallback
    const localUsers = db.exec("SELECT COUNT(*) as count FROM users;");
    const count = localUsers[0]?.values[0]?.[0] as number || 0;
    if (count === 0) {
      const now = new Date().toISOString();
      const adminHash = bcrypt.hashSync('admin123', 10);
      db.run(
        `INSERT OR IGNORE INTO users (id, username, password_hash, role, name, created_at, updated_at) 
         VALUES ('user-admin-1', 'admin', ?, 'admin', 'Administrator Utama', ?, ?)`,
        [adminHash, now, now]
      );

      // Default Classes
      db.run(
        `INSERT OR IGNORE INTO classes (id, nama_kelas, tingkat, tahun_ajaran, status, created_at, updated_at)
         VALUES ('cls-1', 'X IPA 1', '10', '2024/2025', 'aktif', ?, ?)`,
        [now, now]
      );

      // Default Student (ahmad / siswa123)
      const studentHash = bcrypt.hashSync('siswa123', 10);
      db.run(
        `INSERT OR IGNORE INTO students (id, nis, nama, username, password_hash, class_id, status, created_at, updated_at)
         VALUES ('std-1', '1001', 'Ahmad Fadillah', 'ahmad', ?, 'cls-1', 'aktif', ?, ?)`,
        [studentHash, now, now]
      );

      // Default Site Settings
      db.run(`INSERT OR IGNORE INTO site_settings (key, value, updated_at) VALUES ('school_name', 'SMA Negeri 1 Nusantara', ?);`, [now]);
      db.run(`INSERT OR IGNORE INTO site_settings (key, value, updated_at) VALUES ('login_title', 'Login Ujian CBT', ?);`, [now]);
      db.run(`INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('school_name', 'SMA Negeri 1 Nusantara', ?);`, [now]);
    }
  } catch (localDbErr: any) {
    console.error('[Database Local Schema Error]', localDbErr.message);
  }

  // 2. Connect and sync from Supabase PostgreSQL if credentials configured
  try {
    await ensurePgConfigResolved();
    const pool = getPgPool();

    // Cek apakah password atau DATABASE_URL telah dikonfigurasi
    if (!pgConfig.password && !process.env.DATABASE_URL) {
      console.info('[Supabase Sync Info] PGPASSWORD atau DATABASE_URL belum diatur. Menjalankan sistem dengan database lokal in-memory.');
      return;
    }

    // Verify connection / table schema on Supabase PostgreSQL
    try {
      await pool.query('SELECT 1 FROM public.users LIMIT 1');
    } catch (err: any) {
      console.info('[Supabase Sync] Schema tidak ditemukan di PostgreSQL. Menjalankan auto-migration...');
      for (const stmt of SUPABASE_SQL_STATEMENTS) {
        try {
          await pool.query(stmt);
        } catch (e: any) {
          if (!e.message.includes('already exists')) {
            console.warn('[Supabase Sync Warning] migration detail:', e.message);
          }
        }
      }
    }

    // Ensure any existing database tables are fully up-to-date with new columns & relaxed constraints
    const pgAlterations = [
      "ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS opsi_e TEXT DEFAULT '';",
      "ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS kategori TEXT DEFAULT 'Umum';",
      "ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS jumlah_opsi INTEGER DEFAULT 4;",
      "ALTER TABLE public.exam_participants ADD COLUMN IF NOT EXISTS last_heartbeat TEXT;",
      "ALTER TABLE public.exam_participants ADD COLUMN IF NOT EXISTS current_question_index INTEGER DEFAULT 0;",
      "ALTER TABLE public.exam_participants ADD COLUMN IF NOT EXISTS answered_count INTEGER DEFAULT 0;",
      "ALTER TABLE public.exam_participants ADD COLUMN IF NOT EXISTS ip_address TEXT;",
      "ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_jawaban_benar_check;",
      "ALTER TABLE public.answers DROP CONSTRAINT IF EXISTS answers_answer_check;"
    ];
    for (const alt of pgAlterations) {
      try {
        await pool.query(alt);
      } catch (e: any) {
        // Safe alteration warning
      }
    }

    // Seed initial data into Supabase if public.users is completely empty
    try {
      const userCountRes = await pool.query('SELECT COUNT(*) as count FROM public.users');
      const count = parseInt(userCountRes.rows[0]?.count || '0', 10);
      if (count === 0) {
        console.info('[Supabase Sync] Supabase database kosong. Menjalankan seed awal di Supabase...');
        await seedInitialDataPostgres(pool);
      }
    } catch (seedErr: any) {
      console.warn('[Supabase Sync Warning] Seeding Supabase notice:', seedErr.message);
    }

    // 3. Fetch all rows from PostgreSQL and sync into SQL.js memory database sequentially
    const tables = [
      'users',
      'classes',
      'students',
      'question_banks',
      'questions',
      'exams',
      'exam_participants',
      'answers',
      'settings',
      'site_settings'
    ];

    for (const table of tables) {
      try {
        const pgRes = await pool.query(`SELECT * FROM public.${table}`);

        if (pgRes.rows.length === 0) continue;

        // Clear local rows to receive the latest data from PostgreSQL
        db.run(`DELETE FROM ${table};`);

        const columns = Object.keys(pgRes.rows[0]);
        const placeholders = columns.map(() => '?').join(', ');
        const insertSql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders});`;

        for (const row of pgRes.rows) {
          const vals = columns.map(col => {
            const val = row[col];
            if (val instanceof Date) {
              return val.toISOString();
            }
            return val;
          });
          db.run(insertSql, vals);
        }
      } catch (tableErr: any) {
        console.warn(`[Supabase Sync] Sinkronisasi tabel ${table} dilewati:`, tableErr.message);
      }
    }
  } catch (pgConnErr: any) {
    console.error('[Supabase PostgreSQL Connection Error]: Gagal menghubungkan ke Supabase PostgreSQL:', {
      message: pgConnErr.message,
      code: pgConnErr.code,
      host: pgConnErr.address || process.env.PGHOST,
      hint: 'Periksa DATABASE_URL atau PGPASSWORD di dashboard Vercel / file .env'
    });
  }
}

function createWrapper(db: Database): SqlDatabase {
  return {
    query<T = any>(sql: string, params: any[] = []): T[] {
      const stmt = db.prepare(sql);
      try {
        if (params && params.length > 0) {
          stmt.bind(params);
        }
        const results: T[] = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject() as unknown as T);
        }
        return results;
      } finally {
        stmt.free();
      }
    },

    queryOne<T = any>(sql: string, params: any[] = []): T | null {
      const rows = this.query<T>(sql, params);
      return rows.length > 0 ? rows[0] : null;
    },

    run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
      try {
        // Execute inside SQL.js instantly
        db.run(sql, params && params.length > 0 ? params : undefined);
        const changes = db.getRowsModified();

        // Propagate query directly to Supabase PostgreSQL in the background
        const pgSql = translateSql(sql);
        const promises = dbStorage.getStore();
        const promise = getPgPool().query(pgSql, params)
          .catch(err => {
            console.error('[PostgreSQL Query Fail] SQL:', pgSql, 'Params:', params, 'Err:', err.message);
          });

        if (promises) {
          promises.push(promise);
        }

        return { changes, lastInsertRowid: 0 };
      } catch (err) {
        console.error('SQL.js Local Execution Error:', sql, params, err);
        throw err;
      }
    },

    transaction<T>(fn: () => T): T {
      try {
        db.run('BEGIN TRANSACTION;');
        const result = fn();
        db.run('COMMIT;');
        return result;
      } catch (err) {
        try {
          db.run('ROLLBACK;');
        } catch (_) {}
        throw err;
      }
    },

    exportBinary(): Uint8Array {
      return db.export();
    },

    persist() {
      // Auto-persisted to Postgres via AsyncLocalStorage query propagation
    }
  };
}

async function seedInitialDataPostgres(pool: any) {
  const now = new Date().toISOString();
  const adminPasswordHash = bcrypt.hashSync('admin123', 10);

  // 1. Seed Admin
  await pool.query(
    `INSERT INTO public.users (id, username, password_hash, role, name, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
    ['user-admin-1', 'admin', adminPasswordHash, 'admin', 'Administrator Utama', now, now]
  );

  // 2. Seed Settings
  const defaultSettings: [string, string][] = [
    ['school_name', 'SMA Negeri 1 Nusantara'],
    ['academic_year', '2024/2025'],
    ['school_logo', ''],
    ['default_shuffle_questions', '0'],
    ['default_shuffle_answers', '0'],
    ['default_show_score', '1'],
  ];
  for (const [k, v] of defaultSettings) {
    await pool.query(
      `INSERT INTO public.settings (key, value, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      [k, v, now]
    );
  }

  // 3. Seed Site Settings
  const defaultSiteSettings: [string, string][] = [
    ['school_name', 'SMA Negeri 1 Nusantara'],
    ['academic_year', '2024/2025'],
    ['login_title', 'Login Ujian CBT'],
    ['login_description', 'Silakan masuk untuk mengikuti ujian.'],
    ['primary_color', '#FFB646'],
    ['button_color', '#6097EA'],
    ['background_color', '#EAF2FF']
  ];
  for (const [k, v] of defaultSiteSettings) {
    await pool.query(
      `INSERT INTO public.site_settings (key, value, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      [k, v, now]
    );
  }

  // 4. Seed Classes
  const classes = [
    { id: 'cls-1', nama_kelas: 'X IPA 1', tingkat: '10', tahun_ajaran: '2024/2025' },
    { id: 'cls-2', nama_kelas: 'X IPA 2', tingkat: '10', tahun_ajaran: '2024/2025' },
    { id: 'cls-3', nama_kelas: 'XI IPA 1', tingkat: '11', tahun_ajaran: '2024/2025' },
    { id: 'cls-4', nama_kelas: 'XII IPA 1', tingkat: '12', tahun_ajaran: '2024/2025' },
  ];
  for (const cls of classes) {
    await pool.query(
      `INSERT INTO public.classes (id, nama_kelas, tingkat, tahun_ajaran, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'aktif', $5, $6) ON CONFLICT DO NOTHING`,
      [cls.id, cls.nama_kelas, cls.tingkat, cls.tahun_ajaran, now, now]
    );
  }

  // 5. Seed Students
  const studentPasswordHash = bcrypt.hashSync('siswa123', 10);
  const students = [
    { id: 'std-1', nis: '1001', nama: 'Ahmad Fadillah', username: 'ahmad', class_id: 'cls-1' },
    { id: 'std-2', nis: '1002', nama: 'Budi Santoso', username: 'budi', class_id: 'cls-1' },
    { id: 'std-3', nis: '1003', nama: 'Citra Dewi Lestari', username: 'citra', class_id: 'cls-1' },
    { id: 'std-4', nis: '1004', nama: 'Dian Permata', username: 'dian', class_id: 'cls-1' },
    { id: 'std-5', nis: '1005', nama: 'Eko Prasetyo', username: 'eko', class_id: 'cls-1' },
    { id: 'std-6', nis: '1006', nama: 'Fajar Nugroho', username: 'fajar', class_id: 'cls-2' },
    { id: 'std-7', nis: '1007', nama: 'Gita Savitri', username: 'gita', class_id: 'cls-2' },
  ];
  for (const std of students) {
    await pool.query(
      `INSERT INTO public.students (id, nis, nama, username, password_hash, class_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'aktif', $7, $8) ON CONFLICT DO NOTHING`,
      [std.id, std.nis, std.nama, std.username, studentPasswordHash, std.class_id, now, now]
    );
  }

  // 6. Seed Question Banks
  const qb1Id = 'qb-mat-1';
  await pool.query(
    `INSERT INTO public.question_banks (id, nama_bank, mata_pelajaran, kelas_id, deskripsi, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'aktif', $6, $7) ON CONFLICT DO NOTHING`,
    [qb1Id, 'Matematika Wajib - Aljabar & Eksponen', 'Matematika', 'cls-1', 'Bank Soal Ujian Tengah Semester Bab 1 & 2', now, now]
  );

  const questionsMat = [
    {
      id: 'q-mat-1',
      pertanyaan: 'Bentuk sederhana dari (2^3 * 2^4) / 2^2 adalah...',
      opsi_a: '2^5',
      opsi_b: '2^6',
      opsi_c: '2^7',
      opsi_d: '2^9',
      jawaban_benar: 'A',
      bobot: 1.0,
    },
    {
      id: 'q-mat-2',
      pertanyaan: 'Jika 3^(2x - 1) = 27, maka nilai x yang memenuhi adalah...',
      opsi_a: '1',
      opsi_b: '2',
      opsi_c: '3',
      opsi_d: '4',
      jawaban_benar: 'B',
      bobot: 1.0,
    },
    {
      id: 'q-mat-3',
      pertanyaan: 'Nilai dari ^2log 16 + ^3log 27 - ^5log 25 adalah...',
      opsi_a: '3',
      opsi_b: '4',
      opsi_c: '5',
      opsi_d: '6',
      jawaban_benar: 'C',
      bobot: 1.0,
    },
    {
      id: 'q-mat-4',
      pertanyaan: 'Himpunan penyelesaian dari persamaan kuadrat x^2 - 5x + 6 = 0 adalah...',
      opsi_a: '{1, 6}',
      opsi_b: '{-2, -3}',
      opsi_c: '{2, 3}',
      opsi_d: '{-1, -6}',
      jawaban_benar: 'C',
      bobot: 1.0,
    },
    {
      id: 'q-mat-5',
      pertanyaan: 'Grafik fungsi kuadrat f(x) = x^2 - 4x + 3 memotong sumbu Y di titik...',
      opsi_a: '(0, 3)',
      opsi_b: '(3, 0)',
      opsi_c: '(0, -3)',
      opsi_d: '(1, 0)',
      jawaban_benar: 'A',
      bobot: 1.0,
    },
  ];
  for (const q of questionsMat) {
    await pool.query(
      `INSERT INTO public.questions (id, question_bank_id, pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d, jawaban_benar, bobot, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT DO NOTHING`,
      [q.id, qb1Id, q.pertanyaan, q.opsi_a, q.opsi_b, q.opsi_c, q.opsi_d, q.jawaban_benar, q.bobot, now, now]
    );
  }

  const qb2Id = 'qb-ind-1';
  await pool.query(
    `INSERT INTO public.question_banks (id, nama_bank, mata_pelajaran, kelas_id, deskripsi, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'aktif', $6, $7) ON CONFLICT DO NOTHING`,
    [qb2Id, 'Bahasa Indonesia - Teks Laporan Hasil Observasi', 'Bahasa Indonesia', 'cls-1', 'Ujian Harian Bab Teks LHO', now, now]
  );

  const questionsInd = [
    {
      id: 'q-ind-1',
      pertanyaan: 'Teks yang berisi penjabaran umum mengenai sesuatu yang didasarkan pada hasil pengamatan disebut...',
      opsi_a: 'Teks Eksposisi',
      opsi_b: 'Teks Laporan Hasil Observasi',
      opsi_c: 'Teks Anekdot',
      opsi_d: 'Teks Negosiasi',
      jawaban_benar: 'B',
      bobot: 1.0,
    },
    {
      id: 'q-ind-2',
      pertanyaan: 'Ciri utama dari teks laporan hasil observasi adalah bersifat...',
      opsi_a: 'Subjektif dan imajinatif',
      opsi_b: 'Objektif, faktual, dan sistematis',
      opsi_c: 'Fiktif dan menghibur',
      opsi_d: 'Persuasif dan mengajak pembaca',
      jawaban_benar: 'B',
      bobot: 1.0,
    },
    {
      id: 'q-ind-3',
      pertanyaan: 'Struktur teks laporan hasil observasi yang benar adalah...',
      opsi_a: 'Pernyataan umum, deskripsi bagian, deskripsi manfaat',
      opsi_b: 'Orientasi, komplikasi, resolusi',
      opsi_c: 'Tesis, argumentasi, penegasan ulang',
      opsi_d: 'Abstraksi, orientasi, krisis, reaksi, koda',
      jawaban_benar: 'A',
      bobot: 1.0,
    },
  ];
  for (const q of questionsInd) {
    await pool.query(
      `INSERT INTO public.questions (id, question_bank_id, pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d, jawaban_benar, bobot, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT DO NOTHING`,
      [q.id, qb2Id, q.pertanyaan, q.opsi_a, q.opsi_b, q.opsi_c, q.opsi_d, q.jawaban_benar, q.bobot, now, now]
    );
  }

  // 7. Seed Sample Exam
  const today = now.split('T')[0];
  const exam1Id = 'exam-1';
  const token1 = 'MAT101';
  await pool.query(
    `INSERT INTO public.exams (
      id, nama_ujian, mata_pelajaran, class_id, question_bank_id, tanggal, waktu_mulai, waktu_selesai,
      durasi_menit, token, shuffle_questions, shuffle_answers, tampilkan_nilai, status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'aktif', $14, $15) ON CONFLICT DO NOTHING`,
    [
      exam1Id,
      'Penilaian Harian Matematika Wajib',
      'Matematika',
      'cls-1',
      qb1Id,
      today,
      '07:00',
      '23:59',
      60,
      token1,
      1,
      1,
      1,
      now,
      now,
    ]
  );

  // 8. Seed Participants
  for (const std of students) {
    await pool.query(
      `INSERT INTO public.exam_participants (
        id, exam_id, student_id, status, score, total_questions, correct_answers, wrong_answers, created_at, updated_at
      ) VALUES ($1, $2, $3, 'belum_mulai', 0, 0, 0, 0, $4, $5) ON CONFLICT DO NOTHING`,
      [`part-${exam1Id}-${std.id}`, exam1Id, std.id, now, now]
    );
  }
}

const LOCAL_SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  nama_kelas TEXT NOT NULL,
  tingkat TEXT NOT NULL,
  tahun_ajaran TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktif',
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
  status TEXT NOT NULL DEFAULT 'aktif',
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
  jawaban_benar TEXT NOT NULL,
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
  tanggal TEXT NOT NULL,
  waktu_mulai TEXT NOT NULL,
  waktu_selesai TEXT NOT NULL,
  durasi_menit INTEGER NOT NULL,
  token TEXT NOT NULL,
  shuffle_questions INTEGER NOT NULL DEFAULT 0,
  shuffle_answers INTEGER NOT NULL DEFAULT 0,
  tampilkan_nilai INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'aktif',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_participants (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  started_at TEXT,
  submitted_at TEXT,
  status TEXT NOT NULL DEFAULT 'belum_mulai',
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
  answer TEXT,
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

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_questions_bank ON questions(question_bank_id);
CREATE INDEX IF NOT EXISTS idx_exams_class ON exams(class_id);
CREATE INDEX IF NOT EXISTS idx_participants_exam ON exam_participants(exam_id);
CREATE INDEX IF NOT EXISTS idx_participants_student ON exam_participants(student_id);
CREATE INDEX IF NOT EXISTS idx_answers_exam_student ON answers(exam_id, student_id);
`;
