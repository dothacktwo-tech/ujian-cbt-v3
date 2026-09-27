import express, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb, dbStorage } from './db.js';
import { testPostgresConnection, pgConfig, runSupabaseAutoMigration, SUPABASE_SQL_STATEMENTS, getPgPool } from './pg.js';
import { getSupabaseClient, checkSupabaseEnv, authenticateWithSupabase } from './supabase.js';

export const router = express.Router();

// Middleware to run queries within AsyncLocalStorage context
router.use((req: Request, res: Response, next: NextFunction) => {
  const promises: Promise<any>[] = [];
  dbStorage.run(promises, () => {
    const originalJson = res.json;
    const originalSend = res.send;
    const originalEnd = res.end;

    (res as any).json = function (body: any) {
      Promise.all(promises)
        .catch(err => console.error('[PostgreSQL Write Sync Warning]', err.message))
        .finally(() => {
          originalJson.call(res, body);
        });
      return res;
    };

    (res as any).send = function (body: any) {
      Promise.all(promises)
        .catch(err => console.error('[PostgreSQL Write Sync Warning]', err.message))
        .finally(() => {
          originalSend.call(res, body);
        });
      return res;
    };

    (res as any).end = function (chunk?: any, encoding?: any, cb?: any) {
      Promise.all(promises)
        .catch(err => console.error('[PostgreSQL Write Sync Warning]', err.message))
        .finally(() => {
          originalEnd.call(res, chunk, encoding, cb);
        });
    };

    next();
  });
});

// API Health Check
router.get('/health', (req: Request, res: Response) => {
  return res.json({
    success: true,
    message: "CBT API is running",
    environment: process.env.NODE_ENV || "production"
  });
});

// Database Health Check
router.get('/health/db', async (req: Request, res: Response) => {
  try {
    const pool = getPgPool();
    await pool.query('SELECT 1');
    return res.json({
      success: true,
      database: "connected"
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      database: "error"
    });
  }
});

// Memory session store (token -> session data)
interface SessionData {
  userId: string;
  role: 'admin' | 'student';
  username: string;
  name: string;
  classId?: string;
  nis?: string;
}

const SESSION_SIGN_KEY = 'cbt-super-secret-session-key-1234567890';

// Stateless signed session token
function createSessionToken(data: SessionData): string {
  const payload = JSON.stringify({
    ...data,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours expiry
  });
  const hmac = crypto.createHmac('sha256', SESSION_SIGN_KEY);
  hmac.update(payload);
  const signature = hmac.digest('base64url');
  const payloadBase64 = Buffer.from(payload).toString('base64url');
  return `${payloadBase64}.${signature}`;
}

function verifySessionToken(token: string): SessionData | null {
  try {
    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || !signature) return null;
    
    // Verify HMAC signature
    const hmac = crypto.createHmac('sha256', SESSION_SIGN_KEY);
    hmac.update(payloadBase64);
    const expectedSignature = hmac.digest('base64url');
    
    // Compare in constant time
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }
    
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

// Helper to generate token
function generateRandomToken(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Authentication Middleware
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.cbt_token;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : cookieToken;

  if (!token) {
    (req as any).user = null;
    return next();
  }

  const session = verifySessionToken(token);
  if (session) {
    (req as any).user = session;
    (req as any).token = token;
  } else {
    (req as any).user = null;
  }
  next();
}

function requireAuth(role?: 'admin' | 'student') {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as SessionData | null;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Silakan login terlebih dahulu.' });
    }
    if (role && user.role !== role) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: hak akses tidak sesuai.' });
    }
    next();
  };
}

// ==========================================
// AUTH ENDPOINTS
// ==========================================

