import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const ifNeeded = process.argv.includes('--if-needed');

const distIndex = path.join(appRoot, 'dist', 'index.html');
const serverOut = path.join(appRoot, 'dist-server', 'server.mjs');

async function run() {
  const isProdOrDeployEnv =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_config_production === 'true' ||
    /[/\\]hbuilds[/\\]/i.test(appRoot);

  if (ifNeeded && !isProdOrDeployEnv) {
    return;
  }

  if (ifNeeded && fs.existsSync(distIndex) && fs.existsSync(serverOut)) {
    return;
  }

  let viteBuild;
  let esbuild;
  try {
    ({ build: viteBuild } = await import('vite'));
    esbuild = await import('esbuild');
  } catch (err) {
    if (ifNeeded) {
      return;
    }
    throw err;
  }

  if (!ifNeeded || !fs.existsSync(distIndex)) {
    await viteBuild({ root: appRoot });
  }

  if (!ifNeeded || !fs.existsSync(serverOut)) {
    fs.mkdirSync(path.dirname(serverOut), { recursive: true });
    await esbuild.build({
      entryPoints: [path.join(appRoot, 'server.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      packages: 'external',
      outfile: serverOut,
    });
  }
}

run().catch((err) => {
  console.error('Build error:', err);
  if (!ifNeeded) {
    process.exit(1);
  }
});
