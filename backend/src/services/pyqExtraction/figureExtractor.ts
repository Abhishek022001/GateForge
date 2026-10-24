/**
 * Official GATE PDF Figure Extractor Service
 * Coordinates running the Python PyMuPDF script to extract visual schematics,
 * circuits, K-maps, and state automata diagrams directly from official PDF pages.
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function extractFiguresForSource(pdfPath: string, sourceId: string): Record<number, string> {
  const scriptPath = path.resolve(__dirname, '../../scripts/extract_paper_figures.py');
  const outDir = path.resolve(__dirname, '../../../public/figures');

  if (!fs.existsSync(pdfPath)) {
    return {};
  }

  try {
    fs.mkdirSync(outDir, { recursive: true });
    const raw = execSync(`python "${scriptPath}" "${pdfPath}" "${sourceId}" "${outDir}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 30000,
    });
    const parsed = JSON.parse(raw.trim() || '{}');
    const result: Record<number, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      result[Number(k)] = String(v);
    }
    return result;
  } catch (err: any) {
    console.warn(`[FigureExtractor] Warning: Could not extract figures for ${sourceId}:`, err.message);
    return {};
  }
}