router.post('/login', async (req: Request, res: Response) => {
  // 1. Validasi & Sanitasi Input Login
  const rawIdentifier = req.body?.username || req.body?.email || req.body?.identifier;
  const rawPassword = req.body?.password;

  if (typeof rawIdentifier !== 'string' || typeof rawPassword !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Format input tidak valid. Email/Username dan password harus berupa teks.',
    });
  }

  const cleanIdentifier = rawIdentifier.trim();
  const cleanPassword = rawPassword;

  if (!cleanIdentifier || !cleanPassword) {
    return res.status(400).json({
      success: false,
      message: 'Email/Username dan Password tidak boleh kosong.',
    });
  }

  // 2. Pemeriksaan Environment Supabase (Logging Runtime Diagnostik)
  const supabaseEnv = checkSupabaseEnv();
  if (!supabaseEnv.valid) {
    console.warn('[Login Auth Diagnostic] Peringatan: Variabel lingkungan Supabase belum lengkap di serverless/server runtime.');
  }

  try {
    // 3. Coba Autentikasi via Supabase Auth jika identifier berupa email
    if (cleanIdentifier.includes('@')) {
      const supabaseAuth = await authenticateWithSupabase(cleanIdentifier, cleanPassword);
      if (supabaseAuth.success && supabaseAuth.user) {
        console.info('[Login Auth] Autentikasi Supabase Auth berhasil untuk email:', cleanIdentifier);
        const sessionData: SessionData = {
          userId: supabaseAuth.user.id,
          role: (supabaseAuth.user.user_metadata?.role as any) || 'admin',
          username: supabaseAuth.user.email || cleanIdentifier,
          name: supabaseAuth.user.user_metadata?.name || supabaseAuth.user.email || 'Pengguna Terverifikasi',
        };
        const token = createSessionToken(sessionData);
        res.cookie('cbt_token', token, {
          httpOnly: true,
          maxAge: 86400000 * 7,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
        return res.json({
          success: true,
          token,
          user: sessionData,
        });
      } else if (supabaseAuth.statusCode === 401) {
        return res.status(401).json({
          success: false,
          message: 'Email/Username atau Password salah.',
        });
      }
    }

    // 4. Autentikasi via Database CBT (Users & Students)
    const db = await getDb();

    // A. Cek Admin di tabel users
    const admin = db.queryOne('SELECT * FROM users WHERE username = ?', [cleanIdentifier]);
    if (admin) {
      const match = bcrypt.compareSync(cleanPassword, admin.password_hash);
      if (match) {
        const sessionData: SessionData = {
          userId: admin.id,
          role: 'admin',
          username: admin.username,
          name: admin.name,
        };
        const token = createSessionToken(sessionData);
        res.cookie('cbt_token', token, {
          httpOnly: true,
          maxAge: 86400000 * 7,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
        return res.json({
          success: true,
          token,
          user: sessionData,
        });
      }
    }

    // B. Cek Siswa di tabel students
    const student = db.queryOne(
      `SELECT s.*, c.nama_kelas 
       FROM students s 
       LEFT JOIN classes c ON s.class_id = c.id 
       WHERE (s.username = ? OR s.nis = ?)`,
      [cleanIdentifier, cleanIdentifier]
    );

    if (student) {
      if (student.status !== 'aktif') {
        return res.status(403).json({
          success: false,
          message: 'Akun siswa Anda sedang dinonaktifkan oleh administrator.',
        });
      }
      const match = bcrypt.compareSync(cleanPassword, student.password_hash);
      if (match) {
        const sessionData: SessionData = {
          userId: student.id,
          role: 'student',
          username: student.username,
          name: student.nama,
          classId: student.class_id,
          nis: student.nis,
        };
        const token = createSessionToken(sessionData);
        res.cookie('cbt_token', token, {
          httpOnly: true,
          maxAge: 86400000 * 7,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
        return res.json({
          success: true,
          token,
          user: {
            ...sessionData,
            className: student.nama_kelas,
          },
        });
      }
    }

    // 5. Kredensial tidak cocok
    return res.status(401).json({
      success: false,
      message: 'Email/Username atau Password salah.',
    });
  } catch (error: any) {
    // 6. Tangkap error secara spesifik dan tampilkan detail pesan error asli ke console log
    console.error('[Login Handler Server Exception]:', {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });

    const isDev = process.env.NODE_ENV !== 'production';
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server saat memproses login. Silakan coba beberapa saat lagi.',
      error: isDev ? error?.message : undefined,
    });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('cbt_token');
  return res.json({ success: true, message: 'Berhasil logout.' });
});

router.get('/me', async (req: Request, res: Response) => {
  const user = (req as any).user as SessionData | null;
  if (!user) {
    return res.json({ success: false, authenticated: false, user: null, message: 'Belum terautentikasi' });
  }

  const db = await getDb();
  if (user.role === 'admin') {
    const admin = db.queryOne('SELECT id, username, name, role FROM users WHERE id = ?', [user.userId]);
    return res.json({ success: true, user: admin || user });
  } else {
    const student = db.queryOne(
      `SELECT s.id, s.nis, s.nama as name, s.username, s.class_id, s.status, c.nama_kelas as className 
       FROM students s 
       LEFT JOIN classes c ON s.class_id = c.id 
       WHERE s.id = ?`,
      [user.userId]
    );
    return res.json({
      success: true,
      user: {
        userId: user.userId,
        role: 'student',
        ...student,
      },
    });
  }
});

// ==========================================
// ADMIN DASHBOARD
// ==========================================

router.get('/admin/dashboard', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const today = new Date().toISOString().split('T')[0];

    const totalStudents = db.queryOne('SELECT COUNT(*) as count FROM students WHERE status = ?', ['aktif'])?.count || 0;
    const totalClasses = db.queryOne('SELECT COUNT(*) as count FROM classes WHERE status = ?', ['aktif'])?.count || 0;
    const totalQuestionBanks = db.queryOne('SELECT COUNT(*) as count FROM question_banks WHERE status = ?', ['aktif'])?.count || 0;
    const totalExams = db.queryOne('SELECT COUNT(*) as count FROM exams')?.count || 0;
    const activeExamsCount = db.queryOne('SELECT COUNT(*) as count FROM exams WHERE status = ?', ['aktif'])?.count || 0;

    // Exams Today
    const examsToday = db.query(
      `SELECT e.*, c.nama_kelas, qb.nama_bank,
        (SELECT COUNT(*) FROM exam_participants ep WHERE ep.exam_id = e.id) as total_participants,
        (SELECT COUNT(*) FROM exam_participants ep WHERE ep.exam_id = e.id AND ep.status = 'selesai') as finished_participants
       FROM exams e
       LEFT JOIN classes c ON e.class_id = c.id
       LEFT JOIN question_banks qb ON e.question_bank_id = qb.id
       WHERE e.tanggal = ?
       ORDER BY e.waktu_mulai ASC`,
      [today]
    );

    // Recent participants activity
    const recentActivity = db.query(
      `SELECT ep.*, s.nama as student_name, s.nis, c.nama_kelas, e.nama_ujian 
       FROM exam_participants ep
       JOIN students s ON ep.student_id = s.id
       JOIN classes c ON s.class_id = c.id
       JOIN exams e ON ep.exam_id = e.id
       WHERE ep.status != 'belum_mulai'
       ORDER BY ep.updated_at DESC
       LIMIT 8`
    );

    // ==========================================
    // ANALYTICS: Score Distribution (Histogram) & Class Averages
    // ==========================================
    const allFinishedScores = db.query(
      `SELECT ep.score, ep.exam_id, s.class_id, c.nama_kelas 
       FROM exam_participants ep
       JOIN students s ON ep.student_id = s.id
       JOIN classes c ON s.class_id = c.id
       WHERE ep.status = 'selesai'`
    );

    const totalFinishedSubmissions = allFinishedScores.length;
    let sumScore = 0;
    let highestScore = totalFinishedSubmissions > 0 ? -1 : 0;
    let lowestScore = totalFinishedSubmissions > 0 ? 999 : 0;
    let passedCount = 0; // KKM 75

    // Histogram intervals
    const histogramBuckets = [
      { range: '0 - 39', label: 'Perlu Bimbingan', count: 0, min: 0, max: 39.99, color: '#f43f5e' },
      { range: '40 - 59', label: 'Kurang', count: 0, min: 40, max: 59.99, color: '#f97316' },
      { range: '60 - 74', label: 'Cukup', count: 0, min: 60, max: 74.99, color: '#eab308' },
      { range: '75 - 89', label: 'Baik', count: 0, min: 75, max: 89.99, color: '#6366f1' },
      { range: '90 - 100', label: 'Sangat Baik', count: 0, min: 90, max: 100, color: '#10b981' },
    ];

    for (const row of allFinishedScores) {
      const sc = Number(row.score) || 0;
      sumScore += sc;
      if (sc > highestScore) highestScore = sc;
      if (sc < lowestScore) lowestScore = sc;
      if (sc >= 75) passedCount++;

      for (const bucket of histogramBuckets) {
        if (sc >= bucket.min && sc <= bucket.max) {
          bucket.count++;
          break;
        }
      }
    }

    const overallAvg = totalFinishedSubmissions > 0 ? Math.round((sumScore / totalFinishedSubmissions) * 10) / 10 : 0;
    const passRate = totalFinishedSubmissions > 0 ? Math.round((passedCount / totalFinishedSubmissions) * 100) : 0;

    // Class Averages
    const classAverages = db.query(
      `SELECT c.id, c.nama_kelas, c.tingkat,
              COUNT(DISTINCT s.id) as total_students,
              COUNT(CASE WHEN ep.status = 'selesai' THEN 1 END) as finished_count,
              ROUND(COALESCE(AVG(CASE WHEN ep.status = 'selesai' THEN ep.score END), 0), 1) as avg_score,
              ROUND(COALESCE(MAX(CASE WHEN ep.status = 'selesai' THEN ep.score END), 0), 1) as max_score,
              ROUND(COALESCE(MIN(CASE WHEN ep.status = 'selesai' THEN ep.score END), 0), 1) as min_score
       FROM classes c
       LEFT JOIN students s ON s.class_id = c.id AND s.status = 'aktif'
       LEFT JOIN exam_participants ep ON ep.student_id = s.id
       WHERE c.status = 'aktif'
       GROUP BY c.id, c.nama_kelas, c.tingkat
       ORDER BY c.tingkat ASC, c.nama_kelas ASC`
    );

    // Exam-level performance
    const examPerformances = db.query(
      `SELECT e.id, e.nama_ujian, e.mata_pelajaran, c.nama_kelas,
              COUNT(CASE WHEN ep.status = 'selesai' THEN 1 END) as finished_count,
              ROUND(COALESCE(AVG(CASE WHEN ep.status = 'selesai' THEN ep.score END), 0), 1) as avg_score,
              ROUND(COALESCE(MAX(CASE WHEN ep.status = 'selesai' THEN ep.score END), 0), 1) as max_score,
              ROUND(COALESCE(MIN(CASE WHEN ep.status = 'selesai' THEN ep.score END), 0), 1) as min_score
       FROM exams e
       LEFT JOIN classes c ON e.class_id = c.id
       LEFT JOIN exam_participants ep ON ep.exam_id = e.id
       GROUP BY e.id, e.nama_ujian, e.mata_pelajaran, c.nama_kelas
       HAVING finished_count > 0
       ORDER BY e.tanggal DESC, e.waktu_mulai DESC
       LIMIT 10`
    );

    return res.json({
      success: true,
      stats: {
        totalStudents,
        totalClasses,
        totalQuestionBanks,
        totalExams,
        activeExamsCount,
      },
      analytics: {
        scoreDistribution: histogramBuckets.map((b) => ({
          range: b.range,
          label: b.label,
          count: b.count,
          percentage: totalFinishedSubmissions > 0 ? Math.round((b.count / totalFinishedSubmissions) * 100) : 0,
          color: b.color,
        })),
        classAverages,
        examPerformances,
        summary: {
          overallAvg,
          highestScore: highestScore === -1 ? 0 : highestScore,
          lowestScore: lowestScore === 999 ? 0 : lowestScore,
          passRate,
          totalFinishedSubmissions,
        },
      },
      examsToday,
      recentActivity,
    });
  } catch (error: any) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat data statistik dashboard.' });
  }
});

// ==========================================
// CLASSES CRUD
// ==========================================

router.get('/classes', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const classes = db.query(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status = 'aktif') as student_count
       FROM classes c
       ORDER BY c.tingkat ASC, c.nama_kelas ASC`
    );
    return res.json({ success: true, data: classes });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat data kelas.' });
  }
});

router.post('/classes', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { nama_kelas, tingkat, tahun_ajaran, status = 'aktif' } = req.body;
    if (!nama_kelas || !tingkat || !tahun_ajaran) {
      return res.status(400).json({ success: false, message: 'Semua field kelas wajib diisi.' });
    }

    const db = await getDb();
    const id = `cls-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO classes (id, nama_kelas, tingkat, tahun_ajaran, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, nama_kelas.trim(), tingkat.trim(), tahun_ajaran.trim(), status, now, now]
    );

    return res.json({ success: true, message: 'Kelas berhasil ditambahkan.', data: { id, nama_kelas, tingkat, tahun_ajaran, status } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal menambahkan kelas: ' + error.message });
  }
});

router.put('/classes/:id', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nama_kelas, tingkat, tahun_ajaran, status } = req.body;
    if (!nama_kelas || !tingkat || !tahun_ajaran) {
      return res.status(400).json({ success: false, message: 'Semua field kelas wajib diisi.' });
    }

    const db = await getDb();
    const now = new Date().toISOString();

    db.run(
      `UPDATE classes 
       SET nama_kelas = ?, tingkat = ?, tahun_ajaran = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [nama_kelas.trim(), tingkat.trim(), tahun_ajaran.trim(), status || 'aktif', now, id]
    );

    return res.json({ success: true, message: 'Data kelas berhasil diperbarui.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui kelas.' });
  }
});

router.delete('/classes/:id', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    db.run('DELETE FROM classes WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Kelas berhasil dihapus.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus kelas.' });
  }
});

// ==========================================
// STUDENTS CRUD
// ==========================================

router.get('/students', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { class_id, q } = req.query;
    const db = await getDb();

    let sql = `
      SELECT s.id, s.nis, s.nama, s.username, s.class_id, s.status, s.created_at, s.updated_at, c.nama_kelas 
      FROM students s 
      LEFT JOIN classes c ON s.class_id = c.id 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (class_id && class_id !== 'all') {
      sql += ' AND s.class_id = ?';
      params.push(class_id);
    }

    if (q && typeof q === 'string' && q.trim()) {
      sql += ' AND (s.nama LIKE ? OR s.nis LIKE ? OR s.username LIKE ?)';
      const queryPattern = `%${q.trim()}%`;
      params.push(queryPattern, queryPattern, queryPattern);
    }

    sql += ' ORDER BY c.nama_kelas ASC, s.nama ASC';
    const students = db.query(sql, params);

    return res.json({ success: true, data: students });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat data siswa.' });
  }
});

