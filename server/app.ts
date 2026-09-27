import dns from 'dns';
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { router, authMiddleware } from './routes.js';
import { getDb } from './db.js';
import { runSupabaseAutoMigration } from './pg.js';

dotenv.config({ override: true });

const app = express();

// Async database and migration initialization
let dbInitialized = false;
export async function initDatabaseAndMigrations() {
  if (dbInitialized) return;
  try {
    // Initialize Database (SQLite/SQL.js in-memory loaded from Supabase)
    await getDb();
    console.log('[Database] Relational Database (SQLite/SQL.js) initialized and synchronized from Supabase.');

    // Auto-sync / Auto-create tables in Supabase if database configured
    if (process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD || process.env.DATABASE_URL) {
      const migrationResult = await runSupabaseAutoMigration();
      if (migrationResult.success) {
        console.log('[Supabase Auto-Sync] Sukses: Seluruh tabel Supabase PostgreSQL telah otomatis dibuat dan diselaraskan.');
      } else {
        console.log('[Supabase Auto-Sync] Info:', migrationResult.message);
      }
    }
    dbInitialized = true;
  } catch (err: any) {
    console.warn('[Supabase Auto-Sync Notice] Migrasi otomatis ditunda:', err.message);
  }
}

// Global initialization middleware for serverless environment to ensure DB is ready
app.use(async (req, res, next) => {
  try {
    await initDatabaseAndMigrations();
  } catch (err: any) {
    console.error('[Startup DB Init Error]', err.message);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(authMiddleware);

// Mount API Router
app.use('/api', router);

// Global Error Handler for Express to prevent HTML 500 error pages on Vercel
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Express Serverless Global Error]:', err);
  if (res.headersSent) return;

  const status = typeof err.status === 'number' ? err.status : 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Terjadi kesalahan internal pada server.',
    error: process.env.NODE_ENV !== 'production' ? (err.stack || err.message) : undefined,
  });
});

export default app;
