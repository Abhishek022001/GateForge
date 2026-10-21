import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendDir, '..');

const frontendCandidates = [
  path.join(repoRoot, 'frontend'),
  path.resolve(process.cwd(), 'frontend'),
  path.resolve(process.cwd(), '../frontend'),
];

const frontendDir = frontendCandidates.find((dir) => fs.existsSync(dir));
const hasFrontendModules = frontendDir && fs.existsSync(path.join(frontendDir, 'node_modules'));

if (frontendDir && hasFrontendModules && process.env.SKIP_FRONTEND_BUILD !== 'true') {
  console.log(`[Unified Build] Found frontend directory with dependencies at: ${frontendDir}`);
  try {
    console.log('[Unified Build] Running frontend build (Vite)...');
    execSync('npm run build', {
      cwd: frontendDir,
      stdio: 'inherit',
    });
    console.log('[Unified Build] Frontend build completed successfully.');
  } catch (err) {
    console.warn('[Unified Build] Frontend build skipped or failed (Vercel hosts frontend):', err.message);
  }
} else {
  console.log('[Unified Build] Frontend dependencies not found or frontend hosted externally; skipping frontend build.');
}

console.log('[Unified Build] Compiling backend TypeScript (tsc)...');
try {
  execSync('tsc', {
    cwd: backendDir,
    stdio: 'inherit',
  });
  console.log('[Unified Build] Backend TypeScript compilation completed successfully.');
} catch (err) {
  console.error('[Unified Build] TypeScript compilation failed:', err.message);
  process.exit(1);
}
