import dotenv from 'dotenv';
import fs from 'fs';
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

function ensurePersistentDbDirectory() {
  const resolveFromRoot = (rawPath) =>
    path.isAbsolute(rawPath) ? path.normalize(rawPath) : path.resolve(__dirname, rawPath);

  const explicitPath =
    process.env.DATABASE_PATH?.trim() ||
    process.env.SQLITE_PATH?.trim() ||
    process.env.DB_PATH?.trim();

  const targetDir = explicitPath
    ? path.dirname(resolveFromRoot(explicitPath))
    : process.env.DATA_DIR?.trim()
      ? resolveFromRoot(process.env.DATA_DIR.trim())
      : path.join(__dirname, 'data');

  fs.mkdirSync(targetDir, { recursive: true });
  fs.accessSync(targetDir, fs.constants.R_OK | fs.constants.W_OK);
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