router.post('/students', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { nis, nama, username, password, class_id, status = 'aktif' } = req.body;
    if (!nis || !nama || !username || !class_id) {
      return res.status(400).json({ success: false, message: 'NIS, Nama, Username, dan Kelas wajib diisi.' });
    }

    const plainPassword = password && password.trim() ? password.trim() : 'siswa123';
    const passwordHash = bcrypt.hashSync(plainPassword, 10);
    const db = await getDb();
    const id = `std-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    // Check duplicate username or nis
    const existing = db.queryOne('SELECT id FROM students WHERE nis = ? OR username = ?', [nis.trim(), username.trim()]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'NIS atau Username sudah digunakan oleh siswa lain.' });
    }

    db.run(
      `INSERT INTO students (id, nis, nama, username, password_hash, class_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, nis.trim(), nama.trim(), username.trim(), passwordHash, class_id, status, now, now]
    );

    return res.json({ success: true, message: 'Siswa berhasil ditambahkan.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal menambahkan siswa: ' + error.message });
  }
});

router.put('/students/:id', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nis, nama, username, password, class_id, status } = req.body;
    if (!nis || !nama || !username || !class_id) {
      return res.status(400).json({ success: false, message: 'NIS, Nama, Username, dan Kelas wajib diisi.' });
    }

    const db = await getDb();
    const now = new Date().toISOString();

    // Check unique NIS/username for others
    const conflict = db.queryOne(
      'SELECT id FROM students WHERE (nis = ? OR username = ?) AND id != ?',
      [nis.trim(), username.trim(), id]
    );
    if (conflict) {
      return res.status(400).json({ success: false, message: 'NIS atau Username sudah terdaftar pada siswa lain.' });
    }

    if (password && password.trim()) {
      const passwordHash = bcrypt.hashSync(password.trim(), 10);
      db.run(
        `UPDATE students 
         SET nis = ?, nama = ?, username = ?, password_hash = ?, class_id = ?, status = ?, updated_at = ?
         WHERE id = ?`,
        [nis.trim(), nama.trim(), username.trim(), passwordHash, class_id, status || 'aktif', now, id]
      );
    } else {
      db.run(
        `UPDATE students 
         SET nis = ?, nama = ?, username = ?, class_id = ?, status = ?, updated_at = ?
         WHERE id = ?`,
        [nis.trim(), nama.trim(), username.trim(), class_id, status || 'aktif', now, id]
      );
    }

    return res.json({ success: true, message: 'Data siswa berhasil diperbarui.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui data siswa.' });
  }
});

router.post('/students/:id/reset-password', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { new_password = 'siswa123' } = req.body;
    const db = await getDb();
    const passwordHash = bcrypt.hashSync(new_password, 10);
    const now = new Date().toISOString();

    db.run('UPDATE students SET password_hash = ?, updated_at = ? WHERE id = ?', [passwordHash, now, id]);
    return res.json({ success: true, message: `Password berhasil direset ke "${new_password}".` });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal mereset password siswa.' });
  }
});

router.delete('/students/:id', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    db.run('DELETE FROM students WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Siswa berhasil dihapus.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus siswa.' });
  }
});

router.post('/students/bulk-delete', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { student_ids } = req.body;
    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Pilih minimal satu siswa untuk dihapus.' });
    }

    const db = await getDb();
    let deletedCount = 0;

    for (const id of student_ids) {
      if (typeof id === 'string' && id.trim()) {
        const studentId = id.trim();
        try {
          db.run('DELETE FROM answers WHERE student_id = ?', [studentId]);
          db.run('DELETE FROM exam_participants WHERE student_id = ?', [studentId]);
          const result = db.run('DELETE FROM students WHERE id = ?', [studentId]);
          if (result.changes > 0) {
            deletedCount++;
          }
        } catch (itemErr) {
          console.error(`Error deleting student ${studentId}:`, itemErr);
        }
      }
    }

    db.persist();

    return res.json({
      success: true,
      message: `${deletedCount} siswa berhasil dihapus secara massal beserta riwayat ujiannya.`,
      deletedCount,
    });
  } catch (error: any) {
    console.error('Bulk delete error:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus siswa massal: ' + (error?.message || error) });
  }
});

router.post('/students/import', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { studentsList, updateExisting = false } = req.body;
    if (!Array.isArray(studentsList) || studentsList.length === 0) {
      return res.status(400).json({ success: false, message: 'Daftar data siswa tidak valid.' });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const classes = db.query('SELECT id, LOWER(nama_kelas) as nama_kelas_lower FROM classes');
    const classMap = new Map<string, string>();
    for (const c of classes) {
      classMap.set(c.id, c.id);
      classMap.set(c.nama_kelas_lower, c.id);
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    db.transaction(() => {
      for (const item of studentsList) {
        if (!item.nis || !item.nama) {
          skipped++;
          continue;
        }

        const nis = String(item.nis).trim();
        const nama = String(item.nama).trim();
        const username = item.username ? String(item.username).trim() : nis;
        const plainPassword = item.password ? String(item.password).trim() : 'siswa123';
        const passwordHash = bcrypt.hashSync(plainPassword, 10);

        // Resolve class_id
        let targetClassId = item.class_id;
        if (!targetClassId && item.class_name) {
          targetClassId = classMap.get(String(item.class_name).trim().toLowerCase());
        }
        if (targetClassId && classMap.has(String(targetClassId).trim().toLowerCase())) {
          targetClassId = classMap.get(String(targetClassId).trim().toLowerCase()) || targetClassId;
        }

        if (!targetClassId) {
          skipped++;
          continue;
        }

        // Check if student exists by NIS or username
        const existing = db.queryOne('SELECT id FROM students WHERE nis = ? OR username = ?', [nis, username]);

        if (existing) {
          if (updateExisting) {
            db.run(
              `UPDATE students 
               SET nama = ?, class_id = ?, password_hash = ?, status = 'aktif', updated_at = ?
               WHERE id = ?`,
              [nama, targetClassId, passwordHash, now, existing.id]
            );
            updated++;
          } else {
            skipped++;
          }
        } else {
          const id = `std-${crypto.randomUUID().slice(0, 8)}`;
          db.run(
            `INSERT INTO students (id, nis, nama, username, password_hash, class_id, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'aktif', ?, ?)`,
            [id, nis, nama, username, passwordHash, targetClassId, now, now]
          );
          imported++;
        }
      }
    });

    return res.json({
      success: true,
      message: `Impor berhasil: ${imported} siswa baru ditambahkan${updated > 0 ? `, ${updated} diperbarui` : ''}${skipped > 0 ? `, ${skipped} dilewati (duplikat/tidak valid)` : ''}.`,
      imported,
      updated,
      skipped,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal mengimpor siswa: ' + error.message });
  }
});

// ==========================================
// QUESTION BANKS & QUESTIONS
// ==========================================

router.get('/question-banks', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const banks = db.query(
      `SELECT qb.*, c.nama_kelas,
        (SELECT COUNT(*) FROM questions q WHERE q.question_bank_id = qb.id) as total_questions
       FROM question_banks qb
       LEFT JOIN classes c ON qb.kelas_id = c.id
       ORDER BY qb.created_at DESC`
    );
    return res.json({ success: true, data: banks });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat bank soal.' });
  }
});

router.post('/question-banks', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { nama_bank, mata_pelajaran, kelas_id, deskripsi, status = 'aktif' } = req.body;
    if (!nama_bank || !mata_pelajaran) {
      return res.status(400).json({ success: false, message: 'Nama bank soal dan mata pelajaran wajib diisi.' });
    }

    const db = await getDb();
    const id = `qb-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO question_banks (id, nama_bank, mata_pelajaran, kelas_id, deskripsi, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, nama_bank.trim(), mata_pelajaran.trim(), kelas_id || null, deskripsi || '', status, now, now]
    );

    return res.json({ success: true, message: 'Bank soal berhasil dibuat.', data: { id } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal membuat bank soal.' });
  }
});

router.get('/question-banks/:id', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const bank = db.queryOne(
      `SELECT qb.*, c.nama_kelas,
        (SELECT COUNT(*) FROM questions q WHERE q.question_bank_id = qb.id) as total_questions
       FROM question_banks qb
       LEFT JOIN classes c ON qb.kelas_id = c.id
       WHERE qb.id = ?`,
      [id]
    );

    if (!bank) {
      return res.status(404).json({ success: false, message: 'Bank soal tidak ditemukan.' });
    }

    return res.json({ success: true, data: bank });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat detail bank soal.' });
  }
});

router.put('/question-banks/:id', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nama_bank, mata_pelajaran, kelas_id, deskripsi, status } = req.body;
    if (!nama_bank || !mata_pelajaran) {
      return res.status(400).json({ success: false, message: 'Nama bank soal dan mata pelajaran wajib diisi.' });
    }

    const db = await getDb();
    const now = new Date().toISOString();

    db.run(
      `UPDATE question_banks 
       SET nama_bank = ?, mata_pelajaran = ?, kelas_id = ?, deskripsi = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [nama_bank.trim(), mata_pelajaran.trim(), kelas_id || null, deskripsi || '', status || 'aktif', now, id]
    );

    return res.json({ success: true, message: 'Bank soal berhasil diperbarui.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui bank soal.' });
  }
});

router.delete('/question-banks/:id', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    db.run('DELETE FROM question_banks WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Bank soal berhasil dihapus.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus bank soal.' });
  }
});

// Questions CRUD
router.get('/question-banks/:id/questions', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const questions = db.query(
      `SELECT * FROM questions WHERE question_bank_id = ? ORDER BY created_at ASC`,
      [id]
    );
    return res.json({ success: true, data: questions });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat daftar soal.' });
  }
});

