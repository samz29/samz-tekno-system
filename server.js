import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compiledServer = path.join(__dirname, 'dist-server', 'server.mjs');

async function boot() {
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
