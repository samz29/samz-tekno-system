import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const envFile = path.join(__dirname, '.env');
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: false, quiet: true });
  } else {
    dotenv.config({ quiet: true });
  }
}

function canUseDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function ensurePersistentDbDirectory() {
  const resolveFromRoot = (rawPath) => {
    const expanded =
      rawPath.startsWith('~/') || rawPath === '~'
        ? path.join(os.homedir(), rawPath.slice(1))
        : rawPath;
    return path.isAbsolute(expanded)
      ? path.normalize(expanded)
      : path.resolve(__dirname, expanded);
  };

  const explicitPath =
    process.env.DATABASE_PATH?.trim() ||
    process.env.SQLITE_PATH?.trim() ||
    process.env.DB_PATH?.trim();

  if (explicitPath) {
    const targetDir = path.dirname(resolveFromRoot(explicitPath));
    fs.mkdirSync(targetDir, { recursive: true });
    fs.accessSync(targetDir, fs.constants.R_OK | fs.constants.W_OK);
    return;
  }

  const configuredDataDir = process.env.DATA_DIR?.trim();
  if (configuredDataDir) {
    const targetDir = resolveFromRoot(configuredDataDir);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.accessSync(targetDir, fs.constants.R_OK | fs.constants.W_OK);
    return;
  }

  const hostMatch = path
    .normalize(__dirname)
    .match(/^(.+?)[/\\]hbuilds[/\\]versions[/\\]([^/\\]+)(?:[/\\].*)?$/i);
  if (hostMatch) {
    const domainRoot = hostMatch[1];
    const hbuildsDir = path.join(domainRoot, 'hbuilds');
    if (
      canUseDir(path.join(domainRoot, 'fakturaflow-data')) ||
      canUseDir(path.join(hbuildsDir, 'fakturaflow-data'))
    ) {
      return;
    }
  }

  const fallbackDir = path.join(__dirname, 'data');
  fs.mkdirSync(fallbackDir, { recursive: true });
  fs.accessSync(fallbackDir, fs.constants.R_OK | fs.constants.W_OK);
}

loadDotEnv();

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

const compiledServer = path.join(__dirname, 'dist-server', 'server.mjs');

async function boot() {
  ensurePersistentDbDirectory();

  if (fs.existsSync(compiledServer)) {
    await import(pathToFileURL(compiledServer).href);
    return;
  }

  const { register } = await import('tsx/esm/api');
  register();
  await import(pathToFileURL(path.join(__dirname, 'server.ts')).href);
}

boot().catch((err) => {
  console.error('Fatal boot error:', err);
  process.exit(1);
});