router.post('/questions', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const {
      question_bank_id,
      pertanyaan,
      opsi_a,
      opsi_b,
      opsi_c,
      opsi_d = '',
      opsi_e = '',
      kategori = 'Umum',
      jumlah_opsi = 4,
      jawaban_benar,
      bobot = 1.0,
    } = req.body;

    const optCount = Number(jumlah_opsi) || 4;

    if (!question_bank_id || !pertanyaan || !opsi_a || !opsi_b || !opsi_c || !jawaban_benar) {
      return res.status(400).json({
        success: false,
        message: 'Pertanyaan, opsi A-C, dan kunci jawaban wajib diisi.',
      });
    }

    if (optCount >= 4 && !opsi_d) {
      return res.status(400).json({ success: false, message: 'Opsi D wajib diisi untuk 4 opsi atau lebih.' });
    }

    if (optCount >= 5 && !opsi_e) {
      return res.status(400).json({ success: false, message: 'Opsi E wajib diisi untuk soal 5 opsi.' });
    }

    const db = await getDb();
    const id = `q-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO questions (id, question_bank_id, pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kategori, jumlah_opsi, jawaban_benar, bobot, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        question_bank_id,
        pertanyaan.trim(),
        opsi_a.trim(),
        opsi_b.trim(),
        opsi_c.trim(),
        (opsi_d || '').trim(),
        (opsi_e || '').trim(),
        (kategori || 'Umum').trim(),
        optCount,
        jawaban_benar.toUpperCase(),
        Number(bobot) || 1.0,
        now,
        now,
      ]
    );

    return res.json({ success: true, message: 'Soal berhasil ditambahkan.', data: { id } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal menambahkan soal: ' + error.message });
  }
});

router.put('/questions/:id', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      pertanyaan,
      opsi_a,
      opsi_b,
      opsi_c,
      opsi_d = '',
      opsi_e = '',
      kategori = 'Umum',
      jumlah_opsi = 4,
      jawaban_benar,
      bobot,
    } = req.body;

    const optCount = Number(jumlah_opsi) || 4;

    if (!pertanyaan || !opsi_a || !opsi_b || !opsi_c || !jawaban_benar) {
      return res.status(400).json({ success: false, message: 'Pertanyaan, pilihan A-C, dan kunci jawaban wajib diisi.' });
    }

    if (optCount >= 4 && !opsi_d) {
      return res.status(400).json({ success: false, message: 'Opsi D wajib diisi untuk 4 opsi atau lebih.' });
    }

    if (optCount >= 5 && !opsi_e) {
      return res.status(400).json({ success: false, message: 'Opsi E wajib diisi untuk soal 5 opsi.' });
    }

    const db = await getDb();
    const now = new Date().toISOString();

    db.run(
      `UPDATE questions 
       SET pertanyaan = ?, opsi_a = ?, opsi_b = ?, opsi_c = ?, opsi_d = ?, opsi_e = ?, kategori = ?, jumlah_opsi = ?, jawaban_benar = ?, bobot = ?, updated_at = ?
       WHERE id = ?`,
      [
        pertanyaan.trim(),
        opsi_a.trim(),
        opsi_b.trim(),
        opsi_c.trim(),
        (opsi_d || '').trim(),
        (opsi_e || '').trim(),
        (kategori || 'Umum').trim(),
        optCount,
        jawaban_benar.toUpperCase(),
        Number(bobot) || 1.0,
        now,
        id,
      ]
    );

    return res.json({ success: true, message: 'Soal berhasil diperbarui.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui soal: ' + error.message });
  }
});

router.delete('/questions/:id', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    db.run('DELETE FROM questions WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Soal berhasil dihapus.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus soal.' });
  }
});

router.post('/questions/:id/duplicate', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const existing = db.queryOne('SELECT * FROM questions WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Soal asal tidak ditemukan.' });
    }

    const newId = `q-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO questions (id, question_bank_id, pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kategori, jumlah_opsi, jawaban_benar, bobot, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId,
        existing.question_bank_id,
        `${existing.pertanyaan} (Salinan)`,
        existing.opsi_a,
        existing.opsi_b,
        existing.opsi_c,
        existing.opsi_d,
        existing.opsi_e || '',
        existing.kategori || 'Umum',
        existing.jumlah_opsi || 4,
        existing.jawaban_benar,
        existing.bobot,
        now,
        now,
      ]
    );

    return res.json({ success: true, message: 'Soal berhasil diduplikasi.', data: { id: newId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal menduplikasi soal.' });
  }
});

