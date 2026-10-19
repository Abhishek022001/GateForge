import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find server.js whether running from src/ or dist/
const candidates = [
  path.join(__dirname, 'server.js'),
  path.join(__dirname, '../src/server.js'),
  path.join(process.cwd(), 'src/server.js'),
  path.join(process.cwd(), 'backend/src/server.js'),
];

const target = candidates.find((c) => fs.existsSync(c));
if (target) {
  await import(pathToFileURL(target).href);
} else {
  console.error('[GATEForge] Could not locate complete server.js. Checked:', candidates);
  process.exit(1);
}
