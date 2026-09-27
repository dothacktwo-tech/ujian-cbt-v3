import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DB_FILE = path.resolve(process.cwd(), 'data', 'cbt.sqlite');

const pgConfig = {
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || process.env.SUPABASE_DB_PASSWORD || '',
  ssl: {
    rejectUnauthorized: false,
  },
};

async function runMigration() {
  console.log('=== CBT SQLite to Supabase PostgreSQL Migration ===');

  if (!fs.existsSync(DB_FILE)) {
    console.warn(`Local SQLite database file not found at: ${DB_FILE}`);
    console.info('Skipping local file migration because there is no existing SQLite file. Fresh seed will be initialized on startup.');
    return;
  }

  // Load SQL.js to parse SQLite file
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_FILE);
  const db = new SQL.Database(fileBuffer);

  // Connect to PostgreSQL
  const { Client } = pg;
  const client = new Client(pgConfig.connectionString ? {
    connectionString: pgConfig.connectionString,
    ssl: { rejectUnauthorized: false }
  } : pgConfig);

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL successfully.');
  } catch (err: any) {
    console.error('Failed to connect to Supabase PostgreSQL database:', err.message);
    process.exit(1);
  }

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

  const report: Record<string, number> = {};

  try {
    for (const table of tables) {
      // 1. Query rows from SQLite
      const rows: any[] = [];
      try {
        const stmt = db.prepare(`SELECT * FROM ${table}`);
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
      } catch (err: any) {
        console.warn(`Could not read local SQLite table "${table}": ${err.message}. Skipping...`);
        continue;
      }

      if (rows.length === 0) {
        console.log(`Table "${table}" has 0 rows in SQLite. Skipping migration for this table.`);
        report[table] = 0;
        continue;
      }

      // 2. Insert rows into Postgres
      const columns = Object.keys(rows[0]);
      let migratedCount = 0;

      for (const row of rows) {
        const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
        
        // Define specific ON CONFLICT resolution per table to prevent foreign key errors and duplicates
        let conflictClause = 'ON CONFLICT DO NOTHING';
        if (table === 'settings' || table === 'site_settings') {
          conflictClause = 'ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at';
        } else if (table === 'answers') {
          conflictClause = 'ON CONFLICT (exam_id, student_id, question_id) DO UPDATE SET answer = EXCLUDED.answer, updated_at = EXCLUDED.updated_at';
        } else if (table === 'users') {
          conflictClause = 'ON CONFLICT (username) DO NOTHING';
        } else if (table === 'students') {
          conflictClause = 'ON CONFLICT (username) DO NOTHING';
        }

        const query = `INSERT INTO public.${table} (${columns.join(', ')}) VALUES (${placeholders}) ${conflictClause}`;
        
        const vals = columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return null;
          return val;
        });

        try {
          await client.query(query, vals);
          migratedCount++;
        } catch (err: any) {
          console.warn(`[Warning] Failed to migrate a row in "${table}":`, err.message);
        }
      }

      console.log(`Migrated "${table}": ${migratedCount} / ${rows.length} rows successfully.`);
      report[table] = migratedCount;
    }

    console.log('\n=== MIGRATION REPORT ===');
    for (const [table, count] of Object.entries(report)) {
      console.log(`${table.padEnd(15)} : ${count} migrated`);
    }
    console.log('\nMigration completed successfully.');

  } catch (err: any) {
    console.error('An error occurred during SQLite to Supabase PostgreSQL migration:', err.message);
  } finally {
    await client.end();
  }
}

runMigration().catch(console.error);