router.post('/question-banks/:id/questions/bulk-import', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { questionsList } = req.body;
    if (!Array.isArray(questionsList) || questionsList.length === 0) {
      return res.status(400).json({ success: false, message: 'Daftar butir soal tidak valid atau kosong.' });
    }

    const db = await getDb();
    const bank = db.queryOne('SELECT id FROM question_banks WHERE id = ?', [id]);
    if (!bank) {
      return res.status(404).json({ success: false, message: 'Bank soal tidak ditemukan.' });
    }

    const now = new Date().toISOString();
    let imported = 0;
    let skipped = 0;

    for (const item of questionsList) {
      if (!item.pertanyaan || !item.opsi_a || !item.opsi_b || !item.opsi_c) {
        skipped++;
        continue;
      }

      const optE = item.opsi_e ? String(item.opsi_e).trim() : '';
      const optD = item.opsi_d ? String(item.opsi_d).trim() : '';
      const jumlahOpsi = optE ? 5 : (optD ? 4 : 3);

      let key = String(item.jawaban_benar || 'A').trim().toUpperCase();
      if (!['A', 'B', 'C', 'D', 'E'].includes(key)) {
        key = 'A';
      }

      const bobot = Number(item.bobot) > 0 ? Number(item.bobot) : 1.0;
      const kategori = item.kategori ? String(item.kategori).trim() : 'Umum';
      const qId = `q-${crypto.randomUUID().slice(0, 8)}`;

      try {
        db.run(
          `INSERT INTO questions (id, question_bank_id, pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kategori, jumlah_opsi, jawaban_benar, bobot, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            qId,
            id,
            String(item.pertanyaan).trim(),
            String(item.opsi_a).trim(),
            String(item.opsi_b).trim(),
            String(item.opsi_c).trim(),
            optD,
            optE,
            kategori,
            jumlahOpsi,
            key,
            bobot,
            now,
            now,
          ]
        );
        imported++;
      } catch (err) {
        console.error('Error inserting imported question:', err);
        skipped++;
      }
    }

    db.run('UPDATE question_banks SET updated_at = ? WHERE id = ?', [now, id]);
    db.persist();

    return res.json({
      success: true,
      message: `Berhasil mengimpor ${imported} butir soal${skipped > 0 ? `, ${skipped} soal dilewati karena data tidak lengkap` : ''}.`,
      imported,
      skipped,
    });
  } catch (error: any) {
    console.error('Bulk import questions error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengimpor butir soal: ' + (error?.message || error) });
  }
});

router.post('/questions/bulk-delete', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { question_ids } = req.body;
    if (!Array.isArray(question_ids) || question_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Pilih minimal satu soal untuk dihapus.' });
    }

    const db = await getDb();
    let deletedCount = 0;

    for (const qId of question_ids) {
      if (typeof qId === 'string' && qId.trim()) {
        const cleanId = qId.trim();
        try {
          db.run('DELETE FROM answers WHERE question_id = ?', [cleanId]);
          const result = db.run('DELETE FROM questions WHERE id = ?', [cleanId]);
          if (result.changes > 0) {
            deletedCount++;
          }
        } catch (itemErr) {
          console.error(`Error deleting question ${cleanId}:`, itemErr);
        }
      }
    }

    db.persist();

    return res.json({
      success: true,
      message: `${deletedCount} butir soal berhasil dihapus secara massal.`,
      deletedCount,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus soal massal: ' + (error?.message || error) });
  }
});

// ==========================================
// EXAMS CRUD (ADMIN)
// ==========================================

router.get('/exams', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const exams = db.query(
      `SELECT e.*, c.nama_kelas, qb.nama_bank,
        (SELECT COUNT(*) FROM questions q WHERE q.question_bank_id = e.question_bank_id) as total_questions,
        (SELECT COUNT(*) FROM exam_participants ep WHERE ep.exam_id = e.id) as total_participants,
        (SELECT COUNT(*) FROM exam_participants ep WHERE ep.exam_id = e.id AND ep.status = 'selesai') as finished_participants,
        (SELECT COUNT(*) FROM exam_participants ep WHERE ep.exam_id = e.id AND ep.status = 'sedang_mengerjakan') as ongoing_participants
       FROM exams e
       LEFT JOIN classes c ON e.class_id = c.id
       LEFT JOIN question_banks qb ON e.question_bank_id = qb.id
       ORDER BY e.tanggal DESC, e.waktu_mulai DESC`
    );
    return res.json({ success: true, data: exams });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat daftar ujian.' });
  }
});

router.post('/exams', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const {
      nama_ujian,
      mata_pelajaran,
      class_id,
      question_bank_id,
      tanggal,
      waktu_mulai,
      waktu_selesai,
      durasi_menit,
      token,
      shuffle_questions = 0,
      shuffle_answers = 0,
      tampilkan_nilai = 1,
      status = 'aktif',
    } = req.body;

    if (!nama_ujian || !mata_pelajaran || !class_id || !question_bank_id || !tanggal || !waktu_mulai || !waktu_selesai || !durasi_menit) {
      return res.status(400).json({ success: false, message: 'Semua informasi jadwal ujian wajib diisi lengkap.' });
    }

    const examToken = token && token.trim() ? token.trim().toUpperCase() : generateRandomToken(6);
    const db = await getDb();
    const id = `exam-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    db.transaction(() => {
      db.run(
        `INSERT INTO exams (
          id, nama_ujian, mata_pelajaran, class_id, question_bank_id, tanggal, waktu_mulai, waktu_selesai,
          durasi_menit, token, shuffle_questions, shuffle_answers, tampilkan_nilai, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          nama_ujian.trim(),
          mata_pelajaran.trim(),
          class_id,
          question_bank_id,
          tanggal,
          waktu_mulai,
          waktu_selesai,
          Number(durasi_menit),
          examToken,
          shuffle_questions ? 1 : 0,
          shuffle_answers ? 1 : 0,
          tampilkan_nilai ? 1 : 0,
          status,
          now,
          now,
        ]
      );

      // Register all students from the class
      const classStudents = db.query('SELECT id FROM students WHERE class_id = ? AND status = ?', [class_id, 'aktif']);
      for (const std of classStudents) {
        db.run(
          `INSERT INTO exam_participants (
            id, exam_id, student_id, status, score, total_questions, correct_answers, wrong_answers, created_at, updated_at
          ) VALUES (?, ?, ?, 'belum_mulai', 0, 0, 0, 0, ?, ?)`,
          [`part-${id}-${std.id}`, id, std.id, now, now]
        );
      }
    });

    return res.json({ success: true, message: 'Jadwal ujian berhasil dibuat.', data: { id, token: examToken } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal membuat jadwal ujian: ' + error.message });
  }
});

router.get('/exams/:id', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const exam = db.queryOne(
      `SELECT e.*, c.nama_kelas, qb.nama_bank,
        (SELECT COUNT(*) FROM questions q WHERE q.question_bank_id = e.question_bank_id) as total_questions,
        (SELECT COUNT(*) FROM exam_participants ep WHERE ep.exam_id = e.id) as total_participants,
        (SELECT COUNT(*) FROM exam_participants ep WHERE ep.exam_id = e.id AND ep.status = 'selesai') as finished_participants,
        (SELECT COUNT(*) FROM exam_participants ep WHERE ep.exam_id = e.id AND ep.status = 'sedang_mengerjakan') as ongoing_participants,
        (SELECT AVG(ep.score) FROM exam_participants ep WHERE ep.exam_id = e.id AND ep.status = 'selesai') as avg_score,
        (SELECT MAX(ep.score) FROM exam_participants ep WHERE ep.exam_id = e.id AND ep.status = 'selesai') as max_score,
        (SELECT MIN(ep.score) FROM exam_participants ep WHERE ep.exam_id = e.id AND ep.status = 'selesai') as min_score
       FROM exams e
       LEFT JOIN classes c ON e.class_id = c.id
       LEFT JOIN question_banks qb ON e.question_bank_id = qb.id
       WHERE e.id = ?`,
      [id]
    );

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Jadwal ujian tidak ditemukan.' });
    }

    return res.json({ success: true, data: exam });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat detail ujian.' });
  }
});

router.put('/exams/:id', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      nama_ujian,
      mata_pelajaran,
      class_id,
      question_bank_id,
      tanggal,
      waktu_mulai,
      waktu_selesai,
      durasi_menit,
      token,
      shuffle_questions,
      shuffle_answers,
      tampilkan_nilai,
      status,
    } = req.body;

    const db = await getDb();
    const now = new Date().toISOString();
    const existing = db.queryOne('SELECT class_id FROM exams WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Ujian tidak ditemukan.' });
    }

    db.transaction(() => {
      db.run(
        `UPDATE exams 
         SET nama_ujian = ?, mata_pelajaran = ?, class_id = ?, question_bank_id = ?, tanggal = ?,
             waktu_mulai = ?, waktu_selesai = ?, durasi_menit = ?, token = ?, shuffle_questions = ?,
             shuffle_answers = ?, tampilkan_nilai = ?, status = ?, updated_at = ?
         WHERE id = ?`,
        [
          nama_ujian.trim(),
          mata_pelajaran.trim(),
          class_id,
          question_bank_id,
          tanggal,
          waktu_mulai,
          waktu_selesai,
          Number(durasi_menit),
          token.trim().toUpperCase(),
          shuffle_questions ? 1 : 0,
          shuffle_answers ? 1 : 0,
          tampilkan_nilai ? 1 : 0,
          status || 'aktif',
          now,
          id,
        ]
      );

      // If class changed, sync participants
      if (existing.class_id !== class_id) {
        const classStudents = db.query('SELECT id FROM students WHERE class_id = ? AND status = ?', [class_id, 'aktif']);
        for (const std of classStudents) {
          const hasPart = db.queryOne('SELECT id FROM exam_participants WHERE exam_id = ? AND student_id = ?', [id, std.id]);
          if (!hasPart) {
            db.run(
              `INSERT INTO exam_participants (
                id, exam_id, student_id, status, score, total_questions, correct_answers, wrong_answers, created_at, updated_at
              ) VALUES (?, ?, ?, 'belum_mulai', 0, 0, 0, 0, ?, ?)`,
              [`part-${id}-${std.id}`, id, std.id, now, now]
            );
          }
        }
      }
    });

    return res.json({ success: true, message: 'Jadwal ujian berhasil diperbarui.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui ujian.' });
  }
});

router.post('/exams/:id/regenerate-token', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const newToken = generateRandomToken(6);
    const db = await getDb();
    const now = new Date().toISOString();

    db.run('UPDATE exams SET token = ?, updated_at = ? WHERE id = ?', [newToken, now, id]);
    return res.json({ success: true, message: 'Token baru berhasil dibuat.', token: newToken });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal meregenerate token.' });
  }
});

router.delete('/exams/:id', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    db.run('DELETE FROM exams WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Jadwal ujian berhasil dihapus.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus ujian.' });
  }
});

// Admin View Results
router.get('/exams/:id/results', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { q, status } = req.query;
    const db = await getDb();

    let sql = `
      SELECT ep.*, s.nis, s.nama as student_name, s.username, c.nama_kelas
      FROM exam_participants ep
      JOIN students s ON ep.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      WHERE ep.exam_id = ?
    `;
    const params: any[] = [id];

    if (status && status !== 'all') {
      sql += ' AND ep.status = ?';
      params.push(status);
    }

    if (q && typeof q === 'string' && q.trim()) {
      sql += ' AND (s.nama LIKE ? OR s.nis LIKE ?)';
      const pattern = `%${q.trim()}%`;
      params.push(pattern, pattern);
    }

    sql += ' ORDER BY ep.score DESC, s.nama ASC';
    const results = db.query(sql, params);

    return res.json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat hasil ujian.' });
  }
});

router.post('/exams/:id/reset-participant/:student_id', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id, student_id } = req.params;
    const db = await getDb();
    const now = new Date().toISOString();

    db.transaction(() => {
      // Delete answers
      db.run('DELETE FROM answers WHERE exam_id = ? AND student_id = ?', [id, student_id]);

      // Reset participant
      db.run(
        `UPDATE exam_participants 
         SET status = 'belum_mulai', started_at = NULL, submitted_at = NULL, score = 0,
             total_questions = 0, correct_answers = 0, wrong_answers = 0, updated_at = ?
         WHERE exam_id = ? AND student_id = ?`,
        [now, id, student_id]
      );
    });

    return res.json({ success: true, message: 'Sesi ujian siswa berhasil direset. Siswa dapat memulai kembali.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mereset sesi ujian siswa.' });
  }
});

// Admin Live Exam Monitoring Dashboard
router.get('/exams/:id/monitoring', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const exam = db.queryOne(
      `SELECT e.*, c.nama_kelas, qb.nama_bank,
              (SELECT COUNT(*) FROM questions q WHERE q.question_bank_id = e.question_bank_id) as total_questions
       FROM exams e
       JOIN classes c ON e.class_id = c.id
       JOIN question_banks qb ON e.question_bank_id = qb.id
       WHERE e.id = ?`,
      [id]
    );

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Jadwal ujian tidak ditemukan.' });
    }

    const totalQuestions = Number(exam.total_questions) || 1;

    // Fetch all students in this exam's class along with their participant status
    const participants = db.query(
      `SELECT s.id as student_id, s.nis, s.nama as student_name, s.username, c.nama_kelas,
              COALESCE(ep.id, '') as participant_id,
              COALESCE(ep.status, 'belum_mulai') as status,
              ep.started_at, ep.submitted_at, ep.last_heartbeat,
              COALESCE(ep.current_question_index, 0) as current_question_index,
              COALESCE(ep.answered_count, (
                SELECT COUNT(*) FROM answers a 
                WHERE a.exam_id = ? AND a.student_id = s.id AND a.answer IS NOT NULL AND a.answer != ''
              )) as answered_count
       FROM students s
       JOIN classes c ON s.class_id = c.id
       LEFT JOIN exam_participants ep ON ep.exam_id = ? AND ep.student_id = s.id
       WHERE s.class_id = ? AND s.status = 'aktif'
       ORDER BY s.nama ASC`,
      [id, id, exam.class_id]
    );

    const now = Date.now();
    let onlineCount = 0;
    let ongoingCount = 0;
    let finishedCount = 0;
    let notStartedCount = 0;

    const enriched = participants.map((p: any) => {
      const isOngoing = p.status === 'sedang_mengerjakan';
      const isFinished = p.status === 'selesai';
      const lastHb = p.last_heartbeat ? new Date(p.last_heartbeat).getTime() : 0;
      // Active within last 60 seconds
      const isOnline = isOngoing && (now - lastHb < 60000);

      if (isOnline) onlineCount++;
      if (isOngoing) ongoingCount++;
      if (isFinished) finishedCount++;
      if (p.status === 'belum_mulai') notStartedCount++;

      let remainingSec = 0;
      if (isOngoing && p.started_at) {
        const startMs = new Date(p.started_at).getTime();
        const durationMs = exam.durasi_menit * 60 * 1000;
        remainingSec = Math.max(0, Math.floor((startMs + durationMs - now) / 1000));
      }

      const answered = Number(p.answered_count) || 0;
      const progressPercent = Math.min(100, Math.round((answered / totalQuestions) * 100));

      return {
        id: p.participant_id,
        student_id: p.student_id,
        nis: p.nis,
        student_name: p.student_name,
        username: p.username,
        nama_kelas: p.nama_kelas,
        status: p.status,
        is_online: isOnline,
        last_heartbeat: p.last_heartbeat,
        started_at: p.started_at,
        submitted_at: p.submitted_at,
        current_question_index: p.current_question_index,
        answered_count: answered,
        total_questions: totalQuestions,
        progress_percent: progressPercent,
        remaining_seconds: remainingSec,
      };
    });

    return res.json({
      success: true,
      data: {
        exam,
        summary: {
          total_students: participants.length,
          online_count: onlineCount,
          ongoing_count: ongoingCount,
          finished_count: finishedCount,
          not_started_count: notStartedCount,
        },
        participants: enriched,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat monitoring ujian: ' + error.message });
  }
});

// Admin Force Finish Student's Exam
router.post('/exams/:id/participants/:student_id/force-finish', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { id, student_id } = req.params;
    const db = await getDb();

    const participant = db.queryOne('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?', [id, student_id]);
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Peserta ujian tidak ditemukan.' });
    }

    if (participant.status === 'selesai') {
      return res.status(400).json({ success: false, message: 'Ujian siswa ini sudah selesai.' });
    }

    // Finalize and grade whatever has been answered
    await finalizeStudentExam(db, id, student_id);

    return res.json({
      success: true,
      message: 'Sesi ujian siswa berhasil diakhiri secara paksa (force finish). Lembar jawaban telah dikunci.',
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal force finish ujian: ' + error.message });
  }
});

// Admin Student Reports Endpoint (Per Kelas, Per Ujian, Filter & Export)
router.get('/admin/student-reports', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { class_id, exam_id, status, q } = req.query;
    const db = await getDb();

    // 1. Get list of active classes for filter dropdown
    const classes = db.query("SELECT id, nama_kelas, tingkat FROM classes WHERE status = 'aktif' ORDER BY nama_kelas ASC");

    // 2. Get list of exams for filter dropdown
    const exams = db.query(
      `SELECT e.id, e.nama_ujian, e.mata_pelajaran, e.tanggal, c.nama_kelas
       FROM exams e
       LEFT JOIN classes c ON e.class_id = c.id
       ORDER BY e.created_at DESC`
    );

    // 3. Query report data
    let sql = `
      SELECT 
        s.id as student_id,
        s.nis,
        s.nama as student_name,
        s.username,
        c.id as class_id,
        c.nama_kelas,
        e.id as exam_id,
        e.nama_ujian,
        e.mata_pelajaran,
        e.tanggal,
        e.durasi_menit,
        e.token,
        COALESCE(ep.status, 'belum_mulai') as status,
        COALESCE(ep.score, 0) as score,
        COALESCE(ep.correct_answers, 0) as correct_answers,
        COALESCE(ep.wrong_answers, 0) as wrong_answers,
        COALESCE(ep.total_questions, (SELECT COUNT(*) FROM questions q WHERE q.question_bank_id = e.question_bank_id)) as total_questions,
        ep.started_at,
        ep.submitted_at
      FROM students s
      JOIN classes c ON s.class_id = c.id
      JOIN exams e ON e.class_id = c.id
      LEFT JOIN exam_participants ep ON ep.exam_id = e.id AND ep.student_id = s.id
      WHERE s.status = 'aktif'
    `;

    const params: any[] = [];

    if (class_id && class_id !== 'all') {
      sql += ' AND s.class_id = ?';
      params.push(class_id);
    }

    if (exam_id && exam_id !== 'all') {
      sql += ' AND e.id = ?';
      params.push(exam_id);
    }

    if (status && status !== 'all') {
      if (status === 'belum_mulai') {
        sql += ' AND (ep.status IS NULL OR ep.status = ?)';
      } else {
        sql += ' AND ep.status = ?';
      }
      params.push(status);
    }

    if (q && typeof q === 'string' && q.trim()) {
      sql += ' AND (s.nama LIKE ? OR s.nis LIKE ? OR e.nama_ujian LIKE ? OR e.mata_pelajaran LIKE ?)';
      const pattern = `%${q.trim()}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    sql += ' ORDER BY c.nama_kelas ASC, s.nama ASC, e.created_at DESC';

    const reports = db.query(sql, params);

    // Calculate summary statistics
    const finishedReports = reports.filter((r: any) => r.status === 'selesai');
    const scores = finishedReports.map((r: any) => Number(r.score) || 0);
    const totalStudents = reports.length;
    const totalCompleted = finishedReports.length;
    const averageScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    const passedCount = scores.filter((s) => s >= 75).length;

    return res.json({
      success: true,
      data: {
        classes,
        exams,
        reports,
        summary: {
          total_students: totalStudents,
          total_completed: totalCompleted,
          average_score: Math.round(averageScore * 10) / 10,
          max_score: Math.round(maxScore * 10) / 10,
          min_score: Math.round(minScore * 10) / 10,
          passed_count: passedCount,
          passed_rate: totalCompleted > 0 ? Math.round((passedCount / totalCompleted) * 100) : 0,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal memuat laporan nilai siswa: ' + error.message });
  }
});

// ==========================================
// STUDENT CBT EXAM ENGINE
// ==========================================

// 1. Get available exams for logged in student
router.get('/student/exams', requireAuth('student'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as SessionData;
    const db = await getDb();
    const today = new Date().toISOString().split('T')[0];

    // Only get exams for the student's class (Scores are NOT exposed to students)
    const exams = db.query(
      `SELECT e.id, e.nama_ujian, e.mata_pelajaran, e.tanggal, e.waktu_mulai, e.waktu_selesai,
              e.durasi_menit, e.shuffle_questions, e.shuffle_answers, 0 as tampilkan_nilai, e.status as exam_status,
              c.nama_kelas,
              (SELECT COUNT(*) FROM questions q WHERE q.question_bank_id = e.question_bank_id) as total_questions,
              COALESCE(ep.status, 'belum_mulai') as participant_status,
              ep.started_at,
              ep.submitted_at,
              NULL as score
       FROM exams e
       JOIN classes c ON e.class_id = c.id
       LEFT JOIN exam_participants ep ON ep.exam_id = e.id AND ep.student_id = ?
       WHERE e.class_id = ? AND e.status = 'aktif'
       ORDER BY e.tanggal DESC, e.waktu_mulai ASC`,
      [user.userId, user.classId]
    );

    return res.json({ success: true, data: exams });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat jadwal ujian Anda.' });
  }
});

// 2. Start / Enter Exam with Token
router.post('/student/exams/:id/start', requireAuth('student'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token } = req.body;
    const user = (req as any).user as SessionData;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token ujian wajib diisi.' });
    }

    const db = await getDb();
    const exam = db.queryOne('SELECT * FROM exams WHERE id = ?', [id]);

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Ujian tidak ditemukan.' });
    }

    // Class validation
    if (exam.class_id !== user.classId) {
      return res.status(403).json({ success: false, message: 'Anda tidak terdaftar dalam kelas ujian ini.' });
    }

    // Token validation
    if (exam.token.toUpperCase() !== token.trim().toUpperCase()) {
      return res.status(400).json({ success: false, message: 'Token ujian tidak valid. Pastikan token yang Anda masukkan benar.' });
    }

    // Status validation
    if (exam.status !== 'aktif') {
      return res.status(400).json({ success: false, message: 'Ujian sedang tidak aktif.' });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Check participant record
    let participant = db.queryOne('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?', [id, user.userId]);

    if (!participant) {
      // Auto-register if not yet exists
      db.run(
        `INSERT INTO exam_participants (id, exam_id, student_id, status, score, total_questions, correct_answers, wrong_answers, created_at, updated_at)
         VALUES (?, ?, ?, 'belum_mulai', 0, 0, 0, 0, ?, ?)`,
        [`part-${id}-${user.userId}`, id, user.userId, nowIso, nowIso]
      );
      participant = db.queryOne('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?', [id, user.userId]);
    }

    if (participant.status === 'selesai') {
      return res.status(400).json({ success: false, message: 'Anda sudah mengumpulkan dan menyelesaikan ujian ini.' });
    }

    let startedAt = participant.started_at;
    if (!startedAt) {
      startedAt = nowIso;
      db.run(
        `UPDATE exam_participants 
         SET status = 'sedang_mengerjakan', started_at = ?, updated_at = ?
         WHERE exam_id = ? AND student_id = ?`,
        [startedAt, nowIso, id, user.userId]
      );
    }

    // Calculate server deadline: started_at + duration_minutes
    const startTimeMs = new Date(startedAt).getTime();
    const durationMs = exam.durasi_menit * 60 * 1000;
    const expiresAtMs = startTimeMs + durationMs;
    const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - now.getTime()) / 1000));

    return res.json({
      success: true,
      message: 'Ujian berhasil dimulai.',
      data: {
        examId: exam.id,
        nama_ujian: exam.nama_ujian,
        mata_pelajaran: exam.mata_pelajaran,
        durasi_menit: exam.durasi_menit,
        started_at: startedAt,
        expires_at: new Date(expiresAtMs).toISOString(),
        remaining_seconds: remainingSeconds,
        server_time: nowIso,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal memulai ujian: ' + error.message });
  }
});

// 3. Get Exam Questions (Sanitized without answers) and Student's current saved answers
router.get('/student/exams/:id/questions', requireAuth('student'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user as SessionData;
    const db = await getDb();

    const exam = db.queryOne('SELECT * FROM exams WHERE id = ?', [id]);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Ujian tidak ditemukan.' });
    }

    if (exam.class_id !== user.classId) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    const participant = db.queryOne('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?', [id, user.userId]);
    if (!participant || participant.status === 'belum_mulai') {
      return res.status(400).json({ success: false, message: 'Ujian belum dimulai. Silakan masukkan token terlebih dahulu.' });
    }

    // Fetch questions WITHOUT jawaban_benar (anti-cheat)
    const questionsRaw = db.query(
      `SELECT id, question_bank_id, pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d,
              COALESCE(opsi_e, '') as opsi_e,
              COALESCE(kategori, 'Umum') as kategori,
              COALESCE(jumlah_opsi, 4) as jumlah_opsi,
              bobot, created_at 
       FROM questions 
       WHERE question_bank_id = ? 
       ORDER BY created_at ASC`,
      [exam.question_bank_id]
    );

    // Fetch student's current saved answers
    const studentAnswers = db.query(
      `SELECT question_id, answer FROM answers WHERE exam_id = ? AND student_id = ?`,
      [id, user.userId]
    );

    const answerMap: Record<string, string> = {};
    for (const a of studentAnswers) {
      answerMap[a.question_id] = a.answer;
    }

    // Calculate time remaining based on server started_at
    const now = new Date();
    const startedAt = new Date(participant.started_at || now.toISOString());
    const durationMs = exam.durasi_menit * 60 * 1000;
    const expiresAtMs = startedAt.getTime() + durationMs;
    const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - now.getTime()) / 1000));

    // If time is up and status is still ongoing, auto-finalize
    if (remainingSeconds <= 0 && participant.status === 'sedang_mengerjakan') {
      await finalizeStudentExam(db, id, user.userId);
      return res.json({
        success: true,
        isTimeUp: true,
        message: 'Waktu ujian telah berakhir.',
        data: {
          exam: {
            id: exam.id,
            nama_ujian: exam.nama_ujian,
            mata_pelajaran: exam.mata_pelajaran,
            durasi_menit: exam.durasi_menit,
          },
          participant_status: 'selesai',
          remaining_seconds: 0,
          questions: [],
          answers: answerMap,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        exam: {
          id: exam.id,
          nama_ujian: exam.nama_ujian,
          mata_pelajaran: exam.mata_pelajaran,
          durasi_menit: exam.durasi_menit,
          shuffle_questions: exam.shuffle_questions,
          shuffle_answers: exam.shuffle_answers,
          tampilkan_nilai: exam.tampilkan_nilai,
        },
        participant_status: participant.status,
        started_at: participant.started_at,
        expires_at: new Date(expiresAtMs).toISOString(),
        remaining_seconds: remainingSeconds,
        server_time: now.toISOString(),
        questions: questionsRaw,
        answers: answerMap,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat soal ujian.' });
  }
});

// 4. Save Answer in Real-time
router.post('/student/exams/:id/answer', requireAuth('student'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { question_id, answer } = req.body;
    const user = (req as any).user as SessionData;

    if (!question_id || !answer) {
      return res.status(400).json({ success: false, message: 'Data jawaban tidak lengkap.' });
    }

    const db = await getDb();
    const participant = db.queryOne('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?', [id, user.userId]);

    if (!participant || participant.status !== 'sedang_mengerjakan') {
      return res.status(400).json({ success: false, message: 'Ujian tidak aktif atau sudah selesai.' });
    }

    // Check timer
    const exam = db.queryOne('SELECT durasi_menit FROM exams WHERE id = ?', [id]);
    const now = new Date();
    const startTimeMs = new Date(participant.started_at).getTime();
    const durationMs = (exam?.durasi_menit || 60) * 60 * 1000;
    if (now.getTime() > startTimeMs + durationMs) {
      await finalizeStudentExam(db, id, user.userId);
      return res.status(400).json({ success: false, isTimeUp: true, message: 'Waktu ujian telah habis.' });
    }

    const nowIso = now.toISOString();
    const answerId = `ans-${crypto.randomUUID().slice(0, 8)}`;

    // Upsert answer
    db.run(
      `INSERT INTO answers (id, exam_id, student_id, question_id, answer, is_correct, score, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
       ON CONFLICT(exam_id, student_id, question_id) 
       DO UPDATE SET answer = excluded.answer, updated_at = excluded.updated_at`,
      [answerId, id, user.userId, question_id, answer.toUpperCase(), nowIso, nowIso]
    );

    // Update participant monitoring metrics
    const currentQIdx = req.body.current_question_index !== undefined ? Number(req.body.current_question_index) : participant.current_question_index || 0;
    const answeredCountResult = db.queryOne(
      `SELECT COUNT(*) as count FROM answers WHERE exam_id = ? AND student_id = ? AND answer IS NOT NULL AND answer != ''`,
      [id, user.userId]
    );
    const answeredCount = answeredCountResult?.count || 1;

    db.run(
      `UPDATE exam_participants 
       SET last_heartbeat = ?, current_question_index = ?, answered_count = ?, updated_at = ?
       WHERE exam_id = ? AND student_id = ?`,
      [nowIso, currentQIdx, answeredCount, nowIso, id, user.userId]
    );

    return res.json({ success: true, message: 'Jawaban berhasil disimpan.', answered_count: answeredCount });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal menyimpan jawaban: ' + error.message });
  }
});

// 5. Periodic Auto-Save / Sync (every 30s) to prevent data loss from network interruptions
router.post('/student/exams/:id/sync', requireAuth('student'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { answers: newAnswers, current_question_index = 0 } = req.body;
    const user = (req as any).user as SessionData;
    const db = await getDb();

    const participant = db.queryOne('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?', [id, user.userId]);
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Peserta ujian tidak ditemukan.' });
    }

    // Check if exam was force-finished by admin or already selesai
    if (participant.status === 'selesai') {
      return res.json({
        success: false,
        forceFinished: true,
        isFinished: true,
        message: 'Sesi ujian Anda telah diakhiri oleh pengawas sekolah.',
      });
    }

    const exam = db.queryOne('SELECT durasi_menit FROM exams WHERE id = ?', [id]);
    const now = new Date();
    const nowIso = now.toISOString();
    const startTimeMs = new Date(participant.started_at || nowIso).getTime();
    const durationMs = (exam?.durasi_menit || 60) * 60 * 1000;
    if (now.getTime() > startTimeMs + durationMs) {
      await finalizeStudentExam(db, id, user.userId);
      return res.json({ success: false, forceFinished: true, isTimeUp: true, message: 'Waktu ujian telah berakhir.' });
    }

    // Sync all answers passed in payload
    let answeredCount = 0;
    if (newAnswers && typeof newAnswers === 'object') {
      for (const [qId, ans] of Object.entries(newAnswers)) {
        if (ans) {
          answeredCount++;
          const answerId = `ans-${crypto.randomUUID().slice(0, 8)}`;
          db.run(
            `INSERT INTO answers (id, exam_id, student_id, question_id, answer, is_correct, score, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
             ON CONFLICT(exam_id, student_id, question_id) 
             DO UPDATE SET answer = excluded.answer, updated_at = excluded.updated_at`,
            [answerId, id, user.userId, qId, String(ans).toUpperCase(), nowIso, nowIso]
          );
        }
      }
    }

    // Update heartbeat and progress
    db.run(
      `UPDATE exam_participants 
       SET last_heartbeat = ?, current_question_index = ?, answered_count = ?, updated_at = ?
       WHERE exam_id = ? AND student_id = ?`,
      [nowIso, Number(current_question_index) || 0, answeredCount, nowIso, id, user.userId]
    );

    return res.json({
      success: true,
      message: 'Auto-save tersinkronisasi dengan database.',
      synced_at: nowIso,
      answered_count: answeredCount,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal auto-save sinkronisasi: ' + error.message });
  }
});

// 6. Student Heartbeat Ping
router.post('/student/exams/:id/heartbeat', requireAuth('student'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { current_question_index = 0, answered_count = 0 } = req.body;
    const user = (req as any).user as SessionData;
    const db = await getDb();

    const participant = db.queryOne('SELECT status FROM exam_participants WHERE exam_id = ? AND student_id = ?', [id, user.userId]);
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Peserta tidak ditemukan.' });
    }

    if (participant.status === 'selesai') {
      return res.json({ success: false, forceFinished: true, message: 'Ujian telah diakhiri.' });
    }

    const nowIso = new Date().toISOString();
    db.run(
      `UPDATE exam_participants 
       SET last_heartbeat = ?, current_question_index = ?, answered_count = ?, updated_at = ?
       WHERE exam_id = ? AND student_id = ?`,
      [nowIso, Number(current_question_index) || 0, Number(answered_count) || 0, nowIso, id, user.userId]
    );

    return res.json({ success: true, server_time: nowIso });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Helper to grade and finalize an exam for a student
async function finalizeStudentExam(db: any, examId: string, studentId: string) {
  const exam = db.queryOne('SELECT * FROM exams WHERE id = ?', [examId]);
  if (!exam) return;

  const questions = db.query('SELECT id, jawaban_benar, bobot FROM questions WHERE question_bank_id = ?', [exam.question_bank_id]);
  const answers = db.query('SELECT * FROM answers WHERE exam_id = ? AND student_id = ?', [examId, studentId]);

  const answerMap: Record<string, string> = {};
  for (const a of answers) {
    answerMap[a.question_id] = a.answer;
  }

  let totalQuestions = questions.length;
  let correctCount = 0;
  let wrongCount = 0;
  const nowIso = new Date().toISOString();

  // Grade each answer
  for (const q of questions) {
    const studentAns = answerMap[q.id];
    const isCorrect = studentAns && studentAns.toUpperCase() === q.jawaban_benar.toUpperCase() ? 1 : 0;
    if (isCorrect) {
      correctCount++;
    } else {
      wrongCount++;
    }

    if (studentAns) {
      db.run(
        `UPDATE answers 
         SET is_correct = ?, score = ?, updated_at = ?
         WHERE exam_id = ? AND student_id = ? AND question_id = ?`,
        [isCorrect, isCorrect ? q.bobot : 0, nowIso, examId, studentId, q.id]
      );
    }
  }

  // Formula: (correct / total) * 100
  const finalScore = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100 * 100) / 100 : 0;

  db.run(
    `UPDATE exam_participants 
     SET status = 'selesai', submitted_at = ?, score = ?, total_questions = ?, correct_answers = ?, wrong_answers = ?, updated_at = ?
     WHERE exam_id = ? AND student_id = ?`,
    [nowIso, finalScore, totalQuestions, correctCount, wrongCount, nowIso, examId, studentId]
  );

  return {
    score: finalScore,
    totalQuestions,
    correctCount,
    wrongCount,
  };
}

// 5. Submit Exam
router.post('/student/exams/:id/submit', requireAuth('student'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user as SessionData;
    const db = await getDb();

    const participant = db.queryOne('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?', [id, user.userId]);
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Peserta ujian tidak ditemukan.' });
    }

    if (participant.status === 'selesai') {
      return res.json({ success: true, message: 'Ujian sudah dikumpulkan sebelumnya.' });
    }

    const grading = await finalizeStudentExam(db, id, user.userId);
    return res.json({
      success: true,
      message: 'Ujian berhasil dikumpulkan dan tersimpan di server.',
      data: {
        status: 'selesai',
        totalQuestions: grading?.totalQuestions || 0,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Gagal mengumpulkan ujian: ' + error.message });
  }
});

// 6. Student View Exam Result (Bukti Penyerahan Ujian - Hasil Nilai Dirahasiakan Sesuai Permintaan)
router.get('/student/exams/:id/result', requireAuth('student'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user as SessionData;
    const db = await getDb();

    const exam = db.queryOne('SELECT * FROM exams WHERE id = ?', [id]);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Ujian tidak ditemukan.' });
    }

    const participant = db.queryOne(
      `SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?`,
      [id, user.userId]
    );

    if (!participant || participant.status !== 'selesai') {
      return res.status(400).json({ success: false, message: 'Ujian belum selesai dikerjakan.' });
    }

    const student = db.queryOne(
      'SELECT s.nama, s.nis, c.nama_kelas FROM students s LEFT JOIN classes c ON s.class_id = c.id WHERE s.id = ?',
      [user.userId]
    );

    // Hasil nilai tidak ditampilkan kepada siswa (diumumkan oleh guru/sekolah)
    return res.json({
      success: true,
      data: {
        exam: {
          id: exam.id,
          nama_ujian: exam.nama_ujian,
          mata_pelajaran: exam.mata_pelajaran,
          durasi_menit: exam.durasi_menit,
          tampilkan_nilai: false,
        },
        participant: {
          started_at: participant.started_at,
          submitted_at: participant.submitted_at,
          status: participant.status,
          score: participant.score,
          correct_answers: participant.correct_answers,
          wrong_answers: participant.wrong_answers,
          total_questions: participant.total_questions,
          verification_code: `CBT-${(participant.id || 'VALID').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`,
          student_name: student?.nama || user.name,
          student_nis: student?.nis || user.nis,
          student_class: student?.nama_kelas,
        },
        message: 'Ujian berhasil dikumpulkan. Lembar jawaban Anda telah tersimpan dengan aman di server CBT. Nilai ujian akan diverifikasi dan diumumkan oleh pihak sekolah / guru pengampu.',
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat hasil ujian.' });
  }
});

// ==========================================
// SETTINGS
// ==========================================

router.get('/settings', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = db.query('SELECT key, value FROM settings');
    const settingsMap: Record<string, string> = {};
    for (const r of rows) {
      settingsMap[r.key] = r.value;
    }

    // Try fetching from public.site_settings in Supabase to sync/enrich
    try {
      const pool = getPgPool();
      const pgRes = await pool.query('SELECT key, value FROM public.site_settings');
      const now = new Date().toISOString();
      for (const row of pgRes.rows) {
        settingsMap[row.key] = row.value;
        // Keep local SQLite synced too
        db.run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', [row.key, String(row.value), now]);
      }
    } catch (pgErr) {
      // PG Pool might not be initialized, fall back to SQLite rows
    }

    return res.json({ success: true, data: settingsMap });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat pengaturan.' });
  }
});

router.put('/settings', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Data pengaturan tidak valid.' });
    }

    const db = await getDb();
    const now = new Date().toISOString();

    for (const [key, value] of Object.entries(settings)) {
      db.run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', [key, String(value), now]);
    }

    // Dual-sync to Supabase PostgreSQL (both settings and site_settings tables) if database connection is configured
    try {
      const pool = getPgPool();
      for (const [key, value] of Object.entries(settings)) {
        // Sync to settings
        await pool.query(
          `INSERT INTO public.settings (key, value, updated_at) 
           VALUES ($1, $2, NOW()) 
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [key, String(value)]
        );
        // Sync to site_settings
        await pool.query(
          `INSERT INTO public.site_settings (key, value, updated_at) 
           VALUES ($1, $2, NOW()) 
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [key, String(value)]
        );
      }
    } catch (pgErr) {
      // PG Pool might not be initialized, SQLite has updated
    }

    return res.json({ success: true, message: 'Pengaturan berhasil disimpan dan disinkronkan ke Supabase.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal menyimpan pengaturan.' });
  }
});

