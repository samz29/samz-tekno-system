import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
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

export type DatabaseConfigSource =
  | 'DATABASE_PATH'
  | 'SQLITE_PATH'
  | 'DB_PATH'
  | 'DATA_DIR'
  | 'hostinger-persistent'
  | 'default';

export interface VersionedHostLayout {
  domainRoot: string;
  hbuildsDir: string;
  versionsDir: string;
  currentVersionId: string;
}

export interface DatabaseConfig {
  appRoot: string;
  dataDir: string;
  dbPath: string;
  source: DatabaseConfigSource;
  persistent: boolean;
  hostLayout: VersionedHostLayout | null;
}

export function detectVersionedHostLayout(targetPath: string): VersionedHostLayout | null {
  const normalized = path.normalize(targetPath);
  const match = normalized.match(/^(.+?)[/\\]hbuilds[/\\]versions[/\\]([^/\\]+)(?:[/\\].*)?$/i);
  if (!match) return null;

  const domainRoot = match[1];
  const currentVersionId = match[2];
  const hbuildsDir = path.join(domainRoot, 'hbuilds');
  const versionsDir = path.join(hbuildsDir, 'versions');
  return { domainRoot, hbuildsDir, versionsDir, currentVersionId };
}

function isPathInsideDir(targetPath: string, parentDir: string): boolean {
  const rel = path.relative(path.resolve(parentDir), path.resolve(targetPath));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function canUsePersistentDirectory(dirPath: string): boolean {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function resolvePersistentHostingerDir(hostLayout: VersionedHostLayout): string | null {
  const candidates = [
    path.join(hostLayout.domainRoot, 'fakturaflow-data'),
    path.join(hostLayout.hbuildsDir, 'fakturaflow-data'),
  ];

  for (const candidate of candidates) {
    if (canUsePersistentDirectory(candidate)) {
      return candidate;
    }
  }
  return null;
}

function migrateFromPreviousVersionIfNeeded(
  targetDbPath: string,
  hostLayout: VersionedHostLayout | null
): boolean {
  if (!hostLayout) return false;
  if (fs.existsSync(targetDbPath)) return false;
  if (isPathInsideDir(targetDbPath, hostLayout.versionsDir)) return false;

  try {
    if (!fs.existsSync(hostLayout.versionsDir)) return false;
    const versionEntries = fs.readdirSync(hostLayout.versionsDir, { withFileTypes: true });
    const candidates: Array<{ filePath: string; mtimeMs: number }> = [];

    for (const entry of versionEntries) {
      if (!entry.isDirectory()) continue;
      const versionPath = path.join(hostLayout.versionsDir, entry.name);
      const possibleDbPaths = [
        path.join(versionPath, 'nodejs', 'data', 'fakturaflow.db'),
        path.join(versionPath, 'data', 'fakturaflow.db'),
      ];

      for (const candidatePath of possibleDbPaths) {
        if (path.resolve(candidatePath) === path.resolve(targetDbPath)) continue;
        try {
          const stat = fs.statSync(candidatePath);
          if (stat.isFile() && stat.size > 0) {
            candidates.push({ filePath: candidatePath, mtimeMs: stat.mtimeMs });
          }
        } catch {
          // Ignore unreadable version candidate
        }
      }
    }

    if (candidates.length === 0) return false;

    candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const newest = candidates[0];

    fs.mkdirSync(path.dirname(targetDbPath), { recursive: true });
    fs.copyFileSync(newest.filePath, targetDbPath);

    for (const suffix of ['-wal', '-shm']) {
      const srcSidecar = `${newest.filePath}${suffix}`;
      const dstSidecar = `${targetDbPath}${suffix}`;
      if (fs.existsSync(srcSidecar)) {
        try {
          const sidecarStat = fs.statSync(srcSidecar);
          if (sidecarStat.isFile() && sidecarStat.size > 0) {
            fs.copyFileSync(srcSidecar, dstSidecar);
          }
        } catch {
          // Ignore optional WAL/SHM sidecar copy error
        }
      }
    }

    console.info(
      `[db] Migrated existing SQLite database from previous deploy version to persistent storage (${path.basename(targetDbPath)}).`
    );
    return true;
  } catch (err) {
    console.warn('[db] Unable to scan previous deploy versions for SQLite migration:', err);
    return false;
  }
}

export function resolveDatabaseConfig(): DatabaseConfig {
  const appRoot = loadEnvironment();
  const hostLayout = detectVersionedHostLayout(appRoot);
  const resolveFromRoot = (rawPath: string): string => {
    const expanded =
      rawPath.startsWith('~/') || rawPath === '~'
        ? path.join(os.homedir(), rawPath.slice(1))
        : rawPath;
    return path.isAbsolute(expanded)
      ? path.normalize(expanded)
      : path.resolve(appRoot, expanded);
  };

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
      const persistent = !hostLayout || !isPathInsideDir(resolved, hostLayout.versionsDir);
      return {
        appRoot,
        dataDir: path.dirname(resolved),
        dbPath: resolved,
        source: entry.key,
        persistent,
        hostLayout,
      };
    }
  }

  const configuredDataDir = process.env.DATA_DIR?.trim();
  if (configuredDataDir) {
    const resolvedDir = resolveFromRoot(configuredDataDir);
    const resolvedDb = path.join(resolvedDir, 'fakturaflow.db');
    const persistent = !hostLayout || !isPathInsideDir(resolvedDb, hostLayout.versionsDir);
    return {
      appRoot,
      dataDir: resolvedDir,
      dbPath: resolvedDb,
      source: 'DATA_DIR',
      persistent,
      hostLayout,
    };
  }

  if (hostLayout) {
    const persistentDir = resolvePersistentHostingerDir(hostLayout);
    if (persistentDir) {
      return {
        appRoot,
        dataDir: persistentDir,
        dbPath: path.join(persistentDir, 'fakturaflow.db'),
        source: 'hostinger-persistent',
        persistent: true,
        hostLayout,
      };
    }
  }

  const defaultDir = path.join(appRoot, 'data');
  return {
    appRoot,
    dataDir: defaultDir,
    dbPath: path.join(defaultDir, 'fakturaflow.db'),
    source: 'default',
    persistent: !hostLayout,
    hostLayout,
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

  migrateFromPreviousVersionIfNeeded(config.dbPath, config.hostLayout);

  if (!config.persistent) {
    console.warn(
      '[db] WARNING: SQLite database path is inside an ephemeral build directory (hbuilds/versions). Set DATABASE_PATH to a path outside hbuilds/versions so data persists across deploys.'
    );
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
  source: DatabaseConfigSource;
  persistent: boolean;
  error?: string;
} {
  const config = resolveDatabaseConfig();
  try {
    const conn = getDb();
    const ping = conn.prepare('SELECT 1 AS ok').get() as { ok?: number } | undefined;
    const modeRow = conn.pragma('journal_mode', { simple: true });
    return {
      ok: Boolean(ping && ping.ok === 1),
      journalMode: typeof modeRow === 'string' ? modeRow : 'unknown',
      source: config.source,
      persistent: config.persistent,
    };
  } catch (err) {
    return {
      ok: false,
      journalMode: 'unavailable',
      source: config.source,
      persistent: config.persistent,
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

export default db;
