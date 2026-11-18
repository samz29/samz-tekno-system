import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export function resolveAppRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

let envLoaded = false;

export function loadEnvironment(): string {
  const appRoot = resolveAppRoot();
  if (!envLoaded) {
    const envPath = path.join(appRoot, '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false, quiet: true });
    } else {
      dotenv.config({ quiet: true });
    }
    envLoaded = true;
  }
  return appRoot;
}

export interface DatabaseConfig {
  appRoot: string;
  dataDir: string;
  dbPath: string;
  source: 'DATABASE_PATH' | 'SQLITE_PATH' | 'DB_PATH' | 'DATA_DIR' | 'default';
}

export function resolveDatabaseConfig(): DatabaseConfig {
  const appRoot = loadEnvironment();
  const resolveFromRoot = (rawPath: string): string =>
    path.isAbsolute(rawPath) ? path.normalize(rawPath) : path.resolve(appRoot, rawPath);

  const explicitDbVars: Array<{
    key: 'DATABASE_PATH' | 'SQLITE_PATH' | 'DB_PATH';
    value?: string;
  }> = [
    { key: 'DATABASE_PATH', value: process.env.DATABASE_PATH?.trim() },
    { key: 'SQLITE_PATH', value: process.env.SQLITE_PATH?.trim() },
    { key: 'DB_PATH', value: process.env.DB_PATH?.trim() },
  ];

  for (const entry of explicitDbVars) {
    if (entry.value) {
      const resolved = resolveFromRoot(entry.value);
      return {
        appRoot,
        dataDir: path.dirname(resolved),
        dbPath: resolved,
        source: entry.key,
      };
    }
  }

  const configuredDataDir = process.env.DATA_DIR?.trim();
  if (configuredDataDir) {
    const resolvedDir = resolveFromRoot(configuredDataDir);
    return {
      appRoot,
      dataDir: resolvedDir,
      dbPath: path.join(resolvedDir, 'fakturaflow.db'),
      source: 'DATA_DIR',
    };
  }

  const defaultDir = path.join(appRoot, 'data');
  return {
    appRoot,
    dataDir: defaultDir,
    dbPath: path.join(defaultDir, 'fakturaflow.db'),
    source: 'default',
  };
}

const DB_SINGLETON_KEY = Symbol.for('fakturaflow.sqlite.instance');
const EXIT_HOOK_KEY = Symbol.for('fakturaflow.sqlite.exitHook');

type GlobalWithDb = typeof globalThis & {
  [DB_SINGLETON_KEY]?: Database.Database;
  [EXIT_HOOK_KEY]?: boolean;
};

function openSqliteConnection(config: DatabaseConfig): Database.Database {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }

  const conn = new Database(config.dbPath, {
    timeout: 5000,
  });

  try {
    conn.pragma('busy_timeout = 5000');
  } catch {
    // Ignore if pragma unsupported
  }

  try {
    conn.pragma('journal_mode = WAL');
  } catch {
    // Fallback to default journal mode on filesystems without mmap/WAL support
  }

  try {
    conn.pragma('synchronous = NORMAL');
  } catch {
    // Ignore if pragma unsupported
  }

  conn.pragma('foreign_keys = ON');
  return conn;
}

const initialConfig = resolveDatabaseConfig();
export const dataDir = initialConfig.dataDir;
export const dbPath = initialConfig.dbPath;
export const dbConfigSource = initialConfig.source;

export function getDb(): Database.Database {
  const globalScope = globalThis as GlobalWithDb;
  const existing = globalScope[DB_SINGLETON_KEY];
  if (existing && existing.open) {
    return existing;
  }

  const config = resolveDatabaseConfig();
  const conn = openSqliteConnection(config);
  globalScope[DB_SINGLETON_KEY] = conn;

  if (!globalScope[EXIT_HOOK_KEY]) {
    globalScope[EXIT_HOOK_KEY] = true;
    process.once('exit', () => {
      closeDatabase();
    });
  }

  return conn;
}

export const db: Database.Database = getDb();

export function withTransaction<T>(fn: () => T): T {
  const conn = getDb();
  const tx = conn.transaction(fn);
  return tx();
}

export function verifyDatabaseConnection(): {
  ok: boolean;
  journalMode: string;
  error?: string;
} {
  try {
    const conn = getDb();
    const ping = conn.prepare('SELECT 1 AS ok').get() as { ok?: number } | undefined;
    const modeRow = conn.pragma('journal_mode', { simple: true });
    return {
      ok: Boolean(ping && ping.ok === 1),
      journalMode: typeof modeRow === 'string' ? modeRow : 'unknown',
    };
  } catch (err) {
    return {
      ok: false,
      journalMode: 'unavailable',
      error: err instanceof Error ? err.message : 'Database connection check failed',
    };
  }
}

export function closeDatabase(): void {
  const globalScope = globalThis as GlobalWithDb;
  const conn = globalScope[DB_SINGLETON_KEY];
  if (!conn) return;

  try {
    if (conn.open) {
      try {
        conn.pragma('wal_checkpoint(TRUNCATE)');
      } catch {
        // Ignore checkpoint error when closing
      }
      conn.close();
    }
  } catch (err) {
    console.error('Failed to close SQLite connection cleanly:', err);
  } finally {
    delete globalScope[DB_SINGLETON_KEY];
  }
}