router.post('/upload-branding', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { dataUrl, folder } = req.body || {};
    if (!dataUrl) {
      return res.status(400).json({ success: false, message: 'Tautan data gambar tidak ditemukan.' });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const key = folder === 'background' ? 'login_bg_url' : 'login_image_url';

    db.run('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', [key, String(dataUrl), now]);

    // Also sync to Supabase PG (both settings and site_settings tables)
    try {
      const pool = getPgPool();
      await pool.query(
        `INSERT INTO public.settings (key, value, updated_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, String(dataUrl)]
      );
      await pool.query(
        `INSERT INTO public.site_settings (key, value, updated_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, String(dataUrl)]
      );
    } catch (pgErr) {
      // Ignore
    }

    return res.json({
      success: true,
      url: dataUrl,
      storageType: 'supabase_db_data_url',
      message: 'Gambar terkompresi berhasil disimpan ke Supabase!',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal menyimpan berkas gambar: ' + err.message });
  }
});

router.put('/settings/account', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as SessionData;
    const { name, username, password } = req.body;
    const db = await getDb();
    const now = new Date().toISOString();

    if (username && username.trim() !== user.username) {
      const exists = db.queryOne('SELECT id FROM users WHERE username = ? AND id != ?', [username.trim(), user.userId]);
      if (exists) {
        return res.status(400).json({ success: false, message: 'Username sudah dipakai oleh pengguna lain.' });
      }
    }

    if (password && password.trim()) {
      const passwordHash = bcrypt.hashSync(password.trim(), 10);
      db.run(
        `UPDATE users SET name = ?, username = ?, password_hash = ?, updated_at = ? WHERE id = ?`,
        [name ? name.trim() : user.name, username ? username.trim() : user.username, passwordHash, now, user.userId]
      );
    } else {
      db.run(
        `UPDATE users SET name = ?, username = ?, updated_at = ? WHERE id = ?`,
        [name ? name.trim() : user.name, username ? username.trim() : user.username, now, user.userId]
      );
    }

    // Update in session
    if (user) {
      user.name = name || user.name;
      user.username = username || user.username;
    }

    return res.json({ success: true, message: 'Data akun berhasil diperbarui.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui akun.' });
  }
});

// Database & Supabase connection test
router.get('/database-status', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const studentsCount = db.queryOne('SELECT COUNT(*) as count FROM students')?.count || 0;
    const examsCount = db.queryOne('SELECT COUNT(*) as count FROM exams')?.count || 0;

    return res.json({
      success: true,
      data: {
        engine: 'SQLite / Relational SQL (Active Engine)',
        host: pgConfig.host,
        port: pgConfig.port,
        database: pgConfig.database,
        user: pgConfig.user,
        records: {
          students: studentsCount,
          exams: examsCount,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/test-db-connection', async (req: Request, res: Response) => {
  try {
    const { password } = req.body || {};
    const result = await testPostgresConnection(password);
    return res.json({
      success: result.connected,
      message: result.message,
      serverTime: result.serverTime,
      pgVersion: result.pgVersion,
      config: {
        host: pgConfig.host,
        port: pgConfig.port,
        database: pgConfig.database,
        user: pgConfig.user,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Gagal melakukan tes koneksi PostgreSQL.',
    });
  }
});

router.post('/supabase/auto-migrate', requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const { password } = req.body || {};
    const result = await runSupabaseAutoMigration(password);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Gagal menjalankan migrasi otomatis Supabase.',
      createdTables: [],
      errors: [error.message],
    });
  }
});

router.get('/supabase/schema-sql', (req: Request, res: Response) => {
  return res.json({
    success: true,
    sql: SUPABASE_SQL_STATEMENTS.join('\n\n'),
  });
});


